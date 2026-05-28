import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isTest = process.env.NODE_ENV === 'test'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: {
    host: '0.0.0.0',  // Listen on all interfaces — allows access from Meta Quest / other LAN devices
    port: 5173,
    proxy: {
      // Dynamic Path Selection + Video Analytics Express server (run via `npm run dev:server`).
      // Forwards /api/* (incl. SSE for /api/ipsec/stream and MJPEG for /api/video/:id) so the
      // browser hits the integration endpoints same-origin.
      // Use 127.0.0.1 (not localhost): on Windows + Node 18+, `localhost`
      // resolves to IPv6 ::1 first, but the Express server binds IPv4 — that
      // mismatch causes ECONNREFUSED even when the server is running.
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true, ws: false },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: isTest ? [] : [['babel-plugin-react-compiler']],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three'))   return 'vendor-three';
            if (id.includes('@anthropic-ai'))                           return 'vendor-anthropic';
            if (id.includes('mqtt'))                                    return 'vendor-mqtt';
            if (id.includes('@aws-sdk') || id.includes('@smithy'))      return 'vendor-aws';
            if (id.includes('react'))                                   return 'vendor-react';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
