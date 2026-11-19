import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import type { GetCallerIdentityCommandOutput } from '@aws-sdk/client-sts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { authenticateUser, AuthenticationError } from '../../server/authenticated-user.js'
import { PREVIEW_AWS_ACCOUNT, PREVIEW_AWS_ROLE_NAME, sesCredentialProvider } from '../../server/ses-credentials.js'
import { isWorkspaceIntegrationPreview } from '../../server/workspace-preview.js'
import type { AwsStsCheckErrorCode } from '../../shared/aws-sts-check.types.js'

// The provider uses the role name as its fixed RoleSessionName.
const expectedArn = `arn:aws:sts::${PREVIEW_AWS_ACCOUNT}:assumed-role/${PREVIEW_AWS_ROLE_NAME}/${PREVIEW_AWS_ROLE_NAME}`

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  function fail(status: number, code: AwsStsCheckErrorCode) {
    res.statusCode = status
    return res.end(JSON.stringify({ error: { code } }))
  }

  const env = process.env
  const allowedUid = env.AWS_STS_DIAGNOSTIC_ALLOWED_UID
  if (!isWorkspaceIntegrationPreview(env) || !allowedUid || !allowedUid.trim()
    || allowedUid !== allowedUid.trim() || allowedUid.includes('/') || allowedUid.length > 128) {
    return fail(404, 'DIAGNOSTIC_DISABLED')
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(405, 'METHOD_NOT_ALLOWED')
  }
  try {
    const user = await authenticateUser(req)
    if (user.uid !== allowedUid) return fail(403, 'FORBIDDEN')
  } catch (error) {
    if (error instanceof AuthenticationError) return fail(error.status, error.code)
    return fail(500, 'INTERNAL_ERROR')
  }

  const region = env.AWS_SES_REGION ?? ''
  let provider
  try {
    provider = sesCredentialProvider(region, env)
  } catch {
    return fail(503, 'AWS_NOT_CONFIGURED')
  }
  if (!provider) return fail(503, 'AWS_NOT_CONFIGURED')

  let identity: GetCallerIdentityCommandOutput
  try {
    const credentials = await provider()
    const sts = new STSClient({
      region,
      credentials,
      maxAttempts: 1,
      ignoreConfiguredEndpointUrls: true,
      requestHandler: { connectionTimeout: 3000, requestTimeout: 5000, throwOnRequestTimeout: true },
    })
    try {
      identity = await sts.send(new GetCallerIdentityCommand({}))
    } finally {
      sts.destroy()
    }
  } catch {
    return fail(502, 'AWS_STS_UNAVAILABLE')
  }
  if (identity.Account !== PREVIEW_AWS_ACCOUNT || identity.Arn !== expectedArn) {
    return fail(502, 'AWS_IDENTITY_MISMATCH')
  }
  res.statusCode = 200
  return res.end(JSON.stringify({ ok: true }))
}
