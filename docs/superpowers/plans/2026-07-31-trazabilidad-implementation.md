# Trazabilidad Pariggi / Pollo Cocido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a standalone web app where depósito staff at Pastas Pariggi and Pollo Cocido log delivery/expiration traceability records (with PDF export for Pariggi, scanned-document attachments for Pollo Cocido), replacing the manual Excel process.

**Architecture:** React + Vite SPA, Firebase (Auth + Firestore + Storage) as the only backend, deployed as a static site to GitHub Pages via GitHub Actions. Google Sign-In gated by an email whitelist stored in Firestore, enforced both client-side and in security rules.

**Tech Stack:** React 18, Vite, react-router-dom, Tailwind CSS, firebase (modular v10 SDK), jspdf + jspdf-autotable, date-fns, Vitest.

## Global Constraints

- Repo root: `C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\trazabilidad-pariggi-pollo`
- GitHub repo name / Vite `base`: `trazabilidad-pariggi-pollo`
- Días/meses formula (verified against real Cedisur spreadsheet): `dias = fechaVencimiento - fechaEntrega` (calendar days); `meses = round(dias / 30, 1)`
- Whitelist seed emails: `imanollopezgonzalez@gmail.com`, `ivan.larez@pollococido.com.ar`
- Firestore/Storage access requires `usuariosAutorizados/{email}` to exist — enforced in security rules, not just the frontend
- No PIN/password auth — Google Sign-In only
- Pariggi catálogo (código, nombre): 10201 Cables de Teléfono al Huevo; 6010 Bucatini; 10202 Cuerdas de guitarra al huevo; 20301 Cables de Teléfono Integrales; 30101 Ñoquis de Pura Papa; 50201 Ravioles de Ricota Sicilianos; 60202 Raviolones de Espinaca y Provolone; 70205 Sorrentinos de Jamón y Mozzarella; 70206 Sorrentinos de Calabaza de Ferrara; 101070207 Foglia de Lasagna; 101070208 Ñoquis a la Romana con Parmesano; 101030103 Ñoquis de Espinaca; 1030102 Ñoquis de Calabaza; 101010203 Tagliatelle de Espinaca; 101010204 Puntallete 1,5 kg; 101010210 Puntallete 1 kg
- Pollo Cocido catálogo: 200324 Milanesa de Pollo; 200222 Pechuga 90/110 grs; 200223 Pechuga 150/180 grs; 200224 Trocitos de 20x20x20; 200305 Bifecitos Neo; 200243 Fingers de Pollo

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `src/main.jsx`, `src/App.jsx`, `src/index.css`

**Interfaces:**
- Produces: a Vite dev server on `npm run dev`, Tailwind classes available app-wide, `<App />` root component later tasks add routes/providers to.

- [ ] **Step 1: Scaffold with Vite**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\trazabilidad-pariggi-pollo"
npm create vite@latest . -- --template react
```

- [ ] **Step 2: Install dependencies**

```bash
npm install firebase react-router-dom jspdf jspdf-autotable date-fns
npm install -D tailwindcss postcss autoprefixer vitest
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF8F5',
        dark: '#1C1917',
        orange: '#D97757',
        pollo: '#C97A2B',
      },
    },
  },
  plugins: [],
}
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-cream text-dark;
}
```

- [ ] **Step 4: Set GitHub Pages base path**

`vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/trazabilidad-pariggi-pollo/',
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 5: Add `.gitignore` entries**

`.gitignore`:
```
node_modules
dist
.env
.env.local
```

- [ ] **Step 6: Verify dev server runs**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`) with no errors. Stop the server after confirming.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+Tailwind project"
```

---

## Task 2: Firebase project + config

**Files:**
- Create: `src/firebase.js`, `.env.local` (not committed), `.env.example`

**Interfaces:**
- Produces: `auth`, `googleProvider`, `db`, `storage` exports from `src/firebase.js`, consumed by every later task that touches Firebase.

- [ ] **Step 1: Create the Firebase project**

Use the `mcp__firebase__firebase_create_project` tool to create a new project (suggest project id `trazabilidad-pariggi-pollo`, display name "Trazabilidad Pariggi Pollo"). Record the returned `projectId`.

- [ ] **Step 2: Register a Web App**

Use `mcp__firebase__firebase_create_app` with `platform: WEB`, `project_id` from Step 1, `display_name: "Trazabilidad Web"`. Then use `mcp__firebase__firebase_get_sdk_config` (platform WEB) to retrieve `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

- [ ] **Step 3: Enable required products (manual, one-time)**

Tell the user to open the Firebase console for this project and:
1. Authentication → Sign-in method → enable **Google**.
2. Firestore Database → create database (production mode, region `southamerica-east1` or closest available).
3. Storage → get started (production mode, same region).

These three toggles have no MCP tool exposed — confirm with the user they're done before continuing to Task 5 (security rules deploy will fail otherwise).

- [ ] **Step 4: Write env files**

`.env.example`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

`.env.local` (fill with real values from Step 2, this file is gitignored):
```
VITE_FIREBASE_API_KEY=<real value>
VITE_FIREBASE_AUTH_DOMAIN=<real value>
VITE_FIREBASE_PROJECT_ID=<real value>
VITE_FIREBASE_STORAGE_BUCKET=<real value>
VITE_FIREBASE_MESSAGING_SENDER_ID=<real value>
VITE_FIREBASE_APP_ID=<real value>
```

- [ ] **Step 5: Write the Firebase client module**

`src/firebase.js`:
```js
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
```

- [ ] **Step 6: Verify config loads**

Run: `npm run dev`, open the printed URL, open the browser console.
Expected: no "Firebase: Error (auth/invalid-api-key)" or similar in the console — confirms `.env.local` values are correct.

- [ ] **Step 7: Commit**

```bash
git add src/firebase.js .env.example .gitignore
git commit -m "feat: add Firebase project config"
```
(`.env.local` stays untracked — verify with `git status` that it does NOT appear staged.)

---

## Task 3: Días/meses calculation (TDD)

**Files:**
- Create: `src/lib/trazabilidad.js`
- Test: `src/lib/trazabilidad.test.js`

**Interfaces:**
- Produces: `calcDiasMeses(fechaEntrega: Date, fechaVencimiento: Date) => { dias: number, meses: number }`, used by both delivery forms (Tasks 9 and 11).

- [ ] **Step 1: Write the failing tests**

`src/lib/trazabilidad.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { calcDiasMeses } from './trazabilidad.js'

