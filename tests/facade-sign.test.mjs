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

// Achado real (Product Owner: "ainda está travando... verifique sistema
// de fachada") — buildFacadeSignMesh desenhava um canvas 1024x256 com
// ctx.shadowBlur e subia uma CanvasTexture nova pra GPU em TODO
// rebuild() completo da cena (ou seja, em qualquer ação do app, não só
// mexendo na fachada), mesmo quando nada do letreiro mudava. Corrigido
// com um cache por letreiro (getFacadeSignTexture), mesma técnica já
// usada pra planta baixa importada (getPlanUnderlayTexture).
test('getFacadeSignTexture: cacheia a textura por letreiro e só redesenha quando texto/cor/iluminação muda', () => {
  const start = renderer.indexOf('function getFacadeSignTexture(sign: any): THREE.CanvasTexture {');
  assert.ok(start !== -1);
  const end = renderer.indexOf('\n  }', start);
  const body = renderer.slice(start, end);
  assert.match(body, /var cached = facadeSignTextureCache\[sign\.id\];/);
  assert.match(body, /if \(cached && cached\.key === key\) return cached\.texture;/);
  assert.match(body, /if \(cached\) cached\.texture\.dispose\(\);/);
  // a chave inclui tudo que afeta o desenho do canvas (texto, cores, iluminação, dia/noite)
  assert.match(body, /sign\.text \+ '\|' \+ sign\.faceColorHex \+ '\|' \+ sign\.lightColorHex \+ '\|' \+ sign\.lighting \+ '\|' \+ \(facadeNightMode/);
});

test('buildFacadeSignMesh usa a textura cacheada e marca o material como sharedMap (nunca descartado pelo dispose do rebuild)', () => {
  const start = renderer.indexOf('function buildFacadeSignMesh(sign: any, wall: any');
  assert.ok(start !== -1);
  const end = renderer.indexOf('\n  }', start);
  const body = renderer.slice(start, end);
  assert.match(body, /var texture = getFacadeSignTexture\(sign\);/);
  assert.match(body, /material\.userData\.sharedMap = true;/);
});

test('disposeObject3D e disposeObject3DTree respeitam material.userData.sharedMap (não descartam a textura cacheada do letreiro)', () => {
  ['function disposeObject3D(obj: any) {', 'function disposeObject3DTree(obj: any) {'].forEach((sig) => {
    const start = renderer.indexOf(sig);
    assert.ok(start !== -1, sig);
    const end = renderer.indexOf('\n  }', start);
    const body = renderer.slice(start, end);
    assert.match(body, /if \(mat\.map && !mat\.userData\?\.sharedMap\) mat\.map\.dispose\(\);/, sig);
  });
});

test('rebuild() poda o cache de textura de letreiros apagados (não segura GPU de letreiro que não existe mais)', () => {
  const start = renderer.indexOf('export function rebuild(scene: THREE.Scene, project: Project, canvasSize: any, viewState: ViewState) {');
  assert.ok(start !== -1);
  const clearAt = renderer.indexOf('clearRegistry();', start);
  const body = renderer.slice(clearAt, clearAt + 700);
  assert.match(body, /var liveFacadeSignIds = new Set<string>\(\);/);
  assert.match(body, /if \(!liveFacadeSignIds\.has\(id\)\) \{ facadeSignTextureCache\[id\]!\.texture\.dispose\(\); delete facadeSignTextureCache\[id\]; \}/);
});
