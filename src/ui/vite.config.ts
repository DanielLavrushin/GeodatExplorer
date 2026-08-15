import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The filter worker is an ES module and imports the shared matcher.
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist'
  }
})