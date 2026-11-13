import { StrictMode, useLayoutEffect } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../auth/useAuth'
import type { AuthState } from '../auth/AuthContext'
import { createTasksService } from './tasks.service'
import type { TasksService } from './tasks.service'
import type { Task } from './task.types'
import { useTasks } from './useTasks'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('./tasks.service', () => ({ createTasksService: vi.fn() }))

type Subscription = { uid: string; next: (tasks: Task[]) => void; fail: (error: unknown) => void; stop: ReturnType<typeof vi.fn> }
let auth: AuthState
let subscriptions: Subscription[]
let services: TasksService[]
const task: Task = { id: 'task', title: 'Título', description: 'Texto', status: 'pending', createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000) }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth = { status: 'ready', user: { uid: 'alice', email: 'alice@example.com' }, error: null }
  subscriptions = []
  services = []
  vi.mocked(useAuth).mockImplementation(() => auth)
  vi.mocked(createTasksService).mockImplementation(() => {
    const uid = auth.user!.uid
    const service: TasksService = {
      uid,
      createTask: vi.fn().mockResolvedValue('new'),
      getTasks: vi.fn().mockResolvedValue([]),
      updateTask: vi.fn().mockResolvedValue(undefined),
      setTaskStatus: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      subscribeTasks: vi.fn((next, fail) => {
        const stop = vi.fn()
        subscriptions.push({ uid, next, fail, stop })
        return stop
      }),
    }
    services.push(service)
    return service
  })
})

