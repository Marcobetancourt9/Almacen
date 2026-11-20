import type {
  AppUser,
  Movement,
  MovementInput,
  Product,
  ProductEditable,
  ProductInput,
  Role,
  Unsubscribe,
} from '../types'

export type ErrorHandler = (err: unknown) => void

export interface MovementQuery {
  productId?: string
  /** Desde (incluido) */
  from?: Date
  /** Hasta (incluido) */
  to?: Date
  limit?: number
}

/**
 * Contrato único del backend (implementado con Firebase). La UI solo habla con
 * esta interfaz: las pantallas no conocen detalles de Firestore.
 */
export interface Backend {

  auth: {
    /** Notifica el usuario autenticado con su perfil (rol incluido) o null. */
    onChange(cb: (user: AppUser | null) => void, onError: ErrorHandler): Unsubscribe
    signIn(email: string, password: string): Promise<void>
    signUp(displayName: string, email: string, password: string): Promise<void>
    /** Inicia sesión (o crea la cuenta) con Google. Devuelve false si el usuario cerró la ventana. */
    signInWithGoogle(): Promise<boolean>
    signOut(): Promise<void>
    resetPassword(email: string): Promise<void>
    updateDisplayName(actor: AppUser, displayName: string): Promise<void>
  }

  products: {
    subscribe(cb: (items: Product[]) => void, onError: ErrorHandler): Unsubscribe
    /** Lectura directa del servidor (nunca de caché). Para exportaciones. */
    fetchAll(): Promise<Product[]>
    create(input: ProductInput, actor: AppUser): Promise<string>
    update(id: string, patch: ProductEditable, actor: AppUser): Promise<void>
    setArchived(id: string, archived: boolean, actor: AppUser): Promise<void>
  }

  movements: {
    subscribe(q: MovementQuery, cb: (items: Movement[]) => void, onError: ErrorHandler): Unsubscribe
    /** Lectura directa del servidor (nunca de caché). Para exportaciones. */
    fetch(q: MovementQuery): Promise<Movement[]>
    /** Registra un movimiento y actualiza el stock de forma atómica. */
    register(input: MovementInput, actor: AppUser): Promise<Movement>
  }

  users: {
    subscribe(cb: (items: AppUser[]) => void, onError: ErrorHandler): Unsubscribe
    setRole(uid: string, role: Role): Promise<void>
    setActive(uid: string, active: boolean): Promise<void>
  }
}
