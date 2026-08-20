import type { Floor, Furniture, HydraulicJunctionKind, HydraulicNetworkType, HydraulicNode, HydraulicPlacementSurface, HydraulicSegment, HydraulicSystem, Point, Wall } from './types.js';

const GRID = 20;
const FLOOR_STACK_HEIGHT_M = 2.85;
let hydraulicIdSequence = 0;
export function nextHydraulicId(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${hydraulicIdSequence++}`; }

export interface HydraulicFixtureTemplate {
  key: string;
  label: string;
  shortLabel: string;
  networkType: HydraulicNetworkType;
  placementSurface: HydraulicPlacementSurface;
  elevationM: number;
  diameterMm: number;
  /**
   * Altura USUAL do aparelho (não do ponto em si — a válvula/torneira fica
   * perto disso, mas não obrigatoriamente igual), como referência exibida
   * ao usuário durante o posicionamento. Só preenchido quando existe
   * correspondência direta no levantamento de fonte técnica; deixado de
   * fora quando a fonte não dá pra aplicar sem ambiguidade (H0 §2 — regra de
   * fabricante nunca é apresentada como obrigação).
   */
  referenceHeightM?: number;
  referenceHeightSource?: string;
}

const TIGRE_HEIGHT_SOURCE = 'Manual Técnico Tigre, 7ª ed. (2025) — altura usual do aparelho, não do ponto de água';

export const HYDRAULIC_FIXTURE_TEMPLATES: HydraulicFixtureTemplate[] = [
  { key: 'kitchen_faucet', label: 'Torneira da pia de cozinha', shortLabel: 'Pia cozinha', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.60, diameterMm: 20, referenceHeightM: 1.10, referenceHeightSource: TIGRE_HEIGHT_SOURCE },
  { key: 'bathroom_faucet', label: 'Torneira de lavatório', shortLabel: 'Lavatório', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.60, diameterMm: 20, referenceHeightM: 0.60, referenceHeightSource: TIGRE_HEIGHT_SOURCE },
  { key: 'toilet_supply', label: 'Alimentação do vaso sanitário', shortLabel: 'Água vaso', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.20, diameterMm: 20 },
  { key: 'shower', label: 'Ponto de chuveiro', shortLabel: 'Chuveiro', networkType: 'cold_water', placementSurface: 'wall', elevationM: 2.10, diameterMm: 20, referenceHeightM: 2.20, referenceHeightSource: TIGRE_HEIGHT_SOURCE },
  { key: 'external_faucet', label: 'Torneira externa', shortLabel: 'Torneira ext.', networkType: 'cold_water', placementSurface: 'wall', elevationM: 0.60, diameterMm: 20, referenceHeightM: 0.60, referenceHeightSource: TIGRE_HEIGHT_SOURCE },
  { key: 'kitchen_sink_waste', label: 'Saída da pia de cozinha', shortLabel: 'Esgoto pia', networkType: 'kitchen_sewer', placementSurface: 'wall', elevationM: 0.45, diameterMm: 50 },
  { key: 'bathroom_sink_waste', label: 'Saída do lavatório', shortLabel: 'Esg. lavatório', networkType: 'sanitary_sewer', placementSurface: 'wall', elevationM: 0.45, diameterMm: 40 },
  { key: 'toilet_waste', label: 'Saída do vaso sanitário', shortLabel: 'Esgoto vaso', networkType: 'sanitary_sewer', placementSurface: 'floor', elevationM: 0.02, diameterMm: 100 },
  { key: 'shower_drain', label: 'Ralo do chuveiro', shortLabel: 'Ralo chuveiro', networkType: 'sanitary_sewer', placementSurface: 'floor', elevationM: 0.02, diameterMm: 50 },
  { key: 'floor_drain', label: 'Ralo comum', shortLabel: 'Ralo', networkType: 'sanitary_sewer', placementSurface: 'floor', elevationM: 0.02, diameterMm: 50 },
  // Ponto onde o condutor vertical (prumada pluvial) encontra a parede,
  // perto do beiral — não modelamos a calha em si (elemento linear ao
  // longo do telhado, fora de escopo), só a descida. Diâmetro mínimo de
  // condutor vertical pela linha Aquapluv é 70mm; 75mm é o comercial PVC
  // mais próximo pra cima (Tigre, catálogo técnico pluvial).
  { key: 'rainwater_intake', label: 'Captação de água pluvial', shortLabel: 'Captação pluvial', networkType: 'rainwater', placementSurface: 'wall', elevationM: 2.60, diameterMm: 75 },
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
  })() : { x, y }; // pontos de piso são livres — sem grid, por decisão explícita do Product Owner
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
  return { x, y }; // pontos de piso são livres — sem grid, por decisão explícita do Product Owner
}

/**
 * Cotas locais de um ponto de parede: distância (em metros) até cada uma
 * das duas pontas da parede — que é onde ela normalmente encontra as
 * paredes laterais/transversais — e a altura em relação ao piso. Usado
 * tanto pelo painel de elevação da parede quanto pelas cotas exibidas
 * durante o arraste. Não faz suposição sobre o que existe além da ponta da
 * parede — só devolve a distância até o próprio eixo.
 */
export function hydraulicNodeWallOffsetsMeters(node: HydraulicNode, wall: Wall): { fromStartM: number; fromEndM: number; heightM: number } | null {
  if (node.placementSurface !== 'wall') return null;
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const lengthGrid = Math.hypot(dx, dy) || 1;
  const t = ((node.x - wall.x1) * dx + (node.y - wall.y1) * dy) / (lengthGrid * lengthGrid);
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    fromStartM: (lengthGrid * clampedT) / GRID,
    fromEndM: (lengthGrid * (1 - clampedT)) / GRID,
    heightM: node.elevationM,
  };
}

/**
 * Inverso de `hydraulicNodeWallOffsetsMeters`: dado quanto o usuário
 * arrastou ao longo da parede (em metros, a partir da ponta inicial) e a
 * altura desejada, devolve a posição no eixo do modelo. Usado pelo painel
 * de elevação da parede, onde o usuário arrasta num eixo 1D em vez de
 * clicar no 3D.
 */
export function hydraulicPositionFromWallOffset(wall: Wall, fromStartM: number, heightM: number): { x: number; y: number; elevationM: number } {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const lengthGrid = Math.hypot(dx, dy) || 1;
  const clampedFromStartGrid = Math.max(0, Math.min(lengthGrid, fromStartM * GRID));
  const t = clampedFromStartGrid / lengthGrid;
  return { x: wall.x1 + t * dx, y: wall.y1 + t * dy, elevationM: heightM };
}

/** Mantém o nó técnico no eixo, mas põe seu marcador além da face visível da parede. */
export function hydraulicFixtureVisualPosition(node: HydraulicNode, wall: Wall | undefined, allWalls: Wall[]) {
  if (!wall || node.placementSurface !== 'wall') return { x: node.x, y: node.y };
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const points = allWalls.flatMap((item) => [{ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 }]);
  const center = points.length ? {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  } : { x: node.x, y: node.y };
  const towardCenter = (center.x - node.x) * nx + (center.y - node.y) * ny >= 0 ? 1 : -1;
  const defaultSide = node.fixtureType === 'external_faucet' ? -towardCenter : towardCenter;
  const side = node.wallFaceSide === -1 || node.wallFaceSide === 1 ? node.wallFaceSide : defaultSide;
  // meia parede (1,2 unidade) + raio da esfera (1,4) + pequena folga (0,3)
  const clearance = 2.9;
  return { x: node.x + nx * side * clearance, y: node.y + ny * side * clearance };
}

export type HydraulicEndpointRole = 'source' | 'destination';

/**
 * Núcleo comum do traçado ortogonal "ingênuo" (sem inclinação nenhuma —
 * decisão explícita do Product Owner) — usado tanto pra água fria
 * (`role: 'source'`, ponto fixo elevado, ex. caixa d'água) quanto pra
 * esgoto/pluvial (`role: 'destination'`, ponto fixo no nível do chão,
 * ex. caixa de gordura/inspeção/saída pluvial). Um segmento não tem
 * sentido de fluxo próprio no modelo — só liga dois pontos — então o
 * mesmo formato de cadeia (2 movimentos horizontais na cota do ponto
 * fixo + 1 queda/subida vertical perto da outra ponta) serve pros dois
 * casos, só trocando qual lado é o "fixo".
 *
 * Preserva SEMPRE nós/segmentos de QUALQUER OUTRO networkType intactos.
 * Sem isso, gerar a rede de um tipo (ex. água fria) apagaria a rede já
 * traçada de outro tipo (ex. esgoto) — cada geração reescreve
 * `project.hydraulics` inteiro (ver Store.ts), e antes desta função só
 * existia um tipo de rede pra se preocupar com isso.
 */
function buildOrthogonalNetworkFromFixtures(
  networkType: HydraulicNetworkType,
  endpointRole: HydraulicEndpointRole,
  endpointLabel: string,
  floors: Floor[],
  existing: HydraulicSystem,
): HydraulicSystem {
  const otherNodes = existing.nodes.filter((node) => node.networkType !== networkType);
  const otherSegments = existing.segments.filter((segment) => segment.networkType !== networkType);
  const ownFixtures = existing.nodes.filter((node) => node.kind === 'fixture' && node.networkType === networkType && !!node.fixtureType);
  if (!ownFixtures.length) return { nodes: [...otherNodes, ...ownFixtures], segments: otherSegments };
  const topFloorIndex = Math.max(0, floors.length - 1);
  const allWalls = floors.flatMap((floor) => floor.walls);
  const bounds = allWalls.length ? {
    minX: Math.min(...allWalls.flatMap((wall) => [wall.x1, wall.x2])), maxX: Math.max(...allWalls.flatMap((wall) => [wall.x1, wall.x2])),
    minY: Math.min(...allWalls.flatMap((wall) => [wall.y1, wall.y2])), maxY: Math.max(...allWalls.flatMap((wall) => [wall.y1, wall.y2])),
  } : { minX: -40, maxX: 40, minY: -40, maxY: 40 };
  // O ponto fixo é reaproveitado quando já existe (mesmo id, mesma
  // posição) — sem isso, todo trecho guiado manualmente (H2) que aponte
  // pra ele ficaria órfão a cada vez que essa geração automática rodasse
  // de novo.
  const existingEndpoint = existing.nodes.find((node) => node.kind === endpointRole && node.networkType === networkType);
  const endpoint: HydraulicNode = existingEndpoint || (endpointRole === 'source'
    ? {
        id: nextHydraulicId('hyd-tank'), kind: 'source', networkType, label: endpointLabel,
        x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2,
        elevationM: 3.35, floorIndex: topFloorIndex,
      }
    : {
        // Fora da área construída (bordo leste), pra não nascer em cima
        // da casa — sempre arrastável depois pra onde fizer sentido.
        id: nextHydraulicId('hyd-dest'), kind: 'destination', networkType, label: endpointLabel,
        x: bounds.maxX + GRID, y: (bounds.minY + bounds.maxY) / 2,
        elevationM: 0.05, floorIndex: 0,
      });
  const nodes: HydraulicNode[] = [...otherNodes, ...ownFixtures, endpoint];
  const segments: HydraulicSegment[] = [...otherSegments];
  const endpointFloor = endpoint.floorIndex || 0;
  ownFixtures.forEach((fixture) => {
    // Um percurso guiado manualmente (H2, ownerFixtureId + guided: true)
    // nunca é sobrescrito pela geração automática — só os pontos ainda sem
    // percurso próprio (ou com percurso INGÊNUO de uma geração anterior,
    // sem a flag `guided`) recebem o traçado ingênuo abaixo, recalculado
    // do zero. Sem o filtro por `guided` aqui, o traçado ingênuo de uma
    // fixture já roteada uma vez nunca mais seria regerado — inclusive ao
    // mover o ponto fixo (caixa d'água / caixa de gordura) ou a própria
    // fixture, os canos ficariam presos na posição antiga da primeira
    // geração.
    const guidedNodes = existing.nodes.filter((node) => node.ownerFixtureId === fixture.id && node.guided);
    const guidedSegments = existing.segments.filter((segment) => segment.ownerFixtureId === fixture.id && segment.guided);
    if (guidedNodes.length || guidedSegments.length) {
      nodes.push(...guidedNodes);
      segments.push(...guidedSegments);
      return;
    }
    const fixtureFloor = fixture.floorIndex || 0;
    const ownerFixtureId = fixture.id;
    const legA: HydraulicNode = {
      id: nextHydraulicId('hyd-junction'), kind: 'junction', networkType,
      label: endpointRole === 'source' ? 'Distribuição superior' : 'Saída do ponto',
      x: fixture.x, y: endpoint.y, elevationM: endpoint.elevationM, floorIndex: endpointFloor, ownerFixtureId,
    };
    const legB: HydraulicNode = {
      id: nextHydraulicId('hyd-junction'), kind: 'junction', networkType,
      label: endpointRole === 'source' ? 'Descida do ponto' : 'Chegada na caixa',
      x: fixture.x, y: fixture.y, elevationM: endpoint.elevationM, floorIndex: endpointFloor, ownerFixtureId,
    };
    const nearFixture: HydraulicNode = {
      id: nextHydraulicId('hyd-junction'), kind: 'junction', networkType,
      label: endpointRole === 'source' ? 'Base da descida' : 'Saída da tubulação',
      x: fixture.x, y: fixture.y, elevationM: fixture.elevationM, floorIndex: fixtureFloor, ownerFixtureId,
    };
    nodes.push(legA, legB, nearFixture);
    const diameterMm = endpointRole === 'source' ? 20 : (hydraulicFixtureTemplate(fixture.fixtureType!)?.diameterMm || 50);
    [[endpoint, legA], [legA, legB], [legB, nearFixture], [nearFixture, fixture]].forEach(([start, end]) => {
      var startGlobal = (start!.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + start!.elevationM;
      var endGlobal = (end!.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + end!.elevationM;
      if (start!.x !== end!.x || start!.y !== end!.y || startGlobal !== endGlobal) {
        segments.push({ id: nextHydraulicId('hyd-segment'), networkType, startNodeId: start!.id, endNodeId: end!.id, diameterMm, ownerFixtureId });
      }
    });
  });
  return { nodes, segments };
}

export function buildColdWaterNetworkFromFixtures(floors: Floor[], existing: HydraulicSystem): HydraulicSystem {
  return buildOrthogonalNetworkFromFixtures('cold_water', 'source', "Caixa d'água", floors, existing);
}

const DESTINATION_LABELS: Partial<Record<HydraulicNetworkType, string>> = {
  kitchen_sewer: 'Caixa de gordura',
  sanitary_sewer: 'Caixa de inspeção',
  rainwater: 'Caixa de saída pluvial',
};

/**
 * Equivalente de `buildColdWaterNetworkFromFixtures` pra redes com ponto
 * fixo no chão (esgoto de cozinha, esgoto sanitário, pluvial) em vez de
 * elevado — mesmo traçado ortogonal sem inclinação, mesmo mecanismo de
 * preservar percurso guiado (H2) e ponto fixo já existente.
 */
export function buildDestinationNetworkFromFixtures(networkType: HydraulicNetworkType, floors: Floor[], existing: HydraulicSystem): HydraulicSystem {
  return buildOrthogonalNetworkFromFixtures(networkType, 'destination', DESTINATION_LABELS[networkType] || 'Caixa de saída', floors, existing);
}

export function destinationLabelForNetwork(networkType: HydraulicNetworkType): string {
  return DESTINATION_LABELS[networkType] || 'Caixa de saída';
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

/**
 * H2 — percurso guiado de água fria (SPEC-002 §5: "o usuário definirá pontos
 * intermediários e o Esboce completará os trechos e conexões").
 *
 * Constrói a rede de um único ponto de água fria a partir de uma lista de
 * pontos-guia desenhados pelo usuário no plano horizontal (mesma cota da
 * origem). A queda vertical até o ponto de consumo continua automática,
 * como já era no traçado ingênuo — só o trajeto horizontal passa a ser
 * manual. Função pura: não lê nem grava em nenhum estado global.
 */
/**
 * Generalização de H2 (ver `buildGuidedColdWaterHeaderRoute` abaixo, que
 * agora é um atalho pra esta função com `role: 'source'`) — funciona
 * tanto pro ponto fixo elevado (água fria) quanto pro ponto fixo no chão
 * (esgoto/pluvial): o usuário desenha o trecho horizontal (pontos-guia)
 * na cota do PONTO FIXO; a queda/subida final até a fixture continua
 * automática, como já era no traçado ingênuo.
 */
export function buildGuidedHydraulicRoute(
  networkType: HydraulicNetworkType,
  endpointRole: HydraulicEndpointRole,
  endpoint: { id: string; x: number; y: number; elevationM: number; floorIndex?: number },
  fixture: HydraulicNode,
  waypoints: Point[],
  ownerFixtureId: string,
): HydraulicSystem {
  const planPoints: Point[] = [{ x: endpoint.x, y: endpoint.y }, ...waypoints, { x: fixture.x, y: fixture.y }];
  const nodes: HydraulicNode[] = [];
  const segments: HydraulicSegment[] = [];
  const planNodeIds: string[] = [];
  planPoints.forEach((point, index) => {
    if (index === 0 || index === planPoints.length - 1) return; // ponto fixo e "acima/na cota do ponto" tratados à parte
    const node: HydraulicNode = {
      id: nextHydraulicId('hyd-waypoint'), kind: 'junction', networkType,
      label: 'Ponto-guia', x: point.x, y: point.y, elevationM: endpoint.elevationM,
      ownerFixtureId, guided: true, ...(endpoint.floorIndex != null ? { floorIndex: endpoint.floorIndex } : {}),
    };
    nodes.push(node);
    planNodeIds.push(node.id);
  });
  const aboveFixture: HydraulicNode = {
    id: nextHydraulicId('hyd-waypoint'), kind: 'junction', networkType,
    label: endpointRole === 'source' ? 'Descida do ponto' : 'Chegada na caixa',
    x: fixture.x, y: fixture.y, elevationM: endpoint.elevationM,
    ownerFixtureId, guided: true, ...(endpoint.floorIndex != null ? { floorIndex: endpoint.floorIndex } : {}),
  };
  nodes.push(aboveFixture);
  type ChainPoint = { id: string; x: number; y: number; floorIndex?: number; elevationM: number };
  const chain: ChainPoint[] = [
    { id: endpoint.id, x: endpoint.x, y: endpoint.y, elevationM: endpoint.elevationM, ...(endpoint.floorIndex != null ? { floorIndex: endpoint.floorIndex } : {}) },
    ...planNodeIds.map((id, i): ChainPoint => {
      const waypoint = waypoints[i]!;
      return { id, x: waypoint.x, y: waypoint.y, elevationM: endpoint.elevationM, ...(endpoint.floorIndex != null ? { floorIndex: endpoint.floorIndex } : {}) };
    }),
    { id: aboveFixture.id, x: fixture.x, y: fixture.y, elevationM: endpoint.elevationM, ...(endpoint.floorIndex != null ? { floorIndex: endpoint.floorIndex } : {}) },
    { id: fixture.id, x: fixture.x, y: fixture.y, elevationM: fixture.elevationM, ...(fixture.floorIndex != null ? { floorIndex: fixture.floorIndex } : {}) },
  ];
  const diameterMm = endpointRole === 'source' ? 20 : (hydraulicFixtureTemplate(fixture.fixtureType!)?.diameterMm || 50);
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]!, b = chain[i + 1]!;
    const aGlobal = (a.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + a.elevationM;
    const bGlobal = (b.floorIndex || 0) * FLOOR_STACK_HEIGHT_M + b.elevationM;
    if (a.x === b.x && a.y === b.y && aGlobal === bGlobal) continue; // sem trecho de comprimento zero
    segments.push({ id: nextHydraulicId('hyd-segment'), networkType, startNodeId: a.id, endNodeId: b.id, diameterMm, ownerFixtureId, guided: true });
  }
  return { nodes, segments };
}

export function buildGuidedColdWaterHeaderRoute(
  source: { id: string; x: number; y: number; elevationM: number; floorIndex?: number },
  fixture: HydraulicNode,
  waypoints: Point[],
  ownerFixtureId: string,
): HydraulicSystem {
  return buildGuidedHydraulicRoute('cold_water', 'source', source, fixture, waypoints, ownerFixtureId);
}

/**
 * Remove de `system` todo nó/segmento pertencente ao percurso guiado de uma
 * `fixture` específica (identificados por `ownerFixtureId`), preservando o
 * restante da rede intacto — inclusive a própria `fixture` e a origem
 * compartilhada. Usado para redesenhar o percurso de um ponto sem afetar os
 * demais pontos já roteados.
 */
export function removeGuidedRouteForFixture(system: HydraulicSystem, fixtureId: string): HydraulicSystem {
  return {
    nodes: system.nodes.filter((node) => node.ownerFixtureId !== fixtureId),
    segments: system.segments.filter((segment) => segment.ownerFixtureId !== fixtureId),
  };
}

/**
 * Classifica o tipo de conexão que um nó exige, olhando só a geometria dos
 * trechos que se encontram nele — sem depender de nenhuma tabela normativa
 * (a própria SPEC-002 §3 descreve cotovelos e tês como "representações do
 * modelo lógico", derivadas da rede, não dado próprio). Serve de base para o
 * quantitativo (H6) e para a renderização futura de conexões distintas por
 * tipo; hoje o Scene3DRenderer ainda desenha todo nó como o mesmo marcador
 * genérico, o que é intencional nesta fase (modelo representativo, não
 * catálogo de peça real).
 */
export function classifyHydraulicJunction(system: HydraulicSystem, nodeId: string): HydraulicJunctionKind {
  const touching = system.segments.filter((segment) => segment.startNodeId === nodeId || segment.endNodeId === nodeId);
  if (touching.length === 0) return 'end';
  if (touching.length >= 4) return 'cross';
  if (touching.length === 3) return 'tee';
  if (touching.length === 1) return 'end';
  const nodesById = new Map(system.nodes.map((node) => [node.id, node]));
  const self = nodesById.get(nodeId);
  if (!self) return 'end';
  const directions = touching.map((segment) => {
    const otherId = segment.startNodeId === nodeId ? segment.endNodeId : segment.startNodeId;
    const other = nodesById.get(otherId);
    if (!other) return { x: 0, y: 0, z: 0 };
    const dx = other.x - self.x, dy = other.y - self.y;
    const dz = ((other.floorIndex || 0) - (self.floorIndex || 0)) * 1000 + (other.elevationM - self.elevationM);
    const length = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / length, y: dy / length, z: dz / length };
  });
  const d1 = directions[0]!, d2 = directions[1]!;
  const dot = Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y + d1.z * d2.z));
  const angleDeg = Math.acos(dot) * 180 / Math.PI;
  // O ângulo entre os vetores "saindo do nó" é o suplementar do ângulo de curva do cano:
  // trecho reto → vetores opostos (180°); cotovelo de 90° → vetores a 90°; de 45° → vetores a 135°.
  if (angleDeg > 170) return 'straight';
  if (angleDeg > 100) return 'elbow45';
  return 'elbow90';
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