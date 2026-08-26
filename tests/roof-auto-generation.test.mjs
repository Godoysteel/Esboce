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
  assert.match(store, /raisedBaseHeightM = Core\.WALL_HEIGHT \+ 0\.45/);
  assert.match(store, /lower = Core\.createRoofEntity\(base\.x1, base\.y1, joinX, base\.y2/);
  assert.match(store, /raised = Core\.createRoofEntity\(joinX, base\.y1, base\.x2, base\.y2/);
  assert.match(store, /raised\.steppedLowerRoofId = lower\.id/);
  assert.doesNotMatch(store, /floor\.walls\.push\(divider\)/);
  assert.doesNotMatch(store, /raised\.atticWallIds = floor\.walls/);
  assert.match(app, /createRoofCompositePreset\('extensaoLateral'\)/);
});

test('cumeeira em níveis preserva o beiral inferior contra o oitão elevado', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  assert.match(renderer, /var steppedRidgePair =/);
  assert.match(renderer, /tallerRoof\.compoundGroupId === roof\.compoundGroupId/);
  assert.match(renderer, /roof\.steppedLowerRoofId \|\| tallerRoof\.steppedLowerRoofId/);
  assert.match(renderer, /return !steppedRidgePair/);
  assert.match(renderer, /function buildSteppedRidgeClosure/);
  assert.match(renderer, /function buildRaisedRoofPerimeterClosures/);
  assert.match(renderer, /if \(roof\.steppedLowerRoofId\)/);
  assert.match(renderer, /buildRaisedRoofPerimeterClosures\(roof, scale/);
  assert.match(viewport, /roof\.steppedLowerRoofId === o\.id \|\| o\.steppedLowerRoofId === roof\.id/);
  assert.match(store, /const steppedPair = roof\.steppedLowerRoofId === candidate\.id \|\| candidate\.steppedLowerRoofId === roof\.id/);
  assert.match(store, /if \(!steppedPair && candidate\.ridgeAxis === roof\.ridgeAxis\) return/);
  assert.match(renderer, /var innerBaseHandle = new THREE\.Mesh/);
  assert.match(renderer, /innerBaseHandle\.userData\.handle = 'roofBaseHeight'/);
  assert.match(renderer, /closure\.userData\.roofClosure = 'transversal'/);
  assert.match(renderer, /closure\.userData\.roofClosure = 'perimetral'/);
  assert.match(store, /const minimumHeightM = r\.steppedLowerRoofId \? Core\.WALL_HEIGHT \+ 0\.15 : 0\.1/);
  assert.match(store, /Math\.min\(8, heightM\)/);
  assert.match(renderer, /baseHandleStem\.userData\.handle = 'roofBaseHeight'/);
  assert.match(renderer, /innerBaseStem\.userData\.handle = 'roofBaseHeight'/);
  assert.match(viewport, /Alça laranja: subir o telhado inteiro/);
  assert.match(viewport, /Telhado inteiro elevado individualmente/);
  assert.match(viewport, /if \(dragMode === 'roofBaseHeight'\) \{/);
  assert.match(viewport, /Telhado inteiro posicionado individualmente/);
  assert.match(viewport, /dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null/);
  assert.match(viewport, /var wholeRoofHit = hits\.find/);
  assert.match(renderer, /Math\.max\(roof\.baseHeightM \|\| currentWallHeight, currentWallHeight \+ 0\.15\)/);
  assert.match(renderer, /baseHandle\.position\.set\(wx2 \+ 0\.85/);
  assert.match(viewport, /var finalWholeRoofHeight = dragElementStart\.baseHeightM \+ \(dragElementStart\.startScreenY - e\.clientY\) \* 0\.01/);
  assert.match(viewport, /updateRoofBaseHeightLive\(selectedRoofId, finalWholeRoofHeight\)/);
});
