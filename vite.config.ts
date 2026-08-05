import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/Esboce/',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
