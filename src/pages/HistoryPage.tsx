import { History, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import ExportButton from '../components/ExportButton'
import { Avatar, Button, EmptyState, Input, MovementBadge, PageHeader, Select, Spinner } from '../components/ui'
import { useData } from '../context/DataContext'
import { errorMessage } from '../lib/errors'
import { fmtDateTime, fmtNumber } from '../lib/format'
import { exportMovements } from '../lib/reports'
import { backend } from '../services'
import { MOVEMENT_LABELS, type Movement, type MovementType } from '../types'

const PAGE = 50

export default function HistoryPage() {
  const { movements: recent, users, loading: recentLoading } = useData()
  const [q, setQ] = useState('')
  const [type, setType] = useState<MovementType | ''>('')
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [ranged, setRanged] = useState<Movement[] | null>(null)

  const fromD = useMemo(() => (from ? new Date(from + 'T00:00:00') : undefined), [from])
  const toD = useMemo(() => (to ? new Date(to + 'T23:59:59.999') : undefined), [to])
  const hasRange = !!(fromD || toD)

  // Con rango de fechas se consulta Firestore directamente (sin el límite de los últimos 500).
  useEffect(() => {
    if (!hasRange) return
    setRanged(null)
    return backend.movements.subscribe({ from: fromD, to: toD, limit: 5000 }, setRanged, (e) => toast.error(errorMessage(e)))
  }, [hasRange, fromD, toD])

  const movements = hasRange ? (ranged ?? []) : recent
  const loading = hasRange ? ranged === null : recentLoading

  // Incluye usuarios que aparecen en movimientos aunque ya no estén en la lista
  const people = useMemo(() => {
    const map = new Map(users.map((u) => [u.uid, u.displayName]))
    for (const m of movements) if (!map.has(m.user.uid)) map.set(m.user.uid, m.user.name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [users, movements])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return movements.filter((m) => {
      if (type && m.type !== type) return false
      if (userId && m.user.uid !== userId) return false
      if (t && !`${m.productName} ${m.sku} ${m.reason} ${m.note}`.toLowerCase().includes(t)) return false
      return true
    })
  }, [movements, q, type, userId])

  const summary = useMemo(() => {
    let entradas = 0
    let salidas = 0
    for (const m of list) {
      if (m.type === 'entrada') entradas++
      else if (m.type === 'salida') salidas++
    }
    return { entradas, salidas, ajustes: list.length - entradas - salidas }
  }, [list])

  return (
    <>
      <PageHeader
        title="Historial"
        subtitle="Registro inmutable de quién ingresó, usó o ajustó cada producto."
        actions={<ExportButton run={() => exportMovements({ from: fromD, to: toD, type, userId, text: q })} />}
      />

      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Producto, motivo…" className="pl-10" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as MovementType | '')}>
          <option value="">Todos los tipos</option>
          {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" title="Desde" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" title="Hasta" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-surface-2 px-3 py-1 font-medium">{list.length} movimientos</span>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-600 dark:text-emerald-400">{summary.entradas} entradas</span>
        <span className="rounded-full bg-rose-500/10 px-3 py-1 font-medium text-rose-600 dark:text-rose-400">{summary.salidas} usos</span>
        <span className="rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-600 dark:text-sky-400">{summary.ajustes} ajustes</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="size-7" /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={History} title="Sin movimientos" text="No hay registros que coincidan con los filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3 text-right">Cantidad</th>
                  <th className="px-5 py-3 text-right">Stock</th>
                  <th className="px-5 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.slice(0, shown).map((m) => (
                  <tr key={m.id} className="transition hover:bg-surface-2/60">
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{fmtDateTime(m.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={m.user.name} seed={m.user.uid} size="sm" />
                        <span className="whitespace-nowrap font-medium">{m.user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><MovementBadge type={m.type} /></td>
                    <td className="px-5 py-3">
                      <Link to={`/inventario/${m.productId}`} className="font-medium hover:text-brand-600 dark:hover:text-brand-300">{m.productName}</Link>
                      <p className="font-mono text-xs text-muted">{m.sku}</p>
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${m.delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {m.delta > 0 ? '+' : ''}{fmtNumber(m.delta)} <span className="text-xs font-normal text-muted">{m.unit}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted">{fmtNumber(m.previousQty)} → <b className="text-fg">{fmtNumber(m.newQty)}</b></td>
                    <td className="px-5 py-3">
                      <p>{m.reason}</p>
                      {m.note && <p className="max-w-56 truncate text-xs text-muted" title={m.note}>{m.note}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.length > shown && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" onClick={() => setShown((s) => s + PAGE)}>Mostrar más ({list.length - shown} restantes)</Button>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        {hasRange
          ? 'Mostrando todos los movimientos del rango de fechas, consultados en Firebase.'
          : 'Se muestran los últimos 500 movimientos. Elige un rango de fechas para consultar más. El Excel incluye todos los que coinciden con los filtros.'}
      </p>
    </>
  )
}
