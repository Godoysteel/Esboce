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

// DEC-179: clicar no botão "Cubo mágico" não cria mais na hora — abre
// uma lista perguntando o material primeiro (Product Owner: "quando
// clicar no botão para criar o cubo mágico já deve aparecer uma lista
// perguntando de que material ele é feito"). Escolher um material cria
// o bloco já marcado (Store.commands.setVolumeBoxMaterial); "Padrão"
// cria sem marcação nenhuma, igual sempre foi.
test('index.html: existe o painel de escolha de material do Cubo mágico', () => {
  assert.match(html, /id="volumeBoxMaterialPickerPanel"/);
});

test('clicar no botão "Cubo mágico" abre o seletor de material em vez de criar direto — placeRoomPreset só roda depois da escolha', () => {
  const start = viewportSource.indexOf("document.querySelectorAll('[data-room-preset]')");
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n    });', start);
  const body = viewportSource.slice(start, end);
  assert.match(body, /if \(btn\.dataset\.roomPreset === 'volumetria'\) \{ openVolumeBoxMaterialPicker\(\); return; \}/);
});

test('painel de material: escolher um item chama placeRoomPreset com o material; "Padrão" passa undefined (sem marcação)', () => {
  assert.match(viewportSource, /function openVolumeBoxMaterialPicker\(\)/);
  const start = viewportSource.indexOf('volumeBoxMaterialPickerPanelEl.addEventListener(\'click\'');
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n    });', start);
  const body = viewportSource.slice(start, end);
  assert.match(body, /closeVolumeBoxMaterialPicker\(\);/);
  assert.match(body, /placeRoomPreset\('volumetria', vbmBtn\.dataset\.volumeBoxMaterial \|\| undefined\);/);
});

test('sem ímã de parede nenhum: nearestWallForVolumeBoxAttach/attachVolumeBoxToWall não existem mais', () => {
  assert.doesNotMatch(viewportSource, /nearestWallForVolumeBoxAttach/);
  assert.doesNotMatch(viewportSource, /attachVolumeBoxToWall/);
  assert.doesNotMatch(viewportSource, /VOLUME_BOX_ATTACH_TOLERANCE_MODEL/);
});

