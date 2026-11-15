import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { createTaskFocusService } from './focus.service'
import { taskError, taskErrorMessage } from './tasks.errors'

function empty(uid: string | null) { return { uid, focusTaskId: null as string | null, loading: uid !== null, error: null as string | null, operationError: null as string | null, pending: 0 } }

export function useTaskFocus() {
  const auth = useAuth()
  const uid = auth.status === 'ready' ? auth.user?.uid ?? null : null
  const [state, setState] = useState(() => empty(uid))
  const session = useRef<ReturnType<typeof createTaskFocusService> | null>(null)
  if (state.uid !== uid) setState(empty(uid))
  useEffect(() => {
    let active = true
    let stop: (() => void) | undefined
    try {
      if (uid) {
        const service = createTaskFocusService()
        if (service.uid !== uid) throw taskError('session-changed')
        session.current = service
        stop = service.subscribeFocus(focusTaskId => {
          if (active) setState(current => current.uid === uid ? { ...current, focusTaskId, loading: false, error: null } : current)
        }, error => {
          if (active) setState(current => current.uid === uid ? { ...current, focusTaskId: null, loading: false, error: taskErrorMessage(error) } : current)
        })
      }
    } catch (error) {
      session.current = null
      queueMicrotask(() => { if (active) setState(current => current.uid === uid ? { ...current, loading: false, error: taskErrorMessage(error) } : current) })
    }
    return () => { active = false; session.current = null; stop?.() }
  }, [uid])

  const selectFocus = useCallback(async (id: string | null) => {
    const service = session.current
    if (!uid || service?.uid !== uid) throw taskError('session-changed')
    setState(current => current.uid === uid ? { ...current, pending: current.pending + 1, operationError: null } : current)
    try {
      await service.selectFocus(id)
      if (session.current !== service) throw taskError('session-changed')
    } catch (error) {
      if (session.current === service) setState(current => current.uid === uid ? { ...current, operationError: taskErrorMessage(error) } : current)
      throw error
    } finally {
      if (session.current === service) setState(current => current.uid === uid ? { ...current, pending: current.pending - 1 } : current)
    }
  }, [uid])
  const clearFocus = useCallback(() => selectFocus(null), [selectFocus])
  const visible = state.uid === uid ? state : empty(uid)
  return { focusTaskId: visible.focusTaskId, loading: auth.status === 'loading' || visible.loading, error: auth.status === 'error' ? auth.error : visible.error, operationError: visible.operationError, isMutating: visible.pending > 0, selectFocus, clearFocus }
}
