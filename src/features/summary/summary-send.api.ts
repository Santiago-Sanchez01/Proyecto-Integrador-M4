import { getFirebaseAuth } from '../../lib/firebase'
import type { SummarySendAccepted, SummarySendErrorCode } from '../../../shared/summary-send.types'

type ClientErrorCode = SummarySendErrorCode | 'SESSION_CHANGED'
const messages: Partial<Record<ClientErrorCode, string>> = {
  EMAIL_NOT_VERIFIED: 'Verificá el correo de tu cuenta antes de enviar el resumen.',
  EMAIL_UNAVAILABLE: 'Tu cuenta no tiene un correo válido para recibir el resumen.',
  ACCOUNT_UNAVAILABLE: 'Tu cuenta no está habilitada para enviar resúmenes.',
  UNAUTHENTICATED: 'Iniciá sesión nuevamente para enviar el resumen.',
  INVALID_TOKEN: 'Iniciá sesión nuevamente para enviar el resumen.',
  SESSION_CHANGED: 'La sesión cambió. Volvé a intentar desde tu cuenta actual.',
  SEND_DISABLED: 'El envío de correos está deshabilitado en este entorno.',
  DISTRIBUTED_GUARD_REQUIRED: 'El envío de correos todavía no está habilitado para este despliegue.',
  SEND_IN_PROGRESS: 'Ya hay una solicitud de envío en curso.',
  DUPLICATE_REQUEST: 'Esta solicitud ya fue procesada.',
  SEND_LIMITED: 'Esperá antes de solicitar otro resumen.',
  SUMMARY_TOO_LARGE: 'El resumen supera el tamaño permitido.',
  EMAIL_TOO_LARGE: 'El resumen supera el tamaño permitido para un correo.',
  SEND_STATUS_UNKNOWN: 'No pudimos confirmar el resultado del envío. No lo repitas por ahora.',
}
export class SummarySendClientError extends Error {
  readonly code: ClientErrorCode
  readonly uncertain: boolean
  constructor(code: ClientErrorCode) {
    super(messages[code] ?? 'No se pudo solicitar el envío. Intentá nuevamente más tarde.')
    this.code = code; this.uncertain = code === 'SEND_STATUS_UNKNOWN' || code === 'SEND_IN_PROGRESS'
  }
}

export async function requestSummarySend(expectedUid: string, requestId: string, signal?: AbortSignal): Promise<SummarySendAccepted> {
  const auth = getFirebaseAuth()
  if (auth.currentUser?.uid !== expectedUid) throw new SummarySendClientError('SESSION_CHANGED')
  let token: string
  try { token = await auth.currentUser.getIdToken() } catch { throw new SummarySendClientError('UNAUTHENTICATED') }
  if (auth.currentUser?.uid !== expectedUid) throw new SummarySendClientError('SESSION_CHANGED')
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = setTimeout(abort, 30_000)
  try {
    const response = await fetch('/api/summary/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': requestId },
      credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal })
    if (auth.currentUser?.uid !== expectedUid) throw new SummarySendClientError('SESSION_CHANGED')
    const body: unknown = await response.json()
    if (response.status === 202 && body && typeof body === 'object' && 'status' in body && body.status === 'accepted' && 'requestId' in body && body.requestId === requestId) return { status: 'accepted', requestId }
    if (!response.ok && body && typeof body === 'object' && 'error' in body && body.error && typeof body.error === 'object' && 'code' in body.error) {
      const code = body.error.code
      if (typeof code === 'string' && (Object.hasOwn(messages, code) || ['INTERNAL_ERROR', 'PROVIDER_UNAVAILABLE', 'INVALID_REQUEST', 'METHOD_NOT_ALLOWED'].includes(code))) throw new SummarySendClientError(code as ClientErrorCode)
    }
    throw new SummarySendClientError('SEND_STATUS_UNKNOWN')
  } catch (error) {
    if (error instanceof SummarySendClientError) throw error
    throw new SummarySendClientError('SEND_STATUS_UNKNOWN')
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
}
