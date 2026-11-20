import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from '../firebase.config'

const env = import.meta.env
const pick = (envValue: string | undefined, fileValue: string) => (envValue?.trim() ? envValue.trim() : fileValue.trim())

const config = {
  apiKey: pick(env.VITE_FIREBASE_API_KEY, firebaseConfig.apiKey),
  authDomain: pick(env.VITE_FIREBASE_AUTH_DOMAIN, firebaseConfig.authDomain),
  projectId: pick(env.VITE_FIREBASE_PROJECT_ID, firebaseConfig.projectId),
  storageBucket: pick(env.VITE_FIREBASE_STORAGE_BUCKET, firebaseConfig.storageBucket),
  messagingSenderId: pick(env.VITE_FIREBASE_MESSAGING_SENDER_ID, firebaseConfig.messagingSenderId),
  appId: pick(env.VITE_FIREBASE_APP_ID, firebaseConfig.appId),
  measurementId: pick(env.VITE_FIREBASE_MEASUREMENT_ID, firebaseConfig.measurementId ?? ''),
}

export const useEmulators = env.VITE_USE_EMULATORS === 'true'

/** Campos que faltan en la configuración (vacío = todo listo). */
export const missingConfig = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter((k) => !config[k])
export const isFirebaseConfigured = missingConfig.length === 0
export const firebaseProjectId = config.projectId

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

export function getFirebase() {
  if (!isFirebaseConfigured) throw new Error(`Falta configurar Firebase: ${missingConfig.join(', ')}`)
  if (!app) {
    app = initializeApp(config)
    auth = getAuth(app)
    // La fuente de verdad es siempre Firestore. La caché local solo sirve para seguir
    // mostrando los últimos datos recibidos si se cae la conexión; al volver, se resincroniza.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    if (useEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
    } else if (config.measurementId && import.meta.env.PROD) {
      // Analytics solo en producción; se carga aparte y nunca bloquea la app.
      const firebaseApp = app
      import('firebase/analytics')
        .then(async ({ getAnalytics, isSupported }) => {
          if (await isSupported()) getAnalytics(firebaseApp)
        })
        .catch(() => undefined)
    }
  }
  return { app, auth: auth!, db: db! }
}
