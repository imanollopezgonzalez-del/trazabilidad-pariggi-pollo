// src/pages/Ajustes.jsx
import { useEffect, useState } from 'react'
import { listProductos, addProducto, setProductoActivo } from '../services/productos'
import { listClientes, addCliente, setClienteActivo } from '../services/clientes'
import { listUsuariosAutorizados, addUsuarioAutorizado, removeUsuarioAutorizado } from '../services/usuarios'
import { useAuth } from '../contexts/AuthContext'

const EMPRESAS = ['pariggi', 'pollococido']
const NOMBRES_EMPRESA = { pariggi: 'Pastas Pariggi', pollococido: 'Pollo Cocido' }

function accesoVacio() {
  return { pariggi: { todas: false, clientes: [] }, pollococido: { todas: false, clientes: [] } }
}

function resumenAcceso(usuario) {
  if (usuario.rol === 'admin') return 'Todo'
  const partes = EMPRESAS.filter((e) => usuario.acceso?.[e]).map((e) => {
    const permiso = usuario.acceso[e]
    const alcance = permiso.todas ? 'todas' : (permiso.clientes ?? []).join(', ') || 'ninguno'
    return `${NOMBRES_EMPRESA[e]} (${alcance})`
  })
  return partes.length > 0 ? partes.join(' · ') : 'sin acceso'
}

export default function Ajustes() {
  const { user, isAdmin } = useAuth()
  const [empresa, setEmpresa] = useState('pariggi')
  const [productos, setProductos] = useState([])
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [clientes, setClientes] = useState([])
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState('lectura')
  const [nuevoAcceso, setNuevoAcceso] = useState(accesoVacio())
  const [clientesPorEmpresa, setClientesPorEmpresa] = useState({ pariggi: [], pollococido: [] })

  async function reloadProductos() {
    setProductos(await listProductos(empresa))
  }
  async function reloadClientes() {
    setClientes(await listClientes(empresa))
  }
  async function reloadUsuarios() {
    setUsuarios(await listUsuariosAutorizados())
  }

  useEffect(() => {
    if (!isAdmin) return
    reloadProductos()
    reloadClientes()
  }, [empresa, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    reloadUsuarios()
    Promise.all(EMPRESAS.map((e) => listClientes(e))).then(([pariggi, pollococido]) =>
      setClientesPorEmpresa({ pariggi, pollococido })
    )
  }, [isAdmin])

  async function handleAddProducto(e) {
    e.preventDefault()
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) return
    await addProducto(empresa, { codigo: nuevoCodigo.trim(), nombre: nuevoNombre.trim() })
    setNuevoCodigo('')
    setNuevoNombre('')
    reloadProductos()
  }

  async function handleAddCliente(e) {
    e.preventDefault()
    if (!nuevoCliente.trim()) return
    await addCliente(empresa, nuevoCliente.trim())
    setNuevoCliente('')
    reloadClientes()
  }

  function toggleTodas(empresaId) {
    setNuevoAcceso((prev) => ({ ...prev, [empresaId]: { todas: !prev[empresaId].todas, clientes: [] } }))
  }

  function toggleClienteAcceso(empresaId, clienteId) {
    setNuevoAcceso((prev) => {
      const actuales = prev[empresaId].clientes
      const clientes = actuales.includes(clienteId)
        ? actuales.filter((id) => id !== clienteId)
        : [...actuales, clienteId]
      return { ...prev, [empresaId]: { todas: false, clientes } }
    })
  }

  async function handleAddUsuario(evento) {
    evento.preventDefault()
    if (!nuevoEmail.trim()) return
    const acceso = {}
    for (const empresaId of EMPRESAS) {
      const permiso = nuevoAcceso[empresaId]
      if (permiso.todas || permiso.clientes.length > 0) {
        acceso[empresaId] = permiso.todas ? { todas: true } : { clientes: permiso.clientes }
      }
    }
    await addUsuarioAutorizado(nuevoEmail.trim(), user.email, nuevoRol, acceso)
    setNuevoEmail('')
    setNuevoRol('lectura')
    setNuevoAcceso(accesoVacio())
    reloadUsuarios()
  }

  if (!isAdmin) {
    return <p className="text-gray-500">No tenés acceso a esta página.</p>
  }

  return (
    <div className="grid gap-8 max-w-2xl">
      <div className="flex gap-2">
        <button onClick={() => setEmpresa('pariggi')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pariggi' ? 'bg-orange text-white' : 'bg-white'}`}>Pariggi</button>
        <button onClick={() => setEmpresa('pollococido')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pollococido' ? 'bg-pollo text-white' : 'bg-white'}`}>Pollo Cocido</button>
      </div>

      <section>
        <h2 className="font-medium text-dark mb-3">Clientes</h2>
        <ul className="bg-white rounded-xl shadow divide-y">
          {clientes.map((c) => (
            <li key={c.id} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>{c.nombre}</span>
              <button onClick={() => setClienteActivo(empresa, c.id, !c.activo).then(reloadClientes)} className="text-xs text-gray-500 hover:underline">
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddCliente} className="flex gap-2 mt-3">
          <input placeholder="Nombre del cliente" value={nuevoCliente} onChange={(e) => setNuevoCliente(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button type="submit" className="bg-dark text-white rounded-lg px-4 text-sm">Agregar</button>
        </form>
      </section>

      <section>
        <h2 className="font-medium text-dark mb-3">Catálogo de productos</h2>
        <ul className="bg-white rounded-xl shadow divide-y">
          {productos.map((p) => (
            <li key={p.id} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>{p.codigo} — {p.nombre}</span>
              <button onClick={() => setProductoActivo(empresa, p.id, !p.activo).then(reloadProductos)} className="text-xs text-gray-500 hover:underline">
                {p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddProducto} className="flex gap-2 mt-3">
          <input placeholder="Código" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-28" />
          <input placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button type="submit" className="bg-dark text-white rounded-lg px-4 text-sm">Agregar</button>
        </form>
      </section>

      <section>
        <h2 className="font-medium text-dark mb-3">Usuarios autorizados</h2>
        <ul className="bg-white rounded-xl shadow divide-y">
          {usuarios.map((u) => (
            <li key={u.email} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>
                {u.email}
                <span className="text-xs text-gray-400 ml-2">{u.rol} — {resumenAcceso(u)}</span>
              </span>
              <button onClick={() => removeUsuarioAutorizado(u.email).then(reloadUsuarios)} className="text-xs text-red-500 hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddUsuario} className="grid gap-3 mt-3 bg-white rounded-xl shadow p-4">
          <div className="flex gap-2">
            <input type="email" required placeholder="email@dominio.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
            <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="lectura">Lectura</option>
              <option value="edicion">Edición</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {nuevoRol !== 'admin' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {EMPRESAS.map((e) => (
                <div key={e}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{NOMBRES_EMPRESA[e]}</p>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <input type="checkbox" checked={nuevoAcceso[e].todas} onChange={() => toggleTodas(e)} />
                    Toda la empresa
                  </label>
                  {!nuevoAcceso[e].todas && clientesPorEmpresa[e].map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={nuevoAcceso[e].clientes.includes(c.id)} onChange={() => toggleClienteAcceso(e, c.id)} />
                      {c.nombre}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
          <button type="submit" className="bg-dark text-white rounded-lg px-4 py-2 text-sm justify-self-start">Agregar / actualizar usuario</button>
        </form>
      </section>
    </div>
  )
}
