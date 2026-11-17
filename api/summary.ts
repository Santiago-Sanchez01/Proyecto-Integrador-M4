import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SummaryError, SummaryErrorCode } from '../shared/summary.types'
import { authenticateUser, AuthenticationError } from '../server/authenticated-user'
import { MAX_SUMMARY_BYTES, readTaskSummary, SummaryTooLargeError } from '../server/task-summary'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  function fail(status: number, code: SummaryErrorCode, message: string) {
    res.statusCode = status
    return res.end(JSON.stringify({ error: { code, message } } satisfies SummaryError))
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(405, 'METHOD_NOT_ALLOWED', 'Usá POST para consultar el resumen.')
  }
  let uid: string
  try {
    uid = (await authenticateUser(req)).uid
  } catch (error) {
    if (error instanceof AuthenticationError) return fail(error.status, error.code, error.message)
    return fail(500, 'INTERNAL_ERROR', 'No pudimos obtener tu resumen. Intentá nuevamente.')
  }
  try {
    // Body and query parameters never determine identity or collection paths.
    const summary = await readTaskSummary(uid)
    if (Buffer.byteLength(JSON.stringify(summary), 'utf8') > MAX_SUMMARY_BYTES) throw new SummaryTooLargeError()
    res.statusCode = 200
    return res.end(JSON.stringify(summary))
  } catch (error) {
    if (error instanceof SummaryTooLargeError) return fail(413, 'SUMMARY_TOO_LARGE', 'El resumen supera el tamaño permitido.')
    return fail(500, 'INTERNAL_ERROR', 'No pudimos obtener tu resumen. Intentá nuevamente.')
  }
}
