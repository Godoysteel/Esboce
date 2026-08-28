import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createFacadeSignEntity, createWallEntity } from '../src/core/Core.ts';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const persistence = await readFile(new URL('../src/core/ProjectPersistence.ts', import.meta.url), 'utf8');

test('letreiro nasce centralizado e limitado à parede', () => {
  const wall = createWallEntity(0, 0, 200, 0, 'wall-sign');
  const sign = createFacadeSignEntity(wall, '  Loja Modelo  ');
  assert.equal(sign.wallId, wall.id);
  assert.equal(sign.text, 'Loja Modelo');
  assert.equal(sign.offsetM, 5);
  assert.ok(sign.widthM <= 10);
  assert.equal(sign.lighting, 'halo');
});

test('formulário oferece controles essenciais e edição', () => {
  for (const id of ['facadeSignText', 'facadeSignWidth', 'facadeSignHeight', 'facadeSignElevation', 'facadeSignLighting', 'facadeSignFaceColor', 'facadeSignLightColor']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
  assert.match(app, /createFacadeSign\(activeFacadeWallId, values\)/);
  assert.match(app, /updateFacadeSign\(editingFacadeSignId, values\)/);
  assert.match(app, /deleteFacadeSign\(editingFacadeSignId\)/);
});

test('renderização usa textura emissiva e alternância dia/noite', () => {
  assert.match(renderer, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(renderer, /emissiveIntensity: facadeNightMode/);
  assert.match(app, /ViewportController\.setFacadeNightMode\(facadeNightMode\)/);
});

test('letreiro participa da persistência versionada', () => {
  assert.match(persistence, /CURRENT_PROJECT_SCHEMA_VERSION = 20/);
  assert.match(persistence, /facadeSigns: array\(v\.facadeSigns/);
  assert.match(persistence, /parede hospedeira não existe/);
});
