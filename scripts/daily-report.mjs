// Reporte diario del almacén por correo para los administradores.
//
// Uso:
//   node scripts/daily-report.mjs              → envía el reporte de HOY
//   node scripts/daily-report.mjs --dry-run    → no envía: guarda HTML y Excel en report-output/
//   REPORT_DATE=2026-11-20 node scripts/daily-report.mjs   → reenvía un día concreto
//
// Variables de entorno:
//   FIREBASE_SERVICE_ACCOUNT        JSON de la cuenta de servicio (o GOOGLE_APPLICATION_CREDENTIALS)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   servidor de correo (p. ej. Gmail con contraseña de aplicación)
//   MAIL_FROM          remitente (por defecto SMTP_USER)
//   REPORT_TZ          zona horaria del "día" (por defecto America/Caracas)
//   REPORT_EXTRA_TO    correos adicionales separados por coma (opcional)
//   REPORT_SKIP_EMPTY  "true" para no enviar nada los días sin movimientos
//   APP_URL            enlace a la app dentro del correo (opcional)

process.env.TZ = process.env.REPORT_TZ || process.env.TZ || 'America/Caracas'

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { Timestamp } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'
import { db, projectId } from './admin.mjs'

const DRY_RUN = process.argv.includes('--dry-run')
const COMPANY = 'Inversiones Pincho Pan Express II C.A.'
const LOGO_PATH = new URL('../public/pinchopan.png', import.meta.url)
// En el correo el logo va incrustado (cid); en la vista previa local se usa el archivo.
const LOGO_SRC = DRY_RUN ? '../public/pinchopan.png' : 'cid:logo-pinchopan'
const TZ = process.env.TZ

// ── Rango del día (medianoche a medianoche en la zona horaria configurada) ──
const base = process.env.REPORT_DATE ? new Date(process.env.REPORT_DATE + 'T12:00:00') : new Date()
const start = new Date(base.getFullYear(), base.getMonth(), base.getDate())
const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)

const rawDay = new Intl.DateTimeFormat('es', { dateStyle: 'full', timeZone: TZ }).format(start)
const dayLabel = rawDay.charAt(0).toUpperCase() + rawDay.slice(1)
const timeFmt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const num = new Intl.NumberFormat('es', { maximumFractionDigits: 3 })
const fileDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

const TYPE = { entrada: 'Entrada', salida: 'Uso / Salida', ajuste: 'Ajuste' }
const TYPE_COLOR = { entrada: '#059669', salida: '#dc2626', ajuste: '#0284c7' }

/** Escapa texto escrito por usuarios antes de meterlo en el HTML del correo. */
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const toDate = (v) => (v instanceof Timestamp ? v.toDate() : null)

async function withRetry(fn, label, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i >= tries) throw err
      console.warn(`⚠ ${label}: intento ${i} falló (${err.message}). Reintentando…`)
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
}

// ── Datos desde Firestore ───────────────────────────────────────────────────
const [movSnap, productsSnap, adminsSnap] = await withRetry(
  () =>
    Promise.all([
      db
        .collection('movements')
        .where('createdAt', '>=', Timestamp.fromDate(start))
        .where('createdAt', '<', Timestamp.fromDate(end))
        .orderBy('createdAt', 'asc')
        .get(),
      db.collection('products').get(),
      db.collection('users').where('role', '==', 'admin').get(),
    ]),
  'lectura de Firestore',
)

const movements = movSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.get('createdAt')) }))
const products = productsSnap.docs.map((d) => ({
  id: d.id,
  ...d.data(),
  createdAt: toDate(d.get('createdAt')),
}))
const newProducts = products.filter((p) => p.createdAt && p.createdAt >= start && p.createdAt < end)
const alerts = products
  .filter((p) => !p.archived && p.quantity <= p.minStock)
  .sort((a, b) => a.quantity - b.quantity)

const recipients = [
  ...adminsSnap.docs.filter((d) => d.get('active') !== false).map((d) => d.get('email')),
  ...(process.env.REPORT_EXTRA_TO || '').split(','),
]
  .map((e) => (e || '').trim().toLowerCase())
  .filter((e, i, a) => e && a.indexOf(e) === i)

