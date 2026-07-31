import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'

function Gate() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>
  }
  if (status !== 'authorized') {
    return <Login />
  }
  return <div className="p-8">Sesión iniciada. Rutas reales se agregan en la Tarea 8.</div>
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
