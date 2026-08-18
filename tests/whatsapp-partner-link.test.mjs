import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexHtmlSource = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

// Pedido do Product Owner: número de WhatsApp pra parceiros entrarem
// em contato, visível no menu "Arquivo" da plataforma. Número
// informado: 47 991987805 (DDD 47 + celular de 9 dígitos) — formato
// wa.me exige código do país (55) + DDD + número, tudo junto, sem
// espaço/traço.
test('link de WhatsApp pra parceiros existe no menu Arquivo, com o número certo no formato wa.me', () => {
  const fileMenuStart = indexHtmlSource.indexOf('id="fileMenu"');
  const fileMenuEnd = indexHtmlSource.indexOf('</div>', indexHtmlSource.indexOf('🧹 Limpar pavimento atual', fileMenuStart));
  const menuBody = indexHtmlSource.slice(fileMenuStart, fileMenuEnd);
  assert.match(menuBody, /href="https:\/\/wa\.me\/5547991987805"/);
  assert.match(menuBody, /target="_blank"/);
  assert.match(menuBody, /rel="noopener"/);
  assert.match(menuBody, /Seja um parceiro/);
});
