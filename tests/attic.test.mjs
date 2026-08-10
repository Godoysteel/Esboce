import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ATTIC_KNEE_WALL_HEIGHT_M, floorWallHeight } from '../src/core/Attic.ts';
import { Core, createFloorEntity, createRoofEntity } from '../src/core/Core.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

test('novo ático nasce com parede lateral baixa', () => {
  const attic = createFloorEntity('Ático', 'attic');
  assert.equal(attic.kind, 'attic');
  assert.equal(floorWallHeight(attic, 2.8), ATTIC_KNEE_WALL_HEIGHT_M);
});

test('pavimento comum continua com o pé-direito normal', () => {
  assert.equal(floorWallHeight(createFloorEntity('Térreo'), 2.8), 2.8);
});

test('altura lateral personalizada fica em uma faixa segura', () => {
  const attic = createFloorEntity('Ático', 'attic');
  attic.wallHeightM = 0;
  assert.equal(floorWallHeight(attic, 2.8), 0.1);
  attic.wallHeightM = 4;
  assert.equal(floorWallHeight(attic, 2.8), 2.2);
});

test('interface oferece Ático e não oferece mais criação de Varanda', () => {
  assert.match(html, /id="addAtticBtn"/);
  assert.match(html, /data-attic-mode="chalet"/);
  assert.match(html, /data-attic-mode="attic"/);
  assert.match(html, /data-attic-mode="standard"/);
  assert.doesNotMatch(html, /data-room-preset="varanda"/);
});

test('renderização e quantitativo usam a altura específica do pavimento', () => {
  assert.match(rendererSource, /floorWallHeight\(floorData, WALL_HEIGHT\)/);
  assert.match(materialsSource, /floorWallHeight\(floor, standardWallHeight\)/);
});

test('ático novo pertence ao telhado e começa como prévia ajustável', () => {
  const roof = createRoofEntity(0, 0, 80, 60, 'duasAguas', 45, 'x', 'atico-1', undefined, 'preview', 1.2);
  assert.equal(roof.atticMode, 'preview');
  assert.equal(roof.baseHeightM, 1.2);
});

test('parede que cruza a projeção do telhado pode ser associada ao ático', () => {
  const roof = createRoofEntity(0, 0, 80, 60, 'duasAguas', 45, 'x', 'atico-2', undefined, 'preview', 1.2);
  const wall = { id: 'w', x1: -20, y1: 30, x2: 100, y2: 30 };
  assert.equal(Core.wallIntersectsRoofFootprint(wall, roof), true);
});
