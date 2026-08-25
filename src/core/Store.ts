// Store — estado da aplicação (projeto atual), comandos que o alteram, e
// undo. Migrado de `var Store = (function () {...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 1606-2299). Lógica preservada linha a linha; só tipos adicionados e
// var/function trocados por const/arrow onde natural.

import { Core } from './Core.js';
import { buildColdWaterKitchenPrototype, buildColdWaterNetworkFromFixtures, buildDestinationNetworkFromFixtures, buildGuidedHydraulicRoute, createPositionedHydraulicFixture, destinationLabelForNetwork, hydraulicFixtureVisualPosition, nextHydraulicId, removeGuidedRouteForFixture, resolveHydraulicFixturePosition, type HydraulicEndpointRole } from './Hydraulics.js';
import type {
  Project, Floor, Wall, Column, Roof, Opening, OpeningKind, Varanda, Laje, Furniture, ColumnShape, RoofType,
  RidgeAxis, VarandaFrontSide, FoundationType, StoreEvent, StoreListener, ForroBoardType,
  WallSnapshot, LinkedWallUpdate, GlazingPanel, GlazingGlassMaterial, BalconyRailing, VolumeBox, Stair, StairModel, PlanUnderlay, Terreno, TerrenoMuroSide, CommercialSelection,
  HydraulicNetworkType, HydraulicNode, HydraulicSegment,
} from './types.js';

let project: Project = Core.createProject();
const listeners: StoreListener[] = [];
const events: StoreEvent[] = [];
const undoStack: Project[] = [];
const UNDO_LIMIT = 50;

function emit(event: StoreEvent): void {
  events.push(event);
  listeners.forEach((fn) => fn(event, project));
}

export function onChange(fn: StoreListener): void {
  listeners.push(fn);
}

