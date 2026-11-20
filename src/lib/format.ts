const numberFmt = new Intl.NumberFormat('es', { maximumFractionDigits: 3 })
const dateTimeFmt = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })
const dateFmt = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })
const relFmt = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export const fmtNumber = (n: number) => numberFmt.format(n)
export const fmtDateTime = (d: Date | null) => (d ? dateTimeFmt.format(d) : '—')
export const fmtDate = (d: Date | null) => (d ? dateFmt.format(d) : '—')

export function fmtRelative(d: Date | null): string {
  if (!d) return 'ahora'
  const diff = (d.getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'hace un momento'
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return relFmt.format(Math.round(diff / 86400), 'day')
  return fmtDate(d)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Color estable por usuario para avatares. */
export function avatarColor(seed: string): string {
  const palette = [
    'bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-fuchsia-500',
  ]
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}
