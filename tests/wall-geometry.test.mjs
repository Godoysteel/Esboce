import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  COINCIDENCE_TOL,
  GRID,
  WALL_THICK,
  computeWallFootprints,
  detectRooms,
  findIsolatedRoomWallIds,
  findWallTJunctionSplits,
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
