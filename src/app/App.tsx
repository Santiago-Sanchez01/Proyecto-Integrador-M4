import { Link, Navigate, Route, Routes } from 'react-router'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import JornadaPage from '../features/jornada/JornadaPage'
import TasksPage from '../features/tasks/TasksPage'
import SummaryPage from '../features/summary/SummaryPage'
import AppLayout from './AppLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/jornada" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/jornada" element={<JornadaPage />} />
        <Route path="/tareas" element={<TasksPage />} />
        <Route path="/resumen" element={<SummaryPage />} />
      </Route>
      <Route path="/login" element={<main className="public-page"><LoginPage /><Link to="/register">Crear cuenta</Link></main>} />
      <Route path="/register" element={<main className="public-page"><RegisterPage /><Link to="/login">Iniciar sesión</Link></main>} />
      <Route path="*" element={<main className="public-page"><h1>Página no encontrada</h1><Link to="/jornada">Ir a Mi Jornada</Link></main>} />
    </Routes>
  )
}
