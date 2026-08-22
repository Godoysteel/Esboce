import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('bandeja e botão Pintar saem da interface; catálogo vira o único seletor visual', () => {
  assert.doesNotMatch(html, /id="paintPickerPanel"/);
  assert.doesNotMatch(html, /id="toolPaintBucket"/);
  assert.doesNotMatch(html, />Aplicar no cômodo</);
});

test('clique no cartão aplicável carrega a melhor oferta e fecha o catálogo', () => {
  assert.match(app, /card\.addEventListener\("click", \(\) => \{/);
  assert.match(app, /if \(!action\.enabled \|\| !bestOffer\)/);
  assert.match(app, /ViewportController\.activateCatalogProduct\(product\.id, selection\)/);
  assert.match(app, /this\.requireElement\("catalogOverlay"\)\.classList\.remove\("visible"\)/);
});

test('primeiro clique na face aplica imediatamente sem seleção e confirmação intermediárias', () => {
  assert.match(viewport, /paintProduct\.category === 'floor_tile' && paintHit && paintHit\.object\.userData\.roomKey/);
  assert.match(viewport, /Store\.commands\.setRoomFinish\(roomKey, currentPaintProductId, floorFinishScale, floorFinishRotation\)/);
  assert.match(viewport, /paintProduct\.category === 'paint' \|\| paintProduct\.category === 'floor_tile'/);
  assert.doesNotMatch(viewport, /Piso selecionado\. Escolha o material, ajuste escala e rotação e clique em Aplicar/);
});