describe('useTasks', () => {
  it('espera el primer snapshot y recibe actualizaciones en tiempo real', () => {
    const { result } = renderHook(() => useTasks())
    expect(result.current.loading).toBe(true)
    act(() => subscriptions[0].next([task]))
    expect(result.current.tasks).toEqual([task])
    expect(result.current.loading).toBe(false)
    act(() => subscriptions[0].next([{ ...task, status: 'completed' }]))
    expect(result.current.tasks[0].status).toBe('completed')
  })

  it('no consulta mientras se restaura la sesión ni sin usuario', () => {
    auth = { status: 'loading', user: null, error: null }
    const { result, rerender } = renderHook(() => useTasks())
    expect(result.current.loading).toBe(true)
    expect(createTasksService).not.toHaveBeenCalled()
    auth = { status: 'ready', user: null, error: null }
    rerender()
    expect(result.current.loading).toBe(false)
    expect(result.current.tasks).toEqual([])
    expect(createTasksService).not.toHaveBeenCalled()
  })

  it('limpia el listener al desmontarse e ignora callbacks tardíos', () => {
    const { result, unmount } = renderHook(() => useTasks())
    unmount()
    expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
    act(() => { subscriptions[0].next([task]); subscriptions[0].fail({ code: 'permission-denied' }) })
    expect(result.current.tasks).toEqual([])
  })

  it('descarta las tareas y callbacks de la sesión anterior al cambiar de usuario', () => {
    const { result, rerender } = renderHook(() => useTasks())
    act(() => subscriptions[0].next([task]))
    const oldCreate = result.current.createTask
    auth = { ...auth, user: { uid: 'bob', email: 'bob@example.com' } }
    rerender()
    expect(result.current.tasks).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
    expect(subscriptions[1].uid).toBe('bob')
    act(() => { subscriptions[0].next([task]); subscriptions[0].fail({ code: 'permission-denied' }) })
    expect(result.current.tasks).toEqual([])
    expect(result.current.error).toBeNull()
    act(() => subscriptions[1].next([{ ...task, id: 'bob-task' }]))
    expect(result.current.tasks[0].id).toBe('bob-task')
    return expect(oldCreate({ title: 'Título', description: 'Texto' })).rejects.toMatchObject({ code: 'tasks/session-changed' })
  })

  it('no recupera datos viejos al salir y volver a entrar con el mismo UID', () => {
    const { result, rerender } = renderHook(() => useTasks())
    act(() => subscriptions[0].next([task]))
    auth = { ...auth, user: null }
    rerender()
    expect(result.current.tasks).toEqual([])
    auth = { ...auth, user: { uid: 'alice', email: 'alice@example.com' } }
    rerender()
    expect(result.current.tasks).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('ignora un snapshot de la cuenta anterior que llega antes del cleanup pasivo', () => {
    let switched = false
    const seen: Task[][] = []
    const { result, rerender } = renderHook(() => {
      const currentUid = auth.user?.uid
      const tasks = useTasks()
      if (switched) seen.push(tasks.tasks)
      useLayoutEffect(() => {
        if (switched && currentUid === 'bob') subscriptions[0].next([task])
      }, [currentUid])
      return tasks
    })
    act(() => subscriptions[0].next([task]))
    switched = true
    auth = { ...auth, user: { uid: 'bob', email: null } }
    rerender()
    expect(result.current.tasks).toEqual([])
    expect(seen.every(tasks => tasks.length === 0)).toBe(true)
  })

  it('expone las cuatro operaciones sin inventar cambios locales', async () => {
    const { result } = renderHook(() => useTasks())
    const content = { title: 'Título', description: 'Texto' }
    await act(async () => {
      expect(await result.current.createTask(content)).toBe('new')
      await result.current.updateTask('task', content)
      await result.current.setTaskStatus('task', 'completed')
      await result.current.setTaskStatus('task', 'pending')
      await result.current.deleteTask('task')
    })
    expect(services[0].createTask).toHaveBeenCalledWith(content)
    expect(services[0].updateTask).toHaveBeenCalledWith('task', content)
    expect(services[0].setTaskStatus).toHaveBeenCalledWith('task', 'completed')
    expect(services[0].setTaskStatus).toHaveBeenCalledWith('task', 'pending')
    expect(services[0].deleteTask).toHaveBeenCalledWith('task')
    expect(result.current.tasks).toEqual([])
    expect(result.current.isMutating).toBe(false)
  })

  it('mantiene el estado pendiente mientras haya operaciones concurrentes', async () => {
    const { result } = renderHook(() => useTasks())
    const first = deferred<void>()
    const second = deferred<void>()
    vi.mocked(services[0].deleteTask).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let a!: Promise<void>
    let b!: Promise<void>
    act(() => { a = result.current.deleteTask('a'); b = result.current.deleteTask('b') })
    expect(result.current.isMutating).toBe(true)
    await act(async () => { first.resolve(); await a })
    expect(result.current.isMutating).toBe(true)
    await act(async () => { second.resolve(); await b })
    expect(result.current.isMutating).toBe(false)
  })

  it('expone y propaga errores de operaciones sin simular éxito', async () => {
    const { result } = renderHook(() => useTasks())
    vi.mocked(services[0].deleteTask).mockRejectedValue({ code: 'permission-denied' })
    await act(async () => { await expect(result.current.deleteTask('task')).rejects.toEqual({ code: 'permission-denied' }) })
    expect(result.current.operationError).toBe('No tenés permiso para acceder a estas tareas.')
    expect(result.current.isMutating).toBe(false)
  })

  it('descarta datos cuando falla el listener sin mezclar el error de una operación', () => {
    const { result } = renderHook(() => useTasks())
    act(() => subscriptions[0].next([task]))
    act(() => subscriptions[0].fail({ code: 'permission-denied' }))
    expect(result.current.tasks).toEqual([])
    expect(result.current.error).toBe('No tenés permiso para acceder a estas tareas.')
    expect(result.current.loading).toBe(false)
    expect(result.current.operationError).toBeNull()
  })

  it('ignora una operación pendiente que termina en otra sesión', async () => {
    const { result, rerender } = renderHook(() => useTasks())
    const request = deferred<string>()
    vi.mocked(services[0].createTask).mockReturnValue(request.promise)
    let operation!: Promise<string>
    act(() => { operation = result.current.createTask({ title: 'Título', description: 'Texto' }) })
    auth = { ...auth, user: { uid: 'bob', email: null } }
    rerender()
    await act(async () => {
      request.resolve('old-id')
      await expect(operation).rejects.toMatchObject({ code: 'tasks/session-changed' })
    })
    expect(result.current.tasks).toEqual([])
    expect(result.current.operationError).toBeNull()
    expect(result.current.isMutating).toBe(false)
  })

  it('ignora un rechazo tardío después del desmontaje', async () => {
    const { result, unmount } = renderHook(() => useTasks())
    const request = deferred<void>()
    vi.mocked(services[0].deleteTask).mockReturnValue(request.promise)
    let operation!: Promise<void>
    act(() => { operation = result.current.deleteTask('task') })
    unmount()
    await act(async () => {
      request.reject({ code: 'unavailable' })
      await expect(operation).rejects.toEqual({ code: 'unavailable' })
    })
    expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
  })

  it('maneja errores al inicializar y limpia suscripciones en StrictMode', async () => {
    vi.mocked(createTasksService).mockImplementationOnce(() => { throw { code: 'unavailable' } })
    const failed = renderHook(() => useTasks())
    await waitFor(() => expect(failed.result.current.error).toBe('No pudimos conectarnos con las tareas. Revisá tu conexión.'))
    failed.unmount()
    const view = renderHook(() => useTasks(), { wrapper: StrictMode })
    expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(subscriptions[1].stop).toHaveBeenCalledTimes(1)
  })
})
