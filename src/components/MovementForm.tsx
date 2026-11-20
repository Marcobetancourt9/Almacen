import clsx from 'clsx'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { errorMessage } from '../lib/errors'
import { fmtNumber } from '../lib/format'
import { ADJUST_REASONS, ENTRY_REASONS, USAGE_REASONS } from '../lib/stock'
import { fieldErrors, movementSchema, roundQty } from '../lib/validation'
import { backend } from '../services'
import type { Movement, MovementType } from '../types'
import ProductPicker from './ProductPicker'
import { Button, Field, Input, Segmented, Textarea } from './ui'

const REASONS: Record<MovementType, string[]> = { salida: USAGE_REASONS, entrada: ENTRY_REASONS, ajuste: ADJUST_REASONS }

export default function MovementForm({
  productId: fixedProductId,
  initialType = 'salida',
  onDone,
}: {
  productId?: string
  initialType?: MovementType
  onDone?: (m: Movement) => void
}) {
  const me = useCurrentUser()
  const { products, productById } = useData()
  const [type, setType] = useState<MovementType>(initialType)
  const [productId, setProductId] = useState(fixedProductId ?? '')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState(REASONS[initialType][0])
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const available = useMemo(() => products.filter((p) => !p.archived), [products])
  const product = productById.get(productId)
  const qty = Number(quantity)
  const preview = useMemo(() => {
    if (!product || quantity === '' || Number.isNaN(qty)) return null
    const next = type === 'entrada' ? product.quantity + qty : type === 'salida' ? product.quantity - qty : qty
    return roundQty(next)
  }, [product, quantity, qty, type])

  const changeType = (t: MovementType) => {
    setType(t)
    setReason(REASONS[t][0])
    setErrors({})
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = movementSchema.safeParse({ productId, type, quantity: quantity === '' ? NaN : qty, reason, note })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    if (preview !== null && preview < 0)
      return setErrors({ quantity: `Solo hay ${fmtNumber(product!.quantity)} ${product!.unit} disponibles` })
    setSaving(true)
    try {
      const m = await backend.movements.register(parsed.data, me)
      toast.success(
        type === 'salida'
          ? `Uso registrado: ${fmtNumber(m.quantity)} ${m.unit} de ${m.productName}`
          : type === 'entrada'
            ? `Entrada registrada: +${fmtNumber(m.quantity)} ${m.unit} de ${m.productName}`
            : `Stock ajustado a ${fmtNumber(m.newQty)} ${m.unit}`,
        { description: `Stock: ${fmtNumber(m.previousQty)} → ${fmtNumber(m.newQty)}` },
      )
      setQuantity('')
      setNote('')
      onDone?.(m)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Segmented<MovementType>
        value={type}
        onChange={changeType}
        options={[
          { value: 'salida', label: 'Uso / Salida', icon: ArrowUpRight },
          { value: 'entrada', label: 'Entrada', icon: ArrowDownLeft },
          { value: 'ajuste', label: 'Ajuste', icon: SlidersHorizontal },
        ]}
      />

      {!fixedProductId && (
        <Field label="Producto" error={errors.productId}>
          <ProductPicker products={available} value={productId} onChange={(id) => { setProductId(id); setErrors((x) => ({ ...x, productId: '' })) }} invalid={!!errors.productId} />
        </Field>
      )}

      <Field
        label={type === 'ajuste' ? 'Nuevo stock contado' : type === 'salida' ? 'Cantidad utilizada' : 'Cantidad que ingresa'}
        error={errors.quantity}
        hint={type === 'ajuste' ? 'Escribe la cantidad real que hay físicamente en el almacén' : undefined}
      >
        <div className="relative">
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setErrors((x) => ({ ...x, quantity: '' })) }}
            placeholder="0"
            invalid={!!errors.quantity}
            className="pr-20 text-lg font-semibold tabular-nums"
          />
          {product && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{product.unit}</span>}
        </div>
      </Field>

      {product && (
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <div>
            <p className="text-xs text-muted">Stock actual</p>
            <p className="text-lg font-bold tabular-nums">{fmtNumber(product.quantity)}</p>
          </div>
          <ArrowRight className="size-5 text-muted" />
          <div className="text-right">
            <p className="text-xs text-muted">Quedará</p>
            <p
              className={clsx(
                'text-lg font-bold tabular-nums',
                preview === null ? 'text-muted' : preview < 0 ? 'text-rose-500' : preview <= product.minStock ? 'text-amber-500' : 'text-emerald-500',
              )}
            >
              {preview === null ? '—' : fmtNumber(preview)} <span className="text-sm font-medium">{product.unit}</span>
            </p>
          </div>
        </div>
      )}

      <Field label="Motivo" error={errors.reason}>
        <div className="flex flex-wrap gap-2">
          {REASONS[type].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={clsx(
                'cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition',
                reason === r ? 'bg-brand-500 text-white ring-brand-500' : 'bg-surface text-muted ring-line hover:text-fg',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nota (opcional)" error={errors.note}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Orden de trabajo, destino, responsable…" className="min-h-16" />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={saving} variant={type === 'salida' ? 'primary' : type === 'entrada' ? 'success' : 'secondary'}>
        {type === 'salida' ? 'Registrar uso' : type === 'entrada' ? 'Registrar entrada' : 'Aplicar ajuste'}
      </Button>
      <p className="text-center text-xs text-muted">Quedará registrado a nombre de <b>{me.displayName}</b></p>
    </form>
  )
}
