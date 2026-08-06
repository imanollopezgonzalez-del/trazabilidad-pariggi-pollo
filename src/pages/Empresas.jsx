// src/pages/Empresas.jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoPariggi from '../assets/logo-pariggi.png'
import logoPollo from '../assets/logo-pollococido.png'

const EMPRESAS = [
  { id: 'pariggi', nombre: 'Pastas Pariggi', logo: logoPariggi },
  { id: 'pollococido', nombre: 'Pollo Cocido', logo: logoPollo },
]

export default function Empresas() {
  const { tieneAlgunAcceso } = useAuth()
  const visibles = EMPRESAS.filter((e) => tieneAlgunAcceso(e.id))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
      {visibles.map((e) => (
        <Link key={e.id} to={`/${e.id}`} className="bg-white rounded-xl shadow p-8 flex flex-col items-center gap-3 hover:shadow-md">
          <img src={e.logo} alt={e.nombre} className="h-20 object-contain" />
          <h2 className="text-lg font-semibold text-dark">{e.nombre}</h2>
        </Link>
      ))}
      {visibles.length === 0 && <p className="text-gray-400">No tenés acceso a ninguna empresa todavía.</p>}
    </div>
  )
}