// ── Agregados ───────────────────────────────────────────────────────────────
const count = { entrada: 0, salida: 0, ajuste: 0 }
const byUser = new Map()
const byProduct = new Map()
for (const m of movements) {
  count[m.type]++
  const u = byUser.get(m.user.uid) ?? { name: m.user.name, email: m.user.email, entrada: 0, salida: 0, ajuste: 0 }
  u[m.type]++
  byUser.set(m.user.uid, u)
  const p = byProduct.get(m.productId) ?? { name: m.productName, sku: m.sku, unit: m.unit, ingresado: 0, usado: 0, ajuste: 0 }
  if (m.type === 'entrada') p.ingresado += m.quantity
  else if (m.type === 'salida') p.usado += m.quantity
  else p.ajuste += m.delta
  byProduct.set(m.productId, p)
}
const stockOf = new Map(products.map((p) => [p.id, p]))

console.log(`Día ${fileDate} (${TZ}): ${movements.length} movimientos, ${newProducts.length} productos nuevos, ${alerts.length} alertas`)
console.log(`Destinatarios: ${recipients.length ? recipients.join(', ') : '(ninguno)'}`)

if (movements.length === 0 && newProducts.length === 0 && process.env.REPORT_SKIP_EMPTY === 'true') {
  console.log('Sin actividad hoy y REPORT_SKIP_EMPTY=true → no se envía correo.')
  process.exit(0)
}

// ── HTML del correo ─────────────────────────────────────────────────────────
const C = { brand: '#4f46e5', fg: '#111827', muted: '#6b7280', line: '#e5e7eb', bg: '#f4f5fb' }
const th = (t, align = 'left') =>
  `<th style="padding:8px 10px;text-align:${align};font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${C.muted};border-bottom:1px solid ${C.line};font-weight:600">${t}</th>`
const td = (t, extra = '') => `<td style="padding:8px 10px;font-size:13px;color:${C.fg};border-bottom:1px solid ${C.line};${extra}">${t}</td>`
const section = (title, body) => `
  <tr><td style="padding:24px 28px 0">
    <h2 style="margin:0 0 10px;font-size:15px;color:${C.fg}">${title}</h2>
    ${body}
  </td></tr>`
const table = (head, rows) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid ${C.line};border-radius:10px">${head}${rows}</table>`
const empty = (t) => `<p style="margin:0;font-size:13px;color:${C.muted}">${t}</p>`
const kpi = (label, value, color) => `
  <td width="25%" style="padding:6px">
    <div style="background:#fff;border:1px solid ${C.line};border-radius:12px;padding:12px 14px">
      <div style="font-size:11px;color:${C.muted}">${label}</div>
      <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
    </div>
  </td>`

const movementRows = movements
  .map((m) =>
    `<tr>${td(m.createdAt ? timeFmt.format(m.createdAt) : '—', 'white-space:nowrap;color:' + C.muted)}${td(esc(m.user.name))}${td(
      `<span style="color:${TYPE_COLOR[m.type]};font-weight:600">${TYPE[m.type]}</span>`,
    )}${td(`${esc(m.productName)}<br><span style="color:${C.muted};font-size:11px">${esc(m.sku)}</span>`)}${td(
      `<b style="color:${m.delta > 0 ? '#059669' : '#dc2626'}">${m.delta > 0 ? '+' : ''}${num.format(m.delta)}</b> ${esc(m.unit)}`,
      'white-space:nowrap;text-align:right',
    )}${td(`${num.format(m.previousQty)} → <b>${num.format(m.newQty)}</b>`, 'white-space:nowrap;text-align:right')}${td(
      esc(m.reason) + (m.note ? `<br><span style="color:${C.muted};font-size:11px">${esc(m.note)}</span>` : ''),
    )}</tr>`,
  )
  .join('')

const userRows = [...byUser.values()]
  .sort((a, b) => b.entrada + b.salida + b.ajuste - (a.entrada + a.salida + a.ajuste))
  .map((u) => `<tr>${td(`${esc(u.name)}<br><span style="color:${C.muted};font-size:11px">${esc(u.email)}</span>`)}${td(u.entrada, 'text-align:right')}${td(u.salida, 'text-align:right')}${td(u.ajuste, 'text-align:right')}</tr>`)
  .join('')

const productRows = [...byProduct.entries()]
  .sort((a, b) => b[1].usado - a[1].usado)
  .map(([id, p]) => {
    const now = stockOf.get(id)
    return `<tr>${td(`${esc(p.name)}<br><span style="color:${C.muted};font-size:11px">${esc(p.sku)}</span>`)}${td(
      p.ingresado ? `+${num.format(p.ingresado)}` : '—',
      'text-align:right;color:#059669',
    )}${td(p.usado ? `-${num.format(p.usado)}` : '—', 'text-align:right;color:#dc2626')}${td(
      now ? `<b>${num.format(now.quantity)}</b> ${esc(p.unit)}` : '—',
      'text-align:right;white-space:nowrap',
    )}</tr>`
  })
  .join('')

