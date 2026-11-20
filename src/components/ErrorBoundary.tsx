import { AlertOctagon } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Evita que un error inesperado deje la pantalla en blanco. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertOctagon className="size-12 text-rose-500" />
        <h1 className="text-xl font-bold">Algo salió mal</h1>
        <p className="max-w-md text-sm text-muted">{this.state.error.message}</p>
        <button
          onClick={() => location.reload()}
          className="cursor-pointer rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Recargar la aplicación
        </button>
      </div>
    )
  }
}
