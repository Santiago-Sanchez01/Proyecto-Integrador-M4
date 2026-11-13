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
    expect(screen.getByRole('heading', { name: 'Mis tareas' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Mis tareas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Mi Jornada' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('heading', { name: 'Mi Jornada' })).not.toBeInTheDocument()
  })

  it.each(['/login', '/register'])('mantiene %s fuera del layout interno', (path) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    expect(screen.queryByRole('navigation', { name: 'Secciones de Workspace' })).not.toBeInTheDocument()
    expect(screen.queryByText('Saltar al contenido')).not.toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('ofrece un salto al contenido y navegación por teclado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/jornada']}><App /></MemoryRouter>)
    await user.tab()
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Mi Jornada' })).toHaveFocus()
    await user.tab()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Mi resumen' })).toHaveFocus()
    expect(screen.getByText('Una mirada al estado actual de todas tus tareas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi resumen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it.each([
    ['/jornada', 'Mi Jornada'],
    ['/tareas', 'Mis tareas'],
    ['/resumen', 'Mi resumen'],
    ['/tareas/', 'Mis tareas'],
  ])('identifica una única sección activa en %s', (path, title) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: title })).toHaveAttribute('aria-current', 'page')
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
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
