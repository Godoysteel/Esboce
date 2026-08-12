import type { Floor, Furniture, HydraulicNetworkType, HydraulicNode, HydraulicPlacementSurface, HydraulicSystem, Point, Wall } from './types.js';

const GRID = 20;
const FLOOR_STACK_HEIGHT_M = 2.85;
let hydraulicIdSequence = 0;
function nextHydraulicId(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${hydraulicIdSequence++}`; }

export interface HydraulicFixtureTemplate {
  key: string;
  label: string;
  shortLabel: string;
  networkType: HydraulicNetworkType;
  placementSurface: HydraulicPlacementSurface;
  elevationM: number;
  diameterMm: number;
}

export const HYDRAULIC_FIXTURE_TEMPLATES: HydraulicFixtureTemplate[] = [
  { key: 'kitchen_faucet', label: 'Torneira da pia de cozinha', shortLabel: 'Pia cozinha', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.60, diameterMm: 20 },
  { key: 'bathroom_faucet', label: 'Torneira de lavatório', shortLabel: 'Lavatório', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.60, diameterMm: 20 },
  { key: 'toilet_supply', label: 'Alimentação do vaso sanitário', shortLabel: 'Água vaso', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.20, diameterMm: 20 },
  { key: 'shower', label: 'Ponto de chuveiro', shortLabel: 'Chuveiro', networkType: 'cold_water', placementSurface: 'wall', elevationM: 2.10, diameterMm: 20 },
  { key: 'external_faucet', label: 'Torneira externa', shortLabel: 'Torneira ext.', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.60, diameterMm: 20 },
  { key: 'kitchen_sink_waste', label: 'Saída da pia de cozinha', shortLabel: 'Esgoto pia', networkType: 'kitchen_sewer', placementSurface: 'wall', elevationM: 0.45, diameterMm: 50 },
  { key: 'bathroom_sink_waste', label: 'Saída do lavatório', shortLabel: 'Esg. lavatório', networkType: 'sanitary_sewer', placementSurface: 'wall', elevationM: 0.45, diameterMm: 40 },
  { key: 'toilet_waste', label: 'Saída do vaso sanitário', shortLabel: 'Esgoto vaso', networkType: 'sanitary_sewer', placementSurface: 'floor', elevationM: 0.02, diameterMm: 100 },
  { key: 'shower_drain', label: 'Ralo do chuveiro', shortLabel: 'Ralo chuveiro', networkType: 'sanitary_sewer', placementSurface: 'floor', elevationM: 0.02, diameterMm: 50 },
  { key: 'floor_drain', label: 'Ralo comum', shortLabel: 'Ralo', networkType: 'sanitary_sewer', placementSurface: 'floor', elevationM: 0.02, diameterMm: 50 },
];

export function hydraulicFixtureTemplate(key: string): HydraulicFixtureTemplate | null {
  return HYDRAULIC_FIXTURE_TEMPLATES.find((template) => template.key === key) || null;
}

export function createPositionedHydraulicFixture(templateKey: string, x: number, y: number, wall?: Wall): HydraulicNode | null {
  const template = hydraulicFixtureTemplate(templateKey);
  if (!template) return null;
  if (template.placementSurface === 'wall' && !wall) return null;
  const snapped = wall ? (() => {
    const point = projectOnWall(x, y, wall);
    return { x: point.x, y: point.y };
  })() : { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID };
  return {
    id: nextHydraulicId('hyd-node'), kind: 'fixture' as const,
    networkType: template.networkType, label: template.label,
    x: snapped.x, y: snapped.y, elevationM: template.elevationM,
    fixtureType: template.key, placementSurface: template.placementSurface,
    ...(wall ? { wallId: wall.id } : {}),
  };
}

function projectOnWall(x: number, y: number, wall: Wall) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / lengthSquared));
  return { x: wall.x1 + t * dx, y: wall.y1 + t * dy };
}

export function resolveHydraulicFixturePosition(node: HydraulicNode, x: number, y: number, wall?: Wall) {
  if (node.placementSurface === 'wall') {
    if (!wall || wall.id !== node.wallId) return { x: node.x, y: node.y };
    return projectOnWall(x, y, wall);
  }
  return { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID };
}

export function buildColdWaterNetworkFromFixtures(floors: Floor[], existing: HydraulicSystem): HydraulicSystem {
  const fixtures = existing.nodes.filter((node) => node.kind === 'fixture' && !!node.fixtureType);
  const waterFixtures = fixtures.filter((node) => node.networkType === 'cold_water');
  if (!waterFixtures.length) return { nodes: fixtures, segments: [] };
  const topFloorIndex = Math.max(0, floors.length - 1);
  const allWalls = floors.flatMap((floor) => floor.walls);
  const bounds = allWalls.length ? {
    minX: Math.min(...allWalls.flatMap((wall) => [wall.x1, wall.x2])), maxX: Math.max(...allWalls.flatMap((wall) => [wall.x1, wall.x2])),
    minY: Math.min(...allWalls.flatMap((wall) => [wall.y1, wall.y2])), maxY: Math.max(...allWalls.flatMap((wall) => [wall.y1, wall.y2])),
  } : { minX: -40, maxX: 40, minY: -40, maxY: 40 };
  const source: HydraulicNode = {
    id: nextHydraulicId('hyd-tank'), kind: 'source', networkType: 'cold_water', label: "Caixa d'água",
    x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2,
    elevationM: 3.35, floorIndex: topFloorIndex,
  };
  const nodes: HydraulicNode[] = [...fixtures, source];
  const segments: HydraulicSystem['segments'] = [];
  waterFixtures.forEach((fixture) => {
    const fixtureFloor = fixture.floorIndex || 0;
    const horizontalA: HydraulicNode = {
      id: nextHydraulicId('hyd-junction'), kind: 'junction', networkType: 'cold_water', label: 'Distribuição superior',
      x: fixture.x, y: source.y, elevationM: source.elevationM, floorIndex: topFloorIndex,
    };
    const horizontalB: HydraulicNode = {
      id: nextHydraulicId('hyd-junction'), kind: 'junction', networkType: 'cold_water', label: 'Descida do ponto',
      x: fixture.x, y: fixture.y, elevationM: source.elevationM, floorIndex: topFloorIndex,
    };
    const verticalBase: HydraulicNode = {
      id: nextHydraulicId('hyd-junction'), kind: 'junction', networkType: 'cold_water', label: 'Base da descida',
      x: fixture.x, y: fixture.y, elevationM: fixture.elevationM, floorIndex: fixtureFloor,
    };
    nodes.push(horizontalA, horizontalB, verticalBase);
    [[source, horizontalA], [horizontalA, horizontalB], [horizontalB, verticalBase], [verticalBase, fixture]].forEach(([start, end]) => {
      var startGlobal = (start!.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + start!.elevationM;
      var endGlobal = (end!.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + end!.elevationM;
      if (start!.x !== end!.x || start!.y !== end!.y || startGlobal !== endGlobal) {
        segments.push({ id: nextHydraulicId('hyd-segment'), networkType: 'cold_water', startNodeId: start!.id, endNodeId: end!.id, diameterMm: 20 });
      }
    });
  });
  return { nodes, segments };
}

export interface EquipmentConnectorTemplate {
  key: string;
  label: string;
  networkType: HydraulicNetworkType;
  diameterMm: number;
  offsetXM: number;
  offsetYM: number;
  elevationM: number;
}

export interface HydraulicEquipmentTemplate {
  key: string;
  productIds: string[];
  connectors: EquipmentConnectorTemplate[];
}

export const HYDRAULIC_EQUIPMENT_TEMPLATES: HydraulicEquipmentTemplate[] = [{
  key: 'kitchen_sink_generic',
  productIds: ['vortice.movel.armario-cozinha'],
  connectors: [{
    key: 'cold_water_inlet', label: 'Água fria da pia', networkType: 'cold_water',
    diameterMm: 20, offsetXM: 0, offsetYM: -0.32, elevationM: 0.6,
  }],
}];

export function equipmentTemplateForProduct(productId: string): HydraulicEquipmentTemplate | null {
  return HYDRAULIC_EQUIPMENT_TEMPLATES.find((template) => template.productIds.includes(productId)) || null;
}

export function resolveEquipmentConnector(furniture: Furniture, connectorKey: string) {
  const template = equipmentTemplateForProduct(furniture.productId);
  const connector = template?.connectors.find((item) => item.key === connectorKey);
  if (!template || !connector) return null;
  const angle = (furniture.rotationDeg || 0) * Math.PI / 180;
  const localX = connector.offsetXM * GRID, localY = connector.offsetYM * GRID;
  return {
    template, connector,
    x: furniture.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: furniture.y + localX * Math.sin(angle) + localY * Math.cos(angle),
    elevationM: connector.elevationM + (furniture.elevationM || 0),
  };
}

function floorBounds(floor: Floor) {
  const points: Point[] = floor.walls.flatMap((wall) => [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]);
  if (!points.length) return { minX: -40, maxX: 40, minY: -30, maxY: 30 };
  return {
    minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)), maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function findKitchenFixturePoint(floor: Floor) {
  const fixture = floor.furniture.find((item) => equipmentTemplateForProduct(item.productId)?.key === 'kitchen_sink_generic');
  if (!fixture) return null;
  const resolved = resolveEquipmentConnector(fixture, 'cold_water_inlet');
  return resolved ? { ...resolved, equipmentId: fixture.id } : null;
}

export function buildColdWaterKitchenPrototype(floor: Floor): HydraulicSystem {
  const bounds = floorBounds(floor);
  const fixture = findKitchenFixturePoint(floor) || {
    x: bounds.maxX - GRID * 0.5, y: (bounds.minY + bounds.maxY) / 2,
    elevationM: 0.6, equipmentId: undefined,
  };
  const sourceX = bounds.minX + GRID * 0.35;
  const sourceY = bounds.minY + GRID * 0.35;
  const routeY = fixture.y;
  const sourceId = nextHydraulicId('hyd-node'), headerId = nextHydraulicId('hyd-node');
  const riserBaseId = nextHydraulicId('hyd-node'), branchId = nextHydraulicId('hyd-node');
  const fixtureId = nextHydraulicId('hyd-node');
  return {
    nodes: [
      { id: sourceId, kind: 'source', networkType: 'cold_water', label: "Saída da caixa d'água", x: sourceX, y: sourceY, elevationM: 3.2 },
      { id: headerId, kind: 'junction', networkType: 'cold_water', label: 'Entrada da prumada', x: sourceX, y: routeY, elevationM: 3.2 },
      { id: riserBaseId, kind: 'junction', networkType: 'cold_water', label: 'Base da prumada', x: sourceX, y: routeY, elevationM: 0.35 },
      { id: branchId, kind: 'junction', networkType: 'cold_water', label: 'Ramal da cozinha', x: fixture.x, y: routeY, elevationM: 0.35 },
      { id: fixtureId, kind: 'fixture', networkType: 'cold_water', label: 'Conector técnico da pia', x: fixture.x, y: fixture.y, elevationM: fixture.elevationM, ...(fixture.equipmentId ? { equipmentId: fixture.equipmentId, connectorKey: 'cold_water_inlet' } : {}) },
    ],
    segments: [
      { id: nextHydraulicId('hyd-segment'), networkType: 'cold_water', startNodeId: sourceId, endNodeId: headerId, diameterMm: 25 },
      { id: nextHydraulicId('hyd-segment'), networkType: 'cold_water', startNodeId: headerId, endNodeId: riserBaseId, diameterMm: 25 },
      { id: nextHydraulicId('hyd-segment'), networkType: 'cold_water', startNodeId: riserBaseId, endNodeId: branchId, diameterMm: 20 },
      { id: nextHydraulicId('hyd-segment'), networkType: 'cold_water', startNodeId: branchId, endNodeId: fixtureId, diameterMm: 20 },
    ],
  };
}

export function segmentIsOrthogonal3D(system: HydraulicSystem, segmentId: string): boolean {
  const segment = system.segments.find((item) => item.id === segmentId);
  if (!segment) return false;
  const start = system.nodes.find((node) => node.id === segment.startNodeId);
  const end = system.nodes.find((node) => node.id === segment.endNodeId);
  if (!start || !end) return false;
  const startGlobalElevation = (start.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + start.elevationM;
  const endGlobalElevation = (end.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + end.elevationM;
  return [start.x !== end.x, start.y !== end.y, startGlobalElevation !== endGlobalElevation].filter(Boolean).length === 1;
}
