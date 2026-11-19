import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import { getFirebaseAuth } from '../../lib/firebase'
import type { SummaryErrorCode } from '../../../shared/summary.types'

type Result = { message: string; status?: number; code?: string }
const publicCodes: readonly SummaryErrorCode[] = [
  'METHOD_NOT_ALLOWED', 'UNAUTHENTICATED', 'INVALID_TOKEN', 'SUMMARY_TOO_LARGE', 'INTERNAL_ERROR',
]

async function checkSummary(uid: string, signal: AbortSignal): Promise<Result> {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  const sessionChanged = { message: 'La sesión cambió o ya no está disponible.', code: 'SESSION_UNAVAILABLE' }
  if (!user || user.uid !== uid) return sessionChanged

  let token: string
  try { token = await user.getIdToken() }
  catch { return { message: 'No pudimos verificar la sesión.', code: 'TOKEN_UNAVAILABLE' } }
  if (auth.currentUser !== user) return sessionChanged
  signal.throwIfAborted()

  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal,
  })
  if (response.redirected || response.type === 'opaqueredirect') {
    return { message: 'Se rechazó una redirección inesperada.', code: 'UNEXPECTED_REDIRECT' }
  }
  const data: { user?: { uid?: unknown }; error?: { code?: unknown } } | null = await response.json().catch(() => null)
  if (auth.currentUser !== user) return sessionChanged
  if (response.status !== 200) {
    return {
      message: 'La verificación no se completó.',
      status: response.status,
      code: publicCodes.find(code => code === data?.error?.code) ?? 'UNEXPECTED_RESPONSE',
    }
  }
  if (typeof data?.user?.uid !== 'string') {
    return { message: 'La respuesta no tiene el formato esperado.', status: 200, code: 'UNEXPECTED_RESPONSE' }
  }
  if (data.user.uid !== uid) {
    return { message: 'La identidad de la respuesta no coincide con la sesión.', status: 200, code: 'UID_MISMATCH' }
  }
  return { message: 'Acceso al resumen verificado para la sesión actual.', status: 200 }
}

export default function SummaryOidcCheck({ uid }: { uid: string }) {
  const request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => () => {
    request.current?.abort()
    request.current = null
  }, [])

  async function verify() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setResult(null)
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const checked = await checkSummary(uid, controller.signal)
      controller.signal.throwIfAborted()
      if (request.current === controller) setResult(checked)
    } catch {
      if (request.current === controller) setResult(controller.signal.aborted
        ? { message: 'La verificación excedió el tiempo de espera.', code: 'REQUEST_TIMEOUT' }
        : { message: 'No se pudo completar la solicitud.', code: 'REQUEST_FAILED' })
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) {
        request.current = null
        setPending(false)
      }
    }
  }

  return <section aria-label="Verificación del acceso al resumen">
    <Button variant="secondary" disabled={pending} aria-busy={pending || undefined} onClick={() => { void verify() }}>
      Verificar acceso al resumen
    </Button>
    <p role="status">
      {pending ? 'Verificando acceso…' : result && [result.message, result.status && `HTTP ${result.status}`, result.code].filter(Boolean).join(' ')}
    </p>
  </section>
}
