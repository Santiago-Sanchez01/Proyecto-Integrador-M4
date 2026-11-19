import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getFirebaseAuth } from '../../lib/firebase'
import { requestSummarySend } from './summary-send.api'

vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: vi.fn() }))
const token = vi.fn(), fetchMock = vi.fn()
let current: { uid: string; getIdToken: typeof token } | null
const id = '12345678-1234-4234-8234-123456789abc'
beforeEach(() => {
  vi.resetAllMocks()
  current = { uid: 'alice', getIdToken: token }; token.mockResolvedValue('fake-id-token')
  vi.mocked(getFirebaseAuth).mockReturnValue({ get currentUser() { return current } } as unknown as ReturnType<typeof getFirebaseAuth>)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ status: 202, ok: true, json: async () => ({ status: 'accepted', requestId: id }) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('obtiene token vigente y envía solo Authorization e Idempotency-Key, sin cuerpo ni identidad cliente', async () => {
  expect(await requestSummarySend('alice', id)).toEqual({ status: 'accepted', requestId: id })
  expect(token).toHaveBeenCalledExactlyOnceWith()
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/summary/send', { method: 'POST', headers: { Authorization: 'Bearer fake-id-token', 'Idempotency-Key': id }, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) })
  expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body')
})
it('no envía si no hay usuario o cambió antes de pedir el token', async () => {
  current = null
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
  expect(token).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled()
})
it('no envía si la cuenta cambia mientras se obtiene el token', async () => {
  token.mockImplementation(async () => { current = { uid: 'bob', getIdToken: token }; return 'fake' })
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('oculta fallos privados del SDK sin efectuar solicitud', async () => {
  token.mockRejectedValue(new Error('SECRET_CREDENTIAL'))
  const error = await requestSummarySend('alice', id).catch(error => error)
  expect(error).toMatchObject({ code: 'UNAUTHENTICATED' }); expect(String(error)).not.toContain('SECRET')
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each(['EMAIL_NOT_VERIFIED', 'ACCOUNT_UNAVAILABLE', 'EMAIL_UNAVAILABLE', 'INVALID_TOKEN', 'SEND_DISABLED', 'SEND_LIMITED', 'INTERNAL_ERROR', 'PROVIDER_UNAVAILABLE'])('mapea error %s sin usar mensajes privados del servidor', async code => {
  fetchMock.mockResolvedValue({ status: 403, ok: false, json: async () => ({ error: { code, message: 'PRIVATE_DATA alice@example.invalid' } }) })
  const error = await requestSummarySend('alice', id).catch(error => error)
  expect(error).toMatchObject({ code, uncertain: false })
  expect(String(error)).not.toMatch(/PRIVATE_DATA|alice@example/)
  expect(fetchMock).toHaveBeenCalledOnce()
})
it.each(['SEND_STATUS_UNKNOWN', 'SEND_IN_PROGRESS'])('bloquea repetición ante %s', async code => {
  fetchMock.mockResolvedValue({ status: 503, ok: false, json: async () => ({ error: { code } }) })
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code, uncertain: true })
})
it.each([{ status: 'delivered', requestId: id }, { status: 'accepted', requestId: 'other' }, null])('no simula éxito con una respuesta inválida: %j', async body => {
  fetchMock.mockResolvedValue({ status: 202, ok: true, json: async () => body })
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
})
it('no reintenta ante errores de red o contenido no JSON', async () => {
  fetchMock.mockRejectedValue(new Error('PRIVATE_TOKEN'))
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN', uncertain: true })
  expect(fetchMock).toHaveBeenCalledOnce()
  fetchMock.mockResolvedValue({ status: 502, ok: false, json: async () => { throw new Error('bad json') } })
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
})
it('cancela la espera a los 30 segundos sin reintentar', async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
  const pending = expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
  await vi.advanceTimersByTimeAsync(30_001)
  await pending
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('descarta respuesta recibida después de cambiar de cuenta', async () => {
  fetchMock.mockImplementation(async () => { current = { uid: 'bob', getIdToken: token }; return { status: 202, ok: true } })
  await expect(requestSummarySend('alice', id)).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
})
