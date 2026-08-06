import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

const pedidosRef = collection(db, 'pedidos')

function toMillis(value) {
  return value?.toDate ? value.toDate().getTime() : value.getTime()
}

// documentoSenasa/documentoPermisoTransito vienen elegidos desde la carpeta
// compartida de Drive (ver elegirDocumentosDeDrive en drivePicker.js);
// documentoFactura se sube desde el equipo a una carpeta de Drive aparte
// (ver subirDocumentoDesdeEquipo). En los tres casos lo único que se
// persiste acá es la referencia {id, nombre, url} ya resuelta — no hay
// subida de bytes en este archivo. clienteId (a diferencia de cliente, que
// es el nombre para mostrar) es el id usado por firestore.rules para
// chequear el acceso del creador.
export async function crearPedido(empresa, { cliente, clienteId, numeroFactura, items, documentoSenasa = null, documentoPermisoTransito = null, documentoFactura = null, creadoPor }) {
  const docRef = await addDoc(pedidosRef, {
    empresa,
    cliente,
    clienteId,
    numeroFactura,
    items,
    documentoSenasa,
    documentoPermisoTransito,
    documentoFactura,
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
export async function listPedidos(empresa, clienteId) {
  const q = query(pedidosRef, where('empresa', '==', empresa), where('clienteId', '==', clienteId))
  const snap = await getDocs(q)
  const pedidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  pedidos.sort((a, b) => toMillis(b.creadoEn ?? new Date(0)) - toMillis(a.creadoEn ?? new Date(0)))
  return pedidos
}
