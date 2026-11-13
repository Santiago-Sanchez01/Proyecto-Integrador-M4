import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Button from './Button'
import Input from './Input'
import Textarea from './Textarea'
import Card from './Card'

describe('Componentes básicos', () => {
  it('activa botones con teclado, omite disabled y no envía formularios por defecto', async () => {
    const user = userEvent.setup()
    const click = vi.fn()
    render(<><Button onClick={click}>Guardar</Button><Button disabled onClick={click}>No disponible</Button><Button variant="danger">Eliminar</Button></>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toHaveAttribute('type', 'button')
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter} ')
    expect(click).toHaveBeenCalledTimes(2)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'No disponible' }))
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('asocia etiquetas, ayuda y error sin perder descripciones externas', async () => {
    const user = userEvent.setup()
    const ref = createRef<HTMLInputElement>()
    render(<><p id="external">Información adicional.</p><Input ref={ref} id="title" label="Título" required helpText="Ayuda del título." error="El título es obligatorio." aria-describedby="external" /><Textarea label="Descripción" helpText="Ayuda de la descripción." /></>)
    const input = screen.getByRole('textbox', { name: 'Título (obligatorio)' })
    expect(input).toBeRequired()
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription('Información adicional. Ayuda del título. El título es obligatorio.')
    expect(ref.current).toBe(input)
    await user.click(screen.getByText('Título', { exact: false, selector: 'label' }))
    expect(input).toHaveFocus()
    await user.type(input, 'Mi tarea')
    expect(input).toHaveValue('Mi tarea')
    await user.tab()
    const textarea = screen.getByRole('textbox', { name: 'Descripción' })
    expect(textarea).toHaveFocus()
    expect(textarea).toHaveAccessibleDescription('Ayuda de la descripción.')
    await user.type(textarea, 'Primera línea{Enter}Segunda línea')
    expect(textarea).toHaveValue('Primera línea\nSegunda línea')
  })

  it('genera identificadores únicos y expone el error de Textarea', () => {
    render(<><Input label="Uno" /><Input label="Dos" /><Textarea label="Detalle" error="Completá el detalle." /></>)
    expect(screen.getByLabelText('Uno').id).not.toBe(screen.getByLabelText('Dos').id)
    expect(screen.getByLabelText('Detalle')).toBeInvalid()
    expect(screen.getByLabelText('Detalle')).toHaveAccessibleDescription('Completá el detalle.')
  })

  it('preserva atributos nativos y contenido de Card', () => {
    render(<Card role="region" aria-label="Muestra" className="custom"><h2>Contenido</h2></Card>)
    expect(screen.getByRole('region', { name: 'Muestra' })).toHaveClass('ui-card', 'custom')
    expect(screen.getByRole('heading', { name: 'Contenido' })).toBeInTheDocument()
  })
})
