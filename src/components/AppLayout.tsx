import clsx from 'clsx'
import {
  ArrowLeftRight,
  Boxes,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackagePlus,
  Sun,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useOnline } from '../hooks/useOnline'
import { useTheme } from '../hooks/useTheme'
import { errorMessage } from '../lib/errors'
import { firebaseProjectId, useEmulators } from '../lib/firebase'
import { stockStatus } from '../lib/stock'
import { backend } from '../services'
import { ROLE_LABELS } from '../types'
import BrandLogo, { BRAND_SHORT } from './BrandLogo'
import { Avatar, Spinner } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  admin?: boolean
  write?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/registrar', label: 'Registrar producto', icon: PackagePlus, write: true },
  { to: '/uso', label: 'Uso y entradas', icon: ArrowLeftRight, write: true },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/usuarios', label: 'Usuarios', icon: Users, admin: true },
]

export default function AppLayout() {
  const { user, isAdmin, canWrite } = useAuth()
  const { products } = useData()
  const { theme, toggle } = useTheme()
  const online = useOnline()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  const lowCount = products.filter((p) => !p.archived && stockStatus(p) !== 'ok').length
  const items = NAV.filter((n) => (!n.admin || isAdmin) && (!n.write || canWrite))

  const logout = () => backend.auth.signOut().catch((e) => toast.error(errorMessage(e)))

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandLogo />
        <div className="min-w-0">
          <p className="font-bold leading-tight tracking-tight">Almacén</p>
          <p className="truncate text-xs text-muted">{BRAND_SHORT} · Control de inventario</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Icon className="size-[18px]" />
            <span className="flex-1">{label}</span>
            {to === '/inventario' && lowCount > 0 && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {lowCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {useEmulators && (
        <div className="mx-3 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-semibold">Emulador local de Firebase</p>
          <p className="mt-0.5 opacity-90">Los datos no van a tu proyecto real.</p>
        </div>
      )}

      <div className="mx-3 mb-3 flex items-center gap-2 px-2 text-[11px] text-muted">
        <Database className="size-3.5" />
        <span className="truncate">Firebase · {firebaseProjectId}</span>
      </div>

      <div className="border-t border-line p-3">
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            clsx('flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface-2', isActive && 'bg-surface-2')
          }
        >
          <Avatar name={user!.displayName} seed={user!.uid} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user!.displayName}</p>
            <p className="truncate text-xs text-muted">{ROLE_LABELS[user!.role]}</p>
          </div>
          <UserCircle className="size-4 text-muted" />
        </NavLink>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-72">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Sidebar móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-line bg-surface shadow-2xl animate-slide-up">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 cursor-pointer rounded-lg p-1.5 text-muted hover:bg-surface-2"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <button
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex-1" />
        <span
          className={clsx(
            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
            online
              ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
          )}
          title={online ? 'Sincronizado en tiempo real' : 'Sin conexión: se muestran datos en caché'}
        >
          <span className="relative flex size-2">
            {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={clsx('relative inline-flex size-2 rounded-full', online ? 'bg-emerald-500' : 'bg-amber-500')} />
          </span>
          {online ? 'En vivo' : 'Sin conexión'}
        </span>
        <button
          onClick={toggle}
          className="cursor-pointer rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <button
          onClick={logout}
          className="cursor-pointer rounded-xl p-2 text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-24">
              <Spinner className="size-7" />
            </div>
          }
        >
          <div key={location.pathname} className="animate-slide-up">
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  )
}
