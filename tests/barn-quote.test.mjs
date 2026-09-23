import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  BARN_MODELS, BARN_WHATSAPP_NUMBER, buildWhatsappMessage, buildWhatsappUrl, computeQuote, defaultBarnConfig,
  formatBRL, normalizeBarnConfig,
} from '../src/celeiro/BarnPricing.ts';

// DEC-230 — configurador de celeiro/galpão metálico. BarnPricing.ts é puro
// (só `import type`), então é testado direto; HTML/Vite/cena por regex.

const contact = { name: 'Ana', phone: '47 99999-0000', city: 'Joinville', notes: 'Com silo' };

test('há exatamente 3 modelos: fechado, aberto e celeiro', () => {
  assert.deepEqual(BARN_MODELS.map((m) => m.id), ['fechado', 'aberto', 'celeiro']);
});

test('cotação soma as linhas e a faixa envolve o total', () => {
  const q = computeQuote(defaultBarnConfig());
  assert.equal(q.areaM2, 288);
  assert.equal(q.total, q.lines.reduce((s, l) => s + l.amount, 0));
  assert.ok(q.low < q.total && q.total < q.high);
});

test('mais área, mais aberturas, silo e ACM aumentam o valor', () => {
  const base = defaultBarnConfig();
  const t = (c) => computeQuote(c).total;
  assert.ok(t({ ...base, lengthM: 40 }) > t(base));
  assert.ok(t({ ...base, windows: 8 }) > t(base));
  assert.ok(t({ ...base, model: 'celeiro', silo: true }) > t({ ...base, model: 'celeiro', silo: false }));
  assert.ok(t({ ...base, acm: true }) > t(base));
});

test('cor premium acrescenta uma linha', () => {
  const q = computeQuote({ ...defaultBarnConfig(), colorId: 'vermelho' });
  assert.ok(q.lines.some((l) => l.label.startsWith('Cor premium')));
});

test('normalização respeita limites e regras por modelo', () => {
  const n = normalizeBarnConfig({ ...defaultBarnConfig(), widthM: 500, lengthM: 1, eaveHeightM: 99, model: 'aberto', gates: 5, silo: true, acm: true });
  assert.equal(n.widthM, 30); assert.equal(n.lengthM, 6); assert.equal(n.eaveHeightM, 10);
  assert.equal(n.gates, 0); assert.equal(n.silo, false); assert.equal(n.acm, false);
  const s = normalizeBarnConfig({ ...defaultBarnConfig(), model: 'fechado', silo: true });
  assert.equal(s.silo, false);
});

test('aberturas laterais e portões cabem no espaço disponível', () => {
  const n = normalizeBarnConfig({ ...defaultBarnConfig(), lengthM: 6, windows: 20, doors: 20, gates: 9, widthM: 8 });
  assert.ok(n.doors + n.windows <= 2 * Math.floor(6 / 2.4));
  assert.ok(n.gates >= 1 && n.gates * (n.gateWidthM + 1) <= 8 - 1 + n.gateWidthM + 1);
});

test('mensagem do WhatsApp traz o resumo e o link usa o número certo, codificado', () => {
  const c = defaultBarnConfig(); const q = computeQuote(c);
  const msg = buildWhatsappMessage(c, q, contact);
  assert.match(msg, /Galpão Fechado/); assert.match(msg, /12 m × 24 m/); assert.match(msg, /Joinville/);
  const url = buildWhatsappUrl(c, q, contact);
  assert.ok(url.startsWith(`https://wa.me/${BARN_WHATSAPP_NUMBER}?text=`));
  assert.equal(BARN_WHATSAPP_NUMBER, '5547991987805');
  assert.ok(!url.includes(' ') && !url.includes('\n'));
});

test('formatBRL usa ponto de milhar', () => {
  assert.equal(formatBRL(119801.4), 'R$ 119.801');
});

test('página do configurador: 3 modelos, 5 passos, aviso de estimativa e script', () => {
  const html = readFileSync(new URL('../celeiro/index.html', import.meta.url), 'utf8');
  for (const m of ['fechado', 'aberto', 'celeiro']) assert.match(html, new RegExp(`data-model="${m}"`));
  for (let i = 1; i <= 5; i++) assert.match(html, new RegExp(`data-step="${i}"`));
  assert.match(html, /sujeitos a confirmação/);
  assert.match(html, /src="\.\.\/src\/celeiro\/main\.ts"/);
});

test('Vite tem a segunda entrada e a cena não usa import de valor do editor', () => {
  assert.match(readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8'), /celeiro: 'celeiro\/index\.html'/);
  const scene = readFileSync(new URL('../src/celeiro/BarnScene.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(scene, /from '\.\.\/core\//);
});

test('modo embutido (?embed=1) existe: classe no body, CSS que esconde cabeçalho e postMessage de altura', () => {
  const main = readFileSync(new URL('../src/celeiro/main.ts', import.meta.url), 'utf8');
  assert.match(main, /get\('embed'\) === '1'/);
  assert.match(main, /type: 'celeiro-height'/);
  assert.match(readFileSync(new URL('../celeiro/index.html', import.meta.url), 'utf8'), /body\.embed \.top/);
});
