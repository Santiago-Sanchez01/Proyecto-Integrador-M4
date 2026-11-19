import { createHash, randomUUID } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { createIsolatedPreviewFirestore } from './preview-firestore.js'
import { SummarySendFailure } from './summary-send-errors.js'
import { createFirestoreSummarySendGuard } from './summary-send-firestore-guard.js'
import type { PersistentSummarySendGuard } from './summary-send-guard.js'
import { isWorkspaceIntegrationPreview } from './workspace-preview.js'

const diagnosticDatabase = 'workspace-guard-diagnostics'
const fixtureProject = /^workspace-guard-[a-z0-9](?:[a-z0-9-]{0,12}[a-z0-9])?$/
const first = 'fixture-request-1'
const second = 'fixture-request-2'
const fixtureUid = 'synthetic-subject'
const failedCheck = () => new Error('Guard diagnostic assertion failed')

export function readGuardCheckConfig(env: NodeJS.ProcessEnv) {
  const uid = env.FIRESTORE_GUARD_CHECK_ALLOWED_UID
  const projectId = env.FIRESTORE_GUARD_CHECK_PROJECT_ID
  if (!isWorkspaceIntegrationPreview(env) || env.FIREBASE_ADMIN_CREDENTIAL_MODE !== 'vercel-oidc'
    || env.FIREBASE_ADMIN_PROJECT_ID !== 'workspace-m4'
    || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST
    || !uid?.trim() || uid !== uid.trim() || uid.length > 128 || uid.includes('/')
    || !projectId || !fixtureProject.test(projectId)
    || env.FIRESTORE_GUARD_CHECK_DATABASE_ID !== diagnosticDatabase) return null
  return { uid, projectId, databaseId: diagnosticDatabase }
}

export function createGuardCheckFirestore(config: NonNullable<ReturnType<typeof readGuardCheckConfig>>, env: NodeJS.ProcessEnv) {
  // Auth verification retains its existing credentials. This client impersonates a dedicated
  // account in the isolated project, using the same invocation-scoped Preview WIF provider.
  return createIsolatedPreviewFirestore(config.projectId, config.databaseId, env)
}

async function reserve(guard: PersistentSummarySendGuard, uid = fixtureUid, id = first) {
  const result = await guard.reserve(uid, id)
  if (result === 'accepted') throw failedCheck()
  return result
}

function matchesCode(error: unknown, code: SummarySendFailure['code']) {
  return error instanceof SummarySendFailure && error.code === code
}

async function expectRejection(operation: Promise<unknown>, code: SummarySendFailure['code']) {
  try { await operation }
  catch (error) { if (matchesCode(error, code)) return; throw error }
  throw failedCheck()
}

export async function runGuardCheck(db: Firestore) {
  if (db.databaseId !== diagnosticDatabase) throw failedCheck()
  // Case-specific guard scopes isolate every counter. Neither the authenticated UID nor
  // request data participates in a document path or a synthetic reservation.
  const cases = db.collection('summaryGuardDiagnosticRuns').doc(randomUUID()).collection('cases')
  const guard = (name: string, perUser = 2, global = 24) =>
    createFirestoreSummarySendGuard(cases.doc(name), { perUser, global })

  const lifecycle = guard('lifecycle')
  const accepted = await reserve(lifecycle)
  await expectRejection(lifecycle.reserve(fixtureUid, first), 'SEND_IN_PROGRESS')
  await accepted.start()
  await accepted.finish('accepted')
  if (await lifecycle.reserve(fixtureUid, first) !== 'accepted') throw failedCheck()
  await expectRejection(lifecycle.reserve(fixtureUid, second), 'SEND_LIMITED')

  const userQuota = guard('user-quota', 1)
  await (await reserve(userQuota)).finish('failed')
  await expectRejection(userQuota.reserve(fixtureUid, first), 'DUPLICATE_REQUEST')
  await expectRejection(userQuota.reserve(fixtureUid, second), 'SEND_LIMITED')

  // These synthetic UIDs deliberately collide in shard 0, leaving other shards free.
  const shard = (uid: string) => Number.parseInt(createHash('sha256').update(uid).digest('hex').slice(0, 2), 16) % 4
  const candidates = Array.from({ length: 32 }, (_, index) => `synthetic-global-${index}`)
  const [left, right] = candidates.filter(uid => shard(uid) === 0)
  const other = candidates.find(uid => shard(uid) !== 0)
  if (!left || !right || !other) throw failedCheck()
  const globalQuota = guard('global-quota', 2, 4)
  await (await reserve(globalQuota, left)).finish('failed')
  await expectRejection(globalQuota.reserve(right, first), 'SEND_LIMITED')
  await (await reserve(globalQuota, other)).finish('failed')

  const race = await Promise.allSettled([
    reserve(guard('concurrent')),
    reserve(guard('concurrent'), fixtureUid, second),
  ])
  const [one, two] = race
  const [winner, loser] = one.status === 'fulfilled' ? [one, two] : [two, one]
  if (winner.status !== 'fulfilled' || loser.status !== 'rejected') throw failedCheck()
  if (!matchesCode(loser.reason, 'SEND_IN_PROGRESS')) throw loser.reason
  await winner.value.finish('failed')

  const unknown = guard('unknown')
  const pending = await reserve(unknown)
  await pending.start()
  await pending.finish('unknown')
  await expectRejection(unknown.reserve(fixtureUid, second), 'SEND_STATUS_UNKNOWN')

  const marker = cases.doc('rollback')
  const cancelled = new Error('Intentional fixture rollback')
  try {
    await db.runTransaction(async transaction => {
      await transaction.get(marker)
      transaction.create(marker, { fixture: true })
      throw cancelled
    })
    throw failedCheck()
  } catch (error) {
    if (error !== cancelled) throw error
  }
  if ((await marker.get()).exists) throw failedCheck()
}
