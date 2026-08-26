import assert from 'node:assert/strict';
import test from 'node:test';

import { createProject, createWallEntity } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';
import {
  STEEL_FRAME_FACE_ASSEMBLIES,
  quantityWithWaste,
  steelFrameSpecificationIssues,
} from '../src/core/SteelFrameAssemblies.ts';

test('catálogo inicial cobre fechamentos externos, drywall e beiral', () => {
  const ids = STEEL_FRAME_FACE_ASSEMBLIES.map((item) => item.id);
  assert.deepEqual(ids.slice(0, 6), [
    'eifs', 'cement-board-direct', 'cement-board-osb', 'glasroc-x-direct',
    'glasroc-x-therm', 'vinyl-siding-osb',
  ]);
  assert.ok(ids.includes('drywall-st'));
  assert.ok(ids.includes('soffit-cement-board'));
});

test('fixadores de revestimento são unidades e arredondam para cima após a perda', () => {
  const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-direct');
  const screws = assembly.layers.find((layer) => layer.fastener);
  assert.equal(screws.unit, 'unit');
  assert.equal(quantityWithWaste(10.01, screws), 211);
});

test('quantitativo de steel frame aponta faces e isolamento ainda não especificados', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].walls.push(createWallEntity(0, 0, 100, 0));
  const wall = project.floors[0].walls[0];
  const issues = steelFrameSpecificationIssues(project);
  assert.ok(issues.some((issue) => issue.kind === 'wall-face' && issue.entityId === wall.id && issue.side === 'a'));
  assert.ok(issues.some((issue) => issue.kind === 'wall-cavity' && issue.entityId === wall.id));
});

test('alvenaria não exige especificações de fechamento de steel frame', () => {
  assert.deepEqual(steelFrameSpecificationIssues(createProject('ceramic_masonry')), []);
});

test('composições de faces e núcleo sobrevivem ao salvamento do projeto', () => {
  const project = createProject('light_steel_frame');
  const wall = createWallEntity(0, 0, 100, 0);
  wall.faceAAssemblyId = 'cement-board-osb';
  wall.faceBAssemblyId = 'drywall-ru';
  wall.cavityAssembly = {
    insulationSystemId: 'mineral-wool',
    thicknessMm: 90,
    purpose: 'thermal_acoustic',
  };
  project.floors[0].walls.push(wall);
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].walls[0];
  assert.equal(restored.faceAAssemblyId, 'cement-board-osb');
  assert.equal(restored.faceBAssemblyId, 'drywall-ru');
  assert.deepEqual(restored.cavityAssembly, wall.cavityAssembly);
});

test('platibanda exige revestimento externo e interno no steel frame', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push({
    id: 'roof-platibanda', x1: 0, y1: 0, x2: 100, y2: 100,
    type: 'platibanda', pitchDeg: 0, ridgeAxis: 'x', parapetHeight: 0.8,
    soffitAssemblyId: 'soffit-cement-board', fasciaAssemblyId: 'placlux.profort-next-10mm',
  });
  const issues = steelFrameSpecificationIssues(project);
  assert.ok(issues.some((issue) => issue.kind === 'parapet-face' && issue.side === 'outer'));
  assert.ok(issues.some((issue) => issue.kind === 'parapet-face' && issue.side === 'inner'));
  project.floors[0].roofs[0].parapetOuterAssemblyId = 'cement-board-osb';
  project.floors[0].roofs[0].parapetInnerAssemblyId = 'cement-board-direct';
  assert.equal(steelFrameSpecificationIssues(project).filter((issue) => issue.kind === 'parapet-face').length, 0);
});

test('revestimentos da platibanda sobrevivem ao salvamento', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push({
    id: 'roof-platibanda', x1: 0, y1: 0, x2: 100, y2: 100,
    type: 'platibanda', pitchDeg: 0, ridgeAxis: 'x', parapetHeight: 0.8,
    parapetOuterAssemblyId: 'cement-board-osb',
    parapetInnerAssemblyId: 'cement-board-direct',
  });
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].roofs[0];
  assert.equal(restored.parapetOuterAssemblyId, 'cement-board-osb');
  assert.equal(restored.parapetInnerAssemblyId, 'cement-board-direct');
});

test('extensão da cumeeira em níveis exige duas faces e sobrevive ao salvamento', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push({
    id: 'roof-stepped', x1: 0, y1: 0, x2: 100, y2: 100,
    type: 'duasAguas', pitchDeg: 28, ridgeAxis: 'x', steppedWallVolume: true,
    baseHeightM: 3.15, gableFaceAAssemblyId: 'eifs', gableFaceBAssemblyId: 'eifs',
    soffitAssemblyId: 'soffit-cement-board', fasciaAssemblyId: 'cement-board-direct',
  });
  assert.equal(steelFrameSpecificationIssues(project).filter((issue) => issue.kind === 'stepped-wall-face').length, 2);
  project.floors[0].roofs[0].steppedWallFaceAAssemblyId = 'eifs';
  project.floors[0].roofs[0].steppedWallFaceBAssemblyId = 'drywall-st';
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].roofs[0];
  assert.equal(restored.steppedWallFaceAAssemblyId, 'eifs');
  assert.equal(restored.steppedWallFaceBAssemblyId, 'drywall-st');
});
