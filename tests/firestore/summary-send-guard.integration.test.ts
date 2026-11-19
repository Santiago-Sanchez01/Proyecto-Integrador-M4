import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { authenticateUser } from '../../server/authenticated-user'
import { getAdminAuth } from '../../server/firebase-admin'
import { createSendSummary } from '../../server/send-summary'
import { SummarySendFailure } from '../../server/summary-send-errors'
import { createFirestoreSummarySendGuard, readSummarySendQuotas } from '../../server/summary-send-firestore-guard'

vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn(), getAdminFirestore: vi.fn() }))

const projectId = 'demo-workspace-m4'
const first = '12345678-1234-4234-8234-123456789abc'
const second = '12345678-1234-4234-8234-123456789abd'
const third = '12345678-1234-4234-8234-123456789abe'
const hash = (uid: string) => createHash('sha256').update(uid).digest('hex')
const userPath = (uid: string) => `summarySendControl/${hash(uid)}`
const code = (value: string) => expect.objectContaining({ code: value })
let environment: RulesTestEnvironment
let apps: ReturnType<typeof initializeApp>[] = []

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error('Distributed guard tests require the local Firestore emulator.')
  }
  environment = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
  } })
  apps = ['guard-a', 'guard-b', 'guard-restarted'].map(name => initializeApp({ projectId }, name))
  vi.mocked(getAdminAuth).mockReturnValue({
    verifyIdToken: async (token: string) => ({ uid: token }),
  } as ReturnType<typeof getAdminAuth>)
})

beforeEach(async () => { await environment.clearFirestore() })
afterAll(async () => {
  await Promise.all(apps.map(app => deleteApp(app)))
  await environment?.cleanup()
})

const identity = (uid: string) => authenticateUser({ headers: { authorization: `Bearer ${uid}` } })
const guard = (instance: number, quotas = { perUser: 2, global: 24 }) =>
  createFirestoreSummarySendGuard(getFirestore(apps[instance]), quotas)

function service(instance: number, send = vi.fn(async () => {}), quotas?: { perUser: number; global: number }) {
  const execute = createSendSummary({
    configuration: () => ({ runtime: { allowed: true, reason: 'LOCAL_CONTROLLED' }, region: 'us-east-2', fromEmail: 'sender@example.invalid' }),
    recipient: async () => ({ uid: 'fixture', email: 'recipient@example.invalid' }),
    summary: async uid => ({ user: { uid }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [] }),
    render: () => ({ subject: 'Fixture', text: 'Fixture', html: '<p>Fixture</p>' }),
    mailer: () => ({ send }),
    guard: guard(instance, quotas),
  })
  return { send, execute }
}

it.each([first, second])('coordina dos instancias con la clave rival %s', async competingKey => {
  const uid = await identity('concurrent')
  let release!: () => void
  let signalEntered!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const entered = new Promise<void>(resolve => { signalEntered = resolve })
  const send = vi.fn(async () => {}).mockImplementationOnce(async () => {
    signalEntered()
    await wait
  })
  const a = service(0, send)
  const b = service(1, send)
  const original = a.execute(uid, first)
  // Race the second invocation with the first, holding any accepted call in SES.
  const rival = b.execute(uid, competingKey)
  const settled = Promise.allSettled([original, rival])
  try {
    await Promise.race([entered, settled.then(() => { throw new Error('No send started') })])
    const blocked = await Promise.race([original, rival].map(call => call.catch(error => error)))
    expect(blocked).toEqual(code('SEND_IN_PROGRESS'))
    expect(send).toHaveBeenCalledTimes(1)
  } finally { release() }
  const results = await settled
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(send).toHaveBeenCalledTimes(1)
}, 60_000)

it('reproduce la aceptación desde una nueva instancia y aplica 60 segundos a otra clave', async () => {
  const uid = await identity('durable')
  const a = service(0)
  const restarted = service(2, a.send)
  await expect(a.execute(uid, first)).resolves.toEqual({ status: 'accepted', requestId: first })
  await expect(restarted.execute(uid, first)).resolves.toEqual({ status: 'accepted', requestId: first })
  await expect(restarted.execute(uid, second)).rejects.toEqual(code('SEND_LIMITED'))
  expect(a.send).toHaveBeenCalledTimes(1)
})

it('aplica la cuota por UID y contabiliza fallos confirmados sin bloquear otras cuentas', async () => {
  const send = vi.fn(async () => { throw new SummarySendFailure('PROVIDER_UNAVAILABLE') })
  const a = service(0, send)
  const b = service(1, send)
  const alice = await identity('alice')
  const bob = await identity('bob')
  await expect(a.execute(alice, first)).rejects.toEqual(code('PROVIDER_UNAVAILABLE'))
  await expect(b.execute(alice, first)).rejects.toEqual(code('DUPLICATE_REQUEST'))
  await expect(b.execute(alice, second)).rejects.toEqual(code('PROVIDER_UNAVAILABLE'))
  await expect(a.execute(alice, third)).rejects.toEqual(code('SEND_LIMITED'))
  await expect(b.execute(bob, first)).rejects.toEqual(code('PROVIDER_UNAVAILABLE'))
  expect(send).toHaveBeenCalledTimes(3)
})