const initialQty = (p) =>
  movements.find((m) => m.productId === p.id && m.previousQty === 0 && m.reason === 'Ingreso inicial')?.newQty ?? 0
const newRows = newProducts
  .map((p) => `<tr>${td(`${esc(p.name)}<br><span style="color:${C.muted};font-size:11px">${esc(p.sku)} · ${esc(p.category)}</span>`)}${td(esc(p.createdBy?.name))}${td(`${num.format(initialQty(p))} ${esc(p.unit)}`, 'text-align:right')}${td(`${num.format(p.quantity)} ${esc(p.unit)}`, 'text-align:right')}</tr>`)
  .join('')

const alertRows = alerts
  .map((p) => {
    const out = p.quantity <= 0
    return `<tr>${td(`${esc(p.name)}<br><span style="color:${C.muted};font-size:11px">${esc(p.sku)} · ${esc(p.location || 'sin ubicación')}</span>`)}${td(
      `<span style="color:${out ? '#dc2626' : '#d97706'};font-weight:600">${out ? 'Agotado' : 'Stock bajo'}</span>`,
    )}${td(`${num.format(p.quantity)} / mín. ${num.format(p.minStock)} ${esc(p.unit)}`, 'text-align:right;white-space:nowrap')}</tr>`
  })
  .join('')

const appUrl = process.env.APP_URL
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${C.bg};font-family:Inter,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bg};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${C.line}">
  <tr><td style="background:${C.brand};background-image:linear-gradient(135deg,#4f46e5,#7c3aed);padding:26px 28px;color:#fff">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:14px">
        <div style="background:#fff;border-radius:14px;padding:6px;width:56px;height:56px;text-align:center">
          <img src="${LOGO_SRC}" alt="Pincho Pan" width="56" height="50" style="display:block;width:56px;height:auto;margin:3px auto 0">
        </div>
      </td>
      <td style="vertical-align:middle">
        <div style="font-size:12px;opacity:.85">${COMPANY} · Reporte diario</div>
        <div style="font-size:22px;font-weight:700;margin-top:2px">Actividad del almacén</div>
        <div style="font-size:14px;opacity:.9;margin-top:2px">${esc(dayLabel)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:18px 22px 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      ${kpi('Movimientos', movements.length, C.fg)}${kpi('Entradas', count.entrada, '#059669')}${kpi('Usos', count.salida, '#dc2626')}${kpi('Productos nuevos', newProducts.length, C.brand)}
    </tr></table>
  </td></tr>
  ${section('👥 Actividad por usuario', byUser.size ? table(`<tr>${th('Usuario')}${th('Entradas', 'right')}${th('Usos', 'right')}${th('Ajustes', 'right')}</tr>`, userRows) : empty('Nadie registró movimientos hoy.'))}
  ${section('📦 Productos movidos hoy', byProduct.size ? table(`<tr>${th('Producto')}${th('Ingresado', 'right')}${th('Usado', 'right')}${th('Stock actual', 'right')}</tr>`, productRows) : empty('Sin movimientos de productos.'))}
  ${section('🧾 Detalle de todos los movimientos', movements.length ? table(`<tr>${th('Hora')}${th('Usuario')}${th('Tipo')}${th('Producto')}${th('Cantidad', 'right')}${th('Stock', 'right')}${th('Motivo')}</tr>`, movementRows) : empty('No hubo movimientos durante el día.'))}
  ${section('🆕 Productos registrados hoy', newProducts.length ? table(`<tr>${th('Producto')}${th('Registrado por')}${th('Cantidad inicial', 'right')}${th('Stock actual', 'right')}</tr>`, newRows) : empty('No se registraron productos nuevos.'))}
  ${section('⚠️ Alertas de stock (estado actual)', alerts.length ? table(`<tr>${th('Producto')}${th('Estado')}${th('Cantidad', 'right')}</tr>`, alertRows) : empty('Todos los productos están por encima del stock mínimo. ✅'))}
  <tr><td style="padding:24px 28px 28px">
    ${appUrl ? `<a href="${esc(appUrl)}" style="display:inline-block;background:${C.brand};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">Abrir el almacén</a>` : ''}
    <p style="margin:16px 0 0;font-size:12px;color:${C.muted}">Se adjunta un Excel con el detalle completo. Recibes este correo porque eres administrador del almacén.</p>
    <p style="margin:6px 0 0;font-size:11px;color:${C.muted}">© ${new Date().getFullYear()} ${COMPANY} · Proyecto ${esc(projectId)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

const text = [
  `Actividad del almacén — ${dayLabel}`,
  `Movimientos: ${movements.length} (entradas ${count.entrada}, usos ${count.salida}, ajustes ${count.ajuste}) · Productos nuevos: ${newProducts.length} · Alertas: ${alerts.length}`,
  '',
  ...movements.map(
    (m) => `${m.createdAt ? timeFmt.format(m.createdAt) : '—'}  ${m.user.name}  ${TYPE[m.type]}  ${m.productName}  ${m.delta > 0 ? '+' : ''}${num.format(m.delta)} ${m.unit}  (${m.reason})`,
  ),
].join('\n')

// ── Excel adjunto ───────────────────────────────────────────────────────────
async function buildExcel() {
  const wb = new ExcelJS.Workbook()
  wb.creator = COMPANY
  const addSheet = (name, columns, rows) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = columns.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }))
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    })
    rows.forEach((r) => ws.addRow(r))
    if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } }
  }
  const N = '#,##0.###'
  addSheet(
    'Movimientos',
    [['Fecha', 'fecha', 18, 'dd/mm/yyyy hh:mm'], ['Usuario', 'usuario', 20], ['Correo', 'correo', 24], ['Tipo', 'tipo', 13], ['SKU', 'sku', 13], ['Producto', 'producto', 32], ['Cantidad', 'cantidad', 11, N], ['Unidad', 'unidad', 9], ['Stock anterior', 'antes', 14, N], ['Stock nuevo', 'despues', 13, N], ['Motivo', 'motivo', 20], ['Nota', 'nota', 30]],
    movements.map((m) => ({
      // Excel no guarda zona horaria: se escribe la hora local del almacén.
      fecha: m.createdAt ? new Date(m.createdAt.getTime() - m.createdAt.getTimezoneOffset() * 60000) : null,
      usuario: m.user.name, correo: m.user.email, tipo: TYPE[m.type], sku: m.sku, producto: m.productName,
      cantidad: m.delta, unidad: m.unit, antes: m.previousQty, despues: m.newQty, motivo: m.reason, nota: m.note,
    })),
  )
  addSheet(
    'Resumen por producto',
    [['SKU', 'sku', 13], ['Producto', 'name', 32], ['Unidad', 'unit', 9], ['Ingresado', 'ingresado', 12, N], ['Usado', 'usado', 12, N], ['Stock actual', 'stock', 13, N]],
    [...byProduct.entries()].map(([id, p]) => ({ ...p, stock: stockOf.get(id)?.quantity ?? null })),
  )
  addSheet(
    'Alertas de stock',
    [['SKU', 'sku', 13], ['Producto', 'name', 32], ['Ubicación', 'location', 12], ['Cantidad', 'quantity', 11, N], ['Mínimo', 'minStock', 10, N], ['Unidad', 'unit', 9]],
    alerts,
  )
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const xlsx = await buildExcel()
const subject = `📦 Almacén Pincho Pan · ${movements.length} movimientos el ${fileDate}${alerts.length ? ` · ⚠️ ${alerts.length} alertas` : ''}`

