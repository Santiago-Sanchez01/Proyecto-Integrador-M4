import type { AuthenticatedUser } from './authenticated-user'
import { getAuthenticatedUid } from './authenticated-user'
import { resolveSummaryRecipient } from './summary-recipient'
import { readTaskSummary } from './task-summary'
import { renderSummaryEmail } from './summary-email'
import { createSesMailer } from './ses'
import type { SummaryMailer } from './ses'
import { createMemorySendGuard, reserveSummarySend } from './summary-send-guard'
import type { PersistentSummarySendGuard, SummarySendGuard } from './summary-send-guard'
import { createFirestoreSummarySendGuard, readSummarySendQuotas } from './summary-send-firestore-guard'
import { getAdminFirestore } from './firebase-admin'
import { SummarySendFailure } from './summary-send-errors'
import type { SummarySendAccepted } from '../shared/summary-send.types'
import { evaluateSummaryEmailRuntime } from './summary-email-runtime'
import type { SummaryEmailRuntime } from './summary-email-runtime'

export type SendConfiguration = { runtime: SummaryEmailRuntime; region: string; fromEmail: string }
export function readSendConfiguration(): SendConfiguration {
  return {
    runtime: evaluateSummaryEmailRuntime(process.env),
    region: process.env.AWS_SES_REGION?.trim() ?? '', fromEmail: process.env.SES_FROM_EMAIL?.trim() ?? '',
  }
}
type Dependencies = {
  configuration: () => SendConfiguration
  recipient: typeof resolveSummaryRecipient
  summary: typeof readTaskSummary
  render: typeof renderSummaryEmail
  mailer: (region: string, fromEmail: string) => SummaryMailer
  guard: SummarySendGuard | PersistentSummarySendGuard
}

export function createSendSummary(deps: Dependencies) {
  return async (identity: AuthenticatedUser, requestId: string): Promise<SummarySendAccepted> => {
    const uid = getAuthenticatedUid(identity), config = deps.configuration()
    if (!config.runtime.allowed) {
      throw new SummarySendFailure(config.runtime.reason === 'DEPLOYED_RUNTIME' ? 'DISTRIBUTED_GUARD_REQUIRED' : 'SEND_DISABLED')
    }
    if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/.test(config.region) || config.fromEmail.length > 254 || !/^[^\s@<>,;:"\r\n]+@[^\s@<>,;:"\r\n]+\.[^\s@<>,;:"\r\n]+$/.test(config.fromEmail)) throw new SummarySendFailure('SEND_DISABLED')
    const reservation = await reserveSummarySend(deps.guard, uid, requestId)
    if (reservation === 'accepted') return { status: 'accepted', requestId }
    const prepare = async () => {
      const recipient = await deps.recipient(identity)
      const summary = await deps.summary(uid)
      return { to: recipient.email, content: deps.render(summary), mailer: deps.mailer(config.region, config.fromEmail) }
    }
    const { to, content, mailer } = await prepare().catch(async error => {
      await reservation.finish('failed')
      throw error
    })
    // A failed start acknowledgement may hide a committed transition. Leave it blocked.
    await reservation.start()
    try {
      await mailer.send(to, content)
    } catch (error) {
      const rejected = error instanceof SummarySendFailure && error.code === 'PROVIDER_UNAVAILABLE'
      await reservation.finish(rejected ? 'failed' : 'unknown').catch(() => {
        throw new SummarySendFailure('SEND_STATUS_UNKNOWN')
      })
      throw rejected ? error : new SummarySendFailure('SEND_STATUS_UNKNOWN')
    }
    await reservation.finish('accepted').catch(() => {
      throw new SummarySendFailure('SEND_STATUS_UNKNOWN')
    })
    return { status: 'accepted', requestId }
  }
}
const memoryGuard = createMemorySendGuard()
export const sendSummary = createSendSummary({ configuration: readSendConfiguration, recipient: resolveSummaryRecipient, summary: readTaskSummary,
  render: renderSummaryEmail, mailer: createSesMailer, guard: {
    async reserve(uid, requestId) {
      const mode = process.env.SUMMARY_EMAIL_GUARD
      if (mode === undefined || mode === 'memory') return reserveSummarySend(memoryGuard, uid, requestId)
      if (mode !== 'firestore') throw new SummarySendFailure('SEND_DISABLED')
      const quotas = readSummarySendQuotas(process.env)
      let firestore
      try { firestore = getAdminFirestore() }
      catch { throw new SummarySendFailure('PROVIDER_UNAVAILABLE') }
      return createFirestoreSummarySendGuard(firestore, quotas).reserve(uid, requestId)
    },
  } })
