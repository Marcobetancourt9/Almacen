import type { Product } from '../types'

export type StockStatus = 'ok' | 'low' | 'out'

export function stockStatus(p: Pick<Product, 'quantity' | 'minStock'>): StockStatus {
  if (p.quantity <= 0) return 'out'
  if (p.quantity <= p.minStock) return 'low'
  return 'ok'
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Disponible',
  low: 'Stock bajo',
  out: 'Agotado',
}

export const USAGE_REASONS = ['Producción', 'Mantenimiento', 'Proyecto', 'Consumo interno', 'Merma / daño', 'Venta', 'Otro']
export const ENTRY_REASONS = ['Reposición proveedor', 'Devolución', 'Transferencia', 'Producción propia', 'Otro']
export const ADJUST_REASONS = ['Conteo físico', 'Corrección de error', 'Inventario anual', 'Otro']
