import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // L11: target reads from VITE_API_URL env (Node-land, not browser)
      // so the dev server can point to a remote backend without editing this file.
      '/api': {
        target: process.env['VITE_API_URL'] || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
