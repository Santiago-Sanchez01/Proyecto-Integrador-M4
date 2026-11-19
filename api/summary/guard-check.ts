import type { IncomingMessage, ServerResponse } from 'node:http'
import { authenticateUser, AuthenticationError } from '../../server/authenticated-user.js'
import { createGuardCheckFirestore, readGuardCheckConfig, runGuardCheck } from '../../server/firestore-guard-check.js'
import { SummarySendFailure } from '../../server/summary-send-errors.js'
import type { FirestoreGuardCheckErrorCode } from '../../shared/firestore-guard-check.types.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  function fail(status: number, code: FirestoreGuardCheckErrorCode) {
    res.statusCode = status
    return res.end(JSON.stringify({ error: { code } }))
  }

  const env = process.env
  const config = readGuardCheckConfig(env)
  if (!config) return fail(404, 'DIAGNOSTIC_DISABLED')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(405, 'METHOD_NOT_ALLOWED')
  }
  try {
    if ((await authenticateUser(req)).uid !== config.uid) return fail(403, 'FORBIDDEN')
  } catch (error) {
    if (error instanceof AuthenticationError) return fail(error.status, error.code)
    return fail(500, 'INTERNAL_ERROR')
  }

  let db
  try { db = createGuardCheckFirestore(config, env) }
  catch { return fail(503, 'FIRESTORE_UNAVAILABLE') }
  try {
    await runGuardCheck(db)
  } catch (error) {
    if (error instanceof SummarySendFailure && error.code === 'PROVIDER_UNAVAILABLE') {
      return fail(503, 'FIRESTORE_UNAVAILABLE')
    }
    return fail(500, 'GUARD_CHECK_FAILED')
  } finally {
    await db.terminate().catch(() => {})
  }
  res.statusCode = 200
  return res.end(JSON.stringify({ ok: true }))
}
