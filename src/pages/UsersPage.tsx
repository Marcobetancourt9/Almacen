import clsx from 'clsx'
import { Search, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, Badge, EmptyState, Input, PageHeader, Select } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { errorMessage } from '../lib/errors'
import { fmtDate, fmtRelative } from '../lib/format'
import { backend } from '../services'
import { ROLE_LABELS, type Role } from '../types'

const ROLE_HELP: Record<Role, string> = {
  admin: 'Todo, incluido gestionar usuarios y archivar productos',
  operator: 'Registrar productos, usos, entradas y ajustes',
  viewer: 'Solo consultar inventario e historial',
}

export default function UsersPage() {
  const me = useCurrentUser()
  const { users, movements } = useData()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const activity = useMemo(() => {
    const map = new Map<string, { count: number; last: Date | null }>()
    for (const m of movements) {
      const a = map.get(m.user.uid) ?? { count: 0, last: null }
      a.count++
      if (!a.last || (m.createdAt && m.createdAt > a.last)) a.last = m.createdAt
      map.set(m.user.uid, a)
    }
    return map
  }, [movements])

  const list = users.filter((u) => `${u.displayName} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))

  const run = async (uid: string, fn: () => Promise<void>, ok: string) => {
    setBusy(uid)
    try {
      await fn()
      toast.success(ok)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Gestiona quién accede al almacén y qué puede hacer cada persona." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <div key={r} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{ROLE_LABELS[r]}</p>
              <span className="text-2xl font-bold">{users.filter((u) => u.role === r).length}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario…" className="pl-10" />
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={Users} title="Sin usuarios" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((u) => {
              const self = u.uid === me.uid
              const a = activity.get(u.uid)
              return (
                <li key={u.uid} className={clsx('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', !u.active && 'opacity-60')}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={u.displayName} seed={u.uid} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium">
                        {u.displayName}
                        {self && <Badge tone="brand">Tú</Badge>}
                        {!u.active && <Badge tone="red">Desactivado</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.email} · Alta {fmtDate(u.createdAt)} · {a ? `${a.count} movimientos, último ${fmtRelative(a.last)}` : 'sin movimientos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role}
                      disabled={self || busy === u.uid}
                      onChange={(e) => run(u.uid, () => backend.users.setRole(u.uid, e.target.value as Role), 'Rol actualizado')}
                      className="w-44"
                      title={self ? 'No puedes cambiar tu propio rol' : undefined}
                    >
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </Select>
                    <button
                      disabled={self || busy === u.uid}
                      onClick={() => run(u.uid, () => backend.users.setActive(u.uid, !u.active), u.active ? 'Usuario desactivado' : 'Usuario activado')}
                      className={clsx(
                        'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
                        u.active ? 'bg-emerald-500' : 'bg-line',
                      )}
                      title={u.active ? 'Desactivar acceso' : 'Activar acceso'}
                      aria-label={u.active ? 'Desactivar acceso' : 'Activar acceso'}
                    >
                      <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', u.active ? 'left-[22px]' : 'left-0.5')} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="size-3.5" /> Los permisos se validan también en el servidor con las reglas de seguridad de Firestore.
      </p>
    </>
  )
}
