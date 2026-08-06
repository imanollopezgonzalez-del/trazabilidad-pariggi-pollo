import { useEffect, useState } from 'react'
import { calcDiasMeses } from '../lib/trazabilidad'
import { listProductos } from '../services/productos'
import { crearPedido } from '../services/pedidos'
import { elegirDocumentosDeDrive, subirDocumentoDesdeEquipo } from '../utils/drivePicker'
import { useAuth } from '../contexts/AuthContext'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID
const GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH

function filaVacia() {
  return { key: crypto.randomUUID(), productoId: '', lote: '', fechaEntrega: '', fechaVencimiento: '' }
}

function SelectorDeDocumento({ etiqueta, documento, onElegir, onQuitar, eligiendo }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{etiqueta}</label>
      {documento ? (
        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5 max-w-sm">
          <span className="truncate">{documento.nombre}</span>
          <button type="button" onClick={onQuitar} className="text-red-500 hover:text-red-700 ml-3 shrink-0">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onElegir}
          disabled={eligiendo}
          className="text-sm border border-orange text-orange rounded-lg px-4 py-2 hover:bg-orange hover:text-white disabled:opacity-40"
        >
          {eligiendo ? 'Abriendo…' : `+ Agregar ${etiqueta}`}
        </button>
      )}
    </div>
  )
}

