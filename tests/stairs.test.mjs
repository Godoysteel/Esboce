import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createStairEntity, stairFootprintRectangle, nearestSupportDistanceMeters, createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION } from '../src/core/ProjectPersistence.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const gizmoSource = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

// Product Owner: "como devemos implantar as escadas agora..." (DEC-139,
// primeira rodada só reta/procedural). Depois entregou 3 modelos .glb
// modelados no Blender (reta/L/U) e pediu: corte na laje exatamente no
// limite do último degrau (não mais uma fórmula solta) e pisada em
// granito (mesma pedra da soleira externa) — ver DEC-140. A geometria
// deixou de ser procedural (Blondel) e passou a vir do bounding box real
// do .glb carregado, escalado pra bater com o pé-direito do pavimento.

test('createStairEntity nasce solta, modelo reto por padrão, largura padrão, rotação 0', () => {
  const stair = createStairEntity(100, 200);
  assert.equal(stair.model, 'reta');
  assert.equal(stair.widthM, Core.STAIR_DEFAULT_WIDTH_M);
  assert.equal(stair.x, 100);
  assert.equal(stair.y, 200);
  assert.equal(stair.rotationDeg, 0);
});

test('createStairEntity aceita model L/U explícito', () => {
  const stairL = createStairEntity(0, 0, 0, 1.0, 'L');
  assert.equal(stairL.model, 'L');
  const stairU = createStairEntity(0, 0, 0, 1.0, 'U');
  assert.equal(stairU.model, 'U');
});

test('stairFootprintRectangle: retângulo axis-aligned, largura×depthM em rotação 0, depthM×largura em rotação 90 (só troca de eixo, sem matemática de ângulo livre) — depthM vem de fora (bounding box real do .glb), a função fica pura', () => {
  const depthM = 4.7; // corrida real hipotética, como viria de getStairFootprintMeters
  const stair0 = createStairEntity(0, 0, 0, 1.0);
  const rect0 = stairFootprintRectangle(stair0, depthM);
  assert.ok(Math.abs((rect0.x2 - rect0.x1) / Core.GRID - 1.0) < 1e-6, 'largura no eixo X quando rotationDeg=0');
  assert.ok(Math.abs((rect0.y2 - rect0.y1) / Core.GRID - depthM) < 1e-6, 'depthM no eixo Y quando rotationDeg=0');

  const stair90 = createStairEntity(0, 0, 90, 1.0);
  const rect90 = stairFootprintRectangle(stair90, depthM);
  assert.ok(Math.abs((rect90.x2 - rect90.x1) / Core.GRID - depthM) < 1e-6, 'depthM no eixo X quando rotationDeg=90 (trocou de eixo)');
  assert.ok(Math.abs((rect90.y2 - rect90.y1) / Core.GRID - 1.0) < 1e-6, 'largura no eixo Y quando rotationDeg=90');
});

test('nearestSupportDistanceMeters: perto de parede dá distância pequena, perto de coluna também, longe de tudo dá distância grande', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 200, y2: 0 };
  const column = { id: 'c', x: 400, y: 400, shape: 'quadrada' };
  const nearWall = nearestSupportDistanceMeters(50, 10, [wall], []);
  assert.ok(nearWall < 1, 'ponto perto da parede deve dar distância pequena (metros)');
  const nearColumn = nearestSupportDistanceMeters(401, 400, [], [column]);
  assert.ok(nearColumn < 0.2, 'ponto quase em cima da coluna deve dar distância pequena (descontado o raio efetivo)');
  const farFromAll = nearestSupportDistanceMeters(2000, 2000, [wall], [column]);
  assert.ok(farFromAll > 10, 'ponto longe de parede e coluna deve dar distância grande');
});

