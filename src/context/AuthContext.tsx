import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { backend } from '../services'
import type { AppUser } from '../types'

interface AuthState {
  user: AppUser | null
  loading: boolean
  error: string | null
  canWrite: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      backend.auth.onChange(
        (u) => {
          setUser(u)
          setError(null)
          setLoading(false)
        },
        (err) => {
          setError(errorMessage(err))
          setLoading(false)
        },
      ),
    [],
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      canWrite: !!user && user.active && user.role !== 'viewer',
      isAdmin: !!user && user.active && user.role === 'admin',
    }),
    [user, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Para componentes que solo se muestran con sesión iniciada. */
export function useCurrentUser(): AppUser {
  const { user } = useAuth()
  if (!user) throw new Error('No hay sesión')
  return user
}