export default function PedidoForm({ empresa, cliente, clienteId, permiteLote, permiteAdjuntos, permiteFactura, onSaved }) {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [numeroFactura, setNumeroFactura] = useState('')
  const [filas, setFilas] = useState([filaVacia()])
  const [documentoSenasa, setDocumentoSenasa] = useState(null)
  const [documentoPermisoTransito, setDocumentoPermisoTransito] = useState(null)
  const [documentoFactura, setDocumentoFactura] = useState(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listProductos(empresa).then((items) =>
      setProductos(items.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    )
  }, [empresa])

  function actualizarFila(key, cambios) {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambios } : f)))
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia()])
  }

  function quitarFila(key) {
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.key !== key) : prev))
  }

  async function handleElegirDocumento(setDocumento, etiqueta) {
    setError('')
    setEligiendo(true)
    try {
      const elegidos = await elegirDocumentosDeDrive({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        email: user.email,
        multiselect: false,
      })
      if (elegidos.length > 0) setDocumento(elegidos[0])
    } catch (err) {
      setError(`No se pudo abrir el selector de Drive para ${etiqueta}. Probá de nuevo.`)
      console.error(err)
    } finally {
      setEligiendo(false)
    }
  }

  async function handleSubirFactura() {
    setError('')
    if (!GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH) {
      setError('Falta configurar la carpeta de Drive para facturas. Avisá al administrador.')
      return
    }
    setEligiendo(true)
    try {
      const subidos = await subirDocumentoDesdeEquipo({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        folderId: GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH,
        email: user.email,
      })
      if (subidos.length > 0) setDocumentoFactura(subidos[0])
    } catch (err) {
      setError('No se pudo subir la factura. Probá de nuevo.')
      console.error(err)
    } finally {
      setEligiendo(false)
    }
  }

  const filasCalculadas = filas.map((f) => {
    const entregaDate = f.fechaEntrega ? new Date(f.fechaEntrega + 'T00:00:00') : null
    const vencimientoDate = f.fechaVencimiento ? new Date(f.fechaVencimiento + 'T00:00:00') : null
    const calculo = entregaDate && vencimientoDate ? calcDiasMeses(entregaDate, vencimientoDate) : null
    return { ...f, entregaDate, vencimientoDate, calculo }
  })

  const filasInvalidas = filasCalculadas.some((f) => f.calculo && f.calculo.dias < 0)
  const filasCompletas = filasCalculadas.every(
    (f) => f.productoId && f.entregaDate && f.vencimientoDate && (!permiteLote || f.lote.trim())
  )
  const puedeGuardar = numeroFactura.trim() && filasCompletas && !filasInvalidas && !guardando

  async function handleSubmit(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setGuardando(true)
    setError('')
    try {
      const items = filasCalculadas.map((f) => {
        const producto = productos.find((p) => p.id === f.productoId)
        return {
          productoId: producto.id,
          productoCodigo: producto.codigo,
          productoNombre: producto.nombre,
          lote: permiteLote ? f.lote.trim() : null,
          fechaEntrega: f.entregaDate,
          fechaVencimiento: f.vencimientoDate,
          dias: f.calculo.dias,
          meses: f.calculo.meses,
        }
      })
      await crearPedido(empresa, {
        cliente,
        clienteId,
        numeroFactura: numeroFactura.trim(),
        items,
        documentoSenasa: permiteAdjuntos ? documentoSenasa : null,
        documentoPermisoTransito: permiteAdjuntos ? documentoPermisoTransito : null,
        documentoFactura: permiteFactura ? documentoFactura : null,
        creadoPor: user.email,
      })
      setNumeroFactura('')
      setFilas([filaVacia()])
      setDocumentoSenasa(null)
      setDocumentoPermisoTransito(null)
      setDocumentoFactura(null)
      onSaved?.()
    } catch (err) {
      setError('No se pudo guardar el pedido. Probá de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 grid gap-4">
      <div className="max-w-xs">
        <label className="block text-sm font-medium text-gray-600 mb-1">Número de factura</label>
        <input
          type="text"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div className="grid gap-3">
        {filasCalculadas.map((f) => (
          <div key={f.key} className="border rounded-lg p-3 grid gap-3">
            <div className={`grid gap-3 ${permiteLote ? 'grid-cols-1 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-4'}`}>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
                <select
                  value={f.productoId}
                  onChange={(e) => actualizarFila(f.key, { productoId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Seleccionar…</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
                  ))}
                </select>
              </div>
              {permiteLote && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lote</label>
                  <input
                    type="text"
                    value={f.lote}
                    onChange={(e) => actualizarFila(f.key, { lote: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha entrega</label>
                <input
                  type="date"
                  value={f.fechaEntrega}
                  onChange={(e) => actualizarFila(f.key, { fechaEntrega: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha vencimiento</label>
                <input
                  type="date"
                  value={f.fechaVencimiento}
                  onChange={(e) => actualizarFila(f.key, { fechaVencimiento: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              {f.calculo && f.calculo.dias >= 0 && (
                <p className="text-sm text-gray-600">Días: <strong>{f.calculo.dias}</strong> · Meses: <strong>{f.calculo.meses}</strong></p>
              )}
              {f.calculo && f.calculo.dias < 0 && (
                <p className="text-sm text-red-600">La fecha de vencimiento no puede ser anterior a la de entrega.</p>
              )}
              {filas.length > 1 && (
                <button type="button" onClick={() => quitarFila(f.key)} className="text-xs text-red-500 hover:underline">
                  Quitar producto
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={agregarFila} className="text-sm text-orange hover:underline justify-self-start">
        + Agregar otro producto
      </button>

      {(permiteAdjuntos || permiteFactura) && (
        <div className="border rounded-lg p-4 grid gap-3">
          <h3 className="text-sm font-semibold text-dark">Documentos</h3>
          {permiteAdjuntos && (
            <>
              <SelectorDeDocumento
                etiqueta="SENASA"
                documento={documentoSenasa}
                eligiendo={eligiendo}
                onElegir={() => handleElegirDocumento(setDocumentoSenasa, 'SENASA')}
                onQuitar={() => setDocumentoSenasa(null)}
              />
              <SelectorDeDocumento
                etiqueta="Permiso de Tránsito"
                documento={documentoPermisoTransito}
                eligiendo={eligiendo}
                onElegir={() => handleElegirDocumento(setDocumentoPermisoTransito, 'Permiso de Tránsito')}
                onQuitar={() => setDocumentoPermisoTransito(null)}
              />
            </>
          )}
          {permiteFactura && (
            <SelectorDeDocumento
              etiqueta="Factura"
              documento={documentoFactura}
              eligiendo={eligiendo}
              onElegir={handleSubirFactura}
              onQuitar={() => setDocumentoFactura(null)}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!puedeGuardar}
        className="bg-orange text-white rounded-lg py-2 font-medium disabled:opacity-40 justify-self-start px-8"
      >
        {guardando ? 'Guardando…' : 'Guardar pedido'}
      </button>
    </form>
  )
}
