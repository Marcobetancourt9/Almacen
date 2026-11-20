import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocsFromServer,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { AppError } from '../lib/errors'
import { getFirebase } from '../lib/firebase'
import { normalizeSku } from '../lib/validation'
import type { AppUser, Movement, Product, Role, UserRef } from '../types'
import type { Backend, MovementQuery } from './backend'
import { assertCanWrite, computeMovement, toUserRef } from './stock'

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null)

const readData = (snap: QueryDocumentSnapshot<DocumentData>) => snap.data({ serverTimestamps: 'estimate' })

function mapUser(id: string, d: DocumentData): AppUser {
  return {
    uid: id,
    email: d.email ?? '',
    displayName: d.displayName ?? d.email ?? 'Usuario',
    role: (d.role ?? 'viewer') as Role,
    active: d.active !== false,
    createdAt: toDate(d.createdAt),
  }
}

function mapRef(d: unknown): UserRef {
  const r = (d ?? {}) as Partial<UserRef>
  return { uid: r.uid ?? '', name: r.name ?? 'Desconocido', email: r.email ?? '' }
}

function mapProduct(id: string, d: DocumentData): Product {
  return {
    id,
    sku: d.sku ?? id,
    name: d.name ?? '',
    description: d.description ?? '',
    category: d.category ?? 'General',
    unit: d.unit ?? 'unidad',
    location: d.location ?? '',
    quantity: Number(d.quantity ?? 0),
    minStock: Number(d.minStock ?? 0),
    archived: Boolean(d.archived),
    lastMovementId: d.lastMovementId ?? null,
    createdBy: mapRef(d.createdBy),
    createdAt: toDate(d.createdAt),
    updatedBy: mapRef(d.updatedBy ?? d.createdBy),
    updatedAt: toDate(d.updatedAt),
  }
}

function mapMovement(id: string, d: DocumentData): Movement {
  return {
    id,
    productId: d.productId,
    productName: d.productName ?? '',
    sku: d.sku ?? '',
    unit: d.unit ?? 'unidad',
    type: d.type,
    quantity: Number(d.quantity ?? 0),
    delta: Number(d.delta ?? 0),
    previousQty: Number(d.previousQty ?? 0),
    newQty: Number(d.newQty ?? 0),
    reason: d.reason ?? '',
    note: d.note ?? '',
    user: mapRef(d.user),
    createdAt: toDate(d.createdAt),
  }
}

