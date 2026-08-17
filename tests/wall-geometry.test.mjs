import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  COINCIDENCE_TOL,
  GRID,
  OPENING_GAP,
  OPENING_WALL_CLEARANCE,
  WALL_THICK,
  computeWallFootprints,
  createLajeEntity,
  detectRooms,
  findValidOpeningOffset,
  findIsolatedRoomWallIds,
  findWallTJunctionSplits,
  openingOBB,
  polygonAreaModelUnits,
  rectPoints,
  lajeBounds,
  resolveOpeningEdgeResize,
  resolveOpeningHeightResize,
  resolveRoomHeightUpdate,
  resolveWallOffsetAgainstOpenings,
  resolveWallGroupGridDelta,
  resolveWallResizeOffset,
  roomHeightM,
  roomOwnHeightM,
  roomsContainingWall,
  resolvedWallHeights,
  roomAtPoint,
  roofHeightAtRect,
  wallOBB,
  wallsCanFuse,
  wallsMeetAtEndpoint,
  wallResizeTopology,
  wallResizeEndpointNeedsBridge,
} from '../src/core/Core.ts';
import {
  analyzeWallResize,
  findNewDegenerateWallResidues,
  formatWallDiagnosticReport,
  isWallResizeReportBlocking,
} from '../src/core/WallDiagnostics.ts';
import {
  OPENING_FRAME_FACE_WIDTH,
  OPENING_FRAME_SEAL_OVERLAP,
  computeOpeningAssemblyLayout,
  wallBandSideParameters,
  wallTopTriangleVertices,
} from '../src/core/Scene3DGeometry.ts';

const viewportControllerSource = await readFile(
  new URL('../src/core/ViewportController.ts', import.meta.url),
  'utf8',
);
const scene3DRendererSource = await readFile(
  new URL('../src/core/Scene3DRenderer.ts', import.meta.url),
  'utf8',
);
const indexHtmlSource = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);
const storeSource = await readFile(
  new URL('../src/core/Store.ts', import.meta.url),
  'utf8',
);
const materialsPanelSource = await readFile(
  new URL('../src/core/MaterialsPanel.ts', import.meta.url),
  'utf8',
);
const esboceApplicationSource = await readFile(
  new URL('../src/app/EsboceApplication.ts', import.meta.url),
  'utf8',
);

