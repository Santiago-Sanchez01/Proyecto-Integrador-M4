import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Timestamp } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import type { AuthState } from '../auth/AuthContext'
import { createTasksService } from './tasks.service'
import type { TasksService } from './tasks.service'
import type { Task } from './task.types'
import TasksPage from './TasksPage'

vi.mock('./tasks.service', () => ({ createTasksService: vi.fn() }))

const timestamp = Timestamp.fromMillis(1000)
const tasks: Task[] = [
  { id: 'newest', title: 'Preparar la presentación', description: 'Revisar las diapositivas del proyecto.', status: 'pending', createdAt: timestamp, updatedAt: timestamp },
  { id: 'middle', title: 'Revisar documentación', description: 'Contrastar los resultados con el equipo.', status: 'completed', createdAt: timestamp, updatedAt: timestamp },
  { id: 'oldest', title: 'Organizar la jornada', description: 'Elegir los próximos pasos.', status: 'pending', createdAt: timestamp, updatedAt: timestamp },
]
type Subscription = { next: (tasks: Task[]) => void; fail: (error: unknown) => void; stop: ReturnType<typeof vi.fn> }
let subscriptions: Subscription[]
let services: TasksService[]
let auth: AuthState

function page() {
  return <AuthContext value={auth}><TasksPage /></AuthContext>
}

function load(data = tasks) {
  act(() => subscriptions.at(-1)!.next(data))
}

beforeEach(() => {
  vi.resetAllMocks()
  subscriptions = []
  services = []
  auth = { status: 'ready', user: { uid: 'alice', email: 'alice@example.com' }, error: null }
  vi.mocked(createTasksService).mockImplementation(() => {
    const service: TasksService = {
      uid: auth.user!.uid,
      createTask: vi.fn(), getTasks: vi.fn(), updateTask: vi.fn(), setTaskStatus: vi.fn(), deleteTask: vi.fn(),
      subscribeTasks: vi.fn((next, fail) => {
        const stop = vi.fn()
        subscriptions.push({ next, fail, stop })
        return stop
      }),
    }
    services.push(service)
    return service
  })
})

describe('Mis tareas: visualización sin escrituras', () => {
  it('comunica la carga inicial sin mostrar filtros o una lista vacía prematura', () => {
    render(page())
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus tareas')
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByText('Todavía no tenés tareas')).not.toBeInTheDocument()
  })

  it('muestra título, descripción y estado respetando el orden del servicio', () => {
    render(page())
    load()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    tasks.forEach((task, index) => {
      expect(within(items[index]).getByRole('heading', { name: task.title, level: 2 })).toBeInTheDocument()
      expect(within(items[index]).getByText(task.description)).toBeInTheDocument()
      expect(within(items[index]).getByText(task.status === 'pending' ? 'Pendiente' : 'Completada')).toBeInTheDocument()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 3 tareas en total.')
  })

  it('filtra localmente con conteos globales, sin abrir otras consultas ni escribir', async () => {
    const user = userEvent.setup()
    render(page())
    load()
    await user.click(screen.getByRole('button', { name: 'Pendientes: 2 tareas' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('Revisar documentación')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendientes: 2 tareas', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas: 3 tareas', pressed: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Completadas: 1 tarea' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Revisar documentación' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1 tarea completada de 3 en total.')
    await user.click(screen.getByRole('button', { name: 'Todas: 3 tareas' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(createTasksService).toHaveBeenCalledTimes(1)
    expect(services[0].subscribeTasks).toHaveBeenCalledTimes(1)
    for (const method of ['getTasks', 'createTask', 'updateTask', 'setTaskStatus', 'deleteTask'] as const) {
      expect(services[0][method]).not.toHaveBeenCalled()
    }
  })

  it('distingue la cuenta sin tareas y muestra conteos cero', () => {
    render(page())
    load([])
    expect(screen.getByRole('heading', { name: 'Todavía no tenés tareas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas: 0 tareas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendientes: 0 tareas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completadas: 0 tareas' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('distingue un filtro sin resultados y permite volver a Todas', async () => {
    const user = userEvent.setup()
    render(page())
    load([tasks[0]])
    await user.click(screen.getByRole('button', { name: 'Completadas: 0 tareas' }))
    expect(screen.getByRole('heading', { name: 'No hay tareas completadas' })).toBeInTheDocument()
    expect(screen.queryByText('Todavía no tenés tareas')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver todas' }))
    expect(screen.getByRole('heading', { name: tasks[0].title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todas: 1 tarea', pressed: true })).toBeInTheDocument()
  })

  it('muestra el error y reintenta creando una nueva suscripción', async () => {
    const user = userEvent.setup()
    render(page())
    act(() => subscriptions[0].fail({ code: 'unavailable' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus tareas')
    expect(screen.getByRole('alert')).toHaveTextContent('Revisá tu conexión')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
    expect(subscriptions).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus tareas')
    load()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('actualiza listado y conteos con la suscripción conservando el filtro', async () => {
    const user = userEvent.setup()
    render(page())
    load()
    await user.click(screen.getByRole('button', { name: 'Pendientes: 2 tareas' }))
    load(tasks.map(task => ({ ...task, status: 'completed' })))
    expect(screen.getByRole('heading', { name: 'No hay tareas pendientes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendientes: 0 tareas', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completadas: 3 tareas' })).toBeInTheDocument()
    expect(subscriptions).toHaveLength(1)
  })

  it('permite operar los filtros con teclado y comunica el seleccionado', async () => {
    const user = userEvent.setup()
    render(page())
    load()
    expect(screen.getByRole('group', { name: 'Mostrar tareas' })).toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Todas: 3 tareas' })).toHaveFocus()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Pendientes: 2 tareas', pressed: true })).toHaveFocus()
    await user.tab()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Completadas: 1 tarea', pressed: true })).toHaveFocus()
    expect(screen.getByText('Completada')).toBeInTheDocument()
  })

  it('oculta tareas y callbacks de la cuenta anterior durante el cambio de usuario', () => {
    const view = render(page())
    load()
    auth = { ...auth, user: { uid: 'bob', email: null } }
    view.rerender(page())
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus tareas')
    expect(screen.queryByText(tasks[0].title)).not.toBeInTheDocument()
    act(() => subscriptions[0].next(tasks))
    expect(screen.queryByText(tasks[0].title)).not.toBeInTheDocument()
    load([])
    expect(screen.getByRole('heading', { name: 'Todavía no tenés tareas' })).toBeInTheDocument()
    view.unmount()
    expect(subscriptions[1].stop).toHaveBeenCalledTimes(1)
  })
})
