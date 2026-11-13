import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDoc, collection, deleteDoc, doc, getDocsFromServer, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import type { QuerySnapshot } from 'firebase/firestore'
import { getFirebaseAuth } from '../../lib/firebase'
import { getFirebaseFirestore } from '../../lib/firestore'
import { createTasksService } from './tasks.service'

vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: vi.fn() }))
vi.mock('../../lib/firestore', () => ({ getFirebaseFirestore: vi.fn() }))
vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), collection: vi.fn(), deleteDoc: vi.fn(), doc: vi.fn(), getDocsFromServer: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(), query: vi.fn(), serverTimestamp: vi.fn(), updateDoc: vi.fn() }
})

const auth = { currentUser: { uid: 'alice' } as { uid: string } | null }
const db = {} as ReturnType<typeof getFirebaseFirestore>
const timestamp = Timestamp.fromMillis(1000)
const collectionRef = { type: 'collection' } as ReturnType<typeof collection>
const documentRef = { type: 'document' } as ReturnType<typeof doc>
const orderedQuery = { type: 'query' } as ReturnType<typeof query>
let nextSnapshot: (snapshot: QuerySnapshot) => void
let snapshotError: (error: unknown) => void
const unsubscribe = vi.fn()

function snapshot(id = 'task', patch: Record<string, unknown> = {}, pending = false): QuerySnapshot {
  return {
    metadata: { hasPendingWrites: pending },
    docs: [{ id, data: () => ({ title: 'Título', description: 'Descripción', status: 'pending', createdAt: timestamp, updatedAt: timestamp, ...patch }) }],
  } as unknown as QuerySnapshot
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.currentUser = { uid: 'alice' }
  vi.mocked(getFirebaseAuth).mockReturnValue(auth as ReturnType<typeof getFirebaseAuth>)
  vi.mocked(getFirebaseFirestore).mockReturnValue(db)
  vi.mocked(collection).mockReturnValue(collectionRef)
  vi.mocked(doc).mockReturnValue(documentRef)
  vi.mocked(query).mockReturnValue(orderedQuery)
  vi.mocked(serverTimestamp).mockReturnValue({ kind: 'server-timestamp' } as unknown as ReturnType<typeof serverTimestamp>)
  vi.mocked(addDoc).mockResolvedValue({ id: 'new-task' } as Awaited<ReturnType<typeof addDoc>>)
  vi.mocked(getDocsFromServer).mockResolvedValue(snapshot())
  vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
    nextSnapshot = args[2] as typeof nextSnapshot
    snapshotError = args[3] as typeof snapshotError
    return unsubscribe
  })
})

