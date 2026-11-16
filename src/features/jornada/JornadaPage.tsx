import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useTasks } from '../tasks/useTasks'
import { useTaskFocus } from '../tasks/useTaskFocus'
import { taskErrorMessage } from '../tasks/tasks.errors'
import JornadaView from './JornadaView'

export default function JornadaPage() {
  const { user } = useAuth()
  return <JornadaSession key={user?.uid ?? 'anonymous'} />
}

function JornadaSession() {
  const tasks = useTasks()
  const focus = useTaskFocus()
  const [pending, setPending] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const locked = useRef(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function run(message: string, operation: () => Promise<void>) {
    if (locked.current || tasks.isMutating || focus.isMutating || tasks.loading || focus.loading || tasks.error || focus.error) return
    locked.current = true
    setOperationError(null)
    setPending(message)
    try { await operation() }
    catch (error) { if (active.current) setOperationError(taskErrorMessage(error)) }
    finally {
      locked.current = false
      if (active.current) setPending(null)
    }
  }

  function select(id: string) {
    if (id === focus.focusTaskId || !tasks.tasks.some(task => task.id === id && task.status === 'pending')) return
    void run('Guardando tu foco…', () => focus.selectFocus(id))
  }

  function complete() {
    const id = focus.focusTaskId
    if (!id || !tasks.tasks.some(task => task.id === id && task.status === 'pending')) return
    void run('Completando tu tarea…', () => tasks.setTaskStatus(id, 'completed'))
  }

  return <JornadaView tasks={tasks.tasks} loading={tasks.loading} error={tasks.error} focusTaskId={focus.focusTaskId} focusLoading={focus.loading} focusError={focus.error}
    actions={{ disabled: pending !== null || tasks.isMutating || focus.isMutating, pending, error: operationError, onSelect: select, onClear: () => { if (focus.focusTaskId !== null) void run('Quitando tu foco…', focus.clearFocus) }, onComplete: complete }} />
}
