import type { IncomingMessage } from 'node:http'
import { beforeEach, expect, it, vi } from 'vitest'
import { authenticateUser } from '../../server/authenticated-user'
import type { AuthenticatedUser } from '../../server/authenticated-user'
import { getAdminAuth } from '../../server/firebase-admin'
import { resolveSummaryRecipient } from '../../server/summary-recipient'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn() }))
const verify = vi.fn(), getUser = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  verify.mockResolvedValue({ uid: 'alice', email: 'old@example.invalid', email_verified: true })
  getUser.mockResolvedValue({ uid: 'alice', disabled: false, email: 'current@example.invalid', emailVerified: true })
  vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken: verify, getUser } as unknown as ReturnType<typeof getAdminAuth>)
})
async function identity() {
  return authenticateUser({ headers: { authorization: 'Bearer fake-token', 'x-user-id': 'bob' },
    body: { uid: 'bob', email: 'victim@example.invalid' }, query: { uid: 'bob', to: 'victim@example.invalid' } } as unknown as IncomingMessage)
}

it('usa el correo actual de getUser aunque el token y el cliente indiquen otro destinatario', async () => {
  const recipient = await resolveSummaryRecipient(await identity())
  expect(getUser).toHaveBeenCalledExactlyOnceWith('alice')
  expect(recipient).toEqual({ uid: 'alice', email: 'current@example.invalid' })
  expect(Object.isFrozen(recipient)).toBe(true)
  expect(JSON.stringify(recipient)).not.toMatch(/old@example|victim@example|bob/)
})

it('no confía en la verificación antigua del token si el correo actual no está verificado', async () => {
  getUser.mockResolvedValue({ uid: 'alice', disabled: false, email: 'new@example.invalid', emailVerified: false })
  await expect(resolveSummaryRecipient(await identity())).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED', status: 403 })
})

it('acepta el correo actual verificado aunque el claim antiguo estuviera sin verificar', async () => {
  verify.mockResolvedValue({ uid: 'alice', email: 'old@example.invalid', email_verified: false })
  expect((await resolveSummaryRecipient(await identity())).email).toBe('current@example.invalid')
})

it.each([undefined, '', ' ', 'not-email', 'a@example.invalid\r\nBcc: victim@example.invalid', 'a@example.invalid,b@example.invalid', '.name@example.invalid', 'a..b@example.invalid', 'a@-example.invalid', 'a@example..invalid', 'a'.repeat(65) + '@example.invalid'])('rechaza correo ausente o inválido: %j', async email => {
  getUser.mockResolvedValue({ uid: 'alice', email, disabled: false, emailVerified: true })
  const error = await resolveSummaryRecipient(await identity()).catch(error => error as Error)
  expect(error).toMatchObject({ code: 'EMAIL_UNAVAILABLE', status: 403 })
  expect(String(error)).not.toMatch(/Bcc:|victim@example/)
})

it('acepta plus addressing sin cambiar el correo de Auth', async () => {
  getUser.mockResolvedValue({ uid: 'alice', disabled: false, email: 'Alice+summary@example.invalid', emailVerified: true })
  expect((await resolveSummaryRecipient(await identity())).email).toBe('Alice+summary@example.invalid')
})

it('rechaza cuenta deshabilitada después de verificar el token', async () => {
  getUser.mockResolvedValue({ uid: 'alice', disabled: true, email: 'current@example.invalid', emailVerified: true })
  await expect(resolveSummaryRecipient(await identity())).rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE', status: 403 })
})

it.each(['auth/user-not-found', 'auth/internal-error'])('no filtra detalles del fallo getUser: %s', async code => {
  getUser.mockRejectedValue({ code, message: 'PRIVATE_CREDENTIAL victim@example.invalid' })
  const error = await resolveSummaryRecipient(await identity()).catch(error => error as Error)
  expect(error).toMatchObject({ code: code === 'auth/user-not-found' ? 'ACCOUNT_UNAVAILABLE' : 'INTERNAL_ERROR', status: code === 'auth/user-not-found' ? 403 : 500 })
  expect(String(error)).not.toMatch(/PRIVATE_CREDENTIAL|victim@example/)
})

it('rechaza un registro Admin que no corresponda al UID verificado', async () => {
  getUser.mockResolvedValue({ uid: 'bob', email: 'victim@example.invalid', emailVerified: true })
  await expect(resolveSummaryRecipient(await identity())).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
})

it.each([{ uid: 'bob' }, { uid: 'alice', email: 'victim@example.invalid' }, 'alice', null])('rechaza identidad o destinatario fabricado sin consultar Admin: %j', async forged => {
  await expect(resolveSummaryRecipient(forged as AuthenticatedUser)).rejects.toMatchObject({ code: 'INVALID_TOKEN', status: 401 })
  expect(getUser).not.toHaveBeenCalled()
})

it('rechaza incluso una copia modificada de una identidad verificada', async () => {
  const user = await identity()
  await expect(resolveSummaryRecipient({ ...user, uid: 'bob' })).rejects.toMatchObject({ code: 'INVALID_TOKEN', status: 401 })
  expect(getUser).not.toHaveBeenCalled()
})
