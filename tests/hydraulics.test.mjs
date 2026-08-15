import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';
import { buildColdWaterKitchenPrototype, buildColdWaterNetworkFromFixtures, buildGuidedColdWaterHeaderRoute, classifyHydraulicJunction, createPositionedHydraulicFixture, findKitchenFixturePoint, hydraulicFixtureTemplate, hydraulicFixtureVisualPosition, hydraulicNodeWallOffsetsMeters, hydraulicPositionFromWallOffset, removeGuidedRouteForFixture, resolveEquipmentConnector, resolveHydraulicFixturePosition, segmentIsOrthogonal3D } from '../src/core/Hydraulics.ts';

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

test('ralo nasce exatamente onde foi clicado no piso — livre, sem grid — e não aceita parede obrigatória', () => {
  const template = hydraulicFixtureTemplate('shower_drain');
  const point = createPositionedHydraulicFixture('shower_drain', 33, 47);
  assert.equal(template.placementSurface, 'floor');
  assert.equal(point.wallId, undefined);
  assert.deepEqual({ x: point.x, y: point.y }, { x: 33, y: 47 });
});

test('ponto de parede não pode nascer solto no ambiente', () => {
  assert.equal(createPositionedHydraulicFixture('shower', 20, 20), null);
});

test('wall fixture dragging stays constrained to its host wall', () => {
  const wall = { id: 'wall-host', x1: 0, y1: 10, x2: 100, y2: 10 };
  const point = createPositionedHydraulicFixture('shower', 20, 40, wall);
  assert.deepEqual(resolveHydraulicFixturePosition(point, 74, 55, wall), { x: 74, y: 10 });
});

test('floor fixture dragging is free — no snap to the technical grid', () => {
  const point = createPositionedHydraulicFixture('floor_drain', 20, 20);
  assert.deepEqual(resolveHydraulicFixturePosition(point, 51, 69), { x: 51, y: 69 });
});

test('water outlet marker is rendered beyond the wall face while its technical point stays on axis', () => {
  const wall = { id: 'wall-face', x1: 0, y1: 0, x2: 100, y2: 0 };
  const point = createPositionedHydraulicFixture('kitchen_faucet', 50, 4, wall);
  const visual = hydraulicFixtureVisualPosition(point, wall, [wall]);
  assert.equal(point.y, 0);
  assert.ok(Math.abs(visual.y) > 2.6);
});

test('hydraulic fixture can explicitly choose either face of a shared wall', () => {
  const wall = { id: 'shared', x1: 0, y1: 0, x2: 100, y2: 0 };
  const point = createPositionedHydraulicFixture('shower', 50, 0, wall);
  const positive = hydraulicFixtureVisualPosition({ ...point, wallFaceSide: 1 }, wall, [wall]);
  const negative = hydraulicFixtureVisualPosition({ ...point, wallFaceSide: -1 }, wall, [wall]);
  assert.equal(positive.x, negative.x);
  assert.ok(positive.y > point.y);
  assert.ok(negative.y < point.y);
});

test('active hydraulic placement tool still gives drag priority to an existing fixture', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(source, /hydraulicMesh\.userData\.hydraulicEditable/);
  assert.match(source, /clicar nele deve selecionar\/arrastar/);
});

