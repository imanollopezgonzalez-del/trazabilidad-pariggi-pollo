import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setIsAdmin(false)
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
        setIsAdmin(authDoc.data().admin === true)
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

  return (
    <AuthContext.Provider value={{ user, status, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
