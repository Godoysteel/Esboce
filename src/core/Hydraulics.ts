import type { Floor, Furniture, HydraulicNetworkType, HydraulicSystem, Point } from './types.js';

const GRID = 20;
let hydraulicIdSequence = 0;
function nextHydraulicId(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${hydraulicIdSequence++}`; }

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
  return [start.x !== end.x, start.y !== end.y, start.elevationM !== end.elevationM].filter(Boolean).length === 1;
}
