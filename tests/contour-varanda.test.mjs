import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';

test('varanda de contorno encontra as quatro fachadas de um cômodo retangular', () => {
  const walls = [
    Core.createWallEntity(0, 0, 160, 0), Core.createWallEntity(160, 0, 160, 100),
    Core.createWallEntity(160, 100, 0, 100), Core.createWallEntity(0, 100, 0, 0),
  ];
  const segments = Core.varandaContourSegments(walls);
  assert.equal(segments.length, 4);
  assert.deepEqual(new Set(segments.map((segment) => segment.wallId)), new Set(walls.map((wall) => wall.id)));
});

test('varanda de contorno preserva percurso, largura e material ao salvar', () => {
  const project = createProject();
  project.floors[0].varandas.push({
    id: 'varanda-contorno', x1: 0, y1: 0, x2: 100, y2: 100, frontSide: 'minZ', widthM: 2.2, postMaterial: 'madeira',
    contourSegments: [{ wallId: 'wall-1', x1: 0, y1: 0, x2: 100, y2: 0, outwardSign: -1 }],
  });
  const decoded = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].varandas[0];
  assert.equal(decoded.postMaterial, 'madeira');
  assert.equal(decoded.widthM, 2.2);
  assert.equal(decoded.contourSegments.length, 1);
});

test('interface e renderizador oferecem postes e cobertura acompanhando o contorno', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  ['madeira', 'concreto', 'tijolo'].forEach((material) => assert.match(html, new RegExp(`data-post-material="${material}"`)));
  assert.match(renderer, /varanda\.contourSegments/);
  assert.match(renderer, /buildRoofPiece\(roof/);
  assert.match(renderer, /postCount/);
});

test('módulo isolado adere à parede externa somente quando chega perto', () => {
  const walls = [
    Core.createWallEntity(0, 0, 200, 0), Core.createWallEntity(200, 0, 200, 120),
    Core.createWallEntity(200, 120, 0, 120), Core.createWallEntity(0, 120, 0, 0),
  ];
  const snapped = Core.snapVarandaSegmentToExteriorWalls(40, -8, 100, -8, walls, 20);
  assert.ok(snapped);
  assert.equal(snapped.wallId, walls[0].id);
  assert.equal(snapped.y1, 0);
  assert.equal(Core.snapVarandaSegmentToExteriorWalls(40, -80, 100, -80, walls, 20), null);
});

test('extensão serpenteia pela quina da parede externa', () => {
  const walls = [
    Core.createWallEntity(0, 0, 200, 0), Core.createWallEntity(200, 0, 200, 120),
    Core.createWallEntity(200, 120, 0, 120), Core.createWallEntity(0, 120, 0, 0),
  ];
  const seedWall = Core.varandaContourSegments(walls).find((segment) => segment.wallId === walls[0].id);
  assert.ok(seedWall);
  const path = Core.extendVarandaAlongExteriorWalls({ ...seedWall, x1: 40, y1: 0, x2: 100, y2: 0 }, 200, 80, walls);
  assert.ok(path.length >= 2);
  assert.equal(path.at(-1).wallId, walls[1].id);
});

test('varanda nova possui controles paramétricos e extensão reta com Shift', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(html, /id="varandaWidthInput"/);
  assert.match(html, /id="varandaHeightInput"/);
  assert.match(html, /id="varandaPitchInput"/);
  assert.match(viewport, /extendVarandaLive\(selectedVarandaId, Core\.snap\(gpVT\.x\), Core\.snap\(gpVT\.y\), !!e\.shiftKey\)/);
  assert.match(viewport, /dragMode = 'varandaBody'/);
});