test('clique distingue comodo isolado de parede incorporada', () => {
  const wallClickFlow = viewportControllerSource.slice(
    viewportControllerSource.indexOf('if (mesh.userData.wallId) {'),
    viewportControllerSource.indexOf('} else if (mesh.userData.columnId)'),
  );

  assert.match(wallClickFlow, /findIsolatedRoomWallIds/);
  assert.match(wallClickFlow, /selectRoomGroup\(isolatedRoomWallIds\)/);
  assert.match(wallClickFlow, /dragMode = 'roomGroup'/);
  assert.match(wallClickFlow, /else \{\s*startWallResizeDrag\(clickedWallId/);
});

test('parede de comodo totalmente isolado seleciona o contorno inteiro', () => {
  const walls = rectangle();
  assert.deepEqual(findIsolatedRoomWallIds(walls, 'top')?.sort(), ['bottom', 'left', 'right', 'top']);
});

test('arraste de comodo move somente a previa 3D e confirma o Store ao soltar', () => {
  const moveStart = viewportControllerSource.indexOf("if (dragMode === 'roomGroup') {");
  const moveEnd = viewportControllerSource.indexOf("if (dragMode === 'roofGroup')", moveStart);
  const pointerMoveFlow = viewportControllerSource.slice(moveStart, moveEnd);

  assert.match(pointerMoveFlow, /previewRoomGroupDelta\(resolved\.x, resolved\.y\)/);
  assert.doesNotMatch(pointerMoveFlow, /updateWallsGroupBodyLive/);
  assert.doesNotMatch(pointerMoveFlow, /updateFurnitureBodyLive/);

  const upStart = viewportControllerSource.indexOf("if (dragMode === 'roomGroup') {", moveEnd);
  const upEnd = viewportControllerSource.indexOf("if (dragMode === 'roofGroup')", upStart);
  const pointerUpFlow = viewportControllerSource.slice(upStart, upEnd);

  assert.match(pointerUpFlow, /updateWallsGroupBodyLive/);
  assert.match(pointerUpFlow, /updateFurnitureBodyLive/);
});

test('arraste incremental da fachada recaptura o mesh depois da selecao reconstruir a cena', () => {
  assert.match(viewportControllerSource, /function findGlazingPanelSceneObject\(id: string\)/);
  assert.match(viewportControllerSource, /selectGlazingPanel\(glazingPanelId\);[\s\S]{0,700}glazingPanelDragMesh = findGlazingPanelSceneObject\(glazingPanelId\)/);
  assert.doesNotMatch(viewportControllerSource, /glazingPanelDragMesh = mesh/);
});

// Laje deixou de ser objeto colocável/arrastável (ver DEC-35 revista —
// correção pós-lançamento nesta sessão, "laje de entrepiso"): nasce
// automática, uma por cômodo fechado, exatamente como o piso — mesmo
// Core.detectRooms, mesmo contorno inset (insetPoints/shape) já
// calculado pro piso, só a altura/espessura mudam. Sem estado próprio
// pra "sincronizar" com a parede: como é recalculada a cada render
// (igual o piso), arrastar uma parede move a laje pelo mesmo motivo
// que move o piso — não tem lógica de arraste específica de laje pra
// testar mais.
test('laje nasce automática por cômodo, dentro do mesmo loop que já gera o piso — sem objeto/ferramenta própria', () => {
  // A função que desenha a laje automática existe e usa a MESMA
  // constante de espessura real de laje (não a espessura fina do piso).
  assert.match(scene3DRendererSource, /function buildAutoLajePiece\(shape/);
  assert.match(scene3DRendererSource, /depth: LAJE_THICKNESS/);
  // Nasce dentro do MESMO rooms.forEach do piso — prova de que reaproveita
  // o contorno já calculado (room.points/insetWallIds), não um objeto à
  // parte.
  const roomsStart = scene3DRendererSource.indexOf('rooms.forEach(function (room) {');
  const roomsEnd = scene3DRendererSource.indexOf('\n      });', roomsStart);
  const roomsFlow = scene3DRendererSource.slice(roomsStart, roomsEnd);
  // A partir da DEC-88/89 (altura de cômodo individual), a laje acompanha
  // a altura PRÓPRIA do cômodo (Core.roomOwnHeightM — só paredes
  // exclusivas, sem se deixar inflar por uma parede compartilhada que só
  // está alta pra acompanhar um vizinho), não mais currentWallHeight
  // (altura fixa do pavimento inteiro) direto.
  assert.match(roomsFlow, /roomHeight = Core\.roomOwnHeightM\(floorData\.walls, insetWallIds/);
  // DEC-90: a laje usa um contorno PRÓPRIO (lajeShape, de outsetPoints —
  // face externa da parede), diferente do `shape` do piso (insetPoints,
  // face interna) — cobre o cômodo inteiro rente à parede, não só até a
  // face de dentro.
  assert.match(roomsFlow, /var outsetPoints = room\.points\.map/);
  assert.match(roomsFlow, /buildAutoLajePiece\(lajeShape, lajeSizeX, lajeSizeZ, yOffset \+ roomHeight/);
  // DEC-90: só desenha depois que o botão "Gerar Laje" marcou o roomKey —
  // cômodo nasce sem laje nenhuma, visível ou contabilizada.
  assert.match(roomsFlow, /if \(\(floorData\.roomLajeGenerated \|\| \{\}\)\[roomKey\]\) \{/);
  // A ferramenta/entidade manual antiga não existe mais: nenhum lugar do
  // renderer lê mais floorData.lajes (a prop pode continuar existindo no
  // modelo salvo, por compatibilidade com projeto antigo — só não é mais
  // lida/desenhada).
  assert.doesNotMatch(scene3DRendererSource, /floorData\.lajes/);
  assert.doesNotMatch(scene3DRendererSource, /buildLajePiece\(laje/);
});

test('ferramenta manual "Laje" (botão da barra lateral) foi removida — sem criação avulsa', () => {
  assert.doesNotMatch(viewportControllerSource, /if \(key === 'laje'\) \{/);
  assert.doesNotMatch(viewportControllerSource, /function selectLaje\(/);
  assert.doesNotMatch(viewportControllerSource, /function collectLajeDragObjects\(/);
  assert.doesNotMatch(viewportControllerSource, /function snapLajeBodyDelta\(/);
  assert.doesNotMatch(viewportControllerSource, /dragMode === 'lajeBody'/);
  assert.doesNotMatch(viewportControllerSource, /handle\.indexOf\('lajeEdge'\)/);
  assert.doesNotMatch(indexHtmlSource, /data-room-preset="laje"/);
});

test('trava de construir no pavimento de cima passa a exigir cômodo fechado embaixo, não mais uma entidade Laje', () => {
  const start = viewportControllerSource.indexOf('function floorBelowMissingLaje() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /Core\.detectRooms\(belowFloor\.walls\)\.length === 0/);
  assert.doesNotMatch(body, /belowFloor\.lajes/);
});

test('arraste de telhado move o conjunto 3D e confirma o Store somente ao soltar', () => {
  assert.match(viewportControllerSource, /function collectRoofGroupDragObjects\(roofIds: string\[\], selectedId: string\)/);
  assert.match(viewportControllerSource, /selectRoof\(roofId\);[\s\S]{0,900}collectRoofGroupDragObjects\(connectedIds, roofId\)/);

  const moveStart = viewportControllerSource.indexOf("if (dragMode === 'roofGroup') {");
  const moveEnd = viewportControllerSource.indexOf("if (dragMode === 'wallResize')", moveStart);
  const pointerMoveFlow = viewportControllerSource.slice(moveStart, moveEnd);
  assert.match(pointerMoveFlow, /previewRoofGroupDelta\(roofDx, roofDy\)/);
  assert.doesNotMatch(pointerMoveFlow, /updateRoofsGroupBodyLive/);

  const upStart = viewportControllerSource.indexOf("if (dragMode === 'roofGroup') {", moveEnd);
  const upEnd = viewportControllerSource.indexOf("if \(dragMode === 'roofRidge'", upStart);
  const pointerUpFlow = viewportControllerSource.slice(upStart, upEnd);
  assert.match(pointerUpFlow, /updateRoofsGroupBodyLive/);
  assert.match(pointerUpFlow, /roofGroupDragObjects = \[\]/);
});

test('redimensionar telhado usa uma previa transparente e confirma os limites ao soltar', () => {
  assert.match(viewportControllerSource, /function previewRoofResize\(bounds:/);
  assert.match(viewportControllerSource, /createRoofResizePreviewMeshes\(previewRoof, scale, offsetX, offsetY, floorTopY\)/);

  const moveStart = viewportControllerSource.indexOf("if (dragMode && dragMode.indexOf('roofEdge') === 0) {");
  const moveEnd = viewportControllerSource.indexOf("if (dragMode && dragMode.indexOf('varandaEdge')", moveStart);
  const pointerMoveFlow = viewportControllerSource.slice(moveStart, moveEnd);
  assert.match(pointerMoveFlow, /previewRoofResize\(dragElementStart.lastBounds\)/);
  assert.doesNotMatch(pointerMoveFlow, /updateRoofBoundsLive/);

  const upStart = viewportControllerSource.indexOf("if (dragMode && dragMode.indexOf('roofEdge') === 0) {", moveEnd);
  const upEnd = viewportControllerSource.indexOf("if (dragMode === 'roofRidge'", upStart);
  const pointerUpFlow = viewportControllerSource.slice(upStart, upEnd);
  assert.match(pointerUpFlow, /clearRoofResizePreview\(\)/);
  assert.match(pointerUpFlow, /updateRoofBoundsLive/);
});

test('arraste de movel usa previa 3D e confirma o Store somente ao soltar', () => {
  assert.match(viewportControllerSource, /function findFurnitureSceneObject\(id: string\)/);
  assert.match(viewportControllerSource, /selectFurniture\(furnitureId\);[\s\S]{0,700}furnitureDragObject = findFurnitureSceneObject\(furnitureId\)/);

  const moveStart = viewportControllerSource.indexOf("if (dragMode === 'furnitureBody') {");
  const moveEnd = viewportControllerSource.indexOf("if (dragMode === 'glazingPanelBody')", moveStart);
  const pointerMoveFlow = viewportControllerSource.slice(moveStart, moveEnd);
  assert.match(pointerMoveFlow, /furnitureDragObject\.position\.x = worldF\.x/);
  assert.match(pointerMoveFlow, /furnitureDragObject\.position\.z = worldF\.z/);
  assert.doesNotMatch(pointerMoveFlow, /updateFurnitureBodyLive/);

  const upStart = viewportControllerSource.indexOf("if (dragMode === 'furnitureBody') {", moveEnd);
  const upEnd = viewportControllerSource.indexOf("if (dragMode === 'columnBody'", upStart);
  const pointerUpFlow = viewportControllerSource.slice(upStart, upEnd);
  assert.match(pointerUpFlow, /updateFurnitureBodyLive/);
  assert.match(pointerUpFlow, /furnitureDragObject = null/);
});

test('arraste de coluna move volume e contorno sem atualizar o Store a cada quadro', () => {
  assert.match(viewportControllerSource, /function collectColumnDragObjects\(id: string\)/);
  assert.match(viewportControllerSource, /selectColumn\(columnId\);[\s\S]{0,500}collectColumnDragObjects\(columnId\)/);

  const moveStart = viewportControllerSource.indexOf("if (dragMode === 'columnBody') {");
  const moveEnd = viewportControllerSource.indexOf("if (dragMode === 'furnitureBody')", moveStart);
  const pointerMoveFlow = viewportControllerSource.slice(moveStart, moveEnd);
  assert.match(pointerMoveFlow, /columnDragObjects\.forEach/);
  assert.doesNotMatch(pointerMoveFlow, /updateColumnBodyLive/);

  const upStart = viewportControllerSource.indexOf("if (dragMode === 'columnBody') {", moveEnd);
  const upEnd = viewportControllerSource.indexOf("if (dragMode === 'openingSlide'", upStart);
  const pointerUpFlow = viewportControllerSource.slice(upStart, upEnd);
  assert.match(pointerUpFlow, /updateColumnBodyLive/);
  assert.match(pointerUpFlow, /columnDragObjects = \[\]/);
});

test('qualquer ligacao externa desativa a selecao coletiva do comodo', () => {
  const walls = rectangle();
  walls.push({ id: 'external', x1: 40, y1: 0, x2: 40, y2: -40 });

  assert.equal(findIsolatedRoomWallIds(walls, 'bottom'), null);
  assert.equal(findIsolatedRoomWallIds(walls, 'top'), null);
});

test('parede compartilhada entre dois comodos nunca seleciona grupo', () => {
  const walls = rectangle();
  walls.push({ id: 'divider', x1: 40, y1: 0, x2: 40, y2: 60 });

  assert.equal(findIsolatedRoomWallIds(walls, 'divider'), null);
  assert.equal(findIsolatedRoomWallIds(walls, 'left'), null);
});

test('paleta de pintura de parede fica restrita ao balde de tinta', () => {
  const finishPanelFlow = viewportControllerSource.slice(
    viewportControllerSource.indexOf('function refreshFinishPanel()'),
    viewportControllerSource.indexOf('// Cota ao vivo enquanto arrasta'),
  );
  const bucketFlow = viewportControllerSource.slice(
    viewportControllerSource.indexOf("if (currentTool === 'paintBucket')"),
    viewportControllerSource.indexOf('if (mesh) {', viewportControllerSource.indexOf("if (currentTool === 'paintBucket')")),
  );

  assert.doesNotMatch(finishPanelFlow, /selectedWallId|selectedRoomWallIds|category\('paint'\)/);
  assert.match(bucketFlow, /setWallFinishFace/);
});

test('cinta superior reutiliza exatamente o footprint sem criar volume extra', () => {
  const footprint = {
    p1a: { x: 0, y: -1.2 },
    p2a: { x: 80, y: -1.2 },
    p2b: { x: 80, y: 1.2 },
    p1b: { x: 0, y: 1.2 },
  };

  assert.deepEqual(wallTopTriangleVertices(footprint, 2.7), [
    0, 2.7, -1.2,
    80, 2.7, -1.2,
    80, 2.7, 1.2,
    0, 2.7, -1.2,
    80, 2.7, 1.2,
    0, 2.7, 1.2,
  ]);
});

test('cinta superior aceita o formato x/z usado de verdade pelo renderizador', () => {
  const sceneFootprint = {
    p1a: { x: 0, z: -0.06 },
    p2a: { x: 4, z: -0.06 },
    p2b: { x: 4, z: 0.06 },
    p1b: { x: 0, z: 0.06 },
  };

  assert.deepEqual(wallTopTriangleVertices(sceneFootprint, 2.7), [
    0, 2.7, -0.06,
    4, 2.7, -0.06,
    4, 2.7, 0.06,
    0, 2.7, -0.06,
    4, 2.7, 0.06,
    0, 2.7, 0.06,
  ]);
});

test('implantar porta preserva os prolongamentos que fecham os dois cantos da parede', () => {
  const footprint = {
    p1a: { x: -0.06, z: -0.06 },
    p2a: { x: 4, z: -0.06 },
    p2b: { x: 4.06, z: 0.06 },
    p1b: { x: 0, z: 0.06 },
  };

  const beforeDoor = wallBandSideParameters(
    footprint,
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    0,
    1.6,
  );
  const afterDoor = wallBandSideParameters(
    footprint,
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    2.4,
    4,
  );

  assert.equal(beforeDoor.aStart, 0);
  assert.equal(beforeDoor.bStart, 0);
  assert.equal(afterDoor.aEnd, 1);
  assert.equal(afterDoor.bEnd, 1);
});

test('recorte do vao permanece alinhado ao eixo quando o footprint e prolongado nas quinas', () => {
  const params = wallBandSideParameters({
    p1a: { x: -0.06, z: -0.06 },
    p2a: { x: 4.06, z: -0.06 },
    p2b: { x: 4.06, z: 0.06 },
    p1b: { x: -0.06, z: 0.06 },
  }, { x: 0, z: 0 }, { x: 4, z: 0 }, 1.1, 1.9);

  const interpolateX = (start, end, t) => start + (end - start) * t;
  assert.ok(Math.abs(interpolateX(-0.06, 4.06, params.aStart) - 1.1) < 1e-9);
  assert.ok(Math.abs(interpolateX(-0.06, 4.06, params.aEnd) - 1.9) < 1e-9);
  assert.ok(Math.abs(interpolateX(-0.06, 4.06, params.bStart) - 1.1) < 1e-9);
  assert.ok(Math.abs(interpolateX(-0.06, 4.06, params.bEnd) - 1.9) < 1e-9);
});

test('porta recebe batentes laterais e superior sem soleira', () => {
  const layout = computeOpeningAssemblyLayout({
    kind: 'door', width: 0.8, height: 2.1, sillHeight: 0,
  }, 0.12);

  assert.equal(layout.frameBars.length, 3);
  assert.equal(layout.infillWidth, 0.8 - OPENING_FRAME_FACE_WIDTH * 2);
  assert.equal(layout.infillHeight, 2.1 - OPENING_FRAME_FACE_WIDTH);
  assert.equal(layout.infillCenterY - layout.infillHeight / 2, 0);
  assert.ok(layout.frameBars.every((bar) => bar.depth === 0.12 + OPENING_FRAME_SEAL_OVERLAP * 2));
});

test('janela recebe marco sólido nos quatro lados e vidro ocupa o interior', () => {
  const layout = computeOpeningAssemblyLayout({
    kind: 'window', width: 1.2, height: 1.2, sillHeight: 1,
  }, 0.12);

  assert.equal(layout.frameBars.length, 4);
  assert.equal(layout.infillWidth, 1.2 - OPENING_FRAME_FACE_WIDTH * 2);
  assert.equal(layout.infillHeight, 1.2 - OPENING_FRAME_FACE_WIDTH * 2);
  assert.ok(Math.abs(
    (layout.infillCenterY - layout.infillHeight / 2) - (1 + OPENING_FRAME_FACE_WIDTH),
  ) < 1e-9);
  assert.ok(Math.abs(
    (layout.infillCenterY + layout.infillHeight / 2) - (1 + 1.2 - OPENING_FRAME_FACE_WIDTH),
  ) < 1e-9);
  assert.ok(layout.frameBars.every((bar) => bar.depth === 0.12 + OPENING_FRAME_SEAL_OVERLAP * 2));
});

test('porta e janela mantêm 150 mm livres entre suas extremidades', () => {
  const wall = { id: 'wall', x1: 0, y1: 0, x2: 100, y2: 0 };
  const door = { id: 'door', wallId: 'wall', kind: 'door', offset: 2, width: 0.8, height: 2.1, sillHeight: 0 };
  const windowWidth = 1.2;

  const offset = findValidOpeningOffset(wall, [door], windowWidth, 2.5);
  const minimumCenter = door.offset + door.width / 2 + OPENING_GAP + windowWidth / 2;

  assert.equal(offset, minimumCenter);
  const resultingGap = offset - windowWidth / 2 - (door.offset + door.width / 2);
  assert.ok(Math.abs(resultingGap - OPENING_GAP) < 1e-9);
});

test('abertura informa quando não existe espaço com margens e afastamentos', () => {
  const wall = { id: 'wall', x1: 0, y1: 0, x2: 40, y2: 0 };
  const door = { id: 'door', wallId: 'wall', kind: 'door', offset: 1, width: 0.8, height: 2.1, sillHeight: 0 };

  assert.equal(findValidOpeningOffset(wall, [door], 1.2, 1), null);
});

test('caixa da esquadria inclui 50 mm de proteção em cada extremidade', () => {
  const wall = { id: 'wall', x1: 0, y1: 0, x2: 100, y2: 0 };
  const opening = { id: 'window', wallId: 'wall', kind: 'window', offset: 2.5, width: 1.2, height: 1.2, sillHeight: 1 };
  const box = openingOBB(opening, wall);

  assert.equal(box.cx, 50);
  assert.equal(box.cy, 0);
  assert.equal(box.halfLen, (opening.width / 2 + OPENING_WALL_CLEARANCE) * GRID);
});

test('parede transversal para antes da esquadria mesmo quando o ponteiro salta o vão', () => {
  const owner = { id: 'owner', x1: 0, y1: 0, x2: 100, y2: 0 };
  const moving = { id: 'moving', x1: 20, y1: -20, x2: 20, y2: 20 };
  const opening = { id: 'window', wallId: 'owner', kind: 'window', offset: 2.5, width: 0.8, height: 1.2, sillHeight: 1 };

  assert.deepEqual(
    resolveWallOffsetAgainstOpenings(moving, 60, 1, 0, ['moving'], [opening], [owner, moving]),
    { offset: 10, limited: true },
  );
  assert.deepEqual(
    resolveWallOffsetAgainstOpenings({ ...moving, x1: 80, x2: 80 }, -60, 1, 0, ['moving'], [opening], [owner, moving]),
    { offset: -10, limited: true },
  );
});

// Pedido do Product Owner: a parede não pode ATRAVESSAR (passar pro
// outro lado de) uma parede paralela, mas deve poder SOBREPOR até o eixo
// dela — sobreposição exata é o que Store.commands.fuseOverlappingWalls
// usa pra fundir as duas (Core.wallsCanFuse exige coincidência, não só
// proximidade). Antes o limite parava meia célula da grade (0,50 m) ANTES
// da parede obstáculo — evitava cruzar, mas também nunca permitia chegar
// perto o bastante da sobreposição exata que a fusão exige.
test('parede de cômodo para exatamente no eixo da parede paralela — sobrepõe pra fundir, mas não atravessa pro outro lado', () => {
  const moving = { id: 'moving', x1: 0, y1: 0, x2: 80, y2: 0 };
  const obstacle = { id: 'obstacle', x1: 20, y1: 40, x2: 100, y2: 40 };

  const result = resolveWallResizeOffset(moving, [moving, obstacle], 60, 0, 1);

  assert.deepEqual(result, {
    offset: 40,
    limited: true,
    blockingWallId: 'obstacle',
  });
});

test('limite funciona nos dois sentidos e ignora parede sem sobreposicao', () => {
  const moving = { id: 'moving', x1: 0, y1: 0, x2: 80, y2: 0 };
  const behind = { id: 'behind', x1: 0, y1: -40, x2: 80, y2: -40 };
  const outsideSpan = { id: 'outside', x1: 100, y1: 20, x2: 140, y2: 20 };

  assert.equal(resolveWallResizeOffset(moving, [moving, behind], -60, 0, 1).offset, -40);
  assert.deepEqual(
    resolveWallResizeOffset(moving, [moving, outsideSpan], 60, 0, 1),
    { offset: 60, limited: false },
  );
});

function rectangle(width = 80, height = 60) {
  return [
    { id: 'bottom', x1: 0, y1: 0, x2: width, y2: 0 },
    { id: 'right', x1: width, y1: 0, x2: width, y2: height },
    { id: 'top', x1: width, y1: height, x2: 0, y2: height },
    { id: 'left', x1: 0, y1: height, x2: 0, y2: 0 },
  ];
}

test('a sala retangular permanece fechada quando um nó conectado é movido', () => {
  const walls = rectangle();
  const target = { x: 100, y: 0 };

  walls[0].x2 = target.x;
  walls[0].y2 = target.y;
  walls[1].x1 = target.x;
  walls[1].y1 = target.y;

  const rooms = detectRooms(walls);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].area, 60 * 90);
});

test('mover somente uma das pontas reproduz o circuito quebrado que fazia o piso sumir', () => {
  const walls = rectangle();
  walls[0].x2 = 100;

  assert.equal(detectRooms(walls).length, 0);
});

test('uma parede pendurada não cria um piso falso dentro de um contorno aberto', () => {
  const walls = rectangle();
  walls[0].x2 = 100;

  const rooms = detectRooms(walls);
  assert.deepEqual(rooms, []);
});

test('uma divisória em T detecta os dois cômodos internos', () => {
  const walls = rectangle();
  walls.push({ id: 'divider', x1: 40, y1: 0, x2: 40, y2: 60 });

  const rooms = detectRooms(walls);
  assert.equal(rooms.length, 2);
  assert.deepEqual(rooms.map((room) => room.area).sort((a, b) => a - b), [2400, 2400]);
});

test('a caixa de colisão usa a mesma espessura da parede renderizada', () => {
  const wall = rectangle()[0];
  const obb = wallOBB(wall);

  assert.equal(obb.halfThick, WALL_THICK * GRID / 2);
  assert.equal(obb.halfThick, 1.2);
});

test('duas paredes de uma quina compartilham o mesmo corte de encontro', () => {
  const walls = rectangle();
  const footprints = computeWallFootprints(walls);
  const bottomEnd = [footprints.bottom.p2a, footprints.bottom.p2b];
  const rightStart = [footprints.right.p1a, footprints.right.p1b];

  bottomEnd.forEach((point) => {
    assert.ok(
      rightStart.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= COINCIDENCE_TOL),
      `canto sem correspondência em (${point.x}, ${point.y})`,
    );
  });
});

test('parede sobre o mesmo eixo do grid é reconhecida como encaixe fundível', () => {
  const moving = { id: 'moving', x1: 40, y1: 0, x2: 100, y2: 0 };
  const existing = { id: 'existing', x1: 0, y1: 0, x2: 80, y2: 0 };

  assert.equal(wallsCanFuse(moving, existing), true);
});

test('snap de cômodo aceita o eixo coincidente e nunca devolve posição entre linhas', () => {
  const moving = [{ id: 'moving', x1: 40, y1: 10, x2: 100, y2: 10 }];
  const existing = [{ id: 'existing', x1: 0, y1: 0, x2: 80, y2: 0 }];

  const resolved = resolveWallGroupGridDelta(moving, existing, 0, -8, 0, 0);

  assert.deepEqual(resolved, { x: 0, y: -10 });
  assert.equal((moving[0].y1 + resolved.y) % 10, 0);
});

test('dois cômodos completos encaixam apesar das quinas e junções em T', () => {
  const moving = rectangle().map((wall) => ({
    ...wall,
    id: `moving-${wall.id}`,
  }));
  const existing = rectangle().map((wall) => ({
    ...wall,
    id: `existing-${wall.id}`,
    x1: wall.x1 + 90,
    x2: wall.x2 + 90,
  }));

  const resolved = resolveWallGroupGridDelta(moving, existing, 10, 0, 0, 0);

  assert.deepEqual(resolved, { x: 10, y: 0 });
  assert.equal(wallsCanFuse({ ...moving[1], x1: 90, x2: 90 }, existing[3]), true);
  assert.equal(wallsMeetAtEndpoint({ ...moving[0], x1: 10, x2: 90 }, existing[3]), true);
});

test('colisão que não é fusão conserva o último passo válido do grid', () => {
  const moving = [{ id: 'moving', x1: 0, y1: 10, x2: 80, y2: 10 }];
  const crossing = [{ id: 'crossing', x1: 40, y1: -20, x2: 40, y2: 20 }];

  const resolved = resolveWallGroupGridDelta(moving, crossing, 0, -10, 10, 0);

  assert.deepEqual(resolved, { x: 10, y: 0 });
  assert.equal(resolved.x % 10, 0);
  assert.equal(resolved.y % 10, 0);
});

test('arrasto de duas linhas de grid nao pula por cima de obstaculo no meio do caminho', () => {
  const moving = [{ id: 'moving', x1: 0, y1: 10, x2: 80, y2: 10 }];
  const obstacleAtIntermediateStep = [{ id: 'obstacle', x1: 40, y1: -5, x2: 40, y2: 5 }];

  const resolved = resolveWallGroupGridDelta(moving, obstacleAtIntermediateStep, 0, -20, 0, 0);

  assert.deepEqual(resolved, { x: 0, y: 0 });
});

test('arrasto de duas linhas de grid avanca ate o passo valido mais proximo do alvo', () => {
  const moving = [{ id: 'moving', x1: 0, y1: 10, x2: 80, y2: 10 }];
  const farAway = [{ id: 'far', x1: 400, y1: 400, x2: 480, y2: 400 }];

  const resolved = resolveWallGroupGridDelta(moving, farAway, 0, -20, 0, 0);

  assert.deepEqual(resolved, { x: 0, y: -20 });
});

test('parede fundida atualiza as quinas dos dois cômodos sem abrir fresta unilateral', () => {
  const walls = [
    { id: 'left-bottom', x1: 0, y1: 0, x2: 40, y2: 0 },
    { id: 'shared', x1: 40, y1: 0, x2: 40, y2: 60 },
    { id: 'left-top', x1: 40, y1: 60, x2: 0, y2: 60 },
    { id: 'left-side', x1: 0, y1: 60, x2: 0, y2: 0 },
    { id: 'right-bottom', x1: 40, y1: 0, x2: 80, y2: 0 },
    { id: 'right-side', x1: 80, y1: 0, x2: 80, y2: 60 },
    { id: 'right-top', x1: 80, y1: 60, x2: 40, y2: 60 },
  ];

  const topology = wallResizeTopology(walls, 'shared');

  assert.equal(topology.ownerCount, 2);
  assert.deepEqual(
    topology.start.map((link) => link.id).sort(),
    ['left-bottom', 'right-bottom'],
  );
  assert.deepEqual(
    topology.end.map((link) => link.id).sort(),
    ['left-top', 'right-top'],
  );

  const shared = walls.find((wall) => wall.id === 'shared');
  shared.x1 = 50;
  shared.x2 = 50;
  topology.start.forEach((link) => {
    const wall = walls.find((candidate) => candidate.id === link.id);
    if (link.which === 1) wall.x1 = 50;
    else wall.x2 = 50;
  });
  topology.end.forEach((link) => {
    const wall = walls.find((candidate) => candidate.id === link.id);
    if (link.which === 1) wall.x1 = 50;
    else wall.x2 = 50;
  });

  const rooms = detectRooms(walls);
  assert.equal(rooms.length, 2);
  assert.deepEqual(rooms.map((room) => room.area).sort((a, b) => a - b), [1800, 3000]);
});

test('junção em T desliza nos dois sentidos sem deixar o vértice antigo', () => {
  const makeWalls = () => [
    { id: 'bottom', x1: 0, y1: 0, x2: 80, y2: 0 },
    { id: 'right', x1: 80, y1: 0, x2: 80, y2: 60 },
    { id: 'top', x1: 80, y1: 60, x2: 0, y2: 60 },
    { id: 'left', x1: 0, y1: 60, x2: 0, y2: 0 },
    { id: 'through', x1: 40, y1: 0, x2: 40, y2: 60 },
    { id: 'small', x1: 0, y1: 30, x2: 40, y2: 30 },
  ];

  const initial = makeWalls();
  const topology = wallResizeTopology(initial, 'small');
  assert.deepEqual(topology.startSlidingSupports, ['left']);
  assert.deepEqual(topology.endSlidingSupports, ['through']);

  for (const y of [20, 40]) {
    const walls = makeWalls();
    const small = walls.find((wall) => wall.id === 'small');
    small.y1 = y;
    small.y2 = y;

    assert.equal(detectRooms(walls).length, 3);
    assert.equal(walls.length, 6, 'o deslizamento não deve criar parede-rastro');
  }
});

test('encontro em T planeja a divisão da parede transversal no nó compartilhado', () => {
  const walls = [
    { id: 'through', x1: 40, y1: 0, x2: 40, y2: 60 },
    { id: 'small', x1: 0, y1: 30, x2: 40, y2: 30 },
  ];

  const plans = findWallTJunctionSplits(walls);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].wallId, 'through');
  assert.deepEqual(plans[0].points.map(({ x, y, t }) => ({ x, y, t })), [
    { x: 40, y: 30, t: 0.5 },
  ]);
});

test('segundo arraste preserva os dois trechos reais criados pela divisão em T', () => {
  const makeWallsAfterSplit = () => [
    { id: 'bottom', x1: 0, y1: 0, x2: 80, y2: 0 },
    { id: 'right', x1: 80, y1: 0, x2: 80, y2: 60 },
    { id: 'top', x1: 80, y1: 60, x2: 0, y2: 60 },
    { id: 'left', x1: 0, y1: 60, x2: 0, y2: 0 },
    { id: 'through-lower', x1: 40, y1: 0, x2: 40, y2: 30 },
    { id: 'through-upper', x1: 40, y1: 30, x2: 40, y2: 60 },
    { id: 'small', x1: 0, y1: 30, x2: 40, y2: 30 },
  ];

  for (const y of [20, 40]) {
    const walls = makeWallsAfterSplit();
    const topology = wallResizeTopology(walls, 'small');

    assert.deepEqual(
      topology.end.map((link) => `${link.id}:${link.which}`).sort(),
      ['through-lower:2', 'through-upper:1'],
    );

    const small = walls.find((wall) => wall.id === 'small');
    small.y1 = y;
    small.y2 = y;
    topology.end.forEach((link) => {
      const wall = walls.find((candidate) => candidate.id === link.id);
      if (link.which === 1) wall.y1 = y;
      else wall.y2 = y;
    });

    assert.equal(detectRooms(walls).length, 3);
    assert.equal(walls.length, 7, 'o segundo arraste não cria nem abandona trechos');
  }
});

test('trecho intermediario fecha o no somente no sentido em que a vizinha nao cobre o ponto antigo', () => {
  const walls = [
    { id: 'upper', x1: 40, y1: 0, x2: 40, y2: 30 },
    { id: 'lower', x1: 40, y1: 30, x2: 40, y2: 60 },
    { id: 'left', x1: 0, y1: 30, x2: 40, y2: 30 },
    { id: 'right', x1: 40, y1: 30, x2: 80, y2: 30 },
  ];
  const topology = wallResizeTopology(walls, 'upper');
  const originalLinks = [
    { id: 'lower', which: 1 },
    { id: 'left', which: 2 },
    { id: 'right', which: 1 },
  ];

  assert.deepEqual(
    topology.end.map((link) => `${link.id}:${link.which}`).sort(),
    ['left:2', 'right:1'],
  );
  assert.equal(
    wallResizeEndpointNeedsBridge(originalLinks, topology.end, false),
    true,
    'a continuacao colinear parada exige ponte quando nenhuma vizinha cobre o caminho',
  );
  assert.equal(
    wallResizeEndpointNeedsBridge(originalLinks, topology.end, true),
    false,
    'a vizinha que alongou e atravessa o ponto antigo ja fecha o caminho',
  );
  assert.equal(
    wallResizeEndpointNeedsBridge(originalLinks, originalLinks, false),
    false,
    'nenhuma ponte deve nascer quando todas as conexoes acompanham o no',
  );
  assert.equal(
    wallResizeEndpointNeedsBridge(originalLinks, topology.end, true),
    false,
    'um apoio deslizante ainda valido tambem fecha o no sem ponte',
  );
});

test('ponta livre acompanha a parede sem criar copia ou parede-rastro', () => {
  assert.equal(
    wallResizeEndpointNeedsBridge([], [], false),
    false,
    'sem ligacao no no antigo nao existe conexao para uma ponte preservar',
  );
});

test('ponte continua obrigatoria quando uma ligacao real fica no no antigo', () => {
  const originalLinks = [{ id: 'vizinha', which: 2 }];

  assert.equal(
    wallResizeEndpointNeedsBridge(originalLinks, [], false),
    true,
    'a ligacao real que nao acompanhou o arraste precisa permanecer fechada',
  );
});

test('diagnostico aprova parede empurrada com as duas quinas conectadas', () => {
  const before = [
    { id: 'bottom', x1: 0, y1: 0, x2: 80, y2: 0 },
    { id: 'right', x1: 80, y1: 0, x2: 80, y2: 60 },
    { id: 'top', x1: 80, y1: 60, x2: 0, y2: 60 },
    { id: 'left', x1: 0, y1: 60, x2: 0, y2: 0 },
  ];
  const after = [
    { id: 'bottom', x1: 0, y1: 0, x2: 100, y2: 0 },
    { id: 'right', x1: 100, y1: 0, x2: 100, y2: 60 },
    { id: 'top', x1: 100, y1: 60, x2: 0, y2: 60 },
    { id: 'left', x1: 0, y1: 60, x2: 0, y2: 0 },
  ];

  const report = analyzeWallResize(before, after, 'right', 20, 0, 'final');

  assert.equal(report.severity, 'ok');
  assert.deepEqual(report.issues, []);
  assert.equal(report.beforeJunctionCount, 4);
  assert.equal(report.afterJunctionCount, 4);
});

test('diagnostico registra a junção aberta sem bloquear a geometria observada', () => {
  const before = [
    { id: 'bottom', x1: 0, y1: 0, x2: 80, y2: 0 },
    { id: 'right', x1: 80, y1: 0, x2: 80, y2: 60 },
    { id: 'top', x1: 80, y1: 60, x2: 0, y2: 60 },
  ];
  const after = [
    { id: 'bottom', x1: 0, y1: 0, x2: 80, y2: 0 },
    { id: 'right', x1: 100, y1: 0, x2: 100, y2: 60 },
    { id: 'top', x1: 80, y1: 60, x2: 0, y2: 60 },
  ];

  const report = analyzeWallResize(before, after, 'right', 20, 0, 'final');

  assert.equal(report.severity, 'error');
  assert.ok(report.issues.some((issue) => issue.code === 'WALL-JUNCTION-OPENED'));
  assert.deepEqual(after[1], { id: 'right', x1: 100, y1: 0, x2: 100, y2: 60 });
});

test('diagnostico identifica parede ortogonal deformada em diagonal', () => {
  const before = [
    { id: 'wall', x1: 0, y1: 0, x2: 80, y2: 0 },
  ];
  const after = [
    { id: 'wall', x1: 0, y1: 0, x2: 80, y2: 20 },
  ];

  const report = analyzeWallResize(before, after, 'wall', 0, 20, 'preview');

  assert.equal(report.severity, 'error');
  assert.ok(report.issues.some((issue) => issue.code === 'WALL-UNEXPECTED-DIAGONAL'));
});

test('diagnostico distingue residuo novo de parede curta preexistente', () => {
  const before = [
    { id: 'preexistente', x1: 0, y1: 0, x2: 0.2, y2: 0 },
    { id: 'encolheu', x1: 0, y1: 20, x2: 40, y2: 20 },
  ];
  const after = [
    { id: 'preexistente', x1: 0, y1: 0, x2: 0.2, y2: 0 },
    { id: 'encolheu', x1: 20, y1: 20, x2: 20.1, y2: 20 },
    { id: 'novo', x1: 40, y1: 20, x2: 40.1, y2: 20 },
  ];

  assert.deepEqual(
    findNewDegenerateWallResidues(before, after).map((item) => item.wallId).sort(),
    ['encolheu', 'novo'],
  );
  const report = analyzeWallResize(before, after, 'encolheu', 20, 0, 'final');
  assert.ok(report.issues.some((issue) => issue.code === 'WALL-TOO-SHORT-PREEXISTING'));
  assert.ok(report.issues.some((issue) => issue.code === 'WALL-TOO-SHORT-CREATED'));
  assert.match(formatWallDiagnosticReport(report), /Comprimento:/);
});

test('diagnostico final registra residuos removidos como limpeza segura', () => {
  const walls = [{ id: 'wall', x1: 0, y1: 0, x2: 40, y2: 0 }];
  const removedResidues = [{ wallId: 'residuo', length: 0.1 }];
  const report = analyzeWallResize(walls, walls, 'wall', 20, 0, 'final', removedResidues);

  assert.equal(report.phase, 'final');
  assert.equal(report.severity, 'warning');
  assert.match(formatWallDiagnosticReport(report), /WALL-RESIDUE-REMOVED: residuo/);
});

test('protetor bloqueia somente falhas objetivas criadas pelo arraste', () => {
  const diagonal = analyzeWallResize(
    [{ id: 'wall', x1: 0, y1: 0, x2: 80, y2: 0 }],
    [{ id: 'wall', x1: 0, y1: 0, x2: 80, y2: 20 }],
    'wall',
    0,
    20,
    'final',
  );
  assert.equal(isWallResizeReportBlocking(diagonal), true);

  const preexistingShortWall = analyzeWallResize(
    [{ id: 'short', x1: 0, y1: 0, x2: 0.2, y2: 0 }],
    [{ id: 'short', x1: 0, y1: 0, x2: 0.2, y2: 0 }],
    'short',
    0,
    0,
    'final',
  );
  assert.equal(preexistingShortWall.severity, 'warning');
  assert.equal(isWallResizeReportBlocking(preexistingShortWall), false);
});

test('painel informa quando o protetor restaura a planta', () => {
  const report = analyzeWallResize(
    [{ id: 'wall', x1: 0, y1: 0, x2: 80, y2: 0 }],
    [{ id: 'wall', x1: 0, y1: 0, x2: 80, y2: 20 }],
    'wall',
    0,
    20,
    'final',
  );
  report.blocked = true;

  const text = formatWallDiagnosticReport(report);
  assert.match(text, /REPROVADA — MOVIMENTO CANCELADO/);
  assert.match(text, /planta original foi restaurada automaticamente/);
});

test('redimensionar borda esquerda da abertura mantem a direita fixa', () => {
  const wall = { id: 'wall', x1: 0, y1: 0, x2: 400, y2: 0 };
  const opening = { id: 'op', kind: 'window', wallId: 'wall', offset: 2, width: 1, height: 1.2, sillHeight: 1 };

  const result = resolveOpeningEdgeResize(wall, [opening], 'op', 'left', 0.8);

  assert.ok(result);
  // Borda direita original: offset + width/2 = 2.5. Nova esquerda: 0.8.
  assert.equal(result.width, 2.5 - 0.8);
  assert.equal(result.offset, (0.8 + 2.5) / 2);
});

test('redimensionar abertura nao invade outra abertura na mesma parede', () => {
  const wall = { id: 'wall', x1: 0, y1: 0, x2: 400, y2: 0 };
  const opening = { id: 'op', kind: 'window', wallId: 'wall', offset: 2, width: 1, height: 1.2, sillHeight: 1 };
  const neighbor = { id: 'neighbor', kind: 'window', wallId: 'wall', offset: 4.5, width: 1, height: 1.2, sillHeight: 1 };

  // Tenta puxar a borda direita bem além da abertura vizinha.
  const result = resolveOpeningEdgeResize(wall, [opening, neighbor], 'op', 'right', 6);

  assert.ok(result);
  var newRight = result.offset + result.width / 2;
  var neighborLeft = neighbor.offset - neighbor.width / 2;
  assert.ok(newRight <= neighborLeft, 'não deveria ultrapassar a vizinha');
});

test('redimensionar abertura respeita largura minima', () => {
  const wall = { id: 'wall', x1: 0, y1: 0, x2: 400, y2: 0 };
  const opening = { id: 'op', kind: 'door', wallId: 'wall', offset: 2, width: 0.8, height: 2.1, sillHeight: 0 };

  // Tenta puxar a esquerda quase até a direita — deve travar na largura mínima.
  const result = resolveOpeningEdgeResize(wall, [opening], 'op', 'left', 2.39);

  assert.ok(result);
  assert.ok(result.width >= 0.4 - 1e-9);
});

test('redimensionar altura da abertura mantem o peitoril fixo', () => {
  const opening = { id: 'op', kind: 'window', wallId: 'wall', offset: 2, width: 1, height: 1.2, sillHeight: 1 };

  const newHeight = resolveOpeningHeightResize(opening, 2.5);

  assert.equal(newHeight, 2.5 - 1);
});

test('redimensionar altura da abertura nao passa do teto', () => {
  const opening = { id: 'op', kind: 'window', wallId: 'wall', offset: 2, width: 1, height: 1.2, sillHeight: 1 };

  const newHeight = resolveOpeningHeightResize(opening, 10);

  assert.ok(opening.sillHeight + newHeight <= 2.7);
});

// ---- Laje colocável, com contorno poligonal real (DEC-35/37) ----
//
// Sem fusão automática (decisão revista, Sessão 6): duas lajes
// encostadas continuam objetos separados — o "colar sem sobrepor" é
// só um ímã de encaixe no arraste (ViewportController.
// nearestWallFaceCoord/snapLajeBodyDelta, testado manualmente na UI,
// não aqui). O que continua testável em isolamento (Core.ts puro) é
// o contorno de cada laje e o retângulo delimitador usado pelo ímã.

test('createLajeEntity: nasce sem depender de nenhuma parede (contorno livre)', () => {
  const laje = createLajeEntity(rectPoints(-50, -50, 500, 500));
  assert.equal(laje.points.length, 4);
  assert.ok(laje.id);
});

test('rectPoints: 4 cantos no sentido horário, min/max resolvidos mesmo com os pontos invertidos', () => {
  const pts = rectPoints(100, 100, 0, 0); // x1>x2, y1>y2 de propósito
  assert.deepEqual(pts, [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
  ]);
});

test('lajeBounds: retângulo delimitador de um polígono simples bate com o próprio retângulo', () => {
  const laje = createLajeEntity(rectPoints(10, 20, 110, 220));
  const b = lajeBounds(laje);
  assert.deepEqual(b, { minX: 10, maxX: 110, minY: 20, maxY: 220 });
});

test('lajeBounds: funciona também pra um contorno não-retangular (ex.: um "L" desenhado à mão)', () => {
  const lShape = createLajeEntity([
    { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
    { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }
  ]);
  const b = lajeBounds(lShape);
  assert.deepEqual(b, { minX: 0, maxX: 200, minY: 0, maxY: 200 });
});

// polygonAreaModelUnits — usada pelo quantitativo de materiais
// (MaterialsPanel.ts) pra contar volume de concreto de Laje. Mesma
// fórmula (shoelace) que Core.detectRooms já usava internamente pra
// área de cômodo, agora exportada e reaproveitada — os dois cálculos
// (área de cômodo e área de laje) nunca podem dessincronizar porque é
// literalmente a mesma função nos dois lugares.
test('polygonAreaModelUnits: retângulo 10×5m (200×100 unidades de grade) dá 20000 (= 50 m² depois de dividir por GRID²)', () => {
  const laje = createLajeEntity(rectPoints(0, 0, 200, 100));
  const areaRaw = polygonAreaModelUnits(laje.points);
  assert.equal(Math.abs(areaRaw), 20000);
  assert.equal(Math.abs(areaRaw) / (GRID * GRID), 50);
});

test('polygonAreaModelUnits: contorno em "L" — área bate com retângulo maior menos o recorte', () => {
  // Mesmo "L" do teste de lajeBounds acima: quadrado 200×200 (100 m²)
  // menos o canto recortado de 100×100 (25 m²) = 75 m² esperado.
  const lShape = createLajeEntity([
    { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 },
    { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }
  ]);
  const areaRaw = polygonAreaModelUnits(lShape.points);
  assert.equal(Math.abs(areaRaw), 30000);
  assert.equal(Math.abs(areaRaw) / (GRID * GRID), 75);
});

// Altura de cômodo individual (DEC-88) — dois cômodos 3×3m lado a lado,
// compartilhando a parede do meio ("shared"), mesmo padrão de coordenadas
// (GRID=20 unidades/metro) já usado no resto do arquivo.
function twoRoomsSharingWall() {
  return [
    { id: 'a1', x1: 0, y1: 0, x2: 60, y2: 0 },
    { id: 'shared', x1: 60, y1: 0, x2: 60, y2: 60 },
    { id: 'a3', x1: 60, y1: 60, x2: 0, y2: 60 },
    { id: 'a4', x1: 0, y1: 60, x2: 0, y2: 0 },
    { id: 'b1', x1: 60, y1: 0, x2: 120, y2: 0 },
    { id: 'b2', x1: 120, y1: 0, x2: 120, y2: 60 },
    { id: 'b3', x1: 120, y1: 60, x2: 60, y2: 60 },
  ];
}

test('roomsContainingWall: parede do meio pertence aos dois cômodos, parede externa só ao próprio', () => {
  const walls = twoRoomsSharingWall();
  assert.equal(roomsContainingWall(walls, 'shared').length, 2);
  assert.equal(roomsContainingWall(walls, 'a1').length, 1);
});

test('roomHeightM: sem override nenhum cai no padrão do pavimento; maior Wall.heightM do contorno vence', () => {
  const walls = twoRoomsSharingWall();
  const roomAIds = ['a1', 'shared', 'a3', 'a4'];
  assert.equal(roomHeightM(walls, roomAIds, 2.7), 2.7);
  walls[0].heightM = 3.5; // a1
  assert.equal(roomHeightM(walls, roomAIds, 2.7), 3.5);
});

test('resolveRoomHeightUpdate: parede compartilhada nunca fica mais baixa que o cômodo vizinho', () => {
  const walls = twoRoomsSharingWall();
  const roomAIds = ['a1', 'shared', 'a3', 'a4'];
  // Cômodo B já foi levantado pra 3,0 m antes (simulado via b1.heightM).
  walls.find((w) => w.id === 'b1').heightM = 3.0;

  // Levanta o cômodo A pra 4,0 m — mais alto que B: a parede
  // compartilhada segue A (é a maior das duas).
  const raised = resolveRoomHeightUpdate(walls, roomAIds, 4.0, 2.7);
  const byIdRaised = Object.fromEntries(raised.map((u) => [u.id, u.heightM]));
  assert.equal(byIdRaised.a1, 4.0);
  assert.equal(byIdRaised.a3, 4.0);
  assert.equal(byIdRaised.a4, 4.0);
  assert.equal(byIdRaised.shared, 4.0);

  // Reduz o cômodo A pra 2,0 m — mais baixo que B (3,0 m): as paredes
  // EXCLUSIVAS de A obedecem o pedido, mas a parede compartilhada
  // continua na altura de B (nunca deixa o vizinho sem parede).
  const lowered = resolveRoomHeightUpdate(walls, roomAIds, 2.0, 2.7);
  const byIdLowered = Object.fromEntries(lowered.map((u) => [u.id, u.heightM]));
  assert.equal(byIdLowered.a1, 2.0);
  assert.equal(byIdLowered.a3, 2.0);
  assert.equal(byIdLowered.a4, 2.0);
  assert.equal(byIdLowered.shared, 3.0);
});

// DEC-89 — correção pós-lançamento: a laje de um cômodo baixo estava
// "subindo sozinha" só porque a parede que ele divide com um vizinho
// mais alto precisou acompanhar o vizinho (regra da DEC-88). roomOwnHeightM
// ignora parede compartilhada e olha só as EXCLUSIVAS do próprio cômodo.
test('roomOwnHeightM: ignora a inflação de uma parede compartilhada que só está alta pra acompanhar o vizinho', () => {
  const walls = twoRoomsSharingWall();
  const roomAIds = ['a1', 'shared', 'a3', 'a4'];
  const roomBIds = ['b1', 'shared', 'b2', 'b3'];
  // Cômodo B foi levantado pra 5,0 m — a parede compartilhada acompanha.
  walls.find((w) => w.id === 'b1').heightM = 5.0;
  walls.find((w) => w.id === 'b2').heightM = 5.0;
  walls.find((w) => w.id === 'b3').heightM = 5.0;
  walls.find((w) => w.id === 'shared').heightM = 5.0; // resolveRoomHeightUpdate já teria feito isso

  // roomHeightM (a função ANTIGA, ainda usada pra decidir a altura de
  // CADA PAREDE) continua "contaminada" de propósito — é o comportamento
  // certo pra ela.
  assert.equal(roomHeightM(walls, roomAIds, 2.7), 5.0);
  // roomOwnHeightM (usada pela LAJE) não deixa a parede compartilhada
  // inflar a altura do cômodo que não pediu por ela.
  assert.equal(roomOwnHeightM(walls, roomAIds, 2.7), 2.7);
  // Do lado do dono de verdade (B), continua refletindo a altura certa.
  assert.equal(roomOwnHeightM(walls, roomBIds, 2.7), 5.0);
});

test('roomOwnHeightM: cômodo cercado só por paredes compartilhadas cai no comportamento de roomHeightM (sem parede própria pra isolar)', () => {
  const walls = twoRoomsSharingWall();
  // Nenhuma parede de A é exclusiva nesta simulação (finge que TODAS
  // fazem fronteira com outro cômodo) — sem escapatória, usa o máximo
  // de todas mesmo, igual roomHeightM.
  const roomAIds = ['shared'];
  walls.find((w) => w.id === 'shared').heightM = 4.2;
  assert.equal(roomOwnHeightM(walls, roomAIds, 2.7), roomHeightM(walls, roomAIds, 2.7));
});

// DEC-89 — correção pós-lançamento: dividir/fundir uma parede com altura
// customizada (DEC-88) criava um pedaço novo SEM copiar Wall.heightM,
// que nascia na altura padrão do pavimento — visualmente um "buraco" no
// meio de uma parede que devia estar inteira na altura do cômodo.
test('junção em T e fusão de paredes propagam Wall.heightM pro pedaço novo criado (DEC-89)', () => {
  // splitWallsAtTJunctions: o pedaço extra nasce com createWallEntity —
  // precisa herdar a altura da parede ORIGINAL, não só finishA/finishB.
  const splitBlock = storeSource.slice(
    storeSource.indexOf('splitWallsAtTJunctions(): string[] {'),
    storeSource.indexOf('splitWallsAtTJunctions(): string[] {') + 2200,
  );
  assert.match(splitBlock, /if \(original\.heightM !== undefined\) piece\.heightM = original\.heightM;/);

  // fuseOverlappingWalls: o pedaço extra (sobra que não é nem A nem B)
  // também precisa herdar de quem realmente originou aquele trecho
  // (seg.from), não nascer sem altura nenhuma.
  const fuseBlock = storeSource.slice(
    storeSource.indexOf('fuseOverlappingWalls(wallAId: string, wallBId: string): void {'),
    storeSource.indexOf('fuseOverlappingWalls(wallAId: string, wallBId: string): void {') + 3600,
  );
  assert.match(fuseBlock, /const source = seg\.from === 'b' \? b : a;/);
  assert.match(fuseBlock, /if \(source\.heightM !== undefined\) piece\.heightM = source\.heightM;/);
});

// DEC-91 — correção pós-lançamento: Core.computeWallFootprints é geometria
// 2D pura (não sabe nada de Wall.heightM) — um canto "fechado" (Free:
// false, sem tampa própria) presume as duas paredes na MESMA altura. Com
// altura por cômodo (DEC-88), a parede mais alta ficava com um vão aberto
// (sem tampa e sem vizinha cobrindo) na faixa acima da altura da vizinha
// mais baixa — bug reportado como "canto aberto, sem tampinha" depois de
// um arrasto que reconstrói a junção em T.
test('tampa parcial de canto cobre o vão quando a vizinha do canto "fechado" é mais baixa (DEC-91)', () => {
  // Tolerante a CRLF/LF de propósito — o blob local (Windows) e o checkout
  // do runner de CI (Linux) já divergiram nisso antes (git normaliza fim
  // de linha de formas diferentes conforme o ambiente).
  const roomsStart = scene3DRendererSource.indexOf('project.floors.forEach(function (floorData, floorIdx) {');
  const wallLoopStart = scene3DRendererSource.indexOf('floorData.walls.forEach(function (w) {', roomsStart);
  const afterFacesStart = scene3DRendererSource.indexOf("(['a', 'b'] as const).forEach(function (side) {", wallLoopStart);
  const blankLineMatch = scene3DRendererSource.slice(afterFacesStart).match(/\r?\n\r?\n/);
  const wallLoopEnd = blankLineMatch ? afterFacesStart + blankLineMatch.index : scene3DRendererSource.length;
  const wallFlow = scene3DRendererSource.slice(wallLoopStart, wallLoopEnd);

  // Altura efetiva de qualquer parede (não só a `w` da vez) — mesma regra
  // de prioridade (heightM > ático gerado > padrão do pavimento) usada
  // pra achar a altura da vizinha num canto.
  assert.match(scene3DRendererSource, /function wallEffectiveHeight\(ww: any\) \{/);
  assert.match(scene3DRendererSource, /function neighborMaxHeightAt\(px: number, py: number, excludeId: string\) \{/);

  // Só entra quando o canto já está "fechado" (nem free nem extended) —
  // senão duplicaria a tampa de ponta livre que já existe acima.
  assert.match(wallFlow, /if \(!\(fp\.p1Free !== false \|\| fp\.p1Extended\)\) \{/);
  assert.match(wallFlow, /if \(!\(fp\.p2Free !== false \|\| fp\.p2Extended\)\) \{/);
  // Reaproveita buildWallEndCapMesh com um yOffset deslocado pra altura da
  // vizinha — a "sobra" vai só de neighborMaxH até a altura própria.
  assert.match(wallFlow, /buildWallEndCapMesh\(fp, renderedWallHeight - p1NeighborMaxH, yOffset \+ p1NeighborMaxH, topMat, 1\)/);
  assert.match(wallFlow, /buildWallEndCapMesh\(fp, renderedWallHeight - p2NeighborMaxH, yOffset \+ p2NeighborMaxH, topMat, 2\)/);
  // Ático gerado já resolve a extensão de parede à parte (buildAtticWallExtensions) — não duplica aqui.
  assert.match(wallFlow, /if \(!generatedAtticRoof\) \{\s*\n\s*if \(!\(fp\.p1Free/);
});

// DEC-92 — correção pós-lançamento: resolveRoomHeightUpdate (DEC-88) só
// aplica a regra "parede compartilhada nunca fica mais baixa que o
// cômodo vizinho" NO MOMENTO do arraste. Uma mudança de topologia DEPOIS
// disso (nova junção encostando numa parede que já era compartilhada,
// por exemplo) não reaplica a regra sozinha — Wall.heightM fica
// desatualizado, mais baixo do que deveria. Sintoma reportado pelo
// Product Owner: vão/buraco na fachada ao longo da parede INTEIRA (não
// só no canto — a tampa parcial da DEC-91 sozinha não resolve, porque o
// problema não é o canto, é a altura da parede em si estar errada).
// resolvedWallHeights recalcula a altura de renderização de CADA parede
// do zero a cada chamada, então fica correto não importa a ordem/histórico
// de edições que levou até aquele estado.
test('resolvedWallHeights: parede compartilhada "esquecida" na altura antiga (por mudança de topologia) é recalculada certa, sem depender de Wall.heightM já estar em dia (DEC-92)', () => {
  const walls = twoRoomsSharingWall();
  const roomAIds = ['a1', 'shared', 'a3', 'a4'];
  // Cômodo A foi levantado pra 4,5 m (via resolveRoomHeightUpdate, que na
  // hora JÁ teria levantado 'shared' junto) — mas aqui simulamos o caso
  // real reportado: 'shared' ficou pra trás, sem heightM nenhum, como se
  // essa junção só tivesse passado a existir DEPOIS do arraste original.
  walls.find((w) => w.id === 'a1').heightM = 4.5;
  walls.find((w) => w.id === 'a3').heightM = 4.5;
  walls.find((w) => w.id === 'a4').heightM = 4.5;
  // 'shared'.heightM continua undefined — o "esquecimento" sendo testado.
  assert.equal(walls.find((w) => w.id === 'shared').heightM, undefined);

  const resolved = resolvedWallHeights(walls, 2.7);
  // A parede compartilhada é recalculada pra 4,5 m mesmo sem Wall.heightM
  // ter sido atualizado — a regra "sempre o cômodo mais alto" é reaplicada
  // ao vivo, não só uma vez no momento do arraste original.
  assert.equal(resolved.shared, 4.5);
  assert.equal(resolved.a1, 4.5);
  // Do lado do cômodo B (não participou do arraste, continua no padrão):
  // suas paredes EXCLUSIVAS (b1/b2/b3) não são forçadas pra cima — só a
  // parede que ele COMPARTILHA com A é que segue a regra.
  assert.equal(resolved.b1, 2.7);
  assert.equal(resolved.b2, 2.7);
  assert.equal(resolved.b3, 2.7);
});

test('resolvedWallHeights: parede exclusiva de um único cômodo nunca é forçada — só existe "vizinho mais alto" quando há 2+ cômodos', () => {
  const walls = twoRoomsSharingWall();
  // a1 é exclusiva de A (não aparece no contorno de B) — mesmo que outra
  // parede exclusiva do mesmo cômodo (a3) esteja mais alta, a1 não é
  // arrastada junto por esta função (resolvedWallHeights só entra em
  // ação pra parede COMPARTILHADA entre 2+ cômodos).
  walls.find((w) => w.id === 'a3').heightM = 5.0;
  const resolved = resolvedWallHeights(walls, 2.7);
  assert.equal(resolved.a1, 2.7);
  assert.equal(resolved.a3, 5.0);
});

test('Scene3DRenderer usa Core.resolvedWallHeights (não mais Wall.heightM cru) pra decidir a altura renderizada de cada parede (DEC-92)', () => {
  assert.match(scene3DRendererSource, /var resolvedWallHeightsMap = Core\.resolvedWallHeights\(floorData\.walls, currentWallHeight\);/);
  assert.match(scene3DRendererSource, /var renderedWallHeight = generatedAtticRoof \? \(generatedAtticRoof\.baseHeightM \|\| 1\.2\) : \(resolvedWallHeightsMap\[w\.id\]/);
  // wallEffectiveHeight (usada pela tampa parcial de canto da DEC-91) fica
  // consistente com a mesma fonte, em vez de reler w.heightM cru.
  assert.match(scene3DRendererSource, /return wAtticRoof \? \(wAtticRoof\.baseHeightM \|\| 1\.2\) : \(resolvedWallHeightsMap\[ww\.id\]/);
});

// DEC-93 — correção pós-lançamento: a "quina aberta" continuava aparecendo
// mesmo depois da DEC-91/92 fecharem o volume sólido de verdade. Causa:
// buildWallFootprintEdgeLines desenhava uma linha VERTICAL do chão ao teto
// no canto ESTENDIDO da parede perpendicular de uma junção em T "disfarçada"
// de 3 vias (free: false, extended: true) — condição idêntica à usada pra
// decidir a TAMPA SÓLIDA (`p1Free !== false || p1Extended`), mas o canto
// estendido desse caso específico fica sobreposto ao território das duas
// paredes retas que ele mesmo fecha (não é uma aresta real, ao contrário
// da dobra rasa de 2 paredes, onde o mesmo par free:true/extended:true
// realmente é a única coisa cobrindo o canto). O resultado era uma linha
// cheia (chão ao teto) desenhada no meio da face das paredes vizinhas —
// lê como rachadura, mesmo sem buraco nenhum na malha por baixo.
test('linha de contorno vertical só aparece em ponta LIVRE de verdade (free === true) — junção em T disfarçada (free: false, extended: true) não ganha linha espúria no meio da face da vizinha (DEC-93)', () => {
  // Tolerante a CRLF/LF de propósito — o blob local (Windows) e o checkout
  // do runner de CI (Linux) já divergiram nisso antes (ver DEC-91).
  const fnStart = scene3DRendererSource.indexOf('function buildWallFootprintEdgeLines(fp: any, height: any, yOffset: any, showTop = true) {');
  assert.notEqual(fnStart, -1);
  const fnEndMatch = scene3DRendererSource.slice(fnStart).match(/\r?\n  \}/);
  const fnEnd = fnStart + fnEndMatch.index;
  const fnBody = scene3DRendererSource.slice(fnStart, fnEnd);
  assert.match(fnBody, /if \(fp\.p1Free === true\) \{/);
  assert.match(fnBody, /if \(fp\.p2Free === true\) \{/);
  // Não pode voltar a usar a condição ampla (a mesma do endcap sólido) —
  // essa é exatamente a regressão que causou a rachadura visual.
  assert.doesNotMatch(fnBody, /if \(fp\.p1Free !== false \|\| fp\.p1Extended\)/);
  assert.doesNotMatch(fnBody, /if \(fp\.p2Free !== false \|\| fp\.p2Extended\)/);

  // O endcap SÓLIDO (tampa de verdade, DEC-91) continua usando a condição
  // ampla de propósito — ele PRECISA fechar o volume ali, ao contrário da
  // linha, que é só contorno cosmético.
  assert.match(scene3DRendererSource, /if \(fp\.p1Free !== false \|\| fp\.p1Extended\) \{\r?\n\s*var endCap1/, 'endcap sólido continua com a condição ampla — só a linha de contorno mudou');
});

// DEC-94 — telhado fantasma (prévia, antes do primeiro clique) acompanha a
// altura do cômodo embaixo dele: arrastar sobre um cômodo mais alto sobe o
// fantasma, arrastar sobre um cômodo padrão desce de volta. Antes, tanto o
// fantasma quanto o telhado já colocado usavam sempre `currentWallHeight`
// (altura única do pavimento inteiro), então um telhado sobre um cômodo
// elevado (DEC-88) ficava encravado dentro da parede alta.
test('roomAtPoint: acha o cômodo fechado que contém o ponto; null fora de qualquer contorno', () => {
  const walls = twoRoomsSharingWall();
  const roomA = roomAtPoint(walls, 30, 30); // dentro do cômodo A (0,0)-(60,60)
  assert.ok(roomA, 'deveria achar o cômodo A');
  const roomB = roomAtPoint(walls, 90, 30); // dentro do cômodo B (60,0)-(120,60)
  assert.ok(roomB, 'deveria achar o cômodo B');
  assert.notDeepEqual(roomA.points, roomB.points);
  assert.equal(roomAtPoint(walls, 500, 500), null, 'ponto fora de qualquer cômodo fechado devolve null');
});

test('roofHeightAtRect: acompanha a altura PRÓPRIA do cômodo sob o centro do retângulo, cai pro padrão do pavimento fora de cômodo fechado (DEC-94)', () => {
  const walls = twoRoomsSharingWall();
  // Cômodo B levantado pra 4,5 m — a parede compartilhada ('shared') segue junto.
  ['b1', 'b2', 'b3', 'shared'].forEach((id) => { walls.find((w) => w.id === id).heightM = 4.5; });

  const rectOverA = roofHeightAtRect(walls, 5, 5, 55, 55, 2.7); // centro (30,30), dentro de A
  assert.equal(rectOverA, 2.7, 'cômodo A não foi alterado, permanece no padrão do pavimento');

  const rectOverB = roofHeightAtRect(walls, 65, 5, 115, 55, 2.7); // centro (90,30), dentro de B
  assert.equal(rectOverB, 4.5, 'cômodo B foi levantado — o telhado sobre ele acompanha');

  const rectOutside = roofHeightAtRect(walls, 500, 500, 550, 550, 2.7);
  assert.equal(rectOutside, 2.7, 'fora de qualquer cômodo fechado cai pro padrão do pavimento');
});

// Correção pós-lançamento da DEC-94: um retângulo de telhado real
// (projeto reportado, link "?p=a34kapj2") tinha o CENTRO dentro do
// cômodo baixo (B, sem override), mas as BORDAS do retângulo tocavam a
// parede compartilhada com o cômodo alto (A) — e essa parede compartilhada
// (corretamente resolvida pra altura de A via Core.resolvedWallHeights)
// ficava mais alta que o telhado apoiado só na altura do cômodo do
// centro, furando o parapeito por cima. Confirmado ao vivo por ray
// casting: telhado a 2,7m-based, parede compartilhada a 3,97m — depois
// da correção, telhado sobe pra acompanhar a parede mais alta que toca.
test('roofHeightAtRect: nunca fica mais baixo que a parede COMPARTILHADA mais alta cujas pontas o retângulo toca, mesmo com o centro caindo no cômodo baixo', () => {
  const walls = twoRoomsSharingWall();
  // Cômodo A levantado pra 4,5 m — a parede compartilhada ('shared') segue junto.
  ['a1', 'a3', 'a4', 'shared'].forEach((id) => { walls.find((w) => w.id === id).heightM = 4.5; });

  // Retângulo com centro em (35,30) — dentro do cômodo B, NÃO alterado —
  // mas que se estende até x=65, tocando as duas pontas de 'shared' (x=60).
  const rectTouchingShared = roofHeightAtRect(walls, 5, -5, 65, 65, 2.7);
  assert.equal(rectTouchingShared, 4.5, 'a parede compartilhada mais alta não pode furar o telhado por cima');

  // Controle: um retângulo do lado de B (não alterado), que não chega a
  // tocar 'shared' (x=60), continua só na altura do cômodo do centro —
  // comportamento de antes, inalterado.
  const rectNotTouchingShared = roofHeightAtRect(walls, 65, 5, 115, 55, 2.7);
  assert.equal(rectNotTouchingShared, 2.7, 'sem tocar a parede compartilhada, cai só na altura do cômodo do centro');
});

test('ViewportController: hover da ferramenta Telhado calcula Core.roofHeightAtRect e grava em drawPreview.roofBaseHeightM', () => {
  const hoverStart = viewportControllerSource.indexOf("if (currentTool === 'telhado' && !placingDraw && !selectedRoofId) {");
  assert.notEqual(hoverStart, -1);
  const hoverBlock = viewportControllerSource.slice(hoverStart, hoverStart + 1200);
  assert.match(hoverBlock, /var roofHeightT = Core\.roofHeightAtRect\(Store\.currentWalls\(\), rectT\.x1, rectT\.y1, rectT\.x2, rectT\.y2, Scene3DRenderer\.WALL_HEIGHT_GETTER\(\)\);/);
  assert.match(hoverBlock, /roofBaseHeightM: roofHeightT/);
});

test('Scene3DRenderer: prévia (ghost) do telhado usa drawPreview.roofBaseHeightM, e o telhado já colocado usa Core.roofHeightAtRect por cômodo (DEC-94)', () => {
  const ghostStart = scene3DRendererSource.indexOf("} else if (p.tool === 'telhado') {");
  assert.notEqual(ghostStart, -1);
  const ghostEndMatch = scene3DRendererSource.slice(ghostStart).match(/\r?\n {4}\}\r?\n {2}\}/);
  assert.ok(ghostEndMatch, 'bloco de prévia do telhado não encontrado por inteiro');
  const ghostBlock = scene3DRendererSource.slice(ghostStart, ghostStart + ghostEndMatch.index + ghostEndMatch[0].length);
  assert.match(ghostBlock, /var ghostRoofHeight = p\.roofBaseHeightM != null \? p\.roofBaseHeightM : WALL_HEIGHT;/);
  assert.match(ghostBlock, /p\.yOffset \+ ghostRoofHeight \+ 0\.01/);
  assert.match(ghostBlock, /p\.yOffset \+ ghostRoofHeight, viewState/);

  assert.match(
    scene3DRendererSource,
    /var roofOwnHeight = roof\.atticMode \? \(roof\.baseHeightM \|\| 1\.2\) : Core\.roofHeightAtRect\(floorData\.walls, roof\.x1, roof\.y1, roof\.x2, roof\.y2, currentWallHeight\);/
  );
});

// DEC-90 — botão "Gerar Laje": cômodo nasce sem laje visível/contabilizada;
// um clique marca TODOS os cômodos fechados do pavimento atual de uma vez
// (cada um com seu próprio roomKey, não uma peça única fundida).
test('Store.commands.generateLajeForCurrentFloor existe, marca todo cômodo fechado do pavimento de uma vez, e cada um com seu próprio roomKey', () => {
  const cmdStart = storeSource.indexOf('generateLajeForCurrentFloor(): void {');
  assert.notEqual(cmdStart, -1);
  const cmdBlock = storeSource.slice(cmdStart, cmdStart + 800);
  assert.match(cmdBlock, /const rooms = Core\.detectRooms\(f\.walls\);/);
  assert.match(cmdBlock, /rooms\.forEach\(\(room\) => \{/);
  assert.match(cmdBlock, /const roomKey = Core\.findRoomWallIds\(f\.walls, room\)\.slice\(\)\.sort\(\)\.join\(','\);/);
  assert.match(cmdBlock, /f\.roomLajeGenerated!\[roomKey\] = true;/);
});

test('quantitativo de materiais só soma a laje de cômodo com roomLajeGenerated marcado', () => {
  assert.match(
    materialsPanelSource,
    /const roomKey = Core\.findRoomWallIds\(floor\.walls, room\)\.slice\(\)\.sort\(\)\.join\(','\);\s*\n\s*if \(!\(floor\.roomLajeGenerated \|\| \{\}\)\[roomKey\]\) return;/,
  );
});

test('botão "Gerar Laje" existe no HTML e está ligado ao comando do Store', () => {
  assert.match(indexHtmlSource, /id="generateLajeBtn"/);
  assert.match(
    esboceApplicationSource,
    /requireElement\("generateLajeBtn"\)\.addEventListener\("click", \(\) => \{[\s\S]{0,300}Store\.commands\.generateLajeForCurrentFloor\(\);/,
  );
});