test('round-trip de persistência: Stair (reta/L/U) sobrevive a encode/decode com os mesmos campos', () => {
  const project = createProject();
  const stairReta = createStairEntity(50, 60, 90, 1.2, 'reta');
  const stairL = createStairEntity(80, 60, 0, 1.0, 'L');
  project.floors[0].stairs.push(stairReta, stairL);
  const doc = encodeProjectDocument(project);
  assert.equal(doc.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  const decoded = decodeProjectDocument(doc);
  const [roundTrippedReta, roundTrippedL] = decoded.project.floors[0].stairs;
  assert.equal(roundTrippedReta.id, stairReta.id);
  assert.equal(roundTrippedReta.x, 50);
  assert.equal(roundTrippedReta.y, 60);
  assert.equal(roundTrippedReta.rotationDeg, 90);
  assert.equal(roundTrippedReta.model, 'reta');
  assert.equal(roundTrippedReta.widthM, 1.2);
  assert.equal(roundTrippedL.model, 'L');
});

test('projeto salvo antes da v15 (sem stairs) migra normalmente, com lista vazia', () => {
  const project = createProject();
  const legacyDoc = { schemaVersion: 14, project: JSON.parse(JSON.stringify(project)) };
  delete legacyDoc.project.floors[0].stairs;
  const decoded = decodeProjectDocument(legacyDoc);
  assert.deepEqual(decoded.project.floors[0].stairs, []);
});

test('index.html: botão "Escada" (data-room-preset), gizmo próprio (#stairGizmo) e painel de formato (#stairTypePanel com reta/L/U) existem', () => {
  assert.match(html, /data-room-preset="escada"/);
  assert.match(html, /id="stairGizmo"/);
  assert.match(html, /id="stairTypePanel"/);
  assert.match(html, /data-stairmodel="reta"/);
  assert.match(html, /data-stairmodel="L"/);
  assert.match(html, /data-stairmodel="U"/);
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

test('Store: setStairModel troca o modelo (reta/L/U) de uma escada já colocada', () => {
  const start = storeSource.indexOf('setStairModel(stairId: string, model: StairModel)');
  assert.notEqual(start, -1);
  const body = storeSource.slice(start, storeSource.indexOf('\n  },', start));
  assert.match(body, /s\.model = model;/);
});

test('Scene3DRenderer: 3 modelos .glb mapeados (reta/L/U), um por StairModel', () => {
  const start = rendererSource.indexOf('var STAIR_MODEL_URLS');
  assert.notEqual(start, -1);
  const body = rendererSource.slice(start, rendererSource.indexOf('};', start));
  assert.match(body, /reta: 'models\/escada-reta\.glb'/);
  assert.match(body, /L: 'models\/escada-l\.glb'/);
  assert.match(body, /U: 'models\/escada-u\.glb'/);
});

test('Scene3DRenderer: pisada da escada usa a mesma textura de granito/mármore da soleira externa (getSoleiraMarbleMaps), cacheada e compartilhada', () => {
  const start = rendererSource.indexOf('function getStairTreadMaterial()');
  assert.notEqual(start, -1);
  const body = rendererSource.slice(start, rendererSource.indexOf('\n  }', start));
  assert.match(body, /getSoleiraMarbleMaps\(\)/);
});

test('Scene3DRenderer: getStairModel identifica a primitiva do corpo pelo nome do material ("Material"), não pela ordem — a ordem difere entre os 3 arquivos .glb', () => {
  const start = rendererSource.indexOf('function getStairModel(url: string)');
  assert.notEqual(start, -1);
  const body = rendererSource.slice(start, rendererSource.indexOf('\n  }\n', start));
  assert.match(body, /child\.material\.name !== 'Material'/);
  assert.match(body, /child\.material = treadMat;/);
});

test('Scene3DRenderer: buildStairHitMesh escala a malha carregada — altura/corrida travadas no pé-direito (FLOOR_STACK_HEIGHT/naturalH), largura independente (stair.widthM/naturalW) — e devolve null enquanto o .glb não carregou', () => {
  const start = rendererSource.indexOf('function buildStairHitMesh(stair: any');
  assert.notEqual(start, -1);
  const body = rendererSource.slice(start, rendererSource.indexOf('\n  }', start));
  assert.match(body, /if \(!entry\) return null;/);
  assert.match(body, /var heightScale = FLOOR_STACK_HEIGHT \/ entry\.naturalH;/);
  assert.match(body, /var widthScale = stair\.widthM \/ entry\.naturalW;/);
  assert.match(body, /instance\.scale\.set\(widthScale, heightScale, heightScale\);/);
});

test('Scene3DRenderer: getStairFootprintMeters devolve a pegada real (metros) do modelo carregado, null enquanto não carregou', () => {
  const start = rendererSource.indexOf('export function getStairFootprintMeters(stair: any)');
  assert.notEqual(start, -1);
  const body = rendererSource.slice(start, rendererSource.indexOf('\n  }', start));
  assert.match(body, /if \(!entry\) return null;/);
  assert.match(body, /depthM: entry\.naturalD \* heightScale/);
});

test('Scene3DRenderer: buraco na laje usa Shape.holes dentro do loop de cômodo, clipado contra o bounding box do cômodo, com a corrida real do modelo carregado (Core.stairFootprintRectangle + getStairFootprintMeters, não mais uma fórmula solta)', () => {
  const start = rendererSource.indexOf('(floorData.stairs || []).forEach(function (stair: any) {');
  assert.notEqual(start, -1, 'esperava o loop de furo de escada dentro da geração de laje');
  const body = rendererSource.slice(start, start + 1100);
  assert.match(body, /var stFootprint = getStairFootprintMeters\(stair\);/);
  assert.match(body, /if \(!stFootprint\) return;/);
  assert.match(body, /Core\.stairFootprintRectangle\(stair, stFootprint\.depthM\)/);
  assert.match(body, /new THREE\.Path\(\)/);
  assert.match(body, /lajeShape\.holes\.push\(hole\)/);
});

test('ViewportController: soltar a escada longe de apoio mostra AVISO no rodapé, sem travar/reverter a posição (Product Owner: aviso, sem travar) — usa a corrida real do modelo carregado', () => {
  // Duas ocorrências (pointermove e pointerup) — a de interesse aqui é a
  // do pointerup, que contém o commit (updateStairBodyLive).
  const firstOccurrence = viewportSource.indexOf("if (dragMode === 'stairBody') {");
  assert.notEqual(firstOccurrence, -1);
  const start = viewportSource.indexOf("if (dragMode === 'stairBody') {", firstOccurrence + 1);
  assert.notEqual(start, -1, 'esperava uma segunda ocorrência (pointerup)');
  const body = viewportSource.slice(start, viewportSource.indexOf("if (dragMode === 'balconyRailingBody') {", start));
  assert.match(body, /Store\.commands\.updateStairBodyLive\(stId, finalStX, finalStY\);/);
  assert.match(body, /Scene3DRenderer\.getStairFootprintMeters\(stEntUp\)/);
  assert.match(body, /Core\.nearestSupportDistanceMeters\(/);
  assert.match(body, /supportDistM > Core\.STAIR_SUPPORT_HINT_TOLERANCE_M/);
  assert.match(body, /hintEl\.textContent = 'A base da escada está longe/);
  // Não deve existir nenhum "return" ou reversão de posição condicionada
  // ao aviso — o updateStairBodyLive já rodou incondicionalmente acima.
  assert.doesNotMatch(body, /supportDistM > Core\.STAIR_SUPPORT_HINT_TOLERANCE_M\)[^\n]*\{\s*\n[^\n]*(return|dragElementStart = null)/);
});

test('ViewportController: painel de formato (#stairTypePanel) chama Store.commands.setStairModel com o dataset.stairmodel do botão clicado', () => {
  const start = viewportSource.indexOf("stairTypePanelEl?.addEventListener('click'");
  assert.notEqual(start, -1);
  const body = viewportSource.slice(start, viewportSource.indexOf('});', start));
  assert.match(body, /Store\.commands\.setStairModel\(selectedStairId, stBtn\.dataset\.stairmodel\)/);
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
