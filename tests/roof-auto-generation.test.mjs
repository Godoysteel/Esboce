import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core } from '../src/core/Core.ts';

test('gerador ignora divisória interna e cria um volume retangular coeso', () => {
  const walls = [
    Core.createWallEntity(0, 0, 200, 0),
    Core.createWallEntity(200, 0, 200, 100),
    Core.createWallEntity(200, 100, 0, 100),
    Core.createWallEntity(0, 100, 0, 0),
    Core.createWallEntity(100, 0, 100, 100),
  ];
  const rects = Core.roofGenerationRects(walls);
  assert.equal(rects.length, 1);
  assert.ok(rects[0].x1 < 0 && rects[0].x2 > 200 && rects[0].y1 < 0 && rects[0].y2 > 100);
});

test('interface prioriza modelos manuais compostos e mantém as peças editáveis', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="generateRoofBtn"/);
  assert.match(html, /id="roofPresetExtension"/);
  assert.match(html, /id="roofPresetParallel"/);
  assert.match(store, /createRoofCompositePreset/);
  assert.match(store, /floor\.roofs\.push\(\.\.\.roofs\)/);
  assert.match(store, /raisedBaseHeightM = Core\.WALL_HEIGHT \+ 1\.05/);
  assert.match(store, /raised\.atticWallIds = floor\.walls/);
  assert.match(store, /floor\.walls\.push\(divider\)/);
  assert.match(app, /createRoofCompositePreset\('extensaoLateral'\)/);
});
