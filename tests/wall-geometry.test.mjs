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
  resolveWallOffsetAgainstOpenings,
  resolveWallGroupGridDelta,
  resolveWallResizeOffset,
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

test('parede de comodo para a 0,50 m antes de atravessar parede paralela', () => {
  const moving = { id: 'moving', x1: 0, y1: 0, x2: 80, y2: 0 };
  const obstacle = { id: 'obstacle', x1: 20, y1: 40, x2: 100, y2: 40 };

  const result = resolveWallResizeOffset(moving, [moving, obstacle], 60, 0, 1);

  assert.deepEqual(result, {
    offset: 30,
    limited: true,
    blockingWallId: 'obstacle',
  });
});

test('limite preventivo funciona nos dois sentidos e ignora parede sem sobreposicao', () => {
  const moving = { id: 'moving', x1: 0, y1: 0, x2: 80, y2: 0 };
  const behind = { id: 'behind', x1: 0, y1: -40, x2: 80, y2: -40 };
  const outsideSpan = { id: 'outside', x1: 100, y1: 20, x2: 140, y2: 20 };

  assert.equal(resolveWallResizeOffset(moving, [moving, behind], -60, 0, 1).offset, -30);
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
