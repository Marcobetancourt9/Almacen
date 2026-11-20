// Pruebas de las reglas de seguridad contra el emulador de Firestore.
// Ejecutar con:  npm run test:rules   (requiere Java)
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { readFileSync } from 'node:fs'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

const ts = () => firebase.firestore.FieldValue.serverTimestamp()

let env
const USERS = {
  admin: { uid: 'admin1', email: 'admin@x.com', name: 'Admin' },
  op: { uid: 'op1', email: 'op@x.com', name: 'Operador' },
  view: { uid: 'view1', email: 'view@x.com', name: 'Lector' },
}
const db = (u) => env.authenticatedContext(u.uid, { email: u.email }).firestore()
const ref = (u) => ({ uid: u.uid, name: u.name, email: u.email })

/** Replica createProfile() de la app. */
async function signUp(u) {
  const d = db(u)
  const userRef = d.collection('users').doc(u.uid)
  const setupRef = d.collection('config').doc('setup')
  await d.runTransaction(async (tx) => {
    const setup = await tx.get(setupRef)
    const first = !setup.exists
    tx.set(userRef, { uid: u.uid, email: u.email, displayName: u.name, role: first ? 'admin' : 'viewer', active: true, createdAt: ts() })
    if (first) tx.set(setupRef, { adminUid: u.uid, createdAt: ts() })
  })
}

/** Replica products.create() de la app. */
function createProduct(u, sku, qty, overrides = {}) {
  const d = db(u)
  const pRef = d.collection('products').doc(sku)
  const mRef = qty > 0 ? d.collection('movements').doc() : null
  return d.runTransaction(async (tx) => {
    await tx.get(pRef)
    tx.set(pRef, {
      sku, name: 'Producto ' + sku, description: '', category: 'General', unit: 'unidad', location: '',
      minStock: 1, quantity: qty, archived: false, lastMovementId: mRef?.id ?? null,
      createdBy: ref(u), createdAt: ts(), updatedBy: ref(u), updatedAt: ts(), ...overrides,
    })
    if (mRef) {
      tx.set(mRef, {
        productId: sku, productName: 'Producto ' + sku, sku, unit: 'unidad', type: 'entrada', quantity: qty, delta: qty,
        previousQty: 0, newQty: qty, reason: 'Ingreso inicial', note: '', user: ref(u), createdAt: ts(),
      })
    }
  })
}

/** Replica movements.register() de la app, con posibilidad de "mentir" en campos. */
function move(u, sku, type, amount, lie = {}) {
  const d = db(u)
  const pRef = d.collection('products').doc(sku)
  return d.runTransaction(async (tx) => {
    const snap = await tx.get(pRef)
    const prev = snap.data().quantity
    const delta = type === 'entrada' ? amount : type === 'salida' ? -amount : amount - prev
    const newQty = prev + delta
    const mRef = d.collection('movements').doc()
    tx.set(mRef, {
      productId: sku, productName: 'Producto ' + sku, sku, unit: 'unidad', type, quantity: Math.abs(delta), delta,
      previousQty: prev, newQty, reason: 'Producción', note: '', user: ref(u), createdAt: ts(), ...lie.movement,
    })
    tx.update(pRef, { quantity: lie.productQty ?? newQty, lastMovementId: mRef.id, updatedBy: ref(u), updatedAt: ts() })
  })
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-almacen',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  await env.clearFirestore()
})

after(async () => {
  await env?.cleanup()
})

describe('usuarios y roles', () => {
  test('el primer usuario se convierte en admin', async () => {
    await assertSucceeds(signUp(USERS.admin))
    const snap = await db(USERS.admin).collection('users').doc(USERS.admin.uid).get()
    assert.equal(snap.data().role, 'admin')
  })

  test('nadie más puede auto-asignarse admin', async () => {
    await assertFails(
      db(USERS.op).collection('users').doc(USERS.op.uid).set({
        uid: USERS.op.uid, email: USERS.op.email, displayName: 'x', role: 'admin', active: true, createdAt: ts(),
      }),
    )
  })

  test('los siguientes usuarios entran como lectores', async () => {
    await assertSucceeds(signUp(USERS.op))
    await assertSucceeds(signUp(USERS.view))
    const snap = await db(USERS.op).collection('users').doc(USERS.op.uid).get()
    assert.equal(snap.data().role, 'viewer')
  })

  test('un lector no puede cambiarse el rol', async () => {
    await assertFails(db(USERS.op).collection('users').doc(USERS.op.uid).update({ role: 'operator', updatedAt: ts() }))
  })

  test('el admin asigna roles a otros', async () => {
    await assertSucceeds(db(USERS.admin).collection('users').doc(USERS.op.uid).update({ role: 'operator', updatedAt: ts() }))
  })

  test('el admin no puede quitarse su propio rol', async () => {
    await assertFails(db(USERS.admin).collection('users').doc(USERS.admin.uid).update({ role: 'viewer', updatedAt: ts() }))
  })

  test('cada usuario puede cambiar su nombre', async () => {
    await assertSucceeds(db(USERS.view).collection('users').doc(USERS.view.uid).update({ displayName: 'Lector Nuevo', updatedAt: ts() }))
  })
})

