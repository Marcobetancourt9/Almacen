const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red.',
  'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado en Firebase (Authentication → Método de acceso).',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con ese correo. Inicia sesión con correo y contraseña.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.',
  'permission-denied': 'No tienes permisos para realizar esta acción.',
  unavailable: 'El servidor no está disponible. Revisa tu conexión e inténtalo de nuevo.',
  aborted: 'Otro usuario modificó este producto al mismo tiempo. Inténtalo de nuevo.',
  'failed-precondition': 'Falta un índice o configuración en Firestore. Revisa la consola.',
  'deadline-exceeded': 'La operación tardó demasiado. Inténtalo de nuevo.',
}

export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code)
    if (MESSAGES[code]) return MESSAGES[code]
  }
  if (err instanceof Error && err.message) return err.message
  return 'Ocurrió un error inesperado.'
}
