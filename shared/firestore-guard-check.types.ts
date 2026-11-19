export const firestoreGuardCheckErrorCodes = [
  'DIAGNOSTIC_DISABLED', 'METHOD_NOT_ALLOWED', 'UNAUTHENTICATED', 'INVALID_TOKEN',
  'FORBIDDEN', 'INTERNAL_ERROR', 'FIRESTORE_UNAVAILABLE', 'GUARD_CHECK_FAILED',
] as const

export type FirestoreGuardCheckErrorCode = typeof firestoreGuardCheckErrorCodes[number]
