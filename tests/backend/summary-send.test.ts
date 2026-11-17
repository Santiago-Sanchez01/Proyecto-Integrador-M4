import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer, request as httpRequest } from 'node:http'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, expect, it, vi } from 'vitest'
import handler from '../../api/summary/send'
import { getAdminAuth, getAdminFirestore } from '../../server/firebase-admin'
import { createSendSummary, readSendConfiguration, sendSummary } from '../../server/send-summary'
import type { SendConfiguration } from '../../server/send-summary'
import { resolveSummaryRecipient } from '../../server/summary-recipient'
import { renderSummaryEmail } from '../../server/summary-email'
import { readTaskSummary } from '../../server/task-summary'
import { createMemorySendGuard } from '../../server/summary-send-guard'
import { SummarySendFailure } from '../../server/summary-send-errors'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn(), getAdminFirestore: vi.fn() }))
// Handler and all business services are real; replace only the composition root.
vi.mock('../../server/send-summary', async original => ({ ...await original<typeof import('../../server/send-summary')>(), sendSummary: vi.fn() }))
const verify = vi.fn(), getUser = vi.fn(), collection = vi.fn(), send = vi.fn(), mailer = vi.fn()
let configuration: SendConfiguration
let stored: Record<string, { title: string; description: string; status: string }[]>
let databaseError: Error | null
let paths: string[]
const id = '12345678-1234-4234-8234-123456789abc'
const secondId = '12345678-1234-4234-8234-123456789abd'
function request(options: { method?: string; authorization?: string | null; body?: unknown; url?: string; id?: string; raw?: Buffer; headers?: Record<string, string | undefined> } = {}) {
  const raw = options.raw ?? (options.body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(options.body)))
  return Object.assign(Readable.from(raw.length ? [raw] : []), { method: options.method ?? 'POST', url: options.url ?? '/api/summary/send', complete: true,
    headers: { authorization: options.authorization === null ? undefined : options.authorization ?? 'Bearer fake-alice', 'idempotency-key': options.id ?? id, 'x-user-id': 'bob', 'x-email': 'victim@example.invalid', ...(raw.length ? { 'content-type': 'application/json' } : {}), ...options.headers },
    body: options.body,
  }) as unknown as IncomingMessage
}
async function call(req = request()) {
  const headers = new Map<string, unknown>(), end = vi.fn()
  const res = { statusCode: 200, setHeader: (key: string, value: unknown) => headers.set(key, value), end } as unknown as ServerResponse
  await handler(req, res)
  return { status: res.statusCode, headers, body: JSON.parse(end.mock.calls[0][0] as string) }
}
beforeEach(() => {
  vi.resetAllMocks()
  configuration = { runtime: { allowed: true, reason: 'LOCAL_CONTROLLED' }, region: 'us-east-1', fromEmail: 'workspace@example.invalid' }
  paths = []; databaseError = null
  stored = { alice: [{ title: 'Privada Alice', description: '<script>unsafe()</script> 🎯', status: 'pending' }], bob: [{ title: 'Privada Bob', description: 'Solo Bob', status: 'completed' }] }
  verify.mockImplementation(async (token: string) => ({ uid: token === 'fake-bob' ? 'bob' : 'alice', email: 'old@example.invalid', email_verified: false }))
  getUser.mockImplementation(async (uid: string) => ({ uid, email: `${uid}+current@example.invalid`, emailVerified: true, disabled: false }))
  vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken: verify, getUser } as unknown as ReturnType<typeof getAdminAuth>)
  collection.mockImplementation((name: string) => ({ doc: (uid: string) => ({ collection: (sub: string) => {
    paths.push(`${name}/${uid}/${sub}`)
    const query = { orderBy: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), get: async () => {
      if (databaseError) throw databaseError
      const docs = (stored[uid] ?? []).map((data, i) => ({ id: `${uid}-${i}`, data: () => ({ ...data, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) }) }))
      return { size: docs.length, docs }
    } }
    return query
  } }) }))
  vi.mocked(getAdminFirestore).mockReturnValue({ collection } as unknown as ReturnType<typeof getAdminFirestore>)
  send.mockResolvedValue(undefined); mailer.mockReturnValue({ send })
  vi.mocked(sendSummary).mockImplementation(createSendSummary({ configuration: () => configuration, recipient: resolveSummaryRecipient, summary: readTaskSummary,
    render: renderSummaryEmail, mailer, guard: createMemorySendGuard() }))
})

