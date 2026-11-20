import { useMemo, useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { fieldErrors, normalizeSku, productEditSchema, productSchema } from '../lib/validation'
import { UNITS, type Product, type ProductEditable, type ProductInput, type Unit } from '../types'
import { Button, Field, Input, Select, Textarea } from './ui'

interface Props {
  initial?: Product
  submitLabel: string
  onSubmit: (data: ProductInput | ProductEditable) => Promise<void>
  onCancel?: () => void
}

interface FormState {
  sku: string
  name: string
  description: string
  category: string
  unit: Unit
  location: string
  minStock: string
  initialQuantity: string
}

export default function ProductForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const editing = !!initial
  const { products } = useData()
  const [f, setF] = useState<FormState>({
    sku: initial?.sku ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? '',
    unit: initial?.unit ?? 'unidad',
    location: initial?.location ?? '',
    minStock: String(initial?.minStock ?? 0),
    initialQuantity: '0',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products])
  const skuTaken = !editing && f.sku.trim() !== '' && products.some((p) => p.id === normalizeSku(f.sku))

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const raw = { ...f, minStock: Number(f.minStock), initialQuantity: Number(f.initialQuantity) }
    const parsed = editing ? productEditSchema.safeParse(raw) : productSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    if (skuTaken) return setErrors({ sku: 'Ya existe un producto con este SKU' })
    setSaving(true)
    try {
      await onSubmit(parsed.data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del producto" error={errors.name} className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Tornillo hexagonal M8" invalid={!!errors.name} autoFocus={!editing} />
        </Field>
        <Field
          label="SKU / Código"
          error={errors.sku || (skuTaken ? 'Ya existe un producto con este SKU' : undefined)}
          hint={editing ? 'El código no se puede modificar' : f.sku ? `Se guardará como ${normalizeSku(f.sku) || '—'}` : 'Identificador único del producto'}
        >
          <Input value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="TOR-M8" disabled={editing} invalid={!!errors.sku || skuTaken} className="font-mono uppercase" />
        </Field>
        <Field label="Categoría" error={errors.category}>
          <Input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Ferretería" list="categories" invalid={!!errors.category} />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Unidad de medida" error={errors.unit}>
          <Select value={f.unit} onChange={(e) => set('unit', e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ubicación" error={errors.location} hint="Pasillo, estante o zona">
          <Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="A-01" />
        </Field>
        <Field label="Stock mínimo" error={errors.minStock} hint="Se mostrará una alerta al llegar a este nivel">
          <Input type="number" min={0} step={1} value={f.minStock} onChange={(e) => set('minStock', e.target.value)} invalid={!!errors.minStock} />
        </Field>
        {!editing && (
          <Field label="Cantidad inicial" error={errors.initialQuantity} hint="Se registra como entrada a tu nombre">
            <Input type="number" min={0} step="any" value={f.initialQuantity} onChange={(e) => set('initialQuantity', e.target.value)} invalid={!!errors.initialQuantity} />
          </Field>
        )}
        <Field label="Descripción (opcional)" error={errors.description} className="sm:col-span-2">
          <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Especificaciones, proveedor, notas…" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-5">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
