// ViewportController — dono do canvas único, da câmera e de TODA a
// interação por ponteiro. Traduz gestos em Comandos; nunca escreve no
// modelo diretamente. Migrado de `var ViewportController =
// (function(){...})()` no index.html monolítico original (ver
// legacy/index-monolito-original.html, linhas 3826-5908).
//
// NOTA DE ENGENHARIA (mesma de Scene3DRenderer.ts): módulo denso em
// estado de interação/DOM (arrastar, clicar, gizmos, painéis
// flutuantes). Tipagem pragmática (`any`) nas variáveis de estado de
// UI e refs de elemento DOM — o valor de tipar author-time cada
// combinação de estado de arraste é baixo comparado a manter as
// APIs de FRONTEIRA tipadas (Store, Core, Scene3DRenderer — essas
// estão fortemente tipadas e é ali que os bugs de domínio importam).

import * as THREE from 'three';
import { Core } from './Core.js';
import { Catalog } from './Catalog.js';
import { Store } from './Store.js';
import { Scene3DRenderer, DEBUG_COLOR_MODE } from './Scene3DRenderer.js';
import { NavGizmo } from './NavGizmo.js';


  var container: any, camera: any, scene: any, renderer: any;
  var raycaster = new THREE.Raycaster();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // offsetX/offsetY existiam como uma "âncora" fixa de 190 unidades,
  // resquício de uma versão 2D anterior desenhada num canvas 380x380
  // (coordenadas de canvas não podem ser negativas). Na cena 3D atual
  // isso não faz sentido nenhum — coordenada negativa é normal — e
  // como CONVERSÃO ABSOLUTA (clique na tela -> onde colocar algo novo,
  // ver getGroundModelPoint) só funciona se bater exatamente com onde
  // as paredes são armazenadas (sempre centradas em 0,0 pro primeiro
  // cômodo — ver computeNextRoomSlot), aquela âncora de 190 tornava
  // TELHADO e PAREDE/CÔMODO LIVRE (os únicos fluxos que precisam de
  // posição absoluta, não só de um delta de arraste) errados — a
  // posição saía a ~9,5 m do lugar certo. Arrastar nunca quebrava
  // porque usa a DIFERENÇA entre dois cliques, e a constante se
  // cancelava numa subtração — só por isso esse bug ficou escondido
  // até agora.
  var offsetX = 0, offsetY = 0;
  var scale = 1 / Core.GRID;

  var currentTool: any = null; // null (nenhuma) | 'room' | 'wall' | 'columnQuadrada' | 'columnRedonda' | 'telhado' | 'door' | 'window' | 'demolish' | 'paintBucket' — cômodos com nome nascem instantâneos pelos botões visuais (ver placeRoomPreset); clique no chão vazio só desenha se uma ferramenta acima foi escolhida explicitamente
  // Cor "carregada" na lata de tinta — escolhida na paleta fixa que
  // aparece enquanto a ferramenta paintBucket está ativa (ver
  // paintPickerPanelEl). Começa na primeira tinta do catálogo pra já
  // ter algo selecionado no primeiro clique.
  var currentPaintProductId = Catalog.getProductsByCategory('paint')[0] ? Catalog.getProductsByCategory('paint')[0]!.id : null;
  var selectedWallId: any = null, selectedColumnId: any = null, selectedRoofId: any = null, selectedOpeningId: any = null, selectedVarandaId: any = null;
  var selectedRoomWallIds: any = null; // paredes do "módulo" (cômodo) agarrado com um clique único
  var resizeWallId: any = null; // parede em modo de redimensionar (duplo clique), empurra perpendicular
  var lastWallClickTime = 0, lastWallClickId: any = null;
  var DBLCLICK_MS = 350;
  var gizmoMenuOpen = false;
  var highlightedCategory: any = null; // categoria "de outro andar" ou sem seleção individual (fundação, laje...)

  var downButton: any = null, downPos: any = null;
  var dragMode: any = null; // 'orbit' | 'endpoint1' | 'endpoint2' | 'wallBody' | 'columnBody' | 'roofRidge' | 'openingSlide'
  var placingDraw = false; // true entre o 1º e o 2º clique de Cômodo/Parede
  var drawStart: any = null, drawPreview: any = null;
  var dragElementStart: any = null, dragGroundStart: any = null;
  var pendingRoofType = 'duasAguas'; // tipo do próximo telhado a ser colocado
  var ROOF_DEFAULT_SIZE = 3 * Core.GRID; // 3m — tamanho inicial ao clicar pra colocar
  var VARANDA_DEFAULT_W_M = 3, VARANDA_DEFAULT_D_M = 2; // 3m x 2m — mesma escala de um cômodo comum
  // Snap assistido entre telhados vizinhos (Opção B — ver Registro de
  // Decisões Técnicas, Sessão 4): a inclinação "gruda" na que faria a
  // cumeeira bater com a de um vizinho do MESMO tipo, quando a pessoa já
  // está perto disso no arraste. Não gera vale de verdade — só alinha a
  // altura, feedback visual.
  var ROOF_PITCH_SNAP_DEG = 3.5;
  var ROOF_NEARBY_TOLERANCE = Core.SNAP_UNIT * 2; // ~1m de folga pra contar como "encostado"

  var camAngle = Math.PI / 4, camElev = 0.6, camDist = 13;
  var camTarget = { x: 0, y: 0, z: 0 }; // pra onde a câmera olha e orbita — Shift+scroll desloca isso
  var MIN_DIST = 3, MAX_DIST = 35;

  var gizmoEl: any, openingGizmoEl: any, roomGizmoEl: any, columnShapePanelEl: any, roofTypePanelEl: any, finishPanelEl: any, paintPickerPanelEl: any, objectPanelEl: any, objectPanelTitleEl: any, objectPanelBodyEl: any, hintEl: any, layersContextMenuEl: any;
  var dimLabelAEl: any, dimLabelBEl: any;
  // Cotas persistentes de largura/altura de parede (ligar/desligar) —
  // ver rebuildDimensionCotas mais abaixo. Diferente do dimLabelA/B
  // (que só aparece durante o arraste de criação), essas ficam na tela
  // o tempo todo enquanto ativas, então vivem numa camada própria
  // (dimCotaLayerEl) em vez de dois elementos fixos.
  var dimensionsVisible = false;
  var dimCotaLayerEl: any;
  var dimCotaEntries: any[] = [];

  var CATEGORY_LABELS: Record<string, string> = {
    fundacao: 'Fundação', calcada: 'Calçada', paredesTerreo: 'Paredes — térreo',
    colunas: 'Colunas', laje: 'Laje', paredesSuperiores: 'Paredes — superiores',
    marquise: 'Marquise', telhado: 'Telhado', aberturas: 'Portas e janelas', varanda: 'Varanda'
  };
  var TOOL_HINTS: Record<string, string> = {
    room: 'Clique pra marcar o início do cômodo. Mova o mouse e clique de novo pra confirmar o tamanho. Esc cancela. Clique direito + arraste pra girar a câmera.',
    wall: 'Clique pra começar a parede, clique de novo pra terminar. Termine em cima de outra pra formar uma divisória. Segure Shift pra começar em cima de uma parede existente.',
    columnQuadrada: 'Clique no chão pra posicionar uma coluna quadrada.',
    columnRedonda: 'Clique no chão pra posicionar uma coluna redonda.',
    telhado: 'Passe o mouse sobre um cômodo fechado pra ver a prévia, clique pra colocar. Selecione um telhado colocado e arraste a alça da cumeeira pra ajustar a inclinação.',
    door: 'Clique sobre uma parede pra inserir uma porta ali. Selecione uma porta colocada pra deslizar ou excluir.',
    window: 'Clique sobre uma parede pra inserir uma janela ali. Selecione uma janela colocada pra deslizar ou excluir.',
    varanda: 'Clique no chão pra colocar uma varanda. Selecione uma já colocada, clique direito nela pra girar qual lado é a frente ou excluir.',
    demolish: 'Clique numa parede pra quebrar ela. Os cantos vizinhos se fecham sozinhos, sem deixar vão.',
    paintBucket: 'Escolha uma cor na paleta acima e clique num lado da parede pra pintar só aquele lado.'
  };

  function modelToWorld(mx: any, my: any) { return { x: (mx - offsetX) * scale, z: (my - offsetY) * scale }; }
  function worldToModel(wx: any, wz: any) { return { x: wx / scale + offsetX, y: wz / scale + offsetY }; }

  function updateCam() {
    camera.position.set(
      camTarget.x + camDist * Math.cos(camAngle) * Math.cos(camElev),
      camTarget.y + camDist * Math.sin(camElev),
      camTarget.z + camDist * Math.sin(camAngle) * Math.cos(camElev)
    );
    camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
    NavGizmo.update(camAngle, camElev);
  }

  function currentFloorYOffset() {
    var idx = Store.getProject().currentFloorIndex;
    return idx * Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER();
  }

  // Raycast contra o plano do pavimento sendo editado -> ponto no modelo
  function getGroundModelPoint(clientX: any, clientY: any) {
    var rect = container.getBoundingClientRect();
    var mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    groundPlane.constant = -currentFloorYOffset();
    var pt = new THREE.Vector3();
    var hit = raycaster.ray.intersectPlane(groundPlane, pt);
    if (!hit) return null;
    return worldToModel(pt.x, pt.z);
  }

  // Raycast contra as malhas marcadas por categoria -> a mais próxima
  function pickMesh(clientX: any, clientY: any) {
    var rect = container.getBoundingClientRect();
    var mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    // "laje" nunca entra no hit-test: ela é uma superfície horizontal bem
    // na altura do plano de desenho de QUALQUER pavimento acima dela, e
    // sempre atrapalharia o clique-e-arraste ali. A visibilidade dela já
    // é controlada pelo painel de camadas, não precisa ser clicável aqui.
    var targets = scene.children.filter(function (o: any) { return o.isMesh && o.userData && o.userData.category && o.userData.category !== 'laje'; });
    var hits = raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0]!.object : null;
  }

  // Mesma coisa que pickMesh, mas devolve o hit completo (com o ponto
  // 3D exato do clique) — a lata de tinta precisa disso pra saber QUAL
  // lado da parede foi clicado (a caixa de referência que recebe o
  // clique cobre os dois lados, ver comentário em buildWallMeshFromFootprint).
  function pickMeshHit(clientX: any, clientY: any) {
    var rect = container.getBoundingClientRect();
    var mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    var targets = scene.children.filter(function (o: any) { return o.isMesh && o.userData && o.userData.category && o.userData.category !== 'laje'; });
    var hits = raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0] : null;
  }

  // Dado o ponto 3D exato de um clique numa parede, decide se caiu do
  // lado A ou do lado B — mesma convenção de sinal que Core.
  // computeWallFootprints usa (produto escalar com a normal da parede,
  // n = (-dy, dx) normalizado; positivo = lado A).
  function wallFaceAtPoint(wallId: any, hitPoint: any) {
    var w = Store.findWall(wallId);
    if (!w) return 'a';
    var mp = worldToModel(hitPoint.x, hitPoint.z);
    var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    var len = Math.hypot(dx, dy) || 1e-6;
    var nx = -dy / len, ny = dx / len;
    var vx = mp.x - w.x1, vy = mp.y - w.y1;
    return (vx * nx + vy * ny) > 0 ? 'a' : 'b';
  }

  function pickHandle(clientX: any, clientY: any) {
    var rect = container.getBoundingClientRect();
    var mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    var targets = scene.children.filter(function (o: any) { return o.isMesh && o.userData && o.userData.handle; });
    var hits = raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0]!.object.userData.handle : null;
  }

  function isEditableMesh(mesh: any) {
    if (!mesh) return false;
    var editingIdx = Store.getProject().currentFloorIndex;
    if (mesh.userData.floorIndex !== editingIdx) return false;
    return mesh.userData.category === 'paredesTerreo' || mesh.userData.category === 'paredesSuperiores' || mesh.userData.category === 'colunas' || mesh.userData.category === 'telhado' || mesh.userData.category === 'aberturas' || mesh.userData.category === 'varanda';
  }

  function select(wallId: any) {
    selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedWallId = wallId; gizmoMenuOpen = false;
    if (DEBUG_COLOR_MODE && wallId) hintEl.textContent = 'Debug — parede selecionada: ' + wallId;
    render();
  }
  function selectColumn(columnId: any) { selectedWallId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedColumnId = columnId; gizmoMenuOpen = false; render(); }
  function selectRoof(roofId: any) { selectedWallId = null; selectedColumnId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedRoofId = roofId; gizmoMenuOpen = false; render(); }
  // "Agarra" o cômodo inteiro (clique único numa parede que fecha só um
  // cômodo) — sem seleção de parede individual, sem gizmo de parede.
  function selectRoomGroup(wallIds: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedRoomWallIds = wallIds; gizmoMenuOpen = false; render(); }
  // Porta/janela: gizmo próprio (deslizar/excluir), sempre visível assim
  // que seleciona — diferente de parede/coluna/telhado, não precisa de
  // um segundo clique (clique direito) pra "abrir o menu", porque não
  // existe aqui a ambiguidade de "agarrar o cômodo inteiro" que motivou
  // aquele gesto extra nos outros tipos.
  function selectOpening(openingId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedVarandaId = null; selectedOpeningId = openingId; gizmoMenuOpen = false; render(); }
  // Varanda: mesmo padrão do telhado (clique seleciona, clique direito
  // de novo abre o menu com girar/excluir).
  function selectVaranda(varandaId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = varandaId; gizmoMenuOpen = false; render(); }
  function deselect() {
    commitRoomGroupIfNeeded(); // "clicou fora do objeto" — decide agora se funde
    selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null;
    gizmoMenuOpen = false; closeObjectPanel(); render();
  }

  function openObjectPanel(category: any) {
    highlightedCategory = category;
    objectPanelTitleEl.textContent = CATEGORY_LABELS[category] || category;
    renderObjectPanelBody(category);
    objectPanelEl.classList.add('visible');
  }
  function closeObjectPanel() {
    highlightedCategory = null;
    objectPanelEl.classList.remove('visible');
  }
  function addTypeOption(label: any, checked: any, onSelect: any) {
    var row = document.createElement('label');
    row.className = 'type-option';
    var input = document.createElement('input');
    input.type = 'radio'; input.name = 'objTypeOption'; input.checked = checked;
    input.addEventListener('change', onSelect);
    row.appendChild(input); row.appendChild(document.createTextNode(' ' + label));
    objectPanelBodyEl.appendChild(row);
  }
  function addSectionLabel(text: any) {
    var el = document.createElement('div');
    el.className = 'object-panel-section-label'; el.textContent = text;
    objectPanelBodyEl.appendChild(el);
  }
  function addVisibilityToggle(layerKey: any) {
    var project = Store.getProject();
    var row = document.createElement('label');
    row.className = 'type-option';
    var input = document.createElement('input');
    input.type = 'checkbox'; input.checked = (project.layers as any)[layerKey];
    input.addEventListener('change', function (e: any) { Store.commands.setLayerVisible(layerKey, e.target.checked); });
    row.appendChild(input); row.appendChild(document.createTextNode(' Visível'));
    objectPanelBodyEl.appendChild(row);
  }
  function renderObjectPanelBody(category: any) {
    objectPanelBodyEl.innerHTML = '';
    var project = Store.getProject();
    if (category === 'fundacao') {
      addSectionLabel('Tipo');
      addTypeOption('Radier', project.foundationType === 'radier', function () { Store.commands.setFoundationType('radier'); });
      addTypeOption('Baldrame', project.foundationType === 'baldrame', function () { Store.commands.setFoundationType('baldrame'); });
      addSectionLabel('Visibilidade'); addVisibilityToggle('fundacao');
    } else {
      addSectionLabel('Visibilidade'); addVisibilityToggle(category);
    }
  }

  function positionFloatingPanel(el: any, worldX: any, worldY: any, worldZ: any, xOffset: any) {
    var v = new THREE.Vector3(worldX, worldY, worldZ).project(camera);
    var rect = container.getBoundingClientRect();
    var sx = (v.x + 1) / 2 * rect.width;
    var sy = (1 - v.y) / 2 * rect.height;
    el.style.left = (sx + (xOffset || 0)) + 'px';
    el.style.top = sy + 'px';
  }

  // ---- Cotas de parede (largura na base + altura), vermelhas,
  // ligar/desligar ----
  function clearDimensionCotas() {
    dimCotaEntries.forEach(function (entry) { entry.el.remove(); });
    dimCotaEntries = [];
  }

  function addDimCota(worldX: any, worldY: any, worldZ: any, text: any) {
    var el = document.createElement('div');
    el.className = 'dim-cota';
    el.textContent = text;
    dimCotaLayerEl.appendChild(el);
    dimCotaEntries.push({ el: el, x: worldX, y: worldY, z: worldZ });
  }

  // Reconstrói as cotas do pavimento em edição — chamada sempre que o
  // modelo muda (onModelChanged), pra acompanhar parede criada/movida/
  // apagada. Uma cota de LARGURA no meio da base de cada parede (altura
  // Y = base) e uma cota de ALTURA perto de uma ponta, subindo até a
  // metade do pé-direito (a altura é a mesma pra toda parede do
  // pavimento — Scene3DRenderer.WALL_HEIGHT_GETTER — então a cota mostra
  // esse valor único por parede, não recalcula nada novo por parede).
  function rebuildDimensionCotas() {
    clearDimensionCotas();
    if (!dimensionsVisible || !dimCotaLayerEl) return;
    var yOffset = currentFloorYOffset();
    var wallHeight = Scene3DRenderer.WALL_HEIGHT_GETTER();
    Store.currentWalls().forEach(function (w) {
      var lenM = Core.wallLengthMeters(w);
      if (lenM < 0.05) return;
      var mid = modelToWorld((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
      addDimCota(mid.x, yOffset + 0.04, mid.z, lenM.toFixed(2).replace('.', ',') + ' m');
      var p1 = modelToWorld(w.x1, w.y1);
      addDimCota(p1.x, yOffset + wallHeight / 2, p1.z, wallHeight.toFixed(2).replace('.', ',') + ' m');
    });
    repositionDimensionCotas();
  }

  // Chamada a cada frame do loop de animação (ver animate() no fim do
  // arquivo) — só projeta em tela, não recalcula nada do modelo, então
  // é barato mesmo rodando 60x/s; sai de imediato se a camada estiver
  // vazia/desligada.
  function repositionDimensionCotas() {
    if (!dimensionsVisible || !dimCotaEntries.length) return;
    dimCotaEntries.forEach(function (entry) {
      positionFloatingPanel(entry.el, entry.x, entry.y, entry.z, 0);
    });
  }

  function toggleDimensions() {
    dimensionsVisible = !dimensionsVisible;
    rebuildDimensionCotas();
    return dimensionsVisible;
  }

  function positionGizmoAndShapePanel() {
    // Esquadria selecionada: gizmo próprio, sempre visível (não depende
    // de gizmoMenuOpen — ver selectOpening). Posicionado um pouco acima
    // do topo do vão, pra não tampar a folha/vidro.
    if (selectedOpeningId) {
      var op = Store.findOpening(selectedOpeningId);
      var w2b = op ? Store.findWall(op.wallId) : null;
      if (!op || !w2b) {
        selectedOpeningId = null;
        openingGizmoEl.classList.remove('visible');
      } else {
        var dxO = w2b.x2 - w2b.x1, dyO = w2b.y2 - w2b.y1;
        var lenModelO = Math.hypot(dxO, dyO) || 1e-6;
        var uxO = dxO / lenModelO, uyO = dyO / lenModelO;
        var offsetModelO = op.offset * Core.GRID;
        var wpO = modelToWorld(w2b.x1 + uxO * offsetModelO, w2b.y1 + uyO * offsetModelO);
        var topY = currentFloorYOffset() + op.sillHeight + op.height + 0.15;
        positionFloatingPanel(openingGizmoEl, wpO.x, topY, wpO.z, 0);
        openingGizmoEl.classList.add('visible');
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible');
      return;
    }
    openingGizmoEl.classList.remove('visible');

    // Cômodo "agarrado" inteiro (clique único numa parede que fecha só
    // um cômodo — ver selectRoomGroup): gizmo próprio, só com excluir,
    // também sempre visível (mesmo raciocínio da esquadria — não tem a
    // ambiguidade de "abrir menu" que parede/coluna/telhado têm).
    if (selectedRoomWallIds && selectedRoomWallIds.length) {
      var roomWalls = selectedRoomWallIds.map(function (id: any) { return Store.findWall(id); }).filter(Boolean);
      if (!roomWalls.length) {
        selectedRoomWallIds = null;
        roomGizmoEl.classList.remove('visible');
      } else {
        var cxR = 0, cyR = 0;
        roomWalls.forEach(function (w: any) { cxR += (w.x1 + w.x2) / 2; cyR += (w.y1 + w.y2) / 2; });
        cxR /= roomWalls.length; cyR /= roomWalls.length;
        var wpR = modelToWorld(cxR, cyR);
        positionFloatingPanel(roomGizmoEl, wpR.x, currentFloorYOffset() + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), wpR.z, 0);
        roomGizmoEl.classList.add('visible');
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible');
      return;
    }
    roomGizmoEl.classList.remove('visible');

    if (!gizmoMenuOpen) {
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible');
      roofTypePanelEl.classList.remove('visible');
      return;
    }
    var yOffset = currentFloorYOffset();
    if (selectedColumnId) {
      var c = Store.findColumn(selectedColumnId);
      if (!c) { selectedColumnId = null; gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); return; }
      var wp = modelToWorld(c.x, c.y);
      positionFloatingPanel(gizmoEl, wp.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), wp.z, 0);
      gizmoEl.classList.add('visible');
      positionFloatingPanel(columnShapePanelEl, wp.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), wp.z, -55);
      columnShapePanelEl.classList.add('visible');
      columnShapePanelEl.querySelectorAll('.sp').forEach(function (btn: any) { btn.classList.toggle('active', btn.dataset.shape === c!.shape); });
      roofTypePanelEl.classList.remove('visible');
      return;
    }
    columnShapePanelEl.classList.remove('visible');

    if (selectedRoofId) {
      var r = Store.findRoof(selectedRoofId);
      if (!r) { selectedRoofId = null; gizmoEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); return; }
      var mid2 = modelToWorld((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2);
      var topY2 = yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER();
      positionFloatingPanel(gizmoEl, mid2.x, topY2, mid2.z, 0);
      gizmoEl.classList.add('visible');
      positionFloatingPanel(roofTypePanelEl, mid2.x, topY2, mid2.z, -60);
      roofTypePanelEl.classList.add('visible');
      roofTypePanelEl.querySelectorAll('.rt').forEach(function (btn: any) { btn.classList.toggle('active', btn.dataset.rooftype === r!.type); });
      return;
    }
    roofTypePanelEl.classList.remove('visible');

    if (selectedVarandaId) {
      var vG = Store.findVaranda(selectedVarandaId);
      if (!vG) { selectedVarandaId = null; gizmoEl.classList.remove('visible'); return; }
      var midV = modelToWorld((vG.x1 + vG.x2) / 2, (vG.y1 + vG.y2) / 2);
      positionFloatingPanel(gizmoEl, midV.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), midV.z, 0);
      gizmoEl.classList.add('visible');
      return;
    }

    if (!selectedWallId) { gizmoEl.classList.remove('visible'); return; }
    var w = Store.findWall(selectedWallId);
    if (!w) { selectedWallId = null; gizmoEl.classList.remove('visible'); return; }
    var mid = modelToWorld((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
    positionFloatingPanel(gizmoEl, mid.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), mid.z, 0);
    gizmoEl.classList.add('visible');
  }

  function renderFinishSwatches(category: any, currentProductId: any, roomKey?: any) {
    finishPanelEl.innerHTML = '';
    Catalog.getProductsByCategory(category).forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'fn' + (p.id === currentProductId ? ' active' : '');
      btn.title = p.name;
      btn.style.background = p.assets.colorHex;
      btn.dataset.product = p.id;
      if (roomKey) btn.dataset.roomKey = roomKey;
      finishPanelEl.appendChild(btn);
    });
  }

  // Parede tem duas faces independentes (ver Store.commands.
  // setWallFinishFace) — duas fileiras de pastilhas na mesma paleta de
  // tinta, uma pra cada lado, com uma linha fina separando pra ficar
  // claro que são coisas diferentes.
  function renderWallFaceSwatches(productIdA: any, productIdB: any) {
    finishPanelEl.innerHTML = '';
    var products = Catalog.getProductsByCategory('paint');
    function addRow(face: any, currentProductId: any) {
      products.forEach(function (p) {
        var btn = document.createElement('button');
        btn.className = 'fn' + (p.id === currentProductId ? ' active' : '');
        btn.title = p.name + ' — face ' + face.toUpperCase();
        btn.style.background = p.assets.colorHex;
        btn.dataset.product = p.id;
        btn.dataset.face = face;
        finishPanelEl.appendChild(btn);
      });
    }
    addRow('a', productIdA);
    var divider = document.createElement('div');
    divider.className = 'finish-divider';
    finishPanelEl.appendChild(divider);
    addRow('b', productIdB);
  }

  // Painel de acabamento (pastilhas de cor): pintura numa parede
  // selecionada, telha num telhado selecionado, revestimento de piso
  // num cômodo agarrado. Parede e telhado só mostram o painel junto do
  // menu de clique direito (mesmo gatilho do gizmo); cômodo mostra assim
  // que é agarrado com um clique único, já que grupo de cômodo não tem
  // gizmo próprio.
  function refreshFinishPanel() {
    var yOffset = currentFloorYOffset();
    if (gizmoMenuOpen && selectedRoofId) {
      var r = Store.findRoof(selectedRoofId);
      if (r) {
        var mid2 = modelToWorld((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2);
        var topY2 = yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER();
        positionFloatingPanel(finishPanelEl, mid2.x, topY2, mid2.z, -100);
        renderFinishSwatches('roof_tile', r.finishProductId);
        finishPanelEl.classList.add('visible');
        return;
      }
    }
    if (gizmoMenuOpen && selectedWallId && !selectedColumnId) {
      var w2 = Store.findWall(selectedWallId);
      if (w2) {
        var mid3 = modelToWorld((w2.x1 + w2.x2) / 2, (w2.y1 + w2.y2) / 2);
        positionFloatingPanel(finishPanelEl, mid3.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), mid3.z, -95);
        renderWallFaceSwatches(w2.finishA, w2.finishB);
        finishPanelEl.classList.add('visible');
        return;
      }
    }
    if (selectedRoomWallIds && selectedRoomWallIds.length) {
      var walls = Store.currentWalls();
      var rooms = Core.detectRooms(walls);
      var matchRoom = rooms.filter(function (rm) {
        var ids = Core.findRoomWallIds(walls, rm);
        return ids.length === selectedRoomWallIds.length && ids.every(function (id) { return selectedRoomWallIds.indexOf(id) !== -1; });
      })[0];
      if (matchRoom) {
        var cx = 0, cy = 0;
        matchRoom.points.forEach(function (p) { cx += p.x; cy += p.y; });
        cx /= matchRoom.points.length; cy /= matchRoom.points.length;
        var wp2 = modelToWorld(cx, cy);
        positionFloatingPanel(finishPanelEl, wp2.x, yOffset + 0.1, wp2.z, 0);
        var key = Core.findRoomWallIds(walls, matchRoom).slice().sort().join(',');
        var currentFinish = (Store.currentFloor().roomFinishes || {})[key];
        renderFinishSwatches('floor_tile', currentFinish, key);
        finishPanelEl.classList.add('visible');
        return;
      }
    }
    finishPanelEl.classList.remove('visible');
  }

  // Cota ao vivo enquanto arrasta — mesma ideia do "readout" do Sims: ao
  // arrastar um cômodo, mostra largura e profundidade; ao arrastar uma
  // parede solta, mostra o comprimento. Some assim que o arraste termina.
  function updateDimLabels() {
    if (!drawPreview) { dimLabelAEl.classList.remove('visible'); dimLabelBEl.classList.remove('visible'); return; }
    var p = drawPreview;
    var labelY = p.yOffset + 0.08;

    if (p.tool === 'room') {
      var minX = Math.min(p.x1, p.x2), maxX = Math.max(p.x1, p.x2);
      var minY = Math.min(p.y1, p.y2), maxY = Math.max(p.y1, p.y2);
      var widthM = (maxX - minX) / Core.GRID;
      var depthM = (maxY - minY) / Core.GRID;
      if (widthM < 0.01 || depthM < 0.01) { dimLabelAEl.classList.remove('visible'); dimLabelBEl.classList.remove('visible'); return; }

      var midWidth = modelToWorld((minX + maxX) / 2, minY);
      dimLabelAEl.textContent = widthM.toFixed(2).replace('.', ',') + ' m';
      positionFloatingPanel(dimLabelAEl, midWidth.x, labelY, midWidth.z, 0);
      dimLabelAEl.classList.add('visible');

      var midDepth = modelToWorld(maxX, (minY + maxY) / 2);
      dimLabelBEl.textContent = depthM.toFixed(2).replace('.', ',') + ' m';
      positionFloatingPanel(dimLabelBEl, midDepth.x, labelY, midDepth.z, 0);
      dimLabelBEl.classList.add('visible');
    } else if (p.tool === 'wall') {
      var lenM = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) / Core.GRID;
      if (lenM < 0.01) { dimLabelAEl.classList.remove('visible'); dimLabelBEl.classList.remove('visible'); return; }
      var mid = modelToWorld((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2);
      dimLabelAEl.textContent = lenM.toFixed(2).replace('.', ',') + ' m';
      positionFloatingPanel(dimLabelAEl, mid.x, labelY, mid.z, 0);
      dimLabelAEl.classList.add('visible');
      dimLabelBEl.classList.remove('visible');
    } else {
      dimLabelAEl.classList.remove('visible');
      dimLabelBEl.classList.remove('visible');
    }
  }

  function render() {
    var project = Store.getProject();
    var selectedWall = selectedWallId ? Store.findWall(selectedWallId) : null;
    var selectedColumn = selectedColumnId ? Store.findColumn(selectedColumnId) : null;
    var selectedRoof = selectedRoofId ? Store.findRoof(selectedRoofId) : null;
    var selectedOpening = selectedOpeningId ? Store.findOpening(selectedOpeningId) : null;
    var selectedVaranda = selectedVarandaId ? Store.findVaranda(selectedVarandaId) : null;
    Scene3DRenderer.rebuild(scene, project, { width: 0, height: 0 }, {
      highlightedCategory: highlightedCategory,
      editingFloorIndex: project.currentFloorIndex,
      editingYOffset: currentFloorYOffset(),
      selectedWall: selectedWall,
      selectedColumn: selectedColumn,
      selectedRoof: selectedRoof,
      selectedOpening: selectedOpening,
      selectedVaranda: selectedVaranda,
      roomGroupWallIds: selectedRoomWallIds,
      resizeWallId: resizeWallId,
      drawPreview: drawPreview
    });
    positionGizmoAndShapePanel();
    refreshFinishPanel();
    updateDimLabels();
  }

  function onModelChanged() {
    if (selectedWallId && !Store.findWall(selectedWallId)) selectedWallId = null;
    if (selectedColumnId && !Store.findColumn(selectedColumnId)) selectedColumnId = null;
    if (selectedRoofId && !Store.findRoof(selectedRoofId)) selectedRoofId = null;
    if (selectedOpeningId && !Store.findOpening(selectedOpeningId)) selectedOpeningId = null;
    if (selectedVarandaId && !Store.findVaranda(selectedVarandaId)) selectedVarandaId = null;
    if (resizeWallId && !Store.findWall(resizeWallId)) resizeWallId = null;
    if (selectedRoomWallIds) {
      selectedRoomWallIds = selectedRoomWallIds.filter(function (id: any) { return !!Store.findWall(id); });
      if (!selectedRoomWallIds.length) selectedRoomWallIds = null;
    }
    updateWallGridOverlay();
    rebuildDimensionCotas();
    render();
  }

  // ---- ferramentas ----
  function setTool(tool: any) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn: any) {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    hintEl.textContent = TOOL_HINTS[tool] || '';
    container.classList.remove('tool-demolish', 'tool-paintBucket');
    if (tool === 'demolish' || tool === 'paintBucket') container.classList.add('tool-' + tool);
    refreshPaintPickerPanel();
    cancelPlacing();
    deselect();
    updateWallGridOverlay();
  }

  // Desativa a ferramenta atual (volta pro modo seleção, sem nenhuma
  // ativa) SEM desmarcar o que está selecionado — diferente de
  // setTool(null), que chama deselect(). Usado pelo comportamento "de
  // pulso" do Telhado: depois de colocar um, a ferramenta desarma
  // sozinha, mas o telhado recém-criado continua selecionado.
  // Menu de camadas (clique direito em área vazia) — posiciona no
  // ponto do clique e trava dentro da tela, igual qualquer menu de
  // contexto nativo faria.
  function showLayersMenu(clientX: any, clientY: any) {
    layersContextMenuEl.style.left = clientX + 'px';
    layersContextMenuEl.style.top = clientY + 'px';
    layersContextMenuEl.classList.add('visible');
    var rect = layersContextMenuEl.getBoundingClientRect();
    var overflowX = rect.right - window.innerWidth, overflowY = rect.bottom - window.innerHeight;
    if (overflowX > 0) layersContextMenuEl.style.left = (clientX - overflowX - 8) + 'px';
    if (overflowY > 0) layersContextMenuEl.style.top = (clientY - overflowY - 8) + 'px';
  }
  function hideLayersMenu() {
    layersContextMenuEl.classList.remove('visible');
  }

  function deactivateToolKeepSelection() {
    currentTool = null;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn: any) {
      btn.classList.remove('active');
    });
    hintEl.textContent = '';
    container.classList.remove('tool-demolish', 'tool-paintBucket');
    refreshPaintPickerPanel();
    drawPreview = null; // a prévia fantasma (telhado seguindo o cursor) não pode ficar congelada na tela
    updateWallGridOverlay();
    render();
  }

  // Paleta fixa da lata de tinta — só aparece enquanto a ferramenta
  // paintBucket está ativa. Diferente do finishPanel (que segue um
  // objeto selecionado), essa não depende de nenhuma seleção: a pessoa
  // escolhe a cor primeiro, "carrega" a lata, e só depois clica na
  // parede — por isso fica fixa no topo do viewport.
  function refreshPaintPickerPanel() {
    if (currentTool !== 'paintBucket') {
      paintPickerPanelEl.classList.remove('visible');
      return;
    }
    paintPickerPanelEl.innerHTML = '';
    Catalog.getProductsByCategory('paint').forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'fn' + (p.id === currentPaintProductId ? ' active' : '');
      btn.title = p.name;
      btn.style.background = p.assets.colorHex;
      btn.dataset.product = p.id;
      paintPickerPanelEl.appendChild(btn);
    });
    paintPickerPanelEl.classList.add('visible');
  }

  function cancelPlacing() {
    placingDraw = false;
    drawStart = null; drawPreview = null;
    render();
  }

  function startPlacing(startPt: any) {
    placingDraw = true;
    drawStart = startPt;
    drawPreview = { tool: currentTool, x1: startPt.x, y1: startPt.y, x2: startPt.x, y2: startPt.y, yOffset: currentFloorYOffset() };
    render();
  }

  // Segundo clique: confirma o cômodo/parede no ponto atual (já vem
  // grudado na grade pelo próprio onPointerMove, célula a célula).
  function finalizeDraw() {
    var p = drawPreview;
    if (currentTool === 'room') {
      Store.commands.createRoom(p.x1, p.y1, p.x2, p.y2);
    } else if (currentTool === 'wall') {
      // gruda no corpo de outra parede se estiver perto — fecha uma
      // junção em T sem precisar de nenhuma tecla extra, já que o clique
      // de confirmar nunca é interpretado como "selecionar aquela parede"
      var snapPt = findWallPointNear(p.x2, p.y2);
      var endX = snapPt ? snapPt.x : p.x2, endY = snapPt ? snapPt.y : p.y2;
      Store.commands.createWall(p.x1, p.y1, endX, endY);
    }
    placingDraw = false;
    drawStart = null; drawPreview = null;
    render();
  }

  // ---- ponteiro ----
  function onPointerDown(e: any) {
    hideLayersMenu();
    downPos = { x: e.clientX, y: e.clientY };
    downButton = e.button;

    // Botão direito E botão do meio (scroll) só giram a câmera — nunca
    // desenham nada; a decisão de "abrir menu" (só pro direito) ou só
    // girar acontece no pointerup/pointermove.
    if (downButton === 1 || downButton === 2) { e.preventDefault(); return; }

    // Já estamos "colocando" (depois do primeiro clique): este é o
    // segundo clique, confirma o cômodo/parede aqui.
    if (placingDraw) { finalizeDraw(); return; }

    // Segure Shift pra forçar o início do desenho mesmo em cima de uma
    // parede/coluna existente — é assim que se cria uma junção em T
    // (uma parede nova nascendo no meio de outra).
    if (e.shiftKey) {
      if (currentTool === 'columnQuadrada' || currentTool === 'columnRedonda') return;
      var gpShift = getGroundModelPoint(e.clientX, e.clientY);
      if (!gpShift) return;
      deselect();
      var snapStart = findWallPointNear(gpShift.x, gpShift.y);
      var startPtShift = snapStart ? { x: snapStart.x, y: snapStart.y } : { x: Core.snap(gpShift.x), y: Core.snap(gpShift.y) };
      startPlacing(startPtShift);
      return;
    }

    // Ferramenta Telhado: nunca seleciona parede/coluna, só telhado já
    // colocado (ou coloca um novo em cima do cômodo sob o cursor).
    if (currentTool === 'telhado') {
      var handleT = pickHandle(e.clientX, e.clientY);
      if (handleT && (handleT === 'roofRidge' || handleT.indexOf('roofEdge') === 0)) {
        dragMode = handleT;
        var rrT = Store.findRoof(selectedRoofId);
        if (handleT === 'roofRidge') {
          dragElementStart = { pitchDeg: rrT ? rrT.pitchDeg : 28, startScreenY: e.clientY };
        } else if (rrT) {
          var regionForDrag = findGridRegionAt((rrT.x1 + rrT.x2) / 2, (rrT.y1 + rrT.y2) / 2);
          dragElementStart = { x1: rrT.x1, y1: rrT.y1, x2: rrT.x2, y2: rrT.y2, region: regionForDrag };
        }
        Store.commands.beginTransaction();
        return;
      }
      var meshT = pickMesh(e.clientX, e.clientY);
      var editingIdxT = Store.getProject().currentFloorIndex;
      if (meshT && meshT.userData.roofId && meshT.userData.floorIndex === editingIdxT) {
        selectRoof(meshT.userData.roofId);
        return;
      }
      // Telhado agora é totalmente independente — nasce com um tamanho
      // padrão onde a pessoa clicar, travado dentro do grid daquele
      // cômodo (não sai flutuando por cima de outro, nem do vazio).
      deselect();
      var gpT = getGroundModelPoint(e.clientX, e.clientY);
      if (!gpT) return;
      var regionClick = findGridRegionAt(gpT.x, gpT.y);
      if (!regionClick) return; // fora de qualquer grid — não coloca nada
      var cx = Core.snap(gpT.x), cy = Core.snap(gpT.y);
      var half = ROOF_DEFAULT_SIZE / 2;
      var rectClick = clampRectToRegion(cx - half, cy - half, cx + half, cy + half, regionClick);
      var newRoof = Store.commands.createRoof(rectClick.x1, rectClick.y1, rectClick.x2, rectClick.y2, pendingRoofType as any);
      if (newRoof) {
        selectRoof(newRoof.id);
        // Botão "de pulso": Telhado não fica armado depois de colocar
        // um — a ferramenta desativa sozinha (volta pro modo seleção
        // normal), mas o telhado recém-criado continua selecionado,
        // com as alças de edição já visíveis. Pra colocar outro, a
        // pessoa clica em "Telhado" de novo, de propósito — sem isso,
        // qualquer clique perto enquanto ainda estivesse editando o
        // primeiro criava um segundo telhado sem querer.
        deactivateToolKeepSelection();
      }
      return;
    }



    // 1) alça de redimensionar (só existe se algo já está selecionado)
    var handle = pickHandle(e.clientX, e.clientY);
    if (handle) {
      if (handle === 'wallPerp') {
        // Alça branca no meio da parede selecionada — mesmo modo do
        // duplo clique, só que visível e descobrível de cara.
        startWallResizeDrag(selectedWallId, e.clientX, e.clientY);
        return;
      }
      dragMode = handle; // 'endpoint1' | 'endpoint2' | 'roofRidge' | 'roofEdge*' | 'varandaEdge*'
      if (handle === 'roofRidge') {
        var rr = Store.findRoof(selectedRoofId);
        dragElementStart = { pitchDeg: rr ? rr.pitchDeg : 28, startScreenY: e.clientY };
      } else if (handle.indexOf('roofEdge') === 0) {
        // A borda do telhado precisa saber o retângulo de partida E a
        // região de grade que trava o arraste — isso valia antes só
        // quando a ferramenta Telhado estava ativa (o outro lugar que
        // trata clique, mais abaixo); um telhado selecionado tem que
        // continuar arrastável mesmo com a ferramenta desligada, então
        // esse preparo precisa acontecer aqui também.
        var rrE = Store.findRoof(selectedRoofId);
        if (rrE) {
          var regionForDragE = findGridRegionAt((rrE.x1 + rrE.x2) / 2, (rrE.y1 + rrE.y2) / 2);
          dragElementStart = { x1: rrE.x1, y1: rrE.y1, x2: rrE.x2, y2: rrE.y2, region: regionForDragE };
        }
      } else if (handle.indexOf('varandaEdge') === 0) {
        // Varanda não trava em região de cômodo nenhuma (decisão
        // explícita — sempre livre), então não precisa achar região
        // nenhuma aqui, só o retângulo de partida.
        var vrE = Store.findVaranda(selectedVarandaId);
        if (vrE) dragElementStart = { x1: vrE.x1, y1: vrE.y1, x2: vrE.x2, y2: vrE.y2 };
      }
      Store.commands.beginTransaction();
      return;
    }

    // 2) elemento existente
    var mesh = pickMesh(e.clientX, e.clientY);

    // Ferramenta Porta/Janela ativa + clicou numa parede: insere a
    // abertura ali (não seleciona/arrasta a parede como o normal) —
    // igual a ferramenta Telhado nunca seleciona parede/coluna.
    if ((currentTool === 'door' || currentTool === 'window') && mesh && mesh.userData.wallId) {
      var gpIns = getGroundModelPoint(e.clientX, e.clientY);
      if (gpIns) {
        var newOpening = Store.commands.insertOpening(mesh.userData.wallId, currentTool, gpIns.x, gpIns.y);
        if (newOpening) selectOpening(newOpening.id);
        else hintEl.textContent = 'Não cabe uma ' + (currentTool === 'door' ? 'porta' : 'janela') + ' aqui — parede curta demais ou sem espaço livre.';
      }
      return;
    }

    // Ferramenta Quebrar parede ativa + clicou numa parede: demole na
    // hora, sem passar por seleção/gizmo — igual Porta/Janela, um clique
    // já basta. A parede some do modelo (Store.commands.deleteWall) e o
    // recálculo de geometria (computeWallFootprints, DEC-21/DEC-22) roda
    // do zero a partir das paredes que sobraram: qualquer ponta que
    // ficou sem vizinha ali automaticamente ganha uma tampa reta —
    // "quina perfeita" sem nenhum passo extra, de graça pela forma como
    // o resto do sistema já é montado. A ferramenta continua armada
    // depois, pra quebrar várias paredes em sequência.
    if (currentTool === 'demolish' && mesh && mesh.userData.wallId) {
      Store.commands.deleteWall(mesh.userData.wallId);
      // Rede de segurança: se essa parede estava fundida/sobreposta com
      // uma vizinha (DEC-12), a vizinha pode ter ficado com um pedacinho
      // de comprimento quase zero pendurado no mesmo ponto — sujeira
      // invisível que confundiria o cálculo de canto (Core.
      // computeWallFootprints acha um "toucher" que não devia existir
      // mais ali, e a ponta não fecha reta). pruneDegenerateWalls já
      // existia pra isso, só não era chamado automaticamente aqui.
      Store.commands.pruneDegenerateWalls();
      hintEl.textContent = 'Parede quebrada. Clique em outra pra continuar, ou escolha outra ferramenta.';
      return;
    }

    // Ferramenta Lata de tinta ativa + clicou numa parede: pinta só o
    // lado clicado (face A ou B, mesma lógica de dois lados que já
    // existe em Store.commands.setWallFinishFace) com a cor "carregada"
    // na paleta fixa do topo — não precisa selecionar a parede nem abrir
    // o painel de acabamento por clique direito primeiro.
    if (currentTool === 'paintBucket') {
      var paintHit = pickMeshHit(e.clientX, e.clientY);
      if (paintHit && paintHit.object.userData.wallId && currentPaintProductId) {
        var faceHit = wallFaceAtPoint(paintHit.object.userData.wallId, paintHit.point);
        Store.commands.setWallFinishFace(paintHit.object.userData.wallId, faceHit as any, currentPaintProductId);
        hintEl.textContent = 'Lado ' + faceHit.toUpperCase() + ' pintado. Clique em outra pra continuar.';
        return;
      }
    }

    if (mesh) {
      if (isEditableMesh(mesh)) {
        if (mesh.userData.wallId) {
          var clickedWallId = mesh.userData.wallId;
          var nowClick = Date.now();
          var isDoubleClick = (clickedWallId === lastWallClickId) && (nowClick - lastWallClickTime < DBLCLICK_MS);
          lastWallClickTime = nowClick;
          lastWallClickId = clickedWallId;
          var w = Store.findWall(clickedWallId);
          if (!w) return;

          if (isDoubleClick) {
            // Duplo clique: modo "redimensionar" — empurra só essa
            // parede, na perpendicular dela mesma; qualquer ponta de
            // outra parede encostada nela vem junto, pra nunca abrir
            // vão no canto. Se a parede for compartilhada entre dois
            // cômodos, um cresce e o outro encolhe sozinho, porque os
            // dois só existem como leitura da mesma geometria.
            startWallResizeDrag(clickedWallId, e.clientX, e.clientY);
            return;
          }

          // Clique único: se essa parede fecha exatamente um cômodo,
          // agarra o cômodo inteiro (todas as paredes dele arrastam
          // juntas, meio transparentes). Parede compartilhada entre dois
          // cômodos, ou que não fecha nenhum, cai pro comportamento
          // antigo de mover só ela mesma.
          var wallsNow = Store.currentWalls();
          var roomsHere = Core.detectRooms(wallsNow);
          var owningRoom: any = null, owningCount = 0;
          roomsHere.forEach(function (r: any) {
            if (Core.findRoomWallIds(wallsNow, r).indexOf(clickedWallId) !== -1) { owningCount++; owningRoom = r; }
          });

          if (owningCount === 1) {
            var groupIds = Core.findRoomWallIds(wallsNow, owningRoom);
            var snapshots = groupIds.map(function (id) {
              var gw = Store.findWall(id)!;
              return { id: id, x1: gw.x1, y1: gw.y1, x2: gw.x2, y2: gw.y2 };
            });
            selectRoomGroup(groupIds);
            dragElementStart = { snapshots: snapshots };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            dragMode = 'roomGroup';
            Store.commands.beginTransaction();
          } else {
            select(clickedWallId);
            dragMode = 'wallBody';
            dragElementStart = { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            Store.commands.beginTransaction();
          }
        } else if (mesh.userData.columnId) {
          selectColumn(mesh.userData.columnId);
          dragMode = 'columnBody';
          var c = Store.findColumn(mesh.userData.columnId)!;
          dragElementStart = { x: c.x, y: c.y };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          Store.commands.beginTransaction();
        } else if (mesh.userData.roofId) {
          selectRoof(mesh.userData.roofId);
        } else if (mesh.userData.varandaId) {
          selectVaranda(mesh.userData.varandaId);
        } else if (mesh.userData.openingId) {
          // Esquadria: arrasta livre (sem "segundo clique pra abrir
          // menu") desliza ao longo do EIXO da própria parede — mesma
          // ideia do redimensionar de parede, projetando o movimento do
          // mouse na direção da parede em vez da perpendicular.
          var op = Store.findOpening(mesh.userData.openingId);
          var ow = op ? Store.findWall(op.wallId) : null;
          if (!op || !ow) return;
          selectOpening(op.id);
          var odx = ow.x2 - ow.x1, ody = ow.y2 - ow.y1;
          var olen = Math.hypot(odx, ody) || 1e-6;
          dragMode = 'openingSlide';
          dragElementStart = { offset: op.offset, ux: odx / olen, uy: ody / olen };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          Store.commands.beginTransaction();
        }
        return;
      }
      // categoria de outro pavimento ou sem edição individual: abre painel
      deselect();
      openObjectPanel(mesh.userData.category);
      render();
      return;
    }

    // 3) chão vazio -> ferramenta ativa
    deselect();
    var gp = getGroundModelPoint(e.clientX, e.clientY);
    if (!gp) return;

    if (currentTool === 'columnQuadrada' || currentTool === 'columnRedonda') {
      var shape = currentTool === 'columnRedonda' ? 'redonda' : 'quadrada';
      var col = Store.commands.createColumn(gp.x, gp.y, shape as any);
      if (col) selectColumn(col.id);
      return;
    }

    // Sem ferramenta de desenho ativa (padrão agora) — clicar no chão
    // vazio só desmarca o que estava selecionado, não desenha nada. Só
    // desenha depois que a pessoa escolher "Parede" ou "Cômodo livre" em
    // Avançado (ou "Telhado"), de propósito.
    if (currentTool !== 'wall' && currentTool !== 'room' && currentTool !== 'telhado') return;

    // Cômodo/Parede: primeiro clique só marca o início — o cômodo/parede
    // nasce de verdade no SEGUNDO clique (finalizeDraw).
    startPlacing({ x: Core.snap(gp.x), y: Core.snap(gp.y) });
  }

  // Acha o cômodo fechado (se algum) sob o ponto de modelo dado — usado
  // pela ferramenta Telhado, tanto pra prévia (hover) quanto pro clique
  // que coloca de verdade.
  function findRoomBoundsAt(x: any, y: any) {
    var rooms = Core.detectRooms(Store.currentWalls());
    for (var i = 0; i < rooms.length; i++) {
      if (Core.pointInPolygon(x, y, rooms[i]!.points)) {
        var b = Core.roomModelBounds(rooms[i]!);
        // cômodo degenerado (área quase nula, ponto duplicado etc.) —
        // trata como se não tivesse achado nada, em vez de propagar isso
        // pra uma prévia ou telhado quebrado
        if (!b || !isFinite(b.minX) || !isFinite(b.maxX) || (b.maxX - b.minX) < Core.SNAP_UNIT || (b.maxY - b.minY) < Core.SNAP_UNIT) return null;
        return b;
      }
    }
    return null;
  }

  // Acha o telhado do MESMO tipo (duasAguas/quatroAguas — os únicos com
  // cumeeira de verdade) com footprint perto o bastante do telhado
  // dado, pra tentar alinhar a altura de cumeeira durante o arraste da
  // inclinação. Se houver mais de um candidato, pega o mais próximo.
  function findNearbyMatchingRoof(roof: any) {
    if (!roof || (roof.type !== 'duasAguas' && roof.type !== 'quatroAguas')) return null;
    var roofs = Store.currentRoofs();
    var best = null, bestGap = Infinity;
    roofs.forEach(function (o) {
      if (o.id === roof.id || o.type !== roof.type) return;
      if (!Core.rectsNearby(roof, o, ROOF_NEARBY_TOLERANCE)) return;
      var cx1 = (roof.x1 + roof.x2) / 2, cy1 = (roof.y1 + roof.y2) / 2;
      var cx2 = (o.x1 + o.x2) / 2, cy2 = (o.y1 + o.y2) / 2;
      var gap = Math.hypot(cx1 - cx2, cy1 - cy2);
      if (gap < bestGap) { bestGap = gap; best = o; }
    });
    return best;
  }

  // Acha um telhado fundível (ver Core.roofsCanFuse) perto o bastante
  // pra valer a pena tentar — mesma tolerância usada pro snap de altura.
  function findFusableRoof(roof: any) {
    var roofs = Store.currentRoofs();
    var found: any = null;
    roofs.forEach(function (o: any) {
      if (found) return;
      if (Core.roofsCanFuse(roof, o, ROOF_NEARBY_TOLERANCE)) found = o;
    });
    return found;
  }

  // Chamado ao soltar o arraste de uma alça de telhado (borda ou
  // cumeeira) — funde em loop (até 5 passadas, o suficiente pra uma
  // fileira de telhados grudando um no outro) enquanto o telhado
  // arrastado continuar encostando em outro fundível.
  function fuseRoofsIfTouching(roofId: any) {
    var fusedAny = false;
    for (var pass = 0; pass < 5; pass++) {
      var r = Store.findRoof(roofId);
      if (!r) break;
      var neighbor = findFusableRoof(r);
      if (!neighbor) break;
      var fused = Store.commands.fuseRoofs(roofId, neighbor.id);
      if (!fused) break;
      fusedAny = true;
    }
    return fusedAny;
  }

  function onPointerMove(e: any) {
    if (downButton === 1 || downButton === 2) {
      if (!downPos) return;
      var movedR = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      // Shift + arrastar (mesmo botão que já gira a câmera) desloca a
      // câmera livremente, em vez de girar — igual ao Blender
      // (Shift+arraste do botão do meio faz "pan"; sem Shift, o mesmo
      // arraste gira). O deslocamento segue a mão: puxa a cena pro lado
      // que o mouse anda, em qualquer direção, inclusive pra cima/baixo.
      if (e.shiftKey) {
        if (dragMode !== 'pan' && movedR > 4) dragMode = 'pan';
        if (dragMode === 'pan') {
          camera.updateMatrixWorld();
          var right = new THREE.Vector3(1, 0, 0).transformDirection(camera.matrixWorld);
          var up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
          var dxScreen = e.clientX - downPos.x, dyScreen = e.clientY - downPos.y;
          var panSpeed = camDist * 0.0022;
          camTarget.x += (-right.x * dxScreen + up.x * dyScreen) * panSpeed;
          camTarget.y += (-right.y * dxScreen + up.y * dyScreen) * panSpeed;
          camTarget.z += (-right.z * dxScreen + up.z * dyScreen) * panSpeed;
          downPos = { x: e.clientX, y: e.clientY };
          updateCam();
        }
        return;
      }
      if (dragMode !== 'orbit' && movedR > 4) dragMode = 'orbit';
      if (dragMode === 'orbit') {
        camAngle -= (e.clientX - downPos.x) * 0.006;
        camElev = Math.max(0.15, Math.min(1.4, camElev + (e.clientY - downPos.y) * 0.006));
        downPos = { x: e.clientX, y: e.clientY };
        updateCam();
      }
      return;
    }

    if (dragMode === 'endpoint1' || dragMode === 'endpoint2') {
      var gp1 = getGroundModelPoint(e.clientX, e.clientY);
      if (gp1) Store.commands.updateWallEndpointLive(selectedWallId, dragMode === 'endpoint1' ? 1 : 2, gp1.x, gp1.y);
      return;
    }
    if (dragMode === 'wallBody') {
      var gp2 = getGroundModelPoint(e.clientX, e.clientY);
      if (gp2 && dragGroundStart) {
        var dx = gp2.x - dragGroundStart.x, dy = gp2.y - dragGroundStart.y;
        Store.commands.updateWallBodyLive(selectedWallId, dragElementStart.x1 + dx, dragElementStart.y1 + dy, dragElementStart.x2 + dx, dragElementStart.y2 + dy);
      }
      return;
    }
    // Arrastando o cômodo inteiro (clique único no módulo) — livre pra
    // qualquer direção, mas nunca atravessa a parede de outro cômodo:
    // antes de aplicar a posição, empurra o delta pra fora de qualquer
    // sobreposição (resolveRoomGroupCollision). Quando encosta bem
    // rente, o empurrão vira ~zero — é assim que "gruda" sem cruzar,
    // sem precisar de nenhuma trava separada.
    if (dragMode === 'roomGroup') {
      var gpR = getGroundModelPoint(e.clientX, e.clientY);
      if (gpR && dragGroundStart && dragElementStart) {
        var gdx = Core.snap(gpR.x - dragGroundStart.x), gdy = Core.snap(gpR.y - dragGroundStart.y);
        var resolved = resolveRoomGroupCollision(dragElementStart.snapshots, gdx, gdy);
        Store.commands.updateWallsGroupBodyLive(dragElementStart.snapshots, resolved.x, resolved.y);
      }
      return;
    }
    // Duplo clique numa parede: empurra só na direção perpendicular a
    // ela mesma (projeta o arraste do mouse nessa direção), e move junto
    // qualquer ponta de outra parede que estava encostada na dela.
    if (dragMode === 'wallResize') {
      var gpZ = getGroundModelPoint(e.clientX, e.clientY);
      if (gpZ && dragGroundStart && dragElementStart) {
        var rawDx = gpZ.x - dragGroundStart.x, rawDy = gpZ.y - dragGroundStart.y;
        var offset = Core.snap(rawDx * dragElementStart.nx + rawDy * dragElementStart.ny);
        var rx1 = dragElementStart.x1 + dragElementStart.nx * offset, ry1 = dragElementStart.y1 + dragElementStart.ny * offset;
        var rx2 = dragElementStart.x2 + dragElementStart.nx * offset, ry2 = dragElementStart.y2 + dragElementStart.ny * offset;
        var linked = dragElementStart.linksStart.map(function (l: any) { return { id: l.id, which: l.which, x: rx1, y: ry1 }; })
          .concat(dragElementStart.linksEnd.map(function (l: any) { return { id: l.id, which: l.which, x: rx2, y: ry2 }; }));
        Store.commands.updateWallResizeLive(resizeWallId, rx1, ry1, rx2, ry2, linked);

        // Precisa de rastro se sobrou QUALQUER conexão original que não
        // está sendo seguida — seja porque não tinha nenhuma (ponta
        // solta, caso do L) ou porque tinha mais de uma e só a do
        // cômodo que cresce está sendo seguida (caso do U: a ponta toca
        // a parede do cômodo que cresce E a do que encolhe ao mesmo
        // tempo — a primeira segue, a segunda precisa do rastro).
        var needsBridgeStart = dragElementStart.rawStart.length === 0 || dragElementStart.linksStart.length < dragElementStart.rawStart.length;
        var needsBridgeEnd = dragElementStart.rawEnd.length === 0 || dragElementStart.linksEnd.length < dragElementStart.rawEnd.length;

        if (needsBridgeStart) {
          if (Math.hypot(rx1 - dragElementStart.x1, ry1 - dragElementStart.y1) > 0.5) {
            if (!dragElementStart.bridgeStartId) {
              dragElementStart.bridgeStartId = Store.commands.createBridgeWallLive(dragElementStart.x1, dragElementStart.y1, rx1, ry1);
            } else {
              Store.commands.updateBridgeWallLive(dragElementStart.bridgeStartId, dragElementStart.x1, dragElementStart.y1, rx1, ry1);
            }
          } else if (dragElementStart.bridgeStartId) {
            Store.commands.removeBridgeWallSilent(dragElementStart.bridgeStartId);
            dragElementStart.bridgeStartId = null;
          }
        }
        if (needsBridgeEnd) {
          if (Math.hypot(rx2 - dragElementStart.x2, ry2 - dragElementStart.y2) > 0.5) {
            if (!dragElementStart.bridgeEndId) {
              dragElementStart.bridgeEndId = Store.commands.createBridgeWallLive(dragElementStart.x2, dragElementStart.y2, rx2, ry2);
            } else {
              Store.commands.updateBridgeWallLive(dragElementStart.bridgeEndId, dragElementStart.x2, dragElementStart.y2, rx2, ry2);
            }
          } else if (dragElementStart.bridgeEndId) {
            Store.commands.removeBridgeWallSilent(dragElementStart.bridgeEndId);
            dragElementStart.bridgeEndId = null;
          }
        }
      }
      return;
    }
    if (dragMode === 'columnBody') {
      var gp3 = getGroundModelPoint(e.clientX, e.clientY);
      if (gp3 && dragGroundStart) {
        var dx3 = gp3.x - dragGroundStart.x, dy3 = gp3.y - dragGroundStart.y;
        Store.commands.updateColumnBodyLive(selectedColumnId, dragElementStart.x + dx3, dragElementStart.y + dy3);
      }
      return;
    }
    // Esquadria: projeta o arraste do mouse no EIXO da parede (não na
    // perpendicular, como o redimensionar de parede) — só desliza pra
    // frente/trás ao longo dela mesma, nunca sai da parede.
    if (dragMode === 'openingSlide') {
      var gpO2 = getGroundModelPoint(e.clientX, e.clientY);
      if (gpO2 && dragGroundStart && dragElementStart) {
        var rawDxO = gpO2.x - dragGroundStart.x, rawDyO = gpO2.y - dragGroundStart.y;
        var deltaM = (rawDxO * dragElementStart.ux + rawDyO * dragElementStart.uy) / Core.GRID;
        Store.commands.updateOpeningOffsetLive(selectedOpeningId, dragElementStart.offset + deltaM);
      }
      return;
    }
    if (dragMode === 'roofRidge') {
      if (dragElementStart) {
        var deltaScreen = dragElementStart.startScreenY - e.clientY; // positivo = arrastou pra cima
        var candidatePitch = Math.max(5, Math.min(75, dragElementStart.pitchDeg + deltaScreen * 0.25));
        var rNow = Store.findRoof(selectedRoofId);
        var finalPitch = candidatePitch;
        if (rNow) {
          var neighborRoof = findNearbyMatchingRoof(rNow);
          if (neighborRoof) {
            var neighborHeightM = Core.roofRidgeHeightMeters(neighborRoof);
            if (neighborHeightM != null) {
              // Pitch que faria ESTE telhado (com o footprint dele) bater
              // na mesma altura de cumeeira do vizinho — não mexe em
              // footprint nenhum, só na inclinação.
              var matchPitchDeg = Core.roofPitchForRidgeHeight(rNow, neighborHeightM);
              if (Math.abs(candidatePitch - matchPitchDeg) < ROOF_PITCH_SNAP_DEG) {
                finalPitch = matchPitchDeg;
                hintEl.textContent = 'Cumeeira alinhada com o telhado vizinho — ' + neighborHeightM.toFixed(2).replace('.', ',') + ' m de altura.';
              }
            }
          }
        }
        Store.commands.updateRoofPitchLive(selectedRoofId, finalPitch);
      }
      return;
    }
    if (dragMode && dragMode.indexOf('roofEdge') === 0) {
      var gpE = getGroundModelPoint(e.clientX, e.clientY);
      if (gpE && dragElementStart) {
        var snappedX = Core.snap(gpE.x), snappedY = Core.snap(gpE.y);
        var region = dragElementStart.region;
        if (region) {
          snappedX = Math.max(region.minX, Math.min(region.maxX, snappedX));
          snappedY = Math.max(region.minY, Math.min(region.maxY, snappedY));
        }
        var edge = dragMode.slice('roofEdge'.length); // 'MinX' | 'MaxX' | 'MinY' | 'MaxY'
        var nx1 = dragElementStart.x1, ny1 = dragElementStart.y1, nx2 = dragElementStart.x2, ny2 = dragElementStart.y2;
        if (edge === 'MinX') nx1 = Math.min(snappedX, nx2 - Core.SNAP_UNIT);
        else if (edge === 'MaxX') nx2 = Math.max(snappedX, nx1 + Core.SNAP_UNIT);
        else if (edge === 'MinY') ny1 = Math.min(snappedY, ny2 - Core.SNAP_UNIT);
        else if (edge === 'MaxY') ny2 = Math.max(snappedY, ny1 + Core.SNAP_UNIT);
        Store.commands.updateRoofBoundsLive(selectedRoofId, nx1, ny1, nx2, ny2);
      }
      return;
    }
    if (dragMode && dragMode.indexOf('varandaEdge') === 0) {
      var gpVE = getGroundModelPoint(e.clientX, e.clientY);
      if (gpVE && dragElementStart) {
        var snappedVX = Core.snap(gpVE.x), snappedVY = Core.snap(gpVE.y);
        var edgeV = dragMode.slice('varandaEdge'.length);
        var vx1 = dragElementStart.x1, vy1 = dragElementStart.y1, vx2 = dragElementStart.x2, vy2 = dragElementStart.y2;
        if (edgeV === 'MinX') vx1 = Math.min(snappedVX, vx2 - Core.SNAP_UNIT);
        else if (edgeV === 'MaxX') vx2 = Math.max(snappedVX, vx1 + Core.SNAP_UNIT);
        else if (edgeV === 'MinY') vy1 = Math.min(snappedVY, vy2 - Core.SNAP_UNIT);
        else if (edgeV === 'MaxY') vy2 = Math.max(snappedVY, vy1 + Core.SNAP_UNIT);
        Store.commands.updateVarandaBoundsLive(selectedVarandaId, vx1, vy1, vx2, vy2);
      }
      return;
    }
    // Ferramenta Telhado: nenhum clique ainda, só passando o mouse — o
    // telhadinho fantasma (tamanho padrão) segue o cursor, já grudado na
    // grade, mostrando onde ele nasceria se clicasse agora.
    if (currentTool === 'telhado' && !placingDraw && !selectedRoofId) {
      var gpT = getGroundModelPoint(e.clientX, e.clientY);
      var regionT = gpT ? findGridRegionAt(gpT.x, gpT.y) : null;
      if (regionT) {
        var cxT = Core.snap(gpT!.x), cyT = Core.snap(gpT!.y);
        var halfT = ROOF_DEFAULT_SIZE / 2;
        var rectT = clampRectToRegion(cxT - halfT, cyT - halfT, cxT + halfT, cyT + halfT, regionT);
        drawPreview = { tool: 'telhado', x1: rectT.x1, y1: rectT.y1, x2: rectT.x2, y2: rectT.y2, yOffset: currentFloorYOffset(), roofType: pendingRoofType, pitchDeg: 28 };
      } else {
        drawPreview = null; // fora de qualquer grid — não mostra prévia, não dá pra colocar ali
      }
      render();
      return;
    }
    // Colocando cômodo/parede: a seta corre livre (sem segurar botão),
    // pulando de interseção em interseção da grade — igual o indicador
    // de início, só que agora move o CANTO/PONTA que falta confirmar.
    if (placingDraw && drawPreview) {
      var gp4 = getGroundModelPoint(e.clientX, e.clientY);
      if (gp4) {
        drawPreview.x2 = Core.snap(gp4.x);
        drawPreview.y2 = Core.snap(gp4.y);
        render();
      }
      return;
    }
  }

  function onPointerUp(e: any) {
    if (downButton === 1 || downButton === 2) {
      if (downButton === 2 && dragMode !== 'orbit' && dragMode !== 'pan') {
        // Clique direito sem arraste: se caiu em cima do elemento já
        // selecionado, abre o menu de edição dele (rotacionar, duplicar,
        // excluir — comportamento de sempre). Qualquer outro lugar
        // (vazio, ou um elemento que não é o selecionado) abre o menu
        // de camadas — essa regra simples evita qualquer ambiguidade
        // sobre qual menu vai aparecer.
        var mesh = pickMesh(e.clientX, e.clientY);
        var hitsSelected = mesh && ((mesh.userData.wallId && mesh.userData.wallId === selectedWallId) || (mesh.userData.columnId && mesh.userData.columnId === selectedColumnId) || (mesh.userData.roofId && mesh.userData.roofId === selectedRoofId) || (mesh.userData.varandaId && mesh.userData.varandaId === selectedVarandaId));
        if (hitsSelected) { hideLayersMenu(); gizmoMenuOpen = true; render(); }
        else { gizmoMenuOpen = false; render(); showLayersMenu(e.clientX, e.clientY); }
      }
      downButton = null; dragMode = null; downPos = null;
      return;
    }

    if (dragMode === 'wallResize') {
      // Empurrou a parede até encostar certinho na de outro cômodo?
      // Funde ali mesmo, sem precisar de nenhum passo extra — mesma
      // checagem que já roda quando um cômodo inteiro é solto.
      // Inclui as paredes-rastro (bridgeStartId/bridgeEndId) na busca:
      // o lado que fica pendente de fusão às vezes é o degrau recém-
      // criado, não a própria parede arrastada — checar só resizeWallId
      // deixava esse lado sem NUNCA ser avaliado. E usa o loop (mesma
      // lógica de commitRoomGroupIfNeeded): a parede pode encostar em
      // mais de um vizinho ao mesmo tempo.
      // IMPORTANTE: só roda essa checagem se a parede REALMENTE se
      // moveu neste arraste — um clique que entra em modo resize mas
      // solta sem arrastar não deve fundir nada por conta própria (senão
      // uma sobreposição antiga, parada, seria fundida só por causa de
      // um clique de seleção, sem nenhuma ação explícita da pessoa).
      if (resizeWallId && dragElementStart) {
        var wNow = Store.findWall(resizeWallId);
        var moved = wNow && (
          Math.hypot(wNow.x1 - dragElementStart.x1, wNow.y1 - dragElementStart.y1) > 0.5 ||
          Math.hypot(wNow.x2 - dragElementStart.x2, wNow.y2 - dragElementStart.y2) > 0.5
        );
        if (moved) {
          var resizeGroup = [resizeWallId];
          if (dragElementStart.bridgeStartId) resizeGroup.push(dragElementStart.bridgeStartId);
          if (dragElementStart.bridgeEndId) resizeGroup.push(dragElementStart.bridgeEndId);
          if (fuseAllOverlaps(resizeGroup)) {
            hintEl.textContent = 'Paredes fundidas — o trecho compartilhado agora é uma parede só.';
          }
        }
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }

    // As duas únicas rotas que aplicam posição CONTÍNUA (não alinhada ao
    // grid) durante o arrasto — mover o corpo de uma parede solta, e
    // arrastar um cômodo inteiro (que depende de colisão contínua pra
    // encostar exatamente sem abrir vão nem sobrepor demais) — precisam
    // de um arredondamento final pro grid assim que o mouse solta. Sem
    // isso, a posição "quase certa" da colisão ficava permanente, e
    // qualquer operação futura (redimensionar, fundir, criar rastro)
    // herdava e podia amplificar esse resíduo — foi exatamente essa a
    // causa dos desalinhamentos de 0,12/0,06 vistos nos testes.
    function snapWallToGridExact(wallId: any) {
      var w = Store.findWall(wallId);
      if (!w) return;
      Store.commands.updateWallBodyLive(wallId, Core.snap(w.x1), Core.snap(w.y1), Core.snap(w.x2), Core.snap(w.y2));
    }

    if (dragMode === 'wallBody') {
      if (selectedWallId) snapWallToGridExact(selectedWallId);
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'roomGroup') {
      if (dragElementStart && dragElementStart.snapshots) {
        dragElementStart.snapshots.forEach(function (s: any) { snapWallToGridExact(s.id); });
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    // Telhado (cumeeira ou borda): solta e, se o footprint dele agora
    // encosta/sobrepõe um vizinho do MESMO tipo, MESMA inclinação e
    // MESMO eixo de cumeeira, com a extensão perpendicular batendo
    // exata — funde os dois num telhado só, igual parede colinear se
    // funde ao encostar (ver Store.commands.fuseRoofs / fuseAllOverlaps
    // de paredes — mesma ideia: sobreposição/encaixe exato em vez de
    // tentar calcular vale entre dois telhados que NÃO são a mesma água
    // continuando, esse caso genérico continua fora de escopo — ver
    // Registro de Decisões Técnicas, Sessão 4).
    if (dragMode === 'roofRidge' || (dragMode && dragMode.indexOf('roofEdge') === 0)) {
      if (selectedRoofId && fuseRoofsIfTouching(selectedRoofId)) {
        hintEl.textContent = 'Telhados fundidos — a cumeeira agora é uma só.';
        onModelChanged();
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'endpoint1' || dragMode === 'endpoint2' || dragMode === 'columnBody' || dragMode === 'openingSlide' || (dragMode && dragMode.indexOf('varandaEdge') === 0)) {
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }

    downButton = null;
  }

  // Ponto exato em cima do CORPO de qualquer parede do pavimento sendo
  // editado — usado ao confirmar o desenho, pra permitir uma parede nova
  // terminar no meio de outra (junção em T).
  function findWallPointNear(x: any, y: any) {
    var list = Store.currentWalls();
    for (var i = list.length - 1; i >= 0; i--) {
      var w = list[i]!;
      var res = Core.projectOnSegment(x, y, w.x1, w.y1, w.x2, w.y2);
      if (res && res.dist <= 12) return res;
    }
    return null;
  }

  // Pra empurrar uma parede sem abrir vão no canto: acha quais OUTRAS
  // paredes têm uma ponta encostada exatamente no ponto (x,y) — essa
  // ponta precisa se mover junto quando a parede arrastada mudar de
  // lugar. Mesma tolerância usada no split de junção em T.
  function findLinkedEndpoints(wallId: any, x: any, y: any) {
    var TOL = Core.COINCIDENCE_TOL;
    var links: any[] = [];
    Store.currentWalls().forEach(function (w) {
      if (w.id === wallId) return;
      if (Math.hypot(w.x1 - x, w.y1 - y) <= TOL) links.push({ id: w.id, which: 1 });
      if (Math.hypot(w.x2 - x, w.y2 - y) <= TOL) links.push({ id: w.id, which: 2 });
    });
    return links;
  }

  // Acha as paredes do cômodo que deve "esticar de verdade" quando essa
  // parede é empurrada. Se ela fecha só 1 cômodo, é ele. Se for
  // compartilhada entre 2 (parede fundida), o dono é o cômodo que está
  // CRESCENDO com esse empurrão específico — a direção do empurrão
  // aponta pra FORA do centro dele (se apontasse pra dentro, o cômodo
  // estaria encolhendo, não esticando). O outro cômodo nunca é
  // arrastado — ganha o degrau/rastro (ver bridgeStartId/bridgeEndId).
  function sameRoomWallIds(wallId: any, pushNx: any, pushNy: any) {
    var walls = Store.currentWalls();
    var rooms = Core.detectRooms(walls);
    var owning = rooms.filter(function (r) { return Core.findRoomWallIds(walls, r).indexOf(wallId) !== -1; });
    if (owning.length === 0) return null;
    if (owning.length === 1) return Core.findRoomWallIds(walls, owning[0]!);

    var w = Store.findWall(wallId)!;
    var midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    function centroid(r: any) {
      var cx = 0, cy = 0;
      r.points.forEach(function (p: any) { cx += p.x; cy += p.y; });
      return { x: cx / r.points.length, y: cy / r.points.length };
    }
    // dot negativo = o empurrão aponta pra LONGE do centro desse cômodo
    // = ele está crescendo (a parede dele avança). Pega o mais negativo.
    var best = null, bestDot = Infinity;
    owning.forEach(function (r) {
      var c = centroid(r);
      var dot = (c.x - midX) * pushNx + (c.y - midY) * pushNy;
      if (dot < bestDot) { bestDot = dot; best = r; }
    });
    return best ? Core.findRoomWallIds(walls, best) : null;
  }

  // Começa o modo "empurrar a parede na perpendicular" — usado tanto
  // pelo duplo clique quanto pela alça branca visível no meio da
  // parede. Um único lugar pra montar o estado do arraste, pra os dois
  // gatilhos nunca ficarem dessincronizados.
  function startWallResizeDrag(wallId: any, clientX: any, clientY: any) {
    var w = Store.findWall(wallId);
    if (!w) return;
    var w2 = w; // TS não propaga a checagem de null pra dentro de closures — alias já estreitado
    select(wallId);
    resizeWallId = wallId;
    var dxw = w.x2 - w.x1, dyw = w.y2 - w.y1;
    var lenw = Math.hypot(dxw, dyw) || 1;
    var pushNx = -dyw / lenw, pushNy = dxw / lenw;
    // Praticamente toda parede neste editor nasce e permanece alinhada
    // ao eixo (horizontal ou vertical) — paredes de cômodo nunca são
    // desenhadas em ângulo. Se a parede já estava QUASE perfeitamente
    // alinhada (resíduo de ponto flutuante bem menor que 1 unidade,
    // acumulado de operações anteriores), o cálculo acima herda esse
    // resíduo minúsculo na direção do empurrão. Isso é invisível em
    // arrastos normais, mas um arrasto grande AMPLIFICA esse resíduo
    // proporcionalmente à distância — é assim que uma parede "horizontal"
    // acaba ganhando um X levemente diferente depois de um empurrão bem
    // longo. Corrigido na fonte: se a direção calculada já está muito
    // perto de 0/±1, força o valor exato, eliminando a possibilidade de
    // amplificar qualquer resíduo.
    var AXIS_SNAP_TOL = 1e-4;
    if (Math.abs(pushNx) < AXIS_SNAP_TOL) pushNx = 0;
    else if (Math.abs(Math.abs(pushNx) - 1) < AXIS_SNAP_TOL) pushNx = pushNx > 0 ? 1 : -1;
    if (Math.abs(pushNy) < AXIS_SNAP_TOL) pushNy = 0;
    else if (Math.abs(Math.abs(pushNy) - 1) < AXIS_SNAP_TOL) pushNy = pushNy > 0 ? 1 : -1;
    // "Seguir o canto" só vale pro cômodo que está crescendo com esse
    // empurrão (ver sameRoomWallIds) — nunca pra parede de um cômodo
    // que está encolhendo, mesmo que compartilhem um ponto.
    var roomIds = sameRoomWallIds(wallId, pushNx, pushNy); // já vem em ordem de contorno (Core.findRoomWallIds)
    var rawStart = findLinkedEndpoints(wallId, w.x1, w.y1);
    var rawEnd = findLinkedEndpoints(wallId, w.x2, w.y2);
    // Antes: "qualquer parede do cômodo que crescer com ponta encostada
    // nesse ponto" — funciona com 2 paredes se tocando, mas quando 3+
    // cômodos convergem no mesmo ponto físico (ex.: cozinha+banheiro+
    // quarto fundidos num canto só), mais de uma parede do MESMO cômodo
    // pode ter ponta ali (a vizinha de verdade e, por coincidência, uma
    // parede bem mais distante do cômodo, como a externa oposta) — e a
    // parede errada acabava sendo arrastada junto.
    // Correção: nunca perguntar "quem mais está nesse ponto"; perguntar
    // só "quem é minha vizinha IMEDIATA no contorno desse cômodo" — a
    // parede anterior e a seguinte na lista já ordenada de roomIds. Isso
    // vale igual pra 2, 3 ou N cômodos convergindo, sem checar quantos
    // são: a vizinha de contorno nunca é a parede errada.
    var linksStart: any[] = [], linksEnd: any[] = [];
    if (roomIds && roomIds.length > 1) {
      var selfIdx = roomIds.indexOf(wallId);
      if (selfIdx !== -1) {
        var TOL = Core.COINCIDENCE_TOL;
        var ux = dxw / lenw, uy = dyw / lenw; // direção da própria parede arrastada
        var neighborIds = [
          roomIds[(selfIdx - 1 + roomIds.length) % roomIds.length],
          roomIds[(selfIdx + 1) % roomIds.length]
        ];
        neighborIds.forEach(function (nid: any) {
          if (!nid || nid === wallId) return;
          var ow = Store.findWall(nid);
          if (!ow) return;
          // Só faz sentido "seguir o canto" arrastando UMA ponta da
          // vizinha quando ela é perpendicular (ou pelo menos não-
          // colinear) à parede arrastada: mover uma ponta na direção do
          // empurrão só estica/encolhe o comprimento dela, nunca inclina.
          // Se a vizinha for COLINEAR (mesma linha reta, caso clássico:
          // a parede externa que continua reto além do canto fundido),
          // mover só uma ponta dela a transformaria de reta em diagonal
          // — uma deformação de verdade, não um redimensionamento. Nesse
          // caso é melhor NÃO arrastar essa vizinha (ela permanece como
          // "raw" mas não "linked" — o mecanismo de parede-rastro já
          // existente cobre o vão sozinho, sem deformar nada).
          var odx = ow.x2 - ow.x1, ody = ow.y2 - ow.y1;
          var olen = Math.hypot(odx, ody) || 1;
          var cross = Math.abs(ux * (ody / olen) - uy * (odx / olen));
          if (cross < 0.05) return; // colinear/paralela — deixa pro rastro
          // Descobre em qual ponta (1 ou 2) da vizinha o encontro
          // realmente acontece — a ordem no contorno não garante que
          // "anterior" bate com x1 e "seguinte" com x2.
          if (Math.hypot(ow.x1 - w2.x1, ow.y1 - w2.y1) <= TOL) linksStart.push({ id: nid, which: 1 });
          else if (Math.hypot(ow.x2 - w2.x1, ow.y2 - w2.y1) <= TOL) linksStart.push({ id: nid, which: 2 });
          if (Math.hypot(ow.x1 - w2.x2, ow.y1 - w2.y2) <= TOL) linksEnd.push({ id: nid, which: 1 });
          else if (Math.hypot(ow.x2 - w2.x2, ow.y2 - w2.y2) <= TOL) linksEnd.push({ id: nid, which: 2 });
        });
      }
    }
    dragElementStart = {
      x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
      nx: pushNx, ny: pushNy,
      linksStart: linksStart,
      linksEnd: linksEnd,
      rawStart: rawStart,
      rawEnd: rawEnd,
      // Ponta sem ninguém do mesmo cômodo seguindo junto: em vez de
      // deixar essa ponta boiar (ou arrastar parede de outro cômodo),
      // uma parede-rastro nasce ligando de onde ela começou até onde
      // ela está agora — o "pedacinho novo perpendicular" que fecha o
      // buraco. bridgeStartId/bridgeEndId guardam o id dela uma vez
      // criada (null até a ponta se mexer de verdade).
      bridgeStartId: null,
      bridgeEndId: null
    };
    dragGroundStart = getGroundModelPoint(clientX, clientY);
    dragMode = 'wallResize';
    Store.commands.beginTransaction();
    render();
  }

  // Empurra o delta do arraste pra fora de qualquer sobreposição real
  // entre uma parede do grupo (na posição CANDIDATA, snapshot+delta) e
  // uma parede de fora — testando como retângulos orientados, então
  // funciona em qualquer ângulo, não só parede paralela. Várias
  // passadas porque empurrar pra resolver uma colisão pode encostar em
  // outra parede diferente (ex.: canto de um cômodo em L).
  var COLLISION_MAX_PASSES = 6;
  function resolveRoomGroupCollision(snapshots: any, dx: any, dy: any) {
    var groupIds = snapshots.map(function (s: any) { return s.id; });
    var others = Store.currentWalls().filter(function (w) { return groupIds.indexOf(w.id) === -1; });
    if (!others.length) return { x: dx, y: dy };
    for (var pass = 0; pass < COLLISION_MAX_PASSES; pass++) {
      var worstMTV = null, worstDepth = 0;
      for (var i = 0; i < snapshots.length; i++) {
        var s = snapshots[i]!;
        var aObb = Core.wallOBB({ id: s.id, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy });
        for (var j = 0; j < others.length; j++) {
          var mtv = Core.obbOverlapMTV(aObb, Core.wallOBB(others[j]!));
          if (mtv) {
            var depth = Math.hypot(mtv.x, mtv.y);
            if (depth > worstDepth) { worstDepth = depth; worstMTV = mtv; }
          }
        }
      }
      if (!worstMTV) break; // nenhuma sobreposição — delta atual já é válido
      dx += worstMTV.x; dy += worstMTV.y;
    }
    return { x: dx, y: dy };
  }

  // Alguma parede do grupo arrastado pousou em cima da parede de outro
  // cômodo — mesma linha (paralela e coincidente), com sobreposição real
  // — mesmo que os dois comprimentos sejam diferentes? Detecta o
  // candidato aqui; quem decide como cortar sem deformar nada é o
  // Store.commands.fuseOverlappingWalls.
  //
  // Importante: compara contra TODAS as outras paredes do modelo, não só
  // as de fora do grupo. Depois de uma fusão parcial, o cômodo
  // reconhecido pode "engolir" o contorno de um vizinho ainda não
  // fundido (a mesma ambiguidade de contorno que já vimos antes) — nesse
  // caso as DUAS paredes que ainda precisam se fundir acabam dentro do
  // mesmo grupo, e restringir a busca a "grupo × fora do grupo" nunca
  // enxergaria esse par, deixando o loop parar cedo demais.
  var MERGE_TOL_DIST = 4, MERGE_TOL_ANGLE = 0.05, MERGE_MIN_OVERLAP = Core.SNAP_UNIT * 0.5;
  function findMergeCandidate(groupWallIds: any) {
    var groupWalls = groupWallIds.map(function (id: any) { return Store.findWall(id); }).filter(Boolean);
    var others = Store.currentWalls();
    var best: any = null;
    groupWalls.forEach(function (a: any) {
      var aLen = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
      if (aLen < 1e-6) return;
      var aAngle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
      others.forEach(function (b) {
        if (b.id === a.id) return;
        var bLen = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
        if (bLen < 1e-6) return;
        var bAngle = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
        var diff = Math.abs(aAngle - bAngle) % Math.PI;
        if (diff > Math.PI / 2) diff = Math.PI - diff;
        if (diff > MERGE_TOL_ANGLE) return; // não são paralelas (nem opostas)
        var dMid = Core.distPointToLine((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2, b.x1, b.y1, b.x2, b.y2);
        if (dMid > MERGE_TOL_DIST) return; // não estão na mesma linha
        var ux = (b.x2 - b.x1) / bLen, uy = (b.y2 - b.y1) / bLen;
        var ta1 = (a.x1 - b.x1) * ux + (a.y1 - b.y1) * uy;
        var ta2 = (a.x2 - b.x1) * ux + (a.y2 - b.y1) * uy;
        var overlap = Math.min(Math.max(ta1, ta2), bLen) - Math.max(Math.min(ta1, ta2), 0);
        if (overlap < MERGE_MIN_OVERLAP) return; // sobreposição real demais pequena
        if (!best || dMid < best.dist) best = { wallAId: a.id, wallBId: b.id, dist: dMid };
      });
    });
    return best;
  }

  // O cômodo em "modo deslocamento" (selectedRoomWallIds) pode ser
  // arrastado livremente, sobrepondo outros cômodos à vontade, sem
  // nenhuma verificação durante o movimento — igual ao Sims. A fusão só
  // é decidida no momento em que a pessoa CLICA FORA do objeto (chão
  // vazio, outra ferramenta, outro elemento): se alguma parede dele
  // ficou coincidente com a de outro cômodo naquele instante, funde;
  // senão, só solta o cômodo onde estiver, sem mexer em mais nada.
  //
  // Um cômodo pode encostar em MAIS DE UM vizinho ao mesmo tempo (ex.:
  // fica espremido entre dois outros cômodos, um de cada lado). Fundir
  // só o candidato mais próximo deixava o outro lado com paredes
  // coincidentes nunca cortadas — a mesma aresta física acabava contando
  // como fronteira de 3 cômodos ao mesmo tempo (confirmado inspecionando
  // Core.detectRooms de verdade: uma parede aparecendo nas 3 listas),
  // corrompendo tudo que depende de "essa parede separa exatamente 2
  // cômodos" — inclusive o redimensionar por vizinho de contorno.
  // Correção: fundir em loop até não sobrar candidato nenhum, não só uma
  // vez. Um cap de passadas evita loop infinito em caso patológico.
  // Extraído como função reaproveitável — usada tanto ao soltar um
  // cômodo inteiro quanto ao terminar de redimensionar uma parede (ver
  // onPointerUp / dragMode 'wallResize'), porque os dois fluxos podem
  // deixar mais de um lado coincidente esperando fusão.
  var MERGE_MAX_PASSES = 6;
  function fuseAllOverlaps(initialGroupIds: any) {
    var groupIds = initialGroupIds.filter(Boolean);
    var mergedAny = false;
    for (var pass = 0; pass < MERGE_MAX_PASSES; pass++) {
      var merge = findMergeCandidate(groupIds);
      if (!merge) break;
      Store.commands.fuseOverlappingWalls(merge.wallAId, merge.wallBId);
      mergedAny = true;
      // Depois de fundir, os ids do grupo podem ter mudado (um lado
      // encolheu, um pedaço pode ter nascido com id novo) — reconhece o
      // MESMO cômodo de novo pela maior sobreposição de ids com o grupo
      // anterior, em vez de assumir que a lista antiga ainda é válida.
      var walls = Store.currentWalls();
      var rooms = Core.detectRooms(walls);
      var bestIds: any = null, bestOverlap = -1;
      rooms.forEach(function (r: any) {
        var ids = Core.findRoomWallIds(walls, r);
        var overlap = ids.filter(function (id) { return groupIds.indexOf(id) !== -1; }).length;
        // Empate de sobreposição: prefere o cômodo com MENOS paredes no
        // total — um cômodo "de verdade" (limpo) e um "borrado" (que
        // engoliu pedaço de um vizinho ainda não fundido) podem pontuar
        // igual aqui, porque as paredes extras do borrado não vêm do
        // grupo original e não contam a favor nem contra. Sem essa
        // regra, o loop podia pegar o cômodo errado no empate e "perder
        // o rastro" do cômodo de verdade, parando cedo demais e
        // deixando outro lado sem fundir.
        if (overlap > bestOverlap || (overlap === bestOverlap && bestIds && ids.length < bestIds.length)) {
          bestOverlap = overlap; bestIds = ids;
        }
      });
      if (!bestIds) break;
      groupIds = bestIds;
    }
    return mergedAny;
  }
  function commitRoomGroupIfNeeded() {
    if (!selectedRoomWallIds) return;
    if (fuseAllOverlaps(selectedRoomWallIds)) {
      hintEl.textContent = 'Paredes fundidas — o trecho compartilhado agora é uma parede só.';
    }
  }

  function onWheel(e: any) {
    e.preventDefault();
    if (e.shiftKey) {
      // Shift + scroll: navega pelo TERRENO — só nos eixos horizontais
      // (X/Z), nunca sobe nem desce, não importa o quanto a câmera esteja
      // inclinada. deltaX anda pros lados (eixo "direita" da câmera, que
      // já é horizontal); deltaY anda pra frente/trás (direção que a
      // câmera olha, projetada no chão — ignora a inclinação vertical).
      var rightX = Math.sin(camAngle), rightZ = -Math.cos(camAngle);
      var fwdX = -Math.cos(camAngle), fwdZ = -Math.sin(camAngle);
      var panSpeed = camDist * 0.0025;
      var mx = e.deltaX * panSpeed, my = -e.deltaY * panSpeed;
      camTarget.x += rightX * mx + fwdX * my;
      camTarget.z += rightZ * mx + fwdZ * my;
      updateCam();
      return;
    }
    var factor = 1 + (e.deltaY > 0 ? 0.1 : -0.1);
    camDist = Math.max(MIN_DIST, Math.min(MAX_DIST, camDist * factor));
    updateCam();
  }

  var pinchStartDist: any = null, pinchStartCamDist = camDist;
  function onTouchStart(e: any) {
    if (e.touches.length === 2) {
      dragMode = null;
      var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy); pinchStartCamDist = camDist;
    }
  }
  function onTouchMove(e: any) {
    if (e.touches.length === 2 && pinchStartDist) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      var newDist = Math.hypot(dx, dy);
      camDist = Math.max(MIN_DIST, Math.min(MAX_DIST, pinchStartCamDist * (pinchStartDist / newDist)));
      updateCam();
    }
  }
  function onTouchEnd(e: any) { if (e.touches.length < 2) pinchStartDist = null; }

  var hoverMarker: any;
  var wallGridOverlay: any; // grade sobre as paredes do pavimento, só na ferramenta Telhado

  // O mesmo indicador do Sims: um cubo verde no alto de uma haste, com
  // uma seta apontando pro chão — mostra exatamente em qual interseção
  // da grade o desenho vai começar, antes mesmo de clicar.
  function buildHoverMarker() {
    var group = new THREE.Group();
    var poleHeight = 1.3;
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, poleHeight, 8),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    pole.position.y = poleHeight / 2 + 0.1;
    group.add(pole);

    var cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      new THREE.MeshBasicMaterial({ color: 0x4CD137 })
    );
    cap.position.y = poleHeight + 0.1;
    group.add(cap);

    var tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.11, 10),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    tip.position.y = 0.05;
    group.add(tip);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.11, 20),
      new THREE.MeshBasicMaterial({ color: 0x4CD137, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    group.add(ring);

    group.visible = false;
    return group;
  }

  // Grade sobre a área das paredes do pavimento (avançando um pouco além
  // delas), visível só com a ferramenta Telhado ativa — dá noção de até
  // onde dá pra arrastar uma borda do telhado pra criar um balanço.
  // Uma grade POR CÔMODO detectado — mesma lógica da calçada/fundação —
  // senão dois cômodos desalinhados formam um retângulo só, cobrindo o
  // recuo entre eles.
  var ROOF_GRID_MARGIN = 1 * Core.GRID; // 1 m além do contorno das paredes
  var roofGridRegions: any[] = []; // últimas regiões computadas (COM a margem), usadas pra travar a prévia fantasma dentro delas

  // Cômodos vizinhos (bounds encostados ou perto o bastante que as
  // margens dos dois se tocariam) viram UMA região só, em vez de uma
  // por cômodo — é isso que permite um telhado nascido sobre um cômodo
  // crescer, arrastando a borda, até cobrir a casa inteira: o limite do
  // arraste (ver dragElementStart.region) passa a ser o contorno do
  // grupo inteiro, não mais o de um cômodo isolado. Cômodos longe uns
  // dos outros (ex.: um edículo separado) continuam em regiões
  // separadas — não vira um grid gigante cobrindo o quintal vazio entre
  // eles.
  function mergeOverlappingBounds(boundsList: any, marginUnits: any) {
    var regions = boundsList.map(function (b: any) {
      return { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY };
    });
    var merged = true;
    while (merged) {
      merged = false;
      for (var i = 0; i < regions.length && !merged; i++) {
        for (var j = i + 1; j < regions.length && !merged; j++) {
          var a = regions[i], b = regions[j];
          var overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
          var overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
          // "perto o bastante pra ser a mesma casa": a folga entre os
          // dois cabe dentro das duas margens somadas (cada cômodo
          // contribui a própria margem de 1 m).
          if (overlapX > -2 * marginUnits && overlapY > -2 * marginUnits) {
            regions.splice(j, 1); regions.splice(i, 1);
            regions.push({
              minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
              minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY)
            });
            merged = true;
          }
        }
      }
    }
    return regions;
  }

  function updateWallGridOverlay() {
    while (wallGridOverlay.children.length) wallGridOverlay.remove(wallGridOverlay.children[0]);
    roofGridRegions = [];
    if (currentTool !== 'telhado') { wallGridOverlay.visible = false; return; }

    var walls = Store.currentWalls(), columns = Store.currentColumns();
    if (!walls.length && !columns.length) { wallGridOverlay.visible = false; return; }

    var rooms = Core.detectRooms(walls);
    var boundsList: any[] = [];
    if (rooms.length) {
      rooms.forEach(function (room) {
        var b = Core.roomModelBounds(room);
        if (b) boundsList.push(b);
      });
      boundsList = mergeOverlappingBounds(boundsList, ROOF_GRID_MARGIN);
    } else {
      // sem cômodo fechado (só colunas, térreo em pilotis) — cai pro
      // contorno geral de paredes + colunas
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      walls.forEach(function (w) {
        [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
          if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
        });
      });
      columns.forEach(function (c) {
        if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
      });
      if (isFinite(minX)) boundsList.push({ minX: minX, maxX: maxX, minY: minY, maxY: maxY });
    }

    var y = currentFloorYOffset() + Scene3DRenderer.WALL_HEIGHT_GETTER() + 0.01;
    var step = Core.SNAP_UNIT / Core.GRID;

    boundsList.forEach(function (b) {
      var minX = b.minX - ROOF_GRID_MARGIN, maxX = b.maxX + ROOF_GRID_MARGIN;
      var minY = b.minY - ROOF_GRID_MARGIN, maxY = b.maxY + ROOF_GRID_MARGIN;
      roofGridRegions.push({ minX: minX, maxX: maxX, minY: minY, maxY: maxY });

      var wMinX = (minX - offsetX) * scale, wMaxX = (maxX - offsetX) * scale;
      var wMinZ = (minY - offsetY) * scale, wMaxZ = (maxY - offsetY) * scale;
      var pts: any[] = [];
      for (var x = wMinX; x <= wMaxX + 1e-6; x += step) pts.push(x, y, wMinZ, x, y, wMaxZ);
      for (var z = wMinZ; z <= wMaxZ + 1e-6; z += step) pts.push(wMinX, y, z, wMaxX, y, z);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      var lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xE23B3B, transparent: true, opacity: 0.65 }));
      wallGridOverlay.add(lines);
    });
    wallGridOverlay.visible = boundsList.length > 0;
  }

  // Acha a região da grade (já com a margem) que contém o ponto dado, ou
  // null se o ponto estiver fora de qualquer uma — usado pra travar a
  // prévia fantasma (e o próprio telhado, ao nascer) dentro do grid.
  function findGridRegionAt(x: any, y: any) {
    for (var i = 0; i < roofGridRegions.length; i++) {
      var r = roofGridRegions[i];
      if (x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY) return r;
    }
    return null;
  }

  // Encaixa um retângulo dentro de uma região, encolhendo se a região for
  // menor que o tamanho padrão nesse eixo, ou só deslizando se couber.
  function clampRectToRegion(x1: any, y1: any, x2: any, y2: any, region: any) {
    var w = x2 - x1, h = y2 - y1;
    var rw = region.maxX - region.minX, rh = region.maxY - region.minY;
    if (w >= rw) { x1 = region.minX; x2 = region.maxX; }
    else {
      if (x1 < region.minX) { x1 = region.minX; x2 = x1 + w; }
      if (x2 > region.maxX) { x2 = region.maxX; x1 = x2 - w; }
    }
    if (h >= rh) { y1 = region.minY; y2 = region.maxY; }
    else {
      if (y1 < region.minY) { y1 = region.minY; y2 = y1 + h; }
      if (y2 > region.maxY) { y2 = region.maxY; y1 = y2 - h; }
    }
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  }


  function updateHoverMarker(clientX: any, clientY: any) {
    // arrastando um elemento existente (redimensionar/mover/girar câmera):
    // aquela prévia já basta, não precisa do indicador junto
    if (dragMode) { hoverMarker.visible = false; return; }

    // ferramenta Telhado: a prévia fantasma do telhado já mostra onde ele
    // nasceria — a setinha de "início" não faz sentido aqui, já que não
    // existe um ponto de início/fim, só "clicou = colocou"
    if (currentTool === 'telhado') { hoverMarker.visible = false; return; }

    // colocando um cômodo/parede (depois do 1º clique): o indicador segue
    // a ponta que o 2º clique vai confirmar — não esconde em cima de
    // paredes existentes, porque aqui QUALQUER clique confirma ali
    if (!placingDraw) {
      var mesh = pickMesh(clientX, clientY);
      if (mesh) { hoverMarker.visible = false; return; } // em cima de algo clicável, não é "início de desenho"
    }

    var gp = getGroundModelPoint(clientX, clientY);
    if (!gp) { hoverMarker.visible = false; return; }

    var snapped = { x: Core.snap(gp.x), y: Core.snap(gp.y) };
    var wp = modelToWorld(snapped.x, snapped.y);
    hoverMarker.position.set(wp.x, currentFloorYOffset(), wp.z);
    hoverMarker.visible = true;
  }

  // ---- Cômodos com nome: nascem instantâneos, tamanho padrão, sem
  // precisar desenhar (clique num botão da barra lateral). Continuam
  // sendo 4 paredes comuns (Store.commands.createRoom) — "Banheiro" não
  // é um tipo de entidade novo, só um atalho de criação com medida
  // pronta. Tamanhos abaixo são um ponto de partida razoável pra uma
  // casa residencial padrão; ajustável depois puxando as paredes.
  var ROOM_PRESETS: Record<string, any> = {
    banheiro: { label: 'Banheiro', widthM: 2.0, depthM: 1.5 },
    cozinha: { label: 'Cozinha', widthM: 3.0, depthM: 3.0 },
    quarto: { label: 'Quarto', widthM: 3.5, depthM: 3.0 },
    sala: { label: 'Sala', widthM: 4.0, depthM: 4.0 },
    garagem: { label: 'Garagem', widthM: 3.0, depthM: 5.5 },
    lavanderia: { label: 'Lavanderia', widthM: 2.0, depthM: 2.0 },
    escritorio: { label: 'Escritório', widthM: 2.8, depthM: 3.0 }
  };
  var ROOM_PLACEMENT_GAP_M = 1; // vão entre um cômodo novo e o que já existe, pra não nascerem grudados/sobrepostos

  // Acha um retângulo livre pro próximo cômodo: se o pavimento está
  // vazio, nasce centralizado na origem; se já tem coisa, nasce
  // encostado à direita de tudo que já existe, com um vão de respiro.
  // Não é um bin-packing esperto — é o suficiente pra nunca nascer em
  // cima de outro cômodo, que é o único requisito real aqui.
  function computeNextRoomSlot(widthM: any, depthM: any) {
    var wPx = widthM * Core.GRID, dPx = depthM * Core.GRID;
    var walls = Store.currentWalls();
    if (!walls.length) {
      var half = wPx / 2, halfD = dPx / 2;
      return { x1: Core.snap(-half), y1: Core.snap(-halfD), x2: Core.snap(half), y2: Core.snap(halfD) };
    }
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    walls.forEach(function (w) {
      [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
    });
    var gapPx = ROOM_PLACEMENT_GAP_M * Core.GRID;
    var x1 = Core.snap(maxX + gapPx), y1 = Core.snap(minY);
    return { x1: x1, y1: y1, x2: Core.snap(x1 + wPx), y2: Core.snap(y1 + dPx) };
  }

  function placeRoomPreset(key: any) {
    if (key === 'varanda') {
      // Mesma lógica de encaixe que um cômodo usa (computeNextRoomSlot)
      // — a varanda "pensa" como se fosse um quarto com quatro paredes
      // invisíveis, encaixando do mesmo jeito ao lado do que já existe.
      // Só que não nasce nenhuma parede — colunas e vigas são só
      // visuais, por isso Store.commands.createVaranda, não createRoom.
      var rectV = computeNextRoomSlot(VARANDA_DEFAULT_W_M, VARANDA_DEFAULT_D_M);
      deselect();
      var newVaranda = Store.commands.createVaranda(rectV.x1, rectV.y1, rectV.x2, rectV.y2, 'minZ');
      if (newVaranda) selectVaranda(newVaranda.id);
      hintEl.textContent = 'Varanda criada — arraste as bordas se quiser ajustar o tamanho. Clique direito nela pra girar qual lado é a frente.';
      return;
    }
    var preset = ROOM_PRESETS[key];
    if (!preset) return;
    var rect = computeNextRoomSlot(preset.widthM, preset.depthM);
    deselect();
    Store.commands.createRoom(rect.x1, rect.y1, rect.x2, rect.y2);
    hintEl.textContent = preset.label + ' criado(a) — arraste as paredes se quiser ajustar a posição ou o tamanho.';
  }

  function flashDisabledHint(label: any) {
    hintEl.textContent = label + ' ainda não está disponível nesta versão do protótipo.';
  }

  export function init(opts: { container: HTMLElement; camera: THREE.Camera; scene: THREE.Scene; renderer: THREE.WebGLRenderer }) {
    container = opts.container; camera = opts.camera; scene = opts.scene; renderer = opts.renderer;
    gizmoEl = document.getElementById('wallGizmo');
    openingGizmoEl = document.getElementById('openingGizmo');
    roomGizmoEl = document.getElementById('roomGizmo');
    layersContextMenuEl = document.getElementById('layersContextMenu');
    columnShapePanelEl = document.getElementById('columnShapePanel');
    roofTypePanelEl = document.getElementById('roofTypePanel');
    finishPanelEl = document.getElementById('finishPanel');
    paintPickerPanelEl = document.getElementById('paintPickerPanel');
    objectPanelEl = document.getElementById('objectPanel');
    objectPanelTitleEl = document.getElementById('objectPanelTitle');
    objectPanelBodyEl = document.getElementById('objectPanelBody');
    hintEl = document.getElementById('viewportHint');
    dimLabelAEl = document.getElementById('dimLabelA');
    dimLabelBEl = document.getElementById('dimLabelB');
    dimCotaLayerEl = document.getElementById('dimCotaLayer');

    // A barra lateral fica DENTRO do #viewport (pedido explícito), mas
    // ela não pode deixar o clique "vazar" pro raycaster do 3D por trás
    // — sem isso, clicar num botão também desenha uma parede/cômodo no
    // grid, porque o pointerdown do container escuta em qualquer clique
    // dentro dele, botão incluso.
    var toolSidebarEl = document.getElementById('toolSidebar');
    if (toolSidebarEl) toolSidebarEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });

    hoverMarker = buildHoverMarker();
    scene.add(hoverMarker);

    wallGridOverlay = new THREE.Group();
    wallGridOverlay.visible = false;
    scene.add(wallGridOverlay);

    document.getElementById('objectPanelClose')!.addEventListener('click', function () { closeObjectPanel(); render(); });
    objectPanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    objectPanelEl.addEventListener('pointerup', function (e: any) { e.stopPropagation(); });
    columnShapePanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    columnShapePanelEl.addEventListener('click', function (e: any) {
      var btn = e.target.closest('button.sp');
      if (!btn || !selectedColumnId) return;
      Store.commands.setColumnShape(selectedColumnId, btn.dataset.shape);
    });
    roofTypePanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    roofTypePanelEl.addEventListener('click', function (e: any) {
      var btn = e.target.closest('button.rt');
      if (!btn || !selectedRoofId) return;
      Store.commands.setRoofPieceType(selectedRoofId, btn.dataset.rooftype);
    });
    finishPanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    finishPanelEl.addEventListener('click', function (e: any) {
      var btn = e.target.closest('button.fn');
      if (!btn) return;
      var productId = btn.dataset.product;
      if (selectedRoofId) { Store.commands.setRoofFinish(selectedRoofId, productId); return; }
      if (selectedWallId && btn.dataset.face) { Store.commands.setWallFinishFace(selectedWallId, btn.dataset.face, productId); return; }
      if (btn.dataset.roomKey) { Store.commands.setRoomFinish(btn.dataset.roomKey, productId); return; }
    });
    paintPickerPanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    paintPickerPanelEl.addEventListener('click', function (e: any) {
      var btn = e.target.closest('button.fn');
      if (!btn) return;
      currentPaintProductId = btn.dataset.product;
      refreshPaintPickerPanel();
    });
    gizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    openingGizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    roomGizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    layersContextMenuEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    layersContextMenuEl.addEventListener('contextmenu', function (e: any) { e.preventDefault(); });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn: any) {
      btn.addEventListener('click', function () {
        // Clicar na ferramenta já ativa desativa ela (volta pro modo
        // seleção, sem ferramenta nenhuma) — em vez de ficar preso nela
        // até escolher outra.
        setTool(currentTool === btn.dataset.tool ? null : btn.dataset.tool);
      });
    });
    document.querySelectorAll('[data-room-preset]').forEach(function (btn: any) {
      btn.addEventListener('click', function () { placeRoomPreset(btn.dataset.roomPreset); });
    });
    document.querySelectorAll('[data-disabled-label]').forEach(function (btn: any) {
      btn.addEventListener('click', function () { flashDisabledHint(btn.dataset.disabledLabel); });
    });

    container.addEventListener('contextmenu', function (e: any) { e.preventDefault(); });
    window.addEventListener('keydown', function (e: any) {
      if (e.key === 'Escape' && placingDraw) cancelPlacing();
      if (e.key === 'Escape') hideLayersMenu();
    });
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointermove', function (e: any) { updateHoverMarker(e.clientX, e.clientY); });
    container.addEventListener('pointerleave', function () { hoverMarker.visible = false; });
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    updateCam();
  }

  export function getSelectedWallId() { return selectedWallId; }
  export function getSelectedColumnId() { return selectedColumnId; }
  export function getSelectedRoofId() { return selectedRoofId; }
  export function getSelectedOpeningId() { return selectedOpeningId; }
  export function getSelectedVarandaId() { return selectedVarandaId; }
  export function getSelectedRoomWallIds() { return selectedRoomWallIds; }

// Namespace de compatibilidade — mesma razão de Core.ts/Store.ts/Catalog.ts/
// Scene3DRenderer.ts (chamadas ViewportController.xxx no código legado).
export const ViewportController = {
  init, render, onModelChanged, deselect,
  select, selectColumn, selectRoof, selectOpening, selectVaranda,
  getSelectedWallId, getSelectedColumnId, getSelectedRoofId,
  getSelectedOpeningId, getSelectedVarandaId, getSelectedRoomWallIds,
  toggleDimensions,
  repositionDimensions: repositionDimensionCotas
};
