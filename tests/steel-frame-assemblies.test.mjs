import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createProject, createWallEntity } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';
import {
  STEEL_FRAME_FACE_ASSEMBLIES,
  quantityWithWaste,
  steelFrameSpecificationIssues,
} from '../src/core/SteelFrameAssemblies.ts';

const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

test('catálogo inicial cobre fechamentos externos, drywall, beiral e tabeira de madeira', () => {
  const ids = STEEL_FRAME_FACE_ASSEMBLIES.map((item) => item.id);
  assert.deepEqual(ids.slice(0, 6), [
    'eifs', 'cement-board-direct', 'cement-board-osb', 'glasroc-x-direct',
    'glasroc-x-therm', 'vinyl-siding-osb',
  ]);
  assert.ok(ids.includes('drywall-st'));
  assert.ok(ids.includes('soffit-cement-board'));
  assert.ok(ids.includes('fascia-cement-board'));
  assert.ok(ids.includes('fascia-wood'));
});

test('beiral e tabeira são escolhas globais únicas, não uma pendência por telhado', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push(
    { id: 'roof-a', x1: 0, y1: 0, x2: 100, y2: 100, type: 'quatroAguas', pitchDeg: 28, ridgeAxis: 'x' },
    { id: 'roof-b', x1: 100, y1: 0, x2: 200, y2: 100, type: 'quatroAguas', pitchDeg: 28, ridgeAxis: 'x' },
  );
  let issues = steelFrameSpecificationIssues(project);
  assert.equal(issues.filter((issue) => issue.kind === 'soffit').length, 1);
  assert.equal(issues.filter((issue) => issue.kind === 'fascia').length, 1);
  assert.equal(issues.find((issue) => issue.kind === 'soffit').entityId, '__project__');
  project.steelFrameSoffitAssemblyId = 'soffit-vinyl';
  project.steelFrameFasciaAssemblyId = 'fascia-wood';
  issues = steelFrameSpecificationIssues(project);
  assert.equal(issues.filter((issue) => issue.kind === 'soffit' || issue.kind === 'fascia').length, 0);
});

test('acabamentos globais de beiral e tabeira sobrevivem ao salvamento', () => {
  const project = createProject('light_steel_frame');
  project.steelFrameSoffitAssemblyId = 'soffit-cement-board';
  project.steelFrameFasciaAssemblyId = 'fascia-wood';
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project;
  assert.equal(restored.steelFrameSoffitAssemblyId, 'soffit-cement-board');
  assert.equal(restored.steelFrameFasciaAssemblyId, 'fascia-wood');
});

test('fixadores de revestimento são unidades e arredondam para cima após a perda', () => {
  const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-direct');
  const screws = assembly.layers.find((layer) => layer.fastener);
  assert.equal(screws.unit, 'unit');
  assert.equal(quantityWithWaste(10.01, screws), 211);
});

test('estrutura engenheirada usa parâmetro preliminar de 30 kg/m² e mantém 5% de perda explícitos', () => {
  assert.match(materialsSource, /const STEEL_FRAME_STRUCTURE_KG_PER_M2 = 30;/);
  assert.match(materialsSource, /parâmetro preliminar 30 kg\/m² \+ 5% de perda/);
  assert.match(materialsSource, /structuralArea \* STEEL_FRAME_STRUCTURE_KG_PER_M2 \* 1\.05/);
});

test('placa cimentícia inclui Base Coat, fita e tela Fiberglass com unidades corretas', () => {
  for (const assemblyId of ['cement-board-direct', 'cement-board-osb', 'soffit-cement-board', 'fascia-cement-board']) {
    const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === assemblyId);
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.base-coat-20kg')?.unit, 'kg');
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.fita-fiberglass-10cm-50m')?.unit, 'm');
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.tela-fiberglass-1x50m')?.unit, 'm2');
  }
});

test('drywall inclui massa e fita telada para tratamento de juntas', () => {
  for (const assemblyId of ['drywall-st', 'drywall-ru', 'drywall-rf']) {
    const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === assemblyId);
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.massa-drywall')?.unit, 'kg');
    assert.equal(assembly.layers.find((layer) => layer.id === 'drywall-joint-tape')?.unit, 'm');
  }
});

test('quantitativo inclui manta asfáltica sob toda guia inferior com 10% de perda', () => {
  assert.match(materialsSource, /lowerGuideLengthM \+= Core\.wallLengthMeters\(wall\)/);
  assert.match(materialsSource, /Manta asfáltica sob a guia inferior \(\+ 10% de perda\)/);
  assert.match(materialsSource, /lowerGuideLengthM \* 1\.1/);
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
