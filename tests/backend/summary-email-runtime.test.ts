import type { IncomingMessage } from 'node:http'
import { beforeEach, expect, it, vi } from 'vitest'
import { authenticateUser } from '../../server/authenticated-user'
import { getAdminAuth } from '../../server/firebase-admin'
import { createSendSummary } from '../../server/send-summary'
import { evaluateSummaryEmailRuntime } from '../../server/summary-email-runtime'
import type { SummaryEmailEnvironment } from '../../server/summary-email-runtime'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn() }))
const local: SummaryEmailEnvironment = { SUMMARY_EMAIL_ENABLED: 'true', SUMMARY_EMAIL_RUNTIME: 'local-controlled', VERCEL: '1', VERCEL_ENV: 'development', NODE_ENV: 'development', NODEJS_HELPERS: '0' }
const deny: { label: string; env: SummaryEmailEnvironment }[] = [
  { label: 'all missing', env: {} },
  { label: 'old exploit: flag alone', env: { SUMMARY_EMAIL_ENABLED: 'true' } },
  { label: 'NODE_ENV alone does not prove local', env: { SUMMARY_EMAIL_ENABLED: 'true', NODE_ENV: 'development' } },
  ...(['SUMMARY_EMAIL_ENABLED', 'SUMMARY_EMAIL_RUNTIME', 'VERCEL', 'VERCEL_ENV', 'NODE_ENV', 'NODEJS_HELPERS'] as const).flatMap(key =>
    [undefined, '', 'unexpected'].map(value => ({ label: `${key}=${String(value)}`, env: { ...local, [key]: value } }))),
  { label: 'flag false', env: { ...local, SUMMARY_EMAIL_ENABLED: 'false' } },
  { label: 'flag case mismatch', env: { ...local, SUMMARY_EMAIL_ENABLED: 'TRUE' } },
  { label: 'flag whitespace', env: { ...local, SUMMARY_EMAIL_ENABLED: ' true ' } },
  { label: 'VERCEL false', env: { ...local, VERCEL: '0' } },
  { label: 'NODE_ENV production contradicts local', env: { ...local, NODE_ENV: 'production' } },
  { label: 'Vercel preview contradicts marker', env: { ...local, VERCEL_ENV: 'preview' } },
  { label: 'Vercel production contradicts marker', env: { ...local, VERCEL_ENV: 'production' } },
  { label: 'preview without VERCEL', env: { ...local, VERCEL: undefined, VERCEL_ENV: 'preview' } },
  { label: 'production without VERCEL', env: { ...local, VERCEL: undefined, VERCEL_ENV: 'production' } },
  ...['', 'unexpected', 'staging', 'preview', 'production'].map(value => ({ label: `target=${value}`, env: { ...local, VERCEL_TARGET_ENV: value } })),
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue({ uid: 'alice' }) } as unknown as ReturnType<typeof getAdminAuth>)
})

it.each(deny)('DENY $label: política real no reserva, lee destinatario, consulta Firestore ni invoca SES', async ({ env }) => {
  const decision = evaluateSummaryEmailRuntime(env)
  expect(decision.allowed).toBe(false)
  const identity = await authenticateUser({ headers: { authorization: 'Bearer fake-token' } } as IncomingMessage)
  const begin = vi.fn(), finish = vi.fn(), send = vi.fn(), mailer = vi.fn(() => ({ send }))
  const recipient = vi.fn().mockResolvedValue({ uid: 'alice', email: 'alice@example.invalid' })
  const summary = vi.fn().mockResolvedValue({ user: { uid: 'alice' }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [] })
  const render = vi.fn().mockReturnValue({ subject: 'Test', text: 'Test', html: 'Test' })
  const execute = createSendSummary({ configuration: () => ({ runtime: decision, region: 'us-east-1', fromEmail: 'sender@example.invalid' }),
    recipient, summary, render, mailer, guard: { begin, finish } })
  await expect(execute(identity, '12345678-1234-4234-8234-123456789abc')).rejects.toMatchObject({ status: 503 })
  for (const operation of [begin, finish, recipient, summary, render, mailer, send]) expect(operation).not.toHaveBeenCalled()
})

it.each([local, { ...local, VERCEL_TARGET_ENV: 'development' }])('ALLOW únicamente con identificación completa y coherente: %j', async env => {
  const decision = evaluateSummaryEmailRuntime(env)
  expect(decision).toEqual({ allowed: true, reason: 'LOCAL_CONTROLLED' })
  const identity = await authenticateUser({ headers: { authorization: 'Bearer fake-token' } } as IncomingMessage)
  const begin = vi.fn().mockReturnValue('reserved'), finish = vi.fn(), send = vi.fn().mockResolvedValue(undefined)
  const execute = createSendSummary({ configuration: () => ({ runtime: decision, region: 'us-east-1', fromEmail: 'sender@example.invalid' }),
    recipient: vi.fn().mockResolvedValue({ uid: 'alice', email: 'alice@example.invalid' }),
    summary: vi.fn().mockResolvedValue({ user: { uid: 'alice' }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [] }),
    render: vi.fn().mockReturnValue({ subject: 'Test', text: 'Test', html: 'Test' }), mailer: () => ({ send }), guard: { begin, finish } })
  await expect(execute(identity, '12345678-1234-4234-8234-123456789abc')).resolves.toEqual({ status: 'accepted', requestId: '12345678-1234-4234-8234-123456789abc' })
  expect(begin).toHaveBeenCalledOnce(); expect(send).toHaveBeenCalledOnce()
  expect(finish).toHaveBeenCalledWith('alice', '12345678-1234-4234-8234-123456789abc', 'accepted')
})

it('es pura: no modifica la configuración ni devuelve valores de entorno', () => {
  const env = Object.freeze({ ...local })
  expect(evaluateSummaryEmailRuntime(env)).toEqual(evaluateSummaryEmailRuntime(env))
  expect(Object.keys(evaluateSummaryEmailRuntime(env))).toEqual(['allowed', 'reason'])
})
