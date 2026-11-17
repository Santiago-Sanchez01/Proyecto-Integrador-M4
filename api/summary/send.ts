import type { IncomingMessage, ServerResponse } from 'node:http'
import { authenticateUser, AuthenticationError } from '../../server/authenticated-user'
import { RecipientResolutionError } from '../../server/summary-recipient'
import { SummaryEmailTooLargeError } from '../../server/summary-email'
import { SummaryTooLargeError } from '../../server/task-summary'
import { readSummarySendRequest, SendRequestTooLargeError } from '../../server/summary-send-request'
import { sendSummary } from '../../server/send-summary'
import { SummarySendFailure } from '../../server/summary-send-errors'
import type { SummarySendError } from '../../shared/summary-send.types'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const fail = (status: number, body: SummarySendError) => { res.statusCode = status; return res.end(JSON.stringify(body)) }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Usá POST para solicitar el envío.' } })
  }
  try {
    const identity = await authenticateUser(req)
    const requestId = await readSummarySendRequest(req)
    const result = await sendSummary(identity, requestId)
    res.statusCode = 202
    return res.end(JSON.stringify(result))
  } catch (error) {
    if (error instanceof SummarySendFailure || error instanceof AuthenticationError || error instanceof RecipientResolutionError || error instanceof SummaryEmailTooLargeError || error instanceof SendRequestTooLargeError) {
      const retryAfterSeconds = error instanceof SummarySendFailure ? error.retryAfterSeconds : undefined
      if (retryAfterSeconds !== undefined) res.setHeader('Retry-After', retryAfterSeconds)
      return fail(error.status, { error: { code: error.code, message: error.message }, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) })
    }
    if (error instanceof SummaryTooLargeError) return fail(413, { error: { code: 'SUMMARY_TOO_LARGE', message: 'El resumen supera el tamaño permitido.' } })
    return fail(500, { error: { code: 'INTERNAL_ERROR', message: 'No pudimos solicitar tu resumen. Intentá nuevamente más tarde.' } })
  }
}
