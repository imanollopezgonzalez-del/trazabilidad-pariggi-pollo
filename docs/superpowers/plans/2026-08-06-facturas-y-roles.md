# Facturas Grandwich + Roles y Accesos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Grandwich-only invoice ("Factura") upload button that saves to a dedicated Drive folder, and replace the single `admin` boolean with a `rol` (admin/edicion/lectura) + per-empresa/cliente `acceso` system enforced in both the UI and Firestore rules.

**Architecture:** Pure access-control logic lives in `src/lib/acceso.js` (unit tested), consumed by `AuthContext` and mirrored (necessarily duplicated, different DSL) in `firestore.rules`. The invoice upload reuses the existing Google Picker OAuth plumbing in `src/utils/drivePicker.js`, adding a `DocsUploadView` variant that opens the OS file browser and uploads straight into a new dedicated Drive folder — no Firebase Storage, no new billing, no new OAuth scope.

**Tech Stack:** Vite + React 19, Firebase (Auth + Firestore), react-router-dom, vitest, Google Identity Services + Picker API.

## Global Constraints

- No Firebase Storage — this project deliberately removed it (see commit `aa5eeb7`) because Blaze billing didn't solve anything Drive Picker doesn't already solve for free. Do not reintroduce it.
- New Drive folder for Grandwich invoices, already created and shared by the user: folder ID `1XXvWllCM04LBQIlPutQwTnem1ZFfa2QW`. Separate from `VITE_GOOGLE_DRIVE_FOLDER_ID` (the SENASA/Permiso folder).
- The Factura button is hardcoded to `empresa === 'pollococido' && clienteId === 'grandwich'` — no generic per-client permission system for this specific feature.
- Existing users to migrate: `imanollopezgonzalez@gmail.com` → rol `admin`; `ivan.larez@pollococido.com.ar` → rol `edicion`, acceso a ambas empresas completas; new user `hernan.o@pollococido.com.ar` → rol `lectura`, acceso solo a Pollo Cocido → Grandwich.
- Firestore data migration (Task 14) MUST happen before the new `firestore.rules` are deployed (Task 15) — the old rules only check `admin`/`isAuthorized`, so migrating data first is safe; deploying rules that reference `rol` before Imanol's own doc has `rol: 'admin'` would lock everyone out including him.
- No component/integration test harness exists in this repo (only `src/lib/*.test.js` pure-function tests via vitest). Follow that precedent: TDD for `src/lib/acceso.js`, and `npm run build` + `npm run lint` as the verification step for React component changes.

---

### Task 1: Access-control pure logic (`src/lib/acceso.js`)

**Files:**
- Create: `src/lib/acceso.js`
- Test: `src/lib/acceso.test.js`

**Interfaces:**
- Produces: `esAdmin(usuario)`, `puedeCrear(usuario)`, `tieneAcceso(usuario, empresa, clienteId)`, `tieneAlgunAcceso(usuario, empresa)` — all pure functions taking a `usuario` shaped `{ rol: 'admin'|'edicion'|'lectura', acceso?: { [empresa]: { todas?: true, clientes?: string[] } } }` (or `null`/`undefined`).

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/acceso.test.js
import { describe, it, expect } from 'vitest'
import { esAdmin, puedeCrear, tieneAcceso, tieneAlgunAcceso } from './acceso.js'

const admin = { rol: 'admin' }
const edicionTodas = { rol: 'edicion', acceso: { pariggi: { todas: true }, pollococido: { todas: true } } }
const lecturaGrandwich = { rol: 'lectura', acceso: { pollococido: { clientes: ['grandwich'] } } }

describe('esAdmin', () => {
  it('es true solo para rol admin', () => {
    expect(esAdmin(admin)).toBe(true)
    expect(esAdmin(edicionTodas)).toBe(false)
    expect(esAdmin(null)).toBe(false)
    expect(esAdmin(undefined)).toBe(false)
  })
})

describe('puedeCrear', () => {
  it('es true para admin y edicion, false para lectura', () => {
    expect(puedeCrear(admin)).toBe(true)
    expect(puedeCrear(edicionTodas)).toBe(true)
    expect(puedeCrear(lecturaGrandwich)).toBe(false)
    expect(puedeCrear(null)).toBe(false)
  })
})

describe('tieneAcceso', () => {
  it('admin tiene acceso a cualquier empresa/cliente', () => {
    expect(tieneAcceso(admin, 'pariggi', 'cedisur')).toBe(true)
    expect(tieneAcceso(admin, 'pollococido', 'lo-que-sea')).toBe(true)
  })

  it('todas:true da acceso a cualquier cliente de esa empresa', () => {
    expect(tieneAcceso(edicionTodas, 'pariggi', 'cedisur')).toBe(true)
    expect(tieneAcceso(edicionTodas, 'pollococido', 'grandwich')).toBe(true)
  })

  it('lista de clientes solo da acceso a esos ids', () => {
    expect(tieneAcceso(lecturaGrandwich, 'pollococido', 'grandwich')).toBe(true)
    expect(tieneAcceso(lecturaGrandwich, 'pollococido', 'otro-cliente')).toBe(false)
  })

  it('sin acceso configurado para esa empresa, deniega', () => {
    expect(tieneAcceso(lecturaGrandwich, 'pariggi', 'cedisur')).toBe(false)
  })

  it('usuario null/undefined deniega', () => {
    expect(tieneAcceso(null, 'pariggi', 'cedisur')).toBe(false)
    expect(tieneAcceso(undefined, 'pariggi', 'cedisur')).toBe(false)
  })
})