describe('productos', () => {
  test('un lector no puede crear productos', async () => {
    await assertFails(createProduct(USERS.view, 'VIEW-1', 0))
  })

  test('un operador crea un producto con stock inicial y su movimiento', async () => {
    await assertSucceeds(createProduct(USERS.op, 'TOR-M8', 10))
  })

  test('no se puede crear stock sin movimiento', async () => {
    await assertFails(
      db(USERS.op).collection('products').doc('FAKE-1').set({
        sku: 'FAKE-1', name: 'Falso', description: '', category: 'G', unit: 'unidad', location: '', minStock: 0,
        quantity: 50, archived: false, lastMovementId: null,
        createdBy: ref(USERS.op), createdAt: ts(), updatedBy: ref(USERS.op), updatedAt: ts(),
      }),
    )
  })

  test('no se puede firmar como otro usuario', async () => {
    await assertFails(createProduct(USERS.op, 'OTRO-1', 0, { createdBy: ref(USERS.admin) }))
  })

  test('campos desconocidos o inválidos se rechazan', async () => {
    await assertFails(createProduct(USERS.op, 'MAL-1', 0, { precio: 10 }))
    await assertFails(createProduct(USERS.op, 'MAL-2', 0, { unit: 'tonelada' }))
  })

  test('un operador edita datos sin tocar el stock', async () => {
    await assertSucceeds(
      db(USERS.op).collection('products').doc('TOR-M8').update({ name: 'Tornillo M8', updatedBy: ref(USERS.op), updatedAt: ts() }),
    )
  })

  test('no se puede cambiar el stock directamente', async () => {
    await assertFails(
      db(USERS.op).collection('products').doc('TOR-M8').update({ quantity: 999, updatedBy: ref(USERS.op), updatedAt: ts() }),
    )
  })

  test('solo el admin archiva', async () => {
    await assertFails(db(USERS.op).collection('products').doc('TOR-M8').update({ archived: true, updatedBy: ref(USERS.op), updatedAt: ts() }))
  })

  test('los productos no se borran', async () => {
    await assertFails(db(USERS.admin).collection('products').doc('TOR-M8').delete())
  })
})

describe('movimientos', () => {
  test('registrar un uso válido descuenta el stock', async () => {
    await assertSucceeds(move(USERS.op, 'TOR-M8', 'salida', 3))
    const snap = await db(USERS.op).collection('products').doc('TOR-M8').get()
    assert.equal(snap.data().quantity, 7)
  })

  test('entrada y ajuste válidos', async () => {
    await assertSucceeds(move(USERS.op, 'TOR-M8', 'entrada', 2.5))
    await assertSucceeds(move(USERS.admin, 'TOR-M8', 'ajuste', 12))
  })

  test('no se puede usar más de lo que hay', async () => {
    await assertFails(move(USERS.op, 'TOR-M8', 'salida', 1000))
  })

  test('un lector no registra movimientos', async () => {
    await assertFails(move(USERS.view, 'TOR-M8', 'salida', 1))
  })

  test('el stock anterior declarado debe ser el real', async () => {
    await assertFails(move(USERS.op, 'TOR-M8', 'salida', 1, { movement: { previousQty: 500, newQty: 499 } }))
  })

  test('el stock del producto debe coincidir con el movimiento', async () => {
    await assertFails(move(USERS.op, 'TOR-M8', 'salida', 1, { productQty: 100 }))
  })

  test('no se puede registrar a nombre de otro', async () => {
    await assertFails(move(USERS.op, 'TOR-M8', 'salida', 1, { movement: { user: ref(USERS.admin) } }))
  })

  test('el historial es inmutable', async () => {
    const list = await db(USERS.op).collection('movements').limit(1).get()
    const id = list.docs[0].id
    await assertFails(db(USERS.admin).collection('movements').doc(id).update({ note: 'editado' }))
    await assertFails(db(USERS.admin).collection('movements').doc(id).delete())
  })
})

describe('cuentas desactivadas', () => {
  test('un usuario desactivado pierde el acceso', async () => {
    await assertSucceeds(db(USERS.admin).collection('users').doc(USERS.op.uid).update({ active: false, updatedAt: ts() }))
    await assertFails(db(USERS.op).collection('products').get())
    await assertFails(move(USERS.op, 'TOR-M8', 'salida', 1))
  })

  test('sin sesión no se lee nada', async () => {
    await assertFails(env.unauthenticatedContext().firestore().collection('products').get())
  })
})