if (DRY_RUN) {
  mkdirSync('report-output', { recursive: true })
  writeFileSync(join('report-output', `reporte-${fileDate}.html`), html)
  writeFileSync(join('report-output', `reporte-${fileDate}.xlsx`), xlsx)
  console.log(`\n[simulación] Asunto: ${subject}`)
  console.log(`[simulación] Guardado en report-output/reporte-${fileDate}.html y .xlsx (no se envió nada)`)
  process.exit(0)
}

if (recipients.length === 0) {
  console.error('✖ No hay administradores activos con correo ni REPORT_EXTRA_TO. No se envía nada.')
  process.exit(1)
}

const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS } = process.env
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('✖ Faltan SMTP_HOST, SMTP_USER o SMTP_PASS.')
  process.exit(1)
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
})

await withRetry(() => transport.verify(), 'conexión SMTP')
const info = await withRetry(
  () =>
    transport.sendMail({
      from: { name: 'Almacén Pincho Pan', address: process.env.MAIL_FROM || SMTP_USER },
      to: SMTP_USER,
      bcc: recipients, // cada admin recibe el correo sin ver los demás destinatarios
      subject,
      text,
      html,
      attachments: [
        { filename: `almacen-${fileDate}.xlsx`, content: xlsx },
        { filename: 'pinchopan.png', path: fileURLToPath(LOGO_PATH), cid: 'logo-pinchopan' },
      ],
    }),
  'envío del correo',
)
console.log(`✔ Reporte enviado a ${recipients.length} destinatario(s). Id: ${info.messageId}`)
