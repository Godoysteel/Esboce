import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Domínio próprio serve a partir da raiz — '/Esboce/' era o
  // necessário só pro GitHub Pages padrão (godoysteel.github.io/Esboce/);
  // com esboce.com.br, os caminhos de asset precisam começar em '/'.
  base: '/',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});