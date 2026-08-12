import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';
import { buildColdWaterKitchenPrototype, buildColdWaterNetworkFromFixtures, createPositionedHydraulicFixture, findKitchenFixturePoint, hydraulicFixtureTemplate, hydraulicFixtureVisualPosition, resolveEquipmentConnector, resolveHydraulicFixturePosition, segmentIsOrthogonal3D } from '../src/core/Hydraulics.ts';

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
  const point = findKitchenFixturePoint(project.floors[0]);
  assert.equal(point.equipmentId, 'armario');
  assert.equal(point.x, 58.4);
  assert.equal(point.y, 74);
  assert.equal(point.elevationM, 0.6);
});

test('gabarito da pia gira o conector junto com o modelo visual', () => {
  const base = { id: 'pia', productId: 'vortice.movel.armario-cozinha', x: 100, y: 100, rotationDeg: 0, elevationM: 0 };
  const north = resolveEquipmentConnector(base, 'cold_water_inlet');
  const east = resolveEquipmentConnector({ ...base, rotationDeg: 90 }, 'cold_water_inlet');
  assert.deepEqual({ x: north.x, y: north.y, z: north.elevationM }, { x: 100, y: 93.6, z: 0.6 });
  assert.deepEqual({ x: east.x, y: east.y, z: east.elevationM }, { x: 106.4, y: 100, z: 0.6 });
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
  assert.equal(endpoint.equipmentId, 'armario');
  assert.equal(endpoint.connectorKey, 'cold_water_inlet');
});

test('ponto de parede encaixa no eixo e preserva a altura técnica', () => {
  const wall = { id: 'parede-pia', x1: 0, y1: 0, x2: 100, y2: 0 };
  const point = createPositionedHydraulicFixture('kitchen_faucet', 46, 9, wall);
  assert.equal(point.wallId, 'parede-pia');
  assert.equal(point.placementSurface, 'wall');
  assert.equal(point.networkType, 'cold_water');
  assert.equal(point.elevationM, 0.6);
  assert.deepEqual({ x: point.x, y: point.y }, { x: 46, y: 0 });
});

test('ralo encaixa no grid do piso e não aceita parede obrigatória', () => {
  const template = hydraulicFixtureTemplate('shower_drain');
  const point = createPositionedHydraulicFixture('shower_drain', 33, 47);
  assert.equal(template.placementSurface, 'floor');
  assert.equal(point.wallId, undefined);
  assert.deepEqual({ x: point.x, y: point.y }, { x: 40, y: 40 });
});

test('ponto de parede não pode nascer solto no ambiente', () => {
  assert.equal(createPositionedHydraulicFixture('shower', 20, 20), null);
});

test('wall fixture dragging stays constrained to its host wall', () => {
  const wall = { id: 'wall-host', x1: 0, y1: 10, x2: 100, y2: 10 };
  const point = createPositionedHydraulicFixture('shower', 20, 40, wall);
  assert.deepEqual(resolveHydraulicFixturePosition(point, 74, 55, wall), { x: 74, y: 10 });
});

test('floor fixture dragging remains snapped to the technical grid', () => {
  const point = createPositionedHydraulicFixture('floor_drain', 20, 20);
  assert.deepEqual(resolveHydraulicFixturePosition(point, 51, 69), { x: 60, y: 60 });
});

test('water outlet marker is rendered beyond the wall face while its technical point stays on axis', () => {
  const wall = { id: 'wall-face', x1: 0, y1: 0, x2: 100, y2: 0 };
  const point = createPositionedHydraulicFixture('kitchen_faucet', 50, 4, wall);
  const visual = hydraulicFixtureVisualPosition(point, wall, [wall]);
  assert.equal(point.y, 0);
  assert.ok(Math.abs(visual.y) > 2.6);
});

test('active hydraulic placement tool still gives drag priority to an existing fixture', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(source, /hydraulicMesh\.userData\.hydraulicEditable/);
  assert.match(source, /clicar nele deve selecionar\/arrastar/);
});

test('cold-water generation places a tank above the last floor and routes every water point', () => {
  const project = createProject();
  project.floors.push({ ...structuredClone(project.floors[0]), id: 'upper', name: 'Superior', walls: [], openings: [], columns: [], roofs: [], varandas: [], lajes: [], furniture: [] });
  const point = createPositionedHydraulicFixture('kitchen_faucet', 40, 0, { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0 });
  point.floorIndex = 0;
  const system = buildColdWaterNetworkFromFixtures(project.floors, { nodes: [point], segments: [] });
  const tank = system.nodes.find((node) => node.kind === 'source');
  assert.equal(tank.floorIndex, 1);
  assert.equal(tank.label, "Caixa d'água");
  assert.ok(system.segments.length >= 2);
  system.segments.forEach((segment) => assert.equal(segmentIsOrthogonal3D(system, segment.id), true));
});
