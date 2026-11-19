import type { SummarySendErrorCode } from '../shared/summary-send.types'
import { getAdminAuth } from './firebase-admin.js'
import { getAuthenticatedUid } from './authenticated-user.js'
import type { AuthenticatedUser } from './authenticated-user'

type RecipientErrorCode = Extract<SummarySendErrorCode, 'ACCOUNT_UNAVAILABLE' | 'EMAIL_UNAVAILABLE' | 'EMAIL_NOT_VERIFIED' | 'INTERNAL_ERROR'>
const messages: Record<RecipientErrorCode, string> = {
  ACCOUNT_UNAVAILABLE: 'La cuenta no está disponible para enviar el resumen.',
  EMAIL_UNAVAILABLE: 'El correo de tu cuenta no está disponible para enviar el resumen.',
  EMAIL_NOT_VERIFIED: 'Verificá el correo de tu cuenta antes de enviar el resumen.',
  INTERNAL_ERROR: 'No pudimos comprobar el correo de tu cuenta. Intentá nuevamente.',
}
export class RecipientResolutionError extends Error {
  readonly code: RecipientErrorCode
  readonly status: 403 | 500
  constructor(code: RecipientErrorCode) {
    super(messages[code])
    this.code = code
    this.status = code === 'INTERNAL_ERROR' ? 500 : 403
  }
}

// Conservative ASCII mailbox syntax, including plus addressing and punycode domains.
// Rejects address lists, display names, control characters and header injection.
function validEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254) return false
  const parts = value.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (!local || local.length > 64 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  const labels = domain.split('.')
  return labels.length >= 2 && labels.every(label => label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))
}

export async function resolveSummaryRecipient(identity: AuthenticatedUser): Promise<Readonly<{ uid: string; email: string }>> {
  const uid = getAuthenticatedUid(identity)
  try {
    const user = await getAdminAuth().getUser(uid)
    if (user.uid !== uid) throw new RecipientResolutionError('INTERNAL_ERROR')
    if (user.disabled) throw new RecipientResolutionError('ACCOUNT_UNAVAILABLE')
    if (!validEmail(user.email)) throw new RecipientResolutionError('EMAIL_UNAVAILABLE')
    if (user.emailVerified !== true) throw new RecipientResolutionError('EMAIL_NOT_VERIFIED')
    return Object.freeze({ uid, email: user.email })
  } catch (error) {
    if (error instanceof RecipientResolutionError) throw error
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    throw new RecipientResolutionError(code === 'auth/user-not-found' ? 'ACCOUNT_UNAVAILABLE' : 'INTERNAL_ERROR')
  }
}
