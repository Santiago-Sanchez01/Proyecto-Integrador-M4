import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import SessionStatus from '../features/auth/SessionStatus'

export default function ProtectedRoute() {
  const { user, status, error } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <SessionStatus />
  if (status === 'error') return <SessionStatus error={error} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />
  return <Outlet />
}
