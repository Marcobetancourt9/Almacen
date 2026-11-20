// Inicializa firebase-admin a partir de una cuenta de servicio.
// Acepta (en este orden):
//   1. FIRESTORE_EMULATOR_HOST       → usa el emulador local (pruebas, sin credenciales)
//   2. FIREBASE_SERVICE_ACCOUNT      → JSON completo de la cuenta de servicio (ideal para GitHub Actions)
//   3. GOOGLE_APPLICATION_CREDENTIALS → ruta a un archivo .json (uso local)
import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function loadCredentials() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  if (inline) return JSON.parse(inline)
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (file) return JSON.parse(readFileSync(file, 'utf8'))
  console.error(
    '✖ Falta la cuenta de servicio. Define FIREBASE_SERVICE_ACCOUNT (JSON) o GOOGLE_APPLICATION_CREDENTIALS (ruta al .json).',
  )
  process.exit(1)
}

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const credentials = emulator ? null : loadCredentials()
const app = emulator
  ? initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-almacen' })
  : initializeApp({ credential: cert(credentials), projectId: credentials.project_id })

export const db = getFirestore(app)
export const auth = getAuth(app)
export const projectId = emulator ? app.options.projectId : credentials.project_id

export const COLLECTIONS = ['users', 'products', 'movements', 'config']
