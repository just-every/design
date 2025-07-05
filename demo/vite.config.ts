import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3021,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3020',
        ws: true,
        changeOrigin: true
      }
    }
  }
})