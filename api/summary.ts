import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SummaryError, SummaryErrorCode } from '../shared/summary.types'
import { getAdminAuth } from '../server/firebase-admin'
import { MAX_SUMMARY_BYTES, readTaskSummary, SummaryTooLargeError } from '../server/task-summary'

const invalidTokenCodes = new Set(['auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'])

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
  const authorization = req.headers.authorization
  if (!authorization) return fail(401, 'UNAUTHENTICATED', 'Iniciá sesión para consultar el resumen.')
  const match = typeof authorization === 'string' && authorization.length <= 8192 ? /^Bearer ([^\s,]+)$/i.exec(authorization) : null
  if (!match) return fail(401, 'INVALID_TOKEN', 'La sesión no es válida. Volvé a iniciar sesión.')
  let uid: string
  try {
    const verified = await getAdminAuth().verifyIdToken(match[1], true)
    if (typeof verified.uid !== 'string' || !verified.uid.trim() || verified.uid.includes('/') || verified.uid.length > 128) {
      return fail(401, 'INVALID_TOKEN', 'La sesión no es válida. Volvé a iniciar sesión.')
    }
    uid = verified.uid
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    if (typeof code === 'string' && invalidTokenCodes.has(code)) return fail(401, 'INVALID_TOKEN', 'La sesión no es válida. Volvé a iniciar sesión.')
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
