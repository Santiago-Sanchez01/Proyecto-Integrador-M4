import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Timestamp } from 'firebase/firestore'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/useAuth'
import type { AuthState } from '../auth/AuthContext'
import type { Task } from '../tasks/task.types'
import { createTasksService } from '../tasks/tasks.service'
import SummaryPage from './SummaryPage'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../tasks/tasks.service', () => ({ createTasksService: vi.fn() }))
let auth: AuthState
let listeners: { next: (tasks: Task[]) => void; fail: (error: unknown) => void; stop: ReturnType<typeof vi.fn> }[]
const write = vi.fn()
const task = (id: string, status: Task['status'] = 'pending'): Task => ({ id, title: id, description: `Descripción ${id}`, status, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) })

beforeEach(() => {
  vi.resetAllMocks()
  listeners = []
  auth = { user: { uid: 'alice', email: 'alice@example.com' }, status: 'ready', error: null }
  vi.mocked(useAuth).mockImplementation(() => auth)
  vi.mocked(createTasksService).mockImplementation(() => ({
    uid: auth.user!.uid, getTasks: vi.fn(), createTask: write, updateTask: write, deleteTask: write, setTaskStatus: write,
    subscribeTasks: (next, fail) => { const stop = vi.fn(); listeners.push({ next, fail, stop }); return stop },
  }))
})

it('recibe actualizaciones del listener y recalcula listado y progreso sin escribir', () => {
  const view = render(<MemoryRouter><SummaryPage /></MemoryRouter>)
  expect(screen.queryByRole('button', { name: 'Verificar acceso al resumen' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tu resumen')
  act(() => listeners[0].next([task('primera'), task('segunda')]))
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
  act(() => listeners[0].next([task('segunda', 'completed'), task('primera')]))
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50')
  expect(within(screen.getByRole('list')).getAllByRole('heading').map(h => h.textContent)).toEqual(['segunda', 'primera'])
  act(() => listeners[0].next([]))
  expect(screen.getByText('Todavía no tenés tareas')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0')
  expect(write).not.toHaveBeenCalled()
  view.unmount()
  expect(listeners[0].stop).toHaveBeenCalledOnce()
})

it('elimina tareas y email anteriores al cambiar de cuenta y descarta callbacks antiguos', () => {
  const view = render(<MemoryRouter><SummaryPage /></MemoryRouter>)
  act(() => listeners[0].next([task('privada-alice')]))
  auth = { ...auth, user: { uid: 'bob', email: 'bob@example.com' } }
  view.rerender(<MemoryRouter><SummaryPage /></MemoryRouter>)
  expect(screen.queryByText('privada-alice')).not.toBeInTheDocument()
  expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()
  expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tu resumen')
  expect(listeners[0].stop).toHaveBeenCalledOnce()
  act(() => listeners[0].next([task('privada-alice')]))
  expect(screen.queryByText('privada-alice')).not.toBeInTheDocument()
  act(() => listeners[1].next([task('propia-bob')]))
  expect(screen.getByText('propia-bob')).toBeInTheDocument()
})

it('reinicia la suscripción al reintentar y vuelve a mostrar los datos confirmados', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><SummaryPage /></MemoryRouter>)
  act(() => listeners[0].fail({ code: 'unavailable' }))
  expect(screen.getByRole('alert')).toHaveTextContent('conexión')
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(listeners[0].stop).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tu resumen')
  act(() => listeners[1].next([task('recuperada', 'completed')]))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100')
  expect(screen.getByText('recuperada')).toBeInTheDocument()
})

it('oculta el correo y las tareas cuando ya no hay una sesión lista', () => {
  const view = render(<MemoryRouter><SummaryPage /></MemoryRouter>)
  act(() => listeners[0].next([task('privada')]))
  auth = { ...auth, status: 'loading' }
  view.rerender(<MemoryRouter><SummaryPage /></MemoryRouter>)
  expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()
  expect(screen.queryByText('privada')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tu resumen')
})
