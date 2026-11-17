import type { IncomingMessage } from 'node:http'
import type { SummaryErrorCode } from '../shared/summary.types'
import { getAdminAuth } from './firebase-admin'

type AuthenticationErrorCode = Extract<SummaryErrorCode, 'UNAUTHENTICATED' | 'INVALID_TOKEN' | 'INTERNAL_ERROR'>
const messages: Record<AuthenticationErrorCode, string> = {
  UNAUTHENTICATED: 'Iniciá sesión para consultar el resumen.',
  INVALID_TOKEN: 'La sesión no es válida. Volvé a iniciar sesión.',
  INTERNAL_ERROR: 'No pudimos obtener tu resumen. Intentá nuevamente.',
}
export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode
  readonly status: 401 | 500
  constructor(code: AuthenticationErrorCode) {
    super(messages[code])
    this.code = code
    this.status = code === 'INTERNAL_ERROR' ? 500 : 401
  }
}

declare const verifiedIdentity: unique symbol
export type AuthenticatedUser = Readonly<{ uid: string; [verifiedIdentity]: true }>
const issuedIdentities = new WeakSet<AuthenticatedUser>()
const invalidTokenCodes = new Set(['auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'])

/** Only a successful SDK verification can issue this identity. No token is retained. */
export async function authenticateUser(req: Pick<IncomingMessage, 'headers'>): Promise<AuthenticatedUser> {
  const authorization = req.headers.authorization
  if (!authorization) throw new AuthenticationError('UNAUTHENTICATED')
  const match = typeof authorization === 'string' && authorization.length <= 8192 ? /^Bearer ([^\s,]+)$/i.exec(authorization) : null
  if (!match) throw new AuthenticationError('INVALID_TOKEN')
  try {
    const verified = await getAdminAuth().verifyIdToken(match[1], true)
    if (typeof verified.uid !== 'string' || !verified.uid.trim() || verified.uid.includes('/') || verified.uid.length > 128) throw new AuthenticationError('INVALID_TOKEN')
    const identity = Object.freeze({ uid: verified.uid }) as AuthenticatedUser
    issuedIdentities.add(identity)
    return identity
  } catch (error) {
    if (error instanceof AuthenticationError) throw error
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    throw new AuthenticationError(typeof code === 'string' && invalidTokenCodes.has(code) ? 'INVALID_TOKEN' : 'INTERNAL_ERROR')
  }
}

/** Reject forged objects at runtime as well as raw UIDs at the TypeScript boundary. */
export function getAuthenticatedUid(user: AuthenticatedUser): string {
  if (!user || typeof user !== 'object' || !issuedIdentities.has(user)) throw new AuthenticationError('INVALID_TOKEN')
  return user.uid
}
