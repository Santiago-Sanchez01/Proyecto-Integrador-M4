import { doc, getDocFromServer, onSnapshot, runTransaction } from 'firebase/firestore'
import { getFirebaseAuth } from '../../lib/firebase'
import { getFirebaseFirestore } from '../../lib/firestore'
import type { UserFocusDocument } from './focus.types'
import { taskError } from './tasks.errors'

export function createTaskFocusService() {
  const auth = getFirebaseAuth()
  const uid = auth.currentUser?.uid
  if (!uid) throw taskError('no-session')
  const db = getFirebaseFirestore()
  const ref = doc(db, 'users', uid)
  function check() { if (auth.currentUser?.uid !== uid) throw taskError('session-changed') }
  function read(data: unknown): string | null {
    if (data === undefined) return null
    if (!data || typeof data !== 'object' || !('focusTaskId' in data) || Object.keys(data).length !== 1) throw taskError('invalid-data')
    const id = data.focusTaskId
    if (id !== null && (typeof id !== 'string' || !id.trim() || id.includes('/'))) throw taskError('invalid-data')
    return id
  }
  return {
    uid,
    async getFocus() {
      check()
      const snapshot = await getDocFromServer(ref)
      check()
      return read(snapshot.data())
    },
    subscribeFocus(next: (id: string | null) => void, fail: (error: unknown) => void) {
      check()
      let active = true
      const stop = onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
        if (!active) return
        let id: string | null
        try { check(); if (snapshot.metadata.hasPendingWrites) return; id = read(snapshot.data()) }
        catch (error) { fail(error); return }
        next(id)
      }, error => { if (active) fail(error) })
      return () => { active = false; stop() }
    },
    async selectFocus(id: string | null) {
      check()
      if (id !== null && (typeof id !== 'string' || !id.trim() || id.includes('/'))) throw taskError('invalid-id')
      await runTransaction(db, async transaction => {
        check()
        await transaction.get(ref)
        if (id !== null) {
          const task = await transaction.get(doc(db, 'users', uid, 'tasks', id))
          if (!task.exists() || task.data().status !== 'pending') throw taskError('invalid-status')
        }
        check()
        transaction.set(ref, { focusTaskId: id } satisfies UserFocusDocument)
      })
      check()
    },
  }
}
