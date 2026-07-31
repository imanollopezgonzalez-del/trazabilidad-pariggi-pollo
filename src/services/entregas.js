import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'

const entregasRef = collection(db, 'entregas')

function toMillis(value) {
  return value?.toDate ? value.toDate().getTime() : value.getTime()
}

async function crearEntregaBase(empresa, datos) {
  const docRef = await addDoc(entregasRef, {
    empresa,
    cliente: datos.cliente,
    productoId: datos.productoId,
    productoCodigo: datos.productoCodigo,
    productoNombre: datos.productoNombre,
    lote: datos.lote ?? null,
    fechaEntrega: datos.fechaEntrega,
    fechaVencimiento: datos.fechaVencimiento,
    dias: datos.dias,
    meses: datos.meses,
    adjuntoUrl: null,
    adjuntoNombre: null,
    creadoPor: datos.creadoPor,
    creadoEn: serverTimestamp(),
  })
  return docRef.id
}

export async function crearEntregaPariggi(datos) {
  return crearEntregaBase('pariggi', { ...datos, cliente: datos.cliente ?? 'Cedisur' })
}

async function subirAdjunto(entregaId, archivo) {
  const path = `permisos/pollococido/${entregaId}/${archivo.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, archivo)
  const url = await getDownloadURL(fileRef)
  await updateDoc(doc(db, 'entregas', entregaId), {
    adjuntoUrl: url,
    adjuntoNombre: archivo.name,
  })
}

export async function crearEntregaPollo(datos) {
  const entregaId = await crearEntregaBase('pollococido', { ...datos, cliente: datos.cliente ?? 'Grandwich' })
  if (datos.archivo) {
    await subirAdjunto(entregaId, datos.archivo)
  }
  return entregaId
}

// Para cuando el operador cargó la entrega sin el escaneo todavía y lo
// adjunta más tarde desde el historial.
export async function adjuntarArchivo(entregaId, archivo) {
  await subirAdjunto(entregaId, archivo)
}

// Sin orderBy en la query: un where + orderBy sobre campos distintos exige un
// índice compuesto en Firestore. Se ordena en cliente en su lugar.
export async function listEntregas(empresa) {
  const q = query(entregasRef, where('empresa', '==', empresa))
  const snap = await getDocs(q)
  const entregas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  entregas.sort((a, b) => toMillis(b.fechaEntrega) - toMillis(a.fechaEntrega))
  return entregas
}
