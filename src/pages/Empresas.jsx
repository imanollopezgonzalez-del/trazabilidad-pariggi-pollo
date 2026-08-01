import { Link } from 'react-router-dom'
import logoPariggi from '../assets/logo-pariggi.png'
import logoPollo from '../assets/logo-pollococido.png'

export default function Empresas() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
      <Link to="/pariggi" className="bg-white rounded-xl shadow p-8 flex flex-col items-center gap-3 hover:shadow-md">
        <img src={logoPariggi} alt="Pastas Pariggi" className="h-20 object-contain" />
        <h2 className="text-lg font-semibold text-dark">Pastas Pariggi</h2>
      </Link>
      <Link to="/pollococido" className="bg-white rounded-xl shadow p-8 flex flex-col items-center gap-3 hover:shadow-md">
        <img src={logoPollo} alt="Pollo Cocido" className="h-20 object-contain" />
        <h2 className="text-lg font-semibold text-dark">Pollo Cocido</h2>
      </Link>
    </div>
  )
}
