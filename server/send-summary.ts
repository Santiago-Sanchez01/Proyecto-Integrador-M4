import type { AuthenticatedUser } from './authenticated-user'
import { getAuthenticatedUid } from './authenticated-user.js'
import { resolveSummaryRecipient } from './summary-recipient.js'
import { readTaskSummary } from './task-summary.js'
import { renderSummaryEmail } from './summary-email.js'
import { createSesMailer } from './ses.js'
import type { SummaryMailer } from './ses'
import { createMemorySendGuard, reserveSummarySend } from './summary-send-guard.js'
import type { PersistentSummarySendGuard, SummarySendGuard } from './summary-send-guard'
import { createFirestoreSummarySendGuard, readSummarySendQuotas } from './summary-send-firestore-guard.js'
import { getAdminFirestore } from './firebase-admin.js'
import { createIsolatedPreviewFirestore } from './preview-firestore.js'
import { SummarySendFailure } from './summary-send-errors.js'
import type { SummarySendAccepted } from '../shared/summary-send.types'
import { evaluateSummaryEmailRuntime } from './summary-email-runtime.js'
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
  previewGuard?: (runId: string) => { guard: PersistentSummarySendGuard; close(): Promise<void> }
}

export function createSendSummary(deps: Dependencies) {
  return async (identity: AuthenticatedUser, requestId: string): Promise<SummarySendAccepted> => {
    const uid = getAuthenticatedUid(identity), config = deps.configuration()
    if (!config.runtime.allowed) {
      throw new SummarySendFailure(config.runtime.reason === 'DEPLOYED_RUNTIME' ? 'DISTRIBUTED_GUARD_REQUIRED' : 'SEND_DISABLED')
    }
    if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/.test(config.region) || config.fromEmail.length > 254 || !/^[^\s@<>,;:"\r\n]+@[^\s@<>,;:"\r\n]+\.[^\s@<>,;:"\r\n]+$/.test(config.fromEmail)) throw new SummarySendFailure('SEND_DISABLED')
    const preview = config.runtime.reason === 'PREVIEW_SINGLE_SEND' ? config.runtime : null
    let authorizedRecipient: Awaited<ReturnType<typeof resolveSummaryRecipient>> | undefined
    let previewStore
    let guard = deps.guard
    if (preview) {
      if (uid !== preview.uid || !deps.previewGuard || config.region !== 'us-east-2') throw new SummarySendFailure('SEND_DISABLED')
      authorizedRecipient = await deps.recipient(identity)
      if (authorizedRecipient.uid !== uid || authorizedRecipient.email !== preview.recipient || Date.now() >= preview.expiresAt) {
        throw new SummarySendFailure('SEND_DISABLED')
      }
      previewStore = deps.previewGuard(preview.runId)
      guard = previewStore.guard
    }

    try {
      // A fixed subject and key enforce one attempt across tabs, instances and client UUIDs.
      const reservation = await reserveSummarySend(guard, preview ? 'preview-send' : uid, preview?.runId ?? requestId)
      if (reservation === 'accepted') return { status: 'accepted', requestId }
      const prepare = async () => {
        const recipient = authorizedRecipient ?? await deps.recipient(identity)
        const summary = await deps.summary(uid)
        return { to: recipient.email, content: deps.render(summary), mailer: deps.mailer(config.region, config.fromEmail) }
      }
      const { to, content, mailer } = await prepare().catch(async error => {
        await reservation.finish('failed')
        throw error
      })
      if (preview && Date.now() >= preview.expiresAt) {
        await reservation.finish('failed')
        throw new SummarySendFailure('SEND_DISABLED')
      }
      // A failed start acknowledgement may hide a committed transition. Leave it blocked.
      await reservation.start()
      if (preview && Date.now() >= preview.expiresAt) {
        await reservation.finish('failed')
        throw new SummarySendFailure('SEND_DISABLED')
      }
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
    } finally {
      await previewStore?.close().catch(() => {})
    }
  }
}

function createPreviewSendGuard(runId: string) {
  try {
    // Firebase Auth and task reads still use workspace-m4. Writes use a separate identity and project.
    const firestore = createIsolatedPreviewFirestore('workspace-guard-m4-2026-alt', '(default)', process.env)
    const scope = firestore.collection('summarySendPreviewRuns').doc(runId)
    return { guard: createFirestoreSummarySendGuard(scope, { perUser: 1, global: 4 }), close: () => firestore.terminate() }
  } catch {
    throw new SummarySendFailure('PROVIDER_UNAVAILABLE')
  }
}

const memoryGuard = createMemorySendGuard()
export const sendSummary = createSendSummary({ configuration: readSendConfiguration, recipient: resolveSummaryRecipient, summary: readTaskSummary,
  render: renderSummaryEmail, mailer: createSesMailer, previewGuard: createPreviewSendGuard, guard: {
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
