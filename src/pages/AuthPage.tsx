import { ArrowRight, Loader2, BarChart3, Lock, Mail, ShieldCheck, User, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import BrandLogo, { BRAND_SHORT, COMPANY_NAME } from '../components/BrandLogo'
import { Button, Field, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/errors'
import { backend } from '../services'

type Mode = 'login' | 'register' | 'reset'

const FEATURES = [
  { icon: Zap, title: 'Tiempo real', text: 'Todos los usuarios ven los cambios al instante, desde cualquier lugar.' },
  { icon: ShieldCheck, title: 'Trazabilidad total', text: 'Cada ingreso y uso queda registrado con usuario, fecha y motivo.' },
  { icon: BarChart3, title: 'Alertas de stock', text: 'Detecta productos agotados o bajo el mínimo antes de que falten.' },
]

export default function AuthPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'register' && name.trim().length < 2) return setError('Escribe tu nombre completo.')
    if (mode !== 'reset' && password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setLoading(true)
    try {
      if (mode === 'login') await backend.auth.signIn(email, password)
      else if (mode === 'register') await backend.auth.signUp(name.trim(), email, password)
      else {
        await backend.auth.resetPassword(email)
        toast.success('Te enviamos un correo para restablecer tu contraseña.')
        setMode('login')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function google() {
    setError(null)
    setGoogleLoading(true)
    try {
      await backend.auth.signInWithGoogle()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const titles: Record<Mode, [string, string]> = {
    login: ['Bienvenido de nuevo', 'Ingresa a tu cuenta para gestionar el almacén.'],
    register: ['Crea tu cuenta', 'Un administrador asignará tus permisos.'],
    reset: ['Recupera tu acceso', 'Te enviaremos un enlace a tu correo.'],
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel visual */}
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-32 -top-32 size-[520px] rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-40 right-0 size-[480px] rounded-full bg-violet-600/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">Almacén {BRAND_SHORT}</p>
            <p className="text-xs text-white/50">{COMPANY_NAME}</p>
          </div>
        </div>
        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Tu inventario,{' '}
            <span className="bg-gradient-to-r from-brand-300 to-violet-300 bg-clip-text text-transparent">bajo control</span>{' '}
            en todo momento.
          </h2>
          <p className="mt-4 text-white/60">Registra productos, controla su uso y sabe siempre quién hizo cada movimiento.</p>
          <div className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5 text-brand-200" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/55">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} {COMPANY_NAME}</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandLogo size="md" />
            <div>
              <p className="text-lg font-bold leading-tight">Almacén {BRAND_SHORT}</p>
              <p className="text-xs text-muted">{COMPANY_NAME}</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">{titles[mode][0]}</h1>
          <p className="mt-1.5 text-sm text-muted">{titles[mode][1]}</p>


          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={googleLoading || loading}
                className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-line bg-surface text-sm font-semibold shadow-sm transition hover:bg-surface-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
              >
                {googleLoading ? <Loader2 className="size-5 animate-spin text-muted" /> : <GoogleIcon />}
                {mode === 'login' ? 'Continuar con Google' : 'Registrarse con Google'}
              </button>
              <div className="mt-6 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === 'register' && (
              <Field label="Nombre completo">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-10" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Rodríguez" autoComplete="name" required />
                </div>
              </Field>
            )}
            <Field label="Correo electrónico">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input className="pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" autoComplete="email" required />
              </div>
            </Field>
            {mode !== 'reset' && (
              <Field label="Contraseña">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    className="pl-10"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </div>
              </Field>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode('reset')} className="cursor-pointer text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400 animate-fade-in">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => {
                setError(null)
                setMode(mode === 'login' ? 'register' : 'login')
              }}
              className="cursor-pointer font-semibold text-brand-600 hover:underline dark:text-brand-300"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}
