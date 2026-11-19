import { fromWebToken } from '@aws-sdk/credential-provider-web-identity'
import { getContext } from '@vercel/oidc'
import { SummarySendFailure } from './summary-send-errors.js'

export const PREVIEW_AWS_ACCOUNT = '302495249734'
export const PREVIEW_AWS_ROLE_NAME = 'workspace-ses-preview'
const PREVIEW_ROLE = `arn:aws:iam::${PREVIEW_AWS_ACCOUNT}:role/${PREVIEW_AWS_ROLE_NAME}`
const PREVIEW_BRANCH = 'feat/summary-email-cloud-integration'
const PREVIEW_REGION = 'us-east-2'

export function isSesOidcPreview(env: NodeJS.ProcessEnv) {
  return env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
    && (env.VERCEL_TARGET_ENV === undefined || env.VERCEL_TARGET_ENV === 'preview')
    && env.VERCEL_PROJECT_NAME === 'workspace-m4' && env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH
}

export function sesCredentialProvider(region: string, env: NodeJS.ProcessEnv = process.env) {
  const local = (env.VERCEL === undefined || env.VERCEL_ENV === 'development')
    && (env.VERCEL_ENV === undefined || env.VERCEL_ENV === 'development')
    && (env.VERCEL_TARGET_ENV === undefined || env.VERCEL_TARGET_ENV === 'development')
  if (local && env.AWS_ROLE_ARN?.trim() !== PREVIEW_ROLE) return undefined

  if (!isSesOidcPreview(env) || env.AWS_ROLE_ARN !== PREVIEW_ROLE || region !== PREVIEW_REGION) {
    throw new SummarySendFailure('SEND_DISABLED')
  }

  return async () => {
    try {
      // Use only the invocation token, with the Vercel-issued audience.
      const webIdentityToken = getContext().headers?.['x-vercel-oidc-token']
      if (!webIdentityToken) throw new Error()
      const credentials = await fromWebToken({
        roleArn: PREVIEW_ROLE,
        webIdentityToken,
        roleSessionName: PREVIEW_AWS_ROLE_NAME,
        durationSeconds: 900,
        clientConfig: { region: PREVIEW_REGION, maxAttempts: 1, ignoreConfiguredEndpointUrls: true },
      })()
      if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.sessionToken
        || !credentials.expiration || !(credentials.expiration.getTime() > Date.now())) throw new Error()
      return credentials
    } catch {
      // STS failure precedes any SES request. Never fall back to ambient credentials.
      throw new SummarySendFailure('PROVIDER_UNAVAILABLE')
    }
  }
}
