import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

export const PARIGGI_CATALOGO = [
  { codigo: '10201', nombre: 'Cables de Teléfono al Huevo' },
  { codigo: '6010', nombre: 'Bucatini' },
  { codigo: '10202', nombre: 'Cuerdas de guitarra al huevo' },
  { codigo: '20301', nombre: 'Cables de Teléfono Integrales' },
  { codigo: '30101', nombre: 'Ñoquis de Pura Papa' },
  { codigo: '50201', nombre: 'Ravioles de Ricota Sicilianos' },
  { codigo: '60202', nombre: 'Raviolones de Espinaca y Provolone' },
  { codigo: '70205', nombre: 'Sorrentinos de Jamón y Mozzarella' },
  { codigo: '70206', nombre: 'Sorrentinos de Calabaza de Ferrara' },
  { codigo: '101070207', nombre: 'Foglia de Lasagna' },
  { codigo: '101070208', nombre: 'Ñoquis a la Romana con Parmesano' },
  { codigo: '101030103', nombre: 'Ñoquis de Espinaca' },
  { codigo: '1030102', nombre: 'Ñoquis de Calabaza' },
  { codigo: '101010203', nombre: 'Tagliatelle de Espinaca' },
  { codigo: '101010204', nombre: 'Puntallete 1,5 kg' },
  { codigo: '101010210', nombre: 'Puntallete 1 kg' },
]

export const POLLO_CATALOGO = [
  { codigo: '200324', nombre: 'Milanesa de Pollo' },
  { codigo: '200222', nombre: 'Pechuga 90/110 grs' },
  { codigo: '200223', nombre: 'Pechuga 150/180 grs' },
  { codigo: '200224', nombre: 'Trocitos de 20x20x20' },
  { codigo: '200305', nombre: 'Bifecitos Neo' },
  { codigo: '200243', nombre: 'Fingers de Pollo' },
]

function itemsCollection(empresa) {
  return collection(db, 'productos', empresa, 'items')
}

export async function listProductos(empresa) {
  const snap = await getDocs(itemsCollection(empresa))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function seedCatalogoSiVacio(empresa) {
  const existentes = await listProductos(empresa)
  if (existentes.length > 0) return
  const catalogo = empresa === 'pariggi' ? PARIGGI_CATALOGO : POLLO_CATALOGO
  await Promise.all(
    catalogo.map((p) =>
      setDoc(doc(itemsCollection(empresa), p.codigo), { ...p, activo: true })
    )
  )
}

export async function addProducto(empresa, { codigo, nombre }) {
  await setDoc(doc(itemsCollection(empresa), codigo), { codigo, nombre, activo: true })
}

export async function setProductoActivo(empresa, productoId, activo) {
  await updateDoc(doc(itemsCollection(empresa), productoId), { activo })
}
