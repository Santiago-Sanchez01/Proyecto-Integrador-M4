import { beforeEach, expect, it, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { authenticateUser, AuthenticationError, getAuthenticatedUid } from '../../server/authenticated-user'
import type { AuthenticatedUser } from '../../server/authenticated-user'
import { getAdminAuth } from '../../server/firebase-admin'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn() }))
const verify = vi.fn()
const request = (authorization?: unknown) => ({ headers: { authorization, 'x-user-id': 'bob' }, body: { uid: 'bob' }, query: { uid: 'bob' } }) as unknown as IncomingMessage
beforeEach(() => {
  vi.resetAllMocks()
  verify.mockResolvedValue({ uid: 'alice', email: 'old@example.invalid' })
  vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken: verify } as unknown as ReturnType<typeof getAdminAuth>)
})

it('verifica revocación y emite identidad inmutable sin retener token o email', async () => {
  const user = await authenticateUser(request('Bearer fake-token'))
  expect(verify).toHaveBeenCalledWith('fake-token', true)
  expect(getAuthenticatedUid(user)).toBe('alice')
  expect(Object.isFrozen(user)).toBe(true)
  expect(Object.keys(user)).toEqual(['uid'])
  expect(JSON.stringify(user)).not.toMatch(/fake-token|old@example|bob/)
})

it('contempla Bearer sin distinguir mayúsculas', async () => {
  expect((await authenticateUser(request('bearer fake-token'))).uid).toBe('alice')
})

it('rechaza ausencia de Authorization antes de acceder al SDK', async () => {
  await expect(authenticateUser(request())).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 })
  expect(getAdminAuth).not.toHaveBeenCalled()
})

it.each(['Basic token', 'Bearer ', 'Bearer a b', 'Bearer one,Bearer two', ['Bearer one', 'Bearer two'], 'Bearer ' + 'x'.repeat(8192)])('rechaza encabezado inválido: %j', async header => {
  await expect(authenticateUser(request(header))).rejects.toMatchObject({ code: 'INVALID_TOKEN', status: 401 })
  expect(verify).not.toHaveBeenCalled()
})

it.each(['auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'])('oculta detalles del rechazo %s', async code => {
  verify.mockRejectedValue({ code, message: 'PRIVATE_TOKEN_OR_CREDENTIAL' })
  const error = await authenticateUser(request('Bearer fake-token')).catch(error => error as AuthenticationError)
  expect(error).toMatchObject({ code: 'INVALID_TOKEN', status: 401 })
  expect(String(error)).not.toContain('PRIVATE_TOKEN_OR_CREDENTIAL')
})

it.each([null, '', ' ', 'alice/tasks/bob', 'x'.repeat(129)])('rechaza UID inválido del SDK: %j', async uid => {
  verify.mockResolvedValue({ uid })
  await expect(authenticateUser(request('Bearer fake-token'))).rejects.toMatchObject({ code: 'INVALID_TOKEN', status: 401 })
})

it('convierte fallos de ADC o red en error tipado genérico', async () => {
  verify.mockRejectedValue(new Error('PRIVATE_ADC_PATH'))
  await expect(authenticateUser(request('Bearer fake-token'))).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500, message: 'No pudimos obtener tu resumen. Intentá nuevamente.' })
})

it('no reconoce objetos de identidad fabricados por un cliente', () => {
  expect(() => getAuthenticatedUid({ uid: 'bob' } as AuthenticatedUser)).toThrow(AuthenticationError)
})