describe('calcDiasMeses', () => {
  it('calcula 49 dias y 1.6 meses (fila real: Ñoquis de Pura Papa, planilla Cedisur)', () => {
    const { dias, meses } = calcDiasMeses(new Date(2025, 11, 19), new Date(2026, 1, 6))
    expect(dias).toBe(49)
    expect(meses).toBe(1.6)
  })

  it('calcula 51 dias y 1.7 meses (fila real: Ravioles de Ricota, planilla Cedisur)', () => {
    const { dias, meses } = calcDiasMeses(new Date(2025, 11, 19), new Date(2026, 1, 8))
    expect(dias).toBe(51)
    expect(meses).toBe(1.7)
  })

  it('calcula 608 dias y 20.3 meses (fila real: Sorrentinos de Jamon y Queso, planilla Cedisur)', () => {
    const { dias, meses } = calcDiasMeses(new Date(2024, 5, 12), new Date(2026, 1, 10))
    expect(dias).toBe(608)
    expect(meses).toBe(20.3)
  })

  it('devuelve dias negativos si el vencimiento es anterior a la entrega, para que la UI bloquee el guardado', () => {
    const { dias } = calcDiasMeses(new Date(2026, 0, 10), new Date(2026, 0, 1))
    expect(dias).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/trazabilidad.test.js`
Expected: FAIL — `trazabilidad.js` does not exist yet.

- [ ] **Step 3: Implement**

`src/lib/trazabilidad.js`:
```js
const MS_PER_DAY = 1000 * 60 * 60 * 24

export function calcDiasMeses(fechaEntrega, fechaVencimiento) {
  const dias = Math.round((fechaVencimiento.getTime() - fechaEntrega.getTime()) / MS_PER_DAY)
  const meses = Math.round((dias / 30) * 10) / 10
  return { dias, meses }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/trazabilidad.test.js`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trazabilidad.js src/lib/trazabilidad.test.js
git commit -m "feat: add dias/meses calculation with tests against real Cedisur data"
```

---

## Task 4: Auth (Google Sign-In + whitelist)

**Files:**
- Create: `src/contexts/AuthContext.jsx`, `src/pages/Login.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `auth`, `googleProvider`, `db` from `src/firebase.js` (Task 2).
- Produces: `AuthProvider`, `useAuth() => { user, status, login, logout }` where `status` is `'loading' | 'signed-out' | 'unauthorized' | 'authorized'`. Every later page consumes `useAuth()`.

- [ ] **Step 1: Write the auth context**

`src/contexts/AuthContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setStatus('signed-out')
        return
      }
      const email = firebaseUser.email?.toLowerCase()
      const authDoc = await getDoc(doc(db, 'usuariosAutorizados', email))
      if (!authDoc.exists()) {
        await signOut(auth)
        setUser(null)
        setStatus('unauthorized')
        return
      }
      setUser(firebaseUser)
      setStatus('authorized')
    })
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Write the login page**

`src/pages/Login.jsx`:
```jsx
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { status, login } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold text-dark mb-2">Trazabilidad Pariggi / Pollo Cocido</h1>
        <p className="text-sm text-gray-500 mb-6">Ingresá con tu cuenta de Google autorizada.</p>
        {status === 'unauthorized' && (
          <p className="text-sm text-red-600 mb-4">
            Tu cuenta no tiene acceso a esta herramienta. Pedile a Imanol que te agregue.
          </p>
        )}
        <button
          onClick={login}
          className="w-full bg-orange text-white rounded-lg py-2 font-medium hover:opacity-90"
        >
          Ingresar con Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the provider and gate the app**

`src/App.jsx`:
```jsx
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'

function Gate() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>
  }
  if (status !== 'authorized') {
    return <Login />
  }
  return <div className="p-8">Sesión iniciada. Rutas reales se agregan en la Tarea 8.</div>
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
```

- [ ] **Step 4: Manually create the first whitelist doc**

This must exist before anyone can log in successfully (Task 5's rules require it, and Task 13's Ajustes page to manage it doesn't exist yet). In the Firebase console → Firestore → create collection `usuariosAutorizados` → document ID `imanollopezgonzalez@gmail.com` with fields `agregadoPor: "setup"`, `agregadoEn: <any timestamp>`. Repeat for `ivan.larez@pollococido.com.ar`.

- [ ] **Step 5: Verify manually in browser**

Run: `npm run dev`, open the app, click "Ingresar con Google", sign in with `imanollopezgonzalez@gmail.com`.
Expected: after the Google popup closes, the page shows "Sesión iniciada." (not the unauthorized message).

- [ ] **Step 6: Commit**

```bash
git add src/contexts/AuthContext.jsx src/pages/Login.jsx src/App.jsx
git commit -m "feat: add Google Sign-In gated by Firestore whitelist"
```

---

## Task 5: Security rules

**Files:**
- Create: `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc`

**Interfaces:**
- Produces: deployed Firestore + Storage rules that every later Firestore/Storage-touching task relies on for correctness (not just app code).

- [ ] **Step 1: Write Firestore rules**

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthorized() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/usuariosAutorizados/$(request.auth.token.email));
    }

    match /usuariosAutorizados/{email} {
      allow read, write: if isAuthorized();
    }

    match /productos/{empresa}/items/{productoId} {
      allow read, write: if isAuthorized();
    }

    match /entregas/{entregaId} {
      allow read, update, delete: if isAuthorized();
      allow create: if isAuthorized() &&
        request.resource.data.creadoPor == request.auth.token.email;
    }
  }
}
```

- [ ] **Step 2: Write Storage rules**

`storage.rules`:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /permisos/{empresa}/{entregaId}/{fileName} {
      allow read, write: if request.auth != null &&
        firestore.exists(/databases/(default)/documents/usuariosAutorizados/$(request.auth.token.email)) &&
        request.resource.size < 15 * 1024 * 1024;
    }
  }
}
```

- [ ] **Step 3: Write Firebase project config files**

`.firebaserc` (replace `<projectId>` with the value from Task 2 Step 1):
```json
{
  "projects": {
    "default": "<projectId>"
  }
}
```

`firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 4: Validate the rules**

