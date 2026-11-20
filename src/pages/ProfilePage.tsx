import { LogOut, Moon, Save, Sun } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Field, Input, MovementIcon, PageHeader } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../hooks/useTheme'
import { errorMessage } from '../lib/errors'
import { fmtDate, fmtNumber, fmtRelative } from '../lib/format'
import { displayNameSchema } from '../lib/validation'
import { backend } from '../services'
import { ROLE_LABELS } from '../types'

export default function ProfilePage() {
  const me = useCurrentUser()
  const { movements, products } = useData()
  const { theme, toggle } = useTheme()
  const [name, setName] = useState(me.displayName)
  const [saving, setSaving] = useState(false)

  const stats = useMemo(() => {
    const mine = movements.filter((m) => m.user.uid === me.uid)
    return {
      mine,
      created: products.filter((p) => p.createdBy.uid === me.uid).length,
      uses: mine.filter((m) => m.type === 'salida').length,
      entries: mine.filter((m) => m.type === 'entrada').length,
    }
  }, [movements, products, me.uid])

  async function save(e: FormEvent) {
    e.preventDefault()
    const parsed = displayNameSchema.safeParse(name)
    if (!parsed.success) return toast.error(parsed.error.issues[0].message)
    setSaving(true)
    try {
      await backend.auth.updateDisplayName(me, parsed.data)
      toast.success('Nombre actualizado')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Mi perfil" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <div className="card p-6 text-center">
            <div className="flex justify-center"><Avatar name={me.displayName} seed={me.uid} size="lg" /></div>
            <p className="mt-3 text-lg font-semibold">{me.displayName}</p>
            <p className="text-sm text-muted">{me.email}</p>
            <div className="mt-3"><Badge tone="brand">{ROLE_LABELS[me.role]}</Badge></div>
            <p className="mt-3 text-xs text-muted">Miembro desde {fmtDate(me.createdAt)}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-5">
              {[['Productos', stats.created], ['Usos', stats.uses], ['Entradas', stats.entries]].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xl font-bold">{fmtNumber(v as number)}</p>
                  <p className="text-xs text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card space-y-2 p-4">
            <Button variant="secondary" className="w-full" icon={theme === 'dark' ? Sun : Moon} onClick={toggle}>
              Tema {theme === 'dark' ? 'claro' : 'oscuro'}
            </Button>
            <Button variant="ghost" className="w-full text-rose-500! hover:bg-rose-500/10!" icon={LogOut} onClick={() => backend.auth.signOut()}>
              Cerrar sesión
            </Button>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <form onSubmit={save} className="card space-y-4 p-6">
            <h2 className="font-semibold">Datos de la cuenta</h2>
            <Field label="Nombre visible" hint="Así aparecerás en el historial de movimientos">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Correo">
              <Input value={me.email} disabled />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" icon={Save} loading={saving} disabled={name.trim() === me.displayName}>Guardar</Button>
            </div>
          </form>

          <div className="card">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Mi actividad reciente</h2>
            {stats.mine.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">Aún no tienes movimientos.</p>
            ) : (
              <ul className="divide-y divide-line">
                {stats.mine.slice(0, 8).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <MovementIcon type={m.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.productName}</p>
                      <p className="text-xs text-muted">{m.reason} · {fmtRelative(m.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${m.delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {m.delta > 0 ? '+' : ''}{fmtNumber(m.delta)} {m.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
