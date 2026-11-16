import { Link } from 'react-router'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import type { Task } from '../tasks/task.types'
import './summary.css'

type SummaryViewProps = {
  tasks: Task[]
  loading: boolean
  error: string | null
  email: string | null
  onRetry: () => void
}

export default function SummaryView({ tasks, loading, error, email, onRetry }: SummaryViewProps) {
  const pending = tasks.filter(task => task.status === 'pending').length
  const completed = tasks.length - pending
  const progress = tasks.length === 0 ? 0 : Math.round(completed / tasks.length * 100)

  return (
    <div className="summary">
      <div className="summary__navigation"><Link className="ui-button ui-button--secondary summary__link" to="/tareas">Administrar mis tareas</Link></div>
      <div className="summary__overview">
        <section aria-labelledby="summary-progress-title">
          <Card>
            <h2 id="summary-progress-title">Estado actual de tus tareas</h2>
            {error ? <>
              <div role="alert"><p>No pudimos cargar tu resumen.</p><p>{error}</p></div>
              <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
            </> : loading ? <p role="status">Cargando tu resumen…</p> : <>
              <dl className="summary__metrics">
                <div><dt>Total</dt><dd>{tasks.length}</dd></div>
                <div><dt>Pendientes</dt><dd>{pending}</dd></div>
                <div><dt>Completadas</dt><dd>{completed}</dd></div>
              </dl>
              <div className="summary__progress-label"><span>Progreso general</span><strong>{progress}%</strong></div>
              <progress aria-label="Progreso general" aria-describedby="summary-progress-description" max={100} value={progress}>{progress}%</progress>
              <p id="summary-progress-description">{completed} de {tasks.length} tareas completadas.</p>
            </>}
          </Card>
        </section>
        <section aria-labelledby="summary-email-title">
          <Card>
            <h2 id="summary-email-title">Tu resumen por correo</h2>
            <p>Podrás enviar el estado actual de todas tus tareas al correo de tu cuenta.</p>
            {email ? <p className="summary__email"><span>Correo de tu cuenta</span><strong>{email}</strong></p> : <p>No hay un correo disponible en tu cuenta.</p>}
            <Button disabled aria-describedby="summary-email-availability">Enviar resumen a mi correo</Button>
            <p id="summary-email-availability" className="summary__availability">Disponible próximamente. El envío de correos todavía no está habilitado.</p>
          </Card>
        </section>
      </div>
      {!loading && !error && <section aria-labelledby="summary-tasks-title">
        <h2 id="summary-tasks-title">Tus tareas actuales</h2>
        {tasks.length === 0 ? <Card><h3>Todavía no tenés tareas</h3><p>Podés crear y organizar tus tareas desde Mis tareas.</p></Card> : <Card className="summary__list-card">
          <ul className="summary__list" role="list" aria-label="Todas tus tareas">
            {tasks.map(task => <li key={task.id}>
              <div className="summary__task-heading"><h3>{task.title}</h3><span className={`summary__status summary__status--${task.status}`}>{task.status === 'completed' ? 'Completada' : 'Pendiente'}</span></div>
              <p className="summary__description">{task.description}</p>
            </li>)}
          </ul>
        </Card>}
      </section>}
    </div>
  )
}
