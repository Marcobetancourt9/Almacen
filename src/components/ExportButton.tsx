import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../lib/errors'
import { Button } from './ui'

/** Botón que descarga un Excel con datos leídos en ese momento desde Firebase. */
export default function ExportButton({
  run,
  label = 'Exportar Excel',
  size,
}: {
  run: () => Promise<number>
  label?: string
  size?: 'sm' | 'md'
}) {
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true)
    const id = toast.loading('Obteniendo datos de Firebase…')
    try {
      const n = await run()
      toast.success(`Excel generado con ${n} registros`, { id })
    } catch (e) {
      toast.error(errorMessage(e), { id })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="secondary" size={size} icon={FileSpreadsheet} loading={busy} onClick={click}>
      {label}
    </Button>
  )
}
