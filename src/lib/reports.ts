import { backend } from '../services'
import { MOVEMENT_LABELS, type Movement, type MovementType, type Product } from '../types'
import { DATE_TIME, downloadExcel, NUM, today, type ExcelColumn } from './excel'
import { STATUS_LABEL, stockStatus } from './stock'

const RED = 'FFDC2626'
const GREEN = 'FF059669'
const AMBER = 'FFD97706'

const productColumns: ExcelColumn<Product>[] = [
  { header: 'SKU', width: 14, value: (p) => p.sku },
  { header: 'Producto', width: 34, value: (p) => p.name },
  { header: 'Categoría', width: 16, value: (p) => p.category },
  { header: 'Ubicación', width: 12, value: (p) => p.location },
  { header: 'Cantidad', width: 12, numFmt: NUM, value: (p) => p.quantity },
  { header: 'Unidad', width: 10, value: (p) => p.unit },
  { header: 'Stock mínimo', width: 14, numFmt: NUM, value: (p) => p.minStock },
  {
    header: 'Estado',
    width: 13,
    value: (p) => (p.archived ? 'Archivado' : STATUS_LABEL[stockStatus(p)]),
    color: (p) => (p.archived ? undefined : { ok: GREEN, low: AMBER, out: RED }[stockStatus(p)]),
  },
  { header: 'Descripción', width: 30, value: (p) => p.description },
  { header: 'Registrado por', width: 20, value: (p) => p.createdBy.name },
  { header: 'Fecha de registro', width: 18, numFmt: DATE_TIME, value: (p) => p.createdAt },
  { header: 'Última modificación por', width: 22, value: (p) => p.updatedBy.name },
  { header: 'Última modificación', width: 18, numFmt: DATE_TIME, value: (p) => p.updatedAt },
]

const movementColumns: ExcelColumn<Movement>[] = [
  { header: 'Fecha', width: 18, numFmt: DATE_TIME, value: (m) => m.createdAt },
  { header: 'Tipo', width: 13, value: (m) => MOVEMENT_LABELS[m.type] },
  { header: 'SKU', width: 14, value: (m) => m.sku },
  { header: 'Producto', width: 32, value: (m) => m.productName },
  { header: 'Cantidad', width: 11, numFmt: NUM, value: (m) => m.delta, color: (m) => (m.delta > 0 ? GREEN : RED) },
  { header: 'Unidad', width: 9, value: (m) => m.unit },
  { header: 'Stock anterior', width: 14, numFmt: NUM, value: (m) => m.previousQty },
  { header: 'Stock nuevo', width: 13, numFmt: NUM, value: (m) => m.newQty },
  { header: 'Motivo', width: 20, value: (m) => m.reason },
  { header: 'Nota', width: 30, value: (m) => m.note },
  { header: 'Usuario', width: 20, value: (m) => m.user.name },
  { header: 'Correo', width: 24, value: (m) => m.user.email },
]

/** Exporta el inventario leyendo directamente de Firebase. */
export async function exportInventory(filter?: (p: Product) => boolean) {
  const all = await backend.products.fetchAll()
  const products = filter ? all.filter(filter) : all
  const alerts = products.filter((p) => !p.archived && stockStatus(p) !== 'ok')
  await downloadExcel(`inventario-${today()}`, [
    { name: 'Inventario', title: 'Inventario del almacén', columns: productColumns, rows: products },
    { name: 'Alertas de stock', title: 'Productos agotados o bajo el mínimo', columns: productColumns, rows: alerts },
  ])
  return products.length
}

export interface MovementFilter {
  from?: Date
  to?: Date
  productId?: string
  type?: MovementType | ''
  userId?: string
  text?: string
}

/** Exporta movimientos leyendo directamente de Firebase (sin el límite de la vista). */
export async function exportMovements(f: MovementFilter, filename = `movimientos-${today()}`) {
  const raw = await backend.movements.fetch({ from: f.from, to: f.to, productId: f.productId })
  const t = f.text?.trim().toLowerCase()
  const rows = raw.filter(
    (m) =>
      (!f.type || m.type === f.type) &&
      (!f.userId || m.user.uid === f.userId) &&
      (!t || `${m.productName} ${m.sku} ${m.reason} ${m.note}`.toLowerCase().includes(t)),
  )

  // Hoja resumen: consumo por producto
  const byProduct = new Map<string, { sku: string; name: string; unit: string; entradas: number; usos: number; n: number }>()
  for (const m of rows) {
    const s = byProduct.get(m.productId) ?? { sku: m.sku, name: m.productName, unit: m.unit, entradas: 0, usos: 0, n: 0 }
    if (m.type === 'entrada') s.entradas += m.quantity
    if (m.type === 'salida') s.usos += m.quantity
    s.n++
    byProduct.set(m.productId, s)
  }
  type Summary = typeof byProduct extends Map<string, infer V> ? V : never
  const summaryColumns: ExcelColumn<Summary>[] = [
    { header: 'SKU', width: 14, value: (s) => s.sku },
    { header: 'Producto', width: 34, value: (s) => s.name },
    { header: 'Unidad', width: 10, value: (s) => s.unit },
    { header: 'Total ingresado', width: 16, numFmt: NUM, value: (s) => s.entradas, color: () => GREEN },
    { header: 'Total usado', width: 14, numFmt: NUM, value: (s) => s.usos, color: () => RED },
    { header: 'Movimientos', width: 13, value: (s) => s.n },
  ]

  await downloadExcel(filename, [
    { name: 'Movimientos', title: 'Historial de movimientos', columns: movementColumns, rows },
    {
      name: 'Resumen por producto',
      title: 'Consumo e ingresos por producto',
      columns: summaryColumns,
      rows: [...byProduct.values()].sort((a, b) => b.usos - a.usos),
    },
  ])
  return rows.length
}
