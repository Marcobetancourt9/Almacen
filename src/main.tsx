import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * El Almacén no usa service worker. Si en este mismo origen (p. ej. localhost:5173)
 * quedó registrado el de otra app que se haya abierto antes en ese puerto, interceptaría
 * nuestras peticiones y las rompería. Se elimina junto con su caché y se recarga una vez.
 */
async function removeForeignServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    if (regs.length === 0) return
    await Promise.all(regs.map((r) => r.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    // Si la página actual la estaba controlando ese service worker, recargar para salir de él.
    if (navigator.serviceWorker.controller && !sessionStorage.getItem('sw-cleaned')) {
      sessionStorage.setItem('sw-cleaned', '1')
      location.reload()
    }
  } catch {
    /* sin acceso a service workers: nada que limpiar */
  }
}

void removeForeignServiceWorkers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
