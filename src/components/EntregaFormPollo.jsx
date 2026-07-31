import { useEffect, useState } from 'react'
import { calcDiasMeses } from '../lib/trazabilidad'
import { listProductos } from '../services/productos'
import { crearEntregaPollo } from '../services/entregas'
import { useAuth } from '../contexts/AuthContext'

const MAX_BYTES = 15 * 1024 * 1024

export default function EntregaFormPollo({ onSaved }) {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [productoId, setProductoId] = useState('')
  const [lote, setLote] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listProductos('pollococido').then((items) =>
      setProductos(items.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    )
  }, [])

  const producto = productos.find((p) => p.id === productoId)
  const entregaDate = fechaEntrega ? new Date(fechaEntrega + 'T00:00:00') : null
  const vencimientoDate = fechaVencimiento ? new Date(fechaVencimiento + 'T00:00:00') : null
  const calculo = entregaDate && vencimientoDate ? calcDiasMeses(entregaDate, vencimientoDate) : null
  const fechasInvalidas = calculo && calculo.dias < 0
  const puedeGuardar = producto && lote.trim() && entregaDate && vencimientoDate && !fechasInvalidas && !guardando

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) { setArchivo(null); return }
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa más de 15 MB, elegí uno más liviano.')
      setArchivo(null)
      return
    }
    setError('')
    setArchivo(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setGuardando(true)
    setError('')
    try {
      await crearEntregaPollo({
        productoId: producto.id,
        productoCodigo: producto.codigo,
        productoNombre: producto.nombre,
        lote: lote.trim(),
        fechaEntrega: entregaDate,
        fechaVencimiento: vencimientoDate,
        dias: calculo.dias,
        meses: calculo.meses,
        archivo,
        creadoPor: user.email,
      })
      setProductoId('')
      setLote('')
      setFechaEntrega('')
      setFechaVencimiento('')
      setArchivo(null)
      onSaved?.()
    } catch (err) {
      setError('No se pudo guardar. Probá de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 grid gap-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Producto</label>
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
          <option value="">Seleccionar…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Número de lote</label>
        <input type="text" value={lote} onChange={(e) => setLote(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de entrega</label>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
          <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      {calculo && !fechasInvalidas && (
        <p className="text-sm text-gray-600">Días: <strong>{calculo.dias}</strong> · Meses: <strong>{calculo.meses}</strong></p>
      )}
      {fechasInvalidas && <p className="text-sm text-red-600">La fecha de vencimiento no puede ser anterior a la de entrega.</p>}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Permiso de tránsito (PDF o foto)</label>
        <input type="file" accept="application/pdf,image/*" onChange={handleFile} className="w-full text-sm" />
        {archivo && <p className="text-xs text-gray-500 mt-1">{archivo.name}</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!puedeGuardar} className="bg-pollo text-white rounded-lg py-2 font-medium disabled:opacity-40">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
