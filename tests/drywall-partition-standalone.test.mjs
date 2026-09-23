import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  createDrywallPartitionEntity, createProject, WALL_HEIGHT, GRID,
  DRYWALL_PARTITION_DEFAULT_LENGTH_M, DRYWALL_PARTITION_MIN_LENGTH_M, DRYWALL_PARTITION_MAX_LENGTH_M,
  DRYWALL_PARTITION_MIN_HEIGHT_M, DRYWALL_PARTITION_MAX_HEIGHT_M, DRYWALL_PARTITION_MAX_SILL_HEIGHT_M,
} from '../src/core/Core.ts';
import {
  DRYWALL_PARTITION_TYPES, DRYWALL_PARTITION_DEFAULT_TYPE_ID, findDrywallPartitionType,
} from '../src/core/DrywallPartitionTypes.ts';
import {
  decodeProjectDocument, encodeProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION,
} from '../src/core/ProjectPersistence.ts';

// DEC-229 — a peça "Nova divisória" da DEC-228 (parede de verdade via
// desenho de 2 cliques, processada por Core.detectRooms) foi rejeitada
// pelo Product Owner depois de testar em produção: "a divisória de
// drywall não deve influenciar nas paredes e comodos, elas devem ser
// independentes". Esta suíte cobre o objeto livre que a substitui.

// --- createDrywallPartitionEntity: nasce solta, com os padrões certos --

test('createDrywallPartitionEntity nasce com os padrões certos: comprimento default, altura = pé-direito, sem elevação, sem tipo/acabamento fixados', () => {
  const p = createDrywallPartitionEntity(100, 200);
  assert.equal(p.x, 100);
  assert.equal(p.y, 200);
  assert.equal(p.rotationDeg, 0);
  assert.equal(p.lengthM, DRYWALL_PARTITION_DEFAULT_LENGTH_M);
  assert.equal(p.heightM, WALL_HEIGHT);
  assert.equal(p.sillHeightM, 0);
  assert.equal(p.thicknessTypeId, undefined); // ausente = usa DRYWALL_PARTITION_DEFAULT_TYPE_ID, ver findDrywallPartitionType
  assert.equal(p.finishAssemblyId, 'drywall-st');
  assert.ok(p.id);
});

test('createDrywallPartitionEntity aceita rotação CONTÍNUA (não múltiplo de 90°), comprimento, altura e tipo customizados', () => {
  const p = createDrywallPartitionEntity(0, 0, 37.5, 3.2, 2.4, undefined, 'guide-70-simple', 'drywall-ru', 0.3);
  assert.equal(p.rotationDeg, 37.5);
  assert.equal(p.lengthM, 3.2);
  assert.equal(p.heightM, 2.4);
  assert.equal(p.thicknessTypeId, 'guide-70-simple');
  assert.equal(p.finishAssemblyId, 'drywall-ru');
  assert.equal(p.sillHeightM, 0.3);
});

// --- Catálogo de tipos (DrywallPartitionTypes.ts) -----------------------

test('DRYWALL_PARTITION_TYPES tem espessura total coerente com a guia (guia nunca maior que a espessura total)', () => {
  assert.ok(DRYWALL_PARTITION_TYPES.length >= 3, 'catálogo pequeno, mas com pelo menos 3 tipos (Product Owner: "poucos tipos com espessura real")');
  DRYWALL_PARTITION_TYPES.forEach((t) => {
    assert.ok(t.totalThicknessMm > t.guideMm, `${t.id}: espessura total (${t.totalThicknessMm}mm) deve ser maior que a guia (${t.guideMm}mm)`);
  });
  const ids = DRYWALL_PARTITION_TYPES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'ids únicos');
});

test('DRYWALL_PARTITION_DEFAULT_TYPE_ID aponta pro primeiro tipo do catálogo, e findDrywallPartitionType cai nele quando o id é ausente/desconhecido', () => {
  assert.equal(DRYWALL_PARTITION_DEFAULT_TYPE_ID, DRYWALL_PARTITION_TYPES[0].id);
  assert.equal(findDrywallPartitionType(undefined).id, DRYWALL_PARTITION_DEFAULT_TYPE_ID);
  assert.equal(findDrywallPartitionType('tipo-que-nao-existe').id, DRYWALL_PARTITION_DEFAULT_TYPE_ID);
  assert.equal(findDrywallPartitionType('guide-70-double').totalThicknessMm, 145);
});