// Cubo moldável — DEC-176: as alças de canto (esfera) e aresta
// (cilindro) da DEC-163/DEC-164 ficaram confusas em 3 rodadas de teste
// do Product Owner ("EM ABERTO — não tentar uma 4ª correção às
// cegas") e saíram de vez — só push-pull de face (plano cobrindo a
// área real dela) continua. Sem canto/aresta soltos, o bloco nunca
// mais fica torto sem querer.
test('Scene3DRenderer: só a alça de face existe (plano cobrindo a face real) — canto e aresta saíram (DEC-176)', () => {
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
  assert.match(body, /'volumeBoxFace:' \+ i/);
  // Canto e aresta saíram de vez (DEC-176) — sem esfera de canto nem cilindro de aresta.
  assert.doesNotMatch(body, /'volumeBoxCorner:' \+ i/);
  assert.doesNotMatch(body, /'volumeBoxEdge:' \+ i/);
  assert.doesNotMatch(body, /new THREE\.SphereGeometry\(0\.08, 12, 12\)/);
  assert.doesNotMatch(body, /new THREE\.CylinderGeometry\(0\.035, 0\.035, edgeLen, 8\)/);
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

test('Scene3DRenderer: bloco pintável reaproveita a mesma regra de textura real vs. cor lisa da face de parede (categoria floor_tile x paint), agora resolvida por FACE', () => {
  const start = rendererSource.indexOf('function buildVolumeBoxMaterial(box: any, faceIndex: number) {');
  assert.ok(start !== -1);
  const end = rendererSource.indexOf('\n  }', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /product && product\.category === 'floor_tile' && product\.assets\.textures/);
  assert.match(body, /buildWallFaceMaterial\(product\)/);
  assert.match(body, /var productId = volumeBoxFaceProductId\(box, faceIndex\);/);
});

test('Scene3DRenderer: volumeBoxFaceProductId — face com faceFinishProductId próprio vence, senão cai no finishProductId geral do bloco (retrocompat)', () => {
  const start = rendererSource.indexOf('function volumeBoxFaceProductId(box: any, faceIndex: number)');
  assert.ok(start !== -1);
  const end = rendererSource.indexOf('\n  }', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /box\.faceFinishProductId \? box\.faceFinishProductId\[faceIndex\] : undefined/);
  assert.match(body, /return faceOverride \|\| box\.finishProductId;/);
});

test('Store: só face é arraste de verdade (Live) — canto e aresta saíram (DEC-176), sem mais os comandos antigos de largura/profundidade/altura/elevação por eixo', () => {
  assert.match(storeSource, /updateVolumeBoxFaceLive\(volumeBoxId: string, faceIndex: number, deltaAlongNormalM: number\): void \{/);
  assert.match(storeSource, /rotateVolumeBox\(volumeBoxId: string, stepDeg\?: number\): void \{/);
  assert.match(storeSource, /setVolumeBoxFaceFinish\(volumeBoxId: string, faceIndex: number, productId: string\): void \{/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxCornerLive\(/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxEdgeLive\(/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxSizeLive\(/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxDepthLive\(/);
  assert.doesNotMatch(storeSource, /updateVolumeBoxVerticalLive\(/);
  assert.doesNotMatch(storeSource, /nudgeVolumeBoxHeight/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxWidth\(/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxHeight\(/);
  assert.doesNotMatch(storeSource, /resizeVolumeBoxDepth\(/);
});

test('Store: updateVolumeBoxFaceLive dá snapshot de undo no commit — moldar uma face é mudança estrutural maior que um resize uniforme', () => {
  const start = storeSource.indexOf('updateVolumeBoxFaceLive(');
  assert.ok(start !== -1, 'updateVolumeBoxFaceLive não encontrado');
  const end = storeSource.indexOf('\n  },', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /pushUndoSnapshot\(\);/, 'updateVolumeBoxFaceLive deveria chamar pushUndoSnapshot()');
});

test('Store: delta de canto/aresta ACRESCENTA ao offset já existente (nunca sobrescreve) e trava em ±VOLUME_BOX_MAX_SIZE_M', () => {
  const start = storeSource.indexOf('function addToVolumeBoxCornerOffset(');
  assert.ok(start !== -1);
  const end = storeSource.indexOf('\n}', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /c\.x = clamp\(c\.x \+ delta\.x\);/);
  assert.match(body, /Math\.max\(-Core\.VOLUME_BOX_MAX_SIZE_M, Math\.min\(Core\.VOLUME_BOX_MAX_SIZE_M, v\)\)/);
});

test('Store: worldDeltaToVolumeBoxLocal saiu — era usado só por canto/aresta (DEC-176), face-live não converte delta de mundo (usa a normal local direto)', () => {
  assert.doesNotMatch(storeSource, /function worldDeltaToVolumeBoxLocal\(/);
});

test('GizmoController liga o volumeBoxGizmo a girar (90°)/excluir/fechar — nada mais', () => {
  const start = gizmoSource.indexOf('function handleVolumeBoxAction(');
  const end = gizmoSource.indexOf('\n}', start);
  const body = gizmoSource.slice(start, end);
  assert.match(body, /Store\.commands\.rotateVolumeBox\(volumeBoxId, action === 'rotateCw' \? 90 : -90\);/);
  assert.match(body, /Store\.commands\.deleteVolumeBox\(volumeBoxId\)/);
  assert.doesNotMatch(body, /nudgeVolumeBoxHeight|resizeVolumeBoxWidth|resizeVolumeBoxHeight/);
});

test('ViewportController: produto carregado do catálogo aplica acabamento tipo parede só na FACE do volume clicada (faceIndex do raycast/2)', () => {
  const start = viewportSource.indexOf("if (canPaintSurface && paintHit && paintHit.object.userData.volumeBoxId && currentPaintProductId && typeof paintHit.faceIndex === 'number') {");
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n      }', start);
  const body = viewportSource.slice(start, end);
  assert.match(body, /var vbClickedFaceIndex = Math\.floor\(paintHit\.faceIndex \/ 2\);/);
  assert.match(body, /Store\.commands\.setVolumeBoxFaceFinish\(paintHit\.object\.userData\.volumeBoxId, vbClickedFaceIndex, currentPaintProductId\);/);
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

// DEC-181: material "metalão" (Product Owner, DEC-180: "estrutura para
// o ACM seria perfis de alumínio ou metalon") vira esqueleto procedural
// nas 12 arestas em vez de bloco sólido colorido — escopo desta rodada
// é só o esqueleto genérico; reforço específico por elementType (ex.:
// escora de marquise em balanço) fica pra uma rodada futura, depois de
// mapear mais casos reais (decisão explícita do Product Owner).
test('buildVolumeBoxMesh: bloco com structuralMaterial "metalao" vira esqueleto de 12 perfis metálicos, não o bloco sólido de sempre', () => {
  assert.match(rendererSource, /function buildVolumeBoxMetalaoFrame\(box: any\)/);
  assert.match(rendererSource, /if \(box\.structuralMaterial === 'metalao'\) return buildVolumeBoxMetalaoFrame\(box\);/);
  const start = rendererSource.indexOf('function buildVolumeBoxMetalaoFrame(box: any) {');
  const end = rendererSource.indexOf('\n  }', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /Core\.volumeBoxCornerLocalPositions\(box\)/);
  assert.match(body, /metalness: 0\.85/, 'perfil precisa ler como metal de verdade, não a cor lisa genérica');
  assert.match(body, /new THREE\.BoxGeometry\(VOLUME_BOX_METALAO_PROFILE_M, len, VOLUME_BOX_METALAO_PROFILE_M\)/);
  assert.match(body, /profileMesh\.quaternion\.setFromUnitVectors/);
});

// Product Owner: "a estrutura do metalão deve ir se repetindo os
// perfís verticais a cada 1200 mm quando extrudado" — sem isso, um
// bloco largo (parede/marquise esticada) ficava só com os 2 perfis de
// canto, longe demais um do outro pra sustentar fachada de verdade.
test('buildVolumeBoxMetalaoFrame: perfil vertical intermediário se repete a cada 1200mm (no máximo) quando o bloco é esticado na largura', () => {
  const start = rendererSource.indexOf('function buildVolumeBoxMetalaoFrame(box: any) {');
  const end = rendererSource.indexOf('\n  }', start);
  const body = rendererSource.slice(start, end);
  assert.match(rendererSource, /var VOLUME_BOX_METALAO_STUD_SPACING_M = 1\.2;/);
  assert.match(body, /var localWidthM = Math\.abs\(corners\[1\]!\.x - corners\[0\]!\.x\);/);
  assert.match(body, /var divisions = Math\.max\(1, Math\.ceil\(localWidthM \/ VOLUME_BOX_METALAO_STUD_SPACING_M\)\);/);
  // Cada divisão intermediária adiciona um perfil na frente E outro no
  // fundo (mesmo par que os cantos já têm), interpolando entre os
  // cantos reais (respeita cornerOffsets de um bloco já moldado).
  assert.match(body, /addProfile\(lerpVec3\(corners\[0\]!, corners\[1\]!, t\), lerpVec3\(corners\[2\]!, corners\[3\]!, t\)\);/);
  assert.match(body, /addProfile\(lerpVec3\(corners\[4\]!, corners\[5\]!, t\), lerpVec3\(corners\[6\]!, corners\[7\]!, t\)\);/);
});

// Movimento livre do Cubo mágico (Product Owner: "deve ser possível
// movimentar o cubo mágico para todos os ângulos") — antes, arrastar o
// corpo só movia no plano do chão (X/Y); não dava pra subir/descer o
// bloco (ex.: marquise na altura de uma verga). Shift+arraste vertical
// agora ajusta sillHeightM, mesmo gesto de tecla-modificadora usado
// pra precisão em outras ferramentas do app.
test('Store.commands.updateVolumeBoxBodyLive aceita sillHeightM opcional — grava só quando informado (retrocompat do arraste horizontal, que não muda altura)', () => {
  const start = storeSource.indexOf('updateVolumeBoxBodyLive(volumeBoxId: string, x: number, y: number, sillHeightM?: number): void {');
  assert.ok(start !== -1);
  const end = storeSource.indexOf('\n  },', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /if \(sillHeightM != null\) b\.sillHeightM = sillHeightM;/);
});

test('ViewportController: Shift+arraste no corpo do Cubo mágico vira gesto vertical (sillHeightM), sem Shift continua livre no plano do chão', () => {
  const start = viewportSource.indexOf("if (dragMode === 'volumeBoxBody') {");
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n    if (dragMode', start + 10);
  const body = viewportSource.slice(start, end);
  assert.match(body, /if \(e\.shiftKey\) \{/);
  assert.match(body, /var deltaSillVb = \(dragElementStart\.startScreenY - e\.clientY\) \* 0\.02;/);
  assert.match(body, /dragElementStart\.liveSillHeightM = Math\.max\(0, Math\.min\(10, dragElementStart\.sillHeightM \+ deltaSillVb\)\);/);
});

// Snap de posição (Product Owner: "um snap nas paredes", confirmado
// depois: "Só posição" — nunca gira o bloco pra encaixar).
test('snapVolumeBoxToWalls: existe, só encosta em parede alinhada ao mundo (nunca gira o bloco), e resolve largura/profundidade pelos passos de 90° do rotationDeg', () => {
  const start = viewportSource.indexOf('function snapVolumeBoxToWalls(box: any, xGrid: number, yGrid: number)');
  assert.ok(start !== -1);
  const end = viewportSource.indexOf('\n  }', start);
  const body = viewportSource.slice(start, end);
  assert.match(body, /var rotSteps = Math\.round\(\(box\.rotationDeg \|\| 0\) \/ 90\);/);
  assert.match(body, /var horizontal = Math\.abs\(w\.y2 - w\.y1\) < Core\.GRID \* 0\.05;/);
  assert.match(body, /var vertical = Math\.abs\(w\.x2 - w\.x1\) < Core\.GRID \* 0\.05;/);
  // nunca escreve em box.rotationDeg — só ajusta x/y
  assert.doesNotMatch(body, /rotationDeg\s*=/);
});

test('ViewportController: soltar o arraste horizontal do Cubo mágico passa pelo snap de parede antes de commitar no Store', () => {
  const start = viewportSource.indexOf('dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;\n      volumeBoxDragMesh = null;');
  const before = viewportSource.slice(Math.max(0, start - 900), start);
  assert.match(before, /var vbSnapped = snapVolumeBoxToWalls\(vbEntUp, dragElementStart\.x \+ dxVbUp, dragElementStart\.y \+ dyVbUp\);/);
  assert.match(before, /Store\.commands\.updateVolumeBoxBodyLive\(vbId, vbSnapped\.x, vbSnapped\.y, dragElementStart\.liveSillHeightM\);/);
});
