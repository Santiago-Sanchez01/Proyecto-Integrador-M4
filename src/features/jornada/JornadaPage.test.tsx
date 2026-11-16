import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Timestamp } from 'firebase/firestore'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/useAuth'
import type { AuthState } from '../auth/AuthContext'
import { createTasksService } from '../tasks/tasks.service'
import { createTaskFocusService } from '../tasks/focus.service'
import type { Task } from '../tasks/task.types'
import JornadaPage from './JornadaPage'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../tasks/tasks.service', () => ({ createTasksService: vi.fn() }))
vi.mock('../tasks/focus.service', () => ({ createTaskFocusService: vi.fn() }))
let auth: AuthState
let taskListeners: { next: (tasks: Task[]) => void; fail: (error: unknown) => void; stop: ReturnType<typeof vi.fn> }[]
let focusListeners: { next: (id: string | null) => void; fail: (error: unknown) => void; stop: ReturnType<typeof vi.fn> }[]
const write = vi.fn()
const task = (id: string): Task => ({ id, title: id, description: `Descripción ${id}`, status: 'pending', createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) })

beforeEach(() => {
  vi.resetAllMocks()
  taskListeners = []; focusListeners = []
  auth = { user: { uid: 'alice', email: null }, status: 'ready', error: null }
  vi.mocked(useAuth).mockImplementation(() => auth)
  vi.mocked(createTasksService).mockImplementation(() => ({
    uid: auth.user!.uid, getTasks: vi.fn(), createTask: write, updateTask: write, deleteTask: write, setTaskStatus: write,
    subscribeTasks: (next, fail) => { const stop = vi.fn(); taskListeners.push({ next, fail, stop }); return stop },
  }))
  vi.mocked(createTaskFocusService).mockImplementation(() => ({
    uid: auth.user!.uid, getFocus: vi.fn(), selectFocus: write,
    subscribeFocus: (next, fail) => { const stop = vi.fn(); focusListeners.push({ next, fail, stop }); return stop },
  }))
})

it('actualiza foco, listado y progreso con snapshots independientes, sin escrituras', () => {
  render(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => { focusListeners[0].next('foco'); taskListeners[0].next([task('otra')]) })
  expect(screen.getByRole('status')).toHaveTextContent('Sincronizando')
  act(() => taskListeners[0].next([task('foco'), task('otra')]))
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('foco')).toBeInTheDocument()
  act(() => taskListeners[0].next([{ ...task('foco'), status: 'completed' }, task('otra')]))
  expect(screen.getByRole('status')).toHaveTextContent('Sincronizando')
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50')
  act(() => focusListeners[0].next(null))
  expect(screen.getByText('Sin foco seleccionado')).toBeInTheDocument()
  act(() => taskListeners[0].next([]))
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
  expect(write).not.toHaveBeenCalled()
})

it('oculta inmediatamente datos de otra sesión, ignora callbacks viejos y limpia ambas suscripciones', () => {
  const view = render(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => { taskListeners[0].next([task('privada-alice')]); focusListeners[0].next('privada-alice') })
  expect(screen.getByText('privada-alice')).toBeInTheDocument()
  auth = { ...auth, user: { uid: 'bob', email: null } }
  view.rerender(<MemoryRouter><JornadaPage /></MemoryRouter>)
  expect(screen.queryByText('privada-alice')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tus tareas')
  expect(taskListeners[0].stop).toHaveBeenCalledOnce()
  expect(focusListeners[0].stop).toHaveBeenCalledOnce()
  act(() => { taskListeners[0].next([task('privada-alice')]); focusListeners[0].next('privada-alice') })
  expect(screen.queryByText('privada-alice')).not.toBeInTheDocument()
  act(() => { taskListeners[1].next([task('propia-bob')]); focusListeners[1].next(null) })
  expect(screen.getByText('propia-bob')).toBeInTheDocument()
  view.unmount()
  expect(taskListeners[1].stop).toHaveBeenCalledOnce()
  expect(focusListeners[1].stop).toHaveBeenCalledOnce()
})

it('comunica errores reales de los listeners y se recupera con un snapshot posterior', () => {
  render(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => { taskListeners[0].next([]); focusListeners[0].fail({ code: 'unavailable' }) })
  expect(screen.getByRole('alert')).toHaveTextContent('conexión')
  act(() => focusListeners[0].next(null))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  act(() => taskListeners[0].fail({ code: 'permission-denied' }))
  expect(screen.getByRole('alert')).toHaveTextContent('permiso')
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})
