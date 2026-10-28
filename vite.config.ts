import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "::",
    proxy: {
      '/api': {
        target: process.env.GABRIEL_API_TARGET || 'http://127.0.0.1:8086',
        changeOrigin: true,
      },
    },
  },
})
