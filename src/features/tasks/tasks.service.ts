import { addDoc, collection, doc, documentId, getDocsFromServer, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot, WithFieldValue } from 'firebase/firestore'
import { getFirebaseAuth } from '../../lib/firebase'
import { getFirebaseFirestore } from '../../lib/firestore'
import type { Task, TaskContent, TaskDocument, TaskStatus } from './task.types'
import { taskError } from './tasks.errors'

function validateContent(content: TaskContent): TaskContent {
  if (typeof content?.title !== 'string' || !content.title.trim() || typeof content?.description !== 'string' || !content.description.trim()) {
    throw taskError('invalid-content')
  }
  return { title: content.title.trim(), description: content.description.trim() }
}

function readTask(snapshot: QueryDocumentSnapshot<DocumentData>): Task {
  const data = snapshot.data()
  if (typeof data.title !== 'string' || !data.title.trim()
    || typeof data.description !== 'string' || !data.description.trim()
    || (data.status !== 'pending' && data.status !== 'completed')
    || !(data.createdAt instanceof Timestamp) || !(data.updatedAt instanceof Timestamp)
    || data.updatedAt.valueOf() < data.createdAt.valueOf()) {
    throw taskError('invalid-data')
  }
  return { id: snapshot.id, title: data.title, description: data.description, status: data.status, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

/** Bind to the actual SDK session. Callers cannot choose the UID or collection. */
export function createTasksService() {
  const auth = getFirebaseAuth()
  const uid = auth.currentUser?.uid
  if (!uid) throw taskError('no-session')
  const tasks = collection(getFirebaseFirestore(), 'users', uid, 'tasks')
  const orderedTasks = query(tasks, orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'))

  function assertSession() {
    if (auth.currentUser?.uid !== uid) throw taskError('session-changed')
  }

  function taskReference(id: string) {
    assertSession()
    if (typeof id !== 'string' || !id.trim() || id.includes('/')) throw taskError('invalid-id')
    return doc(tasks, id)
  }

  async function finishTask(id: string, remove: boolean) {
    const ref = taskReference(id)
    const db = getFirebaseFirestore()
    const userRef = doc(db, 'users', uid!)
    await runTransaction(db, async transaction => {
      assertSession()
      const user = await transaction.get(userRef)
      assertSession()
      if (user.exists() && user.data().focusTaskId === id) transaction.set(userRef, { focusTaskId: null })
      if (remove) transaction.delete(ref)
      else transaction.update(ref, { status: 'completed', updatedAt: serverTimestamp() })
    })
  }

  return {
    uid,
    async createTask(content: TaskContent): Promise<string> {
      assertSession()
      const fields = validateContent(content)
      const data = { ...fields, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() } satisfies WithFieldValue<TaskDocument>
      const result = await addDoc(tasks, data)
      assertSession()
      return result.id
    },
    async getTasks(): Promise<Task[]> {
      assertSession()
      const snapshot = await getDocsFromServer(orderedTasks)
      assertSession()
      if (snapshot.metadata.hasPendingWrites) throw taskError('pending-writes')
      return snapshot.docs.map(readTask)
    },
    subscribeTasks(onChange: (tasks: Task[]) => void, onError: (error: unknown) => void): () => void {
      assertSession()
      let active = true
      const unsubscribe = onSnapshot(orderedTasks, { includeMetadataChanges: true }, snapshot => {
        if (!active) return
        let result: Task[]
        try {
          assertSession()
          // Do not expose optimistic writes or unresolved server timestamps as confirmed data.
          if (snapshot.metadata.hasPendingWrites) return
          result = snapshot.docs.map(readTask)
        } catch (error) { onError(error); return }
        onChange(result)
      }, error => { if (active) onError(error) })
      return () => { active = false; unsubscribe() }
    },
    async updateTask(id: string, content: TaskContent): Promise<void> {
      const ref = taskReference(id)
      const fields = validateContent(content)
      await updateDoc(ref, { ...fields, updatedAt: serverTimestamp() })
      assertSession()
    },
    async setTaskStatus(id: string, status: TaskStatus): Promise<void> {
      const ref = taskReference(id)
      if (status !== 'pending' && status !== 'completed') throw taskError('invalid-status')
      if (status === 'completed') await finishTask(id, false)
      else await updateDoc(ref, { status, updatedAt: serverTimestamp() })
      assertSession()
    },
    async deleteTask(id: string): Promise<void> {
      await finishTask(id, true)
      assertSession()
    },
  }
}

export type TasksService = ReturnType<typeof createTasksService>
