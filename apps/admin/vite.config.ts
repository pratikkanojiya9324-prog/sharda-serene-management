import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Monorepo: react-router-dom is hoisted to the root and would otherwise load the
  // root's React copy next to apps/admin's own → "Invalid hook call". Force one copy.
  resolve: { dedupe: ['react', 'react-dom'] },
  // One small admin bundle (React + supabase-js); no code splitting needed yet.
  build: { chunkSizeWarningLimit: 700 },
})