test('hydraulic fixture drag supports elevation and hides its label during movement', () => {
  const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  assert.match(viewport, /verticalGesture/);
  assert.match(viewport, /hydraulicLabel\) object\.visible = false/);
  assert.match(store, /node\.elevationM = Math\.max\(0\.05, Math\.min\(2\.6/);
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

test('cold-water generation preserves a manually guided route instead of overwriting it', () => {
  const project = createProject();
  const guidedPoint = createPositionedHydraulicFixture('shower', 40, 0, { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0 });
  const autoPoint = createPositionedHydraulicFixture('kitchen_faucet', 80, 0, { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0 });
  const source = { id: 'existing-tank', x: 50, y: 50, elevationM: 3.35, floorIndex: 0 };
  const guidedRoute = buildGuidedColdWaterHeaderRoute(source, guidedPoint, [{ x: 40, y: 20 }], guidedPoint.id);
  const existing = {
    nodes: [guidedPoint, autoPoint, { ...source, kind: 'source', networkType: 'cold_water', label: "Caixa d'água" }, ...guidedRoute.nodes],
    segments: [...guidedRoute.segments],
  };
  const system = buildColdWaterNetworkFromFixtures([{ ...project.floors[0], walls: [] }], existing);
  // A origem continua sendo a MESMA instância (mesmo id) — nenhum trecho guiado fica órfão.
  const tank = system.nodes.find((node) => node.kind === 'source');
  assert.equal(tank.id, 'existing-tank');
  // O percurso do ponto guiado não foi regenerado: os mesmos nós/segmentos (mesmos ids) continuam lá.
  const guidedNodeIds = guidedRoute.nodes.map((node) => node.id).sort();
  const survivingGuidedNodeIds = system.nodes.filter((node) => node.ownerFixtureId === guidedPoint.id).map((node) => node.id).sort();
  assert.deepEqual(survivingGuidedNodeIds, guidedNodeIds);
  // O ponto SEM percurso guiado recebeu o traçado automático normalmente.
  const autoNodes = system.nodes.filter((node) => node.ownerFixtureId === autoPoint.id);
  assert.ok(autoNodes.length >= 2);
});

test('guided cold-water route follows the waypoints and drops straight down to the fixture', () => {
  const source = { id: 'src', x: 0, y: 0, elevationM: 3.2, floorIndex: 1 };
  const fixture = { id: 'fix', kind: 'fixture', networkType: 'cold_water', label: 'Chuveiro', x: 100, y: 60, elevationM: 2.1, floorIndex: 0 };
  const waypoints = [{ x: 100, y: 0 }];
  const route = buildGuidedColdWaterHeaderRoute(source, fixture, waypoints, 'fix');
  // 1 ponto-guia + 1 nó "acima do ponto" — a fixture em si não é recriada.
  assert.equal(route.nodes.length, 2);
  assert.ok(route.nodes.every((node) => node.ownerFixtureId === 'fix'));
  assert.ok(route.segments.every((segment) => segment.ownerFixtureId === 'fix'));
  const waypointNode = route.nodes.find((node) => node.x === 100 && node.y === 0);
  assert.equal(waypointNode.elevationM, source.elevationM);
  assert.equal(waypointNode.floorIndex, source.floorIndex);
  // Cadeia: origem -> ponto-guia -> acima-do-ponto -> fixture (última queda vertical).
  assert.equal(route.segments.length, 3);
  const last = route.segments[route.segments.length - 1];
  assert.equal(last.endNodeId, 'fix');
});

test('guided cold-water route with no waypoints still drops straight onto the fixture', () => {
  const source = { id: 'src', x: 0, y: 0, elevationM: 3.2 };
  const fixture = { id: 'fix', kind: 'fixture', networkType: 'cold_water', label: 'Torneira', x: 40, y: 0, elevationM: 0.6 };
  const route = buildGuidedColdWaterHeaderRoute(source, fixture, [], 'fix');
  assert.equal(route.nodes.length, 1); // só o "acima do ponto"
  assert.equal(route.segments.length, 2);
});

test('removing a guided route only touches nodes/segments owned by that fixture', () => {
  const kept = { id: 'kept', kind: 'junction', networkType: 'cold_water', label: 'Outro', x: 0, y: 0, elevationM: 3, ownerFixtureId: 'other' };
  const owned = { id: 'owned', kind: 'junction', networkType: 'cold_water', label: 'Meu', x: 1, y: 1, elevationM: 3, ownerFixtureId: 'fix' };
  const keptSegment = { id: 's-kept', networkType: 'cold_water', startNodeId: 'kept', endNodeId: 'kept', diameterMm: 20, ownerFixtureId: 'other' };
  const ownedSegment = { id: 's-owned', networkType: 'cold_water', startNodeId: 'owned', endNodeId: 'owned', diameterMm: 20, ownerFixtureId: 'fix' };
  const result = removeGuidedRouteForFixture({ nodes: [kept, owned], segments: [keptSegment, ownedSegment] }, 'fix');
  assert.deepEqual(result.nodes, [kept]);
  assert.deepEqual(result.segments, [keptSegment]);
});

test('junction classification: two collinear segments read as a straight run', () => {
  const nodes = [
    { id: 'a', kind: 'junction', networkType: 'cold_water', label: 'a', x: 0, y: 0, elevationM: 3 },
    { id: 'mid', kind: 'junction', networkType: 'cold_water', label: 'mid', x: 40, y: 0, elevationM: 3 },
    { id: 'b', kind: 'junction', networkType: 'cold_water', label: 'b', x: 80, y: 0, elevationM: 3 },
  ];
  const segments = [
    { id: 's1', networkType: 'cold_water', startNodeId: 'a', endNodeId: 'mid', diameterMm: 20 },
    { id: 's2', networkType: 'cold_water', startNodeId: 'mid', endNodeId: 'b', diameterMm: 20 },
  ];
  assert.equal(classifyHydraulicJunction({ nodes, segments }, 'mid'), 'straight');
});

test('junction classification: a 90-degree turn is read as elbow90', () => {
  const nodes = [
    { id: 'a', kind: 'junction', networkType: 'cold_water', label: 'a', x: 0, y: 0, elevationM: 3 },
    { id: 'corner', kind: 'junction', networkType: 'cold_water', label: 'corner', x: 40, y: 0, elevationM: 3 },
    { id: 'b', kind: 'junction', networkType: 'cold_water', label: 'b', x: 40, y: 40, elevationM: 3 },
  ];
  const segments = [
    { id: 's1', networkType: 'cold_water', startNodeId: 'a', endNodeId: 'corner', diameterMm: 20 },
    { id: 's2', networkType: 'cold_water', startNodeId: 'corner', endNodeId: 'b', diameterMm: 20 },
  ];
  assert.equal(classifyHydraulicJunction({ nodes, segments }, 'corner'), 'elbow90');
});

test('junction classification: a node with three segments reads as a tee', () => {
  const nodes = [
    { id: 'a', kind: 'junction', networkType: 'cold_water', label: 'a', x: 0, y: 0, elevationM: 3 },
    { id: 'tee', kind: 'junction', networkType: 'cold_water', label: 'tee', x: 40, y: 0, elevationM: 3 },
    { id: 'b', kind: 'junction', networkType: 'cold_water', label: 'b', x: 80, y: 0, elevationM: 3 },
    { id: 'branch', kind: 'junction', networkType: 'cold_water', label: 'branch', x: 40, y: 40, elevationM: 3 },
  ];
  const segments = [
    { id: 's1', networkType: 'cold_water', startNodeId: 'a', endNodeId: 'tee', diameterMm: 20 },
    { id: 's2', networkType: 'cold_water', startNodeId: 'tee', endNodeId: 'b', diameterMm: 20 },
    { id: 's3', networkType: 'cold_water', startNodeId: 'tee', endNodeId: 'branch', diameterMm: 20 },
  ];
  assert.equal(classifyHydraulicJunction({ nodes, segments }, 'tee'), 'tee');
});

test('junction classification: a node with a single segment is an open end', () => {
  const nodes = [
    { id: 'a', kind: 'junction', networkType: 'cold_water', label: 'a', x: 0, y: 0, elevationM: 3 },
    { id: 'end', kind: 'junction', networkType: 'cold_water', label: 'end', x: 40, y: 0, elevationM: 3 },
  ];
  const segments = [{ id: 's1', networkType: 'cold_water', startNodeId: 'a', endNodeId: 'end', diameterMm: 20 }];
  assert.equal(classifyHydraulicJunction({ nodes, segments }, 'end'), 'end');
});

test('reference height hints only cover fixtures with a direct match in the source; the rest stays unset', () => {
  assert.equal(hydraulicFixtureTemplate('shower').referenceHeightM, 2.20);
  assert.ok(hydraulicFixtureTemplate('shower').referenceHeightSource.includes('Tigre'));
  assert.equal(hydraulicFixtureTemplate('bathroom_faucet').referenceHeightM, 0.60);
  assert.equal(hydraulicFixtureTemplate('toilet_supply').referenceHeightM, undefined);
  assert.equal(hydraulicFixtureTemplate('floor_drain').referenceHeightM, undefined);
});

test('wall offsets in meters read the distance to each end of the wall plus the height', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 200, y2: 0 }; // 10m de parede (GRID=20)
  const node = { id: 'n', kind: 'fixture', networkType: 'cold_water', label: 'Ponto', x: 60, y: 0, elevationM: 1.1, placementSurface: 'wall', wallId: 'w' };
  const offsets = hydraulicNodeWallOffsetsMeters(node, wall);
  assert.equal(offsets.fromStartM, 3);
  assert.equal(offsets.fromEndM, 7);
  assert.equal(offsets.heightM, 1.1);
});

test('wall offsets return null for a floor point (it does not belong to a wall)', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 200, y2: 0 };
  const node = { id: 'n', kind: 'fixture', networkType: 'sanitary_sewer', label: 'Ralo', x: 60, y: 0, elevationM: 0.02, placementSurface: 'floor' };
  assert.equal(hydraulicNodeWallOffsetsMeters(node, wall), null);
});

test('wall offset and its inverse round-trip back to the same point', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 0, y2: 300 }; // parede vertical de 15m
  const resolved = hydraulicPositionFromWallOffset(wall, 4.5, 2.1);
  assert.equal(resolved.x, 0);
  assert.equal(resolved.y, 90); // 4,5 m × 20 unidades/m
  assert.equal(resolved.elevationM, 2.1);
  const node = { id: 'n', kind: 'fixture', networkType: 'cold_water', label: 'Ponto', x: resolved.x, y: resolved.y, elevationM: resolved.elevationM, placementSurface: 'wall', wallId: 'w' };
  const offsets = hydraulicNodeWallOffsetsMeters(node, wall);
  assert.equal(offsets.fromStartM, 4.5);
  assert.equal(offsets.heightM, 2.1);
});

test('wall offset from a point beyond the wall clamps to the nearest end', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 200, y2: 0 };
  const resolved = hydraulicPositionFromWallOffset(wall, 999, 1);
  assert.equal(resolved.x, 200); // trava na ponta, nunca passa da parede
});
