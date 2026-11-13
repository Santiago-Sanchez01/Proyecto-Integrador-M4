import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import DesignSystemPreview from './DesignSystemPreview'

it('permite abrir la muestra por teclado y validar los campos obligatorios', async () => {
  const user = userEvent.setup()
  render(<DesignSystemPreview />)
  await user.tab()
  expect(screen.getByText('Ver componentes · Midnight Copper V2')).toHaveFocus()
  await user.keyboard('{Enter}')
  await user.click(screen.getByRole('button', { name: 'Validar ejemplo' }))
  expect(screen.getByLabelText('Título de ejemplo (obligatorio)')).toBeInvalid()
  expect(screen.getByLabelText('Descripción de ejemplo (obligatorio)')).toBeInvalid()
  await user.type(screen.getByLabelText('Título de ejemplo (obligatorio)'), 'Ejemplo')
  await user.type(screen.getByLabelText('Descripción de ejemplo (obligatorio)'), 'Descripción')
  await user.click(screen.getByRole('button', { name: 'Validar ejemplo' }))
  expect(screen.getByRole('status')).toHaveTextContent('Formulario de muestra validado. No se guardaron datos.')
})
