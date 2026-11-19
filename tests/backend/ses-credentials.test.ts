import { fromWebToken } from '@aws-sdk/credential-provider-web-identity'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { getContext } from '@vercel/oidc'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSesMailer } from '../../server/ses'
import { sesCredentialProvider } from '../../server/ses-credentials'
import { evaluateSummaryEmailRuntime } from '../../server/summary-email-runtime'

vi.mock('@aws-sdk/credential-provider-web-identity', () => ({ fromWebToken: vi.fn() }))
vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: vi.fn(class {}), SendEmailCommand: vi.fn() }))
vi.mock('@vercel/oidc', () => ({ getContext: vi.fn() }))

const preview = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
  VERCEL_PROJECT_NAME: 'workspace-m4', VERCEL_GIT_COMMIT_REF: 'feat/summary-email-cloud-integration',
  AWS_ROLE_ARN: 'arn:aws:iam::302495249734:role/workspace-ses-preview',
  AWS_REGION: 'iad1',
}
const exchange = vi.fn<ReturnType<typeof fromWebToken>>()
const credentials = { accessKeyId: 'fixture-access', secretAccessKey: 'fixture-secret',
  sessionToken: 'fixture-session', expiration: new Date('2030-01-01T00:00:00Z') }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fromWebToken).mockReturnValue(exchange)
  exchange.mockResolvedValue(credentials)
  vi.mocked(getContext).mockReturnValue({ headers: { 'x-vercel-oidc-token': 'fixture-oidc' } })
})

afterEach(() => {
  vi.unstubAllEnvs()
  expect(SendEmailCommand).not.toHaveBeenCalled()
})

it('conecta el proveedor al cliente SES sin obtener el token ni contactar STS al construirlo', () => {
  for (const [key, value] of Object.entries(preview)) vi.stubEnv(key, value)
  createSesMailer('us-east-2', 'sender@example.invalid')
  expect(SESv2Client).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    region: 'us-east-2', credentials: expect.any(Function), ignoreConfiguredEndpointUrls: true,
  }))
  expect(getContext).not.toHaveBeenCalled()
  expect(fromWebToken).not.toHaveBeenCalled()
})

it('usa el token de cada invocación y permite renovar credenciales temporales', async () => {
  const provider = sesCredentialProvider('us-east-2', preview)!
  await expect(provider()).resolves.toEqual(credentials)
  expect(fromWebToken).toHaveBeenCalledExactlyOnceWith({
    roleArn: preview.AWS_ROLE_ARN, webIdentityToken: 'fixture-oidc',
    roleSessionName: 'workspace-ses-preview', durationSeconds: 900,
    clientConfig: { region: 'us-east-2', maxAttempts: 1, ignoreConfiguredEndpointUrls: true },
  })
  vi.mocked(getContext).mockReturnValue({ headers: { 'x-vercel-oidc-token': 'fixture-renewed' } })
  await provider()
  expect(fromWebToken).toHaveBeenLastCalledWith(expect.objectContaining({ webIdentityToken: 'fixture-renewed' }))
  expect(exchange).toHaveBeenCalledTimes(2)
})

it('el SDK real serializa AssumeRoleWithWebIdentity y lee la respuesta STS simulada', async () => {
  const actual = await vi.importActual<typeof import('@aws-sdk/credential-provider-web-identity')>('@aws-sdk/credential-provider-web-identity')
  const handle = vi.fn(async (request: { hostname: string; body?: unknown }) => {
    expect(request.hostname).toBe('sts.us-east-2.amazonaws.com')
    const payload = new URLSearchParams(String(request.body))
    expect(payload.get('Action')).toBe('AssumeRoleWithWebIdentity')
    expect(payload.get('RoleArn')).toBe(preview.AWS_ROLE_ARN)
    expect(payload.get('WebIdentityToken')).toBe('fixture-oidc')
    const xml = '<AssumeRoleWithWebIdentityResponse><AssumeRoleWithWebIdentityResult><Credentials>'
      + '<AccessKeyId>fixture-access</AccessKeyId><SecretAccessKey>fixture-secret</SecretAccessKey>'
      + '<SessionToken>fixture-session</SessionToken><Expiration>2030-01-01T00:00:00Z</Expiration>'
      + '</Credentials></AssumeRoleWithWebIdentityResult></AssumeRoleWithWebIdentityResponse>'
    return { response: { statusCode: 200, headers: {}, body: Readable.from([Buffer.from(xml)]) } }
  })
  vi.mocked(fromWebToken).mockImplementation(options => actual.fromWebToken({
    ...options, clientConfig: { ...options.clientConfig, requestHandler: { handle } },
  }))
  await expect(sesCredentialProvider('us-east-2', preview)!()).resolves.toMatchObject(credentials)
  expect(handle).toHaveBeenCalledOnce()
})

