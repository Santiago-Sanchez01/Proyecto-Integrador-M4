import { createContext } from 'react'
import type { SessionUser } from './auth.service'

export type AuthState = {
  user: SessionUser | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
