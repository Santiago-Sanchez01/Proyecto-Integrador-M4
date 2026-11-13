import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Navegación provisional', () => {
  it('redirige el inicio a Mi Jornada y permite navegar a Mis tareas', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Mi Jornada' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Mis tareas' }))
    expect(screen.getByRole('heading', { name: 'Mis tareas' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mi Jornada' })).not.toBeInTheDocument()
  })

  it.each([
    ['/login', 'Iniciar sesión'],
    ['/register', 'Crear cuenta'],
    ['/jornada', 'Mi Jornada'],
    ['/tareas', 'Mis tareas'],
    ['/resumen', 'Mi resumen'],
    ['/desconocida', 'Página no encontrada'],
  ])('renderiza la ruta %s', (path, title) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
