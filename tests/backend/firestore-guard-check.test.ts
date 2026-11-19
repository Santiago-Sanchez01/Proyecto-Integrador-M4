import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import handler from '../../api/summary/guard-check'
import { createVercelFirebaseCredentials } from '../../server/firebase-admin-oidc'
import { runGuardCheck } from '../../server/firestore-guard-check'
import { SummarySendFailure } from '../../server/summary-send-errors'

const { verify, firestore, terminate, sesLoaded } = vi.hoisted(() => ({
  verify: vi.fn(), firestore: vi.fn(), terminate: vi.fn(), sesLoaded: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({ Firestore: class {
  constructor(settings: unknown) { firestore(settings) }
  terminate = terminate
} }))
vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: () => ({ verifyIdToken: verify }) }))
vi.mock('../../server/firebase-admin-oidc', () => ({ createVercelFirebaseCredentials: vi.fn() }))
vi.mock('../../server/firestore-guard-check', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/firestore-guard-check')>(), runGuardCheck: vi.fn(),
}))
vi.mock('@aws-sdk/client-sesv2', () => {
  sesLoaded()
  throw new Error('The guard diagnostic must never load SES')
})

const uid = 'fixture-operator'
const projectId = 'workspace-guard-fixture'
const databaseId = 'workspace-guard-diagnostics'
const auth = { fixture: 'federated-only' }
const env = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_NAME: 'workspace-m4',
  VERCEL_GIT_COMMIT_REF: 'feat/summary-email-cloud-integration',
  FIREBASE_ADMIN_CREDENTIAL_MODE: 'vercel-oidc', FIREBASE_ADMIN_PROJECT_ID: 'workspace-m4',
  FIRESTORE_GUARD_CHECK_ALLOWED_UID: uid, FIRESTORE_GUARD_CHECK_PROJECT_ID: projectId,
  FIRESTORE_GUARD_CHECK_DATABASE_ID: databaseId,
}

beforeEach(() => {
  vi.resetAllMocks()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', undefined)
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined)
  vi.stubEnv('GCP_SERVICE_ACCOUNT_EMAIL', 'fixture-original-preview-account')
  verify.mockResolvedValue({ uid })
  terminate.mockResolvedValue(undefined)
  vi.mocked(createVercelFirebaseCredentials).mockReturnValue({ auth } as unknown as ReturnType<typeof createVercelFirebaseCredentials>)
  vi.mocked(runGuardCheck).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  expect(sesLoaded).not.toHaveBeenCalled()
})

async function request(authorization: string | null = 'Bearer fixture-token', method = 'POST') {
  const req = {
    method, headers: { authorization: authorization ?? undefined, 'x-user-id': uid },
    body: { uid, projectId: 'workspace-m4', databaseId: '(default)', path: 'users/other/tasks' },
    url: '/api/summary/guard-check?projectId=workspace-m4&databaseId=(default)',
  } as unknown as IncomingMessage
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() }
  await handler(req, res as unknown as ServerResponse)
  return { status: res.statusCode, body: JSON.parse(res.end.mock.calls[0][0]), headers: res.setHeader }
}

it.each([
  ['VERCEL_ENV', 'production'], ['VERCEL_TARGET_ENV', 'production'], ['VERCEL_PROJECT_NAME', 'another-project'],
  ['VERCEL_GIT_COMMIT_REF', 'main'], ['VERCEL', undefined],
  ['FIREBASE_ADMIN_CREDENTIAL_MODE', 'adc'], ['FIREBASE_ADMIN_PROJECT_ID', projectId],
  ['FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080'], ['FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099'],
  ['FIRESTORE_GUARD_CHECK_ALLOWED_UID', undefined], ['FIRESTORE_GUARD_CHECK_ALLOWED_UID', '   '],
  ['FIRESTORE_GUARD_CHECK_ALLOWED_UID', 'bad/uid'],
  ['FIRESTORE_GUARD_CHECK_PROJECT_ID', undefined], ['FIRESTORE_GUARD_CHECK_PROJECT_ID', 'workspace-m4'],
  ['FIRESTORE_GUARD_CHECK_DATABASE_ID', undefined], ['FIRESTORE_GUARD_CHECK_DATABASE_ID', '(default)'],
  ['FIRESTORE_GUARD_CHECK_DATABASE_ID', 'different-fixture-db'],
])('bloquea Firebase y Firestore para %s=%s', async (key, value) => {
  vi.stubEnv(key, value)
  expect(await request()).toMatchObject({ status: 404, body: { error: { code: 'DIAGNOSTIC_DISABLED' } } })
  expect(verify).not.toHaveBeenCalled()
  expect(createVercelFirebaseCredentials).not.toHaveBeenCalled()
  expect(firestore).not.toHaveBeenCalled()
})

it('requiere POST autenticado y rechaza el token revocado', async () => {
  expect(await request(null, 'GET')).toMatchObject({ status: 405, body: { error: { code: 'METHOD_NOT_ALLOWED' } } })
  expect(await request(null)).toMatchObject({ status: 401, body: { error: { code: 'UNAUTHENTICATED' } } })
  expect(verify).not.toHaveBeenCalled()
  verify.mockRejectedValue({ code: 'auth/id-token-revoked', message: 'private-token' })
  expect(await request()).toMatchObject({ status: 401, body: { error: { code: 'INVALID_TOKEN' } } })
  expect(firestore).not.toHaveBeenCalled()
})

it('rechaza el UID ajeno aunque el cliente incluya el UID permitido', async () => {
  verify.mockResolvedValue({ uid: 'different' })
  expect(await request()).toMatchObject({ status: 403, body: { error: { code: 'FORBIDDEN' } } })
  expect(verify).toHaveBeenCalledExactlyOnceWith('fixture-token', true)
  expect(firestore).not.toHaveBeenCalled()
})

it('crea únicamente el cliente REST federado de la base nombrada y devuelve solo éxito', async () => {
  const res = await request()
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ ok: true })
  expect(res.headers).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
  expect(createVercelFirebaseCredentials).toHaveBeenCalledExactlyOnceWith(projectId, expect.objectContaining({
    GCP_SERVICE_ACCOUNT_EMAIL: `workspace-guard-preview@${projectId}.iam.gserviceaccount.com`,
  }))
  expect(firestore).toHaveBeenCalledExactlyOnceWith({ projectId, databaseId, auth, preferRest: true })
  expect(runGuardCheck).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ terminate: expect.any(Function) }))
  expect(terminate).toHaveBeenCalledOnce()
})

it('sanitiza fallos de federación, transacción y comprobación sin usar ADC', async () => {
  vi.mocked(createVercelFirebaseCredentials).mockImplementationOnce(() => { throw new Error('private-config') })
  expect(await request()).toMatchObject({ status: 503, body: { error: { code: 'FIRESTORE_UNAVAILABLE' } } })
  expect(firestore).not.toHaveBeenCalled()
  vi.mocked(runGuardCheck).mockRejectedValueOnce(new SummarySendFailure('PROVIDER_UNAVAILABLE'))
  expect(await request()).toMatchObject({ status: 503, body: { error: { code: 'FIRESTORE_UNAVAILABLE' } } })
  vi.mocked(runGuardCheck).mockRejectedValueOnce(new Error('private-document-path'))
  expect(await request()).toMatchObject({ status: 500, body: { error: { code: 'GUARD_CHECK_FAILED' } } })
  expect(terminate).toHaveBeenCalledTimes(2)
})
