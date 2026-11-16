import { Link } from 'react-router'
import Card from '../../components/ui/Card'
import type { Task } from '../tasks/task.types'
import './jornada.css'

type JornadaViewProps = {
  tasks: Task[]
  loading: boolean
  error: string | null
  focusTaskId: string | null
  focusLoading: boolean
  focusError: string | null
}

function FocusContent({ focus, focusTaskId, loading, error, empty }: { focus: Task | undefined; focusTaskId: string | null; loading: boolean; error: string | null; empty: boolean }) {
  if (error) return <div role="alert"><h3>No pudimos cargar el foco</h3><p>{error}</p></div>
  if (loading) return <p role="status">Cargando tu tarea en foco…</p>
  if (focusTaskId !== null && !focus) return <p role="status">Sincronizando tu tarea en foco. Todavía no está disponible.</p>
  if (focus) return <>
    <p className="jornada__focus-label">Tu prioridad actual</p>
    <h3>{focus.title}</h3>
    <p className="jornada__description">{focus.description}</p>
    <span className="jornada__status">Pendiente</span>
  </>
  if (empty) return <><h3>Tu jornada está por empezar</h3><p>Todavía no tenés tareas. Podés crearlas en Mis tareas.</p></>
  return <><h3>Sin foco seleccionado</h3><p>Tu tarea en foco aparecerá acá cuando tengas una selección guardada.</p></>
}

export default function JornadaView({ tasks, loading, error, focusTaskId, focusLoading, focusError }: JornadaViewProps) {
  const pending = tasks.filter(task => task.status === 'pending')
  const completed = tasks.length - pending.length
  const progress = tasks.length === 0 ? 0 : Math.round(completed / tasks.length * 100)
  const focus = pending.find(task => task.id === focusTaskId)
  const others = pending.filter(task => task.id !== focusTaskId).slice(0, 3)

  return (
    <div className="jornada">
      <div className="jornada__navigation">
        <Link className="ui-button ui-button--secondary jornada__link" to="/tareas">Administrar mis tareas</Link>
      </div>
      {error ? <Card><div role="alert"><h2>No pudimos cargar tu jornada</h2><p>{error}</p></div></Card>
        : loading ? <Card><p role="status">Cargando tus tareas…</p></Card>
          : <>
            <section aria-labelledby="jornada-progress-title">
              <Card className="jornada__progress">
                <div className="jornada__section-heading"><h2 id="jornada-progress-title">Tu progreso</h2><span className="jornada__percentage">{progress}%</span></div>
                <p id="jornada-progress-description">{completed} de {tasks.length} tareas completadas.</p>
                <progress aria-label="Progreso de tareas" aria-describedby="jornada-progress-description" value={progress} max={100}>{progress}%</progress>
                <dl className="jornada__metrics">
                  <div><dt>Total</dt><dd>{tasks.length}</dd></div>
                  <div><dt>Pendientes</dt><dd>{pending.length}</dd></div>
                  <div><dt>Completadas</dt><dd>{completed}</dd></div>
                </dl>
              </Card>
            </section>
            <div className="jornada__columns">
              <section aria-labelledby="jornada-focus-title">
                <Card className="jornada__focus">
                  <h2 id="jornada-focus-title">Tu tarea en foco</h2>
                  <FocusContent focus={focus} focusTaskId={focusTaskId} loading={focusLoading} error={focusError} empty={tasks.length === 0} />
                </Card>
              </section>
              <section aria-labelledby="jornada-pending-title">
                <Card>
                  <h2 id="jornada-pending-title">Otras tareas pendientes</h2>
                  {others.length > 0 ? <ul className="jornada__pending" role="list">
                    {others.map(task => <li key={task.id}><h3>{task.title}</h3><p className="jornada__description">{task.description}</p><span className="jornada__status">Pendiente</span></li>)}
                  </ul> : <p>{pending.length > 0 ? 'No tenés otras tareas pendientes.' : tasks.length === 0 ? 'Las tareas pendientes aparecerán acá.' : 'No tenés tareas pendientes.'}</p>}
                </Card>
              </section>
            </div>
          </>}
    </div>
  )
}
