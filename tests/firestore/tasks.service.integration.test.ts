import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { getFirebaseAuth } from '../../src/lib/firebase.ts'
import { getFirebaseFirestore } from '../../src/lib/firestore.ts'
import { createTasksService } from '../../src/features/tasks/tasks.service.ts'
import type { Task } from '../../src/features/tasks/task.types.ts'

vi.mock('../../src/lib/firebase.ts', () => ({ getFirebaseAuth: vi.fn() }))
vi.mock('../../src/lib/firestore.ts', () => ({ getFirebaseFirestore: vi.fn() }))

let environment: RulesTestEnvironment | undefined
const auth = { currentUser: { uid: 'alice' } }
let cleanups: Array<() => void>

function asUser(uid: string) {
  auth.currentUser = { uid }
  const db = environment!.authenticatedContext(uid).firestore()
  vi.mocked(getFirebaseFirestore).mockReturnValue(db as unknown as ReturnType<typeof getFirebaseFirestore>)
  return createTasksService()
}

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error('Integration tests require npm run test:rules and the localhost emulator.')
  }
  environment = await initializeTestEnvironment({
    projectId: 'demo-workspace-m4',
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})

beforeEach(async () => {
  cleanups = []
  vi.resetAllMocks()
  vi.mocked(getFirebaseAuth).mockReturnValue(auth as ReturnType<typeof getFirebaseAuth>)
  await environment!.clearFirestore()
})

afterEach(() => { cleanups.forEach(cleanup => cleanup()) })
afterAll(async () => { await environment?.cleanup() })

describe('Servicio con SDK real y reglas del emulador', () => {
  it('persiste creación, edición, ambos estados y eliminación sin modificar createdAt', async () => {
    const service = asUser('alice')
    const id = await service.createTask({ title: '  Tarea  ', description: ' Descripción ' })
    const initial = (await service.getTasks())[0]
    expect(initial.id).toBe(id)
    expect(initial.title).toBe('Tarea')
    expect(initial.description).toBe('Descripción')
    expect(initial.status).toBe('pending')
    expect(initial.createdAt.isEqual(initial.updatedAt)).toBe(true)
    await service.updateTask(id, { title: 'Editada', description: 'Nueva descripción' })
    await service.setTaskStatus(id, 'completed')
    const completed = (await service.getTasks())[0]
    expect(completed.title).toBe('Editada')
    expect(completed.status).toBe('completed')
    expect(completed.createdAt.isEqual(initial.createdAt)).toBe(true)
    expect(completed.updatedAt.valueOf() >= initial.createdAt.valueOf()).toBe(true)
    await service.setTaskStatus(id, 'pending')
    expect((await service.getTasks())[0].status).toBe('pending')
    await service.deleteTask(id)
    expect(await service.getTasks()).toEqual([])
  })

  it('recibe snapshots confirmados y ordenados por creación descendente', async () => {
    const service = asUser('alice')
    let tasks: Task[] = []
    let error: unknown
    cleanups.push(service.subscribeTasks(next => { tasks = next }, failure => { error = failure }))
    const first = await service.createTask({ title: 'Primera', description: 'Descripción' })
    const second = await service.createTask({ title: 'Segunda', description: 'Descripción' })
    await vi.waitFor(() => expect(tasks.map(task => task.id)).toEqual([second, first]))
    expect(error).toBeUndefined()
    await service.setTaskStatus(second, 'completed')
    await vi.waitFor(() => expect(tasks[0].status).toBe('completed'))
    await service.deleteTask(second)
    await vi.waitFor(() => expect(tasks.map(task => task.id)).toEqual([first]))
  })

  it('mantiene las tareas separadas entre dos identidades del emulador', async () => {
    const alice = asUser('alice')
    const id = await alice.createTask({ title: 'Privada', description: 'Solo Alice' })
    const bob = asUser('bob')
    expect(await bob.getTasks()).toEqual([])
    await expect(alice.deleteTask(id)).rejects.toMatchObject({ code: 'tasks/session-changed' })
    // Deleting a missing document in Bob's own path is an idempotent no-op.
    await bob.deleteTask(id)
    expect((await asUser('alice').getTasks())[0].id).toBe(id)
  })
})
