import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createVolumeBoxEntity } from '../src/core/Core.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const gizmoSource = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');

test('createVolumeBoxEntity nasce solto (preview), com o tamanho padrão de 1x1x0,3m', () => {
  const box = createVolumeBoxEntity(100, 200);
  assert.equal(box.state, 'preview');
  assert.equal(box.widthM, Core.VOLUME_BOX_DEFAULT_WIDTH_M);
  assert.equal(box.heightM, Core.VOLUME_BOX_DEFAULT_HEIGHT_M);
  assert.equal(box.depthM, Core.VOLUME_BOX_DEFAULT_DEPTH_M);
  assert.equal(box.x, 100);
  assert.equal(box.y, 200);
});

test('index.html tem o botão-mestre Fachada com o flyout de Envidraçamento/Volumetria/Ornamentos/Brises', () => {
  assert.match(html, /id="fachadaToggleBtn"/);
  assert.match(html, /id="fachadaFlyout"/);
  assert.match(html, /id="addGlazingPanelBtn"[^>]*data-room-preset="glazing"/);
  assert.match(html, /id="addVolumeBoxBtn"[^>]*data-room-preset="volumetria"/);
  assert.match(html, /data-disabled-label="Ornamentos"/);
  assert.match(html, /data-disabled-label="Brises"/);
});

test('index.html tem o gizmo dedicado do volume, com altura/largura/subir/descer', () => {
  assert.match(html, /id="volumeBoxGizmo"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="heightUp"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="heightDown"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="widthUp"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="widthDown"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="up"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="down"/);
});

test('placeRoomPreset cria um Bloco de Volumetria solto pra key "volumetria"', () => {
  assert.match(viewportSource, /key === 'volumetria'/);
  assert.match(viewportSource, /Store\.commands\.createVolumeBox\(/);
});

test('a tolerância de encosto do volume é própria (mais generosa que a do vidro) e o pointerup avisa se encostou ou não', () => {
  assert.match(viewportSource, /VOLUME_BOX_ATTACH_TOLERANCE_MODEL = 1\.5 \* Core\.GRID/);
  assert.match(viewportSource, /Volume encostado na parede/);
  assert.match(viewportSource, /Volume ainda solto/);
});

test('Scene3DRenderer sabe montar o volume solto e o anexado à parede', () => {
  assert.match(rendererSource, /function buildVolumeBoxPreviewMesh/);
  assert.match(rendererSource, /function buildVolumeBoxAttachedMesh/);
  assert.match(rendererSource, /floorData\.volumeBoxes/);
});

test('Store tem os comandos de altura/forma do volume, com os limites certos', () => {
  assert.match(storeSource, /nudgeVolumeBoxHeight\(volumeBoxId: string, deltaM: number\)/);
  assert.match(storeSource, /resizeVolumeBoxWidth\(volumeBoxId: string, deltaM: number\)/);
  assert.match(storeSource, /resizeVolumeBoxHeight\(volumeBoxId: string, deltaM: number\)/);
  // sillHeightM nunca fica negativo (não pode "descer" abaixo do chão)
  assert.match(storeSource, /b\.sillHeightM = Math\.max\(0, \(b\.sillHeightM \|\| 0\) \+ deltaM\)/);
  // largura/altura têm um piso mínimo (não fica menor que 0,2m)
  assert.match(storeSource, /Math\.max\(0\.2, b\.widthM \+ deltaM\)/);
  assert.match(storeSource, /b\.heightM = Math\.max\(0\.2, b\.heightM \+ deltaM\)/);
  // altura em relação ao chão só se aplica depois de encostado
  assert.match(storeSource, /if \(!b \|\| b\.state !== 'attached'\) return;\s*\n\s*pushUndoSnapshot\(\);\s*\n\s*b\.sillHeightM/);
});

test('GizmoController liga os botões do volumeBoxGizmo aos comandos certos do Store', () => {
  assert.match(gizmoSource, /volumeBoxGizmoEl/);
  assert.match(gizmoSource, /Store\.commands\.nudgeVolumeBoxHeight\(volumeBoxId, VOLUME_BOX_STEP_M\)/);
  assert.match(gizmoSource, /Store\.commands\.nudgeVolumeBoxHeight\(volumeBoxId, -VOLUME_BOX_STEP_M\)/);
  assert.match(gizmoSource, /Store\.commands\.resizeVolumeBoxWidth\(volumeBoxId, VOLUME_BOX_STEP_M\)/);
  assert.match(gizmoSource, /Store\.commands\.resizeVolumeBoxHeight\(volumeBoxId, VOLUME_BOX_STEP_M\)/);
});

