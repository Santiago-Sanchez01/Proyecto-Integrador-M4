import type { SummarySendErrorCode } from '../shared/summary-send.types'

type SendErrorCode = Extract<SummarySendErrorCode, 'INVALID_REQUEST' | 'SEND_DISABLED' | 'SEND_IN_PROGRESS' | 'DUPLICATE_REQUEST' | 'SEND_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'SEND_STATUS_UNKNOWN' | 'DISTRIBUTED_GUARD_REQUIRED'>
const details: Record<SendErrorCode, readonly [number, string]> = {
  INVALID_REQUEST: [400, 'La solicitud de envío no es válida.'],
  SEND_DISABLED: [503, 'El envío de resúmenes no está habilitado en este entorno.'],
  DISTRIBUTED_GUARD_REQUIRED: [503, 'El envío de resúmenes todavía no está habilitado para este despliegue.'],
  SEND_IN_PROGRESS: [409, 'Ya hay una solicitud de envío en curso.'],
  DUPLICATE_REQUEST: [409, 'Esta solicitud ya fue procesada.'],
  SEND_LIMITED: [429, 'Esperá antes de solicitar otro resumen.'],
  PROVIDER_UNAVAILABLE: [503, 'No se pudo solicitar el envío. Intentá nuevamente más tarde.'],
  SEND_STATUS_UNKNOWN: [503, 'No pudimos confirmar el resultado del envío. No lo repitas por ahora.'],
}
export class SummarySendFailure extends Error {
  readonly code: SendErrorCode
  readonly status: number
  readonly retryAfterSeconds?: number
  constructor(code: SendErrorCode, retryAfterSeconds?: number) {
    super(details[code][1]); this.code = code; this.status = details[code][0]; this.retryAfterSeconds = retryAfterSeconds
  }
}
