import { useEffect, useState } from 'react'
import { listProductos, addProducto, setProductoActivo } from '../services/productos'
import { listUsuariosAutorizados, addUsuarioAutorizado, removeUsuarioAutorizado } from '../services/usuarios'
import { useAuth } from '../contexts/AuthContext'

export default function Ajustes() {
  const { user } = useAuth()
  const [empresa, setEmpresa] = useState('pariggi')
  const [productos, setProductos] = useState([])
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')

  async function reloadProductos() {
    setProductos(await listProductos(empresa))
  }
  async function reloadUsuarios() {
    setUsuarios(await listUsuariosAutorizados())
  }

  useEffect(() => { reloadProductos() }, [empresa])
  useEffect(() => { reloadUsuarios() }, [])

  async function handleAddProducto(e) {
    e.preventDefault()
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) return
    await addProducto(empresa, { codigo: nuevoCodigo.trim(), nombre: nuevoNombre.trim() })
    setNuevoCodigo('')
    setNuevoNombre('')
    reloadProductos()
  }

  async function handleAddUsuario(e) {
    e.preventDefault()
    if (!nuevoEmail.trim()) return
    await addUsuarioAutorizado(nuevoEmail.trim(), user.email)
    setNuevoEmail('')
    reloadUsuarios()
  }

  return (
    <div className="grid gap-8 max-w-2xl">
      <section>
        <h2 className="font-medium text-dark mb-3">Catálogo de productos</h2>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setEmpresa('pariggi')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pariggi' ? 'bg-orange text-white' : 'bg-white'}`}>Pariggi</button>
          <button onClick={() => setEmpresa('pollococido')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pollococido' ? 'bg-pollo text-white' : 'bg-white'}`}>Pollo Cocido</button>
        </div>
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
          {usuarios.map((email) => (
            <li key={email} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>{email}</span>
              <button onClick={() => removeUsuarioAutorizado(email).then(reloadUsuarios)} className="text-xs text-red-500 hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddUsuario} className="flex gap-2 mt-3">
          <input type="email" placeholder="email@dominio.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button type="submit" className="bg-dark text-white rounded-lg px-4 text-sm">Agregar</button>
        </form>
      </section>
    </div>
  )
}