describe('tieneAlgunAcceso', () => {
  it('admin siempre true', () => {
    expect(tieneAlgunAcceso(admin, 'pariggi')).toBe(true)
  })

  it('true si hay cualquier entrada de acceso para esa empresa', () => {
    expect(tieneAlgunAcceso(lecturaGrandwich, 'pollococido')).toBe(true)
    expect(tieneAlgunAcceso(lecturaGrandwich, 'pariggi')).toBe(false)
  })

  it('usuario null/undefined deniega', () => {
    expect(tieneAlgunAcceso(null, 'pariggi')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/acceso.test.js`
Expected: FAIL — `Failed to resolve import "./acceso.js"` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```js
// src/lib/acceso.js

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/acceso.test.js`
Expected: PASS, all 13 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/acceso.js src/lib/acceso.test.js
git commit -m "Add pure rol/acceso logic for the permission system"
```

---

### Task 2: `usuariosAutorizados` service supports rol + acceso

**Files:**
- Modify: `src/services/usuarios.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `listUsuariosAutorizados()` now resolves `[{ email, rol, acceso, agregadoPor, agregadoEn }]` instead of `string[]`. `addUsuarioAutorizado(email, agregadoPor, rol, acceso)` replaces the old 2-arg signature.

- [ ] **Step 1: Replace the file contents**

```js
// src/services/usuarios.js
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
```

- [ ] **Step 2: Verify no other file still calls the old signature**

Run: `grep -rn "addUsuarioAutorizado\|listUsuariosAutorizados" src/`
Expected: only `src/services/usuarios.js` (definition) and `src/pages/Ajustes.jsx` (caller, fixed in Task 11). If `Ajustes.jsx` isn't fixed yet, that's expected at this point in the plan — don't run the app yet.

- [ ] **Step 3: Commit**

```bash
git add src/services/usuarios.js
git commit -m "Add rol/acceso fields to usuariosAutorizados service"
```

---

### Task 3: `AuthContext` exposes rol/acceso helpers

**Files:**
- Modify: `src/contexts/AuthContext.jsx`

**Interfaces:**
- Consumes: `esAdmin`, `puedeCrear`, `tieneAcceso`, `tieneAlgunAcceso` from `../lib/acceso.js` (Task 1).
- Produces: `useAuth()` returns `{ user, status, login, logout, isAdmin, puedeCrear, tieneAcceso(empresa, clienteId), tieneAlgunAcceso(empresa) }`. `isAdmin` keeps its existing name/meaning (`rol === 'admin'`) so `HistorialPedidos.jsx` doesn't need to change.

- [ ] **Step 1: Replace the file contents**

```jsx
// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase'
import { esAdmin, puedeCrear as puedeCrearUsuario, tieneAcceso as tieneAccesoUsuario, tieneAlgunAcceso as tieneAlgunAccesoUsuario } from '../lib/acceso'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setUsuario(null)
        setStatus('signed-out')
        return
      }
      const email = firebaseUser.email?.toLowerCase()
      try {
        const authDoc = await getDoc(doc(db, 'usuariosAutorizados', email))
        if (!authDoc.exists()) {
          await signOut(auth)
          setUser(null)
          setStatus('unauthorized')
          return
        }
        setUser(firebaseUser)
        setUsuario(authDoc.data())
        setStatus('authorized')
      } catch (err) {
        // Si el email todavía no está en la whitelist, las reglas de
        // Firestore devuelven permission-denied en vez de "no existe" —
        // sin este catch la pantalla se quedaba trabada en "Cargando…"
        // para siempre en vez de mostrar el mensaje de no autorizado.
        console.error(err)
        await signOut(auth)
        setUser(null)
        setStatus('unauthorized')
      }
    })
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  const value = {
    user,
    status,
    login,
    logout,
    isAdmin: esAdmin(usuario),
    puedeCrear: puedeCrearUsuario(usuario),
    tieneAcceso: (empresa, clienteId) => tieneAccesoUsuario(usuario, empresa, clienteId),
    tieneAlgunAcceso: (empresa) => tieneAlgunAccesoUsuario(usuario, empresa),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/AuthContext.jsx
git commit -m "Expose rol/acceso helpers from AuthContext"
```

---

### Task 4: `pedidos` service gains `clienteId` + `documentoFactura`

**Files:**
- Modify: `src/services/pedidos.js`

**Interfaces:**
- Produces: `crearPedido(empresa, { cliente, clienteId, numeroFactura, items, documentoSenasa, documentoPermisoTransito, documentoFactura, creadoPor })` — adds `clienteId` (required, used by Firestore rules for access checks) and `documentoFactura` (optional, same `{id, nombre, url}` shape as the other two documentos).

- [ ] **Step 1: Replace the file contents**

```js
// src/services/pedidos.js
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
export async function listPedidos(empresa, cliente) {
  const q = query(pedidosRef, where('empresa', '==', empresa), where('cliente', '==', cliente))
  const snap = await getDocs(q)
  const pedidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  pedidos.sort((a, b) => toMillis(b.creadoEn ?? new Date(0)) - toMillis(a.creadoEn ?? new Date(0)))
  return pedidos
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/pedidos.js
git commit -m "Add clienteId and documentoFactura to pedidos"
```

---

### Task 5: Drive upload-from-device helper

**Files:**
- Modify: `src/utils/drivePicker.js`

**Interfaces:**
- Consumes: internal `loadGapiPicker()`, `pedirTokenDeAcceso()` (already defined in this file, unexported, module-scoped — reused as-is).
- Produces: `subirDocumentoDesdeEquipo({ apiKey, clientId, folderId, email })` → `Promise<[{ id, nombre, url }]>` (empty array if the user cancels), same shape as `elegirDocumentosDeDrive`.

- [ ] **Step 1: Append the new export**

Add this function at the end of `src/utils/drivePicker.js`, after `elegirDocumentosDeDrive`:

```js
// A diferencia de elegirDocumentosDeDrive (que lista archivos ya existentes
// en Drive), esta usa la vista "Subir" del Picker: abre el explorador de
// archivos del sistema operativo, sube el archivo elegido como hijo de
// folderId, y devuelve su referencia. Mismo token/scope (drive.file), sin
// subir bytes por fuera de la API de Drive — no hace falta Firebase Storage.
export async function subirDocumentoDesdeEquipo({ apiKey, clientId, folderId, email }) {
  await loadGapiPicker()
  const accessToken = await pedirTokenDeAcceso(clientId, email)

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsUploadView().setParentFolder(folderId)

    const builder = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          resolve(data.docs.map((d) => ({ id: d.id, nombre: d.name, url: d.url })))
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([])
        }
      })

    builder.build().setVisible(true)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/drivePicker.js
git commit -m "Add Drive upload-from-device helper for invoice attachments"
```

---

### Task 6: `PedidoForm` — Factura button + grouped "Documentos" layout

**Files:**
- Modify: `src/components/PedidoForm.jsx`

**Interfaces:**
- Consumes: `subirDocumentoDesdeEquipo` (Task 5), `crearPedido` now needs `clienteId`/`documentoFactura` (Task 4).
- Produces: `PedidoForm` gains two new props: `clienteId` (string, required for saving) and `permiteFactura` (bool, default falsy — controls whether the Factura selector renders and whether `documentoFactura` is sent).

- [ ] **Step 1: Replace the file contents**

```jsx
// src/components/PedidoForm.jsx
import { useEffect, useState } from 'react'
import { calcDiasMeses } from '../lib/trazabilidad'
import { listProductos } from '../services/productos'
import { crearPedido } from '../services/pedidos'
import { elegirDocumentosDeDrive, subirDocumentoDesdeEquipo } from '../utils/drivePicker'
import { useAuth } from '../contexts/AuthContext'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID
const GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH

function filaVacia() {
  return { key: crypto.randomUUID(), productoId: '', lote: '', fechaEntrega: '', fechaVencimiento: '' }
}

function SelectorDeDocumento({ etiqueta, documento, onElegir, onQuitar, eligiendo }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{etiqueta}</label>
      {documento ? (
        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5 max-w-sm">
          <span className="truncate">{documento.nombre}</span>
          <button type="button" onClick={onQuitar} className="text-red-500 hover:text-red-700 ml-3 shrink-0">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onElegir}
          disabled={eligiendo}
          className="text-sm border border-orange text-orange rounded-lg px-4 py-2 hover:bg-orange hover:text-white disabled:opacity-40"
        >
          {eligiendo ? 'Abriendo…' : `+ Agregar ${etiqueta}`}
        </button>
      )}
    </div>
  )
}

