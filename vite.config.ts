import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = {
  target: 'http://localhost:8787',
  changeOrigin: true,
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backendTarget,
      '/mcp': backendTarget,
      '/v1': backendTarget,
      '/healthz': backendTarget,
      '/.well-known': backendTarget,
      '/openapi.json': backendTarget,
      '/llms.txt': backendTarget,
      '/llms-full.txt': backendTarget,
      '/auth.md': backendTarget,
      '/robots.txt': backendTarget,
      '/index.md': backendTarget,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
