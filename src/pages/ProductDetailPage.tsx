import { Archive, ArchiveRestore, ArrowDownLeft, ArrowLeft, ArrowUpRight, History, MapPin, Pencil, Tag } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import ExportButton from '../components/ExportButton'
import MovementForm from '../components/MovementForm'
import { today } from '../lib/excel'
import { exportMovements } from '../lib/reports'
import ProductForm from '../components/ProductForm'
import { Avatar, Badge, Button, EmptyState, Modal, MovementBadge, Spinner, StockBadge } from '../components/ui'
import { useAuth, useCurrentUser } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { errorMessage } from '../lib/errors'
import { fmtDateTime, fmtNumber, fmtRelative } from '../lib/format'
import { backend } from '../services'
import type { Movement, MovementType, ProductEditable } from '../types'

export default function ProductDetailPage() {
  const { id = '' } = useParams()
  const me = useCurrentUser()
  const { canWrite, isAdmin } = useAuth()
  const { productById, loading } = useData()
  const product = productById.get(id)
  const [history, setHistory] = useState<Movement[] | null>(null)
  const [moveType, setMoveType] = useState<MovementType | null>(null)
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    setHistory(null)
    return backend.movements.subscribe({ productId: id, limit: 200 }, setHistory, (e) => toast.error(errorMessage(e)))
  }, [id])

  const totals = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000
    let used = 0
    let added = 0
    for (const m of history ?? []) {
      if (!m.createdAt || m.createdAt.getTime() < since) continue
      if (m.type === 'salida') used += m.quantity
      if (m.type === 'entrada') added += m.quantity
    }
    return { used, added }
  }, [history])

  if (loading) return <div className="flex justify-center py-24"><Spinner className="size-7" /></div>
  if (!product)
    return (
      <EmptyState icon={Tag} title="Producto no encontrado" text="Puede que el SKU sea incorrecto." action={<Link to="/inventario"><Button variant="secondary" icon={ArrowLeft}>Volver al inventario</Button></Link>} />
    )

  const toggleArchive = async () => {
    setArchiving(true)
    try {
      await backend.products.setArchived(product.id, !product.archived, me)
      toast.success(product.archived ? 'Producto restaurado' : 'Producto archivado')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <>
      <Link to="/inventario" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Inventario
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
            <StockBadge product={product} />
            {product.archived && <Badge>Archivado</Badge>}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="font-mono">{product.sku}</span>
            <span className="inline-flex items-center gap-1"><Tag className="size-3.5" />{product.category}</span>
            {product.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{product.location}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && !product.archived && (
            <>
              <Button icon={ArrowUpRight} onClick={() => setMoveType('salida')}>Registrar uso</Button>
              <Button variant="success" icon={ArrowDownLeft} onClick={() => setMoveType('entrada')}>Entrada</Button>
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Editar</Button>
            </>
          )}
          {isAdmin && (
            <Button variant="ghost" icon={product.archived ? ArchiveRestore : Archive} onClick={toggleArchive} loading={archiving}>
              {product.archived ? 'Restaurar' : 'Archivar'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Stock actual', `${fmtNumber(product.quantity)} ${product.unit}`, 'text-fg'],
          ['Stock mínimo', `${fmtNumber(product.minStock)} ${product.unit}`, 'text-fg'],
          ['Usado (30 días)', `${fmtNumber(totals.used)} ${product.unit}`, 'text-rose-500'],
          ['Ingresado (30 días)', `${fmtNumber(totals.added)} ${product.unit}`, 'text-emerald-500'],
        ].map(([label, value, color]) => (
          <div key={label} className="card p-4 sm:p-5">
            <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
            <p className={`mt-1.5 text-xl font-bold tabular-nums sm:text-2xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-fit space-y-5 p-5">
          <h2 className="font-semibold">Información</h2>
          {product.description && <p className="text-sm text-muted whitespace-pre-line">{product.description}</p>}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Registrado por</p>
            <div className="flex items-center gap-3">
              <Avatar name={product.createdBy.name} seed={product.createdBy.uid} />
              <div>
                <p className="text-sm font-medium">{product.createdBy.name}</p>
                <p className="text-xs text-muted">{fmtDateTime(product.createdAt)}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Última modificación</p>
            <div className="flex items-center gap-3">
              <Avatar name={product.updatedBy.name} seed={product.updatedBy.uid} />
              <div>
                <p className="text-sm font-medium">{product.updatedBy.name}</p>
                <p className="text-xs text-muted">{fmtDateTime(product.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold">Historial de movimientos</h2>
              <span className="text-xs text-muted">{history?.length ?? 0} registros</span>
            </div>
            <ExportButton
              size="sm"
              label="Excel"
              run={() => exportMovements({ productId: product.id }, `historial-${product.sku}-${today()}`)}
            />
          </div>
          {history === null ? (
            <div className="flex justify-center py-14"><Spinner /></div>
          ) : history.length === 0 ? (
            <EmptyState icon={History} title="Sin movimientos" text="Las entradas y usos de este producto aparecerán aquí." />
          ) : (
            <ol className="relative px-5 py-4">
              {history.map((m, i) => (
                <li key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < history.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-line" />}
                  <Avatar name={m.user.name} seed={m.user.uid} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{m.user.name}</span>
                      <MovementBadge type={m.type} />
                      <span className="text-xs text-muted" title={fmtDateTime(m.createdAt)}>{fmtRelative(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm">
                      <span className={`font-semibold tabular-nums ${m.delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {m.delta > 0 ? '+' : ''}{fmtNumber(m.delta)} {m.unit}
                      </span>
                      <span className="text-muted"> · {m.reason} · stock {fmtNumber(m.previousQty)} → {fmtNumber(m.newQty)}</span>
                    </p>
                    {m.note && <p className="mt-1 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{m.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <Modal open={moveType !== null} onClose={() => setMoveType(null)} title={product.name} description={`Disponible: ${fmtNumber(product.quantity)} ${product.unit}`}>
        {moveType && <MovementForm productId={product.id} initialType={moveType} onDone={() => setMoveType(null)} />}
      </Modal>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar producto" size="lg">
        <ProductForm
          initial={product}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            try {
              await backend.products.update(product.id, data as ProductEditable, me)
              toast.success('Cambios guardados')
              setEditing(false)
            } catch (e) {
              toast.error(errorMessage(e))
            }
          }}
        />
      </Modal>
    </>
  )
}
