import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isTest = process.env.NODE_ENV === 'test'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react({
      babel: {
        plugins: isTest ? [] : [['babel-plugin-react-compiler']],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
