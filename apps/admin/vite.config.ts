import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One small admin bundle (React + supabase-js); no code splitting needed yet.
  build: { chunkSizeWarningLimit: 700 },
})
