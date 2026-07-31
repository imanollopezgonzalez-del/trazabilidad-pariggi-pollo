import { useEffect, useState } from 'react'
import { calcDiasMeses } from '../lib/trazabilidad'
import { listProductos } from '../services/productos'
import { crearEntregaPariggi } from '../services/entregas'
import { useAuth } from '../contexts/AuthContext'

export default function EntregaFormPariggi({ onSaved }) {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [productoId, setProductoId] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listProductos('pariggi').then((items) =>
      setProductos(items.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    )
  }, [])

  const producto = productos.find((p) => p.id === productoId)
  const entregaDate = fechaEntrega ? new Date(fechaEntrega + 'T00:00:00') : null
  const vencimientoDate = fechaVencimiento ? new Date(fechaVencimiento + 'T00:00:00') : null
  const calculo = entregaDate && vencimientoDate ? calcDiasMeses(entregaDate, vencimientoDate) : null
  const fechasInvalidas = calculo && calculo.dias < 0
  const puedeGuardar = producto && entregaDate && vencimientoDate && !fechasInvalidas && !guardando

  async function handleSubmit(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setGuardando(true)
    setError('')
    try {
      await crearEntregaPariggi({
        productoId: producto.id,
        productoCodigo: producto.codigo,
        productoNombre: producto.nombre,
        fechaEntrega: entregaDate,
        fechaVencimiento: vencimientoDate,
        dias: calculo.dias,
        meses: calculo.meses,
        creadoPor: user.email,
      })
      setProductoId('')
      setFechaEntrega('')
      setFechaVencimiento('')
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
        <select
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">Seleccionar…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
          ))}
        </select>
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
      {fechasInvalidas && (
        <p className="text-sm text-red-600">La fecha de vencimiento no puede ser anterior a la de entrega.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!puedeGuardar} className="bg-orange text-white rounded-lg py-2 font-medium disabled:opacity-40">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
