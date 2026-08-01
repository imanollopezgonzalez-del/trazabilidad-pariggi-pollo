import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

const CLIENTES_INICIALES = {
  pariggi: [{ nombre: 'Cedisur' }],
  pollococido: [{ nombre: 'Grandwich' }],
}

function itemsCollection(empresa) {
  return collection(db, 'clientes', empresa, 'items')
}

export async function listClientes(empresa) {
  const snap = await getDocs(itemsCollection(empresa))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function seedClientesSiVacio(empresa) {
  const existentes = await listClientes(empresa)
  if (existentes.length > 0) return
  await Promise.all(
    CLIENTES_INICIALES[empresa].map((c) =>
      setDoc(doc(itemsCollection(empresa), c.nombre.toLowerCase()), { ...c, activo: true })
    )
  )
}

export async function addCliente(empresa, nombre) {
  const id = nombre.trim().toLowerCase()
  await setDoc(doc(itemsCollection(empresa), id), { nombre: nombre.trim(), activo: true })
}

export async function setClienteActivo(empresa, clienteId, activo) {
  await updateDoc(doc(itemsCollection(empresa), clienteId), { activo })
}
