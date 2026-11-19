import { isWorkspaceIntegrationPreview } from './workspace-preview.js'

export type SummaryEmailEnvironment = Readonly<{
  SUMMARY_EMAIL_ENABLED?: string
  SUMMARY_EMAIL_RUNTIME?: string
  VERCEL?: string
  VERCEL_ENV?: string
  VERCEL_TARGET_ENV?: string
  NODE_ENV?: string
  NODEJS_HELPERS?: string
  VERCEL_PROJECT_NAME?: string
  VERCEL_GIT_COMMIT_REF?: string
  FIREBASE_ADMIN_CREDENTIAL_MODE?: string
  FIREBASE_ADMIN_PROJECT_ID?: string
  FIREBASE_AUTH_EMULATOR_HOST?: string
  FIRESTORE_EMULATOR_HOST?: string
  SUMMARY_EMAIL_GUARD?: string
  SUMMARY_EMAIL_PREVIEW_UID?: string
  SUMMARY_EMAIL_PREVIEW_RECIPIENT?: string
  SUMMARY_EMAIL_PREVIEW_RUN_ID?: string
  SUMMARY_EMAIL_PREVIEW_EXPIRES_AT?: string
}>

export type SummaryEmailRuntime =
  | { allowed: true; reason: 'LOCAL_CONTROLLED' }
  | { allowed: true; reason: 'PREVIEW_SINGLE_SEND'; uid: string; recipient: string; runId: string; expiresAt: number }
  | { allowed: false; reason: 'DISABLED' | 'DEPLOYED_RUNTIME' | 'UNTRUSTED_RUNTIME' }

/** Configuration policy. Cloud IAM independently restricts the Preview role. */
export function evaluateSummaryEmailRuntime(env: SummaryEmailEnvironment, now = Date.now()): SummaryEmailRuntime {
  if (env.SUMMARY_EMAIL_ENABLED !== 'true') return { allowed: false, reason: 'DISABLED' }
  if (env.SUMMARY_EMAIL_RUNTIME === 'preview-single-send' && isWorkspaceIntegrationPreview(env)) {
    const { SUMMARY_EMAIL_PREVIEW_UID: uid, SUMMARY_EMAIL_PREVIEW_RECIPIENT: recipient,
      SUMMARY_EMAIL_PREVIEW_RUN_ID: runId, SUMMARY_EMAIL_PREVIEW_EXPIRES_AT: deadline } = env
    const expiresAt = Date.parse(deadline ?? '')
    if (env.NODE_ENV !== 'production' || env.NODEJS_HELPERS !== '0' || env.SUMMARY_EMAIL_GUARD !== 'firestore'
      || env.FIREBASE_ADMIN_CREDENTIAL_MODE !== 'vercel-oidc' || env.FIREBASE_ADMIN_PROJECT_ID !== 'workspace-m4'
      || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST
      || !uid?.trim() || uid !== uid.trim() || uid.length > 128 || uid.includes('/')
      || !recipient || recipient.length > 254 || !/^[^\s@<>,;:"\r\n]+@[^\s@<>,;:"\r\n]+\.[^\s@<>,;:"\r\n]+$/.test(recipient)
      || !runId || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(runId)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(deadline ?? '')
      || !(expiresAt > now && expiresAt - now <= 3_600_000)
      || new Date(expiresAt).toISOString() !== deadline?.replace('Z', '.000Z')) {
      return { allowed: false, reason: 'DISABLED' }
    }
    return { allowed: true, reason: 'PREVIEW_SINGLE_SEND', uid, recipient, runId, expiresAt }
  }
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
