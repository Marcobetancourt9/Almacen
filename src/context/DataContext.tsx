import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { backend } from '../services'
import type { AppUser, Movement, Product } from '../types'
import { useAuth } from './AuthContext'

interface DataState {
  products: Product[]
  movements: Movement[]
  users: AppUser[]
  loading: boolean
  error: string | null
  productById: Map<string, Product>
}

const DataContext = createContext<DataState | null>(null)

/**
 * Suscripciones en tiempo real compartidas por toda la app: un único listener
 * por colección, aunque varias pantallas usen los mismos datos.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [movements, setMovements] = useState<Movement[] | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const active = !!user?.active
  useEffect(() => {
    if (!active) return
    const onError = (e: unknown) => {
      console.error(e)
      setError(errorMessage(e))
    }
    const subs = [
      backend.products.subscribe(setProducts, onError),
      backend.movements.subscribe({ limit: 500 }, setMovements, onError),
      backend.users.subscribe(setUsers, onError),
    ]
    return () => subs.forEach((u) => u())
  }, [active])

  const value = useMemo<DataState>(() => {
    const list = products ?? []
    return {
      products: list,
      movements: movements ?? [],
      users,
      loading: products === null || movements === null,
      error,
      productById: new Map(list.map((p) => [p.id, p])),
    }
  }, [products, movements, users, error])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
