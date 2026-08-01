import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

const pedidosRef = collection(db, 'pedidos')

function toMillis(value) {
  return value?.toDate ? value.toDate().getTime() : value.getTime()
}

// documentos ya vienen elegidos desde Google Drive (ver drivePicker.js) —
// no hay subida de archivos, solo se guarda la referencia [{id, nombre, url}].
export async function crearPedido(empresa, { cliente, numeroFactura, items, documentos = [], creadoPor }) {
  const docRef = await addDoc(pedidosRef, {
    empresa,
    cliente,
    numeroFactura,
    items,
    adjuntos: documentos,
    creadoPor,
    creadoEn: serverTimestamp(),
  })
  return { id: docRef.id }
}

// Para agregar un documento a un pedido ya guardado.
export async function adjuntarDocumentos(pedido, nuevosDocumentos) {
  const adjuntos = [...(pedido.adjuntos ?? []), ...nuevosDocumentos]
  await updateDoc(doc(db, 'pedidos', pedido.id), { adjuntos })
  return adjuntos
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
