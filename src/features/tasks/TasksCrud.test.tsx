import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Timestamp } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { createTasksService } from './tasks.service'
import type { TasksService } from './tasks.service'
import type { Task } from './task.types'
import TasksPage from './TasksPage'

vi.mock('./tasks.service', () => ({ createTasksService: vi.fn() }))
const original: Task = { id: 'one', title: 'Preparar entrega', description: 'Revisar documentación.', status: 'pending', createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000) }
let service: TasksService
let emit: (tasks: Task[]) => void
const routers: ReturnType<typeof createMemoryRouter>[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function setup() {
  const router = createMemoryRouter([
    { path: '/tareas', element: <AuthContext value={{ user: { uid: 'alice', email: null }, status: 'ready', error: null }}><TasksPage /></AuthContext> },
    { path: '/other', element: <h1>Otra sección</h1> },
  ], { initialEntries: ['/tareas'] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  act(() => emit([original]))
  return { router, user: userEvent.setup() }
}

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nueva tarea' }))
  return within(screen.getByRole('dialog', { name: 'Nueva tarea' }))
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  const dialog = within(screen.getByRole('dialog'))
  await user.type(dialog.getByLabelText('Título (obligatorio)'), '  Nueva tarea  ')
  await user.type(dialog.getByLabelText('Descripción (obligatorio)'), '  Descripción nueva  ')
}

beforeEach(() => {
  vi.resetAllMocks()
  service = {
    uid: 'alice', createTask: vi.fn().mockResolvedValue('new'), getTasks: vi.fn(), updateTask: vi.fn().mockResolvedValue(undefined), setTaskStatus: vi.fn().mockResolvedValue(undefined), deleteTask: vi.fn().mockResolvedValue(undefined),
    subscribeTasks: vi.fn(next => { emit = next; return vi.fn() }),
  }
  vi.mocked(createTasksService).mockReturnValue(service)
})
afterEach(() => { routers.splice(0).forEach(router => router.dispose()) })

describe('CRUD desde la interfaz', () => {
  it('abre con foco en título y cierra sin cambios restaurando el foco', async () => {
    const { user } = setup()
    const dialog = await openCreate(user)
    expect(dialog.getByLabelText('Título (obligatorio)')).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog.getByRole('button', { name: 'Cerrar formulario' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog.getByRole('button', { name: 'Crear tarea' })).toHaveFocus()
    await user.tab()
    expect(dialog.getByRole('button', { name: 'Cerrar formulario' })).toHaveFocus()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toHaveFocus()
  })

  it('rechaza campos vacíos o con espacios antes de escribir', async () => {
    const { user } = setup()
    const dialog = await openCreate(user)
    await user.type(dialog.getByLabelText('Título (obligatorio)'), '  ')
    await user.type(dialog.getByLabelText('Descripción (obligatorio)'), '  ')
    await user.click(dialog.getByRole('button', { name: 'Crear tarea' }))
    expect(dialog.getByLabelText('Título (obligatorio)')).toHaveFocus()
    expect(dialog.getByLabelText('Título (obligatorio)')).toBeInvalid()
    expect(dialog.getByLabelText('Descripción (obligatorio)')).toBeInvalid()
    expect(service.createTask).not.toHaveBeenCalled()
  })

  it('espera el guardado, bloquea envíos duplicados y no inventa tareas locales', async () => {
    const { user } = setup()
    const request = deferred<string>()
    vi.mocked(service.createTask).mockReturnValue(request.promise)
    const dialog = await openCreate(user)
    await fill(user)
    fireEvent.submit(dialog.getByRole('form'))
    fireEvent.submit(dialog.getByRole('form'))
    expect(service.createTask).toHaveBeenCalledTimes(1)
    expect(service.createTask).toHaveBeenCalledWith({ title: 'Nueva tarea', description: 'Descripción nueva' })
    expect(dialog.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => { request.resolve('new') })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Tarea creada.')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    act(() => emit([{ ...original, id: 'new', title: 'Nueva tarea' }, original]))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('mantiene los campos y muestra un fallo de creación sin cerrar', async () => {
    const { user } = setup()
    vi.mocked(service.createTask).mockRejectedValue({ code: 'permission-denied' })
    const dialog = await openCreate(user)
    await fill(user)
    await user.click(dialog.getByRole('button', { name: 'Crear tarea' }))
    expect(dialog.getByRole('status')).toHaveTextContent('No tenés permiso')
    expect(dialog.getByLabelText('Título (obligatorio)')).toHaveValue('  Nueva tarea  ')
    expect(dialog.getByRole('button', { name: 'Crear tarea' })).toBeEnabled()
  })

  it('precarga la edición, detecta cambios y guarda solo el contenido', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Editar: Preparar entrega' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Editar tarea' }))
    expect(dialog.getByLabelText('Título (obligatorio)')).toHaveValue(original.title)
    expect(dialog.getByLabelText('Descripción (obligatorio)')).toHaveValue(original.description)
    expect(dialog.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.clear(dialog.getByLabelText('Título (obligatorio)'))
    await user.type(dialog.getByLabelText('Título (obligatorio)'), 'Entrega revisada')
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))
    expect(service.updateTask).toHaveBeenCalledWith('one', { title: 'Entrega revisada', description: original.description })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar: Preparar entrega' })).toHaveFocus()
  })

  it('conserva el borrador si falla la edición', async () => {
    const { user } = setup()
    vi.mocked(service.updateTask).mockRejectedValue({ code: 'unavailable' })
    await user.click(screen.getByRole('button', { name: 'Editar: Preparar entrega' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Descripción (obligatorio)'), ' Cambio')
    await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }))
    expect(dialog.getByRole('status')).toHaveTextContent('Revisá tu conexión')
    expect(dialog.getByLabelText('Descripción (obligatorio)')).toHaveValue(`${original.description} Cambio`)
  })

  it('confirma cambios sin guardar y permite seguir editando o descartarlos', async () => {
    const { user } = setup()
    await openCreate(user)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('¿Descartar los cambios?')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Seguir editando' })).toHaveFocus()
    await user.click(dialog.getByRole('button', { name: 'Seguir editando' }))
    expect(dialog.getByLabelText('Título (obligatorio)')).toHaveValue('  Nueva tarea  ')
    await user.click(dialog.getByRole('button', { name: 'Cerrar formulario' }))
    await user.click(dialog.getByRole('button', { name: 'Descartar cambios' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(service.createTask).not.toHaveBeenCalled()
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(false)
  })

  it('advierte al recargar y bloquea la navegación SPA hasta confirmar', async () => {
    const { user, router } = setup()
    await openCreate(user)
    await fill(user)
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await act(async () => { await router.navigate('/other') })
    expect(router.state.location.pathname).toBe('/tareas')
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    await act(async () => { await router.navigate('/other') })
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    expect(await screen.findByRole('heading', { name: 'Otra sección' })).toBeInTheDocument()
  })

  it('cambia el estado solo después de confirmar el hook y actualiza filtros por snapshot', async () => {
    const { user } = setup()
    const request = deferred<void>()
    vi.mocked(service.setTaskStatus).mockReturnValue(request.promise)
    await user.click(screen.getByRole('button', { name: 'Pendientes: 1 tarea' }))
    await user.click(screen.getByRole('button', { name: 'Completar: Preparar entrega' }))
    expect(screen.getByText('Pendiente', { selector: '.task-status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completar: Preparar entrega' })).toBeDisabled()
    expect(screen.queryByText('Tarea marcada como completada.')).not.toBeInTheDocument()
    await act(async () => { request.resolve() })
    act(() => emit([{ ...original, status: 'completed' }]))
    expect(screen.getByText('No hay tareas pendientes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Completadas: 1 tarea' }))
    vi.mocked(service.setTaskStatus).mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: 'Marcar pendiente: Preparar entrega' }))
    expect(service.setTaskStatus).toHaveBeenLastCalledWith('one', 'pending')
  })

  it('mantiene bloqueada la navegación durante el guardado y permanece en tareas al confirmar', async () => {
    const { user, router } = setup()
    const request = deferred<string>()
    vi.mocked(service.createTask).mockReturnValue(request.promise)
    await openCreate(user)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }))
    await act(async () => { await router.navigate('/other') })
    expect(screen.getByText('Guardado en curso')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar cambios' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seguir esperando' }))
    await act(async () => { request.resolve('new') })
    expect(router.state.location.pathname).toBe('/tareas')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bloquea envíos duplicados al editar mientras espera confirmación', async () => {
    const { user } = setup()
    const request = deferred<void>()
    vi.mocked(service.updateTask).mockReturnValue(request.promise)
    await user.click(screen.getByRole('button', { name: 'Editar: Preparar entrega' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Título (obligatorio)'), ' revisada')
    fireEvent.submit(dialog.getByRole('form'))
    fireEvent.submit(dialog.getByRole('form'))
    expect(service.updateTask).toHaveBeenCalledTimes(1)
    expect(dialog.getByLabelText('Título (obligatorio)')).toBeDisabled()
    await act(async () => { request.resolve() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra fallos de estado sin anunciar éxito', async () => {
    const { user } = setup()
    vi.mocked(service.setTaskStatus).mockRejectedValue({ code: 'unavailable' })
    await user.click(screen.getByRole('button', { name: 'Completar: Preparar entrega' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Revisá tu conexión')
    expect(screen.getByText('Pendiente', { selector: '.task-status' })).toBeInTheDocument()
    expect(screen.queryByText('Tarea marcada como completada.')).not.toBeInTheDocument()
  })

  it('cancela la eliminación sin escribir y restaura foco', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Eliminar: Preparar entrega' }))
    const dialog = within(screen.getByRole('dialog', { name: '¿Eliminar esta tarea?' }))
    expect(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(dialog.getByRole('button', { name: 'Cancelar' }))
    expect(service.deleteTask).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Eliminar: Preparar entrega' })).toHaveFocus()
  })

  it('confirma una sola eliminación y mantiene el diálogo abierto hasta la respuesta', async () => {
    const { user } = setup()
    const request = deferred<void>()
    vi.mocked(service.deleteTask).mockReturnValue(request.promise)
    await user.click(screen.getByRole('button', { name: 'Eliminar: Preparar entrega' }))
    const dialog = within(screen.getByRole('dialog'))
    const button = dialog.getByRole('button', { name: 'Eliminar tarea' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(service.deleteTask).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(dialog.getByRole('button', { name: 'Eliminando…' })).toBeDisabled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => { emit([]); request.resolve() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Tarea eliminada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toHaveFocus()
  })

  it('mantiene la tarea y la confirmación si falla la eliminación', async () => {
    const { user } = setup()
    vi.mocked(service.deleteTask).mockRejectedValue({ code: 'permission-denied' })
    await user.click(screen.getByRole('button', { name: 'Eliminar: Preparar entrega' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Eliminar tarea' }))
    expect(dialog.getByRole('status')).toHaveTextContent('No tenés permiso')
    expect(dialog.getByRole('button', { name: 'Eliminar tarea' })).toBeEnabled()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
