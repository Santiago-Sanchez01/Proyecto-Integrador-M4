export type SummaryEmailEnvironment = Readonly<{
  SUMMARY_EMAIL_ENABLED?: string
  SUMMARY_EMAIL_RUNTIME?: string
  VERCEL?: string
  VERCEL_ENV?: string
  VERCEL_TARGET_ENV?: string
  NODE_ENV?: string
  NODEJS_HELPERS?: string
}>

export type SummaryEmailRuntime =
  | { allowed: true; reason: 'LOCAL_CONTROLLED' }
  | { allowed: false; reason: 'DISABLED' | 'DEPLOYED_RUNTIME' | 'UNTRUSTED_RUNTIME' }

/** Configuration policy, not runtime attestation. Cloud IAM must also deny sending. */
export function evaluateSummaryEmailRuntime(env: SummaryEmailEnvironment): SummaryEmailRuntime {
  if (env.SUMMARY_EMAIL_ENABLED !== 'true') return { allowed: false, reason: 'DISABLED' }
  if ([env.VERCEL_ENV, env.VERCEL_TARGET_ENV].some(value => value === 'production' || value === 'preview')) {
    return { allowed: false, reason: 'DEPLOYED_RUNTIME' }
  }
  if (env.SUMMARY_EMAIL_RUNTIME !== 'local-controlled'
    || env.VERCEL !== '1'
    || env.VERCEL_ENV !== 'development'
    || env.NODE_ENV !== 'development'
    || env.NODEJS_HELPERS !== '0'
    || (env.VERCEL_TARGET_ENV !== undefined && env.VERCEL_TARGET_ENV !== 'development')) {
    return { allowed: false, reason: 'UNTRUSTED_RUNTIME' }
  }
  return { allowed: true, reason: 'LOCAL_CONTROLLED' }
}
