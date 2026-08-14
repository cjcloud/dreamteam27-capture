'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { toast } from 'react-toastify'

type AuthContextType = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get the ID token
        try {
          const token = await user.getIdToken()
          // Store the token in a cookie
          document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Strict`
        } catch (error) {
          console.error('Error getting auth token:', error)
          toast.error('Authentication error')
        }
      } else {
        // Clear the session cookie when user is not authenticated
        document.cookie = '__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
      
      setUser(user)
      setLoading(false)
    })

    return () => {
      unsubscribe()
      setMounted(false)
    }
  }, [])

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
