import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import { getFirebaseAuth } from '../../lib/firebase'
import type { SummaryErrorCode } from '../../../shared/summary.types'
import { awsStsCheckErrorCodes } from '../../../shared/aws-sts-check.types'

type Result = { message: string; status?: number; code?: string }
const publicCodes: readonly SummaryErrorCode[] = [
  'METHOD_NOT_ALLOWED', 'UNAUTHENTICATED', 'INVALID_TOKEN', 'SUMMARY_TOO_LARGE', 'INTERNAL_ERROR',
]

const diagnostics = {
  firebase: { path: '/api/summary', button: 'Verificar acceso al resumen', label: 'Verificación del acceso al resumen', publicCodes },
  aws: { path: '/api/summary/aws-check', button: 'Verificar conexión AWS', label: 'Verificación de la conexión AWS', publicCodes: awsStsCheckErrorCodes },
}
type Diagnostic = keyof typeof diagnostics

async function runCheck(uid: string, signal: AbortSignal, kind: Diagnostic): Promise<Result> {
  const diagnostic = diagnostics[kind]
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  const sessionChanged = { message: 'La sesión cambió o ya no está disponible.', code: 'SESSION_UNAVAILABLE' }
  if (!user || user.uid !== uid) return sessionChanged

  let token: string
  try { token = await user.getIdToken() }
  catch { return { message: 'No pudimos verificar la sesión.', code: 'TOKEN_UNAVAILABLE' } }
  if (auth.currentUser !== user) return sessionChanged
  signal.throwIfAborted()

  const response = await fetch(diagnostic.path, {
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
  const data: { ok?: unknown; user?: { uid?: unknown }; error?: { code?: unknown } } | null = await response.json().catch(() => null)
  if (auth.currentUser !== user) return sessionChanged
  if (response.status !== 200) {
    return {
      message: 'La verificación no se completó.',
      status: response.status,
      code: diagnostic.publicCodes.find(code => code === data?.error?.code) ?? 'UNEXPECTED_RESPONSE',
    }
  }
  if (kind === 'aws') {
    return data?.ok === true
      ? { message: 'Identidad AWS verificada.', status: 200 }
      : { message: 'La respuesta no tiene el formato esperado.', status: 200, code: 'UNEXPECTED_RESPONSE' }
  }
  if (typeof data?.user?.uid !== 'string') {
    return { message: 'La respuesta no tiene el formato esperado.', status: 200, code: 'UNEXPECTED_RESPONSE' }
  }
  if (data.user.uid !== uid) {
    return { message: 'La identidad de la respuesta no coincide con la sesión.', status: 200, code: 'UID_MISMATCH' }
  }
  return { message: 'Acceso al resumen verificado para la sesión actual.', status: 200 }
}

export default function SummaryOidcCheck({ uid, kind = 'firebase' }: { uid: string; kind?: Diagnostic }) {
  const diagnostic = diagnostics[kind]
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
      const checked = await runCheck(uid, controller.signal, kind)
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

  return <section aria-label={diagnostic.label}>
    <Button variant="secondary" disabled={pending} aria-busy={pending || undefined} onClick={() => { void verify() }}>
      {diagnostic.button}
    </Button>
    <p role="status">
      {pending ? 'Verificando acceso…' : result && [result.message, result.status && `HTTP ${result.status}`, result.code].filter(Boolean).join(' ')}
    </p>
  </section>
}
