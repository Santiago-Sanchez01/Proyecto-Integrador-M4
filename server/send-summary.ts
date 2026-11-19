import type { AuthenticatedUser } from './authenticated-user'
import { getAuthenticatedUid } from './authenticated-user.js'
import { resolveSummaryRecipient } from './summary-recipient.js'
import { readTaskSummary } from './task-summary.js'
import { renderSummaryEmail } from './summary-email.js'
import { createSesMailer } from './ses.js'
import type { SummaryMailer } from './ses'
import { createMemorySendGuard } from './summary-send-guard.js'
import type { SummarySendGuard } from './summary-send-guard'
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
  guard: SummarySendGuard
}

export function createSendSummary(deps: Dependencies) {
  return async (identity: AuthenticatedUser, requestId: string): Promise<SummarySendAccepted> => {
    const uid = getAuthenticatedUid(identity), config = deps.configuration()
    if (!config.runtime.allowed) {
      throw new SummarySendFailure(config.runtime.reason === 'DEPLOYED_RUNTIME' ? 'DISTRIBUTED_GUARD_REQUIRED' : 'SEND_DISABLED')
    }
    if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/.test(config.region) || config.fromEmail.length > 254 || !/^[^\s@<>,;:"\r\n]+@[^\s@<>,;:"\r\n]+\.[^\s@<>,;:"\r\n]+$/.test(config.fromEmail)) throw new SummarySendFailure('SEND_DISABLED')
    if (deps.guard.begin(uid, requestId) === 'accepted') return { status: 'accepted', requestId }
    try {
      const recipient = await deps.recipient(identity)
      const summary = await deps.summary(uid)
      const content = deps.render(summary)
      await deps.mailer(config.region, config.fromEmail).send(recipient.email, content)
      deps.guard.finish(uid, requestId, 'accepted')
      return { status: 'accepted', requestId }
    } catch (error) {
      deps.guard.finish(uid, requestId, error instanceof SummarySendFailure && error.code === 'SEND_STATUS_UNKNOWN' ? 'unknown' : 'failed')
      throw error
    }
  }
}
export const sendSummary = createSendSummary({ configuration: readSendConfiguration, recipient: resolveSummaryRecipient, summary: readTaskSummary,
  render: renderSummaryEmail, mailer: createSesMailer, guard: createMemorySendGuard() })