describe('Servicio de tareas ligado a la sesión SDK', () => {
  it('crea una tarea normalizada con exactamente los campos permitidos y fechas del servidor', async () => {
    const service = createTasksService()
    expect(await service.createTask({ title: '  Tarea  ', description: '  Descripción  ' })).toBe('new-task')
    expect(collection).toHaveBeenCalledWith(db, 'users', 'alice', 'tasks')
    expect(addDoc).toHaveBeenCalledWith(collectionRef, { title: 'Tarea', description: 'Descripción', status: 'pending', createdAt: { kind: 'server-timestamp' }, updatedAt: { kind: 'server-timestamp' } })
    expect(serverTimestamp).toHaveBeenCalledTimes(2)
  })

  it.each([
    { title: '', description: 'Texto' },
    { title: '\t\n ', description: 'Texto' },
    { title: 'Título', description: '   ' },
    { title: 'Título', description: '' },
  ])('rechaza contenido vacío antes de escribir: %j', async content => {
    const service = createTasksService()
    await expect(service.createTask(content)).rejects.toMatchObject({ code: 'tasks/invalid-content' })
    await expect(service.updateTask('task', content)).rejects.toMatchObject({ code: 'tasks/invalid-content' })
    expect(addDoc).not.toHaveBeenCalled()
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('edita solo título, descripción y updatedAt, sin tocar createdAt', async () => {
    await createTasksService().updateTask('task', { title: ' Nuevo ', description: ' Texto ' })
    expect(doc).toHaveBeenCalledWith(collectionRef, 'task')
    expect(updateDoc).toHaveBeenCalledWith(documentRef, { title: 'Nuevo', description: 'Texto', updatedAt: { kind: 'server-timestamp' } })
    expect(serverTimestamp).toHaveBeenCalledTimes(1)
  })

  it.each(['pending', 'completed'] as const)('cambia el estado a %s sin modificar otros campos', async status => {
    await createTasksService().setTaskStatus('task', status)
    expect(updateDoc).toHaveBeenCalledWith(documentRef, { status, updatedAt: { kind: 'server-timestamp' } })
  })

  it('valida estados y evita inyectar rutas mediante el identificador', async () => {
    const service = createTasksService()
    await expect(service.setTaskStatus('task', 'invalid' as 'pending')).rejects.toMatchObject({ code: 'tasks/invalid-status' })
    await expect(service.deleteTask('other/tasks/task')).rejects.toMatchObject({ code: 'tasks/invalid-id' })
    expect(updateDoc).not.toHaveBeenCalled()
    expect(deleteDoc).not.toHaveBeenCalled()
  })

  it('elimina la tarea de su subcolección', async () => {
    await createTasksService().deleteTask('task')
    expect(doc).toHaveBeenCalledWith(collectionRef, 'task')
    expect(deleteDoc).toHaveBeenCalledWith(documentRef)
  })

  it('consulta el servidor y devuelve modelos con orden consistente', async () => {
    const tasks = await createTasksService().getTasks()
    expect(getDocsFromServer).toHaveBeenCalledWith(orderedQuery)
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc')
    expect(orderBy).toHaveBeenCalledWith(expect.anything(), 'desc')
    expect(tasks).toEqual([{ id: 'task', title: 'Título', description: 'Descripción', status: 'pending', createdAt: timestamp, updatedAt: timestamp }])
  })

  it('entrega snapshots confirmados y notifica actualizaciones sucesivas', () => {
    const next = vi.fn()
    const stop = createTasksService().subscribeTasks(next, vi.fn())
    nextSnapshot(snapshot('first'))
    nextSnapshot(snapshot('local', {}, true))
    expect(next).toHaveBeenCalledTimes(1)
    nextSnapshot(snapshot('second', { status: 'completed' }))
    expect(next.mock.calls[1][0][0].id).toBe('second')
    expect(next.mock.calls[1][0][0].status).toBe('completed')
    stop()
    nextSnapshot(snapshot('late'))
    expect(next).toHaveBeenCalledTimes(2)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('propaga errores del listener y rechaza documentos con fechas inválidas', async () => {
    const next = vi.fn()
    const fail = vi.fn()
    const service = createTasksService()
    service.subscribeTasks(next, fail)
    snapshotError({ code: 'permission-denied' })
    expect(fail).toHaveBeenLastCalledWith({ code: 'permission-denied' })
    nextSnapshot(snapshot('bad', { createdAt: null }))
    expect(fail).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'tasks/invalid-data' }))
    expect(next).not.toHaveBeenCalled()
    vi.mocked(getDocsFromServer).mockResolvedValue(snapshot('bad', { updatedAt: Timestamp.fromMillis(0) }))
    await expect(service.getTasks()).rejects.toMatchObject({ code: 'tasks/invalid-data' })
  })

  it('propaga fallos de escritura y no devuelve un id inventado', async () => {
    vi.mocked(addDoc).mockRejectedValue({ code: 'unavailable' })
    await expect(createTasksService().createTask({ title: 'Título', description: 'Texto' })).rejects.toEqual({ code: 'unavailable' })
  })

  it('rechaza el acceso sin sesión y las operaciones de una sesión anterior', async () => {
    const service = createTasksService()
    auth.currentUser = { uid: 'bob' }
    await expect(service.createTask({ title: 'Título', description: 'Texto' })).rejects.toMatchObject({ code: 'tasks/session-changed' })
    await expect(service.deleteTask('task')).rejects.toMatchObject({ code: 'tasks/session-changed' })
    expect(addDoc).not.toHaveBeenCalled()
    expect(deleteDoc).not.toHaveBeenCalled()
    auth.currentUser = null
    expect(createTasksService).toThrow('Iniciá sesión')
  })

  it('rechaza una consulta que termina después del cambio de cuenta', async () => {
    let resolve!: (value: QuerySnapshot) => void
    vi.mocked(getDocsFromServer).mockReturnValue(new Promise<QuerySnapshot>(done => { resolve = done }))
    const pending = createTasksService().getTasks()
    auth.currentUser = { uid: 'bob' }
    resolve(snapshot())
    await expect(pending).rejects.toMatchObject({ code: 'tasks/session-changed' })
  })

  it('no entrega snapshots de otra sesión aunque el consumidor aún no haya limpiado', () => {
    const next = vi.fn()
    const fail = vi.fn()
    createTasksService().subscribeTasks(next, fail)
    auth.currentUser = { uid: 'bob' }
    nextSnapshot(snapshot())
    expect(next).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ code: 'tasks/session-changed' }))
  })

  it('rechaza la consulta puntual cuando contiene escrituras todavía pendientes', async () => {
    vi.mocked(getDocsFromServer).mockResolvedValue(snapshot('local', {}, true))
    await expect(createTasksService().getTasks()).rejects.toMatchObject({ code: 'tasks/pending-writes' })
  })
})
