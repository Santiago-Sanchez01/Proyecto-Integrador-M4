import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { once } from 'node:events'
import { beforeEach, expect, it, vi } from 'vitest'
import handler from '../../api/summary'
import { getAdminAuth } from '../../server/firebase-admin'
import { MAX_SUMMARY_BYTES, readTaskSummary, SummaryTooLargeError } from '../../server/task-summary'
import type { TaskSummary } from '../../shared/summary.types'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn() }))
vi.mock('../../server/task-summary', async importOriginal => {
  const original = await importOriginal<typeof import('../../server/task-summary')>()
  return { ...original, readTaskSummary: vi.fn() }
})
const verify = vi.fn()
const empty: TaskSummary = { user: { uid: 'alice' }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [] }
function request(method = 'POST', authorization: unknown = 'Bearer test-token') {
  return { method, headers: { authorization }, body: { uid: 'victim', email: 'victim@example.com', path: 'users/victim/tasks' }, query: { uid: 'victim' } } as unknown as IncomingMessage
}
async function call(req = request()) {
  const headers = new Map<string, unknown>()
  const end = vi.fn()
  const res = { statusCode: 200, setHeader: (name: string, value: unknown) => headers.set(name, value), end } as unknown as ServerResponse
  await handler(req, res)
  return { status: res.statusCode, headers, body: JSON.parse(end.mock.calls[0][0] as string) }
}
beforeEach(() => {
  vi.resetAllMocks()
  verify.mockResolvedValue({ uid: 'alice', email: 'private@example.com', customClaim: 'not-returned' })
  vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken: verify } as unknown as ReturnType<typeof getAdminAuth>)
  vi.mocked(readTaskSummary).mockResolvedValue(empty)
})

it('acepta POST autenticado, comprueba revocación e ignora identidad del body y query', async () => {
  const result = await call()
  expect(result.status).toBe(200)
  expect(result.body).toEqual(empty)
  expect(verify).toHaveBeenCalledWith('test-token', true)
  expect(readTaskSummary).toHaveBeenCalledWith('alice')
  expect(JSON.stringify(result.body)).not.toMatch(/victim|private@example|customClaim|test-token/)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(result.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store')
})

it.each(['GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'])('rechaza %s antes de inicializar Admin', async method => {
  const result = await call(request(method))
  expect(result.status).toBe(405)
  expect(result.headers.get('Allow')).toBe('POST')
  expect(result.body.error.code).toBe('METHOD_NOT_ALLOWED')
  expect(getAdminAuth).not.toHaveBeenCalled()
  expect(readTaskSummary).not.toHaveBeenCalled()
})

it('rechaza ausencia de token', async () => {
  const result = await call(request('POST', null))
  expect(result.status).toBe(401)
  expect(result.body.error.code).toBe('UNAUTHENTICATED')
  expect(getAdminAuth).not.toHaveBeenCalled()
})

it.each(['Basic token', 'Bearer ', 'Bearer two tokens', 'Bearer one,Bearer two', ['Bearer one', 'Bearer two'], 'Bearer ' + 'a'.repeat(8192)])('rechaza Authorization inválido sin leer Firestore: %s', async header => {
  expect((await call(request('POST', header))).body.error.code).toBe('INVALID_TOKEN')
  expect(verify).not.toHaveBeenCalled()
  expect(readTaskSummary).not.toHaveBeenCalled()
})

it.each(['auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled'])('rechaza token %s sin exponer detalles', async code => {
  verify.mockRejectedValue({ code, message: 'SECRET_TOKEN_OR_TRACE' })
  const result = await call()
  expect(result.status).toBe(401)
  expect(result.body.error.code).toBe('INVALID_TOKEN')
  expect(JSON.stringify(result.body)).not.toContain('SECRET')
  expect(readTaskSummary).not.toHaveBeenCalled()
})

it.each([null, '', 'alice/tasks/other'])('rechaza identidad verificada inválida: %s', async uid => {
  verify.mockResolvedValue({ uid })
  expect((await call()).status).toBe(401)
  expect(readTaskSummary).not.toHaveBeenCalled()
})

it('aísla solicitudes sucesivas de usuarios diferentes', async () => {
  verify.mockResolvedValueOnce({ uid: 'alice' }).mockResolvedValueOnce({ uid: 'bob' })
  await call(); await call()
  expect(vi.mocked(readTaskSummary).mock.calls).toEqual([['alice'], ['bob']])
})

it.each(['credentials', 'verification-network', 'firestore'])('oculta secretos ante un fallo de %s', async stage => {
  const error = Object.assign(new Error('PRIVATE_KEY SECRET_TOKEN /internal/path stack trace'), { code: 'internal-error' })
  if (stage === 'credentials') vi.mocked(getAdminAuth).mockImplementation(() => { throw error })
  else if (stage === 'verification-network') verify.mockRejectedValue(error)
  else vi.mocked(readTaskSummary).mockRejectedValue(error)
  const result = await call()
  expect(result.status).toBe(500)
  expect(result.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'No pudimos obtener tu resumen. Intentá nuevamente.' } })
})

it('rechaza límites excedidos sin una lista parcial', async () => {
  vi.mocked(readTaskSummary).mockRejectedValue(new SummaryTooLargeError())
  expect((await call()).status).toBe(413)
  vi.mocked(readTaskSummary).mockResolvedValue({ ...empty, user: { uid: 'a'.repeat(MAX_SUMMARY_BYTES) } })
  const result = await call()
  expect(result.status).toBe(413)
  expect(result.body.error.code).toBe('SUMMARY_TOO_LARGE')
  expect(result.body.tasks).toBeUndefined()
})

it.each([200, 401, 405, 413, 500])('impide caché privada y CDN en respuestas HTTP %s', async status => {
  let req = request()
  if (status === 401) req = request('POST', null)
  if (status === 405) req = request('GET')
  if (status === 413) vi.mocked(readTaskSummary).mockRejectedValue(new SummaryTooLargeError())
  if (status === 500) vi.mocked(readTaskSummary).mockRejectedValue(new Error('Simulated database failure'))

  const result = await call(req)
  expect(result.status).toBe(status)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(result.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store')
})

it('responde 500 genérico si ADC no resuelve credenciales al verificar el token', async () => {
  verify.mockRejectedValue({ code: 'app/invalid-credential', message: 'ADC unavailable: confidential credential path' })
  const result = await call()
  expect(result.status).toBe(500)
  expect(result.body.error.code).toBe('INTERNAL_ERROR')
  expect(JSON.stringify(result.body)).not.toMatch(/ADC|credential|confidential/)
  expect(readTaskSummary).not.toHaveBeenCalled()
})

it('responde JSON usando HTTP real en localhost, sin credenciales ni acceso a producción', async () => {
  const server = createServer((req, res) => { void handler(req, res) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing local port')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/summary`, { method: 'POST', headers: { Authorization: 'Bearer test-token' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await response.json()).toEqual(empty)
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
