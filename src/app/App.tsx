import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import JornadaPage from '../features/jornada/JornadaPage'
import SummaryPage from '../features/summary/SummaryPage'
import AppLayout from './AppLayout'
import AuthLayout from '../features/auth/AuthLayout'
import AuthProvider from '../features/auth/AuthProvider'
import ProtectedRoute from './ProtectedRoute'
import GuestRoute from '../features/auth/GuestRoute'

const TasksPage = lazy(() => import('../features/tasks/TasksPage'))

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/jornada" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/jornada" element={<JornadaPage />} />
            <Route path="/tareas" element={<Suspense fallback={<p role="status">Cargando tus tareas…</p>}><TasksPage /></Suspense>} />
            <Route path="/resumen" element={<SummaryPage />} />
          </Route>
        </Route>
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>
        <Route path="*" element={<main className="public-page"><h1>Página no encontrada</h1><Link to="/jornada">Ir a Mi Jornada</Link></main>} />
      </Routes>
    </AuthProvider>
  )
}
