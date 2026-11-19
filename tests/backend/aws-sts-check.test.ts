import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { fromWebToken } from '@aws-sdk/credential-provider-web-identity'
import { getContext } from '@vercel/oidc'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import handler from '../../api/summary/aws-check'
import { getAdminAuth } from '../../server/firebase-admin'

const { verify, send, destroy, sesLoaded } = vi.hoisted(() => ({
  verify: vi.fn(), send: vi.fn(), destroy: vi.fn(), sesLoaded: vi.fn(),
}))
vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn(() => ({ verifyIdToken: verify })) }))
vi.mock('@vercel/oidc', () => ({ getContext: vi.fn() }))
vi.mock('@aws-sdk/credential-provider-web-identity', () => ({ fromWebToken: vi.fn() }))
vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn(class { send = send; destroy = destroy }),
  GetCallerIdentityCommand: vi.fn(class {}),
}))
vi.mock('@aws-sdk/client-sesv2', () => {
  sesLoaded()
  throw new Error('El diagnóstico nunca debe cargar SES')
})

const uid = 'fixture-allowed-uid'
const token = 'fixture-firebase-token'
const oidc = 'fixture-oidc'
const account = '302495249734'
const arn = `arn:aws:sts::${account}:assumed-role/workspace-ses-preview/workspace-ses-preview`
const credentials = {
  accessKeyId: 'fixture-access', secretAccessKey: 'fixture-secret', sessionToken: 'fixture-session-token',
  expiration: new Date(Date.now() + 60_000),
}
const exchange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  for (const [key, value] of Object.entries({
    VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_NAME: 'workspace-m4',
    VERCEL_GIT_COMMIT_REF: 'feat/summary-email-cloud-integration', AWS_STS_DIAGNOSTIC_ALLOWED_UID: uid,
    AWS_ROLE_ARN: `arn:aws:iam::${account}:role/workspace-ses-preview`, AWS_SES_REGION: 'us-east-2',
    AWS_REGION: 'iad1', SUMMARY_EMAIL_ENABLED: 'false', SUMMARY_EMAIL_RUNTIME: 'disabled',
  })) vi.stubEnv(key, value)
  verify.mockResolvedValue({ uid })
  vi.mocked(getContext).mockReturnValue({ headers: { 'x-vercel-oidc-token': oidc } })
  vi.mocked(fromWebToken).mockReturnValue(exchange)
  exchange.mockResolvedValue(credentials)
  send.mockResolvedValue({ Account: account, Arn: arn, UserId: 'private-aws-id' })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  expect(sesLoaded).not.toHaveBeenCalled()
})

async function request(authorization: string | null = `Bearer ${token}`, method = 'POST') {
  const req = {
    method, headers: { authorization: authorization ?? undefined, 'x-user-id': uid },
    url: `/api/summary/aws-check?uid=${uid}`, body: { uid },
  } as unknown as IncomingMessage
  const response = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() }
  await handler(req, response as unknown as ServerResponse)
  return { status: response.statusCode, body: JSON.parse(response.end.mock.calls[0][0]), header: response.setHeader }
}

it.each([
  ['VERCEL', undefined], ['VERCEL_ENV', 'production'], ['VERCEL_TARGET_ENV', 'production'],
  ['VERCEL_PROJECT_NAME', 'different'], ['VERCEL_GIT_COMMIT_REF', 'main'],
  ['AWS_STS_DIAGNOSTIC_ALLOWED_UID', undefined], ['AWS_STS_DIAGNOSTIC_ALLOWED_UID', ''],
  ['AWS_STS_DIAGNOSTIC_ALLOWED_UID', '   '], ['AWS_STS_DIAGNOSTIC_ALLOWED_UID', ' padded '],
])('responde 404 antes de Firebase o AWS para %s=%s', async (key, value) => {
  vi.stubEnv(key, value)
  expect(await request()).toMatchObject({ status: 404, body: { error: { code: 'DIAGNOSTIC_DISABLED' } } })
  expect(getAdminAuth).not.toHaveBeenCalled()
  expect(getContext).not.toHaveBeenCalled()
  expect(STSClient).not.toHaveBeenCalled()
})

it('requiere POST y Bearer antes de llegar al SDK', async () => {
  const get = await request(null, 'GET')
  expect(get).toMatchObject({ status: 405, body: { error: { code: 'METHOD_NOT_ALLOWED' } } })
  expect(get.header).toHaveBeenCalledWith('Allow', 'POST')
  expect(await request(null)).toMatchObject({ status: 401, body: { error: { code: 'UNAUTHENTICATED' } } })
  expect(verify).not.toHaveBeenCalled()
  expect(getContext).not.toHaveBeenCalled()
})

