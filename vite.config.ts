import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Caminho RELATIVO (não '/', não '/Esboce/') — funciona nos dois
  // endereços ao mesmo tempo: esboce.com.br/ (raiz) e
  // godoysteel.github.io/Esboce/ (subpasta). Com caminho absoluto, só
  // um dos dois funcionava por vez (o outro ficava com tela preta —
  // os assets JS/textura 404 avam, porque o navegador procurava na
  // raiz errada).
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});