import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { status, login } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold text-dark mb-2">Trazabilidad Pariggi / Pollo Cocido</h1>
        <p className="text-sm text-gray-500 mb-6">Ingresá con tu cuenta de Google autorizada.</p>
        {status === 'unauthorized' && (
          <p className="text-sm text-red-600 mb-4">
            Tu cuenta no tiene acceso a esta herramienta. Pedile a Imanol que te agregue.
          </p>
        )}
        <button
          onClick={login}
          className="w-full bg-orange text-white rounded-lg py-2 font-medium hover:opacity-90"
        >
          Ingresar con Google
        </button>
      </div>
    </div>
  )
}
