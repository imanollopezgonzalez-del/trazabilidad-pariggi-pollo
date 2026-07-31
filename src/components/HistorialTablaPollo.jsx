import { useState } from 'react'
import { format } from 'date-fns'
import { adjuntarArchivo } from '../services/entregas'

const MAX_BYTES = 15 * 1024 * 1024

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

// adjuntoUrl viene de Firestore, no del propio flujo de subida — solo se
// renderiza como link si apunta al bucket real de Storage, para no quedar
// expuestos a un href tipo javascript: cargado por otra vía.
function esUrlDeStorageValida(url) {
  return typeof url === 'string' && url.startsWith('https://firebasestorage.googleapis.com/')
}

function AdjuntarInline({ entregaId, onAdjuntado }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('Pesa más de 15 MB')
      return
    }
    setError('')
    setSubiendo(true)
    try {
      await adjuntarArchivo(entregaId, file)
      onAdjuntado?.()
    } catch (err) {
      setError('No se pudo subir')
      console.error(err)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div>
      <label className="text-xs text-pollo hover:underline cursor-pointer">
        {subiendo ? 'Subiendo…' : 'Adjuntar'}
        <input type="file" accept="application/pdf,image/*" onChange={handleChange} disabled={subiendo} className="hidden" />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function HistorialTablaPollo({ entregas, onChange }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Lote</th>
            <th className="px-4 py-2">Fecha entrega</th>
            <th className="px-4 py-2">Fecha vencimiento</th>
            <th className="px-4 py-2">Días</th>
            <th className="px-4 py-2">Meses</th>
            <th className="px-4 py-2">Adjunto</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="px-4 py-2">{e.productoNombre}</td>
              <td className="px-4 py-2">{e.lote}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaEntrega), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaVencimiento), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{e.dias}</td>
              <td className="px-4 py-2">{e.meses}</td>
              <td className="px-4 py-2">
                {esUrlDeStorageValida(e.adjuntoUrl) ? (
                  <a href={e.adjuntoUrl} target="_blank" rel="noreferrer" className="text-pollo hover:underline">Ver</a>
                ) : (
                  <AdjuntarInline entregaId={e.id} onAdjuntado={onChange} />
                )}
              </td>
            </tr>
          ))}
          {entregas.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin registros todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
