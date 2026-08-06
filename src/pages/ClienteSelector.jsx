// src/pages/ClienteSelector.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClientes, seedClientesSiVacio } from '../services/clientes'
import { useAuth } from '../contexts/AuthContext'
import logoCedisur from '../assets/logo-cedisur.jpg'
import logoGrandwich from '../assets/logo-grandwich.png'

const LOGOS = {
  cedisur: logoCedisur,
  grandwich: logoGrandwich,
}

const NOMBRES_EMPRESA = { pariggi: 'Pastas Pariggi', pollococido: 'Pollo Cocido' }

export default function ClienteSelector({ empresa }) {
  const { tieneAcceso } = useAuth()
  const [clientes, setClientes] = useState([])

  useEffect(() => {
    seedClientesSiVacio(empresa).then(() => listClientes(empresa)).then((items) =>
      setClientes(items.filter((c) => c.activo && tieneAcceso(empresa, c.id)))
    )
  }, [empresa])

  return (
    <div>
      <Link to="/" className="text-sm text-gray-500 hover:underline">← Volver a empresas</Link>
      <h1 className="text-xl font-semibold text-dark mb-4 mt-2">{NOMBRES_EMPRESA[empresa]} — Elegir cliente</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        {clientes.map((c) => (
          <Link
            key={c.id}
            to={`/${empresa}/${c.id}`}
            className="bg-white rounded-xl shadow p-8 flex flex-col items-center gap-3 hover:shadow-md"
          >
            {LOGOS[c.id] ? (
              <img src={LOGOS[c.id]} alt={c.nombre} className="h-20 object-contain" />
            ) : (
              <div className="h-20 flex items-center text-2xl font-semibold text-dark">{c.nombre}</div>
            )}
            <h2 className="text-lg font-semibold text-dark">{c.nombre}</h2>
          </Link>
        ))}
        {clientes.length === 0 && <p className="text-gray-400">Sin clientes disponibles.</p>}
      </div>
    </div>
  )
}
