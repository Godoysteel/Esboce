import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/core/SteelFrameConfigurator.ts', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('configuração Steel Frame acontece por clique direto na face A/B', () => {
  assert.match(viewport, /wallFaceAtPoint\(sfHit\.object\.userData\.wallId/);
  assert.match(viewport, /kind: 'wall-face'/);
  assert.match(app, /setSteelFrameSurfaceSelectionHandler/);
});

test('configurador é painel lateral e não cria fundo que cobre a tela', () => {
  assert.match(html, /#steelFrameConfigurator \{ position:fixed;[^}]*right:82px;[^}]*width:min\(330px/);
  assert.doesNotMatch(html, /#steelFrameConfigurator \{[^}]*inset:0/);
  assert.doesNotMatch(html, /#steelFrameConfigurator \{[^}]*background:rgba\(20,24,28/);
});

test('lista contextual oferece sistemas externos e drywall interno', () => {
  assert.match(app, /Revestimentos externos/);
  assert.match(app, /Revestimentos internos/);
  assert.match(app, /data-sf-system/);
});

test('faces concluídas ficam verdes, não podem ser selecionadas novamente e bloqueiam o quantitativo enquanto houver pendências', () => {
  assert.match(app, /targetIsConfigured/);
  assert.match(app, /return false/);
  assert.match(app, /quantityButton\.disabled = issues\.length > 0/);
  assert.match(viewport, /Face já configurada/);
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /steelFrameFaceConfigured/);
  assert.match(renderer, /steelFrameRoofConfigured/);
  assert.match(renderer, /0x3FAE67/);
  assert.match(html, /data-sf-quantity\]:disabled/);
});
