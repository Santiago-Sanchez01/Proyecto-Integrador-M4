import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useAuth } from './useAuth'
import { login, register } from './auth.service'
import { authErrorMessage } from './auth.errors'

type AuthFormProps = { mode: 'login' | 'register' }
type Errors = { email?: string; password?: string; confirmation?: string }

export default function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === 'register'
  const { status, error: sessionError } = useAuth()
  const { state } = useLocation()
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const title = isRegister ? 'Crear cuenta' : 'Iniciar sesión'

  function clearFeedback(field: keyof Errors) {
    setErrors(current => ({ ...current, [field]: undefined, ...(field === 'password' ? { confirmation: undefined } : {}) }))
    setMessage('')
  }

  return (
    <>
      <header className="auth-heading">
        <p className="auth-eyebrow">TU ESPACIO PERSONAL</p>
        <h1>{title}</h1>
        <p>{isRegister ? 'Empezá a organizar tu trabajo, a tu manera.' : 'Volvé a tu espacio y retomá tu jornada.'}</p>
      </header>
      <form className="auth-form" aria-label={title} aria-busy={pending} noValidate onSubmit={async event => {
        event.preventDefault()
        if (inFlight.current || status !== 'ready') return
        const next: Errors = {}
        if (!email.trim()) next.email = 'Ingresá tu email.'
        else if (emailRef.current?.validity.typeMismatch) next.email = 'Ingresá un email válido.'
        if (!password) next.password = 'Ingresá tu contraseña.'
        else if (isRegister && password.length < 8) next.password = 'Usá al menos 8 caracteres.'
        if (isRegister && !confirmation) next.confirmation = 'Confirmá tu contraseña.'
        else if (isRegister && confirmation !== password) next.confirmation = 'Las contraseñas no coinciden.'
        setErrors(next)
        if (Object.keys(next).length) {
          setMessage('Revisá los campos indicados para continuar.')
          if (next.email) emailRef.current?.focus()
          else if (next.password) passwordRef.current?.focus()
          else confirmationRef.current?.focus()
          return
        }
        inFlight.current = true
        setPending(true)
        setMessage(isRegister ? 'Creando tu cuenta…' : 'Iniciando sesión…')
        try {
          await (isRegister ? register : login)(email.trim(), password)
          setPassword('')
          setConfirmation('')
          // The observer confirms the session and GuestRoute performs navigation.
        } catch (error) {
          setMessage(authErrorMessage(error))
          setPending(false)
          inFlight.current = false
        }
      }}>
        <Input ref={emailRef} disabled={pending || status !== 'ready'} label="Email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} error={errors.email} onChange={event => { setEmail(event.target.value); clearFeedback('email') }} />
        <Input ref={passwordRef} disabled={pending || status !== 'ready'} label="Contraseña" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 8 : undefined} value={password} helpText={isRegister ? 'Usá al menos 8 caracteres.' : undefined} error={errors.password} onChange={event => { setPassword(event.target.value); clearFeedback('password') }} />
        {isRegister && <Input ref={confirmationRef} disabled={pending || status !== 'ready'} label="Confirmar contraseña" name="confirmation" type="password" autoComplete="new-password" required value={confirmation} error={errors.confirmation} onChange={event => { setConfirmation(event.target.value); clearFeedback('confirmation') }} />}
        <Button className="auth-submit" type="submit" disabled={pending || status !== 'ready'}>{pending ? (isRegister ? 'Creando cuenta…' : 'Iniciando sesión…') : title}</Button>
      </form>
      <p className="auth-feedback" role="status">{sessionError ?? message}</p>
      {status === 'error' && <Button variant="secondary" onClick={() => window.location.reload()}>Reintentar</Button>}
      <p className="auth-switch">{isRegister ? '¿Ya tenés una cuenta?' : '¿Todavía no tenés cuenta?'} <Link state={state} aria-disabled={pending || undefined} tabIndex={pending ? -1 : undefined} onClick={event => { if (pending) event.preventDefault() }} to={isRegister ? '/login' : '/register'}>{isRegister ? 'Iniciar sesión' : 'Crear cuenta'}</Link></p>
    </>
  )
}
