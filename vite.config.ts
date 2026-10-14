import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // On garde les fichiers des versions précédentes : un PowerPoint qui a gardé l'ancienne
    // page du module en mémoire doit encore trouver ses fichiers après une mise en ligne.
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    host: true,
    // En dev, l'API tourne à côté (npm run dev lance les deux)
    proxy: { '/api': 'http://localhost:3001' },
    fs: { strict: false },
  },
})
