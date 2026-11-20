import { Lightbulb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import ProductForm from '../components/ProductForm'
import { PageHeader } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { errorMessage } from '../lib/errors'
import { backend } from '../services'
import type { ProductInput } from '../types'

export default function NewProductPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="Registrar producto" subtitle="Da de alta un nuevo artículo en el almacén. Quedará registrado a tu nombre." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <ProductForm
            submitLabel="Registrar producto"
            onSubmit={async (data) => {
              try {
                const id = await backend.products.create(data as ProductInput, me)
                toast.success('Producto registrado correctamente')
                navigate(`/inventario/${id}`)
              } catch (e) {
                toast.error(errorMessage(e))
              }
            }}
          />
        </div>
        <aside className="card h-fit space-y-4 p-5 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-amber-500" /> Consejos
          </div>
          <ul className="space-y-3 text-muted">
            <li><b className="text-fg">SKU único:</b> usa un código corto y legible (ej. <code>TOR-M8</code>). No se puede cambiar después.</li>
            <li><b className="text-fg">Stock mínimo:</b> cuando la cantidad llegue a este valor aparecerá en las alertas del inicio.</li>
            <li><b className="text-fg">Cantidad inicial:</b> se guarda como una entrada en el historial, así siempre sabrás quién la ingresó.</li>
            <li><b className="text-fg">Ubicación:</b> indica pasillo y estante para encontrarlo rápido.</li>
          </ul>
        </aside>
      </div>
    </>
  )
}
