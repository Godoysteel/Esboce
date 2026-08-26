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

test('cumeeira em níveis usa volume visual fechado sem alterar paredes estruturais', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  assert.match(renderer, /var steppedRidgePair =/);
  assert.match(renderer, /tallerRoof\.compoundGroupId === roof\.compoundGroupId/);
  assert.match(renderer, /roof\.steppedLowerRoofId \|\| tallerRoof\.steppedLowerRoofId/);
  assert.match(renderer, /return !steppedRidgePair/);
  assert.match(renderer, /function buildSteppedRoofVisualVolume/);
  assert.match(renderer, /if \(roof\.steppedLowerRoofId\)/);
  assert.match(renderer, /buildSteppedRoofVisualVolume\(roof, scale/);
  assert.match(viewport, /roof\.steppedLowerRoofId === o\.id \|\| o\.steppedLowerRoofId === roof\.id/);
  assert.match(store, /const steppedPair = roof\.steppedLowerRoofId === candidate\.id \|\| candidate\.steppedLowerRoofId === roof\.id/);
  assert.match(store, /if \(!steppedPair && candidate\.ridgeAxis === roof\.ridgeAxis\) return/);
  assert.match(renderer, /closure\.userData\.roofClosure = 'volume-visual'/);
  assert.match(renderer, /var visualBottomM = structuralWallHeightM - 0\.05/);
  assert.match(store, /const minimumHeightM = r\.steppedLowerRoofId \? Core\.WALL_HEIGHT \+ 0\.15 : 0\.1/);
  assert.match(store, /Math\.min\(8, heightM\)/);
  assert.match(viewport, /Use “Subir telhado inteiro” no painel/);
  assert.match(viewport, /selectedRoofId = roofId; gizmoMenuOpen = true; render\(\)/);
  assert.match(viewport, /Telhado inteiro elevado individualmente/);
  assert.match(renderer, /Math\.max\(roof\.baseHeightM \|\| currentWallHeight, currentWallHeight \+ 0\.15\)/);
  assert.doesNotMatch(renderer, /baseHandle\.userData\.handle = 'roofBaseHeight'/);
  assert.match(viewport, /roofElevationInputEl\.addEventListener\('input'/);
  assert.match(viewport, /candidate\.steppedLowerRoofId === selectedRoof!\.id/);
  assert.match(viewport, /updateRoofBaseHeightLive\(elevationTarget\.id, heightM\)/);
});