export function createFirebaseBackend(): Backend {
  const { auth, db } = getFirebase()
  let signingUp = false

  function movementsQuery(q: MovementQuery) {
    const c: QueryConstraint[] = []
    if (q.productId) c.push(where('productId', '==', q.productId))
    if (q.from) c.push(where('createdAt', '>=', Timestamp.fromDate(q.from)))
    if (q.to) c.push(where('createdAt', '<=', Timestamp.fromDate(q.to)))
    c.push(orderBy('createdAt', 'desc'), fsLimit(q.limit ?? 300))
    return query(collection(db, 'movements'), ...c)
  }

  /** Fuerza la lectura en el servidor; sin conexión falla con un mensaje claro. */
  async function serverRead<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'unavailable')
        throw new AppError('Sin conexión con Firebase. Conéctate a internet para obtener los datos actualizados.')
      throw err
    }
  }

  /**
   * Crea el perfil del usuario. El primer usuario del sistema se convierte en
   * administrador de forma atómica (documento config/setup); el resto entra como lector.
   */
  async function createProfile(uid: string, email: string, displayName: string) {
    const userRef = doc(db, 'users', uid)
    const setupRef = doc(db, 'config', 'setup')
    await runTransaction(db, async (tx) => {
      const [userSnap, setupSnap] = await Promise.all([tx.get(userRef), tx.get(setupRef)])
      if (userSnap.exists()) return
      const firstUser = !setupSnap.exists()
      tx.set(userRef, {
        uid,
        email,
        displayName,
        role: firstUser ? 'admin' : 'viewer',
        active: true,
        createdAt: serverTimestamp(),
      })
      if (firstUser) tx.set(setupRef, { adminUid: uid, createdAt: serverTimestamp() })
    })
  }

  return {
    auth: {
      onChange(cb, onError) {
        let unsubProfile: (() => void) | undefined
        const unsubAuth = onAuthStateChanged(
          auth,
          (fbUser) => {
            unsubProfile?.()
            unsubProfile = undefined
            if (!fbUser) return cb(null)
            unsubProfile = onSnapshot(
              doc(db, 'users', fbUser.uid),
              (snap) => {
                if (snap.exists()) return cb(mapUser(snap.id, snap.data({ serverTimestamps: 'estimate' })))
                // Perfil inexistente (p. ej. usuario creado desde la consola): se crea automáticamente.
                if (!signingUp && !snap.metadata.fromCache) {
                  const email = fbUser.email ?? ''
                  createProfile(fbUser.uid, email, fbUser.displayName || email.split('@')[0]).catch(onError)
                }
              },
              onError,
            )
          },
          onError,
        )
        return () => {
          unsubProfile?.()
          unsubAuth()
        }
      },

      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },

      async signUp(displayName, email, password) {
        signingUp = true
        try {
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
          await updateProfile(cred.user, { displayName })
          await createProfile(cred.user.uid, cred.user.email ?? email.trim(), displayName)
        } finally {
          signingUp = false
        }
      },

      async signInWithGoogle() {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        signingUp = true
        try {
          const cred = await signInWithPopup(auth, provider)
          const u = cred.user
          // Si es la primera vez, crea su perfil (el primer usuario del sistema será admin).
          await createProfile(u.uid, u.email ?? '', u.displayName || (u.email ?? '').split('@')[0])
          return true
        } catch (err) {
          const code = (err as { code?: string }).code
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false
          if (code === 'auth/popup-blocked') {
            // Navegadores que bloquean ventanas emergentes (p. ej. algunos móviles): se usa redirección.
            await signInWithRedirect(auth, provider)
            return true
          }
          throw err
        } finally {
          signingUp = false
        }
      },

      async signOut() {
        await signOut(auth)
      },

      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim())
      },

      async updateDisplayName(actor, displayName) {
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName })
        await updateDoc(doc(db, 'users', actor.uid), { displayName, updatedAt: serverTimestamp() })
      },
    },

    products: {
      subscribe(cb, onError) {
        return onSnapshot(
          query(collection(db, 'products'), orderBy('name')),
          (snap) => cb(snap.docs.map((d) => mapProduct(d.id, readData(d)))),
          onError,
        )
      },

      async fetchAll() {
        const snap = await serverRead(() => getDocsFromServer(query(collection(db, 'products'), orderBy('name'))))
        return snap.docs.map((d) => mapProduct(d.id, readData(d)))
      },

      async create(input, actor) {
        assertCanWrite(actor)
        const sku = normalizeSku(input.sku)
        const ref = doc(db, 'products', sku)
        const who = toUserRef(actor)
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref)
          if (snap.exists()) throw new AppError(`Ya existe un producto con el SKU ${sku}.`)
          const movRef = input.initialQuantity > 0 ? doc(collection(db, 'movements')) : null
          tx.set(ref, {
            sku,
            name: input.name,
            description: input.description,
            category: input.category,
            unit: input.unit,
            location: input.location,
            minStock: input.minStock,
            quantity: input.initialQuantity,
            archived: false,
            lastMovementId: movRef?.id ?? null,
            createdBy: who,
            createdAt: serverTimestamp(),
            updatedBy: who,
            updatedAt: serverTimestamp(),
          })
          if (movRef) {
            tx.set(movRef, {
              productId: sku,
              productName: input.name,
              sku,
              unit: input.unit,
              type: 'entrada',
              quantity: input.initialQuantity,
              delta: input.initialQuantity,
              previousQty: 0,
              newQty: input.initialQuantity,
              reason: 'Ingreso inicial',
              note: '',
              user: who,
              createdAt: serverTimestamp(),
            })
          }
        })
        return sku
      },

      async update(id, patch, actor) {
        assertCanWrite(actor)
        await updateDoc(doc(db, 'products', id), {
          ...patch,
          updatedBy: toUserRef(actor),
          updatedAt: serverTimestamp(),
        })
      },

      async setArchived(id, archived, actor) {
        if (actor.role !== 'admin') throw new AppError('Solo un administrador puede archivar productos.')
        await updateDoc(doc(db, 'products', id), {
          archived,
          updatedBy: toUserRef(actor),
          updatedAt: serverTimestamp(),
        })
      },
    },

    movements: {
      subscribe(q, cb, onError) {
        return onSnapshot(
          movementsQuery(q),
          (snap) => cb(snap.docs.map((d) => mapMovement(d.id, readData(d)))),
          onError,
        )
      },

      async fetch(q) {
        const snap = await serverRead(() => getDocsFromServer(movementsQuery({ limit: 50_000, ...q })))
        return snap.docs.map((d) => mapMovement(d.id, readData(d)))
      },

      async register(input, actor) {
        assertCanWrite(actor)
        const productRef = doc(db, 'products', input.productId)
        const who = toUserRef(actor)
        // Transacción: si otro usuario cambia el stock al mismo tiempo, Firestore reintenta
        // con el valor actualizado. Nunca se pierden ni duplican cantidades.
        return runTransaction(db, async (tx) => {
          const snap = await tx.get(productRef)
          if (!snap.exists()) throw new AppError('El producto ya no existe.')
          const product = mapProduct(snap.id, snap.data())
          const calc = computeMovement(product, input)
          const movRef = doc(collection(db, 'movements'))
          const data = {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit,
            type: input.type,
            quantity: calc.quantity,
            delta: calc.delta,
            previousQty: calc.previousQty,
            newQty: calc.newQty,
            reason: input.reason,
            note: input.note,
            user: who,
          }
          tx.set(movRef, { ...data, createdAt: serverTimestamp() })
          tx.update(productRef, {
            quantity: calc.newQty,
            lastMovementId: movRef.id,
            updatedBy: who,
            updatedAt: serverTimestamp(),
          })
          return { id: movRef.id, ...data, createdAt: new Date() } satisfies Movement
        })
      },
    },

    users: {
      subscribe(cb, onError) {
        return onSnapshot(
          query(collection(db, 'users'), orderBy('displayName')),
          (snap) => cb(snap.docs.map((d) => mapUser(d.id, readData(d)))),
          onError,
        )
      },
      async setRole(uid, role) {
        await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() })
      },
      async setActive(uid, active) {
        await updateDoc(doc(db, 'users', uid), { active, updatedAt: serverTimestamp() })
      },
    },
  }
}
