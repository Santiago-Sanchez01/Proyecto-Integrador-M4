import { useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import { logout } from './auth.service'
import { authErrorMessage } from './auth.errors'
import './session.css'

export default function LogoutButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  return (
    <div className="session-actions">
      <Button variant="secondary" disabled={pending} aria-busy={pending} onClick={async () => {
        if (inFlight.current) return
        inFlight.current = true
        setPending(true)
        setError('')
        try { await logout() }
        catch (error) { setError(authErrorMessage(error)) }
        finally { inFlight.current = false; setPending(false) }
      }}>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</Button>
      <p role="status">{error}</p>
    </div>
  )
}
