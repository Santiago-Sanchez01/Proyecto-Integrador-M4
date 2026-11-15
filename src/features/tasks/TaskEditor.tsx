import { useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useBlocker } from 'react-router'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import type { Task, TaskContent } from './task.types'
import { taskErrorMessage } from './tasks.errors'
import TaskModal from './TaskModal'

type TaskEditorProps = {
  task: Task | null
  onSave: (content: TaskContent) => Promise<unknown>
  onSaved: () => void
  onClose: () => void
  fallbackFocus: RefObject<HTMLButtonElement | null>
}

export default function TaskEditor({ task, onSave, onSaved, onClose, fallbackFocus }: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [closing, setClosing] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const dirty = title !== (task?.title ?? '') || description !== (task?.description ?? '')
  const blocker = useBlocker(dirty || pending)
  const confirming = closing || blocker.state === 'blocked'

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!dirty && !pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])
  useEffect(() => {
    if (confirming) continueRef.current?.focus()
    else titleRef.current?.focus()
  }, [confirming])

  function keepEditing() {
    setClosing(false)
    if (blocker.state === 'blocked') blocker.reset()
  }
  function requestClose() {
    if (lock.current) return
    if (confirming) keepEditing()
    else if (dirty) setClosing(true)
    else onClose()
  }

  return (
    <TaskModal drawer titleId={titleId} initialFocus={titleRef} fallbackFocus={fallbackFocus} onRequestClose={requestClose}>
      <header className="task-modal__header"><h2 id={titleId}>{task ? 'Editar tarea' : 'Nueva tarea'}</h2><Button variant="secondary" disabled={pending} onClick={requestClose} aria-label={confirming ? 'Volver al formulario' : 'Cerrar formulario'}>{confirming ? 'Volver' : 'Cerrar'}</Button></header>
      {confirming ? (
        <div className="task-discard">
          <h3>{pending ? 'Guardado en curso' : '¿Descartar los cambios?'}</h3>
          <p>{pending ? 'Esperá a que se confirme la operación antes de salir.' : 'Los cambios que no guardaste se perderán.'}</p>
          <div className="task-modal__actions">
            <Button ref={continueRef} variant="secondary" onClick={keepEditing}>{pending ? 'Seguir esperando' : 'Seguir editando'}</Button>
            {!pending && <Button variant="danger" onClick={() => { if (blocker.state === 'blocked') blocker.proceed(); else onClose() }}>Descartar cambios</Button>}
          </div>
        </div>
      ) : (
        <form className="task-form" aria-label={task ? 'Editar tarea' : 'Nueva tarea'} aria-busy={pending} noValidate onSubmit={async event => {
          event.preventDefault()
          if (lock.current) return
          const next = { title: !title.trim() ? 'El título es obligatorio.' : undefined, description: !description.trim() ? 'La descripción es obligatoria.' : undefined }
          setErrors(next)
          setError('')
          if (next.title || next.description) { setError('Revisá los campos obligatorios.'); (next.title ? titleRef : descriptionRef).current?.focus(); return }
          if (task && !dirty) return
          lock.current = true
          setPending(true)
          try { await onSave({ title: title.trim(), description: description.trim() }); if (mounted.current) onSaved() }
          catch (failure) { if (mounted.current) setError(taskErrorMessage(failure)) }
          finally { lock.current = false; if (mounted.current) setPending(false) }
        }}>
          <p className="task-modal__hint">{task ? 'Actualizá el título y la descripción de tu tarea.' : 'Dale un título y contanos qué necesitás hacer.'}</p>
          <Input ref={titleRef} label="Título" name="title" required disabled={pending} value={title} error={errors.title} onChange={event => { setTitle(event.target.value); setErrors(current => ({ ...current, title: undefined })); setError('') }} />
          <Textarea ref={descriptionRef} label="Descripción" name="description" required rows={8} disabled={pending} value={description} error={errors.description} onChange={event => { setDescription(event.target.value); setErrors(current => ({ ...current, description: undefined })); setError('') }} />
          <p role="status" className="task-form__status">{pending ? 'Guardando tarea…' : error || (dirty ? 'Tenés cambios sin guardar.' : '')}</p>
          <footer className="task-modal__actions task-form__footer"><Button variant="secondary" disabled={pending} onClick={requestClose}>Cancelar</Button><Button type="submit" disabled={pending || (task !== null && !dirty)}>{pending ? 'Guardando…' : task ? 'Guardar cambios' : 'Crear tarea'}</Button></footer>
        </form>
      )}
    </TaskModal>
  )
}
