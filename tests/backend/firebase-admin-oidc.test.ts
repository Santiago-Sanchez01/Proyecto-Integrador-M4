import { getContext } from '@vercel/oidc'
import { Firestore } from 'firebase-admin/firestore'
import { afterEach, expect, it, vi } from 'vitest'
import { createVercelFirebaseCredentials } from '../../server/firebase-admin-oidc'

vi.mock('@vercel/oidc', () => ({ getContext: vi.fn() }))

const project = 'test-project'
const config = {
  GCP_PROJECT_NUMBER: '123456789012',
  GCP_WORKLOAD_IDENTITY_POOL_ID: 'test-pool',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: 'test-provider',
  GCP_SERVICE_ACCOUNT_EMAIL: 'test-account@test-project.iam.gserviceaccount.com',
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function simulateExchange() {
  const { credential, auth } = createVercelFirebaseCredentials(project, config)
  const client = await auth.getClient()
  const now = Date.now()
  let generation = 0
  vi.mocked(getContext).mockImplementation(() => ({
    headers: { 'x-vercel-oidc-token': `oidc-${generation + 1}` },
  }))
  // STS and impersonation use separate instances of the same Gaxios transport.
  const transport = Object.getPrototypeOf(client.transporter) as typeof client.transporter
  const requests = vi.spyOn(transport, 'request').mockImplementation(async options => {
    if (!options) throw new Error('Missing request options')
    const url = String(options.url)
    let data: unknown
    if (url === 'https://sts.googleapis.com/v1/token') {
      generation++
      const parameters = new URLSearchParams(String(options.data))
      expect(parameters.get('subject_token')).toBe(`oidc-${generation}`)
      expect(parameters.get('audience')).toBe('//iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/test-pool/providers/test-provider')
      data = { access_token: `sts-${generation}`, expires_in: 3600, token_type: 'Bearer' }
    } else if (url === 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/test-account@test-project.iam.gserviceaccount.com:generateAccessToken') {
      expect(new Headers(options.headers).get('authorization')).toBe(`Bearer sts-${generation}`)
      data = { accessToken: `google-${generation}`, expireTime: new Date(Date.now() + 3600_000).toISOString() }
    } else {
      throw new Error('Unexpected request')
    }
    return Object.assign(Response.json(data), { data }) as unknown as Awaited<ReturnType<typeof client.transporter.request>>
  })
  return { credential, auth, requests, now }
}

it('intercambia OIDC por un token impersonado, lo comparte y renueva al caducar', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const { credential, auth, requests, now } = await simulateExchange()
  expect(requests).not.toHaveBeenCalled()
  const [first, headers] = await Promise.all([credential.getAccessToken(), auth.getRequestHeaders()])
  expect(first).toEqual({ access_token: 'google-1', expires_in: 3600 })
  expect(headers.get('authorization')).toBe('Bearer google-1')
  expect(requests).toHaveBeenCalledTimes(2)
  expect(getContext).toHaveBeenCalledTimes(1)
  vi.setSystemTime(now + 3601_000)
  await expect(credential.getAccessToken()).resolves.toEqual({ access_token: 'google-2', expires_in: 3600 })
  expect(requests).toHaveBeenCalledTimes(4)
  expect(getContext).toHaveBeenCalledTimes(2)
})

it('el cliente real de Firestore usa la credencial compartida en lectura y commit de la transacción', async () => {
  const { auth, credential, requests } = await simulateExchange()
  await credential.getAccessToken()
  const firestore = new Firestore({ projectId: project, auth, preferRest: true })
  const ref = firestore.doc('summarySendControl/test')
  const seen: string[] = []
  function respond(body: unknown): Awaited<ReturnType<typeof requests>> {
    return Response.json(body) as unknown as Awaited<ReturnType<typeof requests>>
  }
  requests.mockImplementation(async options => {
    if (!options) throw new Error('Missing request options')
    const url = new URL(String(options.url))
    expect(url.hostname).toBe('firestore.googleapis.com')
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer google-1')
    const operation = url.pathname.split(':').at(-1)!
    seen.push(operation)
    if (operation === 'batchGet') return respond([{
      missing: `projects/${project}/databases/(default)/documents/${ref.path}`,
      readTime: '2026-11-19T12:00:00Z',
      transaction: 'AQID',
    }])
    if (operation === 'commit') return respond({ commitTime: '2026-11-19T12:00:01Z',
      writeResults: [{ updateTime: '2026-11-19T12:00:01Z' }] })
    throw new Error('Unexpected Firestore operation')
  })
  try {
    await firestore.runTransaction(async transaction => {
      expect((await transaction.get(ref)).exists).toBe(false)
      transaction.set(ref, { status: 'reserved' })
    }, { maxAttempts: 1 })
    expect(seen).toEqual(['batchGet', 'commit'])
  } finally { await firestore.terminate() }
})

it.each(Object.keys(config))('rechaza la configuración incompleta: %s', name => {
  expect(() => createVercelFirebaseCredentials(project, { ...config, [name]: '' })).toThrow('configuration unavailable')
  expect(getContext).not.toHaveBeenCalled()
})

it('rechaza la ausencia de token de invocación aunque exista un token de entorno', async () => {
  const { credential, requests } = await simulateExchange()
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'token-of-build')
  vi.mocked(getContext).mockReturnValue({})
  await expect(credential.getAccessToken()).rejects.toThrow('Federated Firebase credentials unavailable.')
  expect(requests).not.toHaveBeenCalled()
})

it.each(['STS rechazó el OIDC caducado', 'IAM rechazó la impersonación'])('sanitiza y permite recuperar: %s', async failure => {
  const { credential, auth, requests } = await simulateExchange()
  const rejected = () => { throw new Error(`${failure}: subject-token=secret-fixture`) }
  if (failure.startsWith('IAM')) {
    const original = requests.getMockImplementation()!
    requests.mockImplementationOnce(original)
  }
  requests.mockImplementationOnce(rejected)
  const result = await auth.getRequestHeaders().catch((error: unknown) => error)
  expect(result).toEqual(new Error('Federated Firebase credentials unavailable.'))
  expect(result).not.toHaveProperty('cause')
  await expect(credential.getAccessToken()).resolves.toEqual({
    access_token: failure.startsWith('IAM') ? 'google-2' : 'google-1',
    expires_in: expect.any(Number),
  })
})
