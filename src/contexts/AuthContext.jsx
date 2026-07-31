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
