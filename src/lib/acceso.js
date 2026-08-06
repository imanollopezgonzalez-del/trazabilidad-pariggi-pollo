
export function esAdmin(usuario) {
  return usuario?.rol === 'admin'
}

export function puedeCrear(usuario) {
  return usuario?.rol === 'admin' || usuario?.rol === 'edicion'
}

export function tieneAcceso(usuario, empresa, clienteId) {
  if (!usuario) return false
  if (usuario.rol === 'admin') return true
  const permiso = usuario.acceso?.[empresa]
  if (!permiso) return false
  if (permiso.todas === true) return true
  return Array.isArray(permiso.clientes) && permiso.clientes.includes(clienteId)
}

export function tieneAlgunAcceso(usuario, empresa) {
  if (!usuario) return false
  if (usuario.rol === 'admin') return true
  return Boolean(usuario.acceso?.[empresa])
}
