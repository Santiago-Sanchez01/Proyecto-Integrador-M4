import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { login, logout, observeSession, register } from './auth.service'
import type { SessionUser } from './auth.service'
import { authDestination } from './auth.destination'

vi.mock('./auth.service', () => ({ observeSession: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() }))

const userSession = { uid: 'test-user', email: 'persona@example.com' }
let sessionChanged: (user: SessionUser | null) => void
let sessionFailed: (error: unknown) => void
const unsubscribe = vi.fn()

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname + location.search + location.hash}</span>
}

function renderApp(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(observeSession).mockImplementation((onChange, onError) => {
    sessionChanged = onChange
    sessionFailed = onError
    return unsubscribe
  })
})

async function fillForm(isRegister = false) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email (obligatorio)'), 'persona@example.com')
  await user.type(screen.getByLabelText('Contraseña (obligatorio)'), 'clave-larga')
  if (isRegister) await user.type(screen.getByLabelText('Confirmar contraseña (obligatorio)'), 'clave-larga')
  return user
}

describe('Sesión y rutas', () => {
  it('espera al observador y restaura la sesión sin pasar por login', async () => {
    renderApp('/tareas')
    expect(screen.getByRole('status')).toHaveTextContent('Restaurando tu sesión')
    expect(screen.getByTestId('location')).toHaveTextContent('/tareas')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    act(() => sessionChanged(userSession))
    expect(await screen.findByRole('heading', { name: 'Mis tareas' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
  })

  it.each(['/jornada', '/tareas', '/resumen'])('protege %s sin sesión', async path => {
    renderApp(path)
    act(() => sessionChanged(null))
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it.each(['/login', '/register'])('redirige al usuario autenticado fuera de %s', async path => {
    renderApp(path)
    act(() => sessionChanged(userSession))
    expect(await screen.findByRole('heading', { name: 'Mi Jornada' })).toBeInTheDocument()
  })

  it.each([false, true])('espera la confirmación y conserva destino al autenticar (registro: %s)', async isRegister => {
    renderApp('/resumen?vista=actual#estado')
    act(() => sessionChanged(null))
    if (isRegister) await userEvent.click(await screen.findByRole('link', { name: 'Crear cuenta' }))
    const user = await fillForm(isRegister)
    let resolveRequest!: () => void
    vi.mocked(isRegister ? register : login).mockReturnValue(new Promise<void>(resolve => { resolveRequest = resolve }))
    const title = isRegister ? 'Crear cuenta' : 'Iniciar sesión'
    await user.click(screen.getByRole('button', { name: title }))
    expect(screen.getByRole('button', { name: isRegister ? 'Creando cuenta…' : 'Iniciando sesión…' })).toBeDisabled()
    expect(screen.getByLabelText('Email (obligatorio)')).toBeDisabled()
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: isRegister ? 'Creando cuenta…' : 'Iniciando sesión…' }))
    expect(isRegister ? register : login).toHaveBeenCalledTimes(1)
    await act(async () => resolveRequest())
    // A resolved request alone is not a session; only the SDK observer grants access.
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    act(() => sessionChanged(userSession))
    expect(await screen.findByRole('heading', { name: 'Mi resumen' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/resumen?vista=actual#estado')
  })

  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/user-disabled'])('presenta un error genérico para %s', async code => {
    renderApp()
    act(() => sessionChanged(null))
    vi.mocked(login).mockRejectedValue({ code })
    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('No pudimos iniciar sesión. Revisá el email y la contraseña.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('cierra sesión solo cuando Firebase informa el cambio', async () => {
    renderApp('/tareas')
    act(() => sessionChanged(userSession))
    let resolveRequest!: () => void
    vi.mocked(logout).mockReturnValue(new Promise<void>(resolve => { resolveRequest = resolve }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(screen.getByRole('button', { name: 'Cerrando sesión…' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Mis tareas' })).toBeInTheDocument()
    await act(async () => { sessionChanged(null); resolveRequest() })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('conserva sesión y permite reintentar cuando falla logout', async () => {
    renderApp('/tareas')
    act(() => sessionChanged(userSession))
    vi.mocked(logout).mockRejectedValue({ code: 'auth/network-request-failed' })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Mis tareas' })).toBeInTheDocument()
  })

  it('maneja el fallo del observador sin mostrar contenido privado', () => {
    renderApp('/tareas')
    act(() => sessionFailed({ code: 'auth/network-request-failed' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mis tareas' })).not.toBeInTheDocument()
  })

  it('muestra la configuración faltante sin enviar solicitudes', () => {
    vi.mocked(observeSession).mockImplementation(() => { throw { code: 'auth/configuration-missing' } })
    renderApp('/login')
    expect(screen.getByRole('status')).toHaveTextContent('problema de configuración')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    expect(login).not.toHaveBeenCalled()
  })

  it('limpia la suscripción en StrictMode y al desmontar', async () => {
    const view = render(<StrictMode><MemoryRouter><App /></MemoryRouter></StrictMode>)
    await waitFor(() => expect(observeSession).toHaveBeenCalledTimes(2))
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })

  it.each(['https://example.com', '//example.com', '/login', '/tareas-maliciosas', '/tareas/../../login'])('rechaza el destino no permitido %s', from => {
    expect(authDestination({ from })).toBe('/jornada')
  })
})
