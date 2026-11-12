import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /api (incl. the SSE stream) is proxied to NestJS on :3000.
// In production NestJS serves this app, so /api is same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
})
