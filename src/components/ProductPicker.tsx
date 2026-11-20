import clsx from 'clsx'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtNumber } from '../lib/format'
import type { Product } from '../types'
import { StockBadge } from './ui'

/** Buscador de productos por nombre, SKU, categoría o ubicación. */
export default function ProductPicker({
  products,
  value,
  onChange,
  invalid,
}: {
  products: Product[]
  value: string
  onChange: (id: string) => void
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const selected = products.find((p) => p.id === value)

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t
      ? products.filter((p) => `${p.name} ${p.sku} ${p.category} ${p.location}`.toLowerCase().includes(t))
      : products
    return list.slice(0, 50)
  }, [products, q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => setHi(0), [q])

  const pick = (p: Product) => {
    onChange(p.id)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx('field flex cursor-pointer items-center gap-3 text-left', invalid && 'border-rose-500')}
      >
        {selected ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{selected.name}</span>
            <span className="block text-xs text-muted">
              {selected.sku} · Disponible: {fmtNumber(selected.quantity)} {selected.unit}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-muted/80">Busca y selecciona un producto…</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-scale-in">
          <div className="flex items-center gap-2 border-b border-line px-3.5">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHi((h) => Math.min(h + 1, results.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHi((h) => Math.max(h - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (results[hi]) pick(results[hi])
                } else if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Nombre, SKU, categoría…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Sin resultados</li>}
            {results.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(p)}
                  className={clsx(
                    'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left',
                    i === hi && 'bg-surface-2',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {p.sku} · {p.category} · {fmtNumber(p.quantity)} {p.unit}
                    </span>
                  </span>
                  <StockBadge product={p} />
                  {p.id === value && <Check className="size-4 text-brand-500" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
