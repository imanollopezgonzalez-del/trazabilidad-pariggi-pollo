import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

const pedidosRef = collection(db, 'pedidos')

function toMillis(value) {
  return value?.toDate ? value.toDate().getTime() : value.getTime()
}

// documentoSenasa/documentoPermisoTransito ya vienen elegidos desde Google
// Drive (ver drivePicker.js) — no hay subida de archivos, solo se guarda la
// referencia {id, nombre, url}. Se cargan solo al crear el pedido, no
// después — por eso no hay ninguna función de "actualizar" acá.
export async function crearPedido(empresa, { cliente, numeroFactura, items, documentoSenasa = null, documentoPermisoTransito = null, creadoPor }) {
  const docRef = await addDoc(pedidosRef, {
    empresa,
    cliente,
    numeroFactura,
    items,
    documentoSenasa,
    documentoPermisoTransito,
    creadoPor,
    creadoEn: serverTimestamp(),
  })
  return { id: docRef.id }
}

export async function eliminarPedido(pedido) {
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