// --- Persistência: ida e volta preserva o giro livre --------------------

test('persistência: divisória de drywall sobrevive a ida e volta (encode/decode), incluindo rotationDeg NÃO múltiplo de 90 (prova do giro livre)', () => {
  const project = createProject();
  const partition = createDrywallPartitionEntity(120, 340, 12.5, 2.5, 2.6, undefined, 'guide-90-simple', 'drywall-rf', 0.4);
  project.floors[0].drywallPartitions.push(partition);
  const document = encodeProjectDocument(project);
  const decoded = decodeProjectDocument(document);
  assert.deepEqual(decoded.project.floors[0].drywallPartitions, [partition]);
  assert.equal(decoded.project.floors[0].drywallPartitions[0].rotationDeg, 12.5);
});

test('persistência: documento salvo antes da DEC-229 (sem floor.drywallPartitions) decodifica com lista vazia', () => {
  const legacy = {
    schemaVersion: 20,
    project: {
      floors: [{ id: 'floor-1', name: 'Térreo', walls: [], columns: [], roofs: [], openings: [], varandas: [], roomFinishes: {} }],
      currentFloorIndex: 0,
      layers: {},
      foundationType: 'baldrame',
      constructionSystem: 'ceramic_masonry',
    },
  };
  const decoded = decodeProjectDocument(legacy);
  assert.equal(decoded.migrated, true);
  assert.deepEqual(decoded.project.floors[0].drywallPartitions, []);
});

// --- Store.ts: comandos existem com a assinatura esperada (regex sobre
// a fonte — Store.ts tem import de VALOR de Core.js sem arquivo .js
// correspondente no disco, mesma limitação documentada em terreno.test.mjs,
// não executável sob `node --experimental-strip-types`) -----------------

test('Store.ts define os comandos da divisória de drywall livre: criar, mover corpo, redimensionar comprimento/altura, girar (absoluto E por passo), tipo e excluir', () => {
  const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  assert.match(storeSource, /createDrywallPartition\(x: number, y: number, rotationDeg\?: number\): DrywallPartition \| null/);
  assert.match(storeSource, /updateDrywallPartitionBodyLive\(drywallPartitionId: string, x: number, y: number\): void/);
  assert.match(storeSource, /updateDrywallPartitionLengthLive\(drywallPartitionId: string, lengthM: number, centerDeltaM = 0\): void/);
  assert.match(storeSource, /updateDrywallPartitionVerticalLive\(drywallPartitionId: string, heightM: number, sillHeightM: number\): void/);
  assert.match(storeSource, /rotateDrywallPartitionBy\(drywallPartitionId: string, stepDeg\?: number\): void/);
  assert.match(storeSource, /rotateDrywallPartitionTo\(drywallPartitionId: string, rotationDeg: number\): void/);
  assert.match(storeSource, /setDrywallPartitionType\(drywallPartitionId: string, thicknessTypeId: string\): void/);
  assert.match(storeSource, /deleteDrywallPartition\(drywallPartitionId: string\): void/);
});

test('rotateDrywallPartitionTo aceita ângulo ABSOLUTO contínuo (contraste com rotateBalconyRailing/rotateVolumeBox, que só giram em passos fixos de 90°)', () => {
  const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  const start = storeSource.indexOf('rotateDrywallPartitionTo(drywallPartitionId: string, rotationDeg: number): void {');
  assert.ok(start !== -1);
  const end = storeSource.indexOf('\n  },', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /p\.rotationDeg = \(\(rotationDeg % 360\) \+ 360\) % 360;/);
  assert.doesNotMatch(body, /pushUndoSnapshot/, 'live/contínuo — a transação já começou no pointerdown do gesto de arraste');
});

// --- ViewportController.ts: snap de ponta contra parede, criação
// paralela à parede mais próxima, e ausência da peça "Nova divisória"
// (DEC-228) que este objeto livre substitui (regex sobre a fonte —
// mesma limitação de módulo denso em DOM, nunca executado pelos testes) -

