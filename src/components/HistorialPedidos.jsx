import { useState } from 'react'
import { format } from 'date-fns'
import { adjuntarDocumentos, eliminarPedido } from '../services/pedidos'
import { elegirDocumentosDeDrive } from '../utils/drivePicker'
import { exportPedidoPdf } from '../utils/pdfExportPedido'
import { useAuth } from '../contexts/AuthContext'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

function esUrlDeDriveValida(url) {
  return typeof url === 'string' && url.startsWith('https://drive.google.com/')
}

function AdjuntarMas({ pedido, onChange }) {
  const { user } = useAuth()
  const [eligiendo, setEligiendo] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setError('')
    setEligiendo(true)
    try {
      const elegidos = await elegirDocumentosDeDrive({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        email: user.email,
      })
      if (elegidos.length > 0) {
        await adjuntarDocumentos(pedido, elegidos)
        onChange?.()
      }
    } catch (err) {
      setError('No se pudo abrir Drive')
      console.error(err)
    } finally {
      setEligiendo(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={eligiendo} className="text-xs text-orange hover:underline disabled:opacity-40">
        {eligiendo ? 'Abriendo Drive…' : '+ Adjuntar documento'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function HistorialPedidos({ empresa, pedidos, permiteLote, permiteAdjuntos, onChange }) {
  const { isAdmin } = useAuth()

  async function handleEliminar(pedido) {
    if (!confirm('¿Eliminar este pedido y todos sus productos cargados? No se puede deshacer.')) return
    await eliminarPedido(pedido)
    onChange?.()
  }

  if (pedidos.length === 0) {
    return <p className="text-gray-400 text-center py-6">Sin pedidos todavía.</p>
  }

  return (
    <div className="grid gap-4">
      {pedidos.map((p) => (
        <div key={p.id} className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b">
            <div>
              <span className="font-semibold text-dark">Factura {p.numeroFactura}</span>
              <span className="text-sm text-gray-500 ml-3">
                {p.creadoEn ? format(toDate(p.creadoEn), 'dd/MM/yyyy HH:mm') : ''}
              </span>
              <span className="text-sm text-gray-500 ml-3">{p.creadoPor}</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => exportPedidoPdf(empresa, p, permiteLote)} className="text-xs text-orange hover:underline">
                Exportar PDF
              </button>
              {isAdmin && (
                <button onClick={() => handleEliminar(p)} className="text-xs text-red-500 hover:underline">
                  Eliminar pedido
                </button>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Producto</th>
                {permiteLote && <th className="px-4 py-2">Lote</th>}
                <th className="px-4 py-2">Fecha entrega</th>
                <th className="px-4 py-2">Fecha vencimiento</th>
                <th className="px-4 py-2">Días</th>
                <th className="px-4 py-2">Meses</th>
              </tr>
            </thead>
            <tbody>
              {(p.items ?? []).map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">{item.productoNombre}</td>
                  {permiteLote && <td className="px-4 py-2">{item.lote}</td>}
                  <td className="px-4 py-2">{format(toDate(item.fechaEntrega), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-2">{format(toDate(item.fechaVencimiento), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-2">{item.dias}</td>
                  <td className="px-4 py-2">{item.meses}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {permiteAdjuntos && (
            <div className="px-4 py-3 border-t flex flex-wrap items-center gap-3">
              {(p.adjuntos ?? []).filter((a) => esUrlDeDriveValida(a.url)).map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-orange hover:underline">
                  📎 {a.nombre}
                </a>
              ))}
              <AdjuntarMas pedido={p} onChange={onChange} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
