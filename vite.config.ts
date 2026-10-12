import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // En dev, l'API tourne à côté (npm run dev lance les deux)
    proxy: { '/api': 'http://localhost:3001' },
    fs: { strict: false },
  },
})
