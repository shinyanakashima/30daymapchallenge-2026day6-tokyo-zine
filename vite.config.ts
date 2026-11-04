import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the static build portable (GitHub Pages project path or any sub-folder)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
})
