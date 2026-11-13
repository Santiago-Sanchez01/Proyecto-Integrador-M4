import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { authDestination } from './auth.destination'
import SessionStatus from './SessionStatus'

export default function GuestRoute() {
  const { user, status } = useAuth()
  const { state } = useLocation()
  if (status === 'loading') return <SessionStatus />
  if (user) return <Navigate to={authDestination(state)} replace />
  return <Outlet />
}