function pushUndoSnapshot(): void {
  undoStack.push(JSON.parse(JSON.stringify(project)));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function autoComposeCurrentRoofs(): string[][] {
  const roofs = currentRoofs();
  const visited = new Set<string>();
  const groups: string[][] = [];
  roofs.forEach((start) => {
    if (visited.has(start.id)) return;
    const queue = [start];
    const component: Roof[] = [];
    visited.add(start.id);
    while (queue.length) {
      const roof = queue.shift()!;
      component.push(roof);
      roofs.forEach((candidate) => {
        if (visited.has(candidate.id) || candidate.ridgeAxis === roof.ridgeAxis) return;
        if (!Core.rectsNearby(roof, candidate, Core.SNAP_UNIT)) return;
        visited.add(candidate.id);
        queue.push(candidate);
      });
    }
    if (component.length < 2) {
      delete component[0]!.compoundGroupId;
      return;
    }
    const groupId = component.find((roof) => roof.compoundGroupId)?.compoundGroupId || Core.nextId('roof-group');
    component.forEach((roof) => { roof.compoundGroupId = groupId; });
    groups.push(component.map((roof) => roof.id));
  });
  return groups;
}

// Maior X entre toda entidade de todo pavimento — usado como eixo
// padrão de espelho em duplicateEntireConstructionMirrored, pra cópia
// nascer encostada na borda direita da construção original.
function computeConstructionBoundsX(): number {
  let maxX = -Infinity;
  const consider = (x: number) => { if (x > maxX) maxX = x; };
  project.floors.forEach((f) => {
    f.walls.forEach((w) => { consider(w.x1); consider(w.x2); });
    f.columns.forEach((c) => consider(c.x));
    f.roofs.forEach((r) => { consider(r.x1); consider(r.x2); });
    f.varandas.forEach((v) => { consider(v.x1); consider(v.x2); });
    f.lajes.forEach((l) => l.points.forEach((p) => consider(p.x)));
    f.furniture.forEach((it) => consider(it.x));
    f.glazingPanels.forEach((g) => { if (g.state === 'preview' && g.x != null) consider(g.x); });
    f.balconyRailings.forEach((b) => consider(b.x));
    f.volumeBoxes.forEach((v) => consider(v.x));
    f.stairs.forEach((s) => consider(s.x));
  });
  return maxX === -Infinity ? 0 : maxX;
}

export function currentFloor(): Floor {
  return project.floors[project.currentFloorIndex]!;
}
export function currentWalls(): Wall[] { return currentFloor().walls; }
export function currentColumns(): Column[] {
  const f = currentFloor();
  if (!f.columns) f.columns = [];
  return f.columns;
}
export function currentRoofs(): Roof[] {
  const f = currentFloor();
  if (!f.roofs) f.roofs = [];
  return f.roofs;
}
export function currentOpenings(): Opening[] {
  const f = currentFloor();
  if (!f.openings) f.openings = [];
  return f.openings;
}
export function currentVarandas(): Varanda[] {
  const f = currentFloor();
  if (!f.varandas) f.varandas = [];
  return f.varandas;
}
export function currentLajes(): Laje[] {
  const f = currentFloor();
  if (!f.lajes) f.lajes = [];
  return f.lajes;
}
export function lajesOfFloor(floor: Floor): Laje[] {
  if (!floor.lajes) floor.lajes = [];
  return floor.lajes;
}

export function currentGlazingPanels(): GlazingPanel[] {
  const f = currentFloor();
  if (!f.glazingPanels) f.glazingPanels = [];
  return f.glazingPanels;
}
export function glazingPanelsOfFloor(floor: Floor): GlazingPanel[] {
  if (!floor.glazingPanels) floor.glazingPanels = [];
  return floor.glazingPanels;
}
export function findWall(id: string): Wall | null {
  const walls = currentWalls();
  for (let i = 0; i < walls.length; i++) if (walls[i]!.id === id) return walls[i]!;
  return null;
}
export function findColumn(id: string): Column | null {
  const columns = currentColumns();
  for (let i = 0; i < columns.length; i++) if (columns[i]!.id === id) return columns[i]!;
  return null;
}
export function findRoof(id: string): Roof | null {
  const roofs = currentRoofs();
  for (let i = 0; i < roofs.length; i++) if (roofs[i]!.id === id) return roofs[i]!;
  return null;
}
export function findOpening(id: string): Opening | null {
  const openings = currentOpenings();
  for (let i = 0; i < openings.length; i++) if (openings[i]!.id === id) return openings[i]!;
  return null;
}
function generatedAtticRoofForWall(wallId: string): Roof | null {
  return currentRoofs().find((roof) => roof.atticMode === 'generated' && (roof.atticWallIds || []).includes(wallId)) || null;
}
function openingFitsCurrentRoof(wall: Wall, opening: Opening): boolean {
  const roof = generatedAtticRoofForWall(wall.id);
  return !roof || Core.openingFitsAtticRoof(wall, roof, opening);
}
export function findVaranda(id: string): Varanda | null {
  const varandas = currentVarandas();
  for (let i = 0; i < varandas.length; i++) if (varandas[i]!.id === id) return varandas[i]!;
  return null;
}
export function findLaje(id: string): Laje | null {
  const lajes = currentLajes();
  for (let i = 0; i < lajes.length; i++) if (lajes[i]!.id === id) return lajes[i]!;
  return null;
}

export function findGlazingPanel(id: string): GlazingPanel | null {
  const panels = currentGlazingPanels();
  for (let i = 0; i < panels.length; i++) if (panels[i]!.id === id) return panels[i]!;
  return null;
}

export function currentBalconyRailings(): BalconyRailing[] {
  const f = currentFloor();
  if (!f.balconyRailings) f.balconyRailings = [];
  return f.balconyRailings;
}
export function balconyRailingsOfFloor(floor: Floor): BalconyRailing[] {
  if (!floor.balconyRailings) floor.balconyRailings = [];
  return floor.balconyRailings;
}
export function findBalconyRailing(id: string): BalconyRailing | null {
  const list = currentBalconyRailings();
  for (let i = 0; i < list.length; i++) if (list[i]!.id === id) return list[i]!;
  return null;
}

export function currentVolumeBoxes(): VolumeBox[] {
  const f = currentFloor();
  if (!f.volumeBoxes) f.volumeBoxes = [];
  return f.volumeBoxes;
}
export function volumeBoxesOfFloor(floor: Floor): VolumeBox[] {
  if (!floor.volumeBoxes) floor.volumeBoxes = [];
  return floor.volumeBoxes;
}
export function findVolumeBox(id: string): VolumeBox | null {
  const boxes = currentVolumeBoxes();
  for (let i = 0; i < boxes.length; i++) if (boxes[i]!.id === id) return boxes[i]!;
  return null;
}
export function currentStairs(): Stair[] {
  const f = currentFloor();
  if (!f.stairs) f.stairs = [];
  return f.stairs;
}
export function findStair(id: string): Stair | null {
  const stairs = currentStairs();
  for (let i = 0; i < stairs.length; i++) if (stairs[i]!.id === id) return stairs[i]!;
  return null;
}
// Planta baixa importada — uma por pavimento (não lista), por isso
// getter simples em vez do padrão current*/find* das entidades acima.
export function currentPlanUnderlay(): PlanUnderlay | null {
  return currentFloor().planUnderlay || null;
}
export function currentFurniture(): Furniture[] {
  const f = currentFloor();
  if (!f.furniture) f.furniture = [];
  return f.furniture;
}
export function findFurniture(id: string): Furniture | null {
  const list = currentFurniture();
  for (let i = 0; i < list.length; i++) if (list[i]!.id === id) return list[i]!;
  return null;
}
export function findHydraulicNode(id: string) {
  return project.hydraulics.nodes.find((node) => node.id === id) || null;
}

function applyEndpoint(w: Wall, which: 1 | 2, x: number, y: number): void {
  const sx = Core.snap(x), sy = Core.snap(y);
  if (which === 1) { w.x1 = sx; w.y1 = sy; } else { w.x2 = sx; w.y2 = sy; }
}
function applyBody(w: Wall, x1: number, y1: number, x2: number, y2: number): void {
  w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2;
}

export const commands = {
  createHydraulicPrototype(): void {
    pushUndoSnapshot();
    project.hydraulics = buildColdWaterKitchenPrototype(currentFloor());
    project.layers.instalacoes = true;
    emit({ type: 'HydraulicPrototypeCreated' });
  },

  createHydraulicFixture(templateKey: string, x: number, y: number, wallId?: string) {
    const wall = wallId ? findWall(wallId) : undefined;
    const node = createPositionedHydraulicFixture(templateKey, x, y, wall || undefined);
    if (!node) return null;
    node.floorIndex = project.currentFloorIndex;
    pushUndoSnapshot();
    project.hydraulics.nodes.push(node);
    project.layers.instalacoes = true;
    emit({ type: 'HydraulicFixtureCreated', hydraulicNodeId: node.id });
    return node;
  },

  updateHydraulicFixtureBodyLive(nodeId: string, x: number, y: number, elevationM?: number) {
    const node = findHydraulicNode(nodeId);
    if (!node || node.kind !== 'fixture' || !node.fixtureType) return null;
    const wall = node.wallId ? findWall(node.wallId) || undefined : undefined;
    const resolved = resolveHydraulicFixturePosition(node, x, y, wall);
    node.x = resolved.x;
    node.y = resolved.y;
    if (Number.isFinite(elevationM)) node.elevationM = Math.max(0.05, Math.min(2.6, elevationM!));
    if (node.networkType === 'cold_water') {
      const networkWasGenerated = project.hydraulics.nodes.some((item) => item.kind === 'source' && item.networkType === 'cold_water');
      if (networkWasGenerated) project.hydraulics = buildColdWaterNetworkFromFixtures(project.floors, project.hydraulics);
    } else {
      // Mesma ideia da água fria, só que pro ponto fixo ser um destino
      // (caixa de gordura/inspeção/saída pluvial) em vez de uma origem.
      const destinationExists = project.hydraulics.nodes.some((item) => item.kind === 'destination' && item.networkType === node.networkType);
      if (destinationExists) project.hydraulics = buildDestinationNetworkFromFixtures(node.networkType, project.floors, project.hydraulics);
    }
    emit({ type: 'HydraulicFixtureMoved', hydraulicNodeId: node.id });
    return node;
  },

  // Arraste da caixa d'água (kind 'source'): regenera o trecho não-guiado
  // da rede (buildColdWaterNetworkFromFixtures) a partir da nova posição —
  // sem isso, os canos já traçados ficariam desalinhados/"para trás" da
  // caixa (Product Owner: "quero arrastar a caixa d'água sem que ela se
  // desconecte dos canos"). Percursos guiados manualmente (H2,
  // ownerFixtureId) nunca são sobrescritos por essa regeneração — e o
  // primeiro trecho deles já acompanha a nova posição sozinho, porque
  // referencia a origem por ID, não por cópia de coordenada. Sem
  // pushUndoSnapshot aqui de propósito — a captura do pré-arraste já
  // acontece em beginTransaction(), no pointerdown (mesmo padrão de
  // updateHydraulicFixtureBodyLive).
  updateHydraulicSourceBodyLive(nodeId: string, x: number, y: number) {
    const node = findHydraulicNode(nodeId);
    if (!node || node.kind !== 'source') return null;
    node.x = x;
    node.y = y;
    project.hydraulics = buildColdWaterNetworkFromFixtures(project.floors, project.hydraulics);
    emit({ type: 'HydraulicSourceMoved', hydraulicNodeId: node.id });
    return node;
  },

  // Mesma ideia de updateHydraulicSourceBodyLive, pro arraste de uma
  // caixa de destino (gordura/inspeção/saída pluvial) — regenera só a
  // rede DAQUELE networkType (as outras redes/tipos ficam intactas, ver
  // buildDestinationNetworkFromFixtures).
  updateHydraulicDestinationBodyLive(nodeId: string, x: number, y: number) {
    const node = findHydraulicNode(nodeId);
    if (!node || node.kind !== 'destination') return null;
    node.x = x;
    node.y = y;
    project.hydraulics = buildDestinationNetworkFromFixtures(node.networkType, project.floors, project.hydraulics);
    emit({ type: 'HydraulicDestinationMoved', hydraulicNodeId: node.id });
    return node;
  },

  flipHydraulicFixtureFace(nodeId: string): void {
    const node = findHydraulicNode(nodeId);
    if (!node || node.kind !== 'fixture' || node.placementSurface !== 'wall' || !node.wallId) return;
    const wall = findWall(node.wallId);
    if (!wall) return;
    pushUndoSnapshot();
    if (node.wallFaceSide === 1 || node.wallFaceSide === -1) {
      node.wallFaceSide = node.wallFaceSide === 1 ? -1 : 1;
    } else {
      const visual = hydraulicFixtureVisualPosition(node, wall, project.floors.flatMap((floor) => floor.walls));
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
      const nx = -dy / (Math.hypot(dx, dy) || 1);
      const ny = dx / (Math.hypot(dx, dy) || 1);
      const currentSide = (visual.x - node.x) * nx + (visual.y - node.y) * ny >= 0 ? 1 : -1;
      node.wallFaceSide = currentSide === 1 ? -1 : 1;
    }
    emit({ type: 'HydraulicFixtureFaceFlipped', hydraulicNodeId: node.id });
  },

  deleteHydraulicFixture(nodeId: string): void {
    const node = findHydraulicNode(nodeId);
    if (!node || node.kind !== 'fixture' || !node.fixtureType) return;
    pushUndoSnapshot();
    project.hydraulics.nodes = project.hydraulics.nodes.filter((item) => item.id !== nodeId);
    project.hydraulics.segments = project.hydraulics.segments.filter((segment) => segment.startNodeId !== nodeId && segment.endNodeId !== nodeId);
    emit({ type: 'HydraulicFixtureDeleted', hydraulicNodeId: nodeId });
  },

  generateHydraulicNetwork(): boolean {
    const hasWaterPoint = project.hydraulics.nodes.some((node) => node.kind === 'fixture' && node.networkType === 'cold_water' && !!node.fixtureType);
    if (!hasWaterPoint) return false;
    pushUndoSnapshot();
    project.hydraulics = buildColdWaterNetworkFromFixtures(project.floors, project.hydraulics);
    project.layers.instalacoes = true;
    emit({ type: 'HydraulicNetworkGenerated' });
    return true;
  },

  // Botão separado de "Gerar tubulação" (só água fria) — gera as 3 redes
  // com ponto fixo no chão de uma vez: caixa de gordura (esgoto de
  // cozinha), caixa de inspeção (esgoto sanitário) e caixa de saída
  // pluvial. Cada uma só é gerada se tiver pelo menos 1 ponto do tipo
  // dela; a água fria (se já gerada) não é tocada.
  generateSewerAndRainwaterNetwork(): boolean {
    const types: HydraulicNetworkType[] = ['kitchen_sewer', 'sanitary_sewer', 'rainwater'];
    const hasAnyPoint = types.some((type) => project.hydraulics.nodes.some((node) => node.kind === 'fixture' && node.networkType === type && !!node.fixtureType));
    if (!hasAnyPoint) return false;
    pushUndoSnapshot();
    types.forEach((type) => {
      project.hydraulics = buildDestinationNetworkFromFixtures(type, project.floors, project.hydraulics);
    });
    project.layers.instalacoes = true;
    emit({ type: 'HydraulicNetworkGenerated' });
    return true;
  },

  // H2 — percurso guiado: o usuário desenha o trecho horizontal
  // (pontos-guia); a descida/subida final até o ponto continua automática
  // (ver Hydraulics.buildGuidedHydraulicRoute). Chamar de novo pro MESMO
  // ponto substitui só o percurso dele (ownerFixtureId), sem afetar os
  // demais pontos já roteados — inclusive os gerados pela rota ingênua de
  // generateHydraulicNetwork/generateSewerAndRainwaterNetwork, que
  // preserva rotas guiadas. Funciona pra qualquer networkType — água fria
  // roteia até a origem (source), esgoto/pluvial até o destino
  // (destination); qual dos dois é a "ponta fixa" depende só do tipo do
  // próprio fixture selecionado.
  setGuidedHydraulicRoute(fixtureId: string, waypoints: { x: number; y: number }[]): boolean {
    const fixture = findHydraulicNode(fixtureId);
    if (!fixture || fixture.kind !== 'fixture' || !fixture.fixtureType) return false;
    const networkType = fixture.networkType;
    const endpointRole: HydraulicEndpointRole = networkType === 'cold_water' ? 'source' : 'destination';
    pushUndoSnapshot();
    let endpoint = project.hydraulics.nodes.find((node) => node.kind === endpointRole && node.networkType === networkType);
    if (!endpoint) {
      // Mesma lógica de posicionamento usada em
      // Hydraulics.buildOrthogonalNetworkFromFixtures — duplicada aqui de
      // propósito (é só o ponto de partida quando ainda não existe NENHUM
      // ponto fixo daquele tipo; uma vez criado, sempre é reaproveitado,
      // nunca regenerado).
      const topFloorIndex = Math.max(0, project.floors.length - 1);
      const allWalls = project.floors.flatMap((floor) => floor.walls);
      const bounds = allWalls.length ? {
        minX: Math.min(...allWalls.flatMap((wall) => [wall.x1, wall.x2])), maxX: Math.max(...allWalls.flatMap((wall) => [wall.x1, wall.x2])),
        minY: Math.min(...allWalls.flatMap((wall) => [wall.y1, wall.y2])), maxY: Math.max(...allWalls.flatMap((wall) => [wall.y1, wall.y2])),
      } : { minX: -40, maxX: 40, minY: -40, maxY: 40 };
      endpoint = endpointRole === 'source'
        ? {
            id: nextHydraulicId('hyd-tank'), kind: 'source', networkType, label: "Caixa d'água",
            x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2,
            elevationM: 3.35, floorIndex: topFloorIndex,
          }
        : {
            id: nextHydraulicId('hyd-dest'), kind: 'destination', networkType, label: destinationLabelForNetwork(networkType),
            x: bounds.maxX + Core.GRID, y: (bounds.minY + bounds.maxY) / 2,
            elevationM: 0.05, floorIndex: 0,
          };
      project.hydraulics.nodes.push(endpoint);
    }
    const cleared = removeGuidedRouteForFixture(project.hydraulics, fixtureId);
    const route = buildGuidedHydraulicRoute(networkType, endpointRole, endpoint, fixture, waypoints, fixtureId);
    project.hydraulics = { nodes: [...cleared.nodes, ...route.nodes], segments: [...cleared.segments, ...route.segments] };
    project.layers.instalacoes = true;
    emit({ type: 'HydraulicGuidedRouteSet', hydraulicNodeId: fixtureId });
    return true;
  },

  // Reposiciona um ponto-guia (junction) já existente — usado pelo arraste
  // com prévia fantasma: a posição só é gravada aqui, no soltar do
  // ponteiro; durante o arraste em si, o viewport move só o objeto 3D,
  // sem tocar no Store (mesmo padrão da DEC-57).
  moveHydraulicJunction(nodeId: string, x: number, y: number): boolean {
    const node = findHydraulicNode(nodeId);
    if (!node || node.kind !== 'junction') return false;
    pushUndoSnapshot();
    node.x = x;
    node.y = y;
    emit({ type: 'HydraulicJunctionMoved', hydraulicNodeId: nodeId });
    return true;
  },

  toggleHydraulicLayer(): void {
    project.layers.instalacoes = !project.layers.instalacoes;
    emit({ type: 'HydraulicLayerToggled', visible: project.layers.instalacoes });
  },

  createWall(x1: number, y1: number, x2: number, y2: number): Wall | null {
    x1 = Core.snap(x1); y1 = Core.snap(y1);
    x2 = Core.snap(x2); y2 = Core.snap(y2);
    if (x1 === x2 && y1 === y2) return null;
    pushUndoSnapshot();
    const wall = Core.createWallEntity(x1, y1, x2, y2);
    currentWalls().push(wall);
    emit({ type: 'WallCreated', floorIndex: project.currentFloorIndex, wallId: wall.id });
    return wall;
  },

  // A ferramenta padrão: UM gesto vira um cômodo fechado inteiro (4
  // paredes), num único passo de undo — inspirado na Room Tool do
  // Sims 4. x1,y1,x2,y2 são dois cantos opostos do retângulo.
  createRoom(x1: number, y1: number, x2: number, y2: number): Wall[] | null {
    x1 = Core.snap(x1); y1 = Core.snap(y1);
    x2 = Core.snap(x2); y2 = Core.snap(y2);
    if (x1 === x2 || y1 === y2) return null; // sem área, não é um cômodo
    pushUndoSnapshot();
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const walls = [
      Core.createWallEntity(minX, minY, maxX, minY),
      Core.createWallEntity(maxX, minY, maxX, maxY),
      Core.createWallEntity(maxX, maxY, minX, maxY),
      Core.createWallEntity(minX, maxY, minX, minY)
    ];
    walls.forEach((w) => currentWalls().push(w));
    // Um cômodo desenhado diretamente acima do térreo também precisa do
    // entrepiso. O identificador é o mesmo usado por raiseRoom/Gerar Laje,
    // mantendo a criação idempotente em todos os fluxos.
    if (project.currentFloorIndex > 0) {
      const floor = currentFloor();
      const roomKey = walls.map((wall) => wall.id).sort().join(',');
      floor.roomBaseLajeGenerated = floor.roomBaseLajeGenerated || {};
      floor.roomBaseLajeGenerated[roomKey] = true;
    }
    emit({ type: 'RoomCreated', floorIndex: project.currentFloorIndex, wallIds: walls.map((w) => w.id) });
    return walls;
  },

  raiseRoom(wallIds: string[]): Wall[] | null {
    const source = currentFloor();
    const selected = wallIds.map((id) => source.walls.find((wall) => wall.id === id)).filter((wall): wall is Wall => !!wall);
    if (selected.length < 3 || selected.length !== wallIds.length) return null;
    pushUndoSnapshot();
    const sourceIndex = project.currentFloorIndex;
    const targetIndex = sourceIndex + 1;
    if (!project.floors[targetIndex]) project.floors.push(Core.createFloorEntity('Nível ' + (targetIndex + 1)));
    const target = project.floors[targetIndex]!;
    const selectedIds = new Set(wallIds);
    const roomKey = wallIds.slice().sort().join(',');
    source.walls = source.walls.filter((wall) => !selectedIds.has(wall.id));
    target.walls.push(...selected);
    const movedOpenings = source.openings.filter((opening) => selectedIds.has(opening.wallId));
    source.openings = source.openings.filter((opening) => !selectedIds.has(opening.wallId));
    target.openings.push(...movedOpenings);
    const minX = Math.min(...selected.flatMap((wall) => [wall.x1, wall.x2]));
    const maxX = Math.max(...selected.flatMap((wall) => [wall.x1, wall.x2]));
    const minY = Math.min(...selected.flatMap((wall) => [wall.y1, wall.y2]));
    const maxY = Math.max(...selected.flatMap((wall) => [wall.y1, wall.y2]));
    const movedFurniture = source.furniture.filter((item) => item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY);
    source.furniture = source.furniture.filter((item) => !movedFurniture.includes(item));
    target.furniture.push(...movedFurniture);
    target.roomBaseLajeGenerated = target.roomBaseLajeGenerated || {};
    target.roomBaseLajeGenerated[roomKey] = true;
    project.currentFloorIndex = targetIndex;
    emit({ type: 'RoomRaised', floorIndex: targetIndex, wallIds: wallIds.slice(), baseLajeGenerated: true });
    return selected;
  },

  moveWallEndpoint(wallId: string, which: 1 | 2, x: number, y: number): void {
    const w = findWall(wallId); if (!w) return;
    pushUndoSnapshot();
    applyEndpoint(w, which, x, y);
    emit({ type: 'WallEndpointMoved', wallId, which });
  },
  updateWallEndpointLive(
    wallId: string, which: 1 | 2, x: number, y: number, linkedUpdates?: Omit<LinkedWallUpdate, 'x' | 'y'>[]
  ): void {
    const w = findWall(wallId); if (!w) return;
    const sx = Core.snap(x), sy = Core.snap(y);
    applyEndpoint(w, which, sx, sy);
    // Uma quina é um único nó topológico, embora ainda seja armazenada
    // como duas pontas de paredes diferentes. Mover todas as pontas
    // coincidentes antes de emitir o evento mantém o circuito fechado
    // durante todo o arraste; assim detectRooms nunca perde o cômodo e o
    // piso não desaparece por um frame (nem fica um rasgo permanente).
    (linkedUpdates || []).forEach((u) => {
      const linkedWall = findWall(u.id); if (!linkedWall) return;
      applyEndpoint(linkedWall, u.which, sx, sy);
    });
    emit({ type: 'WallEndpointMoved', wallId, which, live: true });
  },

  moveWallBody(wallId: string, x1: number, y1: number, x2: number, y2: number): void {
    const w = findWall(wallId); if (!w) return;
    pushUndoSnapshot();
    applyBody(w, x1, y1, x2, y2);
    emit({ type: 'WallMoved', wallId });
  },
  updateWallBodyLive(wallId: string, x1: number, y1: number, x2: number, y2: number): void {
    const w = findWall(wallId); if (!w) return;
    applyBody(w, x1, y1, x2, y2);
    emit({ type: 'WallMoved', wallId, live: true });
  },

  // Cria a parede-rastro (o "pedacinho novo perpendicular") que fecha o
  // buraco deixado quando a ponta de uma parede se afasta de onde estava
  // — sem empilhar undo (parte da mesma transação do arraste que já
  // começou). x1,y1 é o ponto antigo (fixo); x2,y2 é a ponta que está se
  // movendo ao vivo.
  createBridgeWallLive(x1: number, y1: number, x2: number, y2: number): string {
    const w = Core.createWallEntity(x1, y1, x2, y2);
    currentWalls().push(w);
    emit({ type: 'BridgeWallCreated', wallId: w.id, live: true });
    return w.id;
  },
  updateBridgeWallLive(wallId: string, x1: number, y1: number, x2: number, y2: number): void {
    const w = findWall(wallId); if (!w) return;
    w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2;
    emit({ type: 'WallMoved', wallId, live: true });
  },
  // Some com a parede-rastro sem deixar rastro no histórico de undo
  // (usado quando ela acaba ficando comprimento ~0).
  removeBridgeWallSilent(wallId: string): void {
    const walls = currentWalls();
    let idx = -1;
    for (let i = 0; i < walls.length; i++) if (walls[i]!.id === wallId) { idx = i; break; }
    if (idx < 0) return;
    walls.splice(idx, 1);
    emit({ type: 'BridgeWallRemoved', wallId, live: true });
  },

  // Remove apenas os IDs explicitamente classificados pelo diagnostico
  // como residuos criados no gesto atual. Nao cria outro passo de undo:
  // a limpeza pertence a mesma transacao iniciada pelo arraste.
  pruneDegenerateWallsLive(wallIds: string[]): string[] {
    const allowed = new Set(wallIds || []);
    if (!allowed.size) return [];
    const walls = currentWalls();
    const removed: string[] = [];
    for (let i = walls.length - 1; i >= 0; i--) {
      const wall = walls[i]!;
      if (!allowed.has(wall.id)) continue;
      if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= 1) continue;
      removed.push(wall.id);
      walls.splice(i, 1);
    }
    if (!removed.length) return removed;
    const openings = currentOpenings();
    for (let i = openings.length - 1; i >= 0; i--) {
      if (removed.includes(openings[i]!.wallId)) openings.splice(i, 1);
    }
    emit({ type: 'DegenerateWallsPruned', wallIds: removed, count: removed.length, live: true });
    return removed;
  },

  // Arrasta o "módulo" (cômodo) inteiro — todas as paredes que formam
  // aquele cômodo se movem juntas, mantendo a forma.
  updateWallsGroupBodyLive(snapshots: WallSnapshot[], dx: number, dy: number): void {
    snapshots.forEach((s) => {
      const w = findWall(s.id); if (!w) return;
      w.x1 = s.x1 + dx; w.y1 = s.y1 + dy; w.x2 = s.x2 + dx; w.y2 = s.y2 + dy;
    });
    emit({ type: 'WallsGroupDragged', live: true });
  },

  // Move a construção INTEIRA — todos os pavimentos, mantendo o
  // empilhamento — por um delta em X/Y. Diferente de
  // updateWallsGroupBodyLive (só paredes de UM cômodo): aqui todo tipo
  // de entidade de todo pavimento anda junto (parede, coluna, telhado,
  // varanda, laje solta, móvel, painel de vidro solto — attached anda
  // sozinho com a parede via wallId+offsetM —, sacada de vidro, bloco
  // de volumetria, escada, planta de referência, ponto hidráulico).
  // Terreno nunca se move — é a referência fixa. Sem rotação/espelho
  // nenhum, é só soma — chamado uma vez no soltar do arraste
  // "Selecionar tudo" (ViewportController já chamou beginTransaction
  // no começo do gesto, então não empurra outro snapshot de undo aqui).
  moveEntireConstruction(dx: number, dy: number): void {
    project.floors.forEach((f) => {
      f.walls.forEach((w) => { w.x1 += dx; w.y1 += dy; w.x2 += dx; w.y2 += dy; });
      f.columns.forEach((c) => { c.x += dx; c.y += dy; });
      f.roofs.forEach((r) => { r.x1 += dx; r.y1 += dy; r.x2 += dx; r.y2 += dy; });
      f.varandas.forEach((v) => {
        v.x1 += dx; v.y1 += dy; v.x2 += dx; v.y2 += dy;
        v.contourSegments?.forEach((segment) => { segment.x1 += dx; segment.y1 += dy; segment.x2 += dx; segment.y2 += dy; });
      });
      f.lajes.forEach((l) => { l.points.forEach((p) => { p.x += dx; p.y += dy; }); });
      f.furniture.forEach((it) => { it.x += dx; it.y += dy; });
      f.glazingPanels.forEach((g) => { if (g.state === 'preview' && g.x != null && g.y != null) { g.x += dx; g.y += dy; } });
      f.balconyRailings.forEach((b) => { b.x += dx; b.y += dy; });
      f.volumeBoxes.forEach((v) => { v.x += dx; v.y += dy; });
      f.stairs.forEach((s) => { s.x += dx; s.y += dy; });
      if (f.planUnderlay) { f.planUnderlay.x += dx; f.planUnderlay.y += dy; }
    });
    project.hydraulics.nodes.forEach((n) => { n.x += dx; n.y += dy; });
    emit({ type: 'EntireConstructionMoved', dx, dy, live: true });
  },

  // Duplica a construção INTEIRA espelhada num eixo vertical (X) —
  // "geminado": a cópia é um reflexo de verdade (não uma cópia igual
  // deslocada), encostada na borda direita da original
  // (computeConstructionBoundsX). As duas unidades convivem no MESMO
  // Floor de cada pavimento (não cria pavimento novo). Cada entidade
  // ganha id novo (Core.nextId/nextHydraulicId); referências por id
  // (wallId, startNodeId/endNodeId, ownerFixtureId) são remapeadas pro
  // id novo correspondente. roomFinishes/roomFinishSettings/
  // roomLajeGenerated/roomForroGenerated/roomForroTipo (todos indexados
  // por roomKey = ids de parede ordenados e unidos) são remapeados pro
  // roomKey do cômodo espelhado, senão a cópia nasceria sem
  // acabamento/laje/forro que o original já tinha.
  //
  // Limitações aceitas (ver plano): planUnderlay não duplica (é
  // referência de desenho); Roof.compoundGroupId/atticWallIds não são
  // remapeados (cobertura composta/ático pode precisar de ajuste manual
  // na cópia); Stair com model 'L'/'U' só reposiciona/gira — o giro
  // real da escada (qual lado sobe) não inverte, porque a malha .glb é
  // fixa; hidráulica duplicada espelhada foi decisão explícita do
  // Product Owner mesmo sabendo do risco de sair errada num detalhe de
  // lateralidade — revisar visualmente depois.
  duplicateEntireConstructionMirrored(): void {
    pushUndoSnapshot();
    const axisX = computeConstructionBoundsX();
    const wallIdMapsByFloor: Record<string, string>[] = [];

    project.floors.forEach((f, floorIdx) => {
      const rooms = Core.detectRooms(f.walls);
      const oldWallIdsPerRoom = rooms.map((room) => Core.findRoomWallIds(f.walls, room).slice().sort());
      const oldRoomKeys = oldWallIdsPerRoom.map((ids) => ids.join(','));

      const wallIdMap: Record<string, string> = {};
      const newWalls: Wall[] = f.walls.map((w) => {
        const newId = Core.nextId('wall');
        wallIdMap[w.id] = newId;
        return { ...w, id: newId, x1: Core.mirrorX(w.x1, axisX), x2: Core.mirrorX(w.x2, axisX) };
      });
      wallIdMapsByFloor[floorIdx] = wallIdMap;

      const newColumns: Column[] = f.columns.map((c) => ({ ...c, id: Core.nextId('column'), x: Core.mirrorX(c.x, axisX) }));
      const newRoofs: Roof[] = f.roofs.map((r) => ({
        ...r, id: Core.nextId('roof'), x1: Core.mirrorX(r.x1, axisX), x2: Core.mirrorX(r.x2, axisX),
      }));
      const newVarandas: Varanda[] = f.varandas.map((v) => {
        const copy: Varanda = {
          ...v, id: Core.nextId('varanda'), x1: Core.mirrorX(v.x1, axisX), x2: Core.mirrorX(v.x2, axisX),
          frontSide: v.frontSide === 'minX' ? 'maxX' : v.frontSide === 'maxX' ? 'minX' : v.frontSide,
        };
        if (v.contourSegments) copy.contourSegments = v.contourSegments.map((segment) => ({
          ...segment, wallId: wallIdMap[segment.wallId] || segment.wallId,
          x1: Core.mirrorX(segment.x1, axisX), x2: Core.mirrorX(segment.x2, axisX),
          outwardSign: (-segment.outwardSign) as 1 | -1,
        }));
        return copy;
      });
      // Espelhar em X inverte o sentido do contorno (horário vira
      // anti-horário) — Laje.points exige sentido horário, daí o
      // .reverse() depois de espelhar cada ponto.
      const newLajes: Laje[] = f.lajes.map((l) => ({
        ...l, id: Core.nextId('laje'),
        points: l.points.map((p) => ({ x: Core.mirrorX(p.x, axisX), y: p.y })).reverse(),
      }));
      const newFurniture: Furniture[] = f.furniture.map((it) => ({
        ...it, id: Core.nextId('furniture'), x: Core.mirrorX(it.x, axisX), rotationDeg: Core.mirrorRotationDeg(it.rotationDeg),
      }));
      const newGlazingPanels: GlazingPanel[] = f.glazingPanels.map((g) => {
        const copy: GlazingPanel = { ...g, id: Core.nextId('glazing') };
        if (g.state === 'preview' && g.x != null && g.y != null) {
          copy.x = Core.mirrorX(g.x, axisX);
          if (g.rotationDeg != null) copy.rotationDeg = Core.mirrorRotationDeg(g.rotationDeg);
        } else if (g.state === 'attached' && g.wallId) {
          copy.wallId = wallIdMap[g.wallId] || g.wallId;
          if (g.normalSign != null) copy.normalSign = (g.normalSign * -1) as 1 | -1;
        }
        return copy;
      });
      const newBalconyRailings: BalconyRailing[] = f.balconyRailings.map((b) => ({
        ...b, id: Core.nextId('balcony'), x: Core.mirrorX(b.x, axisX), rotationDeg: Core.mirrorRotationDeg(b.rotationDeg),
      }));
      const newVolumeBoxes: VolumeBox[] = f.volumeBoxes.map((v) => ({
        ...v, id: Core.nextId('volumebox'), x: Core.mirrorX(v.x, axisX), rotationDeg: Core.mirrorRotationDeg(v.rotationDeg),
      }));
      const newStairs: Stair[] = f.stairs.map((s) => ({
        ...s, id: Core.nextId('stair'), x: Core.mirrorX(s.x, axisX), rotationDeg: Core.mirrorRotationDeg(s.rotationDeg),
      }));
      // offset não muda — distância ao longo da parede a partir de p1,
      // preservada porque as duas pontas da parede foram espelhadas
      // juntas (isometria).
      const newOpenings: Opening[] = f.openings.map((o) => ({
        ...o, id: Core.nextId('opening'), wallId: wallIdMap[o.wallId] || o.wallId,
      }));

      function remapRoomMap<T>(map: Record<string, T> | undefined): Record<string, T> {
        const result: Record<string, T> = {};
        if (!map) return result;
        oldRoomKeys.forEach((oldKey, i) => {
          const value = map[oldKey];
          if (value === undefined) return;
          const newKey = oldWallIdsPerRoom[i]!.map((id) => wallIdMap[id] || id).sort().join(',');
          result[newKey] = value;
        });
        return result;
      }
      Object.assign(f.roomFinishes, remapRoomMap(f.roomFinishes));
      if (f.roomFinishSettings) Object.assign(f.roomFinishSettings, remapRoomMap(f.roomFinishSettings));
      if (f.roomLajeGenerated) Object.assign(f.roomLajeGenerated, remapRoomMap(f.roomLajeGenerated));
      if (f.roomForroGenerated) Object.assign(f.roomForroGenerated, remapRoomMap(f.roomForroGenerated));
      if (f.roomForroTipo) Object.assign(f.roomForroTipo, remapRoomMap(f.roomForroTipo));

      f.walls.push(...newWalls);
      f.columns.push(...newColumns);
      f.roofs.push(...newRoofs);
      f.varandas.push(...newVarandas);
      f.lajes.push(...newLajes);
      f.furniture.push(...newFurniture);
      f.glazingPanels.push(...newGlazingPanels);
      f.balconyRailings.push(...newBalconyRailings);
      f.volumeBoxes.push(...newVolumeBoxes);
      f.stairs.push(...newStairs);
      f.openings.push(...newOpenings);
    });

    // Hidráulica — project-level (HydraulicNode.floorIndex identifica o
    // pavimento), remapeada com o wallIdMap do floor correspondente.
    const nodeIdMap: Record<string, string> = {};
    const newNodes: HydraulicNode[] = project.hydraulics.nodes.map((n) => {
      const wallIdMap = wallIdMapsByFloor[n.floorIndex ?? 0] || {};
      const newId = nextHydraulicId('hyd-node');
      nodeIdMap[n.id] = newId;
      const copy: HydraulicNode = { ...n, id: newId, x: Core.mirrorX(n.x, axisX) };
      if (n.wallId) copy.wallId = wallIdMap[n.wallId] || n.wallId;
      if (n.wallFaceSide != null) copy.wallFaceSide = (n.wallFaceSide * -1) as 1 | -1;
      return copy;
    });
    newNodes.forEach((n) => {
      if (!n.ownerFixtureId) return;
      const mapped = nodeIdMap[n.ownerFixtureId];
      if (mapped) n.ownerFixtureId = mapped;
    });
    project.hydraulics.nodes.push(...newNodes);

    const newSegments: HydraulicSegment[] = project.hydraulics.segments
      .filter((s) => nodeIdMap[s.startNodeId] && nodeIdMap[s.endNodeId])
      .map((s) => {
        const copy: HydraulicSegment = {
          ...s, id: nextHydraulicId('hyd-segment'),
          startNodeId: nodeIdMap[s.startNodeId]!, endNodeId: nodeIdMap[s.endNodeId]!,
        };
        if (s.ownerFixtureId) copy.ownerFixtureId = nodeIdMap[s.ownerFixtureId] || s.ownerFixtureId;
        return copy;
      });
    project.hydraulics.segments.push(...newSegments);

    emit({ type: 'EntireConstructionDuplicatedMirrored', axisX });
  },

  // "Empurra" uma parede na direção perpendicular a ela mesma, e arrasta
  // junto qualquer ponta de OUTRA parede que estava encostada nas pontas
  // dela — assim o canto nunca abre um vão.
  updateWallResizeLive(
    wallId: string, x1: number, y1: number, x2: number, y2: number, linkedUpdates?: LinkedWallUpdate[]
  ): void {
    const w = findWall(wallId); if (!w) return;
    w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2;
    (linkedUpdates || []).forEach((u) => {
      const lw = findWall(u.id); if (!lw) return;
      if (u.which === 1) { lw.x1 = u.x; lw.y1 = u.y; } else { lw.x2 = u.x; lw.y2 = u.y; }
    });
    emit({ type: 'WallResizeDragged', wallId, live: true });
  },

  // Altura de UM cômodo (Wall.heightM de cada parede do contorno) — as
  // atualizações já vêm resolvidas (ver Core.resolveRoomHeightUpdate,
  // que aplica a regra de "parede compartilhada nunca fica mais baixa
  // que o cômodo vizinho"); este comando só grava.
  updateRoomWallsHeightLive(updates: { id: string; heightM: number }[]): void {
    updates.forEach((u) => {
      const w = findWall(u.id); if (!w) return;
      w.heightM = u.heightM;
    });
    emit({ type: 'RoomHeightDragged', live: true });
  },

  // Funde o trecho onde A e B se sobrepõem na mesma linha, sem apagar
  // identidade de quem sobra fora da sobreposição. Ver comentário
  // histórico completo em legacy/index-monolito-original.html.
  fuseOverlappingWalls(wallAId: string, wallBId: string): void {
    const walls = currentWalls();
    const openings = currentOpenings();
    const a = findWall(wallAId), b = findWall(wallBId);
    if (!a || !b) return;
    // O offset da esquadria pertence ao sentido e ao ponto inicial da
    // parede. A fusao pode encurtar, inverter ou remover esse segmento;
    // portanto, preservamos primeiro a posicao absoluta de cada vao.
    const openingPositions = openings
      .filter((opening) => opening.wallId === wallAId || opening.wallId === wallBId)
      .map((opening) => {
        const owner = opening.wallId === wallAId ? a : b;
        const ownerDx = owner.x2 - owner.x1, ownerDy = owner.y2 - owner.y1;
        const ownerLen = Math.hypot(ownerDx, ownerDy) || 1e-6;
        const distance = opening.offset * Core.GRID;
        return {
          opening,
          x: owner.x1 + ownerDx / ownerLen * distance,
          y: owner.y1 + ownerDy / ownerLen * distance,
        };
      });
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const bLen = Math.hypot(dx, dy);
    if (bLen < 1e-6) return;
    const ux = dx / bLen, uy = dy / bLen, ox = b.x1, oy = b.y1;
    const proj = (x: number, y: number) => (x - ox) * ux + (y - oy) * uy;
    const toPoint = (t: number) => ({ x: ox + ux * t, y: oy + uy * t });

    const ta1 = proj(a.x1, a.y1), ta2 = proj(a.x2, a.y2);
    const aLo = Math.min(ta1, ta2), aHi = Math.max(ta1, ta2);
    const bLo = 0, bHi = bLen;
    const oLo = Math.max(aLo, bLo), oHi = Math.min(aHi, bHi);
    if (oHi - oLo < Core.SNAP_UNIT * 0.5) return; // sobreposição pequena demais pra valer a pena fundir

    const EPS = 1;
    interface Segment { lo: number; hi: number; from: 'a' | 'b' | 'shared'; }
    const segments: Segment[] = [];
    if (bLo < oLo - EPS) segments.push({ lo: bLo, hi: oLo, from: 'b' });
    if (bHi > oHi + EPS) segments.push({ lo: oHi, hi: bHi, from: 'b' });
    if (aLo < oLo - EPS) segments.push({ lo: aLo, hi: oLo, from: 'a' });
    if (aHi > oHi + EPS) segments.push({ lo: oHi, hi: aHi, from: 'a' });
    segments.push({ lo: oLo, hi: oHi, from: 'shared' });

    const MIN_WALL_LEN = 1;
    let usedA = false, usedB = false;
    const resultingWalls: Wall[] = [];
    segments.forEach((seg) => {
      const p1 = toPoint(seg.lo), p2 = toPoint(seg.hi);
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < MIN_WALL_LEN) return;
      let id: string | null = null;
      if (seg.from === 'b' && !usedB) { id = wallBId; usedB = true; }
      else if (seg.from === 'a' && !usedA) { id = wallAId; usedA = true; }
      else if (seg.from === 'shared') {
        if (!usedA) { id = wallAId; usedA = true; }
        else if (!usedB) { id = wallBId; usedB = true; }
      }
      if (id) {
        const w = findWall(id)!;
        w.x1 = p1.x; w.y1 = p1.y; w.x2 = p2.x; w.y2 = p2.y;
        resultingWalls.push(w);
      } else {
        const piece = Core.createWallEntity(p1.x, p1.y, p2.x, p2.y);
        // Mesmo motivo do split em junção T logo abaixo (ver comentário
        // lá, DEC-89): pedaço novo herda a altura da parede de origem
        // (a ou b, conforme seg.from) em vez de nascer sempre na altura
        // padrão do pavimento.
        const source = seg.from === 'b' ? b : a;
        if (source.heightM !== undefined) piece.heightM = source.heightM;
        if (source.finishA !== undefined) piece.finishA = source.finishA;
        if (source.finishB !== undefined) piece.finishB = source.finishB;
        walls.push(piece);
        resultingWalls.push(piece);
      }
    });

    if (!usedA) { const ia = walls.indexOf(a); if (ia >= 0) walls.splice(ia, 1); }
    if (!usedB) { const ib = walls.indexOf(b); if (ib >= 0) walls.splice(ib, 1); }

    openingPositions.forEach(({ opening, x, y }) => {
      const owner = resultingWalls.find((wall) => (
        Core.distToSegment(x, y, wall.x1, wall.y1, wall.x2, wall.y2) <= Core.COINCIDENCE_TOL
      ));
      if (!owner) return;
      opening.wallId = owner.id;
      opening.offset = Core.wallOffsetAtPoint(owner, x, y);
    });
    emit({ type: 'WallsFused', wallAId, wallBId });
  },

  // Materializa junções em T no modelo. detectRooms já sabia dividir a
  // parede passante apenas para calcular faces; isso não bastava para a
  // edição, porque selecionar/mover a parede continuava tratando-a como
  // um único segmento. Esta normalização cria os trechos reais, conserva
  // acabamentos e transfere portas/janelas para o trecho correspondente.
  splitWallsAtTJunctions(): string[] {
    const walls = currentWalls();
    const openings = currentOpenings();
    const splitIds: string[] = [];
    const plans = Core.findWallTJunctionSplits(walls);

    plans.forEach((plan) => {
      const original = findWall(plan.wallId);
      if (!original) return;
      const dx = original.x2 - original.x1;
      const dy = original.y2 - original.y1;
      const originalLength = Math.hypot(dx, dy);
      if (originalLength < 1e-6) return;

      const boundaries = [
        { x: original.x1, y: original.y1, t: 0 },
        ...plan.points,
        { x: original.x2, y: original.y2, t: 1 },
      ];
      const pieces: { wall: Wall; startT: number; endT: number }[] = [];

      for (let index = 0; index < boundaries.length - 1; index++) {
        const p1 = boundaries[index]!;
        const p2 = boundaries[index + 1]!;
        let piece: Wall;
        if (index === 0) {
          piece = original;
          piece.x1 = p1.x; piece.y1 = p1.y; piece.x2 = p2.x; piece.y2 = p2.y;
        } else {
          piece = Core.createWallEntity(p1.x, p1.y, p2.x, p2.y);
          if (original.finishA !== undefined) piece.finishA = original.finishA;
          if (original.finishB !== undefined) piece.finishB = original.finishB;
          // Sem isso, o pedaço novo nascia com a altura PADRÃO do
          // pavimento mesmo quando a parede original tinha altura de
          // cômodo customizada (DEC-88) — a junção em T é disparada o
          // tempo todo por qualquer arraste de parede perpendicular, então
          // o pedaço "caído" pra altura padrão aparecia como um buraco no
          // meio de uma parede que devia estar inteira na altura do
          // cômodo (ver DEC-89, bug relatado pelo Product Owner).
          if (original.heightM !== undefined) piece.heightM = original.heightM;
          walls.push(piece);
        }
        pieces.push({ wall: piece, startT: p1.t, endT: p2.t });
      }

      openings.filter((opening) => opening.wallId === plan.wallId).forEach((opening) => {
        const centerUnits = opening.offset * Core.GRID;
        const centerT = centerUnits / originalLength;
        const owner = pieces.find((piece, index) => (
          centerT >= piece.startT - 1e-6 &&
          (centerT < piece.endT - 1e-6 || index === pieces.length - 1)
        ));
        if (!owner) return;
        opening.wallId = owner.wall.id;
        opening.offset = (centerUnits - owner.startT * originalLength) / Core.GRID;
      });

      splitIds.push(plan.wallId);
    });

    if (splitIds.length) emit({ type: 'WallsSplitAtTJunctions', wallIds: splitIds });
    return splitIds;
  },

  beginTransaction(): void { pushUndoSnapshot(); },

  // Descarta integralmente a transacao em curso e remove do historico o
  // snapshot criado por beginTransaction. Usado pelo protetor topologico:
  // uma operacao recusada nao pode deixar alteracoes parciais nem consumir
  // um passo de Ctrl+Z.
  rollbackTransaction(): void {
    if (!undoStack.length) return;
    project = undoStack.pop()!;
    emit({ type: 'TransactionRolledBack' });
  },

  // Rede de segurança geral: remove qualquer parede que tenha zerado de
  // comprimento (sujeira invisível que pode sobrar de qualquer operação
  // de corte/fusão).
  pruneDegenerateWalls(): number {
    const walls = currentWalls();
    const degenerateIdx: number[] = [];
    walls.forEach((w, i) => { if (Math.hypot(w.x2 - w.x1, w.y2 - w.y1) < 1) degenerateIdx.push(i); });
    if (!degenerateIdx.length) return 0;
    pushUndoSnapshot();
    for (let k = degenerateIdx.length - 1; k >= 0; k--) walls.splice(degenerateIdx[k]!, 1);
    emit({ type: 'DegenerateWallsPruned', count: degenerateIdx.length });
    return degenerateIdx.length;
  },

  resizeWallLength(wallId: string, newLengthMeters: number): void {
    const w = findWall(wallId); if (!w) return;
    const newLenPx = newLengthMeters * Core.GRID;
    if (!(newLenPx > 0)) return;
    const curLen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (curLen < 1e-6) return;
    const midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    const ux = (w.x2 - w.x1) / curLen, uy = (w.y2 - w.y1) / curLen;
    const half = newLenPx / 2;
    pushUndoSnapshot();
    w.x1 = Core.snap(midX - ux * half); w.y1 = Core.snap(midY - uy * half);
    w.x2 = Core.snap(midX + ux * half); w.y2 = Core.snap(midY + uy * half);
    emit({ type: 'WallResized', wallId, length: newLengthMeters });
  },

  rotateWall(wallId: string, angleRad: number): void {
    const w = findWall(wallId); if (!w) return;
    pushUndoSnapshot();
    const midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    const rotatePt = (x: number, y: number) => {
      const dx = x - midX, dy = y - midY;
      return {
        x: midX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: midY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      };
    };
    const p1 = rotatePt(w.x1, w.y1), p2 = rotatePt(w.x2, w.y2);
    w.x1 = Core.snap(p1.x); w.y1 = Core.snap(p1.y);
    w.x2 = Core.snap(p2.x); w.y2 = Core.snap(p2.y);
    emit({ type: 'WallRotated', wallId });
  },

  // Aplica um Produto do Catálogo a um elemento — ver comentário
  // histórico completo em legacy/index-monolito-original.html.
  setWallFinishFace(wallId: string, face: 'a' | 'b', productId: string): void {
    const w = findWall(wallId); if (!w) return;
    if (face !== 'a' && face !== 'b') return;
    pushUndoSnapshot();
    if (face === 'a') w.finishA = productId; else w.finishB = productId;
    emit({ type: 'WallFinishSet', wallId, face, productId });
  },
  setCommercialSelection(targetKey: string, selection: CommercialSelection): void {
    if (!project.commercialSelections) project.commercialSelections = {};
    project.commercialSelections[targetKey] = { ...selection };
    emit({ type: 'CommercialSelectionSet', targetKey, productId: selection.productId, offerId: selection.offerId });
  },
  setRoofFinish(roofId: string, productId: string): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.finishProductId = productId;
    emit({ type: 'RoofFinishSet', roofId, productId });
  },
  setRoofGableFinish(roofId: string, face: 'a' | 'b', productId: string): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    if (face === 'a') r.gableFinishA = productId; else r.gableFinishB = productId;
    emit({ type: 'RoofGableFinishSet', roofId, face, productId });
  },
  setRoomFinish(roomKey: string, productId: string, scale = 1, rotation = 0): void {
    if (!roomKey) return;
    pushUndoSnapshot();
    const f = currentFloor();
    f.roomFinishes = f.roomFinishes || {};
    f.roomFinishSettings = f.roomFinishSettings || {};
    f.roomFinishes[roomKey] = productId;
    f.roomFinishSettings[roomKey] = { scale, rotation };
    emit({ type: 'RoomFinishSet', roomKey, productId, scale, rotation });
  },

  // Botão "Gerar Laje" (DEC-90) — marca TODOS os cômodos fechados do
  // pavimento atual de uma vez (não um por um); cada laje continua uma
  // peça individual amarrada ao roomKey de origem (Scene3DRenderer só
  // desenha malha própria por cômodo, sem fundir em uma peça só). Um
  // cômodo criado DEPOIS deste clique nasce sem laje de novo — precisa
  // clicar o botão outra vez pra cobrir ele também.
  generateLajeForCurrentFloor(): void {
    const f = currentFloor();
    const rooms = Core.detectRooms(f.walls);
    if (!rooms.length) return;
    f.roomLajeGenerated = f.roomLajeGenerated || {};
    const roomKeys: string[] = [];
    rooms.forEach((room) => {
      const roomKey = Core.findRoomWallIds(f.walls, room).slice().sort().join(',');
      if (!roomKey) return;
      if (f.roomLajeGenerated![roomKey] || (f.roomBaseLajeGenerated || {})[roomKey]) return;
      roomKeys.push(roomKey);
    });
    if (!roomKeys.length) {
      emit({ type: 'LajeGenerated', roomKeys: [], skippedExisting: true });
      return;
    }
    pushUndoSnapshot();
    roomKeys.forEach((roomKey) => {
      f.roomLajeGenerated![roomKey] = true;
    });
    emit({ type: 'LajeGenerated', roomKeys });
  },

  generateRoofsForCurrentFloor(style: 'automatico' | 'contemporaneo' | 'tradicional' | 'colonial' | 'chale'): number {
    const floor = currentFloor();
    const rects = Core.roofGenerationRects(floor.walls);
    if (!rects.length || floor.roofs.length) {
      emit({ type: 'RoofsAutoGenerated', style, roofIds: [], skippedExisting: floor.roofs.length > 0 });
      return 0;
    }
    pushUndoSnapshot();
    const roofs = rects.map((rect) => {
      const width = rect.x2 - rect.x1, depth = rect.y2 - rect.y1;
      let type: RoofType = 'quatroAguas';
      let pitch = 28;
      if (style === 'contemporaneo') type = 'platibanda';
      else if (style === 'chale') { type = 'duasAguas'; pitch = 42; }
      else if (style === 'colonial') { type = 'quatroAguas'; pitch = 35; }
      else if (style === 'tradicional') { type = width > depth * 1.7 || depth > width * 1.7 ? 'duasAguas' : 'quatroAguas'; pitch = 30; }
      else type = width > depth * 1.8 || depth > width * 1.8 ? 'duasAguas' : 'quatroAguas';
      const ridgeAxis = width >= depth ? 'x' : 'y';
      return Core.createRoofEntity(rect.x1, rect.y1, rect.x2, rect.y2, type, pitch, ridgeAxis);
    });
    floor.roofs.push(...roofs);
    autoComposeCurrentRoofs();
    emit({ type: 'RoofsAutoGenerated', style, roofIds: roofs.map((roof) => roof.id) });
    return roofs.length;
  },

  createRoofCompositePreset(kind: 'extensaoLateral' | 'cumeeirasParalelas'): number {
    const floor = currentFloor();
    const rects = Core.roofGenerationRects(floor.walls);
    if (!rects.length) return 0;
    const base = rects.reduce((best, rect) => (rect.x2 - rect.x1) * (rect.y2 - rect.y1) > (best.x2 - best.x1) * (best.y2 - best.y1) ? rect : best, rects[0]!);
    pushUndoSnapshot();
    const groupId = Core.nextId('roof-group');
    const width = base.x2 - base.x1, depth = base.y2 - base.y1;
    const roofs: Roof[] = [];
    if (kind === 'extensaoLateral') {
      // Duas águas assimétrico: duas peças de uma água compartilham a
      // cumeeira; uma delas se prolonga lateralmente. Não há um telhado
      // duas-águas inteiro escondido por baixo da extensão.
      if (width >= depth) {
        const ridgeY = base.y1 + depth * 0.5;
        roofs.push(
          Core.createRoofEntity(base.x1, base.y1, base.x2, ridgeY, 'umaAgua', 28, 'x'),
          Core.createRoofEntity(base.x1, ridgeY, base.x2, base.y2 + depth * 0.45, 'umaAgua', 18, 'x'),
        );
      } else {
        const ridgeX = base.x1 + width * 0.5;
        roofs.push(
          Core.createRoofEntity(base.x1, base.y1, ridgeX, base.y2, 'umaAgua', 28, 'y'),
          Core.createRoofEntity(ridgeX, base.y1, base.x2 + width * 0.45, base.y2, 'umaAgua', 18, 'y'),
        );
      }
    } else {
      // Cobertura escalonada: a peça principal permanece na altura
      // normal e a segunda nasce elevada, com cumeeira paralela. A linha
      // de encontro vira uma parede REAL do pavimento, controlada pelo
      // telhado elevado; por isso recebe acabamento e esquadrias como
      // qualquer outra parede, em vez de ser apenas uma saia decorativa.
      // Um pequeno desnível arquitetônico, não a altura de um segundo
      // pavimento. As duas coberturas ocupam regiões vizinhas e nunca se
      // sobrepõem — o degrau aparece apenas na parede do encontro.
      const raisedBaseHeightM = Core.WALL_HEIGHT + 0.45;
      let divider: Wall;
      let lower: Roof;
      let raised: Roof;
      if (width >= depth) {
        const stepY = base.y1 + depth * 0.52;
        divider = Core.createWallEntity(base.x1, stepY, base.x2, stepY);
        lower = Core.createRoofEntity(base.x1, base.y1, base.x2, stepY, 'duasAguas', 26, 'x');
        raised = Core.createRoofEntity(base.x1, stepY, base.x2, base.y2, 'duasAguas', 26, 'x', undefined, undefined, 'generated', raisedBaseHeightM);
      } else {
        const stepX = base.x1 + width * 0.52;
        divider = Core.createWallEntity(stepX, base.y1, stepX, base.y2);
        lower = Core.createRoofEntity(base.x1, base.y1, stepX, base.y2, 'duasAguas', 26, 'y');
        raised = Core.createRoofEntity(stepX, base.y1, base.x2, base.y2, 'duasAguas', 26, 'y', undefined, undefined, 'generated', raisedBaseHeightM);
      }
      floor.walls.push(divider);
      raised.atticWallIds = floor.walls
        .filter((wall) => Core.wallIntersectsRoofFootprint(wall, raised))
        .map((wall) => wall.id);
      roofs.push(
        lower,
        raised,
      );
    }
    roofs.forEach((roof) => { roof.compoundGroupId = groupId; });
    floor.roofs.push(...roofs);
    emit({ type: 'RoofCompositePresetCreated', kind, roofIds: roofs.map((roof) => roof.id), groupId });
    return roofs.length;
  },

  // Botão "Gerar Forro de Drywall" — mesmo espírito de generateLajeForCurrentFloor
  // acima, flag independente (roomForroGenerated, não roomLajeGenerated):
  // um cômodo pode ter só laje, só forro, os dois, ou nenhum. Cômodo criado
  // depois deste clique também nasce sem forro, precisa clicar de novo.
  generateForroDrywallForCurrentFloor(): void {
    const f = currentFloor();
    const rooms = Core.detectRooms(f.walls);
    if (!rooms.length) return;
    pushUndoSnapshot();
    f.roomForroGenerated = f.roomForroGenerated || {};
    const roomKeys: string[] = [];
    rooms.forEach((room) => {
      const roomKey = Core.findRoomWallIds(f.walls, room).slice().sort().join(',');
      if (!roomKey) return;
      f.roomForroGenerated![roomKey] = true;
      roomKeys.push(roomKey);
    });
    emit({ type: 'ForroDrywallGenerated', roomKeys });
  },

  // Tipo de placa do forro (ST/RU/RF/cimenticia) — muda espaçamento dos
  // perfis F530 e a cor da placa (ver Scene3DRenderer). Não exige que o
  // forro já tenha sido gerado nesse roomKey — a escolha fica pronta
  // pra quando "Gerar Forro" for clicado, mesmo espírito não-bloqueante
  // de setRoomFinish acima.
  setForroBoardType(roomKey: string, tipo: ForroBoardType): void {
    if (!roomKey) return;
    pushUndoSnapshot();
    const f = currentFloor();
    f.roomForroTipo = f.roomForroTipo || {};
    f.roomForroTipo[roomKey] = tipo;
    emit({ type: 'ForroBoardTypeSet', roomKey, tipo });
  },

  duplicateWall(wallId: string): Wall | null {
    const w = findWall(wallId); if (!w) return null;
    pushUndoSnapshot();
    const offset = Core.GRID;
    const copy = Core.createWallEntity(w.x1 + offset, w.y1 + offset, w.x2 + offset, w.y2 + offset);
    currentWalls().push(copy);
    emit({ type: 'WallCreated', floorIndex: project.currentFloorIndex, wallId: copy.id, duplicatedFrom: wallId });
    return copy;
  },

  deleteWall(wallId: string): void {
    const walls = currentWalls();
    let idx = -1;
    for (let i = 0; i < walls.length; i++) if (walls[i]!.id === wallId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    walls.splice(idx, 1);
    // Sem a parede, qualquer porta/janela que morava nela fica órfã —
    // remove junto, na mesma transação de undo.
    const openings = currentOpenings();
    for (let j = openings.length - 1; j >= 0; j--) {
      if (openings[j]!.wallId === wallId) openings.splice(j, 1);
    }
    emit({ type: 'WallDeleted', wallId });
  },

  // "Quebrar parede" (ferramenta demolish) — NÃO usa deleteWall acima.
  // Excluir a parede de verdade quebrava o fechamento do cômodo (rooms
  // são derivados do CONTORNO FECHADO de paredes — ver Modelo de
  // Domínio — sem essa parede o polígono não fecha mais e o piso some
  // junto). demolishWall só marca `demolished: true`: a parede continua
  // entrando em computeWallFootprints/detectRooms normalmente (o
  // cômodo/piso não quebra), só para de ser desenhada
  // (Scene3DRenderer/Scene2DRenderer pulam paredes demolidas) e de
  // contar em qualquer quantitativo/orçamento (MaterialsPanel.compute).
  // Portas/janelas que estavam nela continuam no modelo mas também
  // param de ser desenhadas e de contar — sem precisar apagar nada.
  demolishWall(wallId: string): void {
    const w = findWall(wallId);
    if (!w || w.demolished) return;
    pushUndoSnapshot();
    w.demolished = true;
    emit({ type: 'WallDemolished', wallId });
  },

  // Exclui um cômodo inteiro — todas as paredes que fecham ele, numa
  // tacada só (um clique, um passo de undo). Só é chamado enquanto o
  // cômodo ainda está ISOLADO (ver findIsolatedRoomWallIds/selectRoomGroup
  // no ViewportController) — depois que ele se funde com outro, essa
  // ação deixa de existir na UI e vira exclusão de parede avulsa, que
  // não deve tocar nos móveis.
  deleteRoomGroup(wallIds: string[]): void {
    if (!wallIds || !wallIds.length) return;
    const walls = currentWalls();
    const existing = wallIds.filter((id) => walls.some((w) => w.id === id));
    if (!existing.length) return;
    pushUndoSnapshot();

    // Móvel não tem roomId — pertence ao cômodo por posição, igual ao
    // arraste rígido (ver dragElementStart.furnitureSnapshots no
    // ViewportController). Calcula a mesma caixa delimitadora ANTES de
    // apagar as paredes, senão perde a referência de onde o cômodo
    // estava, e apaga os móveis dentro dela junto — sem isso eles
    // ficavam órfãos, soltos no vazio.
    let roomMinX = Infinity, roomMaxX = -Infinity, roomMinY = Infinity, roomMaxY = -Infinity;
    const growBounds = (px: number, py: number) => {
      if (px < roomMinX) roomMinX = px; if (px > roomMaxX) roomMaxX = px;
      if (py < roomMinY) roomMinY = py; if (py > roomMaxY) roomMaxY = py;
    };
    existing.forEach((id) => {
      const w = walls.find((w2) => w2.id === id)!;
      growBounds(w.x1, w.y1);
      growBounds(w.x2, w.y2);
    });
    const furniture = currentFurniture();
    const deletedFurnitureIds: string[] = [];
    for (let k = furniture.length - 1; k >= 0; k--) {
      const f = furniture[k]!;
      if (f.x >= roomMinX && f.x <= roomMaxX && f.y >= roomMinY && f.y <= roomMaxY) {
        deletedFurnitureIds.push(f.id);
        furniture.splice(k, 1);
      }
    }

    const openings = currentOpenings();
    existing.forEach((id) => {
      let idx = -1;
      for (let i = 0; i < walls.length; i++) if (walls[i]!.id === id) { idx = i; break; }
      if (idx >= 0) walls.splice(idx, 1);
      for (let j = openings.length - 1; j >= 0; j--) {
        if (openings[j]!.wallId === id) openings.splice(j, 1);
      }
    });
    emit({ type: 'RoomDeleted', floorIndex: project.currentFloorIndex, wallIds: existing, furnitureIds: deletedFurnitureIds });
  },

  clearCurrentFloor(): void {
    pushUndoSnapshot();
    currentFloor().walls = [];
    currentFloor().columns = [];
    currentFloor().roofs = [];
    currentFloor().openings = [];
    currentFloor().varandas = [];
    emit({ type: 'FloorCleared', floorIndex: project.currentFloorIndex });
  },

  // Insere uma porta/janela genérica na parede clicada.
  // productOverride vem do seletor de esquadria (material → modelo
  // escolhido ANTES de clicar na parede, ver ViewportController
  // refreshOpeningPickerPanel): a Opening já nasce do tamanho real do
  // modelo (Product.assets.nominalWidthM/nominalHeightM) e já com
  // productId, em vez do tamanho padrão genérico + productId vazio.
  insertOpening(wallId: string, kind: OpeningKind, px: number, py: number, productOverride?: { productId: string; widthM: number; heightM: number }): Opening | null {
    const w = findWall(wallId); if (!w) return null;
    const width = productOverride ? productOverride.widthM : (kind === 'door' ? Core.DOOR_DEFAULT_WIDTH : kind === 'arco' ? Core.ARCO_DEFAULT_WIDTH : Core.WINDOW_DEFAULT_WIDTH);
    const desired = Core.wallOffsetAtPoint(w, px, py);
    const offset = Core.findValidOpeningOffset(w, currentOpenings(), width, desired);
    if (offset == null) return null; // parede curta demais / sem espaço livre
    const op = Core.createOpeningEntity(wallId, kind, offset);
    if (productOverride) { op.width = productOverride.widthM; op.height = productOverride.heightM; op.productId = productOverride.productId; }
    if (!openingFitsCurrentRoof(w, op)) return null;
    pushUndoSnapshot();
    currentOpenings().push(op);
    emit({ type: 'OpeningCreated', floorIndex: project.currentFloorIndex, openingId: op.id });
    return op;
  },

  // Arraste ao vivo — desliza a abertura ao longo da MESMA parede.
  updateOpeningOffsetLive(openingId: string, desiredOffset: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const offset = Core.findValidOpeningOffset(w, currentOpenings(), op.width, desiredOffset, openingId);
    if (offset == null) return;
    if (!openingFitsCurrentRoof(w, { ...op, offset })) return;
    op.offset = offset;
    emit({ type: 'OpeningMoved', openingId, live: true });
  },

  // Botões ←/→ do gizmo: passo fixo pequeno, com undo próprio.
  nudgeOpening(openingId: string, deltaMeters: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const offset = Core.findValidOpeningOffset(w, currentOpenings(), op.width, op.offset + deltaMeters, openingId);
    if (offset == null) return;
    if (!openingFitsCurrentRoof(w, { ...op, offset })) return;
    pushUndoSnapshot();
    op.offset = offset;
    emit({ type: 'OpeningMoved', openingId });
  },

  // Arraste ao vivo — redimensiona a LARGURA puxando uma borda (a outra
  // fica fixa). Um único passo de undo cobre o gesto inteiro (ver
  // beginTransaction, chamado no início do arraste pelo ViewportController).
  resizeOpeningEdgeLive(openingId: string, edge: 'left' | 'right', desiredOffset: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const result = Core.resolveOpeningEdgeResize(w, currentOpenings(), openingId, edge, desiredOffset);
    if (!result) return;
    if (!openingFitsCurrentRoof(w, { ...op, offset: result.offset, width: result.width })) return;
    op.offset = result.offset;
    op.width = result.width;
    emit({ type: 'OpeningResized', openingId, live: true });
  },

  // Arraste ao vivo — redimensiona a ALTURA puxando o topo (o peitoril,
  // base do vão, fica fixo).
  resizeOpeningHeightLive(openingId: string, desiredTop: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const roof = generatedAtticRoofForWall(w.id);
    const roofLimit = roof ? Core.atticOpeningMaxTopMeters(w, roof, op.offset, op.width) - 0.02 : Infinity;
    op.height = Core.resolveOpeningHeightResize(op, Math.min(desiredTop, roofLimit));
    emit({ type: 'OpeningResized', openingId, live: true });
  },

  deleteOpening(openingId: string): void {
    const openings = currentOpenings();
    let idx = -1;
    for (let i = 0; i < openings.length; i++) if (openings[i]!.id === openingId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    openings.splice(idx, 1);
    emit({ type: 'OpeningDeleted', openingId });
  },

  // Escolhe (ou remove, com productId undefined) o modelo glTF do
  // Catálogo que representa fisicamente esta porta/janela — ver
  // Opening.productId. Não mexe em width/height/sillHeight: a pessoa
  // continua controlando o TAMANHO do vão normalmente; o modelo (se
  // houver) é escalado pra caber nesse vão na hora de renderizar
  // (Scene3DRenderer.buildOpeningModelPiece), não o contrário.
  setOpeningProduct(openingId: string, productId: string | undefined): void {
    const op = findOpening(openingId); if (!op) return;
    pushUndoSnapshot();
    if (productId) op.productId = productId; else delete op.productId;
    emit({ type: 'OpeningProductChanged', openingId, productId });
  },

  createColumn(x: number, y: number, shape?: ColumnShape): Column {
    pushUndoSnapshot();
    const col = Core.createColumnEntity(Core.snap(x), Core.snap(y), shape);
    currentColumns().push(col);
    emit({ type: 'ColumnCreated', floorIndex: project.currentFloorIndex, columnId: col.id });
    return col;
  },

  moveColumnBody(columnId: string, x: number, y: number): void {
    const c = findColumn(columnId); if (!c) return;
    pushUndoSnapshot();
    c.x = Core.snap(x); c.y = Core.snap(y);
    emit({ type: 'ColumnMoved', columnId });
  },
  updateColumnBodyLive(columnId: string, x: number, y: number): void {
    const c = findColumn(columnId); if (!c) return;
    c.x = x; c.y = y;
    emit({ type: 'ColumnMoved', columnId, live: true });
  },

  duplicateColumn(columnId: string): Column | null {
    const c = findColumn(columnId); if (!c) return null;
    pushUndoSnapshot();
    const copy = Core.createColumnEntity(c.x + Core.GRID, c.y + Core.GRID, c.shape);
    currentColumns().push(copy);
    emit({ type: 'ColumnCreated', floorIndex: project.currentFloorIndex, columnId: copy.id, duplicatedFrom: columnId });
    return copy;
  },

  deleteColumn(columnId: string): void {
    const columns = currentColumns();
    let idx = -1;
    for (let i = 0; i < columns.length; i++) if (columns[i]!.id === columnId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    columns.splice(idx, 1);
    emit({ type: 'ColumnDeleted', columnId });
  },

  setColumnShape(columnId: string, shape: ColumnShape): void {
    const c = findColumn(columnId); if (!c) return;
    if (['quadrada', 'redonda'].indexOf(shape) === -1) return;
    c.shape = shape;
    emit({ type: 'ColumnShapeChanged', columnId, value: shape });
  },

  // Telhado é um objeto de verdade — nasce de um clique (igual
  // parede/coluna). x1,y1,x2,y2 são os dois cantos do retângulo que cobre.
  createRoof(x1: number, y1: number, x2: number, y2: number, type?: RoofType, attic = false): Roof | null {
    // sem Core.snap() aqui de propósito — ver comentário histórico completo.
    if (x1 === x2 || y1 === y2) return null;
    pushUndoSnapshot();
    const roof = Core.createRoofEntity(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), type, undefined, undefined, undefined, undefined, attic ? 'preview' : undefined, attic ? 1.2 : undefined);
    currentRoofs().push(roof);
    autoComposeCurrentRoofs();
    emit({ type: 'RoofCreated', floorIndex: project.currentFloorIndex, roofId: roof.id });
    return roof;
  },

  // Funde dois telhados que são literalmente a MESMA água continuando.
  fuseRoofs(roofAId: string, roofBId: string): Roof | null {
    const a = findRoof(roofAId), b = findRoof(roofBId);
    if (!a || !b) return null;
    const bounds = Core.fusedRoofBounds(a, b);
    a.x1 = bounds.x1; a.y1 = bounds.y1; a.x2 = bounds.x2; a.y2 = bounds.y2;
    const roofs = currentRoofs();
    let idx = -1;
    for (let i = 0; i < roofs.length; i++) if (roofs[i]!.id === b.id) { idx = i; break; }
    if (idx >= 0) roofs.splice(idx, 1);
    emit({ type: 'RoofsFused', floorIndex: project.currentFloorIndex, roofId: a.id, fusedFrom: b.id });
    return a;
  },

  duplicateRoof(roofId: string): Roof | null {
    const r = findRoof(roofId); if (!r) return null;
    pushUndoSnapshot();
    const offset = Core.GRID;
    const copy = Core.createRoofEntity(r.x1 + offset, r.y1 + offset, r.x2 + offset, r.y2 + offset, r.type, r.pitchDeg, r.ridgeAxis, undefined, r.parapetHeight, r.atticMode, r.baseHeightM);
    currentRoofs().push(copy);
    emit({ type: 'RoofCreated', floorIndex: project.currentFloorIndex, roofId: copy.id, duplicatedFrom: roofId });
    return copy;
  },

  // Gira a direção da cumeeira manualmente — a única forma dela mudar
  // agora, nunca sozinha ao redimensionar.
  rotateRoofAxis(roofId: string): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.ridgeAxis = r.ridgeAxis === 'x' ? 'y' : 'x';
    emit({ type: 'RoofAxisChanged', roofId });
  },

  deleteRoof(roofId: string): void {
    const roofs = currentRoofs();
    let idx = -1;
    for (let i = 0; i < roofs.length; i++) if (roofs[i]!.id === roofId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    roofs.splice(idx, 1);
    emit({ type: 'RoofDeleted', roofId });
  },

  setRoofPieceType(roofId: string, type: RoofType): void {
    const r = findRoof(roofId); if (!r) return;
    if (['duasAguas', 'quatroAguas', 'umaAgua', 'platibanda'].indexOf(type) === -1) return;
    r.type = type;
    emit({ type: 'RoofTypeChanged', roofId, value: type });
  },

  // Alça da cumeeira: arrastar pra cima/baixo recalcula a inclinação.
  setRoofPitch(roofId: string, pitchDeg: number): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.pitchDeg = Math.max(5, Math.min(75, pitchDeg));
    emit({ type: 'RoofPitchChanged', roofId });
  },
  updateRoofPitchLive(roofId: string, pitchDeg: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.pitchDeg = Math.max(5, Math.min(75, pitchDeg));
    emit({ type: 'RoofPitchChanged', roofId, live: true });
  },

  // Alça de altura do parapeito da platibanda — mesmo padrão da cumeeira
  // (setRoofPitch/updateRoofPitchLive): arrastar pra cima/baixo
  // recalcula a altura, clampada num intervalo razoável de parapeito
  // (20cm a 1,2m).
  setRoofParapetHeight(roofId: string, height: number): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.parapetHeight = Math.max(0.2, Math.min(1.2, height));
    emit({ type: 'RoofParapetHeightChanged', roofId });
  },
  updateRoofParapetHeightLive(roofId: string, height: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.parapetHeight = Math.max(0.2, Math.min(1.2, height));
    emit({ type: 'RoofParapetHeightChanged', roofId, live: true });
  },

  // Alças das bordas: arrastar uma borda estica/encolhe só aquele lado.
  updateRoofBoundsLive(roofId: string, x1: number, y1: number, x2: number, y2: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.x1 = x1; r.y1 = y1; r.x2 = x2; r.y2 = y2;
    emit({ type: 'RoofBoundsChanged', roofId, live: true });
  },

  updateOpeningSillHeightLive(openingId: string, sillHeight: number): void {
    const op = findOpening(openingId); if (!op) return;
    const wall = findWall(op.wallId); if (!wall) return;
    const roof = generatedAtticRoofForWall(wall.id);
    const roofLimit = roof ? Core.atticOpeningMaxTopMeters(wall, roof, op.offset, op.width) - 0.02 : Core.WALL_HEIGHT - 0.05;
    op.sillHeight = Math.max(0, Math.min(roofLimit - op.height, sillHeight));
    emit({ type: 'OpeningMovedVertically', openingId, live: true });
  },
  autoComposeRoofs(): string[][] {
    const groups = autoComposeCurrentRoofs();
    emit({ type: 'RoofCompositionChanged', floorIndex: project.currentFloorIndex, groups });
    return groups;
  },
  updateRoofsGroupBodyLive(snapshots: { id: string; x1: number; y1: number; x2: number; y2: number }[], dx: number, dy: number): void {
    snapshots.forEach((snapshot) => {
      const roof = findRoof(snapshot.id); if (!roof) return;
      roof.x1 = snapshot.x1 + dx; roof.y1 = snapshot.y1 + dy;
      roof.x2 = snapshot.x2 + dx; roof.y2 = snapshot.y2 + dy;
    });
    emit({ type: 'RoofGroupDragged', roofIds: snapshots.map((snapshot) => snapshot.id), live: true });
  },

  commitRoofCompound(roofIds: string[]): string | null {
    const roofs = roofIds.map((id) => findRoof(id)).filter((roof): roof is Roof => !!roof);
    if (roofs.length < 2) return null;
    pushUndoSnapshot();
    const groupId = Core.nextId('roof-group');
    roofs.forEach((roof) => { roof.compoundGroupId = groupId; });
    emit({ type: 'RoofCompoundCommitted', roofIds: roofs.map((roof) => roof.id), groupId });
    return groupId;
  },

  // Varanda: mesmo padrão do telhado — objeto independente, nasce de um
  // clique, x1..y2 são os dois cantos do piso.
  createVaranda(x1: number, y1: number, x2: number, y2: number, frontSide?: VarandaFrontSide): Varanda | null {
    if (x1 === x2 || y1 === y2) return null;
    pushUndoSnapshot();
    const v = Core.createVarandaEntity(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), frontSide);
    currentVarandas().push(v);
    emit({ type: 'VarandaCreated', floorIndex: project.currentFloorIndex, varandaId: v.id });
    return v;
  },

  createContourVaranda(postMaterial: 'madeira' | 'concreto' | 'tijolo', widthM = 2.2): Varanda | null {
    // Nasce isolada, como um módulo de 3 × 2,2 m. A aderência à casa só
    // acontece quando o usuário a arrasta para perto de uma parede.
    const walls = currentWalls();
    const bounds = walls.length ? {
      minX: Math.min(...walls.flatMap((wall) => [wall.x1, wall.x2])), minY: Math.min(...walls.flatMap((wall) => [wall.y1, wall.y2])),
      maxX: Math.max(...walls.flatMap((wall) => [wall.x1, wall.x2])), maxY: Math.max(...walls.flatMap((wall) => [wall.y1, wall.y2])),
    } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const x1 = bounds.maxX + Core.GRID * 2, y1 = bounds.minY;
    const x2 = x1 + Core.GRID * 3, y2 = y1;
    pushUndoSnapshot();
    const varanda = Core.createVarandaEntity(x1, y1, x2, y1 + widthM * Core.GRID, 'minZ');
    varanda.contourSegments = [{ wallId: '', x1, y1, x2, y2, outwardSign: 1 }];
    varanda.widthM = Math.max(0.8, Math.min(5, widthM));
    varanda.postMaterial = postMaterial;
    varanda.heightM = 2.7;
    varanda.pitchDeg = 12;
    currentVarandas().push(varanda);
    emit({ type: 'ContourVarandaCreated', varandaId: varanda.id, segmentCount: 1, postMaterial });
    return varanda;
  },

  updateVarandaBodyLive(varandaId: string, dx: number, dy: number, snapToWalls = true): void {
    const varanda = findVaranda(varandaId); if (!varanda) return;
    const source = varanda.contourSegments?.length ? varanda.contourSegments : [{ wallId: '', x1: varanda.x1, y1: varanda.y1, x2: varanda.x2, y2: varanda.y1, outwardSign: 1 as const }];
    const moved = source.map((segment) => ({ ...segment, x1: segment.x1 + dx, y1: segment.y1 + dy, x2: segment.x2 + dx, y2: segment.y2 + dy }));
    const snapped = snapToWalls && moved.length === 1 ? Core.snapVarandaSegmentToExteriorWalls(moved[0]!.x1, moved[0]!.y1, moved[0]!.x2, moved[0]!.y2, currentWalls()) : null;
    varanda.contourSegments = snapped ? [snapped] : moved;
    if (snapped) varanda.attachedWallId = snapped.wallId; else delete varanda.attachedWallId;
    const xs = varanda.contourSegments.flatMap((s) => [s.x1, s.x2]), ys = varanda.contourSegments.flatMap((s) => [s.y1, s.y2]);
    varanda.x1 = Math.min(...xs); varanda.x2 = Math.max(...xs); varanda.y1 = Math.min(...ys); varanda.y2 = Math.max(...ys);
    emit({ type: 'VarandaBodyChanged', varandaId, live: true, snapped: !!snapped });
  },

  extendVarandaLive(varandaId: string, targetX: number, targetY: number, forceStraight = false): void {
    const varanda = findVaranda(varandaId); if (!varanda?.contourSegments?.length) return;
    const first = varanda.contourSegments[0]!;
    if (forceStraight || !varanda.attachedWallId) {
      const dx = first.x2 - first.x1, dy = first.y2 - first.y1, len = Math.hypot(dx, dy) || 1;
      const distance = (targetX - first.x1) * dx / len + (targetY - first.y1) * dy / len;
      varanda.contourSegments = [{ ...first, x2: first.x1 + dx / len * distance, y2: first.y1 + dy / len * distance }];
    } else {
      varanda.contourSegments = Core.extendVarandaAlongExteriorWalls({ ...first, wallId: varanda.attachedWallId }, targetX, targetY, currentWalls());
    }
    const xs = varanda.contourSegments.flatMap((s) => [s.x1, s.x2]), ys = varanda.contourSegments.flatMap((s) => [s.y1, s.y2]);
    varanda.x1 = Math.min(...xs); varanda.x2 = Math.max(...xs); varanda.y1 = Math.min(...ys); varanda.y2 = Math.max(...ys);
    emit({ type: 'VarandaExtended', varandaId, live: true, forceStraight });
  },

  setVarandaParameters(varandaId: string, widthM: number, heightM: number, pitchDeg: number): void {
    const varanda = findVaranda(varandaId); if (!varanda) return;
    pushUndoSnapshot();
    varanda.widthM = Math.max(0.8, Math.min(6, widthM));
    varanda.heightM = Math.max(2, Math.min(6, heightM));
    varanda.pitchDeg = Math.max(2, Math.min(60, pitchDeg));
    emit({ type: 'VarandaParametersChanged', varandaId });
  },

  updateVarandaBoundsLive(varandaId: string, x1: number, y1: number, x2: number, y2: number): void {
    const v = findVaranda(varandaId); if (!v) return;
    v.x1 = x1; v.y1 = y1; v.x2 = x2; v.y2 = y2;
    emit({ type: 'VarandaBoundsChanged', varandaId, live: true });
  },

  // Gira qual lado é a frente (onde ficam as colunas) em passos de 90°.
  rotateVarandaFront(varandaId: string): void {
    const v = findVaranda(varandaId); if (!v) return;
    pushUndoSnapshot();
    const order: VarandaFrontSide[] = ['minZ', 'maxX', 'maxZ', 'minX'];
    const idx = order.indexOf(v.frontSide);
    v.frontSide = order[(idx + 1) % order.length]!;
    if (v.contourSegments?.length) {
      const cx = (v.x1 + v.x2) / 2, cy = (v.y1 + v.y2) / 2;
      v.contourSegments = v.contourSegments.map((segment) => ({ ...segment,
        x1: cx - (segment.y1 - cy), y1: cy + (segment.x1 - cx),
        x2: cx - (segment.y2 - cy), y2: cy + (segment.x2 - cx), wallId: '',
      }));
      delete v.attachedWallId;
      const xs = v.contourSegments.flatMap((s) => [s.x1, s.x2]), ys = v.contourSegments.flatMap((s) => [s.y1, s.y2]);
      v.x1 = Math.min(...xs); v.x2 = Math.max(...xs); v.y1 = Math.min(...ys); v.y2 = Math.max(...ys);
    }
    emit({ type: 'VarandaFrontChanged', varandaId });
  },

  deleteVaranda(varandaId: string): void {
    const list = currentVarandas();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === varandaId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'VarandaDeleted', varandaId });
  },

  // Laje: mesmo padrão de telhado/varanda — objeto independente, nasce
  // de um clique, redimensiona por ARESTA (não mais um retângulo de 4
  // lados fixos — depois de fundir, o contorno pode ter mais de 4
  // pontos, ex.: um "L") SEM travar em nenhum contorno de parede (pode
  // encolher pra virar um vão aberto, ou crescer além da parede pra
  // virar balanço/sacada — ver DEC-35/37).
  createLaje(points: { x: number; y: number }[]): Laje | null {
    if (!points || points.length < 4) return null;
    pushUndoSnapshot();
    const l = Core.createLajeEntity(points);
    currentLajes().push(l);
    emit({ type: 'LajeCreated', floorIndex: project.currentFloorIndex, lajeId: l.id });
    return l;
  },

  // Arrasta UMA aresta do contorno (o segmento entre points[edgeIndex]
  // e o próximo, sempre horizontal ou vertical) — atualiza os dois
  // pontos que a formam, mantendo o resto do contorno intacto. Esse é
  // o jeito de reshapear a laje aresta por aresta, cada uma
  // independente das outras.
  updateLajeEdgeLive(lajeId: string, edgeIndex: number, newValue: number): void {
    const l = findLaje(lajeId); if (!l) return;
    const n = l.points.length;
    if (edgeIndex < 0 || edgeIndex >= n) return;
    const p1 = l.points[edgeIndex]!, p2 = l.points[(edgeIndex + 1) % n]!;
    if (Math.abs(p1.x - p2.x) < 1e-6) { p1.x = newValue; p2.x = newValue; }
    else { p1.y = newValue; p2.y = newValue; }
    emit({ type: 'LajeBoundsChanged', lajeId, live: true });
  },

  // Move a laje INTEIRA (o "bloco" todo, sem mudar o formato) —
  // substitui o contorno pelos mesmos pontos deslocados. Usado pelo
  // arraste do corpo (clique fora das alças de aresta), com o ímã de
  // encaixe calculado no ViewportController (ver DEC-37 — decisão
  // revista: sem fusão automática, só um snap pra ficar colada na
  // vizinha sem sobrepor).
  updateLajePointsLive(lajeId: string, points: { x: number; y: number }[]): void {
    const l = findLaje(lajeId); if (!l) return;
    l.points = points;
    emit({ type: 'LajeBoundsChanged', lajeId, live: true });
  },

  deleteLaje(lajeId: string): void {
    const list = currentLajes();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === lajeId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'LajeDeleted', lajeId });
  },

  // Painel de Envidraçamento (DEC-56) — nasce solto (state: 'preview'),
  // na posição dada, com tamanho/módulo padrão. Etapa 2a: só criação e
  // exclusão; arraste de redimensionamento, ímã de encosto na parede e
  // a transição pra 'attached' ficam pra Etapa 2b.
  createGlazingPanel(x: number, y: number): GlazingPanel | null {
    pushUndoSnapshot();
    const p = Core.createGlazingPanelEntity(x, y);
    currentGlazingPanels().push(p);
    emit({ type: 'GlazingPanelCreated', floorIndex: project.currentFloorIndex, glazingPanelId: p.id });
    return p;
  },

  // Arrasta o corpo do painel ainda solto (state 'preview') — mesmo
  // padrão "Live" de updateColumnBodyLive/updateFurnitureBodyLive (sem
  // empilhar undo a cada frame; o snapshot de undo já foi criado no
  // início do arraste, por beginTransaction).
  updateGlazingPanelBodyLive(glazingPanelId: string, x: number, y: number): void {
    const p = findGlazingPanel(glazingPanelId); if (!p || p.state !== 'preview') return;
    p.x = x; p.y = y;
    emit({ type: 'GlazingPanelMoved', glazingPanelId, live: true });
  },

  // Confirma o redimensionamento da fachada uma única vez ao soltar a
  // alça. A prévia é responsabilidade exclusiva do viewport, portanto
  // esta operação não participa do pointermove e não reconstrói a cena
  // dezenas de vezes por segundo.
  updateGlazingPanelSizeLive(glazingPanelId: string, widthM: number, heightM: number, centerDeltaM = 0): void {
    const p = findGlazingPanel(glazingPanelId); if (!p) return;
    let maxWidthM = 20;
    // Pele de vidro (Product Owner) é um painel independente que só usa
    // a parede pra POSIÇÃO/ângulo, não um vão recortado dentro dela —
    // por isso a altura não trava mais em `Core.WALL_HEIGHT -
    // sillHeightM` (isso limitava a uns 2,7-2,8m qualquer painel
    // encostado, mesmo pedido explícito de "altura contínua, maior que
    // a parede"). Mesmo teto generoso (10m) do painel solto, pros dois
    // casos — segurança de faixa, não recorte físico da parede.
    const maxHeightM = 10;
    if (p.state === 'attached' && p.wallId) {
      const wall = findWall(p.wallId);
      if (!wall) return;
      const wallLenM = Core.wallLengthMeters(wall);
      maxWidthM = Math.max(0.5, wallLenM);
    }
    const finalWidthM = Math.max(0.5, Math.min(maxWidthM, widthM));
    if (p.state === 'attached' && p.wallId) {
      const wall = findWall(p.wallId)!;
      const wallLenM = Core.wallLengthMeters(wall);
      p.offsetM = Math.max(finalWidthM / 2, Math.min(wallLenM - finalWidthM / 2, (p.offsetM ?? wallLenM / 2) + centerDeltaM));
    } else if (centerDeltaM) {
      const angle = (p.rotationDeg || 0) * Math.PI / 180;
      p.x = (p.x || 0) + Math.cos(angle) * centerDeltaM * Core.GRID;
      p.y = (p.y || 0) + Math.sin(angle) * centerDeltaM * Core.GRID;
    }
    p.widthM = finalWidthM;
    p.heightM = Math.max(0.5, Math.min(maxHeightM, heightM));
    emit({ type: 'GlazingPanelResized', glazingPanelId, live: true });
  },

  setGlazingGlassMaterial(glazingPanelId: string, material: GlazingGlassMaterial | null): void {
    const panel = findGlazingPanel(glazingPanelId); if (!panel) return;
    pushUndoSnapshot();
    if (material) panel.glassMaterial = { ...material };
    else delete panel.glassMaterial;
    emit({ type: 'GlazingPanelMaterialChanged', glazingPanelId });
  },

  updateGlazingGlassMaterialLive(glazingPanelId: string, material: GlazingGlassMaterial): void {
    const panel = findGlazingPanel(glazingPanelId); if (!panel) return;
    panel.glassMaterial = { ...material };
    emit({ type: 'GlazingPanelMaterialChanged', glazingPanelId, live: true });
  },

  // Confirma o encosto numa parede (ímã calculado no
  // ViewportController, ao soltar o arraste) — DEC-56: painel some da
  // posição livre e passa a ser derivado de wallId + offsetM;
  // widthM/heightM ficam travados no limite disponível da parede
  // (nunca sobra painel pra fora do vão). sillHeightM = 0 (do chão ao
  // teto) por padrão nesta etapa — ajuste fino fica pra depois.
  attachGlazingPanelToWall(glazingPanelId: string, wallId: string): void {
    const p = findGlazingPanel(glazingPanelId); if (!p || p.state !== 'preview') return;
    const w = findWall(wallId); if (!w) return;
    const wallLenM = Core.wallLengthMeters(w);
    if (wallLenM < 1e-6) return;
    pushUndoSnapshot();
    const widthM = Math.min(p.widthM, wallLenM);
    const heightM = Math.min(p.heightM, Core.WALL_HEIGHT);
    const ux = (w.x2 - w.x1) / (wallLenM * Core.GRID), uy = (w.y2 - w.y1) / (wallLenM * Core.GRID);
    const rawOffsetM = (((p.x ?? w.x1) - w.x1) * ux + ((p.y ?? w.y1) - w.y1) * uy) / Core.GRID;
    const offsetM = Math.max(widthM / 2, Math.min(wallLenM - widthM / 2, rawOffsetM));
    // Lado do eixo da parede em que o painel estava ao soltar — mesmo
    // teste de sinal (produto vetorial 2D) usado em
    // findRoomsAdjacentToOpening. Sem isso, o vidro (que fica só na face da
    // FRENTE do painel, não centralizado no Z local — ver
    // buildGlazingPanelGroup) virava pro lado que a parede por acaso
    // tinha sido desenhada (x1→x2), não pro lado que o Product Owner
    // realmente queria (relatado como "o vidro fica virado pra dentro
    // da casa").
    const nx = -uy, ny = ux;
    const projX = w.x1 + ux * rawOffsetM * Core.GRID, projY = w.y1 + uy * rawOffsetM * Core.GRID;
    const side = ((p.x ?? projX) - projX) * nx + ((p.y ?? projY) - projY) * ny;
    p.state = 'attached';
    p.widthM = widthM; p.heightM = heightM;
    p.wallId = wallId; p.offsetM = offsetM; p.sillHeightM = 0;
    p.normalSign = side < 0 ? -1 : 1;
    delete p.x; delete p.y; delete p.rotationDeg;
    emit({ type: 'GlazingPanelAttached', glazingPanelId, wallId });
  },

  deleteGlazingPanel(glazingPanelId: string): void {
    const list = currentGlazingPanels();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === glazingPanelId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'GlazingPanelDeleted', glazingPanelId });
  },

  // Sacada de vidro (guarda-corpo procedural, categoria Aberturas) —
  // mesmo espírito de peça solta do painel de Envidraçamento acima, mas
  // sem máquina de estados preview/attached: nunca encosta em parede
  // (confirmado com o Product Owner — "sim solta, pode ser deslocada
  // para as quatro direções"), sempre livre. Altura fixa nesta versão;
  // só a largura tem alça de arraste (esquerda/direita).
  createBalconyRailing(x: number, y: number): BalconyRailing | null {
    pushUndoSnapshot();
    const r = Core.createBalconyRailingEntity(x, y);
    currentBalconyRailings().push(r);
    emit({ type: 'BalconyRailingCreated', floorIndex: project.currentFloorIndex, balconyRailingId: r.id });
    return r;
  },

  // Arrasta o corpo livremente nas 4 direções — mesmo padrão "Live" de
  // updateGlazingPanelBodyLive, sem a etapa de ímã de parede (a sacada
  // nunca encosta).
  updateBalconyRailingBodyLive(balconyRailingId: string, x: number, y: number): void {
    const r = findBalconyRailing(balconyRailingId); if (!r) return;
    r.x = x; r.y = y;
    emit({ type: 'BalconyRailingMoved', balconyRailingId, live: true });
  },

  // Confirma o redimensionamento da largura ao soltar a alça (mesmo
  // padrão de updateGlazingPanelSizeLive) — sem parede pra limitar a
  // largura máxima, teto generoso de 30m.
  updateBalconyRailingSizeLive(balconyRailingId: string, widthM: number, centerDeltaM = 0): void {
    const r = findBalconyRailing(balconyRailingId); if (!r) return;
    const finalWidthM = Math.max(0.5, Math.min(30, widthM));
    if (centerDeltaM) {
      const angle = (r.rotationDeg || 0) * Math.PI / 180;
      r.x = (r.x || 0) + Math.cos(angle) * centerDeltaM * Core.GRID;
      r.y = (r.y || 0) + Math.sin(angle) * centerDeltaM * Core.GRID;
    }
    r.widthM = finalWidthM;
    emit({ type: 'BalconyRailingResized', balconyRailingId, live: true });
  },

  // Confirma altura/elevação ao soltar a alça de CIMA (estica heightM,
  // sillHeightM fixo) ou a alça de BAIXO (sobe/desce sillHeightM,
  // heightM fixo — Product Owner: "movimentar para cima com o arraste
  // do mouse") — chamado pelas duas, cada uma só muda o valor que é
  // "dono" do próprio arraste, mantendo o outro como estava.
  updateBalconyRailingVerticalLive(balconyRailingId: string, heightM: number, sillHeightM: number): void {
    const r = findBalconyRailing(balconyRailingId); if (!r) return;
    r.heightM = Math.max(Core.BALCONY_MIN_HEIGHT_M, Math.min(Core.BALCONY_MAX_HEIGHT_M, heightM));
    r.sillHeightM = Math.max(0, Math.min(Core.BALCONY_MAX_SILL_HEIGHT_M, sillHeightM));
    emit({ type: 'BalconyRailingResized', balconyRailingId, live: true });
  },

  // Gira em passos fixos — cópia exata de rotateFurniture (mesmo botão
  // de girar dos móveis, "igual aos móveis" pedido pelo Product Owner).
  rotateBalconyRailing(balconyRailingId: string, stepDeg?: number): void {
    const r = findBalconyRailing(balconyRailingId); if (!r) return;
    pushUndoSnapshot();
    const step = stepDeg || 90;
    r.rotationDeg = (r.rotationDeg + step + 360) % 360;
    emit({ type: 'BalconyRailingRotated', balconyRailingId });
  },

  setBalconyRailingGlassMaterial(balconyRailingId: string, material: GlazingGlassMaterial | null): void {
    const r = findBalconyRailing(balconyRailingId); if (!r) return;
    pushUndoSnapshot();
    if (material) r.glassMaterial = { ...material };
    else delete r.glassMaterial;
    emit({ type: 'BalconyRailingMaterialChanged', balconyRailingId });
  },

  updateBalconyRailingGlassMaterialLive(balconyRailingId: string, material: GlazingGlassMaterial): void {
    const r = findBalconyRailing(balconyRailingId); if (!r) return;
    r.glassMaterial = { ...material };
    emit({ type: 'BalconyRailingMaterialChanged', balconyRailingId, live: true });
  },

  deleteBalconyRailing(balconyRailingId: string): void {
    const list = currentBalconyRailings();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === balconyRailingId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'BalconyRailingDeleted', balconyRailingId });
  },

  // Bloco de Volumetria — sempre livre nas 3 dimensões, sem ímã de
  // parede (Product Owner: "tirar o imã e fazer as alças em todas as
  // direções, para que ele possa formar sacadas, marquises, volumetria,
  // etc") — mesmo espírito de BalconyRailing (sem máquina de estados
  // preview/attached), aplicado a um box sólido e pintável.
  createVolumeBox(x: number, y: number): VolumeBox | null {
    pushUndoSnapshot();
    const b = Core.createVolumeBoxEntity(x, y);
    currentVolumeBoxes().push(b);
    emit({ type: 'VolumeBoxCreated', floorIndex: project.currentFloorIndex, volumeBoxId: b.id });
    return b;
  },

  // Arrasta o corpo livremente nas 4 direções do plano — mesma técnica
  // "Live" de updateBalconyRailingBodyLive.
  updateVolumeBoxBodyLive(volumeBoxId: string, x: number, y: number): void {
    const b = findVolumeBox(volumeBoxId); if (!b) return;
    b.x = x; b.y = y;
    emit({ type: 'VolumeBoxMoved', volumeBoxId, live: true });
  },

  deleteVolumeBox(volumeBoxId: string): void {
    const list = currentVolumeBoxes();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === volumeBoxId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'VolumeBoxDeleted', volumeBoxId });
  },

  // Gira em passos fixos — cópia exata de rotateFurniture/rotateBalconyRailing.
  rotateVolumeBox(volumeBoxId: string, stepDeg?: number): void {
    const b = findVolumeBox(volumeBoxId); if (!b) return;
    pushUndoSnapshot();
    const step = stepDeg || 90;
    b.rotationDeg = (b.rotationDeg + step + 360) % 360;
    emit({ type: 'VolumeBoxRotated', volumeBoxId });
  },

  // Confirma o redimensionamento da largura ao soltar a alça esquerda/
  // direita — mesmo padrão de updateBalconyRailingSizeLive.
  updateVolumeBoxSizeLive(volumeBoxId: string, widthM: number, centerDeltaM = 0): void {
    const b = findVolumeBox(volumeBoxId); if (!b) return;
    const finalWidthM = Math.max(Core.VOLUME_BOX_MIN_SIZE_M, Math.min(Core.VOLUME_BOX_MAX_SIZE_M, widthM));
    if (centerDeltaM) {
      const angle = (b.rotationDeg || 0) * Math.PI / 180;
      b.x = (b.x || 0) + Math.cos(angle) * centerDeltaM * Core.GRID;
      b.y = (b.y || 0) + Math.sin(angle) * centerDeltaM * Core.GRID;
    }
    b.widthM = finalWidthM;
    emit({ type: 'VolumeBoxResized', volumeBoxId, live: true });
  },

  // Mesma ideia da largura, mas ao longo do eixo PERPENDICULAR
  // (profundidade) — alça de arraste frente/trás.
  updateVolumeBoxDepthLive(volumeBoxId: string, depthM: number, centerDeltaM = 0): void {
    const b = findVolumeBox(volumeBoxId); if (!b) return;
    const finalDepthM = Math.max(Core.VOLUME_BOX_MIN_SIZE_M, Math.min(Core.VOLUME_BOX_MAX_SIZE_M, depthM));
    if (centerDeltaM) {
      const angle = (b.rotationDeg || 0) * Math.PI / 180;
      // Eixo perpendicular ao de largura (mesma convenção nx=-uy,ny=ux
      // já usada em vários lugares do projeto pra normal de parede).
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      b.x = (b.x || 0) + nx * centerDeltaM * Core.GRID;
      b.y = (b.y || 0) + ny * centerDeltaM * Core.GRID;
    }
    b.depthM = finalDepthM;
    emit({ type: 'VolumeBoxResized', volumeBoxId, live: true });
  },

  // Confirma altura/elevação ao soltar a alça de CIMA (estica heightM,
  // sillHeightM fixo) ou a de BAIXO (sobe/desce sillHeightM, heightM
  // fixo) — mesmo comando único de updateBalconyRailingVerticalLive.
  updateVolumeBoxVerticalLive(volumeBoxId: string, heightM: number, sillHeightM: number): void {
    const b = findVolumeBox(volumeBoxId); if (!b) return;
    b.heightM = Math.max(Core.VOLUME_BOX_MIN_HEIGHT_M, Math.min(Core.VOLUME_BOX_MAX_HEIGHT_M, heightM));
    b.sillHeightM = Math.max(0, Math.min(Core.VOLUME_BOX_MAX_SILL_HEIGHT_M, sillHeightM));
    emit({ type: 'VolumeBoxResized', volumeBoxId, live: true });
  },

  // Acabamento tipo parede aplicado pela ferramenta Lata de tinta —
  // mesmo padrão de setWallFinishFace/setRoofFinish, mas sem distinção
  // de face (o box inteiro usa o mesmo acabamento nas 6 faces).
  setVolumeBoxFinish(volumeBoxId: string, productId: string): void {
    const b = findVolumeBox(volumeBoxId); if (!b) return;
    pushUndoSnapshot();
    b.finishProductId = productId;
    emit({ type: 'VolumeBoxFinishSet', volumeBoxId, productId });
  },

  // Escada — sempre livre, sem ímã de parede (mesmo espírito do Bloco de
  // Volumetria); rotação em passos de 90° (Product Owner confirmou:
  // mesmo padrão do resto do app, sem alça de giro livre).
  createStair(x: number, y: number): Stair | null {
    pushUndoSnapshot();
    const s = Core.createStairEntity(x, y);
    currentStairs().push(s);
    emit({ type: 'StairCreated', floorIndex: project.currentFloorIndex, stairId: s.id });
    return s;
  },

  updateStairBodyLive(stairId: string, x: number, y: number): void {
    const s = findStair(stairId); if (!s) return;
    s.x = x; s.y = y;
    emit({ type: 'StairMoved', stairId, live: true });
  },

  deleteStair(stairId: string): void {
    const list = currentStairs();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === stairId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'StairDeleted', stairId });
  },

  // Cópia exata de rotateVolumeBox/rotateFurniture.
  rotateStair(stairId: string, stepDeg?: number): void {
    const s = findStair(stairId); if (!s) return;
    pushUndoSnapshot();
    const step = stepDeg || 90;
    s.rotationDeg = (s.rotationDeg + step + 360) % 360;
    emit({ type: 'StairRotated', stairId });
  },

  // Confirma a largura ao soltar a alça esquerda/direita — mesmo padrão
  // de updateVolumeBoxSizeLive (sem alça de altura/profundidade: a
  // corrida é derivada do pé-direito, não é livre).
  updateStairWidthLive(stairId: string, widthM: number, centerDeltaM = 0): void {
    const s = findStair(stairId); if (!s) return;
    const finalWidthM = Math.max(Core.STAIR_MIN_WIDTH_M, Math.min(Core.STAIR_MAX_WIDTH_M, widthM));
    if (centerDeltaM) {
      const angle = (s.rotationDeg || 0) * Math.PI / 180;
      s.x = (s.x || 0) + Math.cos(angle) * centerDeltaM * Core.GRID;
      s.y = (s.y || 0) + Math.sin(angle) * centerDeltaM * Core.GRID;
    }
    s.widthM = finalWidthM;
    emit({ type: 'StairResized', stairId, live: true });
  },

  // Acabamento tipo parede — mesmo padrão de setVolumeBoxFinish.
  setStairFinish(stairId: string, productId: string): void {
    const s = findStair(stairId); if (!s) return;
    pushUndoSnapshot();
    s.finishProductId = productId;
    emit({ type: 'StairFinishSet', stairId, productId });
  },

  // Troca o modelo (reta/L/U) de uma escada já colocada — mesmo padrão
  // de setColumnShape/setRoofType (escolhido depois de posicionar, via
  // painel próprio no gizmo). A malha .glb correspondente é resolvida
  // pelo Scene3DRenderer.
  setStairModel(stairId: string, model: StairModel): void {
    const s = findStair(stairId); if (!s) return;
    pushUndoSnapshot();
    s.model = model;
    emit({ type: 'StairModelSet', stairId, model });
  },

  // Planta baixa importada (referência visual no chão) — uma por
  // pavimento, por isso "set" (substitui a que já existisse) em vez de
  // "create" numa lista. Ajustes por passo fixo (mover/girar/escalar),
  // mesmo espírito dos comandos de Volumetria acima — arrastar de
  // verdade fica pra uma etapa futura.
  setPlanUnderlay(imageDataUrl: string, naturalAspect: number, x: number, y: number): PlanUnderlay {
    pushUndoSnapshot();
    const u = Core.createPlanUnderlayEntity(imageDataUrl, naturalAspect, x, y);
    currentFloor().planUnderlay = u;
    emit({ type: 'PlanUnderlayCreated', underlayId: u.id });
    return u;
  },

  movePlanUnderlay(dxM: number, dyM: number): void {
    const u = currentFloor().planUnderlay; if (!u) return;
    pushUndoSnapshot();
    u.x += dxM * Core.GRID; u.y += dyM * Core.GRID;
    emit({ type: 'PlanUnderlayMoved', underlayId: u.id });
  },

  rotatePlanUnderlay(deltaDeg: number): void {
    const u = currentFloor().planUnderlay; if (!u) return;
    pushUndoSnapshot();
    u.rotationDeg = ((u.rotationDeg + deltaDeg) % 360 + 360) % 360;
    emit({ type: 'PlanUnderlayRotated', underlayId: u.id });
  },

  scalePlanUnderlay(factor: number): void {
    const u = currentFloor().planUnderlay; if (!u) return;
    pushUndoSnapshot();
    const newWidthM = Math.max(0.5, Math.min(200, u.widthM * factor));
    u.widthM = newWidthM;
    u.heightM = newWidthM / u.naturalAspect;
    emit({ type: 'PlanUnderlayScaled', underlayId: u.id });
  },

  setPlanUnderlayOpacity(opacity: number): void {
    const u = currentFloor().planUnderlay; if (!u) return;
    u.opacity = Math.max(0.1, Math.min(1, opacity));
    emit({ type: 'PlanUnderlayOpacityChanged', underlayId: u.id, live: true });
  },

  togglePlanUnderlayVisible(): void {
    const u = currentFloor().planUnderlay; if (!u) return;
    pushUndoSnapshot();
    u.visible = !u.visible;
    emit({ type: 'PlanUnderlayVisibilityChanged', underlayId: u.id });
  },

  deletePlanUnderlay(): void {
    const f = currentFloor();
    if (!f.planUnderlay) return;
    pushUndoSnapshot();
    const id = f.planUnderlay.id;
    f.planUnderlay = null;
    emit({ type: 'PlanUnderlayDeleted', underlayId: id });
  },

  // Móvel: mesmo padrão de Coluna — um único ponto (x,y), arrastável
  // livremente, mais rotação em passos de 90°. productId aponta pro
  // Catalog (categoria 'furniture'), que resolve qual .glb carregar.
  createFurniture(x: number, y: number, productId: string, rotationDeg?: number, elevationM?: number): Furniture {
    pushUndoSnapshot();
    const item = Core.createFurnitureEntity(x, y, productId, rotationDeg, undefined, elevationM);
    currentFurniture().push(item);
    emit({ type: 'FurnitureCreated', floorIndex: project.currentFloorIndex, furnitureId: item.id });
    return item;
  },

  // Criação silenciosa (sem snapshot de undo próprio) — usada só pelo
  // preenchimento automático ao nascer um cômodo, que já empilha UM
  // snapshot pra criação do cômodo inteiro (paredes + móveis juntos
  // desfazem como uma unidade só, não passo a passo).
  createFurnitureSilent(x: number, y: number, productId: string, rotationDeg?: number, elevationM?: number): Furniture {
    const item = Core.createFurnitureEntity(x, y, productId, rotationDeg, undefined, elevationM);
    currentFurniture().push(item);
    emit({ type: 'FurnitureCreated', floorIndex: project.currentFloorIndex, furnitureId: item.id });
    return item;
  },

  moveFurnitureBody(furnitureId: string, x: number, y: number): void {
    const item = findFurniture(furnitureId); if (!item) return;
    pushUndoSnapshot();
    // Sem Core.snap aqui de propósito: móvel se posiciona livre (não
    // preso ao grid de 50cm), só travado contra parede — ver
    // ViewportController.resolveFurniturePosition, que já resolve isso
    // ANTES de chamar updateFurnitureBodyLive durante o arrasto.
    item.x = x; item.y = y;
    emit({ type: 'FurnitureMoved', furnitureId });
  },
  updateFurnitureBodyLive(furnitureId: string, x: number, y: number): void {
    const item = findFurniture(furnitureId); if (!item) return;
    item.x = x; item.y = y;
    emit({ type: 'FurnitureMoved', furnitureId, live: true });
  },

  rotateFurniture(furnitureId: string, stepDeg?: number): void {
    const item = findFurniture(furnitureId); if (!item) return;
    pushUndoSnapshot();
    const step = stepDeg || 90;
    item.rotationDeg = (item.rotationDeg + step + 360) % 360;
    emit({ type: 'FurnitureRotated', furnitureId });
  },

  duplicateFurniture(furnitureId: string): Furniture | null {
    const item = findFurniture(furnitureId); if (!item) return null;
    pushUndoSnapshot();
    const copy = Core.createFurnitureEntity(item.x + Core.GRID, item.y + Core.GRID, item.productId, item.rotationDeg);
    currentFurniture().push(copy);
    emit({ type: 'FurnitureCreated', floorIndex: project.currentFloorIndex, furnitureId: copy.id, duplicatedFrom: furnitureId });
    return copy;
  },

  deleteFurniture(furnitureId: string): void {
    const list = currentFurniture();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === furnitureId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'FurnitureDeleted', furnitureId });
  },

  addFloor(): void {
    pushUndoSnapshot();
    const floorNumber = project.floors.length;
    const floor = Core.createFloorEntity(floorNumber + 'º Pavimento');
    project.floors.push(floor);
    project.currentFloorIndex = project.floors.length - 1;
    emit({ type: 'FloorAdded', floorId: floor.id });
  },

  updateRoofBaseHeightLive(roofId: string, heightM: number): void {
    const r = findRoof(roofId); if (!r || !r.atticMode) return;
    r.baseHeightM = Math.max(0.1, Math.min(4.5, heightM));
    emit({ type: 'RoofBaseHeightChanged', roofId, live: true });
  },

  generateAttic(roofId: string): void {
    const r = findRoof(roofId); if (!r || r.atticMode !== 'preview') return;
    pushUndoSnapshot();
    r.atticMode = 'generated';
    r.atticWallIds = currentWalls().filter((wall) => Core.wallIntersectsRoofFootprint(wall, r)).map((wall) => wall.id);
    emit({ type: 'AtticGenerated', roofId, wallIds: r.atticWallIds.slice() });
  },

  configureCurrentFloor(kind: Floor['kind'], wallHeightM?: number): Floor {
    pushUndoSnapshot();
    const floor = currentFloor();
    floor.kind = kind;
    if (kind === 'attic') floor.wallHeightM = Math.max(0.1, Math.min(2.2, wallHeightM ?? 1.2));
    else delete floor.wallHeightM;
    emit({ type: 'FloorConfigurationChanged', floorId: floor.id, kind, wallHeightM: floor.wallHeightM });
    return floor;
  },

  setCurrentFloor(index: number): void {
    if (index < 0 || index >= project.floors.length) return;
    project.currentFloorIndex = index;
    emit({ type: 'CurrentFloorChanged', floorIndex: index });
  },

  setLayerVisible(name: keyof Project['layers'], value: boolean): void {
    if (!(name in project.layers)) return;
    project.layers[name] = value;
    emit({ type: 'LayerVisibilityChanged', name, value });
  },

  undo(): void {
    if (!undoStack.length) return;
    project = undoStack.pop()!;
    emit({ type: 'Undo' });
  },

  setFoundationType(type: FoundationType): void {
    if (['radier', 'baldrame'].indexOf(type) === -1) return;
    project.foundationType = type;
    emit({ type: 'FoundationTypeChanged', value: type });
  }
};

