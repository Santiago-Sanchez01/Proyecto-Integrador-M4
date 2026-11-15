import { useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import TaskList from './TaskList'
import type { Task, TaskStatus } from './task.types'
import './tasks.css'

type TasksViewProps = {
  tasks: Task[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

type TaskFilter = 'all' | TaskStatus

export default function TasksView({ tasks, loading, error, onRetry }: TasksViewProps) {
  const [filter, setFilter] = useState<TaskFilter>('all')

  if (loading) {
    return <section className="tasks-view" aria-label="Listado de tareas"><Card className="tasks-state"><p role="status">Cargando tus tareas…</p></Card></section>
  }

  if (error) {
    return (
      <section className="tasks-view" aria-label="Listado de tareas">
        <Card className="tasks-state">
          <div role="alert"><h2>No pudimos cargar tus tareas</h2><p>{error}</p></div>
          <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
        </Card>
      </section>
    )
  }

  const pending = tasks.filter(task => task.status === 'pending').length
  const filters: Array<{ value: TaskFilter; label: string; count: number }> = [
    { value: 'all', label: 'Todas', count: tasks.length },
    { value: 'pending', label: 'Pendientes', count: pending },
    { value: 'completed', label: 'Completadas', count: tasks.length - pending },
  ]
  const visibleTasks = filter === 'all' ? tasks : tasks.filter(task => task.status === filter)

  return (
    <section className="tasks-view" aria-label="Listado de tareas">
      <fieldset className="tasks-filters">
        <legend>Mostrar tareas</legend>
        <div className="tasks-filters__buttons">
          {filters.map(({ value, label, count }) => (
            <Button key={value} variant="secondary" className="tasks-filter" aria-label={`${label}: ${count} ${count === 1 ? 'tarea' : 'tareas'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              <span>{label}</span><span className="tasks-filter__count">{count}</span>
            </Button>
          ))}
        </div>
      </fieldset>
      <p className="tasks-result" role="status" aria-live="polite" aria-atomic="true">
        {visibleTasks.length === 1 ? 'Mostrando 1 tarea' : `Mostrando ${visibleTasks.length} tareas`}
        {filter === 'pending' ? (visibleTasks.length === 1 ? ' pendiente' : ' pendientes') : filter === 'completed' ? (visibleTasks.length === 1 ? ' completada' : ' completadas') : ''}
        {filter !== 'all' ? ` de ${tasks.length} en total.` : ' en total.'}
      </p>
      {tasks.length === 0 ? (
        <Card className="tasks-state"><h2>Todavía no tenés tareas</h2><p>Cuando tengas tareas, vas a encontrarlas acá.</p></Card>
      ) : visibleTasks.length === 0 ? (
        <Card className="tasks-state">
          <h2>{filter === 'completed' ? 'No hay tareas completadas' : 'No hay tareas pendientes'}</h2>
          <p>Podés cambiar el filtro para ver el resto de tus tareas.</p>
          <Button variant="secondary" onClick={() => setFilter('all')}>Ver todas</Button>
        </Card>
      ) : <TaskList tasks={visibleTasks} />}
    </section>
  )
}
