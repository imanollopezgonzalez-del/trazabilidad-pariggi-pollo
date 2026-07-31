import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold text-dark">Trazabilidad</Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Link to="/ajustes" className="hover:underline">Ajustes</Link>
          <span>{user?.email}</span>
          <button onClick={logout} className="text-orange hover:underline">Salir</button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
