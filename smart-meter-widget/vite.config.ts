import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(root, '../public/widgets/aituzero-meter')

export default defineConfig({
  root,
  envDir: resolve(root, '..'),
  base: '/widgets/aituzero-meter/',
  publicDir: resolve(root, 'public'),
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
