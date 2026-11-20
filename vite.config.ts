import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Puerto propio para no compartir origen (ni service worker / caché / sesión) con otras apps locales que usan el 5173 por defecto.
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('react')) return 'react'
          return undefined
        },
      },
    },
  },
})
