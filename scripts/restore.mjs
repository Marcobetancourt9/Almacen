// Restaura un backup generado por backup.mjs.
// Uso:  node scripts/restore.mjs <carpeta-del-backup> --yes [--only=products,movements]
// ⚠ Sobrescribe los documentos con el mismo ID. No borra documentos que no estén en el backup.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Timestamp } from 'firebase-admin/firestore'
import { COLLECTIONS, db, projectId } from './admin.mjs'

const dir = process.argv[2]
const confirmed = process.argv.includes('--yes')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice(7).split(',') : COLLECTIONS

if (!dir || !existsSync(join(dir, 'manifest.json'))) {
  console.error('✖ Indica la carpeta de un backup válido (debe contener manifest.json).')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
console.log(`Backup del proyecto "${manifest.projectId}" creado el ${manifest.createdAt}`)
console.log(`Destino: proyecto "${projectId}" · colecciones: ${only.join(', ')}`)

if (!confirmed) {
  console.log('\nModo simulación. Añade --yes para escribir los datos.')
}

function deserialize(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.__ts === 'string' && Object.keys(value).length === 1) return Timestamp.fromDate(new Date(value.__ts))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deserialize(v)]))
  }
  if (Array.isArray(value)) return value.map(deserialize)
  return value
}

for (const name of only) {
  const file = join(dir, `${name}.json`)
  if (!existsSync(file)) continue
  const raw = readFileSync(file, 'utf8')
  const expected = manifest.collections[name]?.sha256
  if (expected && createHash('sha256').update(raw).digest('hex') !== expected) {
    console.error(`✖ ${name}.json está corrupto (checksum no coincide). Se omite.`)
    continue
  }
  const docs = JSON.parse(raw)
  if (!confirmed) {
    console.log(`· ${name}: ${docs.length} documentos se restaurarían`)
    continue
  }
  const writer = db.bulkWriter()
  for (const d of docs) writer.set(db.collection(name).doc(d.id), deserialize(d.data))
  await writer.close()
  console.log(`✔ ${name}: ${docs.length} documentos restaurados`)
}