export function currentTerreno(): Terreno | null {
  return project.terreno || null;
}

// Define (ou redefine) o tamanho do terreno. Opcional e disponível a
// qualquer momento — não é passo obrigatório de criação de projeto. Ao
// redefinir um terreno já existente, os muros dos lados que continuam
// dentro do novo retângulo são recalculados (mesmo lado, novo
// comprimento); lados que deixaram de existir simplesmente não têm mais
// sentido geométrico, então o usuário marca de novo se quiser.
export function setTerreno(larguraM: number, comprimentoM: number): void {
  if (!(larguraM > 0) || !(comprimentoM > 0)) return;
  pushUndoSnapshot();
  const sides = project.terreno ? project.terreno.muros.map((m) => m.id) : [];
  // Core.snap() opera em unidades de grade (Core.GRID por metro), não
  // em metros — larguraM/comprimentoM já chegam em metros (o que o
  // usuário digitou), então arredondamos aqui no mesmo módulo de 0,5m
  // (Core.SNAP_UNIT / Core.GRID), sem passar por Core.snap().
  const stepM = Core.SNAP_UNIT / Core.GRID;
  const roundToStep = (m: number) => Math.round(m / stepM) * stepM;
  const terreno = Core.createTerrenoEntity(roundToStep(larguraM), roundToStep(comprimentoM));
  const sideNames: TerrenoMuroSide[] = ['minX', 'maxX', 'minZ', 'maxZ'];
  terreno.muros = sideNames
    .filter((side) => sides.includes(Core.terrenoMuroId(side)))
    .map((side) => Core.createTerrenoMuroEntity(terreno, side));
  project.terreno = terreno;
  emit({ type: 'terrenoSet' });
}