it.each([
  { AWS_ROLE_ARN: undefined }, { AWS_ROLE_ARN: 'arn:aws:iam::302495249734:role/other' },
  { VERCEL: undefined }, { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' },
  { VERCEL_TARGET_ENV: 'production' }, { VERCEL_PROJECT_NAME: 'different' }, { VERCEL_GIT_COMMIT_REF: 'main' },
  { VERCEL_ENV: 'development', VERCEL_TARGET_ENV: 'development' },
])('falla cerrado para configuración incompleta o contradictoria: %j', overrides => {
  expect(() => sesCredentialProvider('us-east-2', { ...preview, ...overrides })).toThrow(expect.objectContaining({ code: 'SEND_DISABLED' }))
  expect(getContext).not.toHaveBeenCalled()
  expect(fromWebToken).not.toHaveBeenCalled()
})

it('mantiene la cadena local y rechaza una región distinta en Preview', () => {
  expect(sesCredentialProvider('us-east-1', { VERCEL: '1', VERCEL_ENV: 'development' })).toBeUndefined()
  expect(() => sesCredentialProvider('us-east-1', preview)).toThrow(expect.objectContaining({ code: 'SEND_DISABLED' }))
})

it('no intercambia un token de build ni usa credenciales AWS del entorno si falta el contexto', async () => {
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'fixture-build-oidc')
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'fixture-ambient-key')
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'fixture-ambient-secret')
  vi.mocked(getContext).mockReturnValue({})
  await expect(sesCredentialProvider('us-east-2', preview)!()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  expect(fromWebToken).not.toHaveBeenCalled()
  expect(exchange).not.toHaveBeenCalled()
})

it('sanitiza el rechazo de STS y no vuelve a la cadena predeterminada', async () => {
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'fixture-ambient-key')
  exchange.mockRejectedValue(new Error('fixture-oidc fixture-secret'))
  const error = await sesCredentialProvider('us-east-2', preview)!().catch(failure => failure)
  expect(error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  expect(error).not.toHaveProperty('cause')
  expect(String(error)).not.toMatch(/fixture/)
  expect(exchange).toHaveBeenCalledOnce()
})

it.each([{ sessionToken: undefined }, { expiration: new Date(0) }])('rechaza credenciales incompletas o caducadas: %j', patch => {
  exchange.mockResolvedValue({ ...credentials, ...patch })
  return expect(sesCredentialProvider('us-east-2', preview)!()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
})

it('configurar el rol no abre el envío HTTP en Preview', () => {
  expect(evaluateSummaryEmailRuntime({ ...preview, SUMMARY_EMAIL_ENABLED: 'false', SUMMARY_EMAIL_RUNTIME: 'disabled' }))
    .toEqual({ allowed: false, reason: 'DISABLED' })
  expect(evaluateSummaryEmailRuntime({ ...preview, SUMMARY_EMAIL_ENABLED: 'true', SUMMARY_EMAIL_RUNTIME: 'local-controlled' }))
    .toEqual({ allowed: false, reason: 'DEPLOYED_RUNTIME' })
  expect(fromWebToken).not.toHaveBeenCalled()
})
