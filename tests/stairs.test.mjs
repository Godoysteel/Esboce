import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createStairEntity, stairStepPlan, stairFootprintRectangle, nearestSupportDistanceMeters, createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION } from '../src/core/ProjectPersistence.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const gizmoSource = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

// Product Owner: "como devemos implantar as escadas agora, vamos ter
// alguns modelos de escadas diferentes, quero que seja uma escada com
// posicionamento e rotação livre, onde ela é posicionada abre o buraco
// na laje, ela deve ser implantada se o início dos degraus ficarem
// próximos a parede ou colunas." Confirmado por perguntas diretas: só o
// modelo reto nesta rodada, rotação em passos de 90° (mesmo padrão do
// resto do app), aviso não-bloqueante (sem travar) se a base ficar
// longe de apoio.

test('createStairEntity nasce solta, modelo reto por padrão, largura padrão, rotação 0', () => {
  const stair = createStairEntity(100, 200);
  assert.equal(stair.model, 'reta');
  assert.equal(stair.widthM, Core.STAIR_DEFAULT_WIDTH_M);
  assert.equal(stair.x, 100);
  assert.equal(stair.y, 200);
  assert.equal(stair.rotationDeg, 0);
});

test('stairStepPlan: nº de degraus cobre a altura do pavimento com a regra de Blondel, sem sobrar nem faltar', () => {
  const plan = stairStepPlan(2.85); // FLOOR_STACK_HEIGHT padrão
  assert.equal(plan.stepCount, Math.ceil(2.85 / Core.STAIR_RISER_M));
  assert.ok(Math.abs(plan.stepCount * plan.riserRealM - 2.85) < 1e-9, 'a soma dos espelhos reais deve bater exatamente com o pé-direito');
  assert.ok(Math.abs(plan.lengthM - plan.stepCount * Core.STAIR_TREAD_M) < 1e-9);
});

test('stairFootprintRectangle: retângulo axis-aligned, largura×comprimento em rotação 0, comprimento×largura em rotação 90 (só troca de eixo, sem matemática de ângulo livre)', () => {
  const stair0 = createStairEntity(0, 0, 0, 1.0);
  const rect0 = stairFootprintRectangle(stair0, 2.85);
  const plan = stairStepPlan(2.85);
  assert.ok(Math.abs((rect0.x2 - rect0.x1) / Core.GRID - 1.0) < 1e-6, 'largura no eixo X quando rotationDeg=0');
  assert.ok(Math.abs((rect0.y2 - rect0.y1) / Core.GRID - plan.lengthM) < 1e-6, 'comprimento no eixo Y quando rotationDeg=0');

  const stair90 = createStairEntity(0, 0, 90, 1.0);
  const rect90 = stairFootprintRectangle(stair90, 2.85);
  assert.ok(Math.abs((rect90.x2 - rect90.x1) / Core.GRID - plan.lengthM) < 1e-6, 'comprimento no eixo X quando rotationDeg=90 (trocou de eixo)');
  assert.ok(Math.abs((rect90.y2 - rect90.y1) / Core.GRID - 1.0) < 1e-6, 'largura no eixo Y quando rotationDeg=90');
});

test('nearestSupportDistanceMeters: perto de parede dá distância pequena, perto de coluna também, longe de tudo dá distância grande', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 200, y2: 0 };
  const column = { id: 'c', x: 400, y: 400, shape: 'quadrada' };
  // Ponto a 10 unidades (0,5m) da parede
  const nearWall = nearestSupportDistanceMeters(50, 10, [wall], []);
  assert.ok(nearWall < 1, 'ponto perto da parede deve dar distância pequena (metros)');
  // Ponto bem perto do centro da coluna
  const nearColumn = nearestSupportDistanceMeters(401, 400, [], [column]);
  assert.ok(nearColumn < 0.2, 'ponto quase em cima da coluna deve dar distância pequena (descontado o raio efetivo)');
  // Ponto longe de tudo
  const farFromAll = nearestSupportDistanceMeters(2000, 2000, [wall], [column]);
  assert.ok(farFromAll > 10, 'ponto longe de parede e coluna deve dar distância grande');
});

