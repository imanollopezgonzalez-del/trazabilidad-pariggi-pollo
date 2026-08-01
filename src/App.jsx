import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { seedCatalogoSiVacio } from './services/productos'
import Login from './pages/Login'
import Layout from './components/Layout'
import Empresas from './pages/Empresas'
import ClienteSelector from './pages/ClienteSelector'
import Pedidos from './pages/Pedidos'
import Ajustes from './pages/Ajustes'

function Gate() {
  const { status } = useAuth()

  useEffect(() => {
    if (status !== 'authorized') return
    seedCatalogoSiVacio('pariggi')
    seedCatalogoSiVacio('pollococido')
  }, [status])

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>
  }
  if (status !== 'authorized') {
    return <Login />
  }
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Empresas />} />
          <Route path="/pariggi" element={<ClienteSelector empresa="pariggi" />} />
          <Route
            path="/pariggi/:clienteId"
            element={<Pedidos empresa="pariggi" permiteLote={false} permiteAdjuntos={false} mostrarExportarPdf={true} />}
          />
          <Route path="/pollococido" element={<ClienteSelector empresa="pollococido" />} />
          <Route
            path="/pollococido/:clienteId"
            element={<Pedidos empresa="pollococido" permiteLote={true} permiteAdjuntos={true} mostrarExportarPdf={false} />}
          />
          <Route path="/ajustes" element={<Ajustes />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