// Alterna o muro de um lado do terreno: cria se não existir, remove se
// já existir. O muro criado é uma parede completa igual às da casa —
// aceita Opening (portão/porta) e acabamento por face.
export function toggleTerrenoMuroSide(side: TerrenoMuroSide): void {
  const terreno = project.terreno;
  if (!terreno) return;
  pushUndoSnapshot();
  const id = Core.terrenoMuroId(side);
  const index = terreno.muros.findIndex((m) => m.id === id);
  if (index >= 0) {
    terreno.muros.splice(index, 1);
  } else {
    terreno.muros.push(Core.createTerrenoMuroEntity(terreno, side));
  }
  emit({ type: 'terrenoMuroToggled', side });
}

export function findTerrenoMuro(id: string): Wall | null {
  const terreno = project.terreno;
  if (!terreno) return null;
  return terreno.muros.find((m) => m.id === id) || null;
}

export function getProject(): Project { return project; }

// Substitui o projeto inteiro em memória — usado só ao carregar um
// link compartilhado (ver EsboceApplication.start()). Diferente dos
// comandos normais, não empilha undo (carregar não é uma edição que
// alguém vá querer desfazer) — é o ponto de partida de uma sessão
// nova, análogo a createProject().
export function setProject(next: Project): void {
  project = next;
  emit({ type: 'ProjectLoaded' });
}

// Namespace de compatibilidade — mesma razão do Core.ts (chamadas
// Store.xxx no código legado, enquanto ViewportController/Scene3DRenderer
// etc. ainda não foram migrados).
export const Store = {
  getProject,
  setProject,
  currentFloor,
  currentWalls,
  currentColumns,
  currentRoofs,
  currentOpenings,
  currentVarandas,
  currentLajes,
  currentGlazingPanels,
  currentBalconyRailings,
  currentVolumeBoxes,
  currentStairs,
  currentPlanUnderlay,
  currentFurniture,
  findWall,
  findColumn,
  findRoof,
  findOpening,
  findVaranda,
  findLaje,
  findGlazingPanel,
  findBalconyRailing,
  findVolumeBox,
  findStair,
  findFurniture,
  findHydraulicNode,
  currentTerreno,
  setTerreno,
  toggleTerrenoMuroSide,
  findTerrenoMuro,
  onChange,
  commands
};
