import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getFirebaseAuth } from '../../lib/firebase'
import SummaryOidcCheck from './SummaryOidcCheck'

vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: vi.fn() }))

const token = 'private-test-token'
const uid = 'private-test-uid'
const getIdToken = vi.fn()
const fetchMock = vi.fn()
let auth: { currentUser: { uid: string; getIdToken: typeof getIdToken } | null }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  auth = { currentUser: { uid, getIdToken } }
  vi.mocked(getFirebaseAuth).mockReturnValue(auth as ReturnType<typeof getFirebaseAuth>)
  getIdToken.mockResolvedValue(token)
})

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const button = () => screen.getByRole('button', { name: 'Verificar acceso al resumen' })
async function check() {
  render(<SummaryOidcCheck uid={uid} />)
  await userEvent.click(button())
}

it('protege la solicitud y muestra solo el resultado sin datos ni credenciales', async () => {
  const log = vi.spyOn(console, 'log')
  const error = vi.spyOn(console, 'error')
  fetchMock.mockResolvedValue(Response.json({ user: { uid }, tasks: [{ title: 'private-task' }] }))
  await check()
  expect(getIdToken).toHaveBeenCalledOnce()
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/summary', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
  })
  expect(screen.getByRole('status')).toHaveTextContent('Acceso al resumen verificado para la sesión actual. HTTP 200')
  expect(screen.getByRole('status')).not.toHaveTextContent(/private-test|private-task/)
  expect(log).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
})

it('evita la solicitud si no hay usuario en el SDK', async () => {
  auth.currentUser = null
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('SESSION_UNAVAILABLE')
  expect(getIdToken).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('evita la solicitud si falla el SDK al obtener el token', async () => {
  getIdToken.mockRejectedValue(new Error(token))
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('TOKEN_UNAVAILABLE')
  expect(screen.getByRole('status')).not.toHaveTextContent(token)
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([[401, 'INVALID_TOKEN'], [500, 'INTERNAL_ERROR']])('muestra HTTP %i y solo el código público %s', async (status, code) => {
  fetchMock.mockResolvedValue(Response.json({ error: { code, message: token } }, { status }))
  await check()
  expect(screen.getByRole('status')).toHaveTextContent(`HTTP ${status} ${code}`)
  expect(screen.getByRole('status')).not.toHaveTextContent(token)
})

it('descarta códigos desconocidos y mensajes de la respuesta', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: { code: token, message: token } }, { status: 502 }))
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('HTTP 502 UNEXPECTED_RESPONSE')
  expect(screen.getByRole('status')).not.toHaveTextContent(token)
})

it('rechaza una redirección sin leer su cuerpo', async () => {
  const json = vi.fn()
  fetchMock.mockResolvedValue({ redirected: true, json })
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('UNEXPECTED_REDIRECT')
  expect(json).not.toHaveBeenCalled()
})

it('sanitiza el rechazo de Fetch, incluido redirect:error', async () => {
  fetchMock.mockRejectedValue(new TypeError(token))
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('REQUEST_FAILED')
  expect(screen.getByRole('status')).not.toHaveTextContent(token)
})

it('rechaza un HTTP 200 para otro UID sin mostrarlo', async () => {
  fetchMock.mockResolvedValue(Response.json({ user: { uid: 'foreign-uid' } }))
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('HTTP 200 UID_MISMATCH')
  expect(screen.getByRole('status')).not.toHaveTextContent('foreign-uid')
})

it('anuncia la carga y evita solicitudes simultáneas', async () => {
  let resolve!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(done => { resolve = done }))
  await check()
  expect(screen.getByRole('status')).toHaveTextContent('Verificando acceso')
  expect(button()).toBeDisabled()
  expect(button()).toHaveAttribute('aria-busy', 'true')
  await userEvent.click(button())
  expect(fetchMock).toHaveBeenCalledOnce()
  resolve(Response.json({ user: { uid } }))
  expect(await screen.findByText(/Acceso al resumen verificado/)).toHaveTextContent('HTTP 200')
  expect(button()).toBeEnabled()
})

it('verifica AWS con la sesión, sin enviar UID ni mostrar datos de STS', async () => {
  fetchMock.mockResolvedValue(Response.json({ ok: true, Arn: 'private-arn', uid }))
  render(<SummaryOidcCheck uid={uid} kind="aws" />)
  await userEvent.click(screen.getByRole('button', { name: 'Verificar conexión AWS' }))
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/summary/aws-check', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
  })
  expect(screen.getByRole('status')).toHaveTextContent('Identidad AWS verificada. HTTP 200')
  expect(screen.getByRole('status')).not.toHaveTextContent(/private-/)
})

it.each([
  [403, { error: { code: 'FORBIDDEN', details: token } }, 'FORBIDDEN'],
  [502, { error: { code: token } }, 'UNEXPECTED_RESPONSE'],
  [200, { ok: false }, 'UNEXPECTED_RESPONSE'],
])('muestra solo el resultado público de AWS para HTTP %i', async (status, body, code) => {
  fetchMock.mockResolvedValue(Response.json(body, { status }))
  render(<SummaryOidcCheck uid={uid} kind="aws" />)
  await userEvent.click(screen.getByRole('button', { name: 'Verificar conexión AWS' }))
  expect(screen.getByRole('status')).toHaveTextContent(`HTTP ${status} ${code}`)
  expect(screen.getByRole('status')).not.toHaveTextContent(token)
})

it('solicita la prueba de la guarda sin enviar un UID, base ni ruta al servidor', async () => {
  fetchMock.mockResolvedValue(Response.json({ ok: true }))
  render(<SummaryOidcCheck uid={uid} kind="guard" />)
  await userEvent.click(screen.getByRole('button', { name: 'Verificar guarda Firestore' }))
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/summary/guard-check', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
  })
  expect(screen.getByRole('status')).toHaveTextContent('Guarda Firestore verificada. HTTP 200')
})
