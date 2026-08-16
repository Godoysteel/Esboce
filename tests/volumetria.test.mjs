import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createVolumeBoxEntity } from '../src/core/Core.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');

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

test('placeRoomPreset cria um Bloco de Volumetria solto pra key "volumetria"', () => {
  assert.match(viewportSource, /key === 'volumetria'/);
  assert.match(viewportSource, /Store\.commands\.createVolumeBox\(/);
});

test('Scene3DRenderer sabe montar o volume solto e o anexado à parede', () => {
  assert.match(rendererSource, /function buildVolumeBoxPreviewMesh/);
  assert.match(rendererSource, /function buildVolumeBoxAttachedMesh/);
  assert.match(rendererSource, /floorData\.volumeBoxes/);
});
