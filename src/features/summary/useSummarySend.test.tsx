import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/useAuth'
import type { AuthState } from '../auth/AuthContext'
import { requestSummarySend, SummarySendClientError } from './summary-send.api'
import { useSummarySend } from './useSummarySend'
import SummaryView from './SummaryView'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('./summary-send.api', async original => ({ ...await original<typeof import('./summary-send.api')>(), requestSummarySend: vi.fn() }))
let auth: AuthState
function Harness() {
  const send = useSummarySend()
  return <MemoryRouter><SummaryView tasks={[]} loading={false} error={null} email={auth.user?.email ?? null} onRetry={() => {}} send={send} /></MemoryRouter>
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('VITE_SUMMARY_EMAIL_ENABLED', 'true')
  auth = { status: 'ready', user: { uid: 'alice', email: 'alice@example.invalid' }, error: null }
  vi.mocked(useAuth).mockImplementation(() => auth)
  vi.mocked(requestSummarySend).mockImplementation(async (_uid, requestId) => ({ status: 'accepted', requestId }))
})
afterEach(() => vi.unstubAllEnvs())

it('no envía al montar, remontar, cargar datos o iniciar sesión', () => {
  const view = render(<Harness />)
  view.rerender(<Harness />)
  expect(requestSummarySend).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toBeEnabled()
})
it.each([undefined, 'false'])('mantiene desactivado el botón sin disponibilidad explícita: %j', flag => {
  vi.stubEnv('VITE_SUMMARY_EMAIL_ENABLED', flag)
  render(<Harness />)
  const button = screen.getByRole('button', { name: 'Enviar resumen a mi correo' })
  expect(button).toBeDisabled(); expect(button).toHaveAccessibleDescription(/deshabilitado/)
  expect(requestSummarySend).not.toHaveBeenCalled()
})
it('deshabilita cuando falta el correo', () => {
  auth = { ...auth, user: { uid: 'alice', email: null } }
  render(<Harness />)
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toBeDisabled()
})
it('permite teclado, anuncia loading y solo confirma aceptación después de la respuesta; evita doble clic', async () => {
  let finish!: () => void
  vi.mocked(requestSummarySend).mockImplementation((_uid, requestId) => new Promise(resolve => { finish = () => resolve({ status: 'accepted', requestId }) }))
  const user = userEvent.setup()
  render(<Harness />)
  await user.tab(); await user.tab()
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toHaveFocus()
  await user.keyboard('{Enter}')
  const button = screen.getByRole('button', { name: 'Solicitando envío…' })
  expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('Solicitando')
  await user.dblClick(button)
  expect(requestSummarySend).toHaveBeenCalledOnce()
  expect(requestSummarySend).toHaveBeenCalledWith('alice', expect.stringMatching(/^[0-9a-f-]{36}$/), expect.any(AbortSignal))
  await act(async () => finish())
  expect(screen.getByRole('status')).toHaveTextContent('aceptado para envío')
  expect(screen.getByRole('status')).not.toHaveTextContent('entregado')
})
it.each(['EMAIL_NOT_VERIFIED', 'PROVIDER_UNAVAILABLE', 'INVALID_TOKEN', 'SEND_LIMITED'] as const)('explica %s sin éxito prematuro', async code => {
  vi.mocked(requestSummarySend).mockRejectedValue(new SummarySendClientError(code))
  const user = userEvent.setup(); render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Enviar resumen a mi correo' }))
  expect(screen.getByRole('alert')).toHaveTextContent(new SummarySendClientError(code).message)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toBeEnabled()
})
it('bloquea otro intento después de un resultado incierto', async () => {
  vi.mocked(requestSummarySend).mockRejectedValue(new SummarySendClientError('SEND_STATUS_UNKNOWN'))
  const user = userEvent.setup(); render(<Harness />)
  const button = screen.getByRole('button', { name: 'Enviar resumen a mi correo' })
  await user.click(button); await user.click(button)
  expect(screen.getByRole('alert')).toHaveTextContent('No lo repitas por ahora')
  expect(button).toBeDisabled(); expect(requestSummarySend).toHaveBeenCalledOnce()
})
it('cancela la espera y descarta resultados de la cuenta anterior sin mostrar su correo o éxito', async () => {
  let finish!: () => void
  vi.mocked(requestSummarySend).mockImplementation((_uid, requestId) => new Promise(resolve => { finish = () => resolve({ status: 'accepted', requestId }) }))
  const user = userEvent.setup(), view = render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Enviar resumen a mi correo' }))
  const signal = vi.mocked(requestSummarySend).mock.calls[0][2]!
  auth = { ...auth, user: { uid: 'bob', email: 'bob@example.invalid' } }
  view.rerender(<Harness />)
  expect(signal.aborted).toBe(true)
  await act(async () => finish())
  expect(screen.queryByText('alice@example.invalid')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar resumen a mi correo' })).toBeEnabled()
})
it('limpia la espera al desmontar y no vuelve a enviar', async () => {
  vi.mocked(requestSummarySend).mockImplementation(() => new Promise(() => {}))
  const user = userEvent.setup(), view = render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Enviar resumen a mi correo' }))
  const signal = vi.mocked(requestSummarySend).mock.calls[0][2]!
  view.unmount()
  expect(signal.aborted).toBe(true); expect(requestSummarySend).toHaveBeenCalledOnce()
})
