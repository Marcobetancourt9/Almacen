import clsx from 'clsx'
import { ArrowDownLeft, ArrowUpRight, Loader2, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { avatarColor, initials } from '../lib/format'
import { STATUS_LABEL, stockStatus } from '../lib/stock'
import type { MovementType, Product } from '../types'
import { MOVEMENT_LABELS } from '../types'

/* ───────────── Botón ───────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-md shadow-brand-600/25 hover:from-brand-400 hover:to-brand-600 ring-1 ring-inset ring-white/10',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2 shadow-sm',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 cursor-pointer',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  )
}

/* ───────────── Formularios ───────────── */

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-rose-500">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...rest }, ref) => (
    <input ref={ref} {...rest} className={clsx('field', invalid && 'border-rose-500 focus:ring-rose-500/15', className)} />
  ),
)
Input.displayName = 'Input'

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={clsx('field cursor-pointer pr-8', className)} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={clsx('field min-h-20 resize-y', className)} />
}

/* ───────────── Visual ───────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-brand-500', className)} />
}

export function Avatar({ name, seed, size = 'md' }: { name: string; seed?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      title={name}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface',
        avatarColor(seed ?? name),
        size === 'sm' && 'size-6 text-[10px]',
        size === 'md' && 'size-8 text-xs',
        size === 'lg' && 'size-12 text-base',
      )}
    >
      {initials(name)}
    </span>
  )
}

const badgeTones = {
  gray: 'bg-surface-2 text-muted ring-line',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20',
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20',
  brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-300 ring-brand-500/20',
}

export function Badge({ tone = 'gray', children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StockBadge({ product }: { product: Pick<Product, 'quantity' | 'minStock'> }) {
  const s = stockStatus(product)
  return (
    <Badge tone={s === 'ok' ? 'green' : s === 'low' ? 'amber' : 'red'}>
      <span className={clsx('size-1.5 rounded-full', s === 'ok' ? 'bg-emerald-500' : s === 'low' ? 'bg-amber-500' : 'bg-rose-500')} />
      {STATUS_LABEL[s]}
    </Badge>
  )
}

const movementMeta: Record<MovementType, { tone: keyof typeof badgeTones; icon: LucideIcon }> = {
  entrada: { tone: 'green', icon: ArrowDownLeft },
  salida: { tone: 'red', icon: ArrowUpRight },
  ajuste: { tone: 'blue', icon: SlidersHorizontal },
}

export function MovementBadge({ type }: { type: MovementType }) {
  const { tone, icon: Icon } = movementMeta[type]
  return (
    <Badge tone={tone}>
      <Icon className="size-3" />
      {MOVEMENT_LABELS[type]}
    </Badge>
  )
}

export function MovementIcon({ type }: { type: MovementType }) {
  const { icon: Icon } = movementMeta[type]
  return (
    <span
      className={clsx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
        type === 'entrada' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        type === 'salida' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        type === 'ajuste' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Icon className="size-7" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: LucideIcon }[]
}) {
  return (
    <div className="inline-flex w-full rounded-xl bg-surface-2 p-1 sm:w-auto">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={clsx(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition sm:flex-none',
            value === v ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {Icon && <Icon className="size-4" />}
          {label}
        </button>
      ))}
    </div>
  )
}

/* ───────────── Modal ───────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={clsx(
          'relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 shadow-2xl animate-scale-in sm:rounded-3xl',
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
