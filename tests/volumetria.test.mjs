import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createVolumeBoxEntity } from '../src/core/Core.ts';

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

test('Scene3DRenderer tem um único builder pro volume (sempre livre) e as 6 alças de arraste', () => {
  assert.match(rendererSource, /function buildVolumeBoxHitMesh/);
  assert.doesNotMatch(rendererSource, /function buildVolumeBoxPreviewMesh/);
  assert.doesNotMatch(rendererSource, /function buildVolumeBoxAttachedMesh/);
  assert.match(rendererSource, /floorData\.volumeBoxes/);
  const start = rendererSource.indexOf('if (viewState.selectedVolumeBox) {');
  assert.ok(start !== -1);
  const end = rendererSource.indexOf('\n    }', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /'volumeBoxWidthLeft'/);
  assert.match(body, /'volumeBoxWidthRight'/);
  assert.match(body, /'volumeBoxDepthFront'/);
  assert.match(body, /'volumeBoxDepthBack'/);
  assert.match(body, /volumeBoxHeightTop'; vbTopHandle\.renderOrder/);
  assert.match(body, /volumeBoxHeightBottom'; vbBottomHandle\.renderOrder/);
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

test('Store: comandos de largura/profundidade/altura/elevação são arraste de verdade (Live), com os limites certos, sem mais os de passo fixo', () => {
  assert.match(storeSource, /updateVolumeBoxSizeLive\(volumeBoxId: string, widthM: number, centerDeltaM = 0\): void \{/);
  assert.match(storeSource, /updateVolumeBoxDepthLive\(volumeBoxId: string, depthM: number, centerDeltaM = 0\): void \{/);
  assert.match(storeSource, /updateVolumeBoxVerticalLive\(volumeBoxId: string, heightM: number, sillHeightM: number\): void \{/);
  assert.match(storeSource, /rotateVolumeBox\(volumeBoxId: string, stepDeg\?: number\): void \{/);
  assert.match(storeSource, /setVolumeBoxFinish\(volumeBoxId: string, productId: string\): void \{/);
  assert.doesNotMatch(storeSource, /nudgeVolumeBoxHeight/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxWidth\(/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxHeight\(/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxDepth\(/);
});

test('Store.updateVolumeBoxVerticalLive trava heightM/sillHeightM nos limites certos (mesmo padrão de updateBalconyRailingVerticalLive)', () => {
  const start = storeSource.indexOf('updateVolumeBoxVerticalLive(volumeBoxId: string, heightM: number, sillHeightM: number): void {');
  const end = storeSource.indexOf('\n  },', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /b\.heightM = Math\.max\(Core\.VOLUME_BOX_MIN_HEIGHT_M, Math\.min\(Core\.VOLUME_BOX_MAX_HEIGHT_M, heightM\)\);/);
  assert.match(body, /b\.sillHeightM = Math\.max\(0, Math\.min\(Core\.VOLUME_BOX_MAX_SILL_HEIGHT_M, sillHeightM\)\);/);
});

test('GizmoController liga o volumeBoxGizmo a girar (90°)/excluir/fechar — nada mais', () => {
  const start = gizmoSource.indexOf('function handleVolumeBoxAction(');
  const end = gizmoSource.indexOf('\n}', start);
  const body = gizmoSource.slice(start, end);
  assert.match(body, /Store\.commands\.rotateVolumeBox\(volumeBoxId, action === 'rotateCw' \? 90 : -90\);/);
  assert.match(body, /Store\.commands\.deleteVolumeBox\(volumeBoxId\)/);
  assert.doesNotMatch(body, /nudgeVolumeBoxHeight|resizeVolumeBoxWidth|resizeVolumeBoxHeight/);
});

test('ViewportController: ferramenta Lata de tinta aplica acabamento tipo parede num volume clicado (Product Owner: "pintado como as paredes")', () => {
  const start = viewportSource.indexOf("if (currentPaintSurface === 'walls' && paintHit && paintHit.object.userData.volumeBoxId && currentPaintProductId) {");
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n      }', start);
  const body = viewportSource.slice(start, end);
  assert.match(body, /Store\.commands\.setVolumeBoxFinish\(paintHit\.object\.userData\.volumeBoxId, currentPaintProductId\);/);
});
