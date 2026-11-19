export function isWorkspaceIntegrationPreview(env: NodeJS.ProcessEnv) {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
    && (env.VERCEL_TARGET_ENV === undefined || env.VERCEL_TARGET_ENV === 'preview')
    && env.VERCEL_PROJECT_NAME === 'workspace-m4'
    && env.VERCEL_GIT_COMMIT_REF === 'feat/summary-email-cloud-integration'
}
