import { useTasks } from '../tasks/useTasks'
import { useTaskFocus } from '../tasks/useTaskFocus'
import JornadaView from './JornadaView'

export default function JornadaPage() {
  const { tasks, loading, error } = useTasks()
  const focus = useTaskFocus()
  return <JornadaView tasks={tasks} loading={loading} error={error} focusTaskId={focus.focusTaskId} focusLoading={focus.loading} focusError={focus.error} />
}
