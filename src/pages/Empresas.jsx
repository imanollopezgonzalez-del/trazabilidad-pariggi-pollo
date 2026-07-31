import { Link } from 'react-router-dom'

export default function Empresas() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
      <Link to="/pariggi" className="bg-white rounded-xl shadow p-8 text-center hover:shadow-md">
        <h2 className="text-lg font-semibold text-dark">Pastas Pariggi</h2>
        <p className="text-sm text-gray-500 mt-1">Cliente: Cedisur</p>
      </Link>
      <Link to="/pollococido" className="bg-white rounded-xl shadow p-8 text-center hover:shadow-md">
        <h2 className="text-lg font-semibold text-dark">Pollo Cocido</h2>
        <p className="text-sm text-gray-500 mt-1">Cliente: Grandwich</p>
      </Link>
    </div>
  )
}
