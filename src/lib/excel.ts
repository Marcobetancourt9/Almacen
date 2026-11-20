import { fmtDateTime } from './format'

export interface ExcelColumn<T> {
  header: string
  width?: number
  /** Formato numérico de Excel, p. ej. '#,##0.###' o 'dd/mm/yyyy hh:mm' */
  numFmt?: string
  value: (row: T) => string | number | Date | null | undefined
  /** Color de texto opcional por fila (ARGB, p. ej. 'FFDC2626') */
  color?: (row: T) => string | undefined
}

export interface ExcelSheet<T> {
  name: string
  title?: string
  columns: ExcelColumn<T>[]
  rows: T[]
}

const BRAND = 'FF4F46E5'
const ZEBRA = 'FFF5F5FA'

export const NUM = '#,##0.###'
export const DATE_TIME = 'dd/mm/yyyy hh:mm'

/**
 * Genera y descarga un archivo .xlsx con estilos (cabecera de color, filtros,
 * fila fija, anchos de columna, formato de números y fechas).
 * ExcelJS se carga bajo demanda para no aumentar la carga inicial de la app.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function downloadExcel(filename: string, sheets: ExcelSheet<any>[]) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Inversiones Pincho Pan Express II C.A.'
  wb.created = new Date()

  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: s.title ? 3 : 1 }] })
    let headerRow = 1

    if (s.title) {
      ws.mergeCells(1, 1, 1, s.columns.length)
      const t = ws.getCell(1, 1)
      t.value = s.title
      t.font = { bold: true, size: 14, color: { argb: BRAND } }
      ws.mergeCells(2, 1, 2, s.columns.length)
      const sub = ws.getCell(2, 1)
      sub.value = `Generado el ${fmtDateTime(new Date())} · ${s.rows.length} registros · datos de Firebase`
      sub.font = { italic: true, size: 9, color: { argb: 'FF6B7280' } }
      headerRow = 3
    }

    const header = ws.getRow(headerRow)
    s.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1)
      cell.value = c.header
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      ws.getColumn(i + 1).width = c.width ?? Math.max(12, c.header.length + 4)
      if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt
    })
    header.height = 22

    s.rows.forEach((row, r) => {
      const excelRow = ws.getRow(headerRow + 1 + r)
      s.columns.forEach((c, i) => {
        const cell = excelRow.getCell(i + 1)
        const v = c.value(row)
        cell.value = v ?? ''
        const color = c.color?.(row)
        if (color) cell.font = { color: { argb: color }, bold: true }
        if (r % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      })
    })

    if (s.rows.length > 0) {
      ws.autoFilter = {
        from: { row: headerRow, column: 1 },
        to: { row: headerRow + s.rows.length, column: s.columns.length },
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const today = () => new Date().toISOString().slice(0, 10)
