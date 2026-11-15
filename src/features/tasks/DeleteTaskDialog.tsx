import { useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import Button from '../../components/ui/Button'
import type { Task } from './task.types'
import { taskErrorMessage } from './tasks.errors'
import TaskModal from './TaskModal'

type DeleteTaskDialogProps = { task: Task; onDelete: () => Promise<void>; onDeleted: () => void; onClose: () => void; fallbackFocus: RefObject<HTMLButtonElement | null> }

export default function DeleteTaskDialog({ task, onDelete, onDeleted, onClose, fallbackFocus }: DeleteTaskDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const lock = useRef(false)
  const mounted = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  return (
    <TaskModal titleId={titleId} initialFocus={cancelRef} fallbackFocus={fallbackFocus} onRequestClose={() => { if (!lock.current) onClose() }}>
      <h2 id={titleId}>¿Eliminar esta tarea?</h2>
      <p className="task-modal__task-title">{task.title}</p>
      <p>Esta acción no se puede deshacer.</p>
      <p role="status" className="task-form__status">{pending ? 'Eliminando tarea…' : error}</p>
      <div className="task-modal__actions"><Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onClose}>Cancelar</Button><Button variant="danger" disabled={pending} onClick={async () => {
        if (lock.current) return
        lock.current = true
        setPending(true)
        setError('')
        try { await onDelete(); if (mounted.current) onDeleted() }
        catch (failure) { if (mounted.current) setError(taskErrorMessage(failure)) }
        finally { lock.current = false; if (mounted.current) setPending(false) }
      }}>{pending ? 'Eliminando…' : 'Eliminar tarea'}</Button></div>
    </TaskModal>
  )
}
