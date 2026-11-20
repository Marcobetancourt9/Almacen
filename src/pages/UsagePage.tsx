import { History } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import MovementForm from '../components/MovementForm'
import { Avatar, EmptyState, MovementIcon, PageHeader } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { fmtNumber, fmtRelative } from '../lib/format'
import type { MovementType } from '../types'

export default function UsagePage() {
  const me = useCurrentUser()
  const { movements } = useData()
  const [params] = useSearchParams()
  const initialType = (['entrada', 'salida', 'ajuste'].includes(params.get('tipo') ?? '') ? params.get('tipo') : 'salida') as MovementType
  const mine = movements.filter((m) => m.user.uid === me.uid).slice(0, 8)

  return (
    <>
      <PageHeader title="Uso y entradas" subtitle="Registra cuánto se usa de cada producto, las reposiciones y los ajustes de conteo." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card p-5 sm:p-6 lg:col-span-3">
          <MovementForm productId={params.get('producto') ?? undefined} initialType={initialType} key={params.toString()} />
        </div>
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Tus últimos registros</h2>
            <Link to="/historial" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">Ver todo</Link>
          </div>
          {mine.length === 0 ? (
            <EmptyState icon={History} title="Aún no registras movimientos" text="Tus registros aparecerán aquí en tiempo real." />
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 animate-fade-in">
                  <MovementIcon type={m.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.productName}</p>
                    <p className="text-xs text-muted">{m.reason} · {fmtRelative(m.createdAt)}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${m.delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {m.delta > 0 ? '+' : ''}{fmtNumber(m.delta)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-muted">
            <Avatar name={me.displayName} seed={me.uid} size="sm" /> Registrando como {me.displayName}
          </div>
        </div>
      </div>
    </>
  )
}
