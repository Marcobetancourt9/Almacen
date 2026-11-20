import { AppError } from '../lib/errors'
import { roundQty } from '../lib/validation'
import type { AppUser, MovementInput, Product, UserRef } from '../types'

export function toUserRef(u: AppUser): UserRef {
  return { uid: u.uid, name: u.displayName, email: u.email }
}

export function assertCanWrite(u: AppUser) {
  if (!u.active) throw new AppError('Tu cuenta está desactivada.')
  if (u.role === 'viewer') throw new AppError('Tu rol es de solo lectura. Pide a un administrador que te dé permisos.')
}

/**
 * Lógica pura del cálculo de stock, compartida por ambos backends.
 * Las reglas de Firestore validan exactamente lo mismo del lado del servidor.
 */
export function computeMovement(product: Product, input: MovementInput) {
  if (product.archived) throw new AppError('El producto está archivado.')
  const previousQty = product.quantity
  let delta: number
  switch (input.type) {
    case 'entrada':
      delta = input.quantity
      break
    case 'salida':
      delta = -input.quantity
      break
    case 'ajuste':
      delta = roundQty(input.quantity - previousQty)
      break
  }
  delta = roundQty(delta)
  if (delta === 0) throw new AppError('El movimiento no cambia el stock.')
  const newQty = roundQty(previousQty + delta)
  if (newQty < 0) {
    throw new AppError(
      `Stock insuficiente: hay ${previousQty} ${product.unit} disponibles y se intentan usar ${input.quantity}.`,
    )
  }
  return { previousQty, delta, newQty, quantity: Math.abs(delta) }
}
