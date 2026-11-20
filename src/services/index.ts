import { isFirebaseConfigured } from '../lib/firebase'
import type { Backend } from './backend'
import { createFirebaseBackend } from './firebaseBackend'

/**
 * Instancia única del backend. Todos los datos vienen de Firebase.
 * Si aún no hay credenciales es `null` y la app muestra la pantalla de configuración.
 */
export const backend: Backend = isFirebaseConfigured ? createFirebaseBackend() : (null as unknown as Backend)
