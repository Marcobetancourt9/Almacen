import { CheckCircle2, Circle, Database, FileCode2, ShieldCheck } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import { missingConfig } from '../lib/firebase'

const STEPS = [
  {
    icon: Database,
    title: 'Crea el proyecto en Firebase',
    text: 'console.firebase.google.com → Agregar proyecto. Luego activa Authentication (Correo/contraseña) y Firestore Database.',
  },
  {
    icon: FileCode2,
    title: 'Pega las credenciales',
    text: 'Configuración del proyecto → Tus apps → App web. Copia el objeto firebaseConfig en src/firebase.config.ts (o en .env.local).',
  },
  {
    icon: ShieldCheck,
    title: 'Publica las reglas de seguridad',
    text: 'Pon el ID del proyecto en .firebaserc y ejecuta: npx firebase login  y  npm run deploy:rules',
  },
]

/** Se muestra mientras no existan credenciales de Firebase. */
export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl animate-slide-up">
        <BrandLogo size="md" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Conecta tu proyecto de Firebase</h1>
        <p className="mt-1.5 text-sm text-muted">
          Todos los datos del almacén se guardan en Firebase. Faltan estos campos de configuración:{' '}
          {missingConfig.map((k) => (
            <code key={k} className="mx-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-rose-500">{k}</code>
          ))}
        </p>

        <ol className="card mt-6 divide-y divide-line">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-4 p-5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="font-semibold">{i + 1}. {title}</p>
                <p className="mt-0.5 text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-2xl bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-300 shadow-xl">
          <p className="text-slate-500">// src/firebase.config.ts</p>
          <p><span className="text-violet-400">export const</span> firebaseConfig = {'{'}</p>
          {['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].map((k) => (
            <p key={k} className="flex items-center gap-2 pl-4">
              {missingConfig.includes(k as never) ? <Circle className="size-3 text-rose-400" /> : <CheckCircle2 className="size-3 text-emerald-400" />}
              {k}: <span className="text-emerald-300">'…'</span>,
            </p>
          ))}
          <p>{'}'}</p>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Guarda el archivo y esta página se recargará sola.</p>
      </div>
    </div>
  )
}