it('reserva la cuota global entre instancias y no toma cupo de otro shard', async () => {
  const uids = Array.from({ length: 128 }, (_, i) => `quota-user-${i}`)
  const byShard = (shard: number) => uids.filter(uid => Number.parseInt(hash(uid).slice(0, 2), 16) % 4 === shard)
  const quotas = { perUser: 2, global: 4 }
  await Promise.all([0, 1, 2, 3].map(async shard => {
    const [left, right] = byShard(shard)
    const results = await Promise.allSettled([guard(0, quotas).reserve(left, first), guard(1, quotas).reserve(right, first)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results).toContainEqual({ status: 'rejected', reason: code('SEND_LIMITED') })
  }))
  const snapshot = await getFirestore(apps[2]).collection('summarySendControl').get()
  expect(snapshot.docs.filter(entry => entry.id.startsWith('quota-')).map(entry => entry.get('count'))).toEqual([1, 1, 1, 1])
}, 60_000)

it('rechaza el envío cuando la transacción no está disponible', async () => {
  const a = service(0)
  const outage = vi.spyOn(getFirestore(apps[0]), 'runTransaction').mockRejectedValue(new Error('unavailable'))
  try {
    await expect(a.execute(await identity('outage'), first)).rejects.toEqual(code('PROVIDER_UNAVAILABLE'))
    expect(a.send).not.toHaveBeenCalled()
  } finally { outage.mockRestore() }
})

it('un resultado incierto bloquea claves nuevas desde otra instancia', async () => {
  const uid = await identity('uncertain')
  const a = service(0, vi.fn(async () => { throw new SummarySendFailure('SEND_STATUS_UNKNOWN') }))
  const b = service(1, a.send)
  await expect(a.execute(uid, first)).rejects.toEqual(code('SEND_STATUS_UNKNOWN'))
  await expect(b.execute(uid, second)).rejects.toEqual(code('SEND_STATUS_UNKNOWN'))
  expect(a.send).toHaveBeenCalledTimes(1)
})

it('conserva el bloqueo si se pierde la escritura final después de SES', async () => {
  const uid = await identity('lost-finish')
  const db = getFirestore(apps[0])
  const a = service(0, vi.fn(async () => {
    vi.spyOn(db, 'runTransaction').mockRejectedValueOnce(new Error('commit unavailable'))
  }))
  try {
    await expect(a.execute(uid, first)).rejects.toEqual(code('SEND_STATUS_UNKNOWN'))
    const state = await getFirestore(apps[1]).doc(userPath('lost-finish')).get()
    expect(state.get('active.status')).toBe('started')
    await expect(service(1, a.send).execute(uid, second)).rejects.toEqual(code('SEND_IN_PROGRESS'))
    expect(a.send).toHaveBeenCalledTimes(1)
  } finally { vi.restoreAllMocks() }
})

it('recupera una reserva abandonada, invalida al dueño anterior y preserva un inicio abandonado', async () => {
  const uid = 'abandoned'
  const ref = getFirestore(apps[2]).doc(userPath(uid))
  const original = await guard(0).reserve(uid, first)
  if (original === 'accepted') throw new Error('Expected a reservation')
  await ref.update({ 'active.until': 0 })
  const replacement = await guard(1).reserve(uid, first)
  if (replacement === 'accepted') throw new Error('Expected a replacement')
  await expect(original.start()).rejects.toEqual(code('SEND_IN_PROGRESS'))
  await expect(original.finish('failed')).rejects.toEqual(code('SEND_IN_PROGRESS'))
  await replacement.start()
  await ref.update({ 'active.until': 0 })
  const restarted = service(2)
  await expect(restarted.execute(await identity(uid), second)).rejects.toEqual(code('SEND_STATUS_UNKNOWN'))
  expect(restarted.send).not.toHaveBeenCalled()
})

it('deniega lectura y escritura de documentos de control desde el SDK Web', async () => {
  const uid = 'owner'
  await guard(0).reserve(uid, first)
  const web = environment.authenticatedContext(uid).firestore()
  for (const path of [userPath(uid), `${userPath(uid)}/requests/${first}`, 'summarySendControl/quota-0']) {
    const ref = doc(web, path)
    await assertFails(getDoc(ref))
    await assertFails(setDoc(ref, { count: 0 }))
    await assertFails(deleteDoc(ref))
  }
})

it('usa cuotas restrictivas y rechaza configuraciones inválidas', () => {
  expect(readSummarySendQuotas({})).toEqual({ perUser: 2, global: 24 })
  expect(() => readSummarySendQuotas({ SUMMARY_EMAIL_DAILY_GLOBAL_LIMIT: '3' })).toThrow(code('SEND_DISABLED'))
  expect(() => readSummarySendQuotas({ SUMMARY_EMAIL_DAILY_UID_LIMIT: '2.5' })).toThrow(code('SEND_DISABLED'))
})
