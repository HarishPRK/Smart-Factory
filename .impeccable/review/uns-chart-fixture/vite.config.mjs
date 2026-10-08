import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: { alias: [{ find: /.*services\/plcService$/, replacement: fileURLToPath(new URL('./fixture-broker.ts', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
});
