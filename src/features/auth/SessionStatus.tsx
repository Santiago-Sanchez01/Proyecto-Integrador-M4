import Button from '../../components/ui/Button'
import './session.css'

export default function SessionStatus({ error }: { error?: string | null }) {
  return (
    <main className="session-status" aria-busy={!error}>
      <p role={error ? 'alert' : 'status'}>{error ?? 'Restaurando tu sesión…'}</p>
      {error && <Button variant="secondary" onClick={() => window.location.reload()}>Reintentar</Button>}
    </main>
  )
}
