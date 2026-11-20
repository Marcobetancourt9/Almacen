import { z } from 'zod'
import { UNITS } from '../types'

/** Normaliza un SKU para usarlo como ID de documento (único por diseño). */
export function normalizeSku(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
}

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)

export const productSchema = z.object({
  sku: z
    .string()
    .transform(normalizeSku)
    .pipe(z.string().min(2, 'El SKU debe tener al menos 2 caracteres').max(40, 'Máximo 40 caracteres')),
  name: text(120).min(2, 'El nombre es obligatorio'),
  description: text(1000),
  category: text(60).min(1, 'La categoría es obligatoria'),
  unit: z.enum(UNITS),
  location: text(60),
  minStock: z.number({ message: 'Número inválido' }).int('Debe ser entero').min(0).max(1_000_000),
  initialQuantity: z.number({ message: 'Número inválido' }).min(0, 'No puede ser negativo').max(10_000_000),
})

export const productEditSchema = productSchema.omit({ sku: true, initialQuantity: true })

export const movementSchema = z
  .object({
    productId: z.string().min(1, 'Selecciona un producto'),
    type: z.enum(['entrada', 'salida', 'ajuste']),
    quantity: z.number({ message: 'Número inválido' }).min(0).max(10_000_000),
    reason: text(80).min(1, 'Indica el motivo'),
    note: text(500),
  })
  .refine((m) => m.type === 'ajuste' || m.quantity > 0, {
    message: 'La cantidad debe ser mayor que 0',
    path: ['quantity'],
  })

export const displayNameSchema = text(60).min(2, 'Mínimo 2 caracteres')

/** Devuelve un mapa campo → primer mensaje de error. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Redondea para evitar errores de coma flotante (p. ej. 0.1 + 0.2). */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}
