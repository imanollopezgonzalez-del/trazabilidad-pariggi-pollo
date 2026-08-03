import { format } from 'date-fns'
import { eliminarPedido } from '../services/pedidos'
import { exportPedidoPdf } from '../utils/pdfExportPedido'
import { useAuth } from '../contexts/AuthContext'

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

function esUrlDeDriveValida(url) {
  return typeof url === 'string' && url.startsWith('https://drive.google.com/')
}

function DocumentoAdjunto({ etiqueta, documento }) {
  if (!esUrlDeDriveValida(documento?.url)) {
    return <span className="text-sm text-gray-400">Sin {etiqueta}</span>
  }
  return (
    <a href={documento.url} target="_blank" rel="noreferrer" className="text-sm text-orange hover:underline">
      📎 {etiqueta}: {documento.nombre}
    </a>
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
            <div className="px-4 py-3 border-t flex flex-wrap items-center gap-4">
              <DocumentoAdjunto etiqueta="SENASA" documento={p.documentoSenasa} />
              <DocumentoAdjunto etiqueta="Permiso de Tránsito" documento={p.documentoPermisoTransito} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