test('ViewportController.ts define o snap de ponta contra parede (clampDrywallPartitionTipsOutOfWalls/pushPointOutOfWallRect) e o cálculo do ângulo da parede mais próxima (nearestWallAngleDeg)', () => {
  const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(vpSource, /function pushPointOutOfWallRect\(/);
  assert.match(vpSource, /function clampDrywallPartitionTipsOutOfWalls\(id: string\)/);
  assert.match(vpSource, /function nearestWallAngleDeg\(px: number, py: number\): number/);
  // Chamado ao soltar corpo, pontas E rotação — nunca durante o arraste.
  const matches = vpSource.match(/clampDrywallPartitionTipsOutOfWalls\(/g) || [];
  assert.ok(matches.length >= 4, 'declaração + pelo menos 3 chamadas (corpo, comprimento, rotação)');
});

test('ViewportController.ts cria a divisória de drywall livre via botão data-room-preset (mesmo padrão de todo objeto livre do app — Sacada de vidro, Cubo mágico), não mais via ferramenta armada de 2 cliques (drywallDraw, removida)', () => {
  const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(vpSource, /if \(key === 'drywall-partition'\) \{/);
  assert.match(vpSource, /Store\.commands\.createDrywallPartition\(gxDp, gyDp, angleDp\)/);
  assert.doesNotMatch(vpSource, /drywallDraw/);
});

test('ViewportController.ts arrasta o corpo da divisória SEM grid-snap (Product Owner: "essa divisória não segue o grid, o arraste é livre")', () => {
  const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = vpSource.indexOf("if (dragMode === 'drywallPartitionBody') {");
  assert.ok(start !== -1);
  const end = vpSource.indexOf('\n    }', start);
  const body = vpSource.slice(start, end);
  assert.doesNotMatch(body, /Core\.snap\(|snapDrywallPartition|Math\.round\(/, 'sem nenhuma chamada de arredondamento de grade durante o arraste do corpo');
});

test('ViewportController.ts registra a alça de giro LIVRE nova (drywallPartitionRotate) — nenhum outro objeto livre do app tem essa alça, todos usam só botão de passo de 90°', () => {
  const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(vpSource, /handle === 'drywallPartitionRotate'/);
  assert.match(vpSource, /rotateDrywallPartitionTo\(dpRotId, finalDpRotation\)/);
});

// --- index.html: botão novo existe, sem sobra da DEC-228 -----------------

test('index.html tem o botão "Divisória livre" (data-room-preset) dentro do painel Drywall, e não tem mais nenhum resquício de drywallDraw', () => {
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="addDrywallPartitionBtn" data-room-preset="drywall-partition"/);
  assert.doesNotMatch(htmlSource, /drywallDraw/);
  assert.match(htmlSource, /id="drywallPartitionTypePanel" class="shape-panel"/);
});

// --- MaterialsPanel.ts: soma no mesmo orçamento de drywall das paredes --

test('MaterialsPanel.drywallPartitionQuantities soma floor.drywallPartitions na MESMA agregação das paredes de drywall (preço uniforme, sem duplicar add()/quantityWithWaste())', () => {
  const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');
  assert.match(materialsSource, /\(floor\.drywallPartitions \|\| \[\]\)\.forEach\(\(partition\) => \{/);
  assert.match(materialsSource, /structuralArea \+= faceAreaM2 \* 2;/);
});

// --- Scene3DRenderer.ts: mesh + alças de seleção existem ------------------

test('Scene3DRenderer.ts constrói o mesh da divisória (buildDrywallPartitionMesh, espessura via catálogo de tipos) e as alças de seleção, incluindo a de giro', () => {
  const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(rendererSource, /function buildDrywallPartitionMesh\(/);
  assert.match(rendererSource, /findDrywallPartitionType\(partition\.thicknessTypeId\)\.totalThicknessMm \/ 1000/);
  assert.match(rendererSource, /if \(viewState\.selectedDrywallPartition\) \{/);
  assert.match(rendererSource, /'drywallPartitionRotate'/);
});