export default function PedidoForm({ empresa, cliente, clienteId, permiteLote, permiteAdjuntos, permiteFactura, onSaved }) {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [numeroFactura, setNumeroFactura] = useState('')
  const [filas, setFilas] = useState([filaVacia()])
  const [documentoSenasa, setDocumentoSenasa] = useState(null)
  const [documentoPermisoTransito, setDocumentoPermisoTransito] = useState(null)
  const [documentoFactura, setDocumentoFactura] = useState(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listProductos(empresa).then((items) =>
      setProductos(items.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    )
  }, [empresa])

  function actualizarFila(key, cambios) {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambios } : f)))
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia()])
  }

  function quitarFila(key) {
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.key !== key) : prev))
  }

  async function handleElegirDocumento(setDocumento, etiqueta) {
    setError('')
    setEligiendo(true)
    try {
      const elegidos = await elegirDocumentosDeDrive({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        email: user.email,
        multiselect: false,
      })
      if (elegidos.length > 0) setDocumento(elegidos[0])
    } catch (err) {
      setError(`No se pudo abrir el selector de Drive para ${etiqueta}. Probá de nuevo.`)
      console.error(err)
    } finally {
      setEligiendo(false)
    }
  }

  async function handleSubirFactura() {
    setError('')
    setEligiendo(true)
    try {
      const subidos = await subirDocumentoDesdeEquipo({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        folderId: GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH,
        email: user.email,
      })
      if (subidos.length > 0) setDocumentoFactura(subidos[0])
    } catch (err) {
      setError('No se pudo subir la factura. Probá de nuevo.')
      console.error(err)
    } finally {
      setEligiendo(false)
    }
  }

  const filasCalculadas = filas.map((f) => {
    const entregaDate = f.fechaEntrega ? new Date(f.fechaEntrega + 'T00:00:00') : null
    const vencimientoDate = f.fechaVencimiento ? new Date(f.fechaVencimiento + 'T00:00:00') : null
    const calculo = entregaDate && vencimientoDate ? calcDiasMeses(entregaDate, vencimientoDate) : null
    return { ...f, entregaDate, vencimientoDate, calculo }
  })

  const filasInvalidas = filasCalculadas.some((f) => f.calculo && f.calculo.dias < 0)
  const filasCompletas = filasCalculadas.every(
    (f) => f.productoId && f.entregaDate && f.vencimientoDate && (!permiteLote || f.lote.trim())
  )
  const puedeGuardar = numeroFactura.trim() && filasCompletas && !filasInvalidas && !guardando

  async function handleSubmit(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setGuardando(true)
    setError('')
    try {
      const items = filasCalculadas.map((f) => {
        const producto = productos.find((p) => p.id === f.productoId)
        return {
          productoId: producto.id,
          productoCodigo: producto.codigo,
          productoNombre: producto.nombre,
          lote: permiteLote ? f.lote.trim() : null,
          fechaEntrega: f.entregaDate,
          fechaVencimiento: f.vencimientoDate,
          dias: f.calculo.dias,
          meses: f.calculo.meses,
        }
      })
      await crearPedido(empresa, {
        cliente,
        clienteId,
        numeroFactura: numeroFactura.trim(),
        items,
        documentoSenasa: permiteAdjuntos ? documentoSenasa : null,
        documentoPermisoTransito: permiteAdjuntos ? documentoPermisoTransito : null,
        documentoFactura: permiteFactura ? documentoFactura : null,
        creadoPor: user.email,
      })
      setNumeroFactura('')
      setFilas([filaVacia()])
      setDocumentoSenasa(null)
      setDocumentoPermisoTransito(null)
      setDocumentoFactura(null)
      onSaved?.()
    } catch (err) {
      setError('No se pudo guardar el pedido. Probá de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 grid gap-4">
      <div className="max-w-xs">
        <label className="block text-sm font-medium text-gray-600 mb-1">Número de factura</label>
        <input
          type="text"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div className="grid gap-3">
        {filasCalculadas.map((f) => (
          <div key={f.key} className="border rounded-lg p-3 grid gap-3">
            <div className={`grid gap-3 ${permiteLote ? 'grid-cols-1 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-4'}`}>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
                <select
                  value={f.productoId}
                  onChange={(e) => actualizarFila(f.key, { productoId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Seleccionar…</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
                  ))}
                </select>
              </div>
              {permiteLote && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lote</label>
                  <input
                    type="text"
                    value={f.lote}
                    onChange={(e) => actualizarFila(f.key, { lote: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha entrega</label>
                <input
                  type="date"
                  value={f.fechaEntrega}
                  onChange={(e) => actualizarFila(f.key, { fechaEntrega: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha vencimiento</label>
                <input
                  type="date"
                  value={f.fechaVencimiento}
                  onChange={(e) => actualizarFila(f.key, { fechaVencimiento: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              {f.calculo && f.calculo.dias >= 0 && (
                <p className="text-sm text-gray-600">Días: <strong>{f.calculo.dias}</strong> · Meses: <strong>{f.calculo.meses}</strong></p>
              )}
              {f.calculo && f.calculo.dias < 0 && (
                <p className="text-sm text-red-600">La fecha de vencimiento no puede ser anterior a la de entrega.</p>
              )}
              {filas.length > 1 && (
                <button type="button" onClick={() => quitarFila(f.key)} className="text-xs text-red-500 hover:underline">
                  Quitar producto
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={agregarFila} className="text-sm text-orange hover:underline justify-self-start">
        + Agregar otro producto
      </button>

      {(permiteAdjuntos || permiteFactura) && (
        <div className="border rounded-lg p-4 grid gap-3">
          <h3 className="text-sm font-semibold text-dark">Documentos</h3>
          {permiteAdjuntos && (
            <>
              <SelectorDeDocumento
                etiqueta="SENASA"
                documento={documentoSenasa}
                eligiendo={eligiendo}
                onElegir={() => handleElegirDocumento(setDocumentoSenasa, 'SENASA')}
                onQuitar={() => setDocumentoSenasa(null)}
              />
              <SelectorDeDocumento
                etiqueta="Permiso de Tránsito"
                documento={documentoPermisoTransito}
                eligiendo={eligiendo}
                onElegir={() => handleElegirDocumento(setDocumentoPermisoTransito, 'Permiso de Tránsito')}
                onQuitar={() => setDocumentoPermisoTransito(null)}
              />
            </>
          )}
          {permiteFactura && (
            <SelectorDeDocumento
              etiqueta="Factura"
              documento={documentoFactura}
              eligiendo={eligiendo}
              onElegir={handleSubirFactura}
              onQuitar={() => setDocumentoFactura(null)}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!puedeGuardar}
        className="bg-orange text-white rounded-lg py-2 font-medium disabled:opacity-40 justify-self-start px-8"
      >
        {guardando ? 'Guardando…' : 'Guardar pedido'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: succeeds (note: `VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH` not being set locally yet is fine — it just becomes `undefined` in the bundle, same as any other unset `VITE_*` var, no build-time error).

- [ ] **Step 3: Commit**

```bash
git add src/components/PedidoForm.jsx
git commit -m "Add Factura upload to PedidoForm, group documentos vertically"
```

---

### Task 7: `HistorialPedidos` — show Factura, grouped "Documentos" layout

**Files:**
- Modify: `src/components/HistorialPedidos.jsx`

**Interfaces:**
- Consumes: `p.documentoFactura` (Task 4 field).
- Produces: `HistorialPedidos` gains a `permiteFactura` prop (bool).

- [ ] **Step 1: Replace the file contents**

```jsx
// src/components/HistorialPedidos.jsx
import { format } from 'date-fns'
import { eliminarPedido } from '../services/pedidos'
import { exportPedidoPdf } from '../utils/pdfExportPedido'
import { useAuth } from '../contexts/AuthContext'

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

function esUrlDeDriveValida(url) {
  return typeof url === 'string' && url.startsWith('https://drive.google.com/')
}

function DocumentoAdjunto({ etiqueta, documento }) {
  if (!esUrlDeDriveValida(documento?.url)) {
    return <span className="text-sm text-gray-400">Sin {etiqueta}</span>
  }
  return (
    <a href={documento.url} target="_blank" rel="noreferrer" className="text-sm text-orange hover:underline">
      📎 {etiqueta}: {documento.nombre}
    </a>
  )
}

export default function HistorialPedidos({ empresa, pedidos, permiteLote, permiteAdjuntos, permiteFactura, onChange }) {
  const { isAdmin } = useAuth()

  async function handleEliminar(pedido) {
    if (!confirm('¿Eliminar este pedido y todos sus productos cargados? No se puede deshacer.')) return
    await eliminarPedido(pedido)
    onChange?.()
  }

  if (pedidos.length === 0) {
    return <p className="text-gray-400 text-center py-6">Sin pedidos todavía.</p>
  }

  return (
    <div className="grid gap-4">
      {pedidos.map((p) => (
        <div key={p.id} className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b">
            <div>
              <span className="font-semibold text-dark">Factura {p.numeroFactura}</span>
              <span className="text-sm text-gray-500 ml-3">
                {p.creadoEn ? format(toDate(p.creadoEn), 'dd/MM/yyyy HH:mm') : ''}
              </span>
              <span className="text-sm text-gray-500 ml-3">{p.creadoPor}</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => exportPedidoPdf(empresa, p, permiteLote)} className="text-xs text-orange hover:underline">
                Exportar PDF
              </button>
              {isAdmin && (
                <button onClick={() => handleEliminar(p)} className="text-xs text-red-500 hover:underline">
                  Eliminar pedido
                </button>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Producto</th>
                {permiteLote && <th className="px-4 py-2">Lote</th>}
                <th className="px-4 py-2">Fecha entrega</th>
                <th className="px-4 py-2">Fecha vencimiento</th>
                <th className="px-4 py-2">Días</th>
                <th className="px-4 py-2">Meses</th>
              </tr>
            </thead>
            <tbody>
              {(p.items ?? []).map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">{item.productoNombre}</td>
                  {permiteLote && <td className="px-4 py-2">{item.lote}</td>}
                  <td className="px-4 py-2">{format(toDate(item.fechaEntrega), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-2">{format(toDate(item.fechaVencimiento), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-2">{item.dias}</td>
                  <td className="px-4 py-2">{item.meses}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(permiteAdjuntos || permiteFactura) && (
            <div className="px-4 py-3 border-t grid gap-2">
              <h3 className="text-xs font-semibold text-gray-500">Documentos</h3>
              {permiteAdjuntos && (
                <>
                  <DocumentoAdjunto etiqueta="SENASA" documento={p.documentoSenasa} />
                  <DocumentoAdjunto etiqueta="Permiso de Tránsito" documento={p.documentoPermisoTransito} />
                </>
              )}
              {permiteFactura && <DocumentoAdjunto etiqueta="Factura" documento={p.documentoFactura} />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HistorialPedidos.jsx
git commit -m "Show Factura in historial, group documentos vertically"
```

---

### Task 8: `Empresas` and `ClienteSelector` filter by access

**Files:**
- Modify: `src/pages/Empresas.jsx`
- Modify: `src/pages/ClienteSelector.jsx`

**Interfaces:**
- Consumes: `useAuth().tieneAlgunAcceso(empresa)` and `useAuth().tieneAcceso(empresa, clienteId)` (Task 3).

- [ ] **Step 1: Replace `src/pages/Empresas.jsx`**

```jsx
// src/pages/Empresas.jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoPariggi from '../assets/logo-pariggi.png'
import logoPollo from '../assets/logo-pollococido.png'

const EMPRESAS = [
  { id: 'pariggi', nombre: 'Pastas Pariggi', logo: logoPariggi },
  { id: 'pollococido', nombre: 'Pollo Cocido', logo: logoPollo },
]

export default function Empresas() {
  const { tieneAlgunAcceso } = useAuth()
  const visibles = EMPRESAS.filter((e) => tieneAlgunAcceso(e.id))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
      {visibles.map((e) => (
        <Link key={e.id} to={`/${e.id}`} className="bg-white rounded-xl shadow p-8 flex flex-col items-center gap-3 hover:shadow-md">
          <img src={e.logo} alt={e.nombre} className="h-20 object-contain" />
          <h2 className="text-lg font-semibold text-dark">{e.nombre}</h2>
        </Link>
      ))}
      {visibles.length === 0 && <p className="text-gray-400">No tenés acceso a ninguna empresa todavía.</p>}
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/pages/ClienteSelector.jsx`**

```jsx
// src/pages/ClienteSelector.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClientes, seedClientesSiVacio } from '../services/clientes'
import { useAuth } from '../contexts/AuthContext'
import logoCedisur from '../assets/logo-cedisur.jpg'
import logoGrandwich from '../assets/logo-grandwich.png'

const LOGOS = {
  cedisur: logoCedisur,
  grandwich: logoGrandwich,
}

const NOMBRES_EMPRESA = { pariggi: 'Pastas Pariggi', pollococido: 'Pollo Cocido' }

export default function ClienteSelector({ empresa }) {
  const { tieneAcceso } = useAuth()
  const [clientes, setClientes] = useState([])

  useEffect(() => {
    seedClientesSiVacio(empresa).then(() => listClientes(empresa)).then((items) =>
      setClientes(items.filter((c) => c.activo && tieneAcceso(empresa, c.id)))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa])

  return (
    <div>
      <Link to="/" className="text-sm text-gray-500 hover:underline">← Volver a empresas</Link>
      <h1 className="text-xl font-semibold text-dark mb-4 mt-2">{NOMBRES_EMPRESA[empresa]} — Elegir cliente</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        {clientes.map((c) => (
          <Link
            key={c.id}
            to={`/${empresa}/${c.id}`}
            className="bg-white rounded-xl shadow p-8 flex flex-col items-center gap-3 hover:shadow-md"
          >
            {LOGOS[c.id] ? (
              <img src={LOGOS[c.id]} alt={c.nombre} className="h-20 object-contain" />
            ) : (
              <div className="h-20 flex items-center text-2xl font-semibold text-dark">{c.nombre}</div>
            )}
            <h2 className="text-lg font-semibold text-dark">{c.nombre}</h2>
          </Link>
        ))}
        {clientes.length === 0 && <p className="text-gray-400">Sin clientes disponibles.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Empresas.jsx src/pages/ClienteSelector.jsx
git commit -m "Filter empresas/clientes lists by user access"
```

---

### Task 9: `Pedidos` page — access guard + hide form for lectura

**Files:**
- Modify: `src/pages/Pedidos.jsx`

**Interfaces:**
- Consumes: `useAuth().tieneAcceso`, `useAuth().puedeCrear` (Task 3); `PedidoForm`/`HistorialPedidos` new props `clienteId`/`permiteFactura` (Tasks 6, 7).
- Produces: computes `permiteFactura = empresa === 'pollococido' && clienteId === 'grandwich'` — this is the one and only place that hardcodes the Grandwich-only rule.

- [ ] **Step 1: Replace the file contents**

```jsx
// src/pages/Pedidos.jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listClientes } from '../services/clientes'
import { listPedidos } from '../services/pedidos'
import PedidoForm from '../components/PedidoForm'
import HistorialPedidos from '../components/HistorialPedidos'
import { useAuth } from '../contexts/AuthContext'

export default function Pedidos({ empresa, permiteLote, permiteAdjuntos }) {
  const { clienteId } = useParams()
  const { tieneAcceso, puedeCrear } = useAuth()
  const [clienteNombre, setClienteNombre] = useState('')
  const [pedidos, setPedidos] = useState([])

  const autorizado = tieneAcceso(empresa, clienteId)
  const permiteFactura = empresa === 'pollococido' && clienteId === 'grandwich'

  useEffect(() => {
    if (!autorizado) return
    listClientes(empresa).then((items) => {
      const c = items.find((i) => i.id === clienteId)
      setClienteNombre(c?.nombre ?? clienteId)
    })
  }, [empresa, clienteId, autorizado])

  async function reload() {
    if (!clienteNombre) return
    setPedidos(await listPedidos(empresa, clienteNombre))
  }

  useEffect(() => { reload() }, [clienteNombre])

  if (!autorizado) {
    return <p className="text-gray-500">No tenés acceso a este cliente.</p>
  }

  return (
    <div className="grid gap-6">
      <Link to={`/${empresa}`} className="text-sm text-gray-500 hover:underline">← Volver a clientes</Link>
      <h1 className="text-xl font-semibold text-dark">{clienteNombre}</h1>
      {puedeCrear && (
        <PedidoForm
          empresa={empresa}
          cliente={clienteNombre}
          clienteId={clienteId}
          permiteLote={permiteLote}
          permiteAdjuntos={permiteAdjuntos}
          permiteFactura={permiteFactura}
          onSaved={reload}
        />
      )}
      <h2 className="font-medium text-dark">Pedidos cargados</h2>
      <HistorialPedidos
        empresa={empresa}
        pedidos={pedidos}
        permiteLote={permiteLote}
        permiteAdjuntos={permiteAdjuntos}
        permiteFactura={permiteFactura}
        onChange={reload}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Pedidos.jsx
git commit -m "Guard Pedidos page by access, hide form for lectura role"
```

---

### Task 10: `Layout` — hide Ajustes link for non-admins

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Replace the file contents**

```jsx
// src/components/Layout.jsx
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoTrazabilidad from '../assets/logo-trazabilidad.png'

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-dark">
          <img src={logoTrazabilidad} alt="" className="h-7 w-7" />
          Trazabilidad
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {isAdmin && <Link to="/ajustes" className="hover:underline">Ajustes</Link>}
          <span>{user?.email}</span>
          <button onClick={logout} className="text-orange hover:underline">Salir</button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "Hide Ajustes nav link for non-admin roles"
```

---

### Task 11: `Ajustes` — admin-only gate + rol/acceso selector

**Files:**
- Modify: `src/pages/Ajustes.jsx`

**Interfaces:**
- Consumes: `listUsuariosAutorizados()`/`addUsuarioAutorizado(email, agregadoPor, rol, acceso)` (Task 2), `useAuth().isAdmin` (Task 3).

- [ ] **Step 1: Replace the file contents**

```jsx
// src/pages/Ajustes.jsx
import { useEffect, useState } from 'react'
import { listProductos, addProducto, setProductoActivo } from '../services/productos'
import { listClientes, addCliente, setClienteActivo } from '../services/clientes'
import { listUsuariosAutorizados, addUsuarioAutorizado, removeUsuarioAutorizado } from '../services/usuarios'
import { useAuth } from '../contexts/AuthContext'

const EMPRESAS = ['pariggi', 'pollococido']
const NOMBRES_EMPRESA = { pariggi: 'Pastas Pariggi', pollococido: 'Pollo Cocido' }

function accesoVacio() {
  return { pariggi: { todas: false, clientes: [] }, pollococido: { todas: false, clientes: [] } }
}

function resumenAcceso(usuario) {
  if (usuario.rol === 'admin') return 'Todo'
  const partes = EMPRESAS.filter((e) => usuario.acceso?.[e]).map((e) => {
    const permiso = usuario.acceso[e]
    const alcance = permiso.todas ? 'todas' : (permiso.clientes ?? []).join(', ') || 'ninguno'
    return `${NOMBRES_EMPRESA[e]} (${alcance})`
  })
  return partes.length > 0 ? partes.join(' · ') : 'sin acceso'
}

export default function Ajustes() {
  const { user, isAdmin } = useAuth()
  const [empresa, setEmpresa] = useState('pariggi')
  const [productos, setProductos] = useState([])
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [clientes, setClientes] = useState([])
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState('lectura')
  const [nuevoAcceso, setNuevoAcceso] = useState(accesoVacio())
  const [clientesPorEmpresa, setClientesPorEmpresa] = useState({ pariggi: [], pollococido: [] })

  async function reloadProductos() {
    setProductos(await listProductos(empresa))
  }
  async function reloadClientes() {
    setClientes(await listClientes(empresa))
  }
  async function reloadUsuarios() {
    setUsuarios(await listUsuariosAutorizados())
  }

  useEffect(() => {
    if (!isAdmin) return
    reloadProductos()
    reloadClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    reloadUsuarios()
    Promise.all(EMPRESAS.map((e) => listClientes(e))).then(([pariggi, pollococido]) =>
      setClientesPorEmpresa({ pariggi, pollococido })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function handleAddProducto(e) {
    e.preventDefault()
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) return
    await addProducto(empresa, { codigo: nuevoCodigo.trim(), nombre: nuevoNombre.trim() })
    setNuevoCodigo('')
    setNuevoNombre('')
    reloadProductos()
  }

  async function handleAddCliente(e) {
    e.preventDefault()
    if (!nuevoCliente.trim()) return
    await addCliente(empresa, nuevoCliente.trim())
    setNuevoCliente('')
    reloadClientes()
  }

  function toggleTodas(empresaId) {
    setNuevoAcceso((prev) => ({ ...prev, [empresaId]: { todas: !prev[empresaId].todas, clientes: [] } }))
  }

  function toggleClienteAcceso(empresaId, clienteId) {
    setNuevoAcceso((prev) => {
      const actuales = prev[empresaId].clientes
      const clientes = actuales.includes(clienteId)
        ? actuales.filter((id) => id !== clienteId)
        : [...actuales, clienteId]
      return { ...prev, [empresaId]: { todas: false, clientes } }
    })
  }

  async function handleAddUsuario(evento) {
    evento.preventDefault()
    if (!nuevoEmail.trim()) return
    const acceso = {}
    for (const empresaId of EMPRESAS) {
      const permiso = nuevoAcceso[empresaId]
      if (permiso.todas || permiso.clientes.length > 0) {
        acceso[empresaId] = permiso.todas ? { todas: true } : { clientes: permiso.clientes }
      }
    }
    await addUsuarioAutorizado(nuevoEmail.trim(), user.email, nuevoRol, acceso)
    setNuevoEmail('')
    setNuevoRol('lectura')
    setNuevoAcceso(accesoVacio())
    reloadUsuarios()
  }

  if (!isAdmin) {
    return <p className="text-gray-500">No tenés acceso a esta página.</p>
  }

  return (
    <div className="grid gap-8 max-w-2xl">
      <div className="flex gap-2">
        <button onClick={() => setEmpresa('pariggi')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pariggi' ? 'bg-orange text-white' : 'bg-white'}`}>Pariggi</button>
        <button onClick={() => setEmpresa('pollococido')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pollococido' ? 'bg-pollo text-white' : 'bg-white'}`}>Pollo Cocido</button>
      </div>

      <section>
        <h2 className="font-medium text-dark mb-3">Clientes</h2>
        <ul className="bg-white rounded-xl shadow divide-y">
          {clientes.map((c) => (
            <li key={c.id} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>{c.nombre}</span>
              <button onClick={() => setClienteActivo(empresa, c.id, !c.activo).then(reloadClientes)} className="text-xs text-gray-500 hover:underline">
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddCliente} className="flex gap-2 mt-3">
          <input placeholder="Nombre del cliente" value={nuevoCliente} onChange={(e) => setNuevoCliente(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button type="submit" className="bg-dark text-white rounded-lg px-4 text-sm">Agregar</button>
        </form>
      </section>

      <section>
        <h2 className="font-medium text-dark mb-3">Catálogo de productos</h2>
        <ul className="bg-white rounded-xl shadow divide-y">
          {productos.map((p) => (
            <li key={p.id} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>{p.codigo} — {p.nombre}</span>
              <button onClick={() => setProductoActivo(empresa, p.id, !p.activo).then(reloadProductos)} className="text-xs text-gray-500 hover:underline">
                {p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddProducto} className="flex gap-2 mt-3">
          <input placeholder="Código" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-28" />
          <input placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button type="submit" className="bg-dark text-white rounded-lg px-4 text-sm">Agregar</button>
        </form>
      </section>

      <section>
        <h2 className="font-medium text-dark mb-3">Usuarios autorizados</h2>
        <ul className="bg-white rounded-xl shadow divide-y">
          {usuarios.map((u) => (
            <li key={u.email} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>
                {u.email}
                <span className="text-xs text-gray-400 ml-2">{u.rol} — {resumenAcceso(u)}</span>
              </span>
              <button onClick={() => removeUsuarioAutorizado(u.email).then(reloadUsuarios)} className="text-xs text-red-500 hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddUsuario} className="grid gap-3 mt-3 bg-white rounded-xl shadow p-4">
          <div className="flex gap-2">
            <input type="email" required placeholder="email@dominio.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
            <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="lectura">Lectura</option>
              <option value="edicion">Edición</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {nuevoRol !== 'admin' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {EMPRESAS.map((e) => (
                <div key={e}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{NOMBRES_EMPRESA[e]}</p>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <input type="checkbox" checked={nuevoAcceso[e].todas} onChange={() => toggleTodas(e)} />
                    Toda la empresa
                  </label>
                  {!nuevoAcceso[e].todas && clientesPorEmpresa[e].map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={nuevoAcceso[e].clientes.includes(c.id)} onChange={() => toggleClienteAcceso(e, c.id)} />
                      {c.nombre}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
          <button type="submit" className="bg-dark text-white rounded-lg px-4 py-2 text-sm justify-self-start">Agregar / actualizar usuario</button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite, build, and lint**

Run: `npm test && npm run build && npm run lint`
Expected: all pass. This is the first point where every file in the plan compiles together — if anything regressed in earlier tasks it surfaces here.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Ajustes.jsx
git commit -m "Add admin-only gate and rol/acceso selector to Ajustes"
```

---

### Task 12: `firestore.rules` — enforce rol/acceso

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace the file contents**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function usuario() {
      return get(/databases/$(database)/documents/usuariosAutorizados/$(request.auth.token.email)).data;
    }

    function isAuthorized() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/usuariosAutorizados/$(request.auth.token.email));
    }

    function isAdmin() {
      return isAuthorized() && usuario().rol == 'admin';
    }

    function puedeCrear() {
      return isAuthorized() && usuario().rol in ['admin', 'edicion'];
    }

    function tieneAcceso(empresa, clienteId) {
      let u = usuario();
      return u.rol == 'admin' ||
        (('acceso' in u) && (empresa in u.acceso) &&
          (u.acceso[empresa].todas == true ||
            (('clientes' in u.acceso[empresa]) && clienteId in u.acceso[empresa].clientes)));
    }

    match /usuariosAutorizados/{email} {
      allow read: if isAuthorized();
      allow write: if isAdmin();
    }

    match /productos/{empresa}/items/{productoId} {
      allow read: if isAuthorized();
      allow write: if isAdmin();
    }

    match /clientes/{empresa}/items/{clienteId} {
      allow read: if isAuthorized();
      allow write: if isAdmin();
    }

    // Los documentos (SENASA / Permiso de Tránsito / Factura) se cargan solo
    // al crear el pedido — no existe una vía de update, así que un pedido ya
    // guardado no se puede alterar, solo leer o borrar (admin).
    match /pedidos/{pedidoId} {
      allow read: if isAuthorized() && tieneAcceso(resource.data.empresa, resource.data.clienteId);
      allow create: if puedeCrear() &&
        tieneAcceso(request.resource.data.empresa, request.resource.data.clienteId) &&
        request.resource.data.creadoPor == request.auth.token.email;
      allow delete: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Commit (do not deploy yet — see Task 14 for why)**

```bash
git add firestore.rules
git commit -m "Enforce rol/acceso in Firestore rules"
```

---

### Task 13: Wire the new Drive folder env var

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add the line to `.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_API_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_DRIVE_FOLDER_ID=
VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH=
```

- [ ] **Step 2: Add the env mapping to the build step in `.github/workflows/deploy.yml`**

Modify the `env:` block under `- run: npm run build` to add one line:

```yaml
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_GOOGLE_API_KEY: ${{ secrets.VITE_GOOGLE_API_KEY }}
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GOOGLE_DRIVE_FOLDER_ID: ${{ secrets.VITE_GOOGLE_DRIVE_FOLDER_ID }}
          VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH: ${{ secrets.VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH }}
```

- [ ] **Step 3: Set the GitHub Actions secret**

Run (folder ID confirmed by the user, taken from `https://drive.google.com/drive/u/0/folders/1XXvWllCM04LBQIlPutQwTnem1ZFfa2QW`):

```bash
gh secret set VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "1XXvWllCM04LBQIlPutQwTnem1ZFfa2QW"
```

Verify: `gh secret list --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo` shows `VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH` in the list.

- [ ] **Step 4: Add the same value to local `.env.local` for local dev**

Check whether `.env.local` exists (`ls -la` in repo root); if it does, append the line manually (it's gitignored, not committed) — `VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH=1XXvWllCM04LBQIlPutQwTnem1ZFfa2QW`. If it doesn't exist, skip this step (there's no local dev session to support right now).

- [ ] **Step 5: Commit**

```bash
git add .env.example .github/workflows/deploy.yml
git commit -m "Wire VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH"
```

---

### Task 14: Migrate the 3 `usuariosAutorizados` docs (data, not code)

**Files:** none — this is a Firestore data operation, done with the `mcp__firebase__firestore_update_document` and `mcp__firebase__firestore_get_document` MCP tools. Run this task with the Firebase MCP server's active project directory set to the trazabilidad repo (`mcp__firebase__firebase_update_environment` with `project_dir` pointing at it, if it isn't already).

**Why before Task 15:** the new `firestore.rules` (Task 12, committed but not yet deployed) check `usuario().rol`. If deployed before every existing user has a `rol` field, every request — including Imanol's — would fail rule evaluation and lock everyone out. Migrating data first is safe because the *currently deployed* rules only look at `admin`/`isAuthorized`, which ignore the new fields.

- [ ] **Step 1: Update Imanol's doc to `rol: 'admin'`**

Call `mcp__firebase__firestore_update_document` with:
- `document.name`: `projects/trazabilidad-pariggi-pollo/databases/(default)/documents/usuariosAutorizados/imanollopezgonzalez@gmail.com`
- `document.fields`: `{ "rol": { "stringValue": "admin" }, "acceso": { "mapValue": { "fields": {} } } }`
- `updateMask.fieldPaths`: `["rol", "acceso"]`

(This only touches `rol`/`acceso`, leaving the pre-existing `admin: true` and `Ok: true` fields untouched — harmless leftovers the new rules never read.)

- [ ] **Step 2: Update Iván's doc to `rol: 'edicion'`, acceso a ambas empresas completas**

Call `mcp__firebase__firestore_update_document` with:
- `document.name`: `projects/trazabilidad-pariggi-pollo/databases/(default)/documents/usuariosAutorizados/ivan.larez@pollococido.com.ar`
- `document.fields`:
```json
{
  "rol": { "stringValue": "edicion" },
  "acceso": {
    "mapValue": {
      "fields": {
        "pariggi": { "mapValue": { "fields": { "todas": { "booleanValue": true } } } },
        "pollococido": { "mapValue": { "fields": { "todas": { "booleanValue": true } } } }
      }
    }
  }
}
```
- `updateMask.fieldPaths`: `["rol", "acceso"]`

- [ ] **Step 3: Create Hernán's doc — `rol: 'lectura'`, acceso solo a Pollo Cocido → Grandwich**

Call `mcp__firebase__firestore_update_document` with:
- `document.name`: `projects/trazabilidad-pariggi-pollo/databases/(default)/documents/usuariosAutorizados/hernan.o@pollococido.com.ar`
- `document.fields`:
```json
{
  "rol": { "stringValue": "lectura" },
  "acceso": {
    "mapValue": {
      "fields": {
        "pollococido": {
          "mapValue": {
            "fields": {
              "clientes": { "arrayValue": { "values": [ { "stringValue": "grandwich" } ] } }
            }
          }
        }
      }
    }
  },
  "agregadoPor": { "stringValue": "imanollopezgonzalez@gmail.com" }
}
```
- `updateMask.fieldPaths`: `["rol", "acceso", "agregadoPor"]`

(`firestore_update_document` creates the document if it doesn't exist, per the tool's own description — no separate create call needed.)

- [ ] **Step 4: Verify all three docs**

Call `mcp__firebase__firestore_list_documents` with `parent: projects/trazabilidad-pariggi-pollo/databases/(default)/documents`, `collectionId: usuariosAutorizados`. Confirm all 3 emails are present with the expected `rol`/`acceso` fields.

- [ ] **Step 5: Backfill `clienteId` on existing `pedidos` docs**

The new read rule (Task 12) checks `resource.data.clienteId`, but pedidos created before Task 4 landed don't have that field — a client-scoped user (like Hernán) would silently be unable to read them once the new rules deploy. As of this writing there's exactly one pedido in production: `pedidos/mgkAbrY6OmKX7nfo0nyc` (`empresa: 'pollococido'`, `cliente: 'Grandwich'`).

Call `mcp__firebase__firestore_update_document` with:
- `document.name`: `projects/trazabilidad-pariggi-pollo/databases/(default)/documents/pedidos/mgkAbrY6OmKX7nfo0nyc`
- `document.fields`: `{ "clienteId": { "stringValue": "grandwich" } }`
- `updateMask.fieldPaths`: `["clienteId"]`

Before doing this, re-run the same `firestore_query_collection` on `pedidos` (empty filter list, limit 50) used to discover this doc, in case new pedidos were created between planning and execution — backfill `clienteId` (lowercased `cliente` name, matching the `clientes/{empresa}/items/{id}` doc id convention) on every doc missing it, not just this one.

---

### Task 15: Deploy the new Firestore rules

**Files:** none — deployment step.

**Depends on:** Task 12 (rules committed) and Task 14 (data migrated) both done.

- [ ] **Step 1: Deploy**

Call `mcp__firebase__firebase_deploy` with `only: "firestore"` (project directory already set to the trazabilidad repo from Task 14).

- [ ] **Step 2: Verify**

Call `mcp__firebase__firestore_get_document` for `usuariosAutorizados/imanollopezgonzalez@gmail.com` — a successful read (not a permission error) confirms the deployed rules parse correctly and admin access still works via the MCP service-account context. Note this doesn't fully validate per-user `request.auth` behavior (MCP reads use admin credentials, bypassing rules) — real validation happens in the Task 16 manual smoke test.

---

### Task 16: Push to deploy the frontend, then manual smoke test

**Files:** none.

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

This triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages using the secrets set in Task 13.

- [ ] **Step 2: Watch the deploy**

```bash
gh run watch --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo
```

Expected: the `Deploy` workflow run completes successfully.

- [ ] **Step 3: Manual smoke test checklist**

Report these to the user rather than assuming — sign-in as each of the three roles isn't something this session can automate (real Google OAuth popups), so this is a checklist for the user to run themselves right after deploy, not an automated step:

- Imanol (admin): sees both empresas, all clientes, Ajustes fully works, can still delete a pedido.
- Iván (edición): sees both empresas, all clientes, can load a pedido for Grandwich including the new Factura button (uploads from device into the new Drive folder), does NOT see "Ajustes" in the nav.
- Hernán (lectura): after logging in for the first time, only sees "Pollo Cocido" → only "Grandwich"; does NOT see the pedido form (no "Guardar pedido"); can open/download SENASA, Permiso de Tránsito, and Factura links for existing Grandwich pedidos; does NOT see "Ajustes".
- Confirm Hernán's Google account actually has Viewer access on both Drive folders (the SENASA/Permiso one and the new Factura one) — without that, the links resolve but Drive itself will deny opening them, which is a Drive-sharing issue, not an app bug.

Report the checklist result back once the user has run through it.
