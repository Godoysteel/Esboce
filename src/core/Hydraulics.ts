import type { Floor, HydraulicSystem, Point } from './types.js';

const GRID = 20;
let hydraulicIdSequence = 0;
function nextHydraulicId(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${hydraulicIdSequence++}`; }

const KITCHEN_FIXTURE_PRODUCT_IDS = new Set([
  'vortice.movel.armario-cozinha',
]);

function floorBounds(floor: Floor) {
  const points: Point[] = floor.walls.flatMap((wall) => [
    { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 },
  ]);
  if (!points.length) return { minX: -40, maxX: 40, minY: -30, maxY: 30 };
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function findKitchenFixturePoint(floor: Floor): Point | null {
  const fixture = floor.furniture.find((item) => KITCHEN_FIXTURE_PRODUCT_IDS.has(item.productId));
  return fixture ? { x: fixture.x, y: fixture.y } : null;
}

/**
 * Primeira rota funcional H1: caixa d'água -> ramal superior -> prumada
 * -> ramal baixo -> ponto provisório da cozinha. Cada trecho varia em um
 * único eixo, portanto a geometria nunca corta o ambiente em diagonal.
 */
export function buildColdWaterKitchenPrototype(floor: Floor): HydraulicSystem {
  const bounds = floorBounds(floor);
  const fixture = findKitchenFixturePoint(floor) || {
    x: bounds.maxX - GRID * 0.5,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const sourceX = bounds.minX + GRID * 0.35;
  const sourceY = bounds.minY + GRID * 0.35;
  const routeY = fixture.y;
  const sourceId = nextHydraulicId('hyd-node');
  const headerId = nextHydraulicId('hyd-node');
  const riserBaseId = nextHydraulicId('hyd-node');
  const branchId = nextHydraulicId('hyd-node');
  const fixtureId = nextHydraulicId('hyd-node');
  return {
    nodes: [
      { id: sourceId, kind: 'source', networkType: 'cold_water', label: "Saída da caixa d'água", x: sourceX, y: sourceY, elevationM: 3.2 },
      { id: headerId, kind: 'junction', networkType: 'cold_water', label: 'Entrada da prumada', x: sourceX, y: routeY, elevationM: 3.2 },
      { id: riserBaseId, kind: 'junction', networkType: 'cold_water', label: 'Base da prumada', x: sourceX, y: routeY, elevationM: 0.35 },
      { id: branchId, kind: 'junction', networkType: 'cold_water', label: 'Ramal da cozinha', x: fixture.x, y: routeY, elevationM: 0.35 },
      { id: fixtureId, kind: 'fixture', networkType: 'cold_water', label: 'Ponto provisório da pia', x: fixture.x, y: fixture.y, elevationM: 1.1 },
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
  const changedAxes = [start.x !== end.x, start.y !== end.y, start.elevationM !== end.elevationM].filter(Boolean).length;
  return changedAxes === 1;
}
