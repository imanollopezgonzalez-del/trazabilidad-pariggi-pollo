import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listClientes } from '../services/clientes'
import { listPedidos } from '../services/pedidos'
import PedidoForm from '../components/PedidoForm'
import HistorialPedidos from '../components/HistorialPedidos'
import { exportPariggiPdf } from '../utils/pdfExportPariggi'

export default function Pedidos({ empresa, permiteLote, permiteAdjuntos, mostrarExportarPdf }) {
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
      <h1 className="text-xl font-semibold text-dark">{clienteNombre}</h1>
      <PedidoForm empresa={empresa} cliente={clienteNombre} permiteLote={permiteLote} permiteAdjuntos={permiteAdjuntos} onSaved={reload} />
      <div className="flex justify-between items-center">
        <h2 className="font-medium text-dark">Pedidos cargados</h2>
        {mostrarExportarPdf && (
          <button
            onClick={() => exportPariggiPdf(pedidos, clienteNombre)}
            className="text-sm bg-dark text-white rounded-lg px-4 py-2"
          >
            Exportar PDF
          </button>
        )}
      </div>
      <HistorialPedidos empresa={empresa} pedidos={pedidos} permiteLote={permiteLote} permiteAdjuntos={permiteAdjuntos} onChange={reload} />
    </div>
  )
}
