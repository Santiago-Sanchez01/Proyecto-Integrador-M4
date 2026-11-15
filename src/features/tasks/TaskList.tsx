import Card from '../../components/ui/Card'
import type { Task } from './task.types'

export default function TaskList({ tasks }: { tasks: Task[] }) {
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
          </Card>
        </li>
      ))}
    </ul>
  )
}