test('round-trip de persistência: Stair sobrevive a encode/decode com os mesmos campos', () => {
  const project = createProject();
  const stair = createStairEntity(50, 60, 90, 1.2);
  project.floors[0].stairs.push(stair);
  const doc = encodeProjectDocument(project);
  assert.equal(doc.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  const decoded = decodeProjectDocument(doc);
  const roundTripped = decoded.project.floors[0].stairs[0];
  assert.equal(roundTripped.id, stair.id);
  assert.equal(roundTripped.x, 50);
  assert.equal(roundTripped.y, 60);
  assert.equal(roundTripped.rotationDeg, 90);
  assert.equal(roundTripped.model, 'reta');
  assert.equal(roundTripped.widthM, 1.2);
});

test('projeto salvo antes da v15 (sem stairs) migra normalmente, com lista vazia', () => {
  const project = createProject();
  const legacyDoc = { schemaVersion: 14, project: JSON.parse(JSON.stringify(project)) };
  delete legacyDoc.project.floors[0].stairs;
  const decoded = decodeProjectDocument(legacyDoc);
  assert.deepEqual(decoded.project.floors[0].stairs, []);
});

test('index.html: botão "Escada" (data-room-preset) e gizmo próprio (#stairGizmo) existem', () => {
  assert.match(html, /data-room-preset="escada"/);
  assert.match(html, /id="stairGizmo"/);
});

test('Store: rotateStair gira em passos de 90° (cópia do padrão de rotateVolumeBox/rotateFurniture) — sem alça de giro livre', () => {
  const start = storeSource.indexOf('rotateStair(stairId: string');
  assert.notEqual(start, -1);
  const body = storeSource.slice(start, storeSource.indexOf('\n  },', start));
  assert.match(body, /const step = stepDeg \|\| 90;/);
  assert.match(body, /s\.rotationDeg = \(s\.rotationDeg \+ step \+ 360\) % 360;/);
});

test('Store: updateStairWidthLive existe e respeita STAIR_MIN_WIDTH_M/STAIR_MAX_WIDTH_M', () => {
  const start = storeSource.indexOf('updateStairWidthLive(stairId: string');
  assert.notEqual(start, -1);
  const body = storeSource.slice(start, storeSource.indexOf('\n  },', start));
  assert.match(body, /Core\.STAIR_MIN_WIDTH_M/);
  assert.match(body, /Core\.STAIR_MAX_WIDTH_M/);
});

test('Scene3DRenderer: buraco na laje usa Shape.holes dentro do loop de cômodo, clipado contra o bounding box do cômodo (Core.stairFootprintRectangle)', () => {
  const start = rendererSource.indexOf('(floorData.stairs || []).forEach(function (stair: any) {');
  assert.notEqual(start, -1, 'esperava o loop de furo de escada dentro da geração de laje');
  const body = rendererSource.slice(start, start + 900);
  assert.match(body, /Core\.stairFootprintRectangle\(stair, FLOOR_STACK_HEIGHT\)/);
  assert.match(body, /new THREE\.Path\(\)/);
  assert.match(body, /lajeShape\.holes\.push\(hole\)/);
});

test('Scene3DRenderer: buildStairReta gera um bloco sólido por degrau, ancorado em y=0 (mesma convenção do hit-mesh)', () => {
  const start = rendererSource.indexOf('function buildStairReta(stair: any) {');
  assert.notEqual(start, -1);
  const body = rendererSource.slice(start, rendererSource.indexOf('\n  }', start));
  assert.match(body, /Core\.stairStepPlan\(FLOOR_STACK_HEIGHT\)/);
  assert.match(body, /Core\.STAIR_TREAD_M \* \(i \+ 1\)/);
});

test('ViewportController: soltar a escada longe de apoio mostra AVISO no rodapé, sem travar/reverter a posição (Product Owner: aviso, sem travar)', () => {
  // Duas ocorrências (pointermove e pointerup) — a de interesse aqui é a
  // do pointerup, que contém o commit (updateStairBodyLive).
  const firstOccurrence = viewportSource.indexOf("if (dragMode === 'stairBody') {");
  assert.notEqual(firstOccurrence, -1);
  const start = viewportSource.indexOf("if (dragMode === 'stairBody') {", firstOccurrence + 1);
  assert.notEqual(start, -1, 'esperava uma segunda ocorrência (pointerup)');
  const body = viewportSource.slice(start, viewportSource.indexOf("if (dragMode === 'balconyRailingBody') {", start));
  assert.match(body, /Store\.commands\.updateStairBodyLive\(stId, finalStX, finalStY\);/);
  assert.match(body, /Core\.nearestSupportDistanceMeters\(/);
  assert.match(body, /supportDistM > Core\.STAIR_SUPPORT_HINT_TOLERANCE_M/);
  assert.match(body, /hintEl\.textContent = 'A base da escada está longe/);
  // Não deve existir nenhum "return" ou reversão de posição condicionada
  // ao aviso — o updateStairBodyLive já rodou incondicionalmente acima.
  assert.doesNotMatch(body, /supportDistM > Core\.STAIR_SUPPORT_HINT_TOLERANCE_M\)[^\n]*\{\s*\n[^\n]*(return|dragElementStart = null)/);
});

test('GizmoController: handleStairAction gira/exclui, mesmo padrão de handleVolumeBoxAction', () => {
  const start = gizmoSource.indexOf('function handleStairAction(stairId: string, action: string): void {');
  assert.notEqual(start, -1);
  const body = gizmoSource.slice(start, gizmoSource.indexOf('\n}', start));
  assert.match(body, /Store\.commands\.deleteStair\(stairId\)/);
  assert.match(body, /Store\.commands\.rotateStair\(stairId, action === 'rotateCw' \? 90 : -90\)/);
});

test('quantitativo: escada posicionada aparece em MaterialsPanel.ts (cobertura — floor.stairs)', () => {
  assert.match(materialsSource, /floor\.stairs/);
  assert.match(materialsSource, /stairPerUnit/);
});
