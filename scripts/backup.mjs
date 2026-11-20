// Exporta todas las colecciones de Firestore a archivos JSON.
// Uso:  node scripts/backup.mjs [carpeta-destino]
// Resultado: <destino>/<AAAA-MM-DD_HHmm>/{users,products,movements,config}.json + manifest.json
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Timestamp } from 'firebase-admin/firestore'
import { COLLECTIONS, db, projectId } from './admin.mjs'

const PAGE = 1000

/** Convierte Timestamps a un formato JSON reversible. */
function serialize(value) {
  if (value instanceof Timestamp) return { __ts: value.toDate().toISOString() }
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]))
  }
  return value
}

async function exportCollection(name) {
  const docs = []
  let last
  // Paginación por ID para soportar colecciones grandes sin agotar memoria del servidor.
  for (;;) {
    let q = db.collection(name).orderBy('__name__').limit(PAGE)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    for (const d of snap.docs) docs.push({ id: d.id, data: serialize(d.data()) })
    if (snap.size < PAGE) break
    last = snap.docs[snap.docs.length - 1]
  }
  return docs
}

async function withRetry(fn, label, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i >= tries) throw err
      const ms = 1000 * 2 ** i
      console.warn(`⚠ ${label}: intento ${i} falló (${err.message}). Reintentando en ${ms / 1000}s…`)
      await new Promise((r) => setTimeout(r, ms))
    }
  }
}

const now = new Date()
const stamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '')
const outDir = join(process.argv[2] ?? 'backup-output', stamp)
mkdirSync(outDir, { recursive: true })

const manifest = { projectId, createdAt: now.toISOString(), collections: {} }

for (const name of COLLECTIONS) {
  const docs = await withRetry(() => exportCollection(name), name)
  const json = JSON.stringify(docs, null, 2)
  writeFileSync(join(outDir, `${name}.json`), json)
  manifest.collections[name] = {
    count: docs.length,
    sha256: createHash('sha256').update(json).digest('hex'),
  }
  console.log(`✔ ${name}: ${docs.length} documentos`)
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\nBackup completo en ${outDir}`)
