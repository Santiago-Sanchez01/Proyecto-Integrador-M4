import { useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'
import './DesignSystemPreview.css'

export default function DesignSystemPreview() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')

  return (
    <details className="ds-preview">
      <summary>Ver componentes · Midnight Copper V2</summary>
      <div className="ds-preview__grid">
        <Card>
          <h2>Botones y estados</h2>
          <div className="ds-preview__actions">
            <Button onClick={() => setMessage('Acción primaria ejecutada.')}>Primario</Button>
            <Button variant="secondary" onClick={() => setMessage('Acción secundaria ejecutada.')}>Secundario</Button>
            <Button variant="danger" onClick={() => setMessage('Acción de peligro de demostración.')}>Peligro</Button>
            <Button disabled>Deshabilitado</Button>
          </div>
          <p className="ds-preview__secondary">Texto secundario sobre superficie.</p>
          <p className="ds-preview__success">Éxito: componentes disponibles.</p>
          <p role="status">{message}</p>
        </Card>
        <Card>
          <h2>Campos de formulario</h2>
          <form className="ds-preview__form" noValidate onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            setMessage(title.trim() && description.trim() ? 'Formulario de muestra validado. No se guardaron datos.' : 'Revisá los campos obligatorios.')
          }}>
            <Input label="Título de ejemplo" required value={title} onChange={(event) => setTitle(event.target.value)} helpText="Ingresá un título para probar el campo." error={submitted && !title.trim() ? 'El título es obligatorio.' : undefined} />
            <Textarea label="Descripción de ejemplo" required value={description} onChange={(event) => setDescription(event.target.value)} helpText="Podés escribir varias líneas." error={submitted && !description.trim() ? 'La descripción es obligatoria.' : undefined} />
            <Input label="Campo deshabilitado" disabled value="Solo demostración" />
            <Button type="submit">Validar ejemplo</Button>
          </form>
        </Card>
      </div>
    </details>
  )
}
