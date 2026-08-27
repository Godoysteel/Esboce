import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createVolumeBoxEntity, volumeBoxCornerLocalPositions, volumeBoxFaces, volumeBoxSurfaceAreaM2, volumeBoxVolumeM3 } from '../src/core/Core.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const gizmoSource = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');

// DEC-134 — Product Owner: "quero ter um bloco que eu possa arrastar e
// movimentar ela para todos os lados, será usado para fazer volumetria,
// ele deve poder ser pintado como as paredes, pode ser arrastado para
// qualquer distancia ou altura." Perguntado sobre o ímã de encosto em
// parede que existia antes, confirmou: "tirar o imã e fazer as alças em
// todas as direções, para que ele possa formar sacadas, marquises,
// volumetria, etc". VolumeBox deixou de ter máquina de estados
// preview/attached — sempre livre, com alças de arraste nas 6 direções
// e acabamento tipo parede.

test('createVolumeBoxEntity nasce solto, sempre livre (sem state), com o tamanho padrão de 1x1x0,3m e no piso (sillHeightM = 0)', () => {
  const box = createVolumeBoxEntity(100, 200);
  assert.equal(box.state, undefined);
  assert.equal(box.widthM, Core.VOLUME_BOX_DEFAULT_WIDTH_M);
  assert.equal(box.heightM, Core.VOLUME_BOX_DEFAULT_HEIGHT_M);
  assert.equal(box.depthM, Core.VOLUME_BOX_DEFAULT_DEPTH_M);
  assert.equal(box.sillHeightM, 0);
  assert.equal(box.x, 100);
  assert.equal(box.y, 200);
  assert.equal(box.rotationDeg, 0);
});

// Reforma da navegação (rail de categorias + painel, ver Registro de
// Decisões Técnicas) moveu Envidraçamento/Volumetria/Ornamentos/Brises
// pra dentro das categorias Aberturas/Paredes — não existe mais um
// botão-mestre "Fachada" com flyout próprio, mas os 4 itens continuam
// existindo (2 ativos, 2 travados), só noutro lugar da barra.
test('index.html: Envidraçamento/Volumetria continuam existindo (dentro de Aberturas/Paredes agora), Ornamentos/Brises continuam travados', () => {
  assert.match(html, /id="addGlazingPanelBtn"[^>]*data-room-preset="glazing"/);
  assert.match(html, /id="addVolumeBoxBtn"[^>]*data-room-preset="volumetria"/);
  assert.match(html, /data-disabled-label="Ornamentos"/);
  assert.match(html, /data-disabled-label="Brises"/);
});

test('index.html: gizmo do volume tem girar/excluir/fechar — sem mais os botões de passo fixo de largura/altura/subir/descer', () => {
  assert.match(html, /id="volumeBoxGizmo"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="rotateCcw"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="rotateCw"/);
  assert.match(html, /id="volumeBoxGizmo"[\s\S]*?data-action="delete"/);
  const gizmoBlock = html.slice(html.indexOf('id="volumeBoxGizmo"'), html.indexOf('</div>', html.indexOf('id="volumeBoxGizmo"')));
  assert.doesNotMatch(gizmoBlock, /data-action="heightUp"/);
  assert.doesNotMatch(gizmoBlock, /data-action="widthUp"/);
  assert.doesNotMatch(gizmoBlock, /data-action="up"/);
});

