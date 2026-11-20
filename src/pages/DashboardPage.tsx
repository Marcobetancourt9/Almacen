import clsx from 'clsx'
import { AlertTriangle, ArrowLeftRight, Boxes, PackageX, PackagePlus, TrendingUp, Activity, ChevronRight, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar, EmptyState, MovementIcon, Spinner, StockBadge } from '../components/ui'
import { useAuth, useCurrentUser } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { fmtNumber, fmtRelative } from '../lib/format'
import { stockStatus } from '../lib/stock'
import { MOVEMENT_LABELS } from '../types'

function StatCard({ label, value, icon: Icon, tone, hint }: { label: string; value: string; icon: LucideIcon; tone: string; hint?: string }) {
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <div className={clsx('absolute -right-6 -top-6 size-24 rounded-full opacity-10 blur-xl', tone)} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight sm:mt-2 sm:text-3xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        <span className={clsx('inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg sm:size-11', tone)}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const me = useCurrentUser()
  const { canWrite } = useAuth()
  const { products, movements, loading } = useData()

  const stats = useMemo(() => {
    const active = products.filter((p) => !p.archived)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMovs = movements.filter((m) => m.createdAt && m.createdAt >= today)
    const low = active.filter((p) => stockStatus(p) === 'low')
    const out = active.filter((p) => stockStatus(p) === 'out')

    // Serie de los últimos 14 días
    const days: { key: string; label: string; entradas: number; salidas: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({
        key: d.toDateString(),
        label: d.toLocaleDateString('es', { day: '2-digit', month: 'short' }),
        entradas: 0,
        salidas: 0,
      })
    }
    const byKey = new Map(days.map((d) => [d.key, d]))
    const usage = new Map<string, { name: string; count: number }>()
    for (const m of movements) {
      if (!m.createdAt) continue
      const bucket = byKey.get(m.createdAt.toDateString())
      if (bucket) {
        if (m.type === 'entrada') bucket.entradas++
        else if (m.type === 'salida') bucket.salidas++
      }
      if (m.type === 'salida') {
        const u = usage.get(m.productId) ?? { name: m.productName, count: 0 }
        u.count++
        usage.set(m.productId, u)
      }
    }
    const topUsed = [...usage.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)

    return { active, todayMovs, low, out, days, topUsed }
  }, [products, movements])

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-7" />
      </div>
    )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const alerts = [...stats.out, ...stats.low].slice(0, 6)
  const maxUsed = stats.topUsed[0]?.[1].count ?? 1

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 p-6 text-white shadow-xl shadow-brand-700/20 sm:p-8">
        <div className="absolute -right-10 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/70">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting}, {me.displayName.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-white/75">
              {stats.out.length + stats.low.length > 0
                ? `Hay ${stats.out.length + stats.low.length} productos que necesitan atención.`
                : 'Todo el inventario está en niveles saludables.'}
            </p>
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Link
                to="/uso"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 shadow-lg shadow-black/10 transition hover:bg-white/90 active:scale-[0.98]"
              >
                <ArrowLeftRight className="size-4" /> Registrar uso
              </Link>
              <Link
                to="/registrar"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20 active:scale-[0.98]"
              >
                <PackagePlus className="size-4" /> Nuevo producto
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Productos activos" value={fmtNumber(stats.active.length)} icon={Boxes} tone="bg-brand-500" hint={`${new Set(stats.active.map((p) => p.category)).size} categorías`} />
        <StatCard label="Stock bajo" value={fmtNumber(stats.low.length)} icon={AlertTriangle} tone="bg-amber-500" hint="Por debajo del mínimo" />
        <StatCard label="Agotados" value={fmtNumber(stats.out.length)} icon={PackageX} tone="bg-rose-500" hint="Sin existencias" />
        <StatCard label="Movimientos hoy" value={fmtNumber(stats.todayMovs.length)} icon={Activity} tone="bg-emerald-500" hint={`${stats.todayMovs.filter((m) => m.type === 'salida').length} usos registrados`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Gráfico */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Actividad de los últimos 14 días</h2>
              <p className="text-xs text-muted">Número de movimientos por día</p>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" />Entradas</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" />Usos</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.days} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--app-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--app-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--app-surface)', border: '1px solid var(--app-line)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: 'var(--app-fg)', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={2} fill="url(#gIn)" />
                <Area type="monotone" dataKey="salidas" name="Usos" stroke="#f43f5e" strokeWidth={2} fill="url(#gOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Más usados */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-brand-500" />
            <h2 className="font-semibold">Productos más usados</h2>
          </div>
          {stats.topUsed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aún no hay usos registrados.</p>
          ) : (
            <ul className="space-y-4">
              {stats.topUsed.map(([id, u], i) => (
                <li key={id}>
                  <Link to={`/inventario/${id}`} className="group block">
                    <div className="mb-1.5 flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium group-hover:text-brand-600 dark:group-hover:text-brand-300">
                        <span className="mr-2 text-muted">{i + 1}.</span>
                        {u.name}
                      </span>
                      <span className="shrink-0 text-muted">{u.count} usos</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${(u.count / maxUsed) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Alertas */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Requieren atención</h2>
            <Link to="/inventario?estado=alerta" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">Ver todos</Link>
          </div>
          {alerts.length === 0 ? (
            <EmptyState icon={Boxes} title="Sin alertas" text="Todos los productos están por encima del stock mínimo." />
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((p) => (
                <li key={p.id}>
                  <Link to={`/inventario/${p.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.sku} · Mín. {fmtNumber(p.minStock)} {p.unit}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{fmtNumber(p.quantity)}</span>
                    <StockBadge product={p} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Actividad reciente</h2>
            <Link to="/historial" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">Historial</Link>
          </div>
          {movements.length === 0 ? (
            <EmptyState icon={Activity} title="Sin movimientos" text="Aquí verás quién ingresa o usa productos." />
          ) : (
            <ul className="divide-y divide-line">
              {movements.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <Link to={`/inventario/${m.productId}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2">
                    <MovementIcon type={m.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-semibold">{m.user.name}</span>{' '}
                        <span className="text-muted">{m.type === 'entrada' ? 'ingresó' : m.type === 'salida' ? 'usó' : 'ajustó'}</span>{' '}
                        <span className="font-medium">{fmtNumber(m.quantity)} {m.unit}</span>{' '}
                        <span className="text-muted">de</span> {m.productName}
                      </p>
                      <p className="text-xs text-muted">{MOVEMENT_LABELS[m.type]} · {m.reason} · {fmtRelative(m.createdAt)}</p>
                    </div>
                    <Avatar name={m.user.name} seed={m.user.uid} size="sm" />
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
