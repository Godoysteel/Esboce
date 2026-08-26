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
  assert.match(store, /raised\.steppedWallVolume = true/);
  assert.doesNotMatch(store, /raised\.steppedLowerRoofId = lower\.id/);
  assert.doesNotMatch(store, /floor\.walls\.push\(divider\)/);
  assert.doesNotMatch(store, /raised\.atticWallIds = floor\.walls/);
  assert.match(app, /createRoofCompositePreset\('extensaoLateral'\)/);
});

test('cumeeira em níveis usa volume visual fechado sem alterar paredes estruturais', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  assert.match(renderer, /function buildSteppedRoofVisualVolume/);
  assert.match(renderer, /if \(roof\.steppedWallVolume \|\| roof\.steppedLowerRoofId\)/);
  assert.match(renderer, /buildSteppedRoofVisualVolume\(roof, scale/);
  assert.match(renderer, /var halfWallModel = \(Core\.WALL_THICK \/ 2\) \* Core\.GRID/);
  assert.match(renderer, /volumeX1 = Math\.min\(roof\.x1, roof\.x2\) \+ halfWallModel/);
  assert.match(store, /if \(roof\.steppedWallVolume \|\| candidate\.steppedWallVolume\) return/);
  assert.match(renderer, /closure\.userData\.roofClosure = 'volume-visual'/);
  assert.match(renderer, /var visualBottomM = structuralWallHeightM - 0\.05/);
  assert.match(store, /r\.steppedWallVolume \|\| r\.steppedLowerRoofId/);
  assert.match(store, /Math\.min\(8, heightM\)/);
  assert.match(viewport, /Telhado superior independente/);
  assert.match(viewport, /selectedRoofId = roofId; gizmoMenuOpen = true; render\(\)/);
  assert.match(viewport, /Telhado inteiro elevado individualmente/);
  assert.match(renderer, /Math\.max\(roof\.baseHeightM \|\| currentWallHeight, currentWallHeight \+ 0\.15\)/);
  assert.doesNotMatch(renderer, /baseHandle\.userData\.handle = 'roofBaseHeight'/);
  assert.match(viewport, /roofElevationInputEl\.addEventListener\('input'/);
  assert.match(viewport, /selectedRoof\.atticMode \|\| selectedRoof\.steppedWallVolume/);
  assert.match(viewport, /updateRoofBaseHeightLive\(elevationTarget\.id, heightM\)/);
});
