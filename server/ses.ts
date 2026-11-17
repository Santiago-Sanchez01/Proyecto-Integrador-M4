import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import type { RenderedSummaryEmail } from './summary-email'
import { SummarySendFailure } from './summary-send-errors'

export type SummaryMailer = { send: (to: string, content: RenderedSummaryEmail) => Promise<void> }
type SesTransport = { send: (command: SendEmailCommand) => Promise<{ MessageId?: string }> }
const rejected = new Set(['MessageRejected', 'BadRequestException', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'SendingPausedException', 'TooManyRequestsException', 'LimitExceededException'])

export function createSesMailer(region: string, fromEmail: string, transport?: SesTransport): SummaryMailer {
  // Default credential provider chain. No credentials are resolved at module import.
  const client = transport ?? new SESv2Client({ region, maxAttempts: 1, requestHandler: { connectionTimeout: 3000, requestTimeout: 10_000, throwOnRequestTimeout: true } })
  return {
    async send(to, content) {
      try {
        const result = await client.send(new SendEmailCommand({
          FromEmailAddress: fromEmail,
          Destination: { ToAddresses: [to] },
          Content: { Simple: { Subject: { Data: content.subject, Charset: 'UTF-8' }, Body: {
            Text: { Data: content.text, Charset: 'UTF-8' }, Html: { Data: content.html, Charset: 'UTF-8' },
          } } },
        }))
        if (!result.MessageId?.trim()) throw new SummarySendFailure('SEND_STATUS_UNKNOWN')
      } catch (error) {
        if (error instanceof SummarySendFailure) throw error
        const name = error && typeof error === 'object' && 'name' in error ? error.name : null
        throw new SummarySendFailure(typeof name === 'string' && rejected.has(name) ? 'PROVIDER_UNAVAILABLE' : 'SEND_STATUS_UNKNOWN')
      }
    },
  }
}
