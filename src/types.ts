export type Role = 'admin' | 'operator' | 'viewer'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Solo lectura',
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: Role
  active: boolean
  createdAt: Date | null
}

/** Referencia ligera a un usuario, guardada dentro de productos y movimientos (auditoría). */
export interface UserRef {
  uid: string
  name: string
  email: string
}

export const UNITS = ['unidad', 'caja', 'paquete', 'kg', 'g', 'litro', 'ml', 'metro', 'rollo', 'par'] as const
export type Unit = (typeof UNITS)[number]

export interface Product {
  id: string
  sku: string
  name: string
  description: string
  category: string
  unit: Unit
  location: string
  quantity: number
  minStock: number
  archived: boolean
  lastMovementId: string | null
  createdBy: UserRef
  createdAt: Date | null
  updatedBy: UserRef
  updatedAt: Date | null
}

export type ProductInput = Pick<
  Product,
  'sku' | 'name' | 'description' | 'category' | 'unit' | 'location' | 'minStock'
> & { initialQuantity: number }

export type ProductEditable = Pick<Product, 'name' | 'description' | 'category' | 'unit' | 'location' | 'minStock'>

export type MovementType = 'entrada' | 'salida' | 'ajuste'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  entrada: 'Entrada',
  salida: 'Uso / Salida',
  ajuste: 'Ajuste',
}

export interface Movement {
  id: string
  productId: string
  productName: string
  sku: string
  unit: Unit
  type: MovementType
  /** Cantidad absoluta del movimiento (siempre > 0). */
  quantity: number
  /** Variación con signo aplicada al stock. */
  delta: number
  previousQty: number
  newQty: number
  reason: string
  note: string
  user: UserRef
  createdAt: Date | null
}

export interface MovementInput {
  productId: string
  type: MovementType
  /** Para entrada/salida: cantidad a mover. Para ajuste: nuevo stock contado. */
  quantity: number
  reason: string
  note: string
}

export type Unsubscribe = () => void
