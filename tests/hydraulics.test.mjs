import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';
import { buildColdWaterKitchenPrototype, findKitchenFixturePoint, segmentIsOrthogonal3D } from '../src/core/Hydraulics.ts';

test('projeto novo nasce com rede hidráulica vazia e camada visível', () => {
  const project = createProject();
  assert.deepEqual(project.hydraulics, { nodes: [], segments: [] });
  assert.equal(project.layers.instalacoes, true);
});

test('rede hidráulica procedural sobrevive ao salvamento', () => {
  const project = createProject();
  project.hydraulics.nodes.push(
    { id: 'n1', kind: 'source', networkType: 'cold_water', label: "Caixa d'água", x: 0, y: 0, elevationM: 3 },
    { id: 'n2', kind: 'fixture', networkType: 'cold_water', label: 'Chuveiro', x: 40, y: 0, elevationM: 2.1 },
  );
  project.hydraulics.segments.push({ id: 's1', networkType: 'cold_water', startNodeId: 'n1', endNodeId: 'n2', diameterMm: 25 });
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  assert.deepEqual(decoded.project.hydraulics, project.hydraulics);
});

test('segmento hidráulico órfão é recusado', () => {
  const project = createProject();
  project.hydraulics.segments.push({ id: 's1', networkType: 'cold_water', startNodeId: 'ausente', endNodeId: 'tambem-ausente', diameterMm: 25 });
  assert.throws(() => encodeProjectDocument(project), /segmento referencia ponto inexistente/);
});

test('ponto provisório da cozinha acompanha o armário existente', () => {
  const project = createProject();
  project.floors[0].furniture.push({ id: 'armario', productId: 'vortice.movel.armario-cozinha', x: 52, y: 74, rotationDeg: 90, elevationM: 0 });
  assert.deepEqual(findKitchenFixturePoint(project.floors[0]), { x: 52, y: 74 });
});

test('primeiro circuito funcional não contém nenhum trecho diagonal', () => {
  const project = createProject();
  project.floors[0].walls.push(
    { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0 },
    { id: 'w2', x1: 100, y1: 0, x2: 100, y2: 100 },
  );
  project.floors[0].furniture.push({ id: 'armario', productId: 'vortice.movel.armario-cozinha', x: 80, y: 60, rotationDeg: 0, elevationM: 0 });
  const system = buildColdWaterKitchenPrototype(project.floors[0]);
  assert.equal(system.segments.length, 4);
  system.segments.forEach((segment) => assert.equal(segmentIsOrthogonal3D(system, segment.id), true));
  const endpoint = system.nodes.find((node) => node.kind === 'fixture');
  assert.deepEqual({ x: endpoint.x, y: endpoint.y }, { x: 80, y: 60 });
});
