import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthState } from './AuthContext'
import { observeSession } from './auth.service'
import { authErrorMessage } from './auth.errors'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading', error: null })

  useEffect(() => {
    let active = true
    const fail = (error: unknown) => {
      if (active) setState({ user: null, status: 'error', error: authErrorMessage(error) })
    }
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = observeSession(user => {
        if (active) setState({ user, status: 'ready', error: null })
      }, fail)
    } catch (error) {
      fail(error)
    }
    return () => { active = false; unsubscribe?.() }
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}
