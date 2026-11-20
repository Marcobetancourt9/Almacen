import clsx from 'clsx'

export const COMPANY_NAME = 'Inversiones Pincho Pan Express II C.A.'
export const BRAND_SHORT = 'Pincho Pan'
export const LOGO_SRC = '/pinchopan.png'

const sizes = {
  sm: 'size-10 p-1 rounded-xl',
  md: 'size-12 p-1.5 rounded-2xl',
  lg: 'size-16 p-2 rounded-2xl',
}

/** Logo de la empresa sobre fondo claro para que se lea en modo oscuro. */
export default function BrandLogo({ size = 'sm', className }: { size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center bg-white shadow-lg shadow-black/10 ring-1 ring-black/5',
        sizes[size],
        className,
      )}
    >
      <img src={LOGO_SRC} alt={BRAND_SHORT} className="size-full object-contain" draggable={false} />
    </span>
  )
}
