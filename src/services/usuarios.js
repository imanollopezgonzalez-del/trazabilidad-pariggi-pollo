import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const usuariosRef = collection(db, 'usuariosAutorizados')

export async function listUsuariosAutorizados() {
  const snap = await getDocs(usuariosRef)
  return snap.docs.map((d) => ({ email: d.id, ...d.data() }))
}

// acceso se ignora para rol 'admin' — un admin siempre tiene acceso total,
// ver tieneAcceso en lib/acceso.js.
export async function addUsuarioAutorizado(email, agregadoPor, rol, acceso) {
  await setDoc(doc(usuariosRef, email.toLowerCase()), {
    rol,
    acceso: rol === 'admin' ? {} : acceso,
    agregadoPor,
    agregadoEn: serverTimestamp(),
  })
}

export async function removeUsuarioAutorizado(email) {
  await deleteDoc(doc(usuariosRef, email.toLowerCase()))
}
