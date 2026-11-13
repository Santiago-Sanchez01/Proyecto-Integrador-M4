import { Link, Navigate, Route, Routes } from 'react-router'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import JornadaPage from '../features/jornada/JornadaPage'
import TasksPage from '../features/tasks/TasksPage'
import SummaryPage from '../features/summary/SummaryPage'
import DesignSystemPreview from './DesignSystemPreview'

export default function App() {
  return (
    <>
      <header>
        <p>Workspace</p>
        <nav aria-label="Navegación principal">
          <ul>
            <li><Link to="/login">Iniciar sesión</Link></li>
            <li><Link to="/register">Crear cuenta</Link></li>
            <li><Link to="/jornada">Mi Jornada</Link></li>
            <li><Link to="/tareas">Mis tareas</Link></li>
            <li><Link to="/resumen">Mi resumen</Link></li>
          </ul>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/jornada" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/jornada" element={<JornadaPage />} />
          <Route path="/tareas" element={<TasksPage />} />
          <Route path="/resumen" element={<SummaryPage />} />
          <Route path="*" element={<h1>Página no encontrada</h1>} />
        </Routes>
        <DesignSystemPreview />
      </main>
    </>
  )
}
