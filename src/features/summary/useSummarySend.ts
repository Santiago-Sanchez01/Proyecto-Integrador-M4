import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { requestSummarySend, SummarySendClientError } from './summary-send.api'

type State = { uid: string | null; phase: 'idle' | 'pending' | 'accepted' | 'error' | 'unknown'; message: string }
const empty = (uid: string | null): State => ({ uid, phase: 'idle', message: '' })
export function useSummarySend() {
  const auth = useAuth()
  const uid = auth.status === 'ready' ? auth.user?.uid ?? null : null
  const available = import.meta.env.VITE_SUMMARY_EMAIL_ENABLED === 'true'
  const [state, setState] = useState(() => empty(uid))
  const session = useRef<{ uid: string | null; active: boolean; locked: boolean; controller: AbortController | null } | null>(null)
  if (state.uid !== uid) setState(empty(uid))
  useEffect(() => {
    const current = { uid, active: true, locked: false, controller: null as AbortController | null }
    session.current = current
    return () => { current.active = false; current.controller?.abort(); if (session.current === current) session.current = null }
  }, [uid])
  async function send() {
    const current = session.current
    if (!available || !uid || !auth.user?.email || current?.uid !== uid || !current.active || current.locked) return
    current.locked = true
    setState({ uid, phase: 'pending', message: 'Solicitando el envío…' })
    try {
      current.controller = new AbortController()
      await requestSummarySend(uid, crypto.randomUUID(), current.controller.signal)
      if (current.active) setState({ uid, phase: 'accepted', message: 'Resumen aceptado para envío. La entrega al correo puede demorar.' })
    } catch (error) {
      if (current.active) {
        const failure = error instanceof SummarySendClientError ? error : new SummarySendClientError('SEND_STATUS_UNKNOWN')
        setState({ uid, phase: failure.uncertain ? 'unknown' : 'error', message: failure.message })
        if (failure.uncertain) return // Do not offer an automatic or immediate duplicate attempt.
      }
    } finally { current.controller = null }
    if (current.active) current.locked = false
  }
  const visible = state.uid === uid ? state : empty(uid)
  return { available, pending: visible.phase === 'pending', disabled: !available || !uid || !auth.user?.email || visible.phase === 'pending' || visible.phase === 'unknown',
    message: visible.message, error: visible.phase === 'error' || visible.phase === 'unknown', send }
}
