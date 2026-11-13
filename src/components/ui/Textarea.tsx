import { useId } from 'react'
import type { ComponentPropsWithRef } from 'react'
import './ui.css'

type TextareaProps = ComponentPropsWithRef<'textarea'> & {
  label: string
  helpText?: string
  error?: string
}

export default function Textarea({ label, helpText, error, id, className = '', rows = 4, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: TextareaProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const description = [describedBy, helpText && `${fieldId}-help`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className="ui-field">
      <label htmlFor={fieldId}>{`${label}${props.required ? ' (obligatorio)' : ''}`}</label>
      <textarea {...props} id={fieldId} rows={rows} className={`ui-control ${className}`} aria-invalid={error ? true : invalid} aria-describedby={description} />
      {helpText && <p className="ui-help" id={`${fieldId}-help`}>{helpText}</p>}
      {error && <p className="ui-error" id={`${fieldId}-error`}>{error}</p>}
    </div>
  )
}
