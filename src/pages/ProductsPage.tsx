import { Boxes, MapPin, PackagePlus, Search } from 'lucide-react'
import ExportButton from '../components/ExportButton'
import { exportInventory } from '../lib/reports'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Button, EmptyState, Input, PageHeader, Segmented, Select, Spinner, StockBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { fmtNumber, fmtRelative } from '../lib/format'
import { stockStatus } from '../lib/stock'

type Filter = 'todos' | 'alerta' | 'archivados'
type Sort = 'name' | 'qty-asc' | 'qty-desc' | 'recent'

export default function ProductsPage() {
  const { canWrite } = useAuth()
  const { products, loading } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('estado') as Filter) || 'todos'
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('name')

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const out = products.filter((p) => {
      if (filter === 'archivados' ? !p.archived : p.archived) return false
      if (filter === 'alerta' && stockStatus(p) === 'ok') return false
      if (category && p.category !== category) return false
      if (t && !`${p.name} ${p.sku} ${p.location} ${p.createdBy.name}`.toLowerCase().includes(t)) return false
      return true
    })
    const sorters: Record<Sort, (a: typeof out[0], b: typeof out[0]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      'qty-asc': (a, b) => a.quantity - b.quantity,
      'qty-desc': (a, b) => b.quantity - a.quantity,
      recent: (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    }
    return out.sort(sorters[sort])
  }, [products, q, category, filter, sort])

  // Se exporta con los mismos filtros de la vista, pero leyendo los datos frescos del servidor.
  const exportFiltered = () => {
    const t = q.trim().toLowerCase()
    return exportInventory((p) => {
      if (filter === 'archivados' ? !p.archived : p.archived) return false
      if (filter === 'alerta' && stockStatus(p) === 'ok') return false
      if (category && p.category !== category) return false
      if (t && !`${p.name} ${p.sku} ${p.location} ${p.createdBy.name}`.toLowerCase().includes(t)) return false
      return true
    })
  }

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={`${products.filter((p) => !p.archived).length} productos activos · actualizado en tiempo real`}
        actions={
          <>
            <ExportButton run={exportFiltered} />
            {canWrite && (
              <Link to="/registrar">
                <Button icon={PackagePlus}>Nuevo producto</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU, ubicación o usuario…" className="pl-10" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="sm:w-44">
            <option value="name">Nombre (A-Z)</option>
            <option value="qty-asc">Menor cantidad</option>
            <option value="qty-desc">Mayor cantidad</option>
            <option value="recent">Actualizados</option>
          </Select>
          <Segmented<Filter>
            value={filter}
            onChange={(v) => setParams(v === 'todos' ? {} : { estado: v }, { replace: true })}
            options={[
              { value: 'todos', label: 'Activos' },
              { value: 'alerta', label: 'Alertas' },
              { value: 'archivados', label: 'Archivados' },
            ]}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="size-7" /></div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={products.length === 0 ? 'Aún no hay productos' : 'Sin resultados'}
            text={products.length === 0 ? 'Registra tu primer producto para empezar a controlar el inventario.' : 'Prueba con otros filtros o términos de búsqueda.'}
            action={products.length === 0 && canWrite ? <Link to="/registrar"><Button icon={PackagePlus}>Registrar producto</Button></Link> : undefined}
          />
        ) : (
          <>
            {/* Tabla escritorio */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3">Categoría</th>
                  <th className="px-5 py-3 text-right">Cantidad</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Registrado por</th>
                  <th className="px-5 py-3">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => {
                  const pct = p.minStock > 0 ? Math.min(100, (p.quantity / (p.minStock * 3)) * 100) : 100
                  const s = stockStatus(p)
                  return (
                    <tr key={p.id} onClick={() => navigate(`/inventario/${p.id}`)} className="cursor-pointer transition hover:bg-surface-2/70">
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{p.name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted">
                          <span className="font-mono">{p.sku}</span>
                          {p.location && <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{p.location}</span>}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{p.category}</td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="font-semibold tabular-nums">{fmtNumber(p.quantity)} <span className="text-xs font-normal text-muted">{p.unit}</span></p>
                        <div className="ml-auto mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                          <div className={`h-full rounded-full ${s === 'ok' ? 'bg-emerald-500' : s === 'low' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><StockBadge product={p} /></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={p.createdBy.name} seed={p.createdBy.uid} size="sm" />
                          <span className="truncate text-muted">{p.createdBy.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted">{fmtRelative(p.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Tarjetas móvil */}
            <ul className="divide-y divide-line md:hidden">
              {list.map((p) => (
                <li key={p.id}>
                  <Link to={`/inventario/${p.id}`} className="flex items-center gap-3 p-4 active:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.sku} · {p.category}</p>
                      <div className="mt-2"><StockBadge product={p} /></div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">{fmtNumber(p.quantity)}</p>
                      <p className="text-xs text-muted">{p.unit}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