it.each([
  ['auth/id-token-revoked', 401, 'INVALID_TOKEN'],
  ['internal', 500, 'INTERNAL_ERROR'],
])('sanitiza el rechazo Firebase %s', async (code, status, publicCode) => {
  verify.mockRejectedValue({ code, message: token })
  const response = await request()
  expect(response.status).toBe(status)
  expect(response.body).toEqual({ error: { code: publicCode } })
  expect(getContext).not.toHaveBeenCalled()
})

it('impide que el UID del cuerpo, query o encabezado autorice otra sesión', async () => {
  verify.mockResolvedValue({ uid: 'unauthorized-uid' })
  expect(await request()).toMatchObject({ status: 403, body: { error: { code: 'FORBIDDEN' } } })
  expect(verify).toHaveBeenCalledWith(token, true)
  expect(getContext).not.toHaveBeenCalled()
})

it.each([
  ['AWS_SES_REGION', undefined], ['AWS_SES_REGION', 'us-east-1'],
  ['AWS_ROLE_ARN', undefined], ['AWS_ROLE_ARN', 'arn:aws:iam::302495249734:role/other'],
])('falla sin credenciales ambientales ante %s=%s', async (key, value) => {
  vi.stubEnv(key, value)
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'fixture-ambient-key')
  expect(await request()).toMatchObject({ status: 503, body: { error: { code: 'AWS_NOT_CONFIGURED' } } })
  expect(getContext).not.toHaveBeenCalled()
  expect(STSClient).not.toHaveBeenCalled()
})

it('rechaza un OIDC ausente aunque exista un token de build', async () => {
  vi.mocked(getContext).mockReturnValue({})
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'fixture-build-token')
  expect(await request()).toMatchObject({ status: 502, body: { error: { code: 'AWS_STS_UNAVAILABLE' } } })
  expect(fromWebToken).not.toHaveBeenCalled()
  expect(STSClient).not.toHaveBeenCalled()
})

it('sanitiza el rechazo de AssumeRoleWithWebIdentity sin ejecutar GetCallerIdentity', async () => {
  exchange.mockRejectedValue(new Error(oidc))
  const result = await request()
  expect(result.status).toBe(502)
  expect(result.body).toEqual({ error: { code: 'AWS_STS_UNAVAILABLE' } })
  expect(STSClient).not.toHaveBeenCalled()
})

it('sanitiza errores de GetCallerIdentity y libera el cliente', async () => {
  const log = vi.spyOn(console, 'error')
  send.mockRejectedValue(new Error(`${arn} ${credentials.secretAccessKey} ${uid}`))
  const result = await request()
  expect(result.status).toBe(502)
  expect(result.body).toEqual({ error: { code: 'AWS_STS_UNAVAILABLE' } })
  expect(destroy).toHaveBeenCalledOnce()
  expect(log).not.toHaveBeenCalled()
})

it.each([
  { Account: '111111111111', Arn: arn },
  { Account: account, Arn: arn.replace(account, '111111111111') },
  { Account: account, Arn: arn.replace('workspace-ses-preview', 'workspace-ses-preview-other') },
  { Account: account, Arn: arn + '-different-session' },
  { Account: account, Arn: `arn:aws:iam::${account}:role/workspace-ses-preview` },
  { Account: account, Arn: undefined },
])('rechaza identidad AWS incorrecta: %j', async identity => {
  send.mockResolvedValue(identity)
  const result = await request()
  expect(result.status).toBe(502)
  expect(result.body).toEqual({ error: { code: 'AWS_IDENTITY_MISMATCH' } })
})

it('devuelve solo éxito tras resolver OIDC y verificar cuenta y rol con GetCallerIdentity', async () => {
  const result = await request()
  expect(result.status).toBe(200)
  expect(result.body).toEqual({ ok: true })
  expect(result.header).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
  expect(result.header).toHaveBeenCalledWith('Vercel-CDN-Cache-Control', 'no-store')
  expect(verify).toHaveBeenCalledExactlyOnceWith(token, true)
  expect(fromWebToken).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    roleArn: `arn:aws:iam::${account}:role/workspace-ses-preview`, webIdentityToken: oidc,
  }))
  expect(STSClient).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    region: 'us-east-2', credentials, maxAttempts: 1, ignoreConfiguredEndpointUrls: true,
  }))
  expect(GetCallerIdentityCommand).toHaveBeenCalledExactlyOnceWith({})
  expect(send).toHaveBeenCalledExactlyOnceWith(expect.any(GetCallerIdentityCommand))
  expect(destroy).toHaveBeenCalledOnce()
})
