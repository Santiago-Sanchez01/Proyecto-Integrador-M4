import { createHash, randomUUID } from 'node:crypto'
import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { SummarySendFailure } from './summary-send-errors.js'
import type { Outcome, PersistentSummarySendGuard } from './summary-send-guard'

const COLLECTION = 'summarySendControl'
const DAY_MS = 86_400_000
const COOLDOWN_MS = 60_000
const RESERVATION_MS = 60_000
const SHARDS = 4

type Quotas = { perUser: number; global: number }
type Active = { requestId: string; owner: string; status: 'reserved' | 'started' | 'unknown'; until: number }
type UserState = { active?: Active | null; cooldownUntil?: number; day?: number; count?: number }
type RequestState = { status: Active['status'] | Outcome; owner: string }
type ShardState = { day: number; count: number }

export function readSummarySendQuotas(env: NodeJS.ProcessEnv): Quotas {
  function limit(value: string | undefined, fallback: number, minimum: number, maximum: number) {
    if (value === undefined) return fallback
    const number = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum || number > maximum) {
      throw new SummarySendFailure('SEND_DISABLED')
    }
    return number
  }
  return {
    perUser: limit(env.SUMMARY_EMAIL_DAILY_UID_LIMIT, 2, 1, 10),
    global: limit(env.SUMMARY_EMAIL_DAILY_GLOBAL_LIMIT, 24, SHARDS, 100),
  }
}

export function createFirestoreSummarySendGuard(db: Firestore, quotas: Quotas): PersistentSummarySendGuard {
  const control = db.collection(COLLECTION)

  async function atomic<T>(execute: (transaction: Transaction) => Promise<T>) {
    try { return await db.runTransaction(execute) }
    catch (error) {
      if (error instanceof SummarySendFailure) throw error
      throw new SummarySendFailure('PROVIDER_UNAVAILABLE')
    }
  }

  return {
    async reserve(uid, requestId) {
      const uidHash = createHash('sha256').update(uid).digest('hex')
      const userRef = control.doc(uidHash)
      const requestRef = userRef.collection('requests').doc(requestId)
      const shard = Number.parseInt(uidHash.slice(0, 2), 16) % SHARDS
      const quotaRef = control.doc(`quota-${shard}`)
      const shardLimit = Math.floor(quotas.global / SHARDS) + Number(shard < quotas.global % SHARDS)
      const owner = randomUUID()

      const result = await atomic(async transaction => {
        const [userDoc, requestDoc] = await transaction.getAll(userRef, requestRef)
        const state = (userDoc.data() ?? {}) as UserState
        const request = requestDoc.data() as RequestState | undefined
        const time = userDoc.readTime.toMillis()
        if (request?.status === 'accepted') return 'accepted'
        if (request?.status === 'failed') throw new SummarySendFailure('DUPLICATE_REQUEST')
        const active = state.active
        if (active?.status === 'unknown' || (active?.status === 'started' && active.until <= time)) {
          throw new SummarySendFailure('SEND_STATUS_UNKNOWN')
        }
        if (active && (active.status === 'started' || active.until > time)) {
          throw new SummarySendFailure('SEND_IN_PROGRESS')
        }
        if (request?.status === 'started' || request?.status === 'unknown') {
          throw new SummarySendFailure('SEND_STATUS_UNKNOWN')
        }
        const cooldown = (state.cooldownUntil ?? 0) - time
        if (cooldown > 0) throw new SummarySendFailure('SEND_LIMITED', Math.ceil(cooldown / 1000))

        const day = Math.floor(time / DAY_MS)
        const count = state.day === day ? state.count ?? 0 : 0
        const quota = (await transaction.get(quotaRef)).data() as ShardState | undefined
        const shardCount = quota?.day === day ? quota.count : 0
        if (count >= quotas.perUser || shardCount >= shardLimit) {
          throw new SummarySendFailure('SEND_LIMITED', Math.ceil(((day + 1) * DAY_MS - time) / 1000))
        }
        transaction.set(quotaRef, { day, count: shardCount + 1 })
        transaction.set(userRef, { day, count: count + 1,
          active: { owner, requestId, status: 'reserved', until: time + RESERVATION_MS },
        }, { merge: true })
        transaction.set(requestRef, { owner, status: 'reserved' })
        return 'reserved'
      })
      if (result === 'accepted') return result

      async function transition(next: 'started' | Outcome) {
        await atomic(async transaction => {
          const [userDoc, requestDoc] = await transaction.getAll(userRef, requestRef)
          const active = (userDoc.data() as UserState | undefined)?.active
          const request = requestDoc.data() as RequestState | undefined
          const time = userDoc.readTime.toMillis()
          if (!active || active.requestId !== requestId || active.owner !== owner
            || request?.owner !== owner || request.status !== active.status) {
            throw new SummarySendFailure('SEND_IN_PROGRESS')
          }
          const allowed = next === 'started'
            ? active.status === 'reserved' && active.until > time
            : active.status === 'started' || (active.status === 'reserved' && next === 'failed')
          if (!allowed) {
            throw new SummarySendFailure('SEND_IN_PROGRESS')
          }
          transaction.update(requestRef, { status: next })
          if (next === 'started' || next === 'unknown') {
            transaction.update(userRef, { active: { ...active, status: next, until: time + RESERVATION_MS } })
          } else {
            transaction.update(userRef, next === 'accepted'
              ? { active: null, cooldownUntil: time + COOLDOWN_MS }
              : { active: null })
          }
        })
      }

      return { start: () => transition('started'), finish: outcome => transition(outcome) }
    },
  }
}
