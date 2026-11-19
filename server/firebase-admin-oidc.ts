import { getContext } from '@vercel/oidc'
import type { Credential } from 'firebase-admin/app'
import { GoogleAuth, IdentityPoolClient } from 'google-auth-library'

const unavailable = () => new Error('Server Firebase configuration unavailable.')
const exchangeFailed = () => new Error('Federated Firebase credentials unavailable.')

function readFederationConfig(env: NodeJS.ProcessEnv) {
  const projectNumber = env.GCP_PROJECT_NUMBER?.trim()
  const pool = env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim()
  const provider = env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim()
  const account = env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
  const resourceId = /^[a-z0-9-]{4,32}$/
  if (!projectNumber || !/^[1-9]\d*$/.test(projectNumber)
    || !pool || !resourceId.test(pool) || !provider || !resourceId.test(provider)
    || !account || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(account)) throw unavailable()
  return { projectNumber, pool, provider, account }
}

class VercelIdentityPoolClient extends IdentityPoolClient {
  protected override async refreshAccessTokenAsync() {
    try { return await super.refreshAccessTokenAsync() }
    catch { throw exchangeFailed() }
  }
}

export function createVercelFirebaseCredentials(projectId: string, env: NodeJS.ProcessEnv) {
  const { projectNumber, pool, provider, account } = readFederationConfig(env)
  const client = new VercelIdentityPoolClient({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${account}:generateAccessToken`,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    subject_token_supplier: {
      async getSubjectToken() {
        // The platform context is invocation-scoped. Do not use caller headers, files or build tokens.
        const token = getContext().headers?.['x-vercel-oidc-token']
        if (!token) throw exchangeFailed()
        return token
      },
    },
  })
  const credential: Credential = {
    async getAccessToken() {
      const { token } = await client.getAccessToken()
      const expiresIn = Math.floor(((client.credentials.expiry_date ?? 0) - Date.now()) / 1000)
      if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) throw exchangeFailed()
      return { access_token: token, expires_in: expiresIn }
    },
  }
  return { credential, auth: new GoogleAuth({ authClient: client, projectId }) }
}
