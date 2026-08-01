import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'

const pedidosRef = collection(db, 'pedidos')
const UPLOAD_TIMEOUT_MS = 8000

function toMillis(value) {
  return value?.toDate ? value.toDate().getTime() : value.getTime()
}

function conTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

// Sube un archivo con límite de tiempo — si Storage no está habilitado
// todavía en el proyecto, uploadBytes puede quedarse esperando de forma
// indefinida en vez de fallar rápido, y sin este límite el botón de
// Guardar quedaría trabado para siempre.
async function subirArchivoConTimeout(empresa, pedidoId, archivo) {
  const path = `permisos/${empresa}/${pedidoId}/${archivo.name}`
  const fileRef = ref(storage, path)
  await conTimeout(uploadBytes(fileRef, archivo), UPLOAD_TIMEOUT_MS)
  const url = await conTimeout(getDownloadURL(fileRef), UPLOAD_TIMEOUT_MS)
  return { url, nombre: archivo.name, path }
}

export async function crearPedido(empresa, { cliente, numeroFactura, items, archivos = [], creadoPor }) {
  const docRef = await addDoc(pedidosRef, {
    empresa,
    cliente,
    numeroFactura,
    items,
    adjuntos: [],
    creadoPor,
    creadoEn: serverTimestamp(),
  })

  const resultados = await Promise.allSettled(
    archivos.map((archivo) => subirArchivoConTimeout(empresa, docRef.id, archivo))
  )
  const adjuntosSubidos = resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const fallidos = resultados.filter((r) => r.status === 'rejected').length

  if (adjuntosSubidos.length > 0) {
    await updateDoc(doc(db, 'pedidos', docRef.id), { adjuntos: adjuntosSubidos })
  }

  return { id: docRef.id, adjuntosSubidos: adjuntosSubidos.length, adjuntosFallidos: fallidos }
}

// Para agregar un documento a un pedido ya guardado (si Storage no estaba
// listo al momento de crearlo, o si el operador escaneó el permiso después).
export async function adjuntarArchivo(empresa, pedido, archivo) {
  const nuevo = await subirArchivoConTimeout(empresa, pedido.id, archivo)
  const adjuntos = [...(pedido.adjuntos ?? []), nuevo]
  await updateDoc(doc(db, 'pedidos', pedido.id), { adjuntos })
  return adjuntos
}

// Recibe el pedido completo (no solo el id) para poder borrar también sus
// archivos adjuntos en Storage — si no, quedarían huérfanos ocupando espacio.
export async function eliminarPedido(pedido) {
  await Promise.allSettled(
    (pedido.adjuntos ?? []).filter((a) => a.path).map((a) => deleteObject(ref(storage, a.path)))
  )
  await deleteDoc(doc(db, 'pedidos', pedido.id))
}

// Sin orderBy en la query: un where + orderBy sobre campos distintos exige un
// índice compuesto en Firestore. Se ordena en cliente en su lugar.
export async function listPedidos(empresa, cliente) {
  const q = query(pedidosRef, where('empresa', '==', empresa), where('cliente', '==', cliente))
  const snap = await getDocs(q)
  const pedidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  pedidos.sort((a, b) => toMillis(b.creadoEn ?? new Date(0)) - toMillis(a.creadoEn ?? new Date(0)))
  return pedidos
}
