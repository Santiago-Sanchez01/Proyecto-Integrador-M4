import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { getFirebaseAuth } from '../../src/lib/firebase.ts'
import { getFirebaseFirestore } from '../../src/lib/firestore.ts'
import { createTasksService } from '../../src/features/tasks/tasks.service.ts'
import { createTaskFocusService } from '../../src/features/tasks/focus.service.ts'

vi.mock('../../src/lib/firebase.ts', () => ({ getFirebaseAuth: vi.fn() }))
vi.mock('../../src/lib/firestore.ts', () => ({ getFirebaseFirestore: vi.fn() }))
let env: RulesTestEnvironment
const auth = { currentUser: { uid: 'alice' } as { uid: string } | null }
function database(uid = 'alice') { return env.authenticatedContext(uid).firestore() }
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Local emulator required')
  env = await initializeTestEnvironment({ projectId: 'demo-workspace-m4', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } })
})
beforeEach(async () => {
  await env.clearFirestore()
  auth.currentUser = { uid: 'alice' }
  vi.mocked(getFirebaseAuth).mockReturnValue(auth as ReturnType<typeof getFirebaseAuth>)
  vi.mocked(getFirebaseFirestore).mockReturnValue(database() as unknown as ReturnType<typeof getFirebaseFirestore>)
})
afterAll(async () => { await env?.cleanup() })

async function task() { return createTasksService().createTask({ title: 'Título', description: 'Texto' }) }

it('persiste una selección pendiente y permite quitarla con notificación realtime', async () => {
  const focus = createTaskFocusService()
  expect(await focus.getFocus()).toBeNull()
  let current: string | null | undefined
  const errors: unknown[] = []
  const stop = focus.subscribeFocus(id => { current = id }, e => errors.push(e))
  try {
    const id = await task()
    await focus.selectFocus(id)
    expect(await createTaskFocusService().getFocus()).toBe(id)
    await vi.waitFor(() => expect(current).toBe(id))
    await focus.selectFocus(null)
    await vi.waitFor(() => expect(current).toBeNull())
    expect(errors).toEqual([])
  } finally { stop() }
})

it('rechaza tareas inexistentes, completadas y referencias a otra cuenta', async () => {
  const focus = createTaskFocusService()
  await expect(focus.selectFocus('missing')).rejects.toBeDefined()
  const id = await task()
  await createTasksService().setTaskStatus(id, 'completed')
  await expect(focus.selectFocus(id)).rejects.toBeDefined()
  await expect(focus.selectFocus('bob/tasks/other')).rejects.toBeDefined()
  const bob = database('bob')
  await assertFails(getDoc(doc(bob, 'users/alice')))
  await assertFails(setDoc(doc(bob, 'users/alice'), { focusTaskId: null }))
  await assertFails(setDoc(doc(bob, 'users/bob'), { focusTaskId: id }))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice')))
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice'), { focusTaskId: null }))
})

it.each([true, false])('limpia foco atómicamente al eliminar=%s', async remove => {
  const id = await task()
  const focus = createTaskFocusService()
  await focus.selectFocus(id)
  if (remove) await createTasksService().deleteTask(id)
  else await createTasksService().setTaskStatus(id, 'completed')
  expect(await focus.getFocus()).toBeNull()
})

it('rechaza completar o eliminar sin liberar el foco y rechaza seleccionar una tarea borrada en el mismo batch', async () => {
  const id = await task()
  await createTaskFocusService().selectFocus(id)
  const db = database()
  const ref = doc(db, 'users/alice/tasks', id)
  await assertFails(updateDoc(ref, { status: 'completed', updatedAt: serverTimestamp() }))
  const batch = writeBatch(db)
  batch.set(doc(db, 'users/alice'), { focusTaskId: id })
  batch.delete(ref)
  await assertFails(batch.commit())
})

it.each([{}, { focusTaskId: '' }, { focusTaskId: 1 }, { focusTaskId: null, extra: true }])('rechaza documento inválido %j', async data => {
  await assertFails(setDoc(doc(database(), 'users/alice'), data))
})

it('resuelve selección concurrente con finalización sin dejar referencias inválidas', async () => {
  const id = await task()
  await Promise.allSettled([createTaskFocusService().selectFocus(id), createTasksService().setTaskStatus(id, 'completed')])
  expect((await createTasksService().getTasks())[0].status).toBe('completed')
  expect(await createTaskFocusService().getFocus()).toBeNull()
})

it('rechaza un servicio de la sesión anterior', async () => {
  const focus = createTaskFocusService()
  auth.currentUser = { uid: 'bob' }
  await expect(focus.getFocus()).rejects.toMatchObject({ code: 'tasks/session-changed' })
  await expect(focus.selectFocus(null)).rejects.toMatchObject({ code: 'tasks/session-changed' })
})

it('completar una tarea diferente no borra una nueva selección', async () => {
  const first = await task()
  const second = await task()
  const focus = createTaskFocusService()
  await focus.selectFocus(second)
  await createTasksService().setTaskStatus(first, 'completed')
  expect(await focus.getFocus()).toBe(second)
})

it('serializa dos selecciones concurrentes y mantiene un único foco válido', async () => {
  const first = await task()
  const second = await task()
  const focus = createTaskFocusService()
  await Promise.all([focus.selectFocus(first), focus.selectFocus(second)])
  expect([first, second]).toContain(await focus.getFocus())
})

it('rechaza seleccionar y borrar en el mismo batch cuando todavía no existe users/{uid}', async () => {
  const id = await task()
  const db = database()
  const batch = writeBatch(db)
  batch.set(doc(db, 'users/alice'), { focusTaskId: id })
  batch.delete(doc(db, 'users/alice/tasks', id))
  await assertFails(batch.commit())
})
