import { useEffect, useRef, useState } from 'react'
import { useTasks } from './useTasks'
import TasksView from './TasksView'
import Button from '../../components/ui/Button'
import { useAuth } from '../auth/useAuth'
import type { Task, TaskContent, TaskStatus } from './task.types'
import TaskEditor from './TaskEditor'
import DeleteTaskDialog from './DeleteTaskDialog'
import { taskErrorMessage } from './tasks.errors'

function TasksContent({ onRetry }: { onRetry: () => void }) {
  const { tasks, loading, error, isMutating, createTask, updateTask, setTaskStatus, deleteTask } = useTasks()
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [changingId, setChangingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState('')
  const newButton = useRef<HTMLButtonElement>(null)
  const lock = useRef(false)
  const mounted = useRef(false)
  const pendingFocus = useRef<{ id: string; status: TaskStatus; element: Element | null } | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const target = pendingFocus.current
    if (!isMutating && target && tasks.some(task => task.id === target.id && task.status === target.status)) {
      if (!target.element?.isConnected) newButton.current?.focus()
      pendingFocus.current = null
    }
  }, [tasks, isMutating, feedback])

  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    if (lock.current) throw new Error('Task operation already pending.')
    lock.current = true
    try { return await operation() } finally { lock.current = false }
  }

  async function changeStatus(task: Task) {
    if (lock.current) return
    const next = task.status === 'pending' ? 'completed' : 'pending'
    const element = document.activeElement
    setChangingId(task.id)
    setFeedback('')
    setActionError('')
    try {
      await execute(() => setTaskStatus(task.id, next))
      if (mounted.current) {
        pendingFocus.current = { id: task.id, status: next, element }
        setFeedback(next === 'completed' ? 'Tarea marcada como completada.' : 'Tarea devuelta a pendientes.')
      }
    } catch (failure) { if (mounted.current) setActionError(taskErrorMessage(failure)) }
    finally { if (mounted.current) setChangingId(null) }
  }

  return (
    <section className="tasks-workspace" aria-label="Gestión de tareas">
      <div className="tasks-page-actions"><Button ref={newButton} disabled={loading || !!error || isMutating} onClick={() => { if (!lock.current) { setFeedback(''); setActionError(''); setEditor({ task: null }) } }}>Nueva tarea</Button></div>
      {(feedback || actionError) && <p className="tasks-operation-message" role={actionError ? 'alert' : 'status'}>{actionError || feedback}</p>}
      <TasksView tasks={tasks} loading={loading} error={error} onRetry={onRetry} actions={{ busy: isMutating, changingId, onEdit: task => { if (!lock.current) { setFeedback(''); setActionError(''); setEditor({ task }) } }, onDelete: task => { if (!lock.current) { setFeedback(''); setActionError(''); setDeleting(task) } }, onToggle: task => { void changeStatus(task) } }} />
      {editor && <TaskEditor task={editor.task} fallbackFocus={newButton} onClose={() => setEditor(null)} onSave={(content: TaskContent) => execute<unknown>(() => editor.task ? updateTask(editor.task.id, content) : createTask(content))} onSaved={() => { setEditor(null); setFeedback(editor.task ? 'Cambios guardados.' : 'Tarea creada.') }} />}
      {deleting && <DeleteTaskDialog task={deleting} fallbackFocus={newButton} onClose={() => setDeleting(null)} onDelete={() => execute(() => deleteTask(deleting.id))} onDeleted={() => { setDeleting(null); setFeedback('Tarea eliminada.') }} />}
    </section>
  )
}

export default function TasksPage() {
  const [attempt, setAttempt] = useState(0)
  const { user } = useAuth()
  return <TasksContent key={`${user?.uid ?? 'anonymous'}-${attempt}`} onRetry={() => setAttempt(current => current + 1)} />
}
