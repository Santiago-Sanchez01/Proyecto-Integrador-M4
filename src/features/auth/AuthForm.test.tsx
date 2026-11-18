import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { login, observeSession, register } from './auth.service'

vi.mock('./auth.service', () => ({ observeSession: vi.fn(), login: vi.fn(), register: vi.fn(), loginWithGoogle: vi.fn(), logout: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(observeSession).mockImplementation(onChange => { onChange(null); return vi.fn() })
  vi.mocked(login).mockRejectedValue({ code: 'auth/network-request-failed' })
  vi.mocked(register).mockRejectedValue({ code: 'auth/network-request-failed' })
})

function renderAuth(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('Interfaz de autenticación', () => {
  it('valida los campos vacíos y enfoca el primer error', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(screen.getByLabelText('Email (obligatorio)')).toHaveFocus()
    expect(screen.getByLabelText('Email (obligatorio)')).toBeInvalid()
    expect(screen.getByLabelText('Email (obligatorio)')).toHaveAccessibleDescription('Ingresá tu email.')
    expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveAccessibleDescription('Ingresá tu contraseña.')
    expect(screen.getByRole('status')).toHaveTextContent('Revisá los campos')
  })

  it('rechaza emails inválidos y permite corregir el error', async () => {
    const user = userEvent.setup()
    renderAuth()
    const email = screen.getByLabelText('Email (obligatorio)')
    await user.type(email, 'incorrecto')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(email).toHaveAccessibleDescription('Ingresá un email válido.')
    await user.clear(email)
    await user.type(email, 'persona@example.com')
    expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('valida longitud y confirmación de contraseña en registro', async () => {
    const user = userEvent.setup()
    renderAuth('/register')
    await user.type(screen.getByLabelText('Email (obligatorio)'), 'persona@example.com')
    const password = screen.getByLabelText('Contraseña (obligatorio)')
    const confirmation = screen.getByLabelText('Confirmar contraseña (obligatorio)')
    await user.type(password, 'corta')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(password).toHaveFocus()
    expect(password).toBeInvalid()
    expect(confirmation).toHaveAccessibleDescription('Confirmá tu contraseña.')
    await user.clear(password)
    await user.type(password, 'clave-larga')
    await user.type(confirmation, 'otra-clave')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(confirmation).toHaveFocus()
    expect(confirmation).toHaveAccessibleDescription('Las contraseñas no coinciden.')
  })

  it.each(['/login', '/register'])('envía %s al servicio y presenta un fallo de conexión sin redirigir', async path => {
    const user = userEvent.setup()
    renderAuth(path)
    await user.type(screen.getByLabelText('Email (obligatorio)'), 'persona@example.com')
    await user.type(screen.getByLabelText('Contraseña (obligatorio)'), 'clave-larga')
    if (path === '/register') await user.type(screen.getByLabelText('Confirmar contraseña (obligatorio)'), 'clave-larga')
    const title = path === '/register' ? 'Crear cuenta' : 'Iniciar sesión'
    await user.click(screen.getByRole('button', { name: title }))
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(await screen.findByText('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.')).toBeInTheDocument()
    expect(path === '/register' ? register : login).toHaveBeenCalledWith('persona@example.com', 'clave-larga')
    expect(screen.queryByRole('navigation', { name: 'Secciones de Workspace' })).not.toBeInTheDocument()
  })

  it('navega entre formularios sin conservar las credenciales', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.type(screen.getByLabelText('Email (obligatorio)'), 'persona@example.com')
    await user.type(screen.getByLabelText('Contraseña (obligatorio)'), 'clave-larga')
    await user.click(screen.getByRole('link', { name: 'Crear cuenta' }))
    expect(screen.getByLabelText('Email (obligatorio)')).toHaveValue('')
    expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveValue('')
    expect(screen.getByLabelText('Confirmar contraseña (obligatorio)')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Iniciar sesión' }))
    expect(screen.queryByLabelText('Confirmar contraseña (obligatorio)')).not.toBeInTheDocument()
  })

  it('permite completar y enviar el login con teclado', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.tab()
    expect(screen.getByLabelText('Email (obligatorio)')).toHaveFocus()
    await user.keyboard('persona@example.com')
    await user.tab()
    expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveFocus()
    expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveAttribute('autocomplete', 'current-password')
    await user.keyboard('clave-larga')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.')).toBeInTheDocument()
  })
})
