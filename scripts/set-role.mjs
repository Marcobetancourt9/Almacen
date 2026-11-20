// Cambia el rol de un usuario desde la terminal (útil si nadie tiene rol admin).
// Uso:  node scripts/set-role.mjs correo@empresa.com admin|operator|viewer
import { FieldValue } from 'firebase-admin/firestore'
import { auth, db } from './admin.mjs'

const [email, role] = process.argv.slice(2)
if (!email || !['admin', 'operator', 'viewer'].includes(role)) {
  console.error('Uso: node scripts/set-role.mjs <correo> <admin|operator|viewer>')
  process.exit(1)
}

const user = await auth.getUserByEmail(email)
await db.collection('users').doc(user.uid).set(
  {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || email.split('@')[0],
    role,
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
)
console.log(`✔ ${email} ahora tiene el rol "${role}"`)
