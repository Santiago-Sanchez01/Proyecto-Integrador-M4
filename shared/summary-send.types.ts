import type { SummaryErrorCode } from './summary.types'

/** Provider acceptance never means delivery to the inbox. */
export type SummarySendAccepted = { status: 'accepted'; requestId: string }
export type SummarySendErrorCode = SummaryErrorCode | 'ACCOUNT_UNAVAILABLE' | 'EMAIL_UNAVAILABLE' | 'EMAIL_NOT_VERIFIED' | 'EMAIL_TOO_LARGE'
  | 'INVALID_REQUEST' | 'SEND_DISABLED' | 'SEND_IN_PROGRESS' | 'DUPLICATE_REQUEST' | 'SEND_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'SEND_STATUS_UNKNOWN' | 'DISTRIBUTED_GUARD_REQUIRED'
export type SummarySendError = { error: { code: SummarySendErrorCode; message: string }; retryAfterSeconds?: number }
