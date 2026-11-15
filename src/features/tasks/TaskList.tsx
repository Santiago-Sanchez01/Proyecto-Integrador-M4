import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import type { Task } from './task.types'

export type TaskActions = { onEdit: (task: Task) => void; onDelete: (task: Task) => void; onToggle: (task: Task) => void; busy: boolean; changingId: string | null }

export default function TaskList({ tasks, actions }: { tasks: Task[]; actions?: TaskActions }) {
  return (
    <ul className="tasks-list" role="list" aria-label="Tareas">
      {tasks.map(task => (
        <li key={task.id}>
          <Card className="task-card">
            <div className="task-card__heading">
              <h2>{task.title}</h2>
              <span className={`task-status task-status--${task.status}`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  {task.status === 'completed' ? <path d="m4 10 4 4 8-8" /> : <circle cx="10" cy="10" r="6" />}
                </svg>
                {task.status === 'completed' ? 'Completada' : 'Pendiente'}
              </span>
            </div>
            <p className="task-card__description">{task.description}</p>
            {actions && <div className="task-card__actions">
              <Button variant="secondary" disabled={actions.busy} aria-busy={actions.changingId === task.id} aria-label={`${task.status === 'pending' ? 'Completar' : 'Marcar pendiente'}: ${task.title}`} onClick={() => actions.onToggle(task)}>{actions.changingId === task.id ? 'Actualizando…' : task.status === 'pending' ? 'Completar' : 'Marcar pendiente'}</Button>
              <Button variant="secondary" disabled={actions.busy} aria-label={`Editar: ${task.title}`} onClick={() => actions.onEdit(task)}>Editar</Button>
              <Button variant="danger" disabled={actions.busy} aria-label={`Eliminar: ${task.title}`} onClick={() => actions.onDelete(task)}>Eliminar</Button>
            </div>}
          </Card>
        </li>
      ))}
    </ul>
  )
}
