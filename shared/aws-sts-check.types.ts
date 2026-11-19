export const awsStsCheckErrorCodes = [
  'DIAGNOSTIC_DISABLED', 'METHOD_NOT_ALLOWED', 'UNAUTHENTICATED', 'INVALID_TOKEN', 'FORBIDDEN',
  'INTERNAL_ERROR', 'AWS_NOT_CONFIGURED', 'AWS_STS_UNAVAILABLE', 'AWS_IDENTITY_MISMATCH',
] as const

export type AwsStsCheckErrorCode = typeof awsStsCheckErrorCodes[number]
