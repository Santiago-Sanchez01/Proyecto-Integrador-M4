import { SummarySendFailure } from './summary-send-errors.js'

export type Outcome = 'accepted' | 'failed' | 'unknown'
export type SummarySendGuard = { begin: (uid: string, requestId: string) => 'reserved' | 'accepted'; finish: (uid: string, requestId: string, outcome: Outcome) => void }

export type SummarySendReservation = {
  start(): Promise<void>
  finish(outcome: Outcome): Promise<void>
}

export type PersistentSummarySendGuard = {
  reserve(uid: string, requestId: string): Promise<'accepted' | SummarySendReservation>
}

export async function reserveSummarySend(guard: SummarySendGuard | PersistentSummarySendGuard, uid: string, requestId: string): Promise<'accepted' | SummarySendReservation> {
  if ('reserve' in guard) return guard.reserve(uid, requestId)
  if (guard.begin(uid, requestId) === 'accepted') return 'accepted'
  return {
    async start() {},
    async finish(outcome: Outcome) { guard.finish(uid, requestId, outcome) },
  }
}

/** Local process only. Never claim cross-instance idempotency or persist this state. */
export function createMemorySendGuard(now = Date.now, maxEntries = 1000): SummarySendGuard {
  const records = new Map<string, { status: 'pending' | Outcome; expires: number }>()
  const active = new Map<string, string>()
  const cooldown = new Map<string, number>()
  const key = (uid: string, requestId: string) => JSON.stringify([uid, requestId])
  return {
    begin(uid, requestId) {
      const time = now()
      for (const [id, record] of records) if (record.expires <= time && (record.status === 'accepted' || record.status === 'failed')) records.delete(id)
      for (const [id, until] of cooldown) if (until <= time) cooldown.delete(id)
      const previous = records.get(key(uid, requestId))
      if (previous?.status === 'accepted') return 'accepted'
      if (previous?.status === 'failed') throw new SummarySendFailure('DUPLICATE_REQUEST')
      const running = active.get(uid)
      if (running) throw new SummarySendFailure(records.get(running)?.status === 'unknown' ? 'SEND_STATUS_UNKNOWN' : 'SEND_IN_PROGRESS')
      const until = cooldown.get(uid) ?? 0
      if (until > time) throw new SummarySendFailure('SEND_LIMITED', Math.ceil((until - time) / 1000))
      if (records.size >= maxEntries) throw new SummarySendFailure('PROVIDER_UNAVAILABLE')
      const id = key(uid, requestId)
      records.set(id, { status: 'pending', expires: time + 24 * 60 * 60 * 1000 })
      active.set(uid, id)
      return 'reserved'
    },
    finish(uid, requestId, outcome) {
      const id = key(uid, requestId), record = records.get(id)
      if (!record || record.status !== 'pending') return
      record.status = outcome
      if (outcome !== 'unknown') active.delete(uid)
      cooldown.set(uid, now() + 60_000)
    },
  }
}
