import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Pedido do Product Owner, dia do lançamento: "quero que tenha um
// aviso que essa versão é um beta e está sendo usado para testes" —
// calibra a expectativa de quem usa o piloto controlado.
test('index.html tem o aviso de versão beta, visível independente da largura de tela', () => {
  assert.match(html, /class="tb-pill beta-badge"/);
  assert.match(html, /BETA · EM TESTES/);
});

test('.beta-badge é IRMÃO de .brand-header, não filho — brand-header some no mobile, o aviso não pode sumir junto', () => {
  const brandHeaderEnd = html.indexOf('</div>', html.indexOf('class="brand-header'));
  const betaBadgeStart = html.indexOf('class="tb-pill beta-badge"');
  assert.ok(betaBadgeStart > brandHeaderEnd, 'beta-badge precisa estar fora (depois) do fechamento de .brand-header');
});

test('.beta-badge não tem display:none em nenhum lugar do CSS (nem no breakpoint mobile)', () => {
  const cssBlock = html.slice(html.indexOf('<style'), html.indexOf('</style>'));
  const badgeRuleMatches = cssBlock.match(/\.beta-badge\s*\{[^}]*\}/g) || [];
  for (const rule of badgeRuleMatches) {
    assert.doesNotMatch(rule, /display:\s*none/, 'beta-badge não pode ser escondido em nenhuma regra');
  }
});
