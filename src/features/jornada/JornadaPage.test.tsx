import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const focusWrite = vi.fn()
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
    uid: auth.user!.uid, getFocus: vi.fn(), selectFocus: focusWrite,
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
  expect(focusWrite).not.toHaveBeenCalled()
})

function ready(focus: string | null = null) {
  const view = render(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => { taskListeners[0].next([task('primera'), task('segunda')]); focusListeners[0].next(focus) })
  return view
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

it('elige y cambia el foco únicamente después de snapshots confirmados', async () => {
  const user = userEvent.setup()
  const request = deferred()
  focusWrite.mockReturnValue(request.promise)
  ready()
  await user.click(screen.getByRole('button', { name: 'Elegir foco: primera' }))
  expect(focusWrite).toHaveBeenCalledWith('primera')
  expect(screen.getByText('Sin foco seleccionado')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Guardando tu foco')
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  await act(async () => { request.resolve(); await request.promise })
  expect(screen.getByText('Sin foco seleccionado')).toBeInTheDocument()
  act(() => focusListeners[0].next('primera'))
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('primera')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Tu tarea en foco' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Elegir foco: segunda' }))
  expect(focusWrite).toHaveBeenLastCalledWith('segunda')
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('primera')).toBeInTheDocument()
  act(() => focusListeners[0].next('segunda'))
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('segunda')).toBeInTheDocument()
})

it('quita el foco sin completar la tarea y permite volver a elegirla', async () => {
  const user = userEvent.setup()
  ready('primera')
  await user.click(screen.getByRole('button', { name: 'Quitar foco' }))
  expect(focusWrite).toHaveBeenCalledWith(null)
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Completar tarea' })).toBeInTheDocument()
  act(() => focusListeners[0].next(null))
  expect(screen.getByText('Sin foco seleccionado')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Elegir foco: primera' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
})

it('completa usando la transacción existente y refleja limpieza y progreso sin optimismo', async () => {
  const user = userEvent.setup()
  const request = deferred()
  write.mockReturnValue(request.promise)
  ready('primera')
  await user.click(screen.getByRole('button', { name: 'Completar tarea' }))
  expect(write).toHaveBeenCalledOnce()
  expect(write).toHaveBeenCalledWith('primera', 'completed')
  expect(focusWrite).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('Completando')
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
  await act(async () => { request.resolve(); await request.promise })
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
  act(() => { taskListeners[0].next([{ ...task('primera'), status: 'completed' }, task('segunda')]); focusListeners[0].next(null) })
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50')
  expect(screen.getByText('Sin foco seleccionado')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Elegir foco: primera' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Tu tarea en foco' })).toHaveFocus()
})

it('bloquea dos clics sincrónicos y acciones de otros tipos mientras hay una solicitud', async () => {
  const request = deferred()
  focusWrite.mockReturnValue(request.promise)
  ready('primera')
  const select = screen.getByRole('button', { name: 'Elegir foco: segunda' })
  act(() => { fireEvent.click(select); fireEvent.click(select) })
  fireEvent.click(screen.getByRole('button', { name: 'Completar tarea' }))
  fireEvent.click(screen.getByRole('button', { name: 'Quitar foco' }))
  expect(focusWrite).toHaveBeenCalledOnce()
  expect(write).not.toHaveBeenCalled()
  await act(async () => { request.resolve(); await request.promise })
  expect(screen.getByRole('button', { name: 'Completar tarea' })).toBeEnabled()
})

it.each(['permission-denied', 'unavailable'])('muestra errores de selección %s y permite reintentar', async code => {
  const user = userEvent.setup()
  focusWrite.mockRejectedValue({ code })
  ready('primera')
  await user.click(screen.getByRole('button', { name: 'Elegir foco: segunda' }))
  expect(screen.getByRole('alert')).toHaveTextContent(code === 'permission-denied' ? 'permiso' : 'conexión')
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('primera')).toBeInTheDocument()
  focusWrite.mockResolvedValue(undefined)
  await user.click(screen.getByRole('button', { name: 'Elegir foco: segunda' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each(['clear', 'complete'])('no pierde el foco cuando falla %s', async kind => {
  const user = userEvent.setup()
  write.mockRejectedValue({ code: 'unavailable' })
  focusWrite.mockRejectedValue({ code: 'permission-denied' })
  ready('primera')
  await user.click(screen.getByRole('button', { name: kind === 'clear' ? 'Quitar foco' : 'Completar tarea' }))
  expect(screen.getByRole('alert')).toHaveTextContent(kind === 'clear' ? 'permiso' : 'conexión')
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('primera')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Completar tarea' })).toBeEnabled()
})

it('recupera el foco persistido al remontar sin volver a escribirlo', () => {
  const view = ready('segunda')
  view.unmount()
  render(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => { taskListeners[1].next([task('primera'), task('segunda')]); focusListeners[1].next('segunda') })
  expect(within(screen.getByRole('region', { name: 'Tu tarea en foco' })).getByText('segunda')).toBeInTheDocument()
  expect(focusWrite).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
})

it('descarta errores y bloqueo de una operación de la cuenta anterior', async () => {
  const user = userEvent.setup()
  const request = deferred()
  focusWrite.mockReturnValue(request.promise)
  const view = ready('primera')
  await user.click(screen.getByRole('button', { name: 'Elegir foco: segunda' }))
  auth = { ...auth, user: { uid: 'bob', email: null } }
  view.rerender(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => { taskListeners[1].next([task('bob')]); focusListeners[1].next(null) })
  await act(async () => { request.reject({ code: 'permission-denied' }); await request.promise.catch(() => {}) })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('primera')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Elegir foco: bob' })).toBeEnabled()
})

it('permite elegir con teclado y bloquea selección durante carga o error de foco', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><JornadaPage /></MemoryRouter>)
  act(() => taskListeners[0].next([task('primera')]))
  expect(screen.getByRole('button', { name: 'Elegir foco: primera' })).toBeDisabled()
  act(() => focusListeners[0].fail({ code: 'unavailable' }))
  expect(screen.getByRole('button', { name: 'Elegir foco: primera' })).toBeDisabled()
  act(() => focusListeners[0].next(null))
  await user.tab()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Elegir foco: primera' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(focusWrite).toHaveBeenCalledWith('primera')
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