Use `mcp__firebase__firebase_validate_security_rules` for both `firestore.rules` and `storage.rules` against the project from Task 2.
Expected: no syntax errors reported.

- [ ] **Step 5: Deploy the rules**

Use `mcp__firebase__firebase_deploy` with `only: ["firestore:rules", "storage:rules"]` for this project.
Expected: deploy reports success for both.

- [ ] **Step 6: Verify enforcement manually**

In the Firebase console → Firestore, try deleting the `usuariosAutorizados/imanollopezgonzalez@gmail.com` doc, then in the running app try to load any authorized page — it should now sign the user out and show "no autorizado" (per Task 4's `Gate`). Re-create the doc afterward so the account keeps working.

- [ ] **Step 7: Commit**

```bash
git add firestore.rules storage.rules firebase.json .firebaserc
git commit -m "feat: add and deploy Firestore/Storage security rules"
```

---

## Task 6: Productos service + catálogo seed

**Files:**
- Create: `src/services/productos.js`

**Interfaces:**
- Consumes: `db` from `src/firebase.js`.
- Produces: `PARIGGI_CATALOGO`, `POLLO_CATALOGO` (arrays of `{ codigo, nombre }`), `listProductos(empresa) => Promise<Array<{id, codigo, nombre, activo}>>`, `seedCatalogoSiVacio(empresa) => Promise<void>`, `addProducto(empresa, { codigo, nombre }) => Promise<void>`, `setProductoActivo(empresa, productoId, activo) => Promise<void>`. Consumed by Tasks 9, 11, 13.

- [ ] **Step 1: Write the service with hardcoded real catalogs**

`src/services/productos.js`:
```js
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
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
```

- [ ] **Step 2: Trigger the seed once from the app**

Temporarily add to `src/App.jsx`'s `Gate` component (inside the `authorized` branch, replacing the placeholder text from Task 4):
```jsx
import { useEffect } from 'react'
import { seedCatalogoSiVacio } from './services/productos'
// ...
useEffect(() => {
  seedCatalogoSiVacio('pariggi')
  seedCatalogoSiVacio('pollococido')
}, [])
```

- [ ] **Step 3: Verify seed ran**

Run: `npm run dev`, log in, check the Firebase console → Firestore → `productos/pariggi/items` has 16 docs and `productos/pollococido/items` has 6 docs with the correct códigos/nombres.

- [ ] **Step 4: Commit**

```bash
git add src/services/productos.js src/App.jsx
git commit -m "feat: add productos service with real Pariggi and Pollo Cocido catalogs"
```

---

## Task 7: Entregas service (CRUD + Storage upload)

**Files:**
- Create: `src/services/entregas.js`

**Interfaces:**
- Consumes: `db`, `storage` from `src/firebase.js`.
- Produces: `crearEntregaPariggi({ cliente, productoId, productoCodigo, productoNombre, fechaEntrega, fechaVencimiento, dias, meses, creadoPor }) => Promise<string>`, `crearEntregaPollo({ ...same fields plus lote, archivo: File|null }) => Promise<string>`, `listEntregas(empresa) => Promise<Array<entrega>>`. Consumed by Tasks 9, 10, 11, 12.

- [ ] **Step 1: Write the service**

`src/services/entregas.js`:
```js
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'

const entregasRef = collection(db, 'entregas')

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

export async function crearEntregaPollo(datos) {
  const entregaId = await crearEntregaBase('pollococido', { ...datos, cliente: datos.cliente ?? 'Grandwich' })
  if (datos.archivo) {
    const path = `permisos/pollococido/${entregaId}/${datos.archivo.name}`
    const fileRef = ref(storage, path)
    await uploadBytes(fileRef, datos.archivo)
    const url = await getDownloadURL(fileRef)
    await updateDoc(doc(db, 'entregas', entregaId), {
      adjuntoUrl: url,
      adjuntoNombre: datos.archivo.name,
    })
  }
  return entregaId
}

export async function listEntregas(empresa) {
  const q = query(entregasRef, where('empresa', '==', empresa), orderBy('fechaEntrega', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
```

- [ ] **Step 2: Verify with a temporary manual call**

In the browser console (app running, logged in), run:
```js
import('/src/services/entregas.js').then(async (m) => {
  const id = await m.crearEntregaPariggi({
    productoId: '30101', productoCodigo: '30101', productoNombre: 'Ñoquis de Pura Papa',
    fechaEntrega: new Date(2026, 6, 1), fechaVencimiento: new Date(2026, 7, 20),
    dias: 50, meses: 1.7, creadoPor: 'imanollopezgonzalez@gmail.com',
  })
  console.log('creado', id)
  console.log(await m.listEntregas('pariggi'))
})
```
Expected: logs a new doc id, then an array containing that record. Delete this test doc from the Firestore console afterward (it's not real data).

- [ ] **Step 3: Commit**

```bash
git add src/services/entregas.js
git commit -m "feat: add entregas service with Storage upload for Pollo Cocido"
```

---

## Task 8: Layout, empresa selector, routing

**Files:**
- Create: `src/pages/Empresas.jsx`, `src/components/Layout.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 4).
- Produces: routes `/`, `/pariggi`, `/pollococido` (stub pages until Tasks 9–12 fill them in), a `<Layout>` wrapper with header + logout button used by every authenticated page.

- [ ] **Step 1: Write the layout**

`src/components/Layout.jsx`:
```jsx
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold text-dark">Trazabilidad</Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
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

- [ ] **Step 2: Write the empresa selector**

`src/pages/Empresas.jsx`:
```jsx
import { Link } from 'react-router-dom'

export default function Empresas() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
      <Link to="/pariggi" className="bg-white rounded-xl shadow p-8 text-center hover:shadow-md">
        <h2 className="text-lg font-semibold text-dark">Pastas Pariggi</h2>
        <p className="text-sm text-gray-500 mt-1">Cliente: Cedisur</p>
      </Link>
      <Link to="/pollococido" className="bg-white rounded-xl shadow p-8 text-center hover:shadow-md">
        <h2 className="text-lg font-semibold text-dark">Pollo Cocido</h2>
        <p className="text-sm text-gray-500 mt-1">Cliente: Grandwich</p>
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Wire routing**

`src/App.jsx`:
```jsx
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Empresas from './pages/Empresas'

function Gate() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando…</div>
  }
  if (status !== 'authorized') {
    return <Login />
  }
  return (
    <BrowserRouter basename="/trazabilidad-pariggi-pollo">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Empresas />} />
          <Route path="/pariggi" element={<div>Formulario Pariggi — Tarea 9</div>} />
          <Route path="/pollococido" element={<div>Formulario Pollo Cocido — Tarea 11</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, log in, confirm the empresa selector shows both cards and clicking each navigates to its stub route without a full page reload.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Empresas.jsx src/components/Layout.jsx src/App.jsx
git commit -m "feat: add layout, empresa selector, and routing"
```

---

## Task 9: Pariggi delivery form

**Files:**
- Create: `src/components/EntregaFormPariggi.jsx`
- Modify: `src/App.jsx` (swap the `/pariggi` stub for the real page)

**Interfaces:**
- Consumes: `calcDiasMeses` (Task 3), `listProductos` (Task 6), `crearEntregaPariggi` (Task 7), `useAuth()` (Task 4).
- Produces: default export `EntregaFormPariggi({ onSaved })`, calling `onSaved()` after a successful save — consumed by Task 10's page which also renders the historial table.

- [ ] **Step 1: Write the form**

`src/components/EntregaFormPariggi.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { calcDiasMeses } from '../lib/trazabilidad'
import { listProductos } from '../services/productos'
import { crearEntregaPariggi } from '../services/entregas'
import { useAuth } from '../contexts/AuthContext'

export default function EntregaFormPariggi({ onSaved }) {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [productoId, setProductoId] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listProductos('pariggi').then((items) =>
      setProductos(items.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    )
  }, [])

  const producto = productos.find((p) => p.id === productoId)
  const entregaDate = fechaEntrega ? new Date(fechaEntrega + 'T00:00:00') : null
  const vencimientoDate = fechaVencimiento ? new Date(fechaVencimiento + 'T00:00:00') : null
  const calculo = entregaDate && vencimientoDate ? calcDiasMeses(entregaDate, vencimientoDate) : null
  const fechasInvalidas = calculo && calculo.dias < 0
  const puedeGuardar = producto && entregaDate && vencimientoDate && !fechasInvalidas && !guardando

  async function handleSubmit(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setGuardando(true)
    setError('')
    try {
      await crearEntregaPariggi({
        productoId: producto.id,
        productoCodigo: producto.codigo,
        productoNombre: producto.nombre,
        fechaEntrega: entregaDate,
        fechaVencimiento: vencimientoDate,
        dias: calculo.dias,
        meses: calculo.meses,
        creadoPor: user.email,
      })
      setProductoId('')
      setFechaEntrega('')
      setFechaVencimiento('')
      onSaved?.()
    } catch (err) {
      setError('No se pudo guardar. Probá de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 grid gap-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Producto</label>
        <select
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">Seleccionar…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de entrega</label>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
          <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      {calculo && !fechasInvalidas && (
        <p className="text-sm text-gray-600">Días: <strong>{calculo.dias}</strong> · Meses: <strong>{calculo.meses}</strong></p>
      )}
      {fechasInvalidas && (
        <p className="text-sm text-red-600">La fecha de vencimiento no puede ser anterior a la de entrega.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!puedeGuardar} className="bg-orange text-white rounded-lg py-2 font-medium disabled:opacity-40">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, navigate to `/pariggi` (stub route still shows plain text — this task only builds the component; wiring the real page happens in Task 10). Temporarily render `<EntregaFormPariggi />` in place of the stub text in `App.jsx` to confirm: selecting a product + both dates shows the right días/meses live, and Guardar is disabled until all three fields are set.

- [ ] **Step 3: Commit**

```bash
git add src/components/EntregaFormPariggi.jsx
git commit -m "feat: add Pariggi delivery form with live dias/meses calculation"
```

---

## Task 10: Pariggi historial + PDF export

**Files:**
- Create: `src/pages/Pariggi.jsx`, `src/components/HistorialTablaPariggi.jsx`, `src/utils/pdfExportPariggi.js`, `src/assets/logo-pariggi.png`
- Modify: `src/App.jsx` (point `/pariggi` at the real page)

**Interfaces:**
- Consumes: `listEntregas('pariggi')` (Task 7), `EntregaFormPariggi` (Task 9).
- Produces: the real `/pariggi` page.

- [ ] **Step 1: Copy the Pariggi logo asset**

```bash
cp "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\Web Pariggi\pariggi-web\assets\logo-pariggi-transparente.png" "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\trazabilidad-pariggi-pollo\src\assets\logo-pariggi.png"
```
If that exact filename isn't present in `pariggi-web/assets/`, list the directory (`ls "...\pariggi-web\assets" | grep -i logo`) and copy whichever full-color, non-white logo file exists instead.

- [ ] **Step 2: Write the PDF export utility**

`src/utils/pdfExportPariggi.js`:
```js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import logoPariggi from '../assets/logo-pariggi.png'

function loadImageAsDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

export async function exportPariggiPdf(entregas, { desde, hasta } = {}) {
  const filtradas = entregas.filter((e) => {
    const fecha = toDate(e.fechaEntrega)
    if (desde && fecha < desde) return false
    if (hasta && fecha > hasta) return false
    return true
  })

  const doc = new jsPDF()
  const logoDataUrl = await loadImageAsDataUrl(logoPariggi)
  doc.addImage(logoDataUrl, 'PNG', 14, 10, 30, 30)
  doc.setFontSize(14)
  doc.text('Trazabilidad — Cedisur', 50, 22)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy')}`, 50, 29)

  autoTable(doc, {
    startY: 46,
    head: [['Producto', 'Fecha entrega', 'Fecha vencimiento', 'Días', 'Meses']],
    body: filtradas.map((e) => [
      e.productoNombre,
      format(toDate(e.fechaEntrega), 'dd/MM/yyyy'),
      format(toDate(e.fechaVencimiento), 'dd/MM/yyyy'),
      String(e.dias),
      String(e.meses),
    ]),
    headStyles: { fillColor: [217, 119, 87] },
  })

  doc.save(`trazabilidad-cedisur-${format(new Date(), 'yyyyMMdd')}.pdf`)
}
```

- [ ] **Step 2: Write the historial table**

`src/components/HistorialTablaPariggi.jsx`:
```jsx
import { format } from 'date-fns'

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

export default function HistorialTablaPariggi({ entregas }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Fecha entrega</th>
            <th className="px-4 py-2">Fecha vencimiento</th>
            <th className="px-4 py-2">Días</th>
            <th className="px-4 py-2">Meses</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="px-4 py-2">{e.productoNombre}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaEntrega), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaVencimiento), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{e.dias}</td>
              <td className="px-4 py-2">{e.meses}</td>
            </tr>
          ))}
          {entregas.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin registros todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Write the page**

`src/pages/Pariggi.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { listEntregas } from '../services/entregas'
import EntregaFormPariggi from '../components/EntregaFormPariggi'
import HistorialTablaPariggi from '../components/HistorialTablaPariggi'
import { exportPariggiPdf } from '../utils/pdfExportPariggi'

export default function Pariggi() {
  const [entregas, setEntregas] = useState([])

  async function reload() {
    setEntregas(await listEntregas('pariggi'))
  }

  useEffect(() => { reload() }, [])

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold text-dark">Pastas Pariggi — Cedisur</h1>
      <EntregaFormPariggi onSaved={reload} />
      <div className="flex justify-between items-center">
        <h2 className="font-medium text-dark">Historial</h2>
        <button
          onClick={() => exportPariggiPdf(entregas)}
          className="text-sm bg-dark text-white rounded-lg px-4 py-2"
        >
          Exportar PDF
        </button>
      </div>
      <HistorialTablaPariggi entregas={entregas} />
    </div>
  )
}
```

- [ ] **Step 4: Wire the route**

In `src/App.jsx`, replace `<Route path="/pariggi" element={<div>Formulario Pariggi — Tarea 9</div>} />` with:
```jsx
<Route path="/pariggi" element={<Pariggi />} />
```
and add `import Pariggi from './pages/Pariggi'` at the top. Remove the temporary `<EntregaFormPariggi />` render added for manual testing in Task 9 Step 2 if still present.

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, go to `/pariggi`, save a delivery record, confirm it appears in the historial table immediately, click "Exportar PDF", open the downloaded file and confirm the logo renders and the table matches the row just saved.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Pariggi.jsx src/components/HistorialTablaPariggi.jsx src/utils/pdfExportPariggi.js src/assets/logo-pariggi.png src/App.jsx
git commit -m "feat: add Pariggi historial view and branded PDF export"
```

---

## Task 11: Pollo Cocido delivery form (with attachment)

**Files:**
- Create: `src/components/EntregaFormPollo.jsx`

**Interfaces:**
- Consumes: `calcDiasMeses` (Task 3), `listProductos` (Task 6), `crearEntregaPollo` (Task 7), `useAuth()` (Task 4).
- Produces: default export `EntregaFormPollo({ onSaved })`, consumed by Task 12's page.

- [ ] **Step 1: Write the form**

`src/components/EntregaFormPollo.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { calcDiasMeses } from '../lib/trazabilidad'
import { listProductos } from '../services/productos'
import { crearEntregaPollo } from '../services/entregas'
import { useAuth } from '../contexts/AuthContext'

const MAX_BYTES = 15 * 1024 * 1024

export default function EntregaFormPollo({ onSaved }) {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [productoId, setProductoId] = useState('')
  const [lote, setLote] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listProductos('pollococido').then((items) =>
      setProductos(items.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    )
  }, [])

  const producto = productos.find((p) => p.id === productoId)
  const entregaDate = fechaEntrega ? new Date(fechaEntrega + 'T00:00:00') : null
  const vencimientoDate = fechaVencimiento ? new Date(fechaVencimiento + 'T00:00:00') : null
  const calculo = entregaDate && vencimientoDate ? calcDiasMeses(entregaDate, vencimientoDate) : null
  const fechasInvalidas = calculo && calculo.dias < 0
  const puedeGuardar = producto && lote.trim() && entregaDate && vencimientoDate && !fechasInvalidas && !guardando

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) { setArchivo(null); return }
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa más de 15 MB, elegí uno más liviano.')
      setArchivo(null)
      return
    }
    setError('')
    setArchivo(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setGuardando(true)
    setError('')
    try {
      await crearEntregaPollo({
        productoId: producto.id,
        productoCodigo: producto.codigo,
        productoNombre: producto.nombre,
        lote: lote.trim(),
        fechaEntrega: entregaDate,
        fechaVencimiento: vencimientoDate,
        dias: calculo.dias,
        meses: calculo.meses,
        archivo,
        creadoPor: user.email,
      })
      setProductoId('')
      setLote('')
      setFechaEntrega('')
      setFechaVencimiento('')
      setArchivo(null)
      onSaved?.()
    } catch (err) {
      setError('No se pudo guardar. Probá de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 grid gap-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Producto</label>
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
          <option value="">Seleccionar…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Número de lote</label>
        <input type="text" value={lote} onChange={(e) => setLote(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de entrega</label>
          <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
          <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      {calculo && !fechasInvalidas && (
        <p className="text-sm text-gray-600">Días: <strong>{calculo.dias}</strong> · Meses: <strong>{calculo.meses}</strong></p>
      )}
      {fechasInvalidas && <p className="text-sm text-red-600">La fecha de vencimiento no puede ser anterior a la de entrega.</p>}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Permiso de tránsito (PDF o foto)</label>
        <input type="file" accept="application/pdf,image/*" onChange={handleFile} className="w-full text-sm" />
        {archivo && <p className="text-xs text-gray-500 mt-1">{archivo.name}</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!puedeGuardar} className="bg-pollo text-white rounded-lg py-2 font-medium disabled:opacity-40">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify manually**

Temporarily render `<EntregaFormPollo />` in place of the `/pollococido` stub in `App.jsx`. Confirm: form requires producto + lote + both dates before enabling Guardar; picking a file >15MB (or simulate by lowering `MAX_BYTES` temporarily to test) shows the size error and blocks it; saving without a file still succeeds (attachment is optional per the spec).

- [ ] **Step 3: Commit**

```bash
git add src/components/EntregaFormPollo.jsx
git commit -m "feat: add Pollo Cocido delivery form with lote and attachment upload"
```

---

## Task 12: Pollo Cocido historial

**Files:**
- Create: `src/pages/PolloCocido.jsx`, `src/components/HistorialTablaPollo.jsx`
- Modify: `src/App.jsx` (point `/pollococido` at the real page)

**Interfaces:**
- Consumes: `listEntregas('pollococido')` (Task 7), `EntregaFormPollo` (Task 11).

- [ ] **Step 1: Write the historial table**

`src/components/HistorialTablaPollo.jsx`:
```jsx
import { format } from 'date-fns'

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

export default function HistorialTablaPollo({ entregas }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Lote</th>
            <th className="px-4 py-2">Fecha entrega</th>
            <th className="px-4 py-2">Fecha vencimiento</th>
            <th className="px-4 py-2">Días</th>
            <th className="px-4 py-2">Meses</th>
            <th className="px-4 py-2">Adjunto</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="px-4 py-2">{e.productoNombre}</td>
              <td className="px-4 py-2">{e.lote}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaEntrega), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaVencimiento), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{e.dias}</td>
              <td className="px-4 py-2">{e.meses}</td>
              <td className="px-4 py-2">
                {e.adjuntoUrl ? (
                  <a href={e.adjuntoUrl} target="_blank" rel="noreferrer" className="text-pollo hover:underline">Ver</a>
                ) : (
                  <span className="text-gray-400">Sin adjunto</span>
                )}
              </td>
            </tr>
          ))}
          {entregas.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin registros todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Write the page**

`src/pages/PolloCocido.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { listEntregas } from '../services/entregas'
import EntregaFormPollo from '../components/EntregaFormPollo'
import HistorialTablaPollo from '../components/HistorialTablaPollo'

export default function PolloCocido() {
  const [entregas, setEntregas] = useState([])

  async function reload() {
    setEntregas(await listEntregas('pollococido'))
  }

  useEffect(() => { reload() }, [])

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold text-dark">Pollo Cocido — Grandwich</h1>
      <EntregaFormPollo onSaved={reload} />
      <h2 className="font-medium text-dark">Historial</h2>
      <HistorialTablaPollo entregas={entregas} />
    </div>
  )
}
```

- [ ] **Step 3: Wire the route**

In `src/App.jsx`, replace the `/pollococido` stub with `<Route path="/pollococido" element={<PolloCocido />} />` and `import PolloCocido from './pages/PolloCocido'`. Remove the temporary `<EntregaFormPollo />` render from Task 11 Step 2 if still present.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, go to `/pollococido`, save a delivery with a small test PDF attached, confirm it appears in the historial with a working "Ver" link that opens the uploaded file.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PolloCocido.jsx src/components/HistorialTablaPollo.jsx src/App.jsx
git commit -m "feat: add Pollo Cocido historial view with attachment links"
```

---

## Task 13: Ajustes (catálogo + whitelist management)

**Files:**
- Create: `src/pages/Ajustes.jsx`, `src/services/usuarios.js`
- Modify: `src/App.jsx`, `src/components/Layout.jsx`

**Interfaces:**
- Consumes: `listProductos`, `addProducto`, `setProductoActivo` (Task 6).
- Produces: `listUsuariosAutorizados() => Promise<string[]>`, `addUsuarioAutorizado(email, agregadoPor) => Promise<void>`, `removeUsuarioAutorizado(email) => Promise<void>` in `src/services/usuarios.js`; route `/ajustes`.

- [ ] **Step 1: Write the usuarios service**

`src/services/usuarios.js`:
```js
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
```

- [ ] **Step 2: Write the Ajustes page**

`src/pages/Ajustes.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { listProductos, addProducto, setProductoActivo } from '../services/productos'
import { listUsuariosAutorizados, addUsuarioAutorizado, removeUsuarioAutorizado } from '../services/usuarios'
import { useAuth } from '../contexts/AuthContext'

export default function Ajustes() {
  const { user } = useAuth()
  const [empresa, setEmpresa] = useState('pariggi')
  const [productos, setProductos] = useState([])
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')

  async function reloadProductos() {
    setProductos(await listProductos(empresa))
  }
  async function reloadUsuarios() {
    setUsuarios(await listUsuariosAutorizados())
  }

  useEffect(() => { reloadProductos() }, [empresa])
  useEffect(() => { reloadUsuarios() }, [])

  async function handleAddProducto(e) {
    e.preventDefault()
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) return
    await addProducto(empresa, { codigo: nuevoCodigo.trim(), nombre: nuevoNombre.trim() })
    setNuevoCodigo('')
    setNuevoNombre('')
    reloadProductos()
  }

  async function handleAddUsuario(e) {
    e.preventDefault()
    if (!nuevoEmail.trim()) return
    await addUsuarioAutorizado(nuevoEmail.trim(), user.email)
    setNuevoEmail('')
    reloadUsuarios()
  }

  return (
    <div className="grid gap-8 max-w-2xl">
      <section>
        <h2 className="font-medium text-dark mb-3">Catálogo de productos</h2>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setEmpresa('pariggi')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pariggi' ? 'bg-orange text-white' : 'bg-white'}`}>Pariggi</button>
          <button onClick={() => setEmpresa('pollococido')} className={`px-3 py-1 rounded-lg text-sm ${empresa === 'pollococido' ? 'bg-pollo text-white' : 'bg-white'}`}>Pollo Cocido</button>
        </div>
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
          {usuarios.map((email) => (
            <li key={email} className="px-4 py-2 flex justify-between items-center text-sm">
              <span>{email}</span>
              <button onClick={() => removeUsuarioAutorizado(email).then(reloadUsuarios)} className="text-xs text-red-500 hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddUsuario} className="flex gap-2 mt-3">
          <input type="email" placeholder="email@dominio.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button type="submit" className="bg-dark text-white rounded-lg px-4 text-sm">Agregar</button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add nav link and route**

In `src/components/Layout.jsx`, add a link next to the logout button:
```jsx
<Link to="/ajustes" className="hover:underline">Ajustes</Link>
```
(add this `<Link>` inside the existing `<div className="flex items-center gap-4 text-sm text-gray-500">`, before the `<span>{user?.email}</span>`.)

In `src/App.jsx`, add `import Ajustes from './pages/Ajustes'` and `<Route path="/ajustes" element={<Ajustes />} />` inside the existing `<Route element={<Layout />}>` block.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, go to `/ajustes`, add a throwaway test product, confirm it appears and toggling "Desactivar" removes it from the dropdown on `/pariggi`'s form (re-visit that page to confirm). Add a throwaway email to the whitelist, confirm it appears, then remove it. Delete the throwaway product afterward too.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Ajustes.jsx src/services/usuarios.js src/App.jsx src/components/Layout.jsx
git commit -m "feat: add Ajustes page for catalog and whitelist management"
```

---

## Task 14: GitHub repo + CI deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Produces: a live URL `https://imanollopezgonzalez-del.github.io/trazabilidad-pariggi-pollo/`.

- [ ] **Step 1: Write the deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write a minimal README**

`README.md`:
```markdown
# Trazabilidad Pariggi / Pollo Cocido

App interna de trazabilidad de entregas para Pastas Pariggi (cliente Cedisur) y Pollo Cocido (cliente Grandwich).

## Desarrollo local

npm install
npm run dev

Requiere `.env.local` con las variables `VITE_FIREBASE_*` (ver `.env.example`).

## Deploy

Automático a GitHub Pages en cada push a `main` (`.github/workflows/deploy.yml`). Los secrets `VITE_FIREBASE_*` deben estar configurados en el repo de GitHub (Settings → Secrets and variables → Actions).
```

- [ ] **Step 3: Create the GitHub repo and push**

```bash
gh repo create imanollopezgonzalez-del/trazabilidad-pariggi-pollo --private --source=. --remote=origin
git add .github/workflows/deploy.yml README.md
git commit -m "chore: add GitHub Pages deploy workflow"
git push -u origin master:main
```

- [ ] **Step 4: Set GitHub Actions secrets**

```bash
gh secret set VITE_FIREBASE_API_KEY --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "<value from .env.local>"
gh secret set VITE_FIREBASE_AUTH_DOMAIN --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "<value from .env.local>"
gh secret set VITE_FIREBASE_PROJECT_ID --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "<value from .env.local>"
gh secret set VITE_FIREBASE_STORAGE_BUCKET --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "<value from .env.local>"
gh secret set VITE_FIREBASE_MESSAGING_SENDER_ID --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "<value from .env.local>"
gh secret set VITE_FIREBASE_APP_ID --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo --body "<value from .env.local>"
```

- [ ] **Step 5: Enable GitHub Pages (Actions source)**

```bash
gh api -X PUT repos/imanollopezgonzalez-del/trazabilidad-pariggi-pollo/pages -f build_type=workflow
```
If that fails because Pages isn't initialized yet, create it first: `gh api -X POST repos/imanollopezgonzalez-del/trazabilidad-pariggi-pollo/pages -f build_type=workflow`.

- [ ] **Step 6: Add the deployed domain to Firebase Auth's authorized domains**

In the Firebase console → Authentication → Settings → Authorized domains, add `imanollopezgonzalez-del.github.io` (Google Sign-In will reject the popup from an unlisted domain otherwise).

- [ ] **Step 7: Verify the live deploy**

Run: `gh run watch --repo imanollopezgonzalez-del/trazabilidad-pariggi-pollo` (or check the Actions tab).
Expected: workflow succeeds. Open `https://imanollopezgonzalez-del.github.io/trazabilidad-pariggi-pollo/`, log in, confirm both empresa flows work against the live site.

- [ ] **Step 8: Commit** (only if any local fixups were needed after Step 7)

```bash
git add -A
git commit -m "fix: address issues found in live deploy verification"
git push
```

---

## Task 15: Security review

**Files:** none created — review pass over Tasks 4, 5, 13.

- [ ] **Step 1: Run the security-review skill**

Invoke the `security-review` skill against this repo's pending/committed changes, focused on: Firestore/Storage rules (Task 5), the client-side auth gate (Task 4), file upload handling (Task 11), and the whitelist management page (Task 13).

- [ ] **Step 2: Address findings**

Fix anything the review flags (e.g., missing size/type validation server-side via Storage rules, rules that are too permissive, XSS risk from rendering user-entered product names, etc.). For each fix, re-run the relevant manual verification steps from the task that owns that file.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: address findings from security review"
git push
```

---

## Task 16: Local test shortcut

**Files:**
- Create: `scripts/iniciar-app.bat`

**Interfaces:** none — this is an operator convenience, not app code.

- [ ] **Step 1: Write a batch launcher**

`scripts/iniciar-app.bat`:
```bat
@echo off
cd /d "%~dp0.."
start "" cmd /k "npm run dev"
timeout /t 3 >nul
start "" http://localhost:5173/trazabilidad-pariggi-pollo/
```

- [ ] **Step 2: Create a desktop shortcut to it**

```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Trazabilidad (local).lnk")
$Shortcut.TargetPath = "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\trazabilidad-pariggi-pollo\scripts\iniciar-app.bat"
$Shortcut.WorkingDirectory = "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\trazabilidad-pariggi-pollo"
$Shortcut.IconLocation = "shell32.dll,220"
$Shortcut.Save()
```

- [ ] **Step 3: Verify**

Double-click the new "Trazabilidad (local).lnk" icon on the desktop.
Expected: a terminal window opens running `npm run dev`, and the default browser opens to the app a few seconds later.

- [ ] **Step 4: Once Task 14 confirms the live URL works, add a second shortcut for it**

```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Trazabilidad.lnk")
$Shortcut.TargetPath = "https://imanollopezgonzalez-del.github.io/trazabilidad-pariggi-pollo/"
$Shortcut.IconLocation = "shell32.dll,220"
$Shortcut.Save()
```

- [ ] **Step 5: Commit**

```bash
git add scripts/iniciar-app.bat
git commit -m "chore: add local dev launcher script"
git push
```

---

## Self-Review Notes

- **Spec coverage:** auth+whitelist (Tasks 4–5, 13), data model (Tasks 6–7), Pariggi flow+PDF (Tasks 9–10), Pollo Cocido flow+attachment (Tasks 11–12), error handling for invalid dates/oversized files (Tasks 9, 11), deploy (Task 14), security review (Task 15) — all spec sections are covered.
- **Type consistency:** `entregas` doc shape defined once in Task 7's `crearEntregaBase` and consumed identically by `HistorialTablaPariggi`/`HistorialTablaPollo` (Tasks 10, 12) and `pdfExportPariggi` (Task 10) — field names (`productoNombre`, `fechaEntrega`, `dias`, `meses`, `adjuntoUrl`) match across all four.
- **No placeholders:** every step has runnable code or an exact command; the one open real-world dependency (enabling Google Sign-in / Firestore / Storage in the console) is called out explicitly as a manual one-time step in Task 2 Step 3, not left vague.
