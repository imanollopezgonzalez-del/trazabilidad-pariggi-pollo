// src/pages/Pedidos.jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listClientes } from '../services/clientes'
import { listPedidos } from '../services/pedidos'
import PedidoForm from '../components/PedidoForm'
import HistorialPedidos from '../components/HistorialPedidos'
import { useAuth } from '../contexts/AuthContext'

export default function Pedidos({ empresa, permiteLote, permiteAdjuntos }) {
  const { clienteId } = useParams()
  const { tieneAcceso, puedeCrear } = useAuth()
  const [clienteNombre, setClienteNombre] = useState('')
  const [pedidos, setPedidos] = useState([])

  const autorizado = tieneAcceso(empresa, clienteId)
  const permiteFactura = empresa === 'pollococido' && clienteId === 'grandwich'

  useEffect(() => {
    if (!autorizado) return
    let vigente = true
    listClientes(empresa).then((items) => {
      if (!vigente) return
      const c = items.find((i) => i.id === clienteId)
      setClienteNombre(c?.nombre ?? clienteId)
    })
    return () => { vigente = false }
  }, [empresa, clienteId, autorizado])

  async function reload() {
    if (!autorizado || !clienteNombre) return
    setPedidos(await listPedidos(empresa, clienteNombre, clienteId))
  }

  useEffect(() => { reload() }, [clienteNombre])

  if (!autorizado) {
    return <p className="text-gray-500">No tenés acceso a este cliente.</p>
  }

  return (
    <div className="grid gap-6">
      <Link to={`/${empresa}`} className="text-sm text-gray-500 hover:underline">← Volver a clientes</Link>
      <h1 className="text-xl font-semibold text-dark">{clienteNombre}</h1>
      {puedeCrear && (
        <PedidoForm
          empresa={empresa}
          cliente={clienteNombre}
          clienteId={clienteId}
          permiteLote={permiteLote}
          permiteAdjuntos={permiteAdjuntos}
          permiteFactura={permiteFactura}
          onSaved={reload}
        />
      )}
      <h2 className="font-medium text-dark">Pedidos cargados</h2>
      <HistorialPedidos
        empresa={empresa}
        pedidos={pedidos}
        permiteLote={permiteLote}
        permiteAdjuntos={permiteAdjuntos}
        permiteFactura={permiteFactura}
        onChange={reload}
      />
    </div>
  )
}
