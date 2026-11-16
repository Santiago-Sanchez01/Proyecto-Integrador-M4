import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'react'
import type { Task } from '../tasks/task.types'
import JornadaView from './JornadaView'

function task(id: string, status: Task['status'] = 'pending'): Task {
  return { id, title: `Tarea ${id}`, description: `Descripción ${id}`, status, createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) }
}

function dashboard(props: Partial<ComponentProps<typeof JornadaView>> = {}) {
  return render(<MemoryRouter initialEntries={['/jornada']}><Routes>
    <Route path="/jornada" element={<JornadaView tasks={[]} loading={false} error={null} focusTaskId={null} focusLoading={false} focusError={null} {...props} />} />
    <Route path="/tareas" element={<h1>Administración de tareas</h1>} />
  </Routes></MemoryRouter>)
}

const focusSection = () => screen.getByRole('region', { name: 'Tu tarea en foco' })
const pendingSection = () => screen.getByRole('region', { name: 'Otras tareas pendientes' })

describe('Mi Jornada: visualización', () => {
  it('muestra el inicio vacío y progreso cero sin dividir por cero', () => {
    dashboard()
    expect(screen.getByText('Tu jornada está por empezar')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progreso de tareas' })).toHaveAttribute('value', '0')
    expect(screen.getByText('0 de 0 tareas completadas.')).toBeInTheDocument()
    expect(screen.getByText('0%', { selector: 'span' })).toBeInTheDocument()
  })

  it('no elige automáticamente la primera pendiente cuando no hay foco', () => {
    dashboard({ tasks: [task('primera'), task('segunda')] })
    expect(within(focusSection()).getByText('Sin foco seleccionado')).toBeInTheDocument()
    expect(within(focusSection()).queryByText('Tarea primera')).not.toBeInTheDocument()
    expect(within(pendingSection()).getAllByRole('listitem')).toHaveLength(2)
  })

  it('presenta título, descripción, estado y prioridad del foco sin acciones de escritura', () => {
    dashboard({ tasks: [task('foco')], focusTaskId: 'foco' })
    expect(within(focusSection()).getByRole('heading', { level: 3, name: 'Tarea foco' })).toBeInTheDocument()
    expect(within(focusSection()).getByText('Descripción foco')).toBeInTheDocument()
    expect(within(focusSection()).getByText('Pendiente')).toBeInTheDocument()
    expect(within(focusSection()).getByText('Tu prioridad actual')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('excluye el foco y las completadas, conserva el orden y limita a tres pendientes', () => {
    dashboard({ tasks: [task('hecha', 'completed'), task('tercera'), task('foco'), task('primera'), task('segunda'), task('cuarta')], focusTaskId: 'foco' })
    expect(within(pendingSection()).getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Tarea tercera', 'Tarea primera', 'Tarea segunda'])
    expect(screen.getAllByText('Tarea foco')).toHaveLength(1)
    expect(screen.queryByText('Tarea hecha')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarea cuarta')).not.toBeInTheDocument()
  })

  it.each([{ tasks: [] }, { tasks: [task('otra')] }, { tasks: [task('foco', 'completed')] }])('muestra sincronización si el foco todavía no está disponible: %j', ({ tasks }) => {
    dashboard({ tasks, focusTaskId: 'foco' })
    expect(within(focusSection()).getByRole('status')).toHaveTextContent('Sincronizando')
    expect(within(focusSection()).queryByText('Sin foco seleccionado')).not.toBeInTheDocument()
    expect(within(focusSection()).queryByText('Tarea foco')).not.toBeInTheDocument()
  })

  it('calcula totales y redondea el porcentaje para mostrarlo', () => {
    dashboard({ tasks: [task('1'), task('2'), task('3', 'completed')] })
    for (const [label, count] of [['Total', '3'], ['Pendientes', '2'], ['Completadas', '1']]) {
      expect(screen.getByText(label).parentElement).toHaveTextContent(`${label}${count}`)
    }
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '33')
    expect(screen.getByRole('progressbar')).toHaveAccessibleDescription('1 de 3 tareas completadas.')
  })

  it('muestra progreso completo y ausencia de pendientes', () => {
    dashboard({ tasks: [task('hecha', 'completed')] })
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100')
    expect(screen.getByText('No tenés tareas pendientes.')).toBeInTheDocument()
  })

  it('distingue una única pendiente enfocada de una lista totalmente completada', () => {
    dashboard({ tasks: [task('foco')], focusTaskId: 'foco' })
    expect(screen.getByText('No tenés otras tareas pendientes.')).toBeInTheDocument()
  })

  it('oculta datos y métricas durante la carga de tareas', () => {
    dashboard({ loading: true, tasks: [task('anterior')] })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus tareas')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarea anterior')).not.toBeInTheDocument()
  })

  it('mantiene las métricas visibles mientras carga únicamente el foco', () => {
    dashboard({ focusLoading: true, tasks: [task('1')] })
    expect(within(focusSection()).getByRole('status')).toHaveTextContent('Cargando tu tarea en foco')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('comunica un error de tareas sin mostrar estadísticas falsas', () => {
    dashboard({ error: 'No pudimos conectarnos.' })
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('aísla el error de foco y mantiene las tareas y el progreso disponibles', () => {
    dashboard({ focusError: 'Error al leer el foco.', tasks: [task('1')] })
    expect(within(focusSection()).getByRole('alert')).toHaveTextContent('Error al leer el foco.')
    expect(within(pendingSection()).getByText('Tarea 1')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('permite navegar a Mis tareas con teclado', async () => {
    const user = userEvent.setup()
    dashboard()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Administrar mis tareas' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Administración de tareas' })).toBeInTheDocument()
  })
})
