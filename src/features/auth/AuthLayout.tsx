import { Outlet } from 'react-router'
import './auth.css'

export default function AuthLayout() {
  return (
    <main className="auth-layout">
      <section className="auth-visual" aria-label="Workspace, tu espacio personal">
        <p className="auth-wordmark">Workspace<span aria-hidden="true">.</span></p>
        <div className="auth-story">
          <p className="auth-eyebrow">MENOS RUIDO. MÁS FOCO.</p>
          <h2>Tu trabajo,<br />a tu ritmo.</h2>
          <p>Organizá tus tareas, seguí tu progreso y mantené el control de tu jornada.</p>
        </div>
        <p className="auth-visual__footer">Un espacio para avanzar a tu manera.</p>
      </section>
      <section className="auth-panel" aria-label="Acceso a Workspace">
        <p className="auth-wordmark auth-wordmark--mobile">Workspace<span aria-hidden="true">.</span></p>
        <div className="auth-panel__content"><Outlet /></div>
      </section>
    </main>
  )
}
