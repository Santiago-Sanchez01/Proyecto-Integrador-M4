import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authenticateUser } from '../../server/authenticated-user'
import { getAdminAuth } from '../../server/firebase-admin'
import { createSendSummary } from '../../server/send-summary'
import { evaluateSummaryEmailRuntime } from '../../server/summary-email-runtime'
import { SummarySendFailure } from '../../server/summary-send-errors'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn() }))

const uid = 'fixture-test-user'
const email = 'recipient@example.invalid'
const runId = '12345678-1234-4234-8234-123456789abc'
const now = Date.parse('2027-01-01T00:00:00Z')
const environment = {
  SUMMARY_EMAIL_ENABLED: 'true', SUMMARY_EMAIL_RUNTIME: 'preview-single-send', SUMMARY_EMAIL_GUARD: 'firestore',
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_PROJECT_NAME: 'workspace-m4',
  VERCEL_GIT_COMMIT_REF: 'feat/summary-email-cloud-integration', NODE_ENV: 'production', NODEJS_HELPERS: '0',
  FIREBASE_ADMIN_CREDENTIAL_MODE: 'vercel-oidc', FIREBASE_ADMIN_PROJECT_ID: 'workspace-m4',
  SUMMARY_EMAIL_PREVIEW_UID: uid, SUMMARY_EMAIL_PREVIEW_RECIPIENT: email, SUMMARY_EMAIL_PREVIEW_RUN_ID: runId,
  SUMMARY_EMAIL_PREVIEW_EXPIRES_AT: '2027-01-01T00:15:00Z',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.mocked(getAdminAuth).mockReturnValue({
    verifyIdToken: async (token: string) => ({ uid: token }),
  } as ReturnType<typeof getAdminAuth>)
})
afterEach(() => { vi.useRealTimers() })

it.each([
  ['SUMMARY_EMAIL_ENABLED', 'false'], ['SUMMARY_EMAIL_RUNTIME', 'disabled'], ['SUMMARY_EMAIL_GUARD', 'memory'],
  ['VERCEL_ENV', 'production'], ['VERCEL_TARGET_ENV', 'production'], ['VERCEL', undefined],
  ['VERCEL_PROJECT_NAME', 'another-project'], ['VERCEL_GIT_COMMIT_REF', 'main'],
  ['FIREBASE_ADMIN_PROJECT_ID', 'another-project'], ['FIREBASE_ADMIN_CREDENTIAL_MODE', 'adc'],
  ['FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080'], ['NODEJS_HELPERS', '1'],
  ['SUMMARY_EMAIL_PREVIEW_UID', ''], ['SUMMARY_EMAIL_PREVIEW_RECIPIENT', 'bad/address'],
  ['SUMMARY_EMAIL_PREVIEW_RUN_ID', '../users'], ['SUMMARY_EMAIL_PREVIEW_EXPIRES_AT', '2027-01-01T00:00:00Z'],
  ['SUMMARY_EMAIL_PREVIEW_EXPIRES_AT', '2027-01-01T01:00:01Z'],
])('deniega Preview para %s=%s', (key, value) => {
  expect(evaluateSummaryEmailRuntime({ ...environment, [key]: value }).allowed).toBe(false)
})

function fixture() {
  const start = vi.fn(async () => {})
  const finish = vi.fn<(outcome: 'accepted' | 'failed' | 'unknown') => Promise<void>>(async () => {})
  const reserve = vi.fn<() => Promise<'accepted' | { start: typeof start; finish: typeof finish }>>()
  reserve.mockResolvedValue({ start, finish })
  const close = vi.fn(async () => {})
  const previewGuard = vi.fn(() => ({ guard: { reserve }, close }))
  const localGuard = { begin: vi.fn(), finish: vi.fn() }
  const recipient = vi.fn(async () => ({ uid, email }))
  const summary = vi.fn(async (requestUid: string) => ({
    user: { uid: requestUid }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [],
  }))
  const send = vi.fn(async () => {})
  const execute = createSendSummary({
    configuration: () => ({ runtime: evaluateSummaryEmailRuntime(environment), region: 'us-east-2', fromEmail: 'sender@example.invalid' }),
    recipient, summary, render: () => ({ subject: 'fixture', text: 'fixture', html: 'fixture' }),
    mailer: () => ({ send }), guard: localGuard, previewGuard,
  })
  return { execute, start, finish, reserve, close, previewGuard, localGuard, recipient, summary, send }
}

const identity = (token: string) => authenticateUser({ headers: { authorization: `Bearer ${token}` } })

it('rechaza antes de reservar si el UID o el destinatario no coinciden', async () => {
  const f = fixture()
  await expect(f.execute(await identity('other-user'), 'first-client-id')).rejects.toMatchObject({ code: 'SEND_DISABLED' })
  expect(f.recipient).not.toHaveBeenCalled()
  f.recipient.mockResolvedValueOnce({ uid, email: 'other@example.invalid' })
  await expect(f.execute(await identity(uid), 'first-client-id')).rejects.toMatchObject({ code: 'SEND_DISABLED' })
  expect(f.previewGuard).not.toHaveBeenCalled()
  expect(f.send).not.toHaveBeenCalled()
})

it('persiste inicio y aceptación, fija una clave de guarda y conserva el contrato HTTP', async () => {
  const f = fixture()
  const user = await identity(uid)
  await expect(f.execute(user, 'first-client-id')).resolves.toEqual({ status: 'accepted', requestId: 'first-client-id' })
  f.reserve.mockResolvedValueOnce('accepted')
  await expect(f.execute(user, 'another-client-id')).resolves.toEqual({ status: 'accepted', requestId: 'another-client-id' })
  expect(f.previewGuard).toHaveBeenNthCalledWith(1, runId)
  expect(f.reserve).toHaveBeenNthCalledWith(1, 'preview-send', runId)
  expect(f.reserve).toHaveBeenNthCalledWith(2, 'preview-send', runId)
  expect(f.start).toHaveBeenCalledBefore(f.send)
  expect(f.send).toHaveBeenCalledExactlyOnceWith(email, { subject: 'fixture', text: 'fixture', html: 'fixture' })
  expect(f.finish).toHaveBeenCalledExactlyOnceWith('accepted')
  expect(f.localGuard.begin).not.toHaveBeenCalled()
  expect(f.summary).toHaveBeenCalledExactlyOnceWith(uid)
  expect(f.close).toHaveBeenCalledTimes(2)
})

it('si caduca durante la confirmación de inicio, registra fallo antes de contactar SES', async () => {
  const f = fixture()
  f.start.mockImplementationOnce(async () => { vi.advanceTimersByTime(900_000) })
  await expect(f.execute(await identity(uid), 'first-client-id')).rejects.toMatchObject({ code: 'SEND_DISABLED' })
  expect(f.finish).toHaveBeenCalledExactlyOnceWith('failed')
  expect(f.send).not.toHaveBeenCalled()
})

it('persiste la incertidumbre sin recurrir a la guarda local ni repetir SES', async () => {
  const f = fixture()
  f.send.mockRejectedValueOnce(new Error('network response lost'))
  const user = await identity(uid)
  await expect(f.execute(user, 'first-client-id')).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
  f.reserve.mockRejectedValueOnce(new SummarySendFailure('SEND_STATUS_UNKNOWN'))
  await expect(f.execute(user, 'another-client-id')).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
  expect(f.finish).toHaveBeenCalledExactlyOnceWith('unknown')
  expect(f.send).toHaveBeenCalledOnce()
  expect(f.localGuard.begin).not.toHaveBeenCalled()
})
