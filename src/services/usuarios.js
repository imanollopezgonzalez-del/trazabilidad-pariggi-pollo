import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const usuariosRef = collection(db, 'usuariosAutorizados')

export async function listUsuariosAutorizados() {
  const snap = await getDocs(usuariosRef)
  return snap.docs.map((d) => d.id)
}

export async function addUsuarioAutorizado(email, agregadoPor) {
  await setDoc(doc(usuariosRef, email.toLowerCase()), {
    agregadoPor,
    agregadoEn: serverTimestamp(),
  })
}

export async function removeUsuarioAutorizado(email) {
  await deleteDoc(doc(usuariosRef, email.toLowerCase()))
}