it.each(['alice', 'bob'])('autentica %s, consulta exclusivamente su ruta y usa su email actual, nunca los headers arbitrarios', async uid => {
  const result = await call(request({ authorization: `Bearer fake-${uid}` }))
  expect(result.status).toBe(202)
  expect(result.body).toEqual({ status: 'accepted', requestId: id })
  expect(verify).toHaveBeenCalledExactlyOnceWith(`fake-${uid}`, true)
  expect(getUser).toHaveBeenCalledExactlyOnceWith(uid)
  expect(paths).toEqual([`users/${uid}/tasks`])
  expect(mailer).toHaveBeenCalledWith('us-east-1', 'workspace@example.invalid')
  expect(send).toHaveBeenCalledWith(`${uid}+current@example.invalid`, expect.objectContaining({ text: expect.stringContaining(uid === 'alice' ? 'Privada Alice' : 'Privada Bob') }))
  const content = send.mock.calls[0][1]
  expect(content.text).not.toContain(uid === 'alice' ? 'Privada Bob' : 'Privada Alice')
  expect(content.html).not.toContain('<script>')
  expect(JSON.stringify(result.body)).not.toMatch(/example.invalid|Privada|fake-|script/)
})

it.each([{ uid: 'bob' }, { email: 'bob@example.invalid' }, { tasks: [] }, { html: '<b>html</b>' }, { from: 'bob@example.invalid' }])('rechaza campos del cliente sin leer tareas ni enviar: %j', async body => {
  expect((await call(request({ body }))).status).toBe(400)
  expect(getUser).not.toHaveBeenCalled(); expect(collection).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
})
it('rechaza query arbitraria sin consultar Firestore', async () => {
  expect((await call(request({ url: '/api/summary/send?uid=bob&email=bob@example.invalid' }))).status).toBe(400)
  expect(collection).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
})
it('rechaza identidad falsificada sin Authorization antes de cualquier acceso', async () => {
  const result = await call(request({ authorization: null, body: { uid: 'bob', email: 'victim@example.invalid' } }))
  expect(result.status).toBe(401)
  expect(getAdminAuth).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled(); expect(collection).not.toHaveBeenCalled()
})
it.each(['auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled'])('rechaza %s sin enviar ni filtrar errores', async code => {
  verify.mockRejectedValue({ code, message: 'SECRET_TOKEN' })
  const result = await call()
  expect(result.status).toBe(401); expect(result.body.error.code).toBe('INVALID_TOKEN')
  expect(JSON.stringify(result.body)).not.toContain('SECRET_TOKEN')
  expect(send).not.toHaveBeenCalled(); expect(collection).not.toHaveBeenCalled()
})
it.each([
  [{ emailVerified: false }, 'EMAIL_NOT_VERIFIED'], [{ email: undefined }, 'EMAIL_UNAVAILABLE'], [{ disabled: true }, 'ACCOUNT_UNAVAILABLE'],
] as const)('bloquea cuenta/correo no apto: %j', async (override, code) => {
  getUser.mockResolvedValue({ uid: 'alice', email: 'alice@example.invalid', emailVerified: true, disabled: false, ...override })
  const result = await call()
  expect(result.status).toBe(403); expect(result.body.error.code).toBe(code)
  expect(collection).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
})
it('genera correo completo también sin tareas', async () => {
  stored.alice = []
  expect((await call()).status).toBe(202)
  expect(send.mock.calls[0][1].text).toContain('0%')
})
it('no confirma éxito antes de que el adaptador acepte; bloquea simultáneos y reproduce la misma clave sin duplicar', async () => {
  let finish!: () => void
  send.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const first = call()
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect((await call()).status).toBe(409)
  finish()
  expect((await first).status).toBe(202)
  expect((await call()).status).toBe(202)
  const limited = await call(request({ id: secondId }))
  expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe(60)
  expect(send).toHaveBeenCalledOnce()
})
it('bloquea nuevos intentos tras una respuesta incierta y oculta detalles', async () => {
  send.mockRejectedValue(new SummarySendFailure('SEND_STATUS_UNKNOWN'))
  const result = await call()
  expect(result.status).toBe(503); expect(result.body.error.code).toBe('SEND_STATUS_UNKNOWN')
  expect((await call(request({ id: secondId }))).body.error.code).toBe('SEND_STATUS_UNKNOWN')
  expect(send).toHaveBeenCalledOnce()
})
it('normaliza rechazo controlado del proveedor sin simular aceptación', async () => {
  send.mockRejectedValue(new SummarySendFailure('PROVIDER_UNAVAILABLE'))
  expect((await call()).body.error.code).toBe('PROVIDER_UNAVAILABLE')
  expect((await call()).status).toBe(409)
  expect(send).toHaveBeenCalledOnce()
})
it.each(['disabled', 'deployment', 'region', 'sender'])('configuración %s impide iniciar servicios de datos o proveedor', async stage => {
  if (stage === 'disabled') configuration.runtime = { allowed: false, reason: 'DISABLED' }
  if (stage === 'deployment') configuration.runtime = { allowed: false, reason: 'DEPLOYED_RUNTIME' }
  if (stage === 'region') configuration.region = ''
  if (stage === 'sender') configuration.fromEmail = 'sender@example.invalid\r\nBcc: other@example.invalid'
  expect((await call()).status).toBe(503)
  expect(getUser).not.toHaveBeenCalled(); expect(collection).not.toHaveBeenCalled(); expect(mailer).not.toHaveBeenCalled()
})
it('conserva límite de 100 tareas sin enviar un correo parcial', async () => {
  stored.alice = Array.from({ length: 101 }, () => ({ title: 'Task', description: 'Description', status: 'pending' }))
  expect((await call()).status).toBe(413)
  expect(send).not.toHaveBeenCalled()
})
it('rechaza correo que supera 256 KiB después de escapar', async () => {
  stored.alice[0].description = '<'.repeat(100_000)
  const result = await call()
  expect(result.status).toBe(413); expect(result.body.error.code).toBe('EMAIL_TOO_LARGE')
  expect(send).not.toHaveBeenCalled()
})
it('no expone errores internos ni datos privados de Firestore', async () => {
  databaseError = new Error('PRIVATE_KEY alice@example.invalid token path')
  const result = await call()
  expect(result.status).toBe(500); expect(result.body.error.code).toBe('INTERNAL_ERROR')
  expect(JSON.stringify(result.body)).not.toMatch(/PRIVATE_KEY|alice@example|token|path/)
  expect(send).not.toHaveBeenCalled()
})
it.each([202, 400, 401, 403, 405, 409, 413, 429, 500, 503])('impide caché en respuesta %s', async status => {
  let req = request()
  if (status === 400) req = request({ body: { uid: 'bob' } })
  if (status === 401) req = request({ authorization: null })
  if (status === 403) getUser.mockResolvedValue({ uid: 'alice', disabled: true })
  if (status === 405) req = request({ method: 'GET' })
  if (status === 409) vi.mocked(sendSummary).mockRejectedValue(new SummarySendFailure('SEND_IN_PROGRESS'))
  if (status === 413) stored.alice[0].description = '<'.repeat(100_000)
  if (status === 429) vi.mocked(sendSummary).mockRejectedValue(new SummarySendFailure('SEND_LIMITED', 60))
  if (status === 500) databaseError = new Error('private')
  if (status === 503) configuration.runtime = { allowed: false, reason: 'DISABLED' }
  const result = await call(req)
  expect(result.status).toBe(status)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(result.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store')
  if (status === 405) { expect(result.headers.get('Allow')).toBe('POST'); expect(getAdminAuth).not.toHaveBeenCalled() }
})

it('la configuración predeterminada permanece desactivada y detecta despliegues Vercel', () => {
  for (const key of ['SUMMARY_EMAIL_ENABLED', 'SUMMARY_EMAIL_RUNTIME', 'AWS_SES_REGION', 'SES_FROM_EMAIL', 'VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'NODE_ENV', 'NODEJS_HELPERS']) vi.stubEnv(key, undefined)
  try {
    expect(readSendConfiguration()).toEqual({ runtime: { allowed: false, reason: 'DISABLED' }, region: '', fromEmail: '' })
    vi.stubEnv('SUMMARY_EMAIL_ENABLED', 'true'); vi.stubEnv('VERCEL_ENV', 'production')
    expect(readSendConfiguration().runtime).toEqual({ allowed: false, reason: 'DEPLOYED_RUNTIME' })
    vi.stubEnv('VERCEL_ENV', 'preview'); expect(readSendConfiguration().runtime.allowed).toBe(false)
    vi.stubEnv('VERCEL_ENV', 'development'); expect(readSendConfiguration().runtime.allowed).toBe(false)
    vi.stubEnv('SUMMARY_EMAIL_RUNTIME', 'local-controlled'); vi.stubEnv('VERCEL', '1')
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NODEJS_HELPERS', '0')
    expect(readSendConfiguration().runtime).toEqual({ allowed: true, reason: 'LOCAL_CONTROLLED' })
  } finally { vi.unstubAllEnvs() }
})

it('sirve POST mediante HTTP real local con cuerpo vacío y dependencias externas simuladas', async () => {
  const server = createServer((req, res) => { void handler(req, res) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test port')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/summary/send`, { method: 'POST', headers: { Authorization: 'Bearer fake-alice', 'Idempotency-Key': id } })
    expect(response.status).toBe(202)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await response.json()).toEqual({ status: 'accepted', requestId: id })
    expect(send).toHaveBeenCalledOnce()
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})

it.each([
  { name: '2050 bytes chunked con body preparseado', raw: Buffer.from('{}' + ' '.repeat(2048)), status: 413 },
  { name: 'Unicode supera bytes aunque declare menor longitud', raw: Buffer.from('ñ'.repeat(513)), status: 413, headers: { 'content-length': '513' } },
  { name: 'JSON malformado', raw: Buffer.from('{'), status: 400 },
  { name: 'tipo incompatible', raw: Buffer.from('{}'), status: 400, headers: { 'content-type': 'text/plain' } },
])('rechaza $name antes del caso de uso y mantiene caché privada', async ({ raw, status, headers }) => {
  const req = request({ raw, body: {}, headers: headers ?? { 'transfer-encoding': 'chunked' } })
  const result = await call(req)
  expect(result.status).toBe(status)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(result.headers.get('Vercel-CDN-Cache-Control')).toBe('no-store')
  expect(sendSummary).not.toHaveBeenCalled(); expect(getUser).not.toHaveBeenCalled(); expect(collection).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
})

it('no vuelve a consumir una solicitud preparseada por middleware, aunque declare longitud válida', async () => {
  const req = request({ raw: Buffer.from('{}'), body: {}, headers: { 'content-length': '2' } })
  for await (const _chunk of req) { /* Simulate middleware consuming the original bytes. */ }
  expect((await call(req)).status).toBe(400)
  expect(sendSummary).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
})

it('no invoca el envío al fallar la lectura ni expone el error del stream', async () => {
  const req = request()
  req.destroy(new Error('PRIVATE_STREAM_FAILURE'))
  // Avoid emitting an unhandled fixture error: a live HTTP server owns this event.
  req.on('error', () => {})
  const result = await call(req)
  expect(result.status).toBe(400)
  expect(JSON.stringify(result.body)).not.toContain('PRIVATE_STREAM_FAILURE')
  expect(sendSummary).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
})

it.each([
  { raw: '{}', type: 'application/json; charset=utf-8', status: 202 },
  { raw: '{}', type: 'text/plain', status: 400 },
  { raw: '{}', type: undefined, status: 400 },
  { raw: '{}'.padEnd(2050, ' '), type: 'application/json', status: 413 },
])('HTTP local chunked con tipo $type y resultado $status', async ({ raw, type, status }) => {
  const server = createServer((req, res) => { void handler(req, res) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test port')
    const result = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: address.port, path: '/api/summary/send', method: 'POST', headers: {
        Authorization: 'Bearer fake-alice', 'Idempotency-Key': id, 'Transfer-Encoding': 'chunked', ...(type ? { 'Content-Type': type } : {}),
      } }, res => {
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode!, text: Buffer.concat(chunks).toString('utf8') }))
      })
      req.on('error', reject); req.write(raw.slice(0, 1)); req.end(raw.slice(1))
    })
    expect(result.status).toBe(status)
    expect(send).toHaveBeenCalledTimes(status === 202 ? 1 : 0)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

it('controla un aborto HTTP real sin procesar un mensaje parcial ni invocar SES', async () => {
  let finish!: (status: number) => void
  const done = new Promise<number>(resolve => { finish = resolve })
  const server = createServer((req, res) => { void handler(req, res).then(() => finish(res.statusCode)) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test port')
    const req = httpRequest({ host: '127.0.0.1', port: address.port, path: '/api/summary/send', method: 'POST', headers: {
      Authorization: 'Bearer fake-alice', 'Idempotency-Key': id, 'Content-Type': 'application/json', 'Content-Length': '10',
    } })
    req.on('error', () => {}); req.write('{')
    await vi.waitFor(() => expect(verify).toHaveBeenCalled())
    req.destroy()
    expect(await done).toBe(400)
    expect(sendSummary).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