test('placeRoomPreset cria um Bloco de Volumetria solto pra key "volumetria"', () => {
  assert.match(viewportSource, /key === 'volumetria'/);
  assert.match(viewportSource, /Store\.commands\.createVolumeBox\(/);
});

test('sem ímã de parede nenhum: nearestWallForVolumeBoxAttach/attachVolumeBoxToWall não existem mais', () => {
  assert.doesNotMatch(viewportSource, /nearestWallForVolumeBoxAttach/);
  assert.doesNotMatch(viewportSource, /attachVolumeBoxToWall/);
  assert.doesNotMatch(viewportSource, /VOLUME_BOX_ATTACH_TOLERANCE_MODEL/);
});

// Cubo moldável (Product Owner: "tipo Blender", moldável puxando canto/
// aresta/face, topologia SEMPRE fixa — 8 cantos, 12 arestas, 6 faces,
// nunca vira forma em L nem ganha vértice novo). Duas tentativas com
// esferas pequenas flutuando perto da superfície (nudge 6cm, depois
// 18cm sem a camada de aresta) não resolveram — Product Owner reportou
// as duas vezes que as alças continuavam se misturando. Terceira
// tentativa, pedida explicitamente pelo Product Owner: em vez de
// marcador separado, a PRÓPRIA face (plano cobrindo a área real dela)
// e a PRÓPRIA aresta (cilindro ao longo do comprimento real dela)
// viram a área clicável — sem ponto pra "acertar". Canto continua
// esfera pequena (não tem área própria).
test('Scene3DRenderer: canto é esfera pequena, aresta é cilindro ao longo da aresta real, face é um plano cobrindo a face real — não mais pontos flutuando perto da superfície', () => {
  assert.match(rendererSource, /function buildVolumeBoxHitMesh/);
  assert.doesNotMatch(rendererSource, /function buildVolumeBoxPreviewMesh/);
  assert.doesNotMatch(rendererSource, /function buildVolumeBoxAttachedMesh/);
  assert.match(rendererSource, /floorData\.volumeBoxes/);
  // As antigas 6 alças por eixo (largura/profundidade/altura/elevação) não existem mais.
  assert.doesNotMatch(rendererSource, /'volumeBoxWidthLeft'/);
  assert.doesNotMatch(rendererSource, /'volumeBoxDepthFront'/);
  assert.doesNotMatch(rendererSource, /'volumeBoxHeightTop'/);
  const start = rendererSource.indexOf('if (viewState.selectedVolumeBox) {');
  assert.ok(start !== -1);
  const end = rendererSource.indexOf('\n    }', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /Core\.volumeBoxCornerLocalPositions\(vbSel\)/);
  assert.match(body, /Core\.volumeBoxFaces\(vbSel\)/);
  assert.match(body, /Core\.VOLUME_BOX_EDGES\.forEach/);
  assert.match(body, /'volumeBoxCorner:' \+ i/);
  assert.match(body, /'volumeBoxEdge:' \+ i/);
  assert.match(body, /'volumeBoxFace:' \+ i/);
  // Canto: esfera pequena.
  assert.match(body, /new THREE\.SphereGeometry\(0\.08, 12, 12\)/);
  // Aresta: cilindro entre os 2 cantos reais (não uma esfera no meio).
  assert.match(body, /new THREE\.CylinderGeometry\(0\.035, 0\.035, edgeLen, 8\)/);
  assert.match(body, /edgeHandle\.quaternion\.setFromUnitVectors/);
  // Face: plano com os 4 cantos reais da face (não uma esfera no centro).
  assert.match(body, /faceGeo\.setIndex\(\[0, 1, 2, 0, 2, 3\]\)/);
  assert.match(body, /face\.cornerIndices\.map/);
  assert.doesNotMatch(body, /SphereGeometry\(0\.14/, 'não deveria sobrar a esfera de face da tentativa anterior');
});

test('Scene3DRenderer.buildVolumeBoxMesh é exportada — ViewportController reconstrói a prévia de arraste chamando ela direto com cornerOffsets de trabalho', () => {
  assert.match(rendererSource, /export function buildVolumeBoxMesh\(box: any\) \{/);
  const start = rendererSource.indexOf('export const Scene3DRenderer = {');
  const end = rendererSource.indexOf('};', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /buildVolumeBoxMesh,/);
});

test('Scene3DRenderer: bloco pintável reaproveita a mesma regra de textura real vs. cor lisa da face de parede (categoria floor_tile x paint)', () => {
  const start = rendererSource.indexOf('function buildVolumeBoxMaterial(box: any) {');
  assert.ok(start !== -1);
  const end = rendererSource.indexOf('\n  }', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /product && product\.category === 'floor_tile' && product\.assets\.textures/);
  assert.match(body, /buildWallFaceMaterial\(product\)/);
  assert.match(body, /box\.finishProductId/);
});

test('Store: canto/aresta/face são arraste de verdade (Live), sem mais os comandos antigos de largura/profundidade/altura/elevação por eixo', () => {
  assert.match(storeSource, /updateVolumeBoxCornerLive\(volumeBoxId: string, cornerIndex: number, dxM: number, dyM: number, dzM: number\): void \{/);
  assert.match(storeSource, /updateVolumeBoxEdgeLive\(volumeBoxId: string, edgeIndex: number, dxM: number, dyM: number, dzM: number\): void \{/);
  assert.match(storeSource, /updateVolumeBoxFaceLive\(volumeBoxId: string, faceIndex: number, deltaAlongNormalM: number\): void \{/);
  assert.match(storeSource, /rotateVolumeBox\(volumeBoxId: string, stepDeg\?: number\): void \{/);
  assert.match(storeSource, /setVolumeBoxFinish\(volumeBoxId: string, productId: string\): void \{/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxSizeLive\(/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxDepthLive\(/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxVerticalLive\(/);
  assert.doesNotMatch(storeSource, /nudgeVolumeBoxHeight/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxWidth\(/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxHeight\(/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxDepth\(/);
});

test('Store: updateVolumeBoxCornerLive/EdgeLive/FaceLive dão snapshot de undo no commit (diferente dos 4 comandos antigos, que não davam) — moldar um canto é mudança estrutural maior que um resize uniforme', () => {
  ['updateVolumeBoxCornerLive', 'updateVolumeBoxEdgeLive', 'updateVolumeBoxFaceLive'].forEach((name) => {
    const start = storeSource.indexOf(name + '(');
    assert.ok(start !== -1, name + ' não encontrado');
    const end = storeSource.indexOf('\n  },', start);
    const body = storeSource.slice(start, end);
    assert.match(body, /pushUndoSnapshot\(\);/, name + ' deveria chamar pushUndoSnapshot()');
  });
});

test('Store: delta de canto/aresta ACRESCENTA ao offset já existente (nunca sobrescreve) e trava em ±VOLUME_BOX_MAX_SIZE_M', () => {
  const start = storeSource.indexOf('function addToVolumeBoxCornerOffset(');
  assert.ok(start !== -1);
  const end = storeSource.indexOf('\n}', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /c\.x = clamp\(c\.x \+ delta\.x\);/);
  assert.match(body, /Math\.max\(-Core\.VOLUME_BOX_MAX_SIZE_M, Math\.min\(Core\.VOLUME_BOX_MAX_SIZE_M, v\)\)/);
});

test('Store: delta em coordenadas de mundo passa pela rotação de 90° do box antes de virar deslocamento local (Y não gira)', () => {
  const start = storeSource.indexOf('function worldDeltaToVolumeBoxLocal(');
  assert.ok(start !== -1);
  const end = storeSource.indexOf('\n}', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /y: dyM/, 'Y passa direto, sem rotação');
  assert.match(body, /x: cos \* dxM \+ sin \* dzM/);
  assert.match(body, /z: -sin \* dxM \+ cos \* dzM/);
});

test('GizmoController liga o volumeBoxGizmo a girar (90°)/excluir/fechar — nada mais', () => {
  const start = gizmoSource.indexOf('function handleVolumeBoxAction(');
  const end = gizmoSource.indexOf('\n}', start);
  const body = gizmoSource.slice(start, end);
  assert.match(body, /Store\.commands\.rotateVolumeBox\(volumeBoxId, action === 'rotateCw' \? 90 : -90\);/);
  assert.match(body, /Store\.commands\.deleteVolumeBox\(volumeBoxId\)/);
  assert.doesNotMatch(body, /nudgeVolumeBoxHeight|resizeVolumeBoxWidth|resizeVolumeBoxHeight/);
});

test('ViewportController: produto carregado do catálogo aplica acabamento tipo parede num volume clicado', () => {
  const start = viewportSource.indexOf('if (canPaintSurface && paintHit && paintHit.object.userData.volumeBoxId && currentPaintProductId) {');
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n      }', start);
  const body = viewportSource.slice(start, end);
  assert.match(body, /Store\.commands\.setVolumeBoxFinish\(paintHit\.object\.userData\.volumeBoxId, currentPaintProductId\);/);
});

// Cubo moldável (alças de canto/aresta/face) — Product Owner pediu um
// bloco "tipo Blender", moldável puxando canto/aresta/face, sempre com
// topologia fixa (8 cantos, 12 arestas, 6 faces, nunca vira forma em
// L). VolumeBox.cornerOffsets (ausente = box reto) é o dado; estas
// funções em Core.ts são a matemática pura (área/volume/posição real
// dos cantos), sem nenhuma regra de orçamento aqui (ADR-006).

test('volumeBoxCornerLocalPositions: box reto (sem cornerOffsets) devolve os 8 cantos exatos do paralelepípedo widthM/heightM/depthM', () => {
  const box = createVolumeBoxEntity(0, 0, 0, 2, 4, 6);
  const corners = volumeBoxCornerLocalPositions(box);
  assert.equal(corners.length, 8);
  // Cada canto precisa estar em ±hw/±hh/±hd — nenhum offset aplicado.
  corners.forEach((c) => {
    assert.ok(Math.abs(Math.abs(c.x) - 1) < 1e-9);
    assert.ok(Math.abs(Math.abs(c.y) - 2) < 1e-9);
    assert.ok(Math.abs(Math.abs(c.z) - 3) < 1e-9);
  });
  // Os 8 sinais (±,±,±) precisam ser todos distintos (nenhum duplicado).
  const signature = new Set(corners.map((c) => Math.sign(c.x) + ',' + Math.sign(c.y) + ',' + Math.sign(c.z)));
  assert.equal(signature.size, 8);
});

test('volumeBoxSurfaceAreaM2/volumeBoxVolumeM3: box reto bate exatamente com a fórmula de caixa retangular (regressão obrigatória — MaterialsPanel trocou pra esta função)', () => {
  const box = createVolumeBoxEntity(0, 0, 0, 2, 3, 1);
  const w = 2, h = 3, d = 1;
  assert.equal(volumeBoxSurfaceAreaM2(box), 2 * (w * h + w * d + h * d));
  assert.equal(volumeBoxVolumeM3(box), w * h * d);
});

test('volumeBoxFaces: as 6 normais de um box reto apontam certinho pros 6 eixos (+X/-X/+Y/-Y/+Z/-Z), sem nenhuma duplicada nem invertida', () => {
  const box = createVolumeBoxEntity(0, 0, 0, 2, 2, 2);
  const faces = volumeBoxFaces(box);
  assert.equal(faces.length, 6);
  faces.forEach((f) => { assert.ok(Math.abs(f.areaM2 - 4) < 1e-9, 'cada face de um cubo 2x2x2 tem área 4'); });
  const normals = faces.map((f) => [Math.round(f.normal.x), Math.round(f.normal.y), Math.round(f.normal.z)].join(','));
  const expected = ['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1'];
  expected.forEach((axis) => assert.ok(normals.includes(axis), 'falta a normal ' + axis));
  assert.equal(new Set(normals).size, 6, 'nenhuma normal duplicada/invertida');
});

test('empurrar a FACE inteira (todos os 4 cantos com o mesmo deslocamento) preserva um box reto — mesma fórmula de caixa retangular, só que assimétrico', () => {
  // Box 2x2x2, empurra a face direita (+X, cantos 1,3,7,5) +1m em X —
  // vira um paralelepípedo reto 3x2x2 (só que descentrado), não mais um
  // cubo. Confirma que volumeBoxVolumeM3/SurfaceAreaM2 tratam esse caso
  // (o mais comum de todos — push-pull de face) exatamente como uma
  // caixa reta de outra proporção, sem nenhum artefato de winding.
  const box = createVolumeBoxEntity(0, 0, 0, 2, 2, 2);
  const push = { x: 1, y: 0, z: 0 };
  const zero = { x: 0, y: 0, z: 0 };
  box.cornerOffsets = [zero, push, zero, push, zero, push, zero, push];
  assert.equal(Math.round(volumeBoxVolumeM3(box) * 1e6) / 1e6, 3 * 2 * 2);
  assert.equal(Math.round(volumeBoxSurfaceAreaM2(box) * 1e6) / 1e6, 2 * (3 * 2 + 3 * 2 + 2 * 2));
});

test('colapsar uma ARESTA inteira (2 cantos) contra a aresta oposta vira uma cunha (prisma de seção triangular) — volume bate com a fórmula analítica w×h×d/2', () => {
  // Box 2x2x2: arrasta os 2 cantos de trás-de-cima (6,7) pra baixo até
  // encostar nos 2 cantos de trás-de-baixo (4,5) — a face de trás (4,5,7,6)
  // vira uma aresta só (degenera), sobrando uma cunha/rampa. Caso de
  // teste clássico de malha torta com fórmula analítica conhecida,
  // NÃO redutível a uma caixa reta — prova que o teorema da divergência
  // está implementado certo pra topologia realmente não-retangular.
  const box = createVolumeBoxEntity(0, 0, 0, 2, 2, 2);
  const zero = { x: 0, y: 0, z: 0 };
  const down = { x: 0, y: -2, z: 0 }; // heightM=2 → desce a altura inteira
  box.cornerOffsets = [zero, zero, zero, zero, zero, zero, down, down];
  const w = 2, h = 2, d = 2;
  assert.ok(Math.abs(volumeBoxVolumeM3(box) - (w * h * d) / 2) < 1e-9);
});
