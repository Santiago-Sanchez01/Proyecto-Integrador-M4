import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Timestamp } from 'firebase/firestore'
import { expect, it, vi } from 'vitest'
import type { Task } from '../tasks/task.types'
import SummaryView from './SummaryView'

function task(id: string, status: Task['status'] = 'pending'): Task {
  return { id, title: `Tarea ${id}`, description: `Descripción ${id}`, status, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) }
}

function summary(props: Partial<ComponentProps<typeof SummaryView>> = {}) {
  return render(<MemoryRouter initialEntries={['/resumen']}><Routes>
    <Route path="/resumen" element={<SummaryView tasks={[]} loading={false} error={null} email="persona@example.com" onRetry={vi.fn()} {...props} />} />
    <Route path="/tareas" element={<h1>Administración de tareas</h1>} />
  </Routes></MemoryRouter>)
}

it('muestra el estado vacío con indicadores y progreso cero', () => {
  summary()
  expect(screen.getByText('Todavía no tenés tareas')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Progreso general' })).toHaveAttribute('value', '0')
  expect(screen.getByText('0 de 0 tareas completadas.')).toBeInTheDocument()
  for (const label of ['Total', 'Pendientes', 'Completadas']) expect(screen.getByText(label).parentElement).toHaveTextContent(`${label}0`)
})

it.each(['pending', 'completed'] as const)('muestra tareas %s con título, descripción y estado textual', status => {
  summary({ tasks: [task('uno', status)] })
  const list = screen.getByRole('list', { name: 'Todas tus tareas' })
  expect(within(list).getByRole('heading', { name: 'Tarea uno', level: 3 })).toBeInTheDocument()
  expect(within(list).getByText('Descripción uno')).toBeInTheDocument()
  expect(within(list).getByText(status === 'completed' ? 'Completada' : 'Pendiente')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', status === 'completed' ? '100' : '0')
})

it('calcula indicadores reales, redondea el porcentaje y conserva todas las tareas en orden', () => {
  summary({ tasks: [task('tercera'), task('primera', 'completed'), task('segunda')] })
  for (const [label, count] of [['Total', '3'], ['Pendientes', '2'], ['Completadas', '1']]) expect(screen.getByText(label).parentElement).toHaveTextContent(`${label}${count}`)
  const bar = screen.getByRole('progressbar')
  expect(bar).toHaveAttribute('value', '33')
  expect(bar).toHaveAccessibleDescription('1 de 3 tareas completadas.')
  expect(within(screen.getByRole('list')).getAllByRole('heading').map(h => h.textContent)).toEqual(['Tarea tercera', 'Tarea primera', 'Tarea segunda'])
  expect(screen.queryByRole('button', { name: /Editar|Eliminar|Completar tarea/ })).not.toBeInTheDocument()
})

it('muestra todo el listado sin limitarlo a tres tareas', () => {
  summary({ tasks: Array.from({ length: 6 }, (_, index) => task(String(index))) })
  expect(screen.getAllByRole('listitem')).toHaveLength(6)
})

it('no presenta datos anteriores ni estadísticas falsas durante la carga', () => {
  summary({ loading: true, tasks: [task('anterior')] })
  expect(screen.getByRole('status')).toHaveTextContent('Cargando tu resumen')
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.queryByText('Todavía no tenés tareas')).not.toBeInTheDocument()
})

it('comunica el error sin estadísticas y permite reintentar', async () => {
  const user = userEvent.setup()
  const retry = vi.fn()
  summary({ error: 'No pudimos conectarnos.', tasks: [task('anterior')], onRetry: retry })
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos.')
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('muestra el email autenticado y explica por qué el envío está deshabilitado', async () => {
  const user = userEvent.setup()
  summary()
  expect(screen.getByText('persona@example.com')).toBeInTheDocument()
  const send = screen.getByRole('button', { name: 'Enviar resumen a mi correo' })
  expect(send).toBeDisabled()
  expect(send).toHaveAccessibleDescription('Disponible próximamente. El envío de correos todavía no está habilitado.')
  await user.click(send)
  expect(screen.queryByText(/enviado|envío exitoso/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('contempla que la cuenta no tenga dirección de correo', () => {
  summary({ email: null })
  expect(screen.getByText('No hay un correo disponible en tu cuenta.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toBeDisabled()
})

it('mantiene la explicación de correo visible ante un error de tareas', () => {
  summary({ error: 'Error de lectura.' })
  expect(screen.getByRole('region', { name: 'Tu resumen por correo' })).toHaveTextContent('persona@example.com')
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toBeDisabled()
})

it('permite ir a Mis tareas mediante teclado y omite el botón deshabilitado', async () => {
  const user = userEvent.setup()
  summary()
  await user.tab()
  expect(screen.getByRole('link', { name: 'Administrar mis tareas' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button')).not.toHaveFocus()
  await user.tab()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('heading', { name: 'Administración de tareas' })).toBeInTheDocument()
})
