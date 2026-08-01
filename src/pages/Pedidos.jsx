import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listClientes } from '../services/clientes'
import { listPedidos } from '../services/pedidos'
import PedidoForm from '../components/PedidoForm'
import HistorialPedidos from '../components/HistorialPedidos'

export default function Pedidos({ empresa, permiteLote, permiteAdjuntos }) {
  const { clienteId } = useParams()
  const [clienteNombre, setClienteNombre] = useState('')
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    listClientes(empresa).then((items) => {
      const c = items.find((i) => i.id === clienteId)
      setClienteNombre(c?.nombre ?? clienteId)
    })
  }, [empresa, clienteId])

  async function reload() {
    if (!clienteNombre) return
    setPedidos(await listPedidos(empresa, clienteNombre))
  }

  useEffect(() => { reload() }, [clienteNombre])

  return (
    <div className="grid gap-6">
      <Link to={`/${empresa}`} className="text-sm text-gray-500 hover:underline">← Volver a clientes</Link>
      <h1 className="text-xl font-semibold text-dark">{clienteNombre}</h1>
      <PedidoForm empresa={empresa} cliente={clienteNombre} permiteLote={permiteLote} permiteAdjuntos={permiteAdjuntos} onSaved={reload} />
      <h2 className="font-medium text-dark">Pedidos cargados</h2>
      <HistorialPedidos empresa={empresa} pedidos={pedidos} permiteLote={permiteLote} permiteAdjuntos={permiteAdjuntos} onChange={reload} />
    </div>
  )
}
