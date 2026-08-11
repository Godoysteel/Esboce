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
import { touchCameraAnchor, updateTouchCamera, type TouchCameraAnchor } from './TouchCamera.js';
import {
  analyzeWallResize,
  cloneWallsForDiagnostics,
  findNewDegenerateWallResidues,
  formatWallDiagnosticReport,
  isWallResizeReportBlocking,
  type WallResizeDiagnosticReport,
} from './WallDiagnostics.js';


  var container: any, camera: any, scene: any, renderer: any;
  var raycaster = new THREE.Raycaster();
  var dimensionRaycaster = new THREE.Raycaster();
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
  var currentPaintSurface: any = null;
  var selectedPaintRoomKey: any = null;
  var floorFinishScale = 1;
  var floorFinishRotation = 0;
  var selectedWallId: any = null, selectedColumnId: any = null, selectedRoofId: any = null, selectedOpeningId: any = null, selectedVarandaId: any = null, selectedLajeId: any = null, selectedFurnitureId: any = null, selectedGlazingPanelId: any = null;
  var selectedRoomWallIds: any = null; // cômodo isolado selecionado como módulo; após qualquer junção o clique volta a ser individual
  var resizeWallId: any = null; // parede em modo de deslocamento perpendicular, iniciado no primeiro clique/arraste
  var gizmoMenuOpen = false;
  var highlightedCategory: any = null; // categoria "de outro andar" ou sem seleção individual (fundação, laje...)

  var downButton: any = null, downPos: any = null;
  var dragMode: any = null; // 'orbit' | 'endpoint1' | 'endpoint2' | 'wallBody' | 'columnBody' | 'roofRidge' | 'openingSlide'
  var placingDraw = false; // true entre o 1º e o 2º clique de Cômodo/Parede
  var drawStart: any = null, drawPreview: any = null;
  var dragElementStart: any = null, dragGroundStart: any = null;
  // Painel de Envidraçamento em arraste (DEC-56, correção de
  // performance): referência DIRETA ao mesh Three.js do painel sendo
  // arrastado — durante o pointermove, move só ESSE objeto (mutação
  // local, sem passar pelo Store), evitando reconstruir a cena inteira
  // dezenas de vezes por segundo. O Store só é atualizado UMA VEZ, ao
  // soltar o mouse.
  var glazingPanelDragMesh: any = null;
  // Prévia incremental do arraste de um cômodo isolado. Guardamos os
  // objetos 3D recém-reconstruídos pela seleção e movemos somente suas
  // transforms durante o pointermove. A geometria persistida continua
  // intacta até o pointerup, quando o Store recebe o delta final uma vez.
  var roomGroupDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var furnitureDragObject: any = null;
  var columnDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var lajeDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var roofGroupDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var roofResizePreviewMeshes: THREE.Object3D[] = [];
  var roofResizeHiddenObjects: THREE.Object3D[] = [];
  var pendingRoofAttic = false;
  var pendingGenerateRoofId: any = null;
  var generateAtticBtnEl: any = null;
  var pendingRoofType = 'duasAguas'; // tipo do próximo telhado a ser colocado
  var ROOF_DEFAULT_SIZE = 3 * Core.GRID; // 3m — tamanho inicial ao clicar pra colocar
  var VARANDA_DEFAULT_W_M = 3, VARANDA_DEFAULT_D_M = 2; // 3m x 2m — mesma escala de um cômodo comum
  var LAJE_DEFAULT_SIZE_M = 4; // usado só quando o pavimento está vazio (sem parede nenhuma pra "copiar" o contorno)
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
  var touchCameraMode = false;

  var gizmoEl: any, gzSwapBtnEl: any, openingGizmoEl: any, roomGizmoEl: any, columnShapePanelEl: any, roofTypePanelEl: any, finishPanelEl: any, paintPickerPanelEl: any, objectPanelEl: any, objectPanelTitleEl: any, objectPanelBodyEl: any, hintEl: any, layersContextMenuEl: any;
  var terrenoModalOverlayEl: any, terrenoLarguraInputEl: any, terrenoComprimentoInputEl: any, terrenoErrorEl: any;
  var dimLabelAEl: any, dimLabelBEl: any, liveRoomDimensionLineEl: any, liveRoomDimensionLineBEl: any;
  // Cotas persistentes de largura/altura de parede (ligar/desligar) —
  // ver rebuildDimensionCotas mais abaixo. Diferente do dimLabelA/B
  // (que só aparece durante o arraste de criação), essas ficam na tela
  // o tempo todo enquanto ativas, então vivem numa camada própria
  // (dimCotaLayerEl) em vez de dois elementos fixos.
  var dimensionsVisible = false;
  var dimCotaLayerEl: any;
  var dimCotaEntries: any[] = [];
  var wallDiagnosticsVisible = false;
  var wallDiagnosticsPanelEl: any;
  var wallDiagnosticsOutputEl: any;

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
    arco: 'Clique sobre uma parede pra abrir um vão ali — sacada, garagem, conceito aberto. Selecione um arco colocado pra arrastar os lados ou o topo.',
    varanda: 'Clique no chão pra colocar uma varanda. Selecione uma já colocada, clique direito nela pra girar qual lado é a frente ou excluir.',
    demolish: 'Clique numa parede pra quebrar ela. Os cantos vizinhos se fecham sozinhos, sem deixar vão.',
    paintBucket: 'Escolha a superfície no menu acima e siga o fluxo indicado para aplicar o acabamento.',
    terreno: 'Clique num lado destacado do retângulo pra adicionar ou remover o muro daquele lado.'
  };

  function modelToWorld(mx: any, my: any) { return { x: (mx - offsetX) * scale, z: (my - offsetY) * scale }; }

  function collectRoomGroupDragObjects(wallIds: string[], furnitureSnapshots: any[]) {
    var wallSet: { [id: string]: boolean } = {};
    wallIds.forEach(function (id) { wallSet[id] = true; });
    var furnitureSet: { [id: string]: boolean } = {};
    (furnitureSnapshots || []).forEach(function (f: any) { furnitureSet[f.id] = true; });
    var roomKey = wallIds.slice().sort().join(',');
    var seen: any[] = [];
    roomGroupDragObjects = [];

    scene.children.forEach(function (object: any) {
      var data = object.userData || {};
      var belongs = !!(data.wallId && wallSet[data.wallId]);
      if (!belongs && data.openingId) {
        var opening = Store.findOpening(data.openingId);
        belongs = !!(opening && wallSet[opening.wallId]);
      }
      if (!belongs && data.glazingPanelId) {
        var panel = Store.findGlazingPanel(data.glazingPanelId);
        belongs = !!(panel && panel.wallId && wallSet[panel.wallId]);
      }
      if (!belongs && data.roomKey === roomKey) belongs = true;
      if (!belongs && data.furnitureId && furnitureSet[data.furnitureId]) belongs = true;
      if (!belongs || seen.indexOf(object) !== -1) return;
      seen.push(object);
      roomGroupDragObjects.push({ object: object, startX: object.position.x, startZ: object.position.z });
    });
  }

  function previewRoomGroupDelta(dx: number, dy: number) {
    var worldDx = dx * scale, worldDz = dy * scale;
    roomGroupDragObjects.forEach(function (entry) {
      entry.object.position.x = entry.startX + worldDx;
      entry.object.position.z = entry.startZ + worldDz;
    });
  }

  function findGlazingPanelSceneObject(id: string) {
    return scene.children.find(function (object: any) {
      return object.userData && object.userData.glazingPanelId === id;
    }) || null;
  }

  function findFurnitureSceneObject(id: string) {
    return scene.children.find(function (object: any) {
      return object.userData && object.userData.furnitureId === id;
    }) || null;
  }

  function collectColumnDragObjects(id: string) {
    columnDragObjects = scene.children.filter(function (object: any) {
      return object.userData && object.userData.columnId === id;
    }).map(function (object: any) {
      return { object: object, startX: object.position.x, startZ: object.position.z };
    });
  }

  function collectLajeDragObjects(id: string) {
    lajeDragObjects = scene.children.filter(function (object: any) {
      var data = object.userData || {};
      return data.lajeId === id || (typeof data.handle === 'string' && data.handle.indexOf('lajeEdge') === 0);
    }).map(function (object: any) {
      return { object: object, startX: object.position.x, startZ: object.position.z };
    });
  }

  function previewLajeDelta(dx: number, dy: number) {
    var worldDx = dx * scale, worldDz = dy * scale;
    lajeDragObjects.forEach(function (entry) {
      entry.object.position.x = entry.startX + worldDx;
      entry.object.position.z = entry.startZ + worldDz;
    });
  }

  function collectRoofGroupDragObjects(roofIds: string[], selectedId: string) {
    var roofSet: { [id: string]: boolean } = {};
    roofIds.forEach(function (id) { roofSet[id] = true; });
    roofGroupDragObjects = scene.children.filter(function (object: any) {
      var data = object.userData || {};
      return !!(data.roofId && roofSet[data.roofId]) || data.roofHandleForId === selectedId;
    }).map(function (object: any) {
      return { object: object, startX: object.position.x, startZ: object.position.z };
    });
  }

  function previewRoofGroupDelta(dx: number, dy: number) {
    var worldDx = dx * scale, worldDz = dy * scale;
    roofGroupDragObjects.forEach(function (entry) {
      entry.object.position.x = entry.startX + worldDx;
      entry.object.position.z = entry.startZ + worldDz;
    });
  }

  function beginRoofResizePreview(roofId: string) {
    roofResizeHiddenObjects = scene.children.filter(function (object: any) {
      return object.userData && object.userData.roofId === roofId;
    });
    roofResizeHiddenObjects.forEach(function (object) { object.visible = false; });
  }

  function clearRoofResizePreview() {
    roofResizePreviewMeshes.forEach(function (object: any) {
      scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      var materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(function (material: any) { if (material && material.dispose) material.dispose(); });
    });
    roofResizePreviewMeshes = [];
    roofResizeHiddenObjects.forEach(function (object) { object.visible = true; });
    roofResizeHiddenObjects = [];
  }

  function previewRoofResize(bounds: { x1: number; y1: number; x2: number; y2: number }) {
    var roof = Store.findRoof(selectedRoofId);
    if (!roof) return;
    clearRoofResizePreview();
    beginRoofResizePreview(roof.id);
    var previewRoof = Object.assign({}, roof, bounds);
    var floorTopY = currentFloorYOffset() + (roof.atticMode ? (roof.baseHeightM || 1.2) : Scene3DRenderer.WALL_HEIGHT_GETTER());
    roofResizePreviewMeshes = Scene3DRenderer.createRoofResizePreviewMeshes(previewRoof, scale, offsetX, offsetY, floorTopY);
    roofResizePreviewMeshes.forEach(function (object) { scene.add(object); });
  }

  // Centro do painel de Envidraçamento em coordenadas de MODELO (antes
  // de modelToWorld) — solto (preview) usa x/y diretos; anexado
  // (attached) deriva do ponto a offsetM metros ao longo da parede
  // hospedeira, mesma matemática usada em buildOpeningPieces.
  function glazingPanelModelCenter(panel: any) {
    if (panel.state === 'attached' && panel.wallId) {
      var w = Store.findWall(panel.wallId);
      if (w) {
        var dxW = w.x2 - w.x1, dyW = w.y2 - w.y1;
        var lenW = Math.hypot(dxW, dyW) || 1e-6;
        var uxW = dxW / lenW, uyW = dyW / lenW;
        var offsetModel = (panel.offsetM || 0) * Core.GRID;
        return { x: w.x1 + uxW * offsetModel, y: w.y1 + uyW * offsetModel };
      }
    }
    return { x: panel.x || 0, y: panel.y || 0 };
  }
  function worldToModel(wx: any, wz: any) { return { x: wx / scale + offsetX, y: wz / scale + offsetY }; }

  function showWallDiagnostic(report: WallResizeDiagnosticReport) {
    if (!wallDiagnosticsVisible || !wallDiagnosticsPanelEl || !wallDiagnosticsOutputEl) return;
    wallDiagnosticsPanelEl.classList.remove('ok', 'warning', 'error');
    wallDiagnosticsPanelEl.classList.add(report.severity);
    wallDiagnosticsOutputEl.textContent = formatWallDiagnosticReport(report);
  }

  function addWallCrossingPrevention(report: WallResizeDiagnosticReport, blockingWallId: string | null) {
    if (!blockingWallId) return report;
    report.issues.push({
      code: 'WALL-CROSSING-PREVENTED',
      message: 'O movimento parou antes de atravessar outra parede.',
      wallIds: [report.wallId, blockingWallId]
    });
    if (report.severity === 'ok') report.severity = 'warning';
    return report;
  }

  export function toggleWallDiagnostics() {
    wallDiagnosticsVisible = !wallDiagnosticsVisible;
    if (wallDiagnosticsPanelEl) wallDiagnosticsPanelEl.classList.toggle('visible', wallDiagnosticsVisible);
    return wallDiagnosticsVisible;
  }

  // Botão "Orbit" do painel de visualização (canto direito) — volta a
  // câmera pro enquadramento padrão (mesmo ângulo/distância/alvo do
  // carregamento inicial). Não é uma troca de MODO de navegação (o
  // right-click+arraste já orbita a câmera o tempo todo, sempre foi
  // assim) — é só um "recentralizar", útil depois de a pessoa se
  // perder num zoom/pan extremo.
  export function resetCamera(): void {
    camAngle = Math.PI / 4;
    camElev = 0.6;
    camDist = 13;
    camTarget.x = 0;
    camTarget.y = 0;
    camTarget.z = 0;
    updateCam();
  }

  var onZoomChangedCb: ((percent: number) => void) | null = null;

  function updateCam() {
    camera.position.set(
      camTarget.x + camDist * Math.cos(camAngle) * Math.cos(camElev),
      camTarget.y + camDist * Math.sin(camElev),
      camTarget.z + camDist * Math.sin(camAngle) * Math.cos(camElev)
    );
    camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
    NavGizmo.update(camAngle, camElev);
    if (onZoomChangedCb) onZoomChangedCb(getZoomPercent());
  }

  // Zoom da barra inferior (canto direito: "− 100% +"). "100%" é uma
  // convenção nossa, não uma medida óptica real — é só camDist no
  // valor padrão (13, o mesmo de resetCamera) mapeado pra 100; menos
  // distância = mais zoom = percentual maior. onZoomChangedCb dispara
  // a cada updateCam (arraste, roda do mouse, pinch, botão — todos
  // passam por aqui), então o rótulo na barra acompanha em tempo real
  // mesmo quando o zoom muda por gesto, não só pelo botão.
  var ZOOM_REFERENCE_DIST = 13;
  export function getZoomPercent(): number {
    return Math.round((ZOOM_REFERENCE_DIST / camDist) * 100);
  }
  export function zoomIn(): void {
    camDist = Math.max(MIN_DIST, camDist * 0.85);
    updateCam();
  }
  export function zoomOut(): void {
    camDist = Math.min(MAX_DIST, camDist * 1.15);
    updateCam();
  }
  export function setOnZoomChanged(cb: (percent: number) => void): void {
    onZoomChangedCb = cb;
    cb(getZoomPercent());
  }

  // Botão "Visualização" da barra inferior — mesmo menu de camadas
  // que já existia (clique direito em área vazia), só que com um
  // segundo jeito de abrir, descobrível, sem precisar saber do
  // atalho de clique direito. Alterna: se já está aberto, fecha.
  export function toggleLayersMenuAtElement(anchor: HTMLElement): void {
    if (layersContextMenuEl && layersContextMenuEl.classList.contains('visible')) {
      hideLayersMenu();
      return;
    }
    var rect = anchor.getBoundingClientRect();
    showLayersMenu(rect.left, rect.top);
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
    // Piso/soleira também usam a categoria 'laje' (mesmo tag visual,
    // ver tagCategory nesses casos) e continuam de fora do hit-test:
    // são superfícies horizontais na altura do plano de desenho do
    // pavimento de cima, e sempre atrapalhariam o clique-e-arraste ali
    // — a visibilidade deles já é controlada pelo painel de camadas,
    // não precisa ser clicável aqui. Mas a Laje de VERDADE (objeto
    // colocável — ver DEC-35) tem lajeId marcado e PRECISA ser
    // clicável, senão não dá pra selecionar nem excluir ela depois de
    // colocada.
    var targets = scene.children.filter(function (o: any) {
      return o.isMesh && o.userData && o.userData.category && (o.userData.category !== 'laje' || o.userData.lajeId);
    });
    var hits = raycaster.intersectObjects(targets, false);
    var best = hits.length ? hits[0] : null;
    // Móvel é um grupo glTF (várias malhas aninhadas, não um único
    // Mesh direto em scene.children) — precisa de um raycast recursivo
    // à parte, resolvido pro grupo-pai que carrega o furnitureId (ver
    // Scene3DRenderer.buildFurniturePiece).
    var furnitureHits = raycaster.intersectObjects(Scene3DRenderer.getFurnitureMeshes(), true);
    if (furnitureHits.length && (!best || furnitureHits[0]!.distance < best.distance)) {
      var node: any = furnitureHits[0]!.object;
      while (node && !node.userData.furnitureId) node = node.parent;
      if (node) return node;
    }
    return best ? best.object : null;
  }

  // Mesma coisa que pickMesh, mas devolve o hit completo (com o ponto
  // 3D exato do clique) — a lata de tinta precisa disso pra saber QUAL
  // lado da parede foi clicado (a caixa de referência que recebe o
  // clique cobre os dois lados, ver comentário em buildWallMeshFromFootprint).
  function pickMeshHit(clientX: any, clientY: any) {
    var rect = container.getBoundingClientRect();
    var mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    var targets = scene.children.filter(function (o: any) {
      return o.isMesh && o.userData && o.userData.category &&
        (o.userData.category !== 'laje' || (currentTool === 'paintBucket' && (currentPaintSurface === 'floors' || currentPaintSurface === 'ceilings')));
    });
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
    return mesh.userData.category === 'paredesTerreo' || mesh.userData.category === 'paredesSuperiores' || mesh.userData.category === 'colunas' || mesh.userData.category === 'telhado' || mesh.userData.category === 'aberturas' || mesh.userData.category === 'varanda' || mesh.userData.category === 'furniture' || mesh.userData.category === 'glazingPanel' || !!mesh.userData.lajeId;
  }

  function select(wallId: any) {
    selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedWallId = wallId; gizmoMenuOpen = false;
    if (DEBUG_COLOR_MODE && wallId) hintEl.textContent = 'Debug — parede selecionada: ' + wallId;
    render();
  }
  function selectColumn(columnId: any) { selectedWallId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedColumnId = columnId; gizmoMenuOpen = false; render(); }
  function selectRoof(roofId: any) { selectedWallId = null; selectedColumnId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedRoofId = roofId; gizmoMenuOpen = false; render(); }

  function connectedRoofIds(startId: any) {
    var selected = Store.findRoof(startId);
    if (!selected || !selected.compoundGroupId) return [startId];
    return Store.currentRoofs().filter(function (roof) {
      return roof.compoundGroupId === selected!.compoundGroupId;
    }).map(function (roof) { return roof.id; });
  }

  function roofCompoundCandidateIds(startId: any) {
    var roofs = Store.currentRoofs();
    var found: any[] = [startId], queue: any[] = [startId];
    while (queue.length) {
      var current = Store.findRoof(queue.shift());
      if (!current) continue;
      roofs.forEach(function (candidate) {
        if (found.indexOf(candidate.id) !== -1 || candidate.ridgeAxis === current!.ridgeAxis) return;
        if (Core.rectsNearby(current!, candidate, Core.SNAP_UNIT)) {
          found.push(candidate.id); queue.push(candidate.id);
        }
      });
    }
    return found;
  }
  // "Agarra" o cômodo inteiro (clique único numa parede que fecha só um
  // cômodo) — sem seleção de parede individual, sem gizmo de parede.
  function selectRoomGroup(wallIds: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedRoomWallIds = wallIds; gizmoMenuOpen = false; render(); }
  // Porta/janela: gizmo próprio (deslizar/excluir), sempre visível assim
  // que seleciona — diferente de parede/coluna/telhado, não precisa de
  // um segundo clique (clique direito) pra "abrir o menu", porque não
  // existe aqui a ambiguidade de "agarrar o cômodo inteiro" que motivou
  // aquele gesto extra nos outros tipos.
  function selectOpening(openingId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedOpeningId = openingId; gizmoMenuOpen = false; render(); }
  // Varanda: mesmo padrão do telhado (clique seleciona, clique direito
  // de novo abre o menu com girar/excluir).
  function selectVaranda(varandaId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedVarandaId = varandaId; gizmoMenuOpen = false; render(); }
  // Laje: mesmo padrão da varanda — clique seleciona, arraste livre nas
  // bordas (nunca trava em contorno de parede — ver DEC-35).
  function selectLaje(lajeId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedLajeId = lajeId; gizmoMenuOpen = false; render(); }

  function selectGlazingPanel(glazingPanelId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = glazingPanelId; gizmoMenuOpen = false; render(); }
  // Móvel: mesmo padrão da coluna (clique seleciona e já mostra o gizmo
  // completo — girar/duplicar/excluir — sem precisar de segundo clique).
  function selectFurniture(furnitureId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedGlazingPanelId = null; selectedFurnitureId = furnitureId; gizmoMenuOpen = false; render(); }
  function deselect() {
    commitRoomGroupIfNeeded(); // "clicou fora do objeto" — decide agora se funde
    var leavingRoof = selectedRoofId ? Store.findRoof(selectedRoofId) : null;
    if (leavingRoof && leavingRoof.atticMode === 'preview') pendingGenerateRoofId = leavingRoof.id;
    selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null;
    if (generateAtticBtnEl) generateAtticBtnEl.classList.toggle('visible', !!pendingGenerateRoofId);
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

  function dimensionPointIsVisible(entry: any) {
    var target = new THREE.Vector3(entry.x, entry.y, entry.z);
    var projected = target.clone().project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return false;
    var direction = target.clone().sub(camera.position);
    var targetDistance = direction.length();
    if (targetDistance < 1e-6) return true;
    direction.normalize();
    dimensionRaycaster.set(camera.position, direction);
    dimensionRaycaster.far = targetDistance;
    var blockers: THREE.Object3D[] = [];
    scene.traverse(function (object: any) {
      if (!object.isMesh || !object.visible || !object.userData || !object.userData.category) return;
      var material = object.material;
      if (material && material.transparent && material.opacity < 0.35) return;
      blockers.push(object);
    });
    var hit = dimensionRaycaster.intersectObjects(blockers, false)[0];
    // A própria parede da cota pode estar alguns centímetros antes do
    // ponto central. A tolerância aceita essa face, mas não uma parede
    // distinta situada entre a câmera e a medida.
    return !hit || hit.distance >= targetDistance - 0.22;
  }

  // Chamada a cada frame do loop de animação (ver animate() no fim do
  // arquivo) — só projeta em tela, não recalcula nada do modelo, então
  // é barato mesmo rodando 60x/s; sai de imediato se a camada estiver
  // vazia/desligada.
  function repositionDimensionCotas() {
    if (!dimensionsVisible || !dimCotaEntries.length) return;
    dimCotaEntries.forEach(function (entry) {
      var visible = dimensionPointIsVisible(entry);
      entry.el.style.display = visible ? 'block' : 'none';
      if (!visible) return;
      positionFloatingPanel(entry.el, entry.x, entry.y, entry.z, 0);
    });
  }

  function toggleDimensions() {
    dimensionsVisible = !dimensionsVisible;
    rebuildDimensionCotas();
    return dimensionsVisible;
  }

  function findLiveRoomDimensions(wall: any) {
    var walls = Store.currentWalls();
    var ux = wall.x2 - wall.x1, uy = wall.y2 - wall.y1;
    var wallLen = Math.hypot(ux, uy);
    if (wallLen < 1e-6) return [];
    ux /= wallLen; uy /= wallLen;
    var nx = -uy, ny = ux;
    var wallMidX = (wall.x1 + wall.x2) / 2, wallMidY = (wall.y1 + wall.y2) / 2;
    var owners = Core.detectRooms(walls).filter(function (room) {
      return Core.findRoomWallIds(walls, room).indexOf(wall.id) !== -1;
    });
    if (!owners.length) return [];
    function tangentRange(w: any) {
      var a = w.x1 * ux + w.y1 * uy, b = w.x2 * ux + w.y2 * uy;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    return owners.map(function (room) {
      var ids = Core.findRoomWallIds(walls, room);
      var opposite: any = null, bestDistance = Infinity;
      ids.forEach(function (id) {
        if (id === wall.id) return;
        var candidate = Store.findWall(id); if (!candidate) return;
        var cx = candidate.x2 - candidate.x1, cy = candidate.y2 - candidate.y1;
        var clen = Math.hypot(cx, cy); if (clen < 1e-6) return;
        if (Math.abs((cx / clen) * uy - (cy / clen) * ux) > 0.01) return;
        var candidateMidX = (candidate.x1 + candidate.x2) / 2, candidateMidY = (candidate.y1 + candidate.y2) / 2;
        var distance = Math.abs((candidateMidX - wallMidX) * nx + (candidateMidY - wallMidY) * ny);
        if (distance < bestDistance) { bestDistance = distance; opposite = candidate; }
      });
      if (!opposite) return null;
      var rangeA = tangentRange(wall), rangeB = tangentRange(opposite);
      var overlapMin = Math.max(rangeA.min, rangeB.min), overlapMax = Math.min(rangeA.max, rangeB.max);
      if (overlapMax <= overlapMin) return null;
      var tangentMid = (overlapMin + overlapMax) / 2;
      function pointOnWall(w: any) {
        var baseT = w.x1 * ux + w.y1 * uy;
        return { x: w.x1 + ux * (tangentMid - baseT), y: w.y1 + uy * (tangentMid - baseT) };
      }
      var a = pointOnWall(wall), b = pointOnWall(opposite);
      return { a: a, b: b, clearMeters: Math.max(0, (Math.hypot(b.x - a.x, b.y - a.y) - Core.WALL_THICK) / Core.GRID) };
    }).filter(Boolean).slice(0, 2);
  }

  function positionLiveRoomDimension(lineEl: any, a: any, b: any, y: number) {
    var wa = modelToWorld(a.x, a.y), wb = modelToWorld(b.x, b.y);
    var va = new THREE.Vector3(wa.x, y, wa.z).project(camera);
    var vb = new THREE.Vector3(wb.x, y, wb.z).project(camera);
    var rect = container.getBoundingClientRect();
    var ax = (va.x + 1) / 2 * rect.width, ay = (1 - va.y) / 2 * rect.height;
    var bx = (vb.x + 1) / 2 * rect.width, by = (1 - vb.y) / 2 * rect.height;
    lineEl.style.left = ax + 'px';
    lineEl.style.top = ay + 'px';
    lineEl.style.width = Math.hypot(bx - ax, by - ay) + 'px';
    lineEl.style.transform = 'rotate(' + Math.atan2(by - ay, bx - ax) + 'rad)';
    lineEl.style.display = 'block';
  }

  function positionGizmoAndShapePanel() {
    // Botão "Trocar" só faz sentido pra móvel (é o único caso com
    // categoria de produto trocável no catálogo por enquanto) —
    // escondido por padrão, cada branch abaixo decide se mostra.
    if (gzSwapBtnEl) gzSwapBtnEl.style.display = 'none';
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

    // Painel de Envidraçamento (DEC-56): mesmo raciocínio da esquadria/
    // cômodo agrupado — gizmo próprio, só fechar/excluir, sempre
    // visível (sem a ambiguidade de "abrir menu"). Reaproveita
    // roomGizmoEl (mesmo elemento do cômodo agrupado — nunca os dois
    // selecionados ao mesmo tempo).
    if (selectedGlazingPanelId) {
      var gpSel = Store.findGlazingPanel(selectedGlazingPanelId);
      if (!gpSel) {
        selectedGlazingPanelId = null;
        roomGizmoEl.classList.remove('visible');
      } else {
        var centerG = glazingPanelModelCenter(gpSel);
        var wpG = modelToWorld(centerG.x, centerG.y);
        var topYG = currentFloorYOffset() + (gpSel.sillHeightM || 0) + gpSel.heightM + 0.15;
        positionFloatingPanel(roomGizmoEl, wpG.x, topYG, wpG.z, 0);
        roomGizmoEl.classList.add('visible');
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible');
      return;
    }
    roomGizmoEl.classList.remove('visible');

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

    if (selectedLajeId) {
      var lG = Store.findLaje(selectedLajeId);
      if (!lG) { selectedLajeId = null; gizmoEl.classList.remove('visible'); return; }
      var lGcx = 0, lGcy = 0;
      lG.points.forEach(function (p: any) { lGcx += p.x; lGcy += p.y; });
      lGcx /= lG.points.length; lGcy /= lG.points.length;
      var midL = modelToWorld(lGcx, lGcy);
      positionFloatingPanel(gizmoEl, midL.x, yOffset + Scene3DRenderer.WALL_HEIGHT_GETTER() + 0.4, midL.z, 0);
      gizmoEl.classList.add('visible');
      return;
    }

    // Móvel: mesmo padrão da varanda (girar/duplicar/excluir no gizmo
    // genérico reaproveitado, sem painel extra próprio).
    if (selectedFurnitureId) {
      var fItem = Store.findFurniture(selectedFurnitureId);
      if (!fItem) { selectedFurnitureId = null; selectedGlazingPanelId = null; gizmoEl.classList.remove('visible'); return; }
      var midF = modelToWorld(fItem.x, fItem.y);
      positionFloatingPanel(gizmoEl, midF.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), midF.z, 0);
      gizmoEl.classList.add('visible');
      if (gzSwapBtnEl) gzSwapBtnEl.style.display = '';
      return;
    }

    if (!selectedWallId) { gizmoEl.classList.remove('visible'); return; }
    var w = Store.findWall(selectedWallId);
    if (!w) { selectedWallId = null; gizmoEl.classList.remove('visible'); return; }
    var mid = modelToWorld((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2);
    positionFloatingPanel(gizmoEl, mid.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), mid.z, 0);
    gizmoEl.classList.add('visible');
  }

  function renderFinishSwatches(category: any, currentProductId: any) {
    finishPanelEl.innerHTML = '';
    Catalog.getProductsByCategory(category).forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'fn' + (p.id === currentProductId ? ' active' : '');
      btn.title = p.name;
      btn.style.background = p.assets.colorHex;
      btn.dataset.product = p.id;
      finishPanelEl.appendChild(btn);
    });
  }

  // Painel de acabamento contextual. A pintura de paredes pertence
  // exclusivamente à ferramenta paintBucket e à sua paleta fixa; uma
  // seleção comum de parede/cômodo nunca deve exibir cores. O painel
  // contextual permanece apenas para materiais de telhado.
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
    finishPanelEl.classList.remove('visible');
  }

  // Cota ao vivo enquanto arrasta — mesma ideia do "readout" do Sims: ao
  // arrastar um cômodo, mostra largura e profundidade; ao arrastar uma
  // parede solta, mostra o comprimento. Some assim que o arraste termina.
  function updateDimLabels() {
    if (!drawPreview) {
      var liveWall = dragMode === 'wallResize' && selectedWallId ? Store.findWall(selectedWallId) : null;
      var roomDimensions = liveWall ? findLiveRoomDimensions(liveWall) : [];
      if (roomDimensions.length) {
        var liveLabelY = currentFloorYOffset() + 0.12;
        var liveLabels = [dimLabelAEl, dimLabelBEl];
        var liveLines = [liveRoomDimensionLineEl, liveRoomDimensionLineBEl];
        liveLabels.forEach(function (label) { label.classList.remove('visible'); label.style.display = ''; });
        liveLines.forEach(function (line) { line.style.display = 'none'; });
        roomDimensions.forEach(function (roomDimension: any, index: number) {
          var lineMid = modelToWorld((roomDimension.a.x + roomDimension.b.x) / 2, (roomDimension.a.y + roomDimension.b.y) / 2);
          var midpointVisible = dimensionPointIsVisible({ x: lineMid.x, y: liveLabelY, z: lineMid.z });
          var label = liveLabels[index]!, line = liveLines[index]!;
          label.textContent = roomDimension.clearMeters.toFixed(2).replace('.', ',') + ' m';
          positionFloatingPanel(label, lineMid.x, liveLabelY, lineMid.z, 0);
          label.classList.add('visible');
          positionLiveRoomDimension(line, roomDimension.a, roomDimension.b, liveLabelY);
          label.style.display = midpointVisible ? 'block' : 'none';
          line.style.display = midpointVisible ? 'block' : 'none';
        });
        return;
      }
      dimLabelAEl.style.display = '';
      dimLabelBEl.style.display = '';
      liveRoomDimensionLineEl.style.display = 'none';
      liveRoomDimensionLineBEl.style.display = 'none';
      dimLabelAEl.classList.remove('visible'); dimLabelBEl.classList.remove('visible'); return;
    }
    liveRoomDimensionLineEl.style.display = 'none';
    liveRoomDimensionLineBEl.style.display = 'none';
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
    var selectedLaje = selectedLajeId ? Store.findLaje(selectedLajeId) : null;
    Scene3DRenderer.rebuild(scene, project, { width: 0, height: 0 }, {
      highlightedCategory: highlightedCategory,
      editingFloorIndex: project.currentFloorIndex,
      editingYOffset: currentFloorYOffset(),
      selectedWall: selectedWall,
      selectedColumn: selectedColumn,
      selectedRoof: selectedRoof,
      selectedOpening: selectedOpening,
      selectedVaranda: selectedVaranda,
      selectedLaje: selectedLaje,
      roomGroupWallIds: selectedRoomWallIds,
      resizeWallId: resizeWallId,
      drawPreview: drawPreview,
      terrenoToolActive: currentTool === 'terreno'
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
    if (selectedLajeId && !Store.findLaje(selectedLajeId)) selectedLajeId = null;
    if (selectedGlazingPanelId && !Store.findGlazingPanel(selectedGlazingPanelId)) selectedGlazingPanelId = null;
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
    if (tool === 'terreno') openTerrenoModal(); else closeTerrenoModal(false);
  }

  // Modal de tamanho do terreno — mesmo padrão de projectNameModalOverlay
  // (EsboceApplication), mas mantido inteiramente aqui: o terreno é
  // conceitualmente uma ferramenta do viewport (como Telhado, Cômodo
  // etc.), não um fluxo de conta/projeto.
  function openTerrenoModal() {
    var terreno = Store.currentTerreno();
    terrenoLarguraInputEl.value = terreno ? String(terreno.larguraM) : '';
    terrenoComprimentoInputEl.value = terreno ? String(terreno.comprimentoM) : '';
    terrenoErrorEl.textContent = '';
    terrenoModalOverlayEl.style.display = 'flex';
    terrenoLarguraInputEl.focus();
  }

  function closeTerrenoModal(revertToolIfUndefined: boolean) {
    terrenoModalOverlayEl.style.display = 'none';
    if (revertToolIfUndefined && !Store.currentTerreno()) setTool(null);
  }

  function submitTerrenoModal() {
    var largura = parseFloat(terrenoLarguraInputEl.value);
    var comprimento = parseFloat(terrenoComprimentoInputEl.value);
    if (!(largura > 0) || !(comprimento > 0)) {
      terrenoErrorEl.textContent = 'Digite largura e comprimento maiores que zero.';
      return;
    }
    Store.setTerreno(largura, comprimento);
    terrenoModalOverlayEl.style.display = 'none';
    fitCameraToTerreno();
    render();
  }

  // Aproximação de "vista de topo": o viewport só tem câmera
  // perspectiva (sem projeção ortográfica/paralela de verdade — ver
  // ADR-008, pendência de escopo). Inclina a câmera existente bem de
  // cima e centraliza no terreno, próximo o bastante de uma vista
  // paralela pra marcar os lados com confiança, mas continua sendo
  // perspectiva por baixo.
  function fitCameraToTerreno() {
    var terreno = Store.currentTerreno();
    if (!terreno) return;
    var w = terreno.larguraM, c = terreno.comprimentoM;
    // Centro do retângulo do terreno, em metros — mesma unidade de
    // mundo usada pela câmera (camTarget), já que a cena Three.js
    // trabalha em metros (a conversão de unidades de grade pra metros
    // acontece na hora de gerar a geometria, não na câmera).
    camTarget = { x: w / 2, y: 0, z: c / 2 };
    camElev = 1.4; // máximo já permitido pelo clamp normal de órbita — o mais perto de "de cima" sem abrir exceção nova
    camAngle = Math.PI / 4;
    camDist = Math.max(8, Math.max(w, c) * 0.95);
    updateCam();
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
    var surfaces: [string, string][] = [
      ['walls', 'Paredes'], ['floors', 'Pisos'], ['ceilings', 'Teto/forro'],
      ['roofs', 'Telhado'], ['external', 'Áreas externas']
    ];
    var nav = document.createElement('div');
    nav.className = 'paint-surface-nav';
    surfaces.forEach(function (item) {
      var surfaceBtn = document.createElement('button');
      surfaceBtn.className = 'paint-surface' + (currentPaintSurface === item[0] ? ' active' : '');
      surfaceBtn.dataset.surface = item[0];
      surfaceBtn.textContent = item[1];
      nav.appendChild(surfaceBtn);
    });
    paintPickerPanelEl.appendChild(nav);
    if (!currentPaintSurface) {
      var prompt = document.createElement('div');
      prompt.className = 'paint-help';
      prompt.textContent = 'Escolha o tipo de superfície.';
      paintPickerPanelEl.appendChild(prompt);
      paintPickerPanelEl.classList.add('visible');
      return;
    }
    var category: any = currentPaintSurface === 'roofs' ? 'roof_tile'
      : (currentPaintSurface === 'floors' || currentPaintSurface === 'external') ? 'floor_tile' : 'paint';
    var products = Catalog.getProductsByCategory(category);
    if (currentPaintSurface === 'walls') products = Catalog.getProductsByCategory('paint').concat(Catalog.getProductsByCategory('floor_tile'));
    var swatches = document.createElement('div');
    swatches.className = 'paint-swatches';
    products.forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'fn' + (p.id === currentPaintProductId ? ' active' : '');
      btn.title = p.name;
      btn.style.background = p.assets.colorHex;
      btn.dataset.product = p.id;
      swatches.appendChild(btn);
    });
    paintPickerPanelEl.appendChild(swatches);
    if (currentPaintSurface === 'floors') {
      var controls = document.createElement('div');
      controls.className = 'floor-finish-controls';
      controls.innerHTML = '<label>Escala <input data-floor-scale type="range" min="0.25" max="4" step="0.25" value="' + floorFinishScale + '"><span>' + floorFinishScale.toFixed(2).replace('.', ',') + '×</span></label>' +
        '<label>Rotação <select data-floor-rotation><option value="0">0°</option><option value="45">45°</option><option value="90">90°</option><option value="135">135°</option></select></label>' +
        '<button class="paint-apply"' + (selectedPaintRoomKey ? '' : ' disabled') + '>Aplicar no cômodo</button>';
      (controls.querySelector('[data-floor-rotation]') as HTMLSelectElement).value = String(floorFinishRotation);
      paintPickerPanelEl.appendChild(controls);
      var floorHelp = document.createElement('div');
      floorHelp.className = 'paint-help';
      floorHelp.textContent = selectedPaintRoomKey ? 'Cômodo selecionado. Ajuste e aplique.' : 'Clique no piso do cômodo que deseja revestir.';
      paintPickerPanelEl.appendChild(floorHelp);
    } else if (currentPaintSurface === 'ceilings' || currentPaintSurface === 'external') {
      var unavailable = document.createElement('div');
      unavailable.className = 'paint-help';
      unavailable.textContent = 'Clique na face desejada para aplicar somente nela.';
      paintPickerPanelEl.appendChild(unavailable);
    }
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
      Store.commands.splitWallsAtTJunctions();
    } else if (currentTool === 'wall') {
      // gruda no corpo de outra parede se estiver perto — fecha uma
      // junção em T sem precisar de nenhuma tecla extra, já que o clique
      // de confirmar nunca é interpretado como "selecionar aquela parede"
      var snapPt = findWallPointNear(p.x2, p.y2);
      var endX = snapPt ? snapPt.x : p.x2, endY = snapPt ? snapPt.y : p.y2;
      Store.commands.createWall(p.x1, p.y1, endX, endY);
      Store.commands.splitWallsAtTJunctions();
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

    if (touchCameraMode && e.pointerType === 'touch') {
      downButton = 1;
      e.preventDefault();
      return;
    }

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
      if (handleT && (handleT === 'roofRidge' || handleT === 'roofBaseHeight' || handleT === 'roofParapetHeight' || handleT.indexOf('roofEdge') === 0)) {
        dragMode = handleT;
        var rrT = Store.findRoof(selectedRoofId);
        if (handleT === 'roofRidge') {
          dragElementStart = { pitchDeg: rrT ? rrT.pitchDeg : 28, startScreenY: e.clientY };
        } else if (handleT === 'roofBaseHeight') {
          dragElementStart = { baseHeightM: rrT ? rrT.baseHeightM : 1.2, startScreenY: e.clientY };
        } else if (handleT === 'roofParapetHeight') {
          dragElementStart = { parapetHeight: rrT ? rrT.parapetHeight : 0.5, startScreenY: e.clientY };
        } else if (rrT) {
          var regionForDrag = findGridRegionAt((rrT.x1 + rrT.x2) / 2, (rrT.y1 + rrT.y2) / 2);
          dragElementStart = { x1: rrT.x1, y1: rrT.y1, x2: rrT.x2, y2: rrT.y2, region: regionForDrag, lastBounds: null };
          beginRoofResizePreview(rrT.id);
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
      var newRoof = Store.commands.createRoof(rectClick.x1, rectClick.y1, rectClick.x2, rectClick.y2, pendingRoofType as any, pendingRoofAttic);
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
        pendingRoofAttic = false;
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
      dragMode = handle; // 'endpoint1' | 'endpoint2' | 'roofRidge' | 'roofParapetHeight' | 'roofEdge*' | 'varandaEdge*' | 'lajeEdge*'
      if (handle === 'endpoint1' || handle === 'endpoint2') {
        var endpointWall = Store.findWall(selectedWallId);
        if (endpointWall) {
          var endpointWhich = handle === 'endpoint1' ? 1 : 2;
          var endpointX = endpointWhich === 1 ? endpointWall.x1 : endpointWall.x2;
          var endpointY = endpointWhich === 1 ? endpointWall.y1 : endpointWall.y2;
          // Congela a rede conectada no início do gesto. Procurar de novo
          // depois do primeiro movimento não funcionaria: as pontas já
          // estariam separadas e a relação topológica teria sido perdida.
          dragElementStart = {
            linkedEndpoints: findLinkedEndpoints(selectedWallId, endpointX, endpointY)
          };
        }
      } else if (handle === 'roofRidge') {
        var rr = Store.findRoof(selectedRoofId);
        dragElementStart = { pitchDeg: rr ? rr.pitchDeg : 28, startScreenY: e.clientY };
      } else if (handle === 'roofParapetHeight') {
        var rrP = Store.findRoof(selectedRoofId);
        dragElementStart = { parapetHeight: rrP ? rrP.parapetHeight : 0.5, startScreenY: e.clientY };
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
          dragElementStart = { x1: rrE.x1, y1: rrE.y1, x2: rrE.x2, y2: rrE.y2, region: regionForDragE, lastBounds: null };
          beginRoofResizePreview(rrE.id);
        }
      } else if (handle.indexOf('varandaEdge') === 0) {
        // Varanda não trava em região de cômodo nenhuma (decisão
        // explícita — sempre livre), então não precisa achar região
        // nenhuma aqui, só o retângulo de partida.
        var vrE = Store.findVaranda(selectedVarandaId);
        if (vrE) dragElementStart = { x1: vrE.x1, y1: vrE.y1, x2: vrE.x2, y2: vrE.y2 };
      } else if (handle.indexOf('lajeEdge') === 0) {
        // Laje também não trava em região nenhuma — igual varanda, de
        // propósito, pra dar pra arrastar além da parede (balanço) ou
        // encolher além dela (vão aberto) — ver DEC-35. edgeIndex vem
        // do próprio nome da alça ('lajeEdge3' -> aresta entre
        // points[3] e points[4]) — guarda uma cópia dos pontos de
        // ANTES do arraste, pro mousemove sempre calcular a partir do
        // estado original (não acumular erro frame a frame).
        var lrE = Store.findLaje(selectedLajeId);
        var edgeIndexL = parseInt(handle.slice('lajeEdge'.length), 10);
        if (lrE) dragElementStart = { points: lrE.points.map(function (p: any) { return { x: p.x, y: p.y }; }), edgeIndex: edgeIndexL };
      } else if (handle === 'openingEdgeTop') {
        // Redimensionar altura arrasta na vertical — mesma técnica de
        // roofRidge (delta de tela, não raycast contra plano vertical).
        var opT = Store.findOpening(selectedOpeningId);
        if (opT) dragElementStart = { sillHeight: opT.sillHeight, height: opT.height, startScreenY: e.clientY };
      }
      Store.commands.beginTransaction();
      return;
    }

    // 2) elemento existente
    var mesh = pickMesh(e.clientX, e.clientY);

    // Ferramenta Terreno ativa + clicou numa das 4 faixas do lado do
    // retângulo-guia (só existem enquanto a ferramenta está ativa, ver
    // Scene3DRenderer.rebuild/viewState.terrenoToolActive): alterna
    // muro daquele lado. Não seleciona/arrasta nada, igual Porta/Janela.
    if (currentTool === 'terreno' && mesh && mesh.userData.terrenoSide) {
      Store.toggleTerrenoMuroSide(mesh.userData.terrenoSide);
      render();
      return;
    }

    // Ferramenta Porta/Janela/Arco ativa + clicou numa parede: insere a
    // abertura ali (não seleciona/arrasta a parede como o normal) —
    // igual a ferramenta Telhado nunca seleciona parede/coluna.
    if ((currentTool === 'door' || currentTool === 'window' || currentTool === 'arco') && mesh && mesh.userData.wallId) {
      var gpIns = getGroundModelPoint(e.clientX, e.clientY);
      if (gpIns) {
        var newOpening = Store.commands.insertOpening(mesh.userData.wallId, currentTool, gpIns.x, gpIns.y);
        if (newOpening) selectOpening(newOpening.id);
        else {
          var openingLabel = currentTool === 'door' ? 'porta' : currentTool === 'window' ? 'janela' : 'arco';
          hintEl.textContent = 'Não cabe um' + (currentTool === 'window' ? 'a' : '') + ' ' + openingLabel + ' aqui — parede curta demais ou sem espaço livre.';
        }
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
      if (currentPaintSurface === 'walls' && paintHit && paintHit.object.userData.wallId && currentPaintProductId) {
        var faceHit = wallFaceAtPoint(paintHit.object.userData.wallId, paintHit.point);
        Store.commands.setWallFinishFace(paintHit.object.userData.wallId, faceHit as any, currentPaintProductId);
        hintEl.textContent = 'Lado ' + faceHit.toUpperCase() + ' pintado. Clique em outra pra continuar.';
        return;
      }
      if (currentPaintSurface === 'walls' && paintHit && paintHit.object.userData.gableSide && paintHit.object.userData.roofId && currentPaintProductId) {
        Store.commands.setRoofGableFinish(paintHit.object.userData.roofId, paintHit.object.userData.gableSide, currentPaintProductId);
        hintEl.textContent = 'Acabamento aplicado somente à face clicada do oitão.';
        return;
      }
      if (currentPaintSurface === 'floors' && paintHit && paintHit.object.userData.roomKey) {
        selectedPaintRoomKey = paintHit.object.userData.roomKey;
        refreshPaintPickerPanel();
        hintEl.textContent = 'Piso selecionado. Escolha o material, ajuste escala e rotação e clique em Aplicar.';
        return;
      }
      if (currentPaintSurface === 'roofs' && paintHit && paintHit.object.userData.roofId && currentPaintProductId) {
        Store.commands.setRoofFinish(paintHit.object.userData.roofId, currentPaintProductId);
        hintEl.textContent = 'Revestimento aplicado somente ao telhado clicado.';
        return;
      }
    }

    if (mesh) {
      if (isEditableMesh(mesh)) {
        if (mesh.userData.wallId) {
          var clickedWallId = mesh.userData.wallId;
          var w = Store.findWall(clickedWallId);
          if (!w) return;

          // Um comodo ainda isolado funciona como modulo: clicar em
          // qualquer parede seleciona e prepara o arraste do conjunto
          // inteiro. Assim que qualquer ponto do contorno se conecta a
          // outra parede (parede compartilhada, T ou simples encontro),
          // ele passa a fazer parte da construcao e o mesmo clique edita
          // somente a parede atingida, com o protetor topologico da v11.
          var isolatedRoomWallIds = Core.findIsolatedRoomWallIds(Store.currentWalls(), clickedWallId);
          if (isolatedRoomWallIds) {
            var snapshots = isolatedRoomWallIds.map(function (id: any) {
              var groupWall = Store.findWall(id)!;
              return { id: id, x1: groupWall.x1, y1: groupWall.y1, x2: groupWall.x2, y2: groupWall.y2 };
            });
            // Móvel não pertence a nenhuma parede — pra saber quais peças
            // "moram" nesse cômodo isolado, usa a caixa delimitadora do
            // contorno (mesma ideia usada pra encaixar um cômodo novo em
            // computeNextRoomSlot). Guarda a posição original de cada um
            // pra aplicar o MESMO delta do arraste das paredes, mantendo
            // tudo junto até o cômodo se conectar a outro.
            var roomMinX = Infinity, roomMaxX = -Infinity, roomMinY = Infinity, roomMaxY = -Infinity;
            snapshots.forEach(function (s: any) {
              [[s.x1, s.y1], [s.x2, s.y2]].forEach(function (p: any) {
                if (p[0] < roomMinX) roomMinX = p[0]; if (p[0] > roomMaxX) roomMaxX = p[0];
                if (p[1] < roomMinY) roomMinY = p[1]; if (p[1] > roomMaxY) roomMaxY = p[1];
              });
            });
            var furnitureSnapshots = Store.currentFurniture()
              .filter(function (f: any) { return f.x >= roomMinX && f.x <= roomMaxX && f.y >= roomMinY && f.y <= roomMaxY; })
              .map(function (f: any) { return { id: f.id, x: f.x, y: f.y }; });
            selectRoomGroup(isolatedRoomWallIds);
            dragElementStart = { snapshots: snapshots, furnitureSnapshots: furnitureSnapshots, lastValidDx: 0, lastValidDy: 0 };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            collectRoomGroupDragObjects(isolatedRoomWallIds, furnitureSnapshots);
            dragMode = 'roomGroup';
            Store.commands.beginTransaction();
          } else {
            startWallResizeDrag(clickedWallId, e.clientX, e.clientY);
          }
        } else if (mesh.userData.columnId) {
          var columnId = mesh.userData.columnId;
          selectColumn(columnId);
          dragMode = 'columnBody';
          var c = Store.findColumn(columnId)!;
          dragElementStart = { x: c.x, y: c.y, lastX: c.x, lastY: c.y };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          collectColumnDragObjects(columnId);
          Store.commands.beginTransaction();
        } else if (mesh.userData.roofId) {
          var roofId = mesh.userData.roofId;
          selectRoof(roofId);
          var connectedIds = connectedRoofIds(roofId);
          var roofSnapshots = connectedIds.map(function (id) {
            var roof = Store.findRoof(id)!;
            return { id: id, x1: roof.x1, y1: roof.y1, x2: roof.x2, y2: roof.y2 };
          });
          dragMode = 'roofGroup';
          dragElementStart = { snapshots: roofSnapshots, lastDx: 0, lastDy: 0 };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          collectRoofGroupDragObjects(connectedIds, roofId);
          Store.commands.beginTransaction();
        } else if (mesh.userData.varandaId) {
          selectVaranda(mesh.userData.varandaId);
        } else if (mesh.userData.lajeId) {
          var lajeId = mesh.userData.lajeId;
          selectLaje(lajeId);
          dragMode = 'lajeBody';
          var lEnt = Store.findLaje(lajeId)!;
          dragElementStart = { points: lEnt.points.map(function (p: any) { return { x: p.x, y: p.y }; }), lastDx: 0, lastDy: 0 };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          // selectLaje reconstrói a cena; captura o volume e as alças
          // recém-criados, nunca o mesh antigo atingido pelo raycast.
          collectLajeDragObjects(lajeId);
          Store.commands.beginTransaction();
        } else if (mesh.userData.furnitureId) {
          var furnitureId = mesh.userData.furnitureId;
          selectFurniture(furnitureId);
          dragMode = 'furnitureBody';
          var fEnt = Store.findFurniture(furnitureId)!;
          dragElementStart = { x: fEnt.x, y: fEnt.y, lastValidX: fEnt.x, lastValidY: fEnt.y };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          // A seleção reconstrói a cena. Usa o grupo glTF recém-criado,
          // nunca o objeto atingido pelo raycast antes do render.
          furnitureDragObject = findFurnitureSceneObject(furnitureId);
          Store.commands.beginTransaction();
        } else if (mesh.userData.glazingPanelId) {
          var glazingPanelId = mesh.userData.glazingPanelId;
          var gpEnt = Store.findGlazingPanel(glazingPanelId)!;
          selectGlazingPanel(glazingPanelId);
          // Painel já anexado: Etapa 2b não move mais depois de
          // encostado na parede (reposicionar ao longo da parede fica
          // pra uma próxima etapa) — só seleciona, pra dar acesso ao
          // gizmo de excluir.
          if (gpEnt.state === 'preview') {
            dragMode = 'glazingPanelBody';
            dragElementStart = { x: gpEnt.x || 0, y: gpEnt.y || 0 };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            // selectGlazingPanel reconstrói a cena. Recaptura o objeto
            // recém-criado em vez de guardar o mesh anterior, já removido.
            glazingPanelDragMesh = findGlazingPanelSceneObject(glazingPanelId);
            Store.commands.beginTransaction();
          }
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

  // Ao arrastar a BORDA da laje perto de uma parede OU de outra laje,
  // gruda na FACE mais próxima (não no eixo/centro) — imã com um raio
  // de captura, não uma trava: sem nada perto o bastante, cai no grid
  // normal (Core.snap) de qualquer jeito. 'axis' é qual coordenada está
  // sendo arrastada ('x' pra bordas verticais, 'y' pra horizontais);
  // só considera paredes/lajes PERPENDICULARES a esse eixo (paredes
  // aqui são sempre 0°/90°, DEC-28, e laje é sempre retilínea, então
  // não precisa de footprint completo).
  // Ímã de encosto do painel de Envidraçamento (DEC-56) — ao soltar o
  // arraste do corpo, acha a parede mais próxima (menor distância
  // perpendicular do CENTRO do painel até o segmento da parede,
  // projetado e travado dentro do próprio segmento) dentro de uma
  // tolerância de "perto o bastante"; fora dela, o painel só fica onde
  // foi solto (continua 'preview', tenta de novo depois).
  var GLAZING_ATTACH_TOLERANCE_MODEL = 1 * Core.GRID; // 1 metro
  function nearestWallForGlazingAttach(glazingPanelId: any): string | null {
    var p = Store.findGlazingPanel(glazingPanelId);
    if (!p || p.state !== 'preview') return null;
    var px = p.x || 0, py = p.y || 0;
    var walls = Store.currentWalls();
    var bestId: string | null = null, bestDist = GLAZING_ATTACH_TOLERANCE_MODEL;
    walls.forEach(function (w: any) {
      var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      var lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-9) return;
      var t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / lenSq));
      var projX = w.x1 + dx * t, projY = w.y1 + dy * t;
      var dist = Math.hypot(px - projX, py - projY);
      if (dist < bestDist) { bestDist = dist; bestId = w.id; }
    });
    return bestId;
  }

  function nearestWallFaceCoord(axis: 'x' | 'y', rawValue: any, skipLajeId?: any) {
    var walls = Store.currentWalls();
    var halfThick = (Core.WALL_THICK / 2) * Core.GRID;
    var best: number | null = null, bestDist = Core.SNAP_UNIT;
    walls.forEach(function (w: any) {
      var isVertical = Math.abs(w.x1 - w.x2) < 1e-6;
      var isHorizontal = Math.abs(w.y1 - w.y2) < 1e-6;
      if (axis === 'x' && isVertical) {
        [w.x1 - halfThick, w.x1 + halfThick].forEach(function (faceX) {
          var d = Math.abs(faceX - rawValue);
          if (d < bestDist) { bestDist = d; best = faceX; }
        });
      } else if (axis === 'y' && isHorizontal) {
        [w.y1 - halfThick, w.y1 + halfThick].forEach(function (faceY) {
          var d = Math.abs(faceY - rawValue);
          if (d < bestDist) { bestDist = d; best = faceY; }
        });
      }
    });
    Store.currentLajes().forEach(function (other: any) {
      if (other.id === skipLajeId) return;
      var b = Core.lajeBounds(other);
      var candidates = axis === 'x' ? [b.minX, b.maxX] : [b.minY, b.maxY];
      candidates.forEach(function (c: any) {
        var d = Math.abs(c - rawValue);
        if (d < bestDist) { bestDist = d; best = c; }
      });
    });
    return best;
  }

  // Arrastar o CORPO inteiro da laje (mover sem mudar o formato) —
  // gruda (ímã) numa laje vizinha quando fica perto o bastante, pra
  // ficar colada sem sobrepor, SEM virar um objeto só (decisão revista
  // — ver DEC-37, Sessão 6: nada de fusão automática, só esse snap).
  // Testa os dois jeitos de encostar em cada eixo (minha borda direita
  // na esquerda da vizinha, ou minha esquerda na direita dela — e o
  // mesmo em Y), só quando as faixas do OUTRO eixo realmente se
  // sobrepõem (senão "encostar" não faz sentido geométrico).
  function snapLajeBodyDelta(lajeId: any, rawDx: any, rawDy: any, origBounds: any) {
    var candMinX = origBounds.minX + rawDx, candMaxX = origBounds.maxX + rawDx;
    var candMinY = origBounds.minY + rawDy, candMaxY = origBounds.maxY + rawDy;
    var tol = Core.SNAP_UNIT;
    var bestDx = rawDx, bestDxDist = tol;
    var bestDy = rawDy, bestDyDist = tol;
    Store.currentLajes().forEach(function (other: any) {
      if (other.id === lajeId) return;
      var ob = Core.lajeBounds(other);
      var overlapY = Math.min(candMaxY, ob.maxY) - Math.max(candMinY, ob.minY);
      if (overlapY > -tol) {
        [ob.minX - candMaxX, ob.maxX - candMinX].forEach(function (d: any) {
          if (Math.abs(d) < bestDxDist) { bestDxDist = Math.abs(d); bestDx = rawDx + d; }
        });
      }
      var overlapX = Math.min(candMaxX, ob.maxX) - Math.max(candMinX, ob.minX);
      if (overlapX > -tol) {
        [ob.minY - candMaxY, ob.maxY - candMinY].forEach(function (d: any) {
          if (Math.abs(d) < bestDyDist) { bestDyDist = Math.abs(d); bestDy = rawDy + d; }
        });
      }
    });
    return { dx: bestDx, dy: bestDy };
  }

  function onPointerMove(e: any) {
    // Os navegadores tambÃ©m emitem pointermove para cada dedo. Durante
    // o gesto de dois dedos, somente onTouchMove controla a cÃ¢mera;
    // impedir o fluxo normal evita mover parede/mÃ³vel por acidente.
    if (multiTouchCameraActive && e.pointerType === 'touch') return;
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
      if (gp1) Store.commands.updateWallEndpointLive(
        selectedWallId,
        dragMode === 'endpoint1' ? 1 : 2,
        gp1.x,
        gp1.y,
        dragElementStart && dragElementStart.linkedEndpoints ? dragElementStart.linkedEndpoints : []
      );
      return;
    }
    if (dragMode === 'wallBody') {
      var gp2 = getGroundModelPoint(e.clientX, e.clientY);
      if (gp2 && dragGroundStart) {
        var dx = gp2.x - dragGroundStart.x, dy = gp2.y - dragGroundStart.y;
        var bodyCandidate = { id: selectedWallId, x1: dragElementStart.x1 + dx, y1: dragElementStart.y1 + dy, x2: dragElementStart.x2 + dx, y2: dragElementStart.y2 + dy };
        if (!Core.wallOverlapsForeignOpening(bodyCandidate, [selectedWallId], Store.currentOpenings(), Store.currentWalls())) {
          Store.commands.updateWallBodyLive(selectedWallId, bodyCandidate.x1, bodyCandidate.y1, bodyCandidate.x2, bodyCandidate.y2);
        } else {
          hintEl.textContent = 'Movimento bloqueado: a parede não pode atravessar uma porta ou janela.';
        }
      }
      return;
    }
    // Arrastando o cômodo inteiro (clique único no módulo): o delta é
    // quantizado pela mesma malha das paredes. Uma posição colidente só
    // é aceita quando representa duas paredes no mesmo eixo prontas
    // para fusão; nos demais casos conserva o último passo válido.
    if (dragMode === 'roomGroup') {
      var gpR = getGroundModelPoint(e.clientX, e.clientY);
      if (gpR && dragGroundStart && dragElementStart) {
        var gdx = gpR.x - dragGroundStart.x, gdy = gpR.y - dragGroundStart.y;
        var resolved = resolveRoomGroupCollision(dragElementStart.snapshots, gdx, gdy);
        dragElementStart.lastValidDx = resolved.x;
        dragElementStart.lastValidDy = resolved.y;
        previewRoomGroupDelta(resolved.x, resolved.y);
      }
      return;
    }
    if (dragMode === 'roofGroup') {
      var gpRoofGroup = getGroundModelPoint(e.clientX, e.clientY);
      if (gpRoofGroup && dragGroundStart && dragElementStart) {
        var roofDx = Core.snap(gpRoofGroup.x - dragGroundStart.x);
        var roofDy = Core.snap(gpRoofGroup.y - dragGroundStart.y);
        dragElementStart.lastDx = roofDx;
        dragElementStart.lastDy = roofDy;
        previewRoofGroupDelta(roofDx, roofDy);
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
        var requestedOffset = Core.snap(rawDx * dragElementStart.nx + rawDy * dragElementStart.ny);
        var offsetResolution = dragElementStart.ownerCount > 0
          ? Core.resolveWallResizeOffset(
              dragElementStart.originalWall,
              dragElementStart.diagnosticBefore,
              requestedOffset,
              dragElementStart.nx,
              dragElementStart.ny
            )
          : { offset: requestedOffset, limited: false };
        var offset = offsetResolution.offset;
        var openingResolution = Core.resolveWallOffsetAgainstOpenings(
          dragElementStart.originalWall,
          offset,
          dragElementStart.nx,
          dragElementStart.ny,
          [resizeWallId],
          Store.currentOpenings(),
          dragElementStart.diagnosticBefore
        );
        if (openingResolution.limited) {
          offset = openingResolution.offset;
          hintEl.textContent = 'Movimento bloqueado: a parede não pode atravessar uma porta ou janela.';
        } else {
          offset = openingResolution.offset;
        }
        dragElementStart.resizeLimitWallId = offsetResolution.limited ? offsetResolution.blockingWallId : null;
        if (offsetResolution.limited) {
          hintEl.textContent = 'Limite atingido: a parede não pode atravessar outra parede da planta.';
        }
        var rx1 = dragElementStart.x1 + dragElementStart.nx * offset, ry1 = dragElementStart.y1 + dragElementStart.ny * offset;
        var rx2 = dragElementStart.x2 + dragElementStart.nx * offset, ry2 = dragElementStart.y2 + dragElementStart.ny * offset;
        var linked = dragElementStart.linksStart.map(function (l: any) { return { id: l.id, which: l.which, x: rx1, y: ry1 }; })
          .concat(dragElementStart.linksEnd.map(function (l: any) { return { id: l.id, which: l.which, x: rx2, y: ry2 }; }));
        Store.commands.updateWallResizeLive(resizeWallId, rx1, ry1, rx2, ry2, linked);

        // Precisa de rastro somente quando uma conexão original realmente
        // ficou no nó antigo. Uma parede compartilhada pode ter todas as
        // vizinhas perpendiculares acompanhando o arraste e, ainda assim,
        // possuir uma continuação colinear que deve ficar parada. Nesse
        // caso o rastro fecha o degrau entre os dois nós. Usar apenas
        // ownerCount escondia essa continuação e rompia o grafo.
        var endpointStillOnSupport = function (supportIds: any[], x: number, y: number) {
          return supportIds.some(function (supportId: any) {
            var support = Store.findWall(supportId);
            return support && Core.distToSegment(x, y, support.x1, support.y1, support.x2, support.y2) <= Core.COINCIDENCE_TOL;
          });
        };
        var startSlides = endpointStillOnSupport(dragElementStart.startSlidingSupports, rx1, ry1);
        var endSlides = endpointStillOnSupport(dragElementStart.endSlidingSupports, rx2, ry2);
        // Uma vizinha perpendicular que alongou pode ligar sozinha o no
        // antigo ao novo. Nesse sentido do arraste, criar outra parede por
        // cima dela duplicaria o trecho. No sentido oposto ela encurta e
        // deixa de cobrir o no antigo; ai a ponte continua necessaria.
        var oldNodeCoveredByMovedLink = function (links: any[], oldX: number, oldY: number) {
          return links.some(function (link: any) {
            var linkedWall = Store.findWall(link.id);
            return linkedWall && Core.distToSegment(
              oldX, oldY,
              linkedWall.x1, linkedWall.y1,
              linkedWall.x2, linkedWall.y2
            ) <= Core.COINCIDENCE_TOL;
          });
        };
        var startCovered = oldNodeCoveredByMovedLink(
          dragElementStart.linksStart,
          dragElementStart.x1,
          dragElementStart.y1
        );
        var endCovered = oldNodeCoveredByMovedLink(
          dragElementStart.linksEnd,
          dragElementStart.x2,
          dragElementStart.y2
        );
        var needsBridgeStart = Core.wallResizeEndpointNeedsBridge(
          dragElementStart.rawStart,
          dragElementStart.linksStart,
          startSlides || startCovered
        );
        var needsBridgeEnd = Core.wallResizeEndpointNeedsBridge(
          dragElementStart.rawEnd,
          dragElementStart.linksEnd,
          endSlides || endCovered
        );

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
        dragElementStart.diagnosticDeltaX = rx1 - dragElementStart.x1;
        dragElementStart.diagnosticDeltaY = ry1 - dragElementStart.y1;
        if (dragElementStart.diagnosticBefore) {
          showWallDiagnostic(addWallCrossingPrevention(analyzeWallResize(
            dragElementStart.diagnosticBefore,
            cloneWallsForDiagnostics(Store.currentWalls()),
            resizeWallId,
            dragElementStart.diagnosticDeltaX,
            dragElementStart.diagnosticDeltaY,
            'preview'
          ), dragElementStart.resizeLimitWallId));
        }
      }
      return;
    }
    if (dragMode === 'columnBody') {
      var gp3 = getGroundModelPoint(e.clientX, e.clientY);
      if (gp3 && dragGroundStart) {
        var dx3 = gp3.x - dragGroundStart.x, dy3 = gp3.y - dragGroundStart.y;
        dragElementStart.lastX = dragElementStart.x + dx3;
        dragElementStart.lastY = dragElementStart.y + dy3;
        var worldDx3 = dx3 * scale, worldDz3 = dy3 * scale;
        columnDragObjects.forEach(function (entry) {
          entry.object.position.x = entry.startX + worldDx3;
          entry.object.position.z = entry.startZ + worldDz3;
        });
      }
      return;
    }
    if (dragMode === 'furnitureBody') {
      var gpF = getGroundModelPoint(e.clientX, e.clientY);
      if (gpF && dragGroundStart && furnitureDragObject) {
        var dxF = gpF.x - dragGroundStart.x, dyF = gpF.y - dragGroundStart.y;
        var resolvedF = resolveFurniturePosition(selectedFurnitureId, dragElementStart.x + dxF, dragElementStart.y + dyF);
        dragElementStart.lastValidX = resolvedF.x;
        dragElementStart.lastValidY = resolvedF.y;
        var worldF = modelToWorld(resolvedF.x, resolvedF.y);
        furnitureDragObject.position.x = worldF.x;
        furnitureDragObject.position.z = worldF.z;
      }
      return;
    }
    if (dragMode === 'glazingPanelBody') {
      // Correção de performance (mesma sessão): NÃO chama Store aqui —
      // isso disparava reconstrução da cena inteira (paredes, telhado,
      // móveis, materiais, planilha, estatísticas) a cada pointermove,
      // dezenas de vezes por segundo, travando a interface em projetos
      // maiores (coluna e móvel já tinham esse mesmo custo antes,
      // menos perceptível; aqui ficou evidente). Move só o mesh
      // visual direto (mutação local, sem passar pelo Store/render());
      // o Store só é atualizado UMA VEZ, no soltar do mouse.
      var gpG = getGroundModelPoint(e.clientX, e.clientY);
      if (gpG && dragGroundStart && glazingPanelDragMesh) {
        var dxG = gpG.x - dragGroundStart.x, dyG = gpG.y - dragGroundStart.y;
        var liveXG = dragElementStart.x + dxG, liveYG = dragElementStart.y + dyG;
        var wpG = modelToWorld(liveXG, liveYG);
        glazingPanelDragMesh.position.x = wpG.x;
        glazingPanelDragMesh.position.z = wpG.z;
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
    if (dragMode === 'roofParapetHeight') {
      if (dragElementStart) {
        var deltaScreenP = dragElementStart.startScreenY - e.clientY; // positivo = arrastou pra cima
        var candidateHeight = Math.max(0.2, Math.min(1.2, dragElementStart.parapetHeight + deltaScreenP * 0.01));
        Store.commands.updateRoofParapetHeightLive(selectedRoofId, candidateHeight);
      }
      return;
    }
    if (dragMode === 'roofBaseHeight') {
      if (dragElementStart) {
        var deltaBase = dragElementStart.startScreenY - e.clientY;
        Store.commands.updateRoofBaseHeightLive(selectedRoofId, dragElementStart.baseHeightM + deltaBase * 0.01);
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
        dragElementStart.lastBounds = { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
        previewRoofResize(dragElementStart.lastBounds);
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
    if (dragMode && dragMode.indexOf('lajeEdge') === 0) {
      var gpLE = getGroundModelPoint(e.clientX, e.clientY);
      if (gpLE && dragElementStart) {
        var startPtsL = dragElementStart.points;
        var edgeIdxL = dragElementStart.edgeIndex;
        var nL = startPtsL.length;
        var p1L = startPtsL[edgeIdxL], p2L = startPtsL[(edgeIdxL + 1) % nL];
        var isVerticalL = Math.abs(p1L.x - p2L.x) < 1e-6;
        var newValueL: number;
        if (isVerticalL) {
          var snappedLX: number | null = nearestWallFaceCoord('x', gpLE.x, selectedLajeId);
          newValueL = snappedLX == null ? Core.snap(gpLE.x) : snappedLX;
        } else {
          var snappedLY: number | null = nearestWallFaceCoord('y', gpLE.y, selectedLajeId);
          newValueL = snappedLY == null ? Core.snap(gpLE.y) : snappedLY;
        }
        Store.commands.updateLajeEdgeLive(selectedLajeId, edgeIdxL, newValueL);
      }
      return;
    }
    if (dragMode === 'lajeBody') {
      var gpLB = getGroundModelPoint(e.clientX, e.clientY);
      if (gpLB && dragGroundStart && dragElementStart) {
        var rawDxL = Core.snap(gpLB.x - dragGroundStart.x);
        var rawDyL = Core.snap(gpLB.y - dragGroundStart.y);
        var origBoundsL = Core.lajeBounds({ id: '', points: dragElementStart.points } as any);
        var snapped = snapLajeBodyDelta(selectedLajeId, rawDxL, rawDyL, origBoundsL);
        dragElementStart.lastDx = snapped.dx;
        dragElementStart.lastDy = snapped.dy;
        previewLajeDelta(snapped.dx, snapped.dy);
      }
      return;
    }
    if (dragMode === 'openingEdgeLeft' || dragMode === 'openingEdgeRight') {
      var opE = Store.findOpening(selectedOpeningId);
      var gpOE = getGroundModelPoint(e.clientX, e.clientY);
      if (opE && gpOE) {
        var wOE = Store.findWall(opE.wallId);
        if (wOE) {
          var desiredOE = Core.wallOffsetAtPoint(wOE, gpOE.x, gpOE.y);
          var edgeOE: 'left' | 'right' = dragMode === 'openingEdgeLeft' ? 'left' : 'right';
          Store.commands.resizeOpeningEdgeLive(selectedOpeningId, edgeOE, desiredOE);
        }
      }
      return;
    }
    if (dragMode === 'openingEdgeTop') {
      if (dragElementStart) {
        // Mesma técnica de roofRidge: delta de tela vertical vira delta
        // de altura real, sem precisar de raycast contra plano vertical
        // (o ground-point normal só funciona pra plano horizontal).
        var deltaScreenO = dragElementStart.startScreenY - e.clientY; // positivo = arrastou pra cima
        var candidateTopO = dragElementStart.sillHeight + dragElementStart.height + deltaScreenO * 0.01;
        Store.commands.resizeOpeningHeightLive(selectedOpeningId, candidateTopO);
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
        var hitsSelected = mesh && ((mesh.userData.wallId && mesh.userData.wallId === selectedWallId) || (mesh.userData.columnId && mesh.userData.columnId === selectedColumnId) || (mesh.userData.roofId && mesh.userData.roofId === selectedRoofId) || (mesh.userData.varandaId && mesh.userData.varandaId === selectedVarandaId) || (mesh.userData.lajeId && mesh.userData.lajeId === selectedLajeId) || (mesh.userData.furnitureId && mesh.userData.furnitureId === selectedFurnitureId));
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
          if (Store.commands.splitWallsAtTJunctions().length) {
            hintEl.textContent = 'Junção criada — a parede transversal foi dividida no encontro.';
          }
          if (dragElementStart.diagnosticBefore) {
            var beforeCleanup = cloneWallsForDiagnostics(Store.currentWalls());
            var newResidues = findNewDegenerateWallResidues(
              dragElementStart.diagnosticBefore,
              beforeCleanup
            );
            Store.commands.pruneDegenerateWallsLive(newResidues.map(function (residue) { return residue.wallId; }));
            var finalDiagnostic = addWallCrossingPrevention(analyzeWallResize(
              dragElementStart.diagnosticBefore,
              cloneWallsForDiagnostics(Store.currentWalls()),
              resizeWallId,
              dragElementStart.diagnosticDeltaX || 0,
              dragElementStart.diagnosticDeltaY || 0,
              'final',
              newResidues
            ), dragElementStart.resizeLimitWallId);
            if (isWallResizeReportBlocking(finalDiagnostic)) {
              Store.commands.rollbackTransaction();
              finalDiagnostic.blocked = true;
              hintEl.textContent = 'Movimento cancelado: a parede romperia uma junção da planta.';
            }
            showWallDiagnostic(finalDiagnostic);
          }
        }
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }

    // Rede de segurança no fim do arraste. O cômodo inteiro já se move
    // discretamente no grid, mas o corpo de uma parede solta ainda usa
    // coordenadas contínuas durante o gesto. Normalizar os dois fluxos
    // aqui impede que qualquer resíduo numérico sobreviva ao pointerup.
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
        var finalDx = dragElementStart.lastValidDx || 0;
        var finalDy = dragElementStart.lastValidDy || 0;
        Store.commands.updateWallsGroupBodyLive(dragElementStart.snapshots, finalDx, finalDy);
        (dragElementStart.furnitureSnapshots || []).forEach(function (fs: any) {
          Store.commands.updateFurnitureBodyLive(fs.id, fs.x + finalDx, fs.y + finalDy);
        });
        dragElementStart.snapshots.forEach(function (s: any) { snapWallToGridExact(s.id); });
        if (fuseAllOverlaps(dragElementStart.snapshots.map(function (s: any) { return s.id; }))) {
          hintEl.textContent = 'Paredes encaixadas e fundidas no eixo do grid.';
        }
        if (Store.commands.splitWallsAtTJunctions().length) {
          hintEl.textContent = 'Junções criadas — paredes transversais divididas nos encontros.';
        }
      }
      roomGroupDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'roofGroup') {
      if (dragElementStart && dragElementStart.snapshots) {
        Store.commands.updateRoofsGroupBodyLive(
          dragElementStart.snapshots,
          dragElementStart.lastDx || 0,
          dragElementStart.lastDy || 0
        );
      }
      roofGroupDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      hintEl.textContent = 'Cobertura conectada movida como um conjunto.';
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
    if (dragMode && dragMode.indexOf('roofEdge') === 0) {
      var finalRoofBounds = dragElementStart && dragElementStart.lastBounds;
      clearRoofResizePreview();
      if (finalRoofBounds) {
        Store.commands.updateRoofBoundsLive(selectedRoofId, finalRoofBounds.x1, finalRoofBounds.y1, finalRoofBounds.x2, finalRoofBounds.y2);
      }
      if (selectedRoofId && fuseRoofsIfTouching(selectedRoofId)) {
        hintEl.textContent = 'Telhados fundidos — a cumeeira agora é uma só.';
        onModelChanged();
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'roofRidge' || dragMode === 'roofParapetHeight') {
      if (selectedRoofId && fuseRoofsIfTouching(selectedRoofId)) {
        hintEl.textContent = 'Telhados fundidos — a cumeeira agora é uma só.';
        onModelChanged();
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    // Laje: sem fusão automática (decisão revista — ver DEC-37, Sessão
    // 6). Arrastar borda/corpo só solta a alça normalmente; o "colar
    // sem sobrepor" já aconteceu ao vivo, durante o próprio arraste
    // (ver nearestWallFaceCoord/snapLajeBodyDelta).
    if (dragMode && dragMode.indexOf('lajeEdge') === 0) {
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'endpoint1' || dragMode === 'endpoint2') {
      if (selectedWallId && fuseAllOverlaps([selectedWallId])) {
        hintEl.textContent = 'Paredes fundidas — sem faces sobrepostas.';
      }
      if (Store.commands.splitWallsAtTJunctions().length) {
        hintEl.textContent = 'Junção criada — a parede transversal foi dividida no encontro.';
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'glazingPanelBody') {
      // Única atualização de Store do arraste inteiro — commita a
      // posição final (o mesh visual já estava lá, movido direto no
      // pointermove) antes de rodar o ímã, senão nearestWallForGlazingAttach
      // leria o x/y ANTIGO (de antes do arraste) direto do Store.
      var gpId = selectedGlazingPanelId;
      if (gpId && dragElementStart && dragGroundStart) {
        var gpUp = getGroundModelPoint(e.clientX, e.clientY);
        if (gpUp) {
          var dxUp = gpUp.x - dragGroundStart.x, dyUp = gpUp.y - dragGroundStart.y;
          Store.commands.updateGlazingPanelBodyLive(gpId, dragElementStart.x + dxUp, dragElementStart.y + dyUp);
        }
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      glazingPanelDragMesh = null;
      if (gpId) {
        var nearWallId = nearestWallForGlazingAttach(gpId);
        if (nearWallId) Store.commands.attachGlazingPanelToWall(gpId, nearWallId);
      }
      return;
    }
    if (dragMode === 'furnitureBody') {
      if (selectedFurnitureId && dragElementStart) {
        Store.commands.updateFurnitureBodyLive(
          selectedFurnitureId,
          dragElementStart.lastValidX,
          dragElementStart.lastValidY
        );
      }
      furnitureDragObject = null;
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'columnBody') {
      if (selectedColumnId && dragElementStart) {
        Store.commands.updateColumnBodyLive(selectedColumnId, dragElementStart.lastX, dragElementStart.lastY);
      }
      columnDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'lajeBody') {
      if (selectedLajeId && dragElementStart) {
        var finalLajePoints = dragElementStart.points.map(function (p: any) {
          return { x: p.x + dragElementStart.lastDx, y: p.y + dragElementStart.lastDy };
        });
        Store.commands.updateLajePointsLive(selectedLajeId, finalLajePoints);
      }
      lajeDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'openingSlide' || dragMode === 'openingEdgeLeft' || dragMode === 'openingEdgeRight' || dragMode === 'openingEdgeTop' || (dragMode && dragMode.indexOf('varandaEdge') === 0)) {
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

  // Começa o modo "empurrar a parede na perpendicular" — usado tanto
  // pelo duplo clique quanto pela alça branca visível no meio da
  // parede. Um único lugar pra montar o estado do arraste, pra os dois
  // gatilhos nunca ficarem dessincronizados.
  function startWallResizeDrag(wallId: any, clientX: any, clientY: any) {
    var w = Store.findWall(wallId);
    if (!w) return;
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
    var rawStart = findLinkedEndpoints(wallId, w.x1, w.y1);
    var rawEnd = findLinkedEndpoints(wallId, w.x2, w.y2);
    // Uma parede fundida pertence aos dois cômodos. As vizinhas imediatas
    // dos DOIS contornos precisam acompanhar as duas extremidades; mover
    // apenas o lado que cresce abre uma fresta no lado que encolhe.
    var topology = Core.wallResizeTopology(Store.currentWalls(), wallId);
    var linksStart = topology.start;
    var linksEnd = topology.end;
    dragElementStart = {
      x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
      originalWall: { ...w },
      nx: pushNx, ny: pushNy,
      linksStart: linksStart,
      linksEnd: linksEnd,
      rawStart: rawStart,
      rawEnd: rawEnd,
      ownerCount: topology.ownerCount,
      startSlidingSupports: topology.startSlidingSupports,
      endSlidingSupports: topology.endSlidingSupports,
      // A copia tambem alimenta o protetor quando o painel esta oculto.
      // O diagnostico visual e opcional; a integridade da planta nao e.
      diagnosticBefore: cloneWallsForDiagnostics(Store.currentWalls()),
      diagnosticDeltaX: 0,
      diagnosticDeltaY: 0,
      resizeLimitWallId: null,
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
    if (dragElementStart.diagnosticBefore) {
      showWallDiagnostic(analyzeWallResize(
        dragElementStart.diagnosticBefore,
        dragElementStart.diagnosticBefore,
        wallId,
        0,
        0,
        'started'
      ));
    }
    render();
  }

  // O cômodo só pode parar em linhas do grid. Paredes colineares com
  // sobreposição suficiente são um encaixe válido e serão fundidas ao
  // soltar; qualquer outra colisão conserva o último passo válido.
  function resolveRoomGroupCollision(snapshots: any, dx: any, dy: any) {
    var groupIds = snapshots.map(function (s: any) { return s.id; });
    var others = Store.currentWalls().filter(function (w) { return groupIds.indexOf(w.id) === -1; });
    return Core.resolveWallGroupGridDelta(
      snapshots,
      others,
      dx,
      dy,
      dragElementStart && dragElementStart.lastValidDx || 0,
      dragElementStart && dragElementStart.lastValidDy || 0,
      Store.currentOpenings(),
      Store.currentWalls()
    );
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
      others.forEach(function (b) {
        if (!Core.wallsCanFuse(a, b, MERGE_TOL_DIST, MERGE_TOL_ANGLE, MERGE_MIN_OVERLAP)) return;
        var dMid = Core.distPointToLine((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2, b.x1, b.y1, b.x2, b.y2);
        if (!best || dMid < best.dist) best = { wallAId: a.id, wallBId: b.id, dist: dMid };
      });
    });
    return best;
  }

  // O cômodo em "modo deslocamento" (selectedRoomWallIds) avança em
  // passos do grid e pode pousar no eixo de uma parede vizinha. A fusão
  // acontece ao soltar o arraste; esta mesma função também permanece
  // como garantia quando a seleção é encerrada por outro caminho.
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

  var touchCameraGesture: TouchCameraAnchor | null = null;
  var multiTouchCameraActive = false;
  function onTouchStart(e: any) {
    if (e.touches.length === 2) {
      e.preventDefault();
      dragMode = null;
      multiTouchCameraActive = true;
      touchCameraGesture = touchCameraAnchor(e.touches[0], e.touches[1], camDist);
      hintEl.textContent = 'Câmera: mova dois dedos para girar e aproxime/afaste para dar zoom.';
    }
  }
  function onTouchMove(e: any) {
    if (e.touches.length === 2 && touchCameraGesture) {
      e.preventDefault();
      var result = updateTouchCamera(
        { angle: camAngle, elevation: camElev, distance: camDist },
        touchCameraGesture,
        e.touches[0],
        e.touches[1],
        MIN_DIST,
        MAX_DIST
      );
      camAngle = result.state.angle;
      camElev = result.state.elevation;
      camDist = result.state.distance;
      touchCameraGesture = result.anchor;
      updateCam();
    }
  }
  function onTouchEnd(e: any) {
    if (e.touches.length < 2 && multiTouchCameraActive) {
      touchCameraGesture = null;
      multiTouchCameraActive = false;
      downButton = null;
      downPos = null;
      dragMode = null;
      hintEl.textContent = 'Toque para construir. Use dois dedos para girar a câmera e dar zoom.';
    }
  }

  export function toggleTouchCameraMode(): boolean {
    touchCameraMode = !touchCameraMode;
    downButton = null;
    downPos = null;
    dragMode = null;
    if (hintEl) {
      hintEl.textContent = touchCameraMode
        ? 'Modo cÃ¢mera ativo: arraste um dedo para girar. Toque em CÃ¢mera para voltar a construir.'
        : 'Modo construÃ§Ã£o ativo. Use dois dedos para girar a cÃ¢mera e dar zoom.';
    }
    return touchCameraMode;
  }

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

    var walls = Store.currentWalls(), columns = Store.currentColumns(), varandas = Store.currentVarandas();
    if (!walls.length && !columns.length && !varandas.length) { wallGridOverlay.visible = false; return; }

    var rooms = Core.detectRooms(walls);
    var boundsList: any[] = [];
    if (rooms.length) {
      rooms.forEach(function (room) {
        var b = Core.roomModelBounds(room);
        if (b) boundsList.push(b);
      });
    } else if (walls.length || columns.length) {
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
    // Varanda não tem parede (é um retângulo aberto — ver interface
    // Varanda), então nunca aparecia como cômodo fechado pro
    // detectRooms acima: a ferramenta Telhado nunca gerava região
    // nenhuma sobre ela, e o clique não fazia nada (região = null).
    // Cada varanda entra como sua PRÓPRIA região — se estiver
    // encostada na casa (dentro da margem), mergeOverlappingBounds
    // logo abaixo já junta as duas automaticamente, permitindo um
    // telhado só cobrindo casa + varanda; se estiver longe, fica
    // separada, do mesmo jeito que um edículo separado já ficava.
    varandas.forEach(function (v) {
      boundsList.push({
        minX: Math.min(v.x1, v.x2), maxX: Math.max(v.x1, v.x2),
        minY: Math.min(v.y1, v.y2), maxY: Math.max(v.y1, v.y2)
      });
    });
    boundsList = mergeOverlappingBounds(boundsList, ROOF_GRID_MARGIN);

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

  // Móveis padrão por tipo de ambiente — parte "híbrida" do MVP: nasce
  // automático, mas cada peça pode ser movida/girada/removida depois
  // (mesmo padrão de objeto avulso que coluna/varanda já usam). Posições
  // em METROS a partir do canto x1,y1 do retângulo do cômodo (nunca
  // absolutas — cada cômodo nasce em lugar diferente). Cômodos sem
  // catálogo de móvel ainda (garagem, lavanderia, escritório) ficam de
  // fora por enquanto — sem vaga/portão/tanque no catálogo hoje.
  var ROOM_DEFAULT_FURNITURE: Record<string, { productId: string; xM: number; yM: number; rotationDeg?: number; elevationM?: number }[]> = {
    // Posições calibradas — testadas e ajustadas na 3D (mesmo padrão de
    // Quarto, Sala e Cozinha). Lavatório e chuveiro montados na parede,
    // 1m acima do chão — só o vaso e o box ficam apoiados no piso.
    banheiro: [
      { productId: 'vortice.movel.vaso-sanitario', xM: 0.58, yM: 1.19, rotationDeg: 180 },
      { productId: 'vortice.movel.lavatorio', xM: 1.80, yM: 0.50, rotationDeg: 180, elevationM: 1.0 },
      { productId: 'vortice.movel.box-chuveiro', xM: 1.66, yM: 1.21, rotationDeg: 180 },
      { productId: 'vortice.movel.chuveiro', xM: 1.65, yM: 1.29, rotationDeg: 180, elevationM: 1.0 }
    ],
    // Por enquanto só a cama — guarda-roupa/painel de TV/criado-mudo
    // ficam de fora até ter modelos melhores pra essas peças (o
    // guarda-roupa atual é provisório). Reativar aqui assim que os
    // novos .glb chegarem.
    quarto: [
      { productId: 'vortice.movel.cama', xM: 2.45, yM: 1.56, rotationDeg: 180 }
    ],
    sala: [
      { productId: 'vortice.movel.sofa', xM: 0.60, yM: 1.86 },
      { productId: 'vortice.movel.mesinha-centro', xM: 1.96, yM: 1.57 },
      { productId: 'vortice.movel.tv', xM: 3.88, yM: 1.66, rotationDeg: 180, elevationM: 1.0 }
    ],
    // Posições calibradas — testadas e ajustadas na 3D (mesmo padrão de
    // Quarto e Sala).
    cozinha: [
      { productId: 'vortice.eletro.geladeira', xM: 1.73, yM: 0.47 },
      { productId: 'vortice.movel.mesa', xM: 0.96, yM: 1.54 },
      { productId: 'vortice.movel.armario-cozinha', xM: 2.00, yM: 1.84, rotationDeg: 90 }
    ]
  };

  function placeDefaultFurniture(key: any, rect: { x1: number; y1: number; x2: number; y2: number }) {
    var defaults = ROOM_DEFAULT_FURNITURE[key];
    if (!defaults) return;
    defaults.forEach(function (item) {
      var x = rect.x1 + item.xM * Core.GRID;
      var y = rect.y1 + item.yM * Core.GRID;
      Store.commands.createFurnitureSilent(x, y, item.productId, item.rotationDeg || 0, item.elevationM || 0);
    });
  }

  // Empurra o móvel pra fora de qualquer parede que ele esteja invadindo
  // durante o arrasto — mesma técnica SAT/MTV que já resolve colisão
  // entre paredes (ver Core.obbOverlapMTV), só que aqui o "retângulo A"
  // é o próprio móvel (usando o tamanho real carregado do .glb) em vez
  // de outra parede. Sem trava de grid: a posição resultante é livre,
  // só não pode ficar dentro da espessura de uma parede.
  function resolveFurniturePosition(furnitureId: any, x: any, y: any) {
    var item = Store.findFurniture(furnitureId);
    if (!item) return { x: x, y: y };
    var product = Catalog.getProduct(item.productId);
    var modelUrl = product && product.assets && product.assets.modelUrl;
    var footprint = modelUrl ? Scene3DRenderer.getFurnitureFootprint(modelUrl) : null;
    // Modelo ainda carregando (raro, só no primeiro arrasto logo após
    // criar o cômodo) — sem tamanho conhecido não dá pra testar
    // colisão; deixa mover livre por enquanto, sem travar a UI.
    if (!footprint) return { x: x, y: y };
    var cx = x, cy = y;
    var walls = Store.currentWalls();
    for (var pass = 0; pass < 3; pass++) {
      var moved = false;
      for (var i = 0; i < walls.length; i++) {
        var box = Core.furnitureOBB({ x: cx, y: cy, rotationDeg: item.rotationDeg }, footprint.w, footprint.d);
        var mtv = Core.obbOverlapMTV(box, Core.wallOBB(walls[i]!));
        if (mtv) { cx += mtv.x; cy += mtv.y; moved = true; }
      }
      if (!moved) break;
    }
    return { x: cx, y: cy };
  }

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
    if (key === 'laje') {
      // Nasce cobrindo o contorno de tudo que já existe no pavimento
      // (paredes + varandas) — ponto de partida sensato, não uma
      // trava: a pessoa arrasta as bordas livremente depois, inclusive
      // pra fora do contorno (balanço/sacada) ou pra dentro (vão
      // aberto) — ver DEC-35.
      var walls = Store.currentWalls(), varandasL = Store.currentVarandas();
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      walls.forEach(function (w) {
        [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
          if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
        });
      });
      // w.x1/y1/x2/y2 são o EIXO da parede, não a face — sem esse
      // ajuste a laje nascia encolhida (na verdade em cima do próprio
      // eixo), deixando metade da espessura da parede de fora dela ou
      // fazendo a lateral da laje cortar por dentro da parede. Paredes
      // aqui são sempre alinhadas a 0°/90° (DEC-28), então dá pra só
      // expandir o retângulo pela meia-espessura em vez de calcular
      // face a face.
      if (walls.length) {
        var wallMargin = (Core.WALL_THICK / 2) * Core.GRID;
        minX -= wallMargin; maxX += wallMargin; minY -= wallMargin; maxY += wallMargin;
      }
      varandasL.forEach(function (v) {
        [Math.min(v.x1, v.x2), Math.max(v.x1, v.x2)].forEach(function (x) { if (x < minX) minX = x; if (x > maxX) maxX = x; });
        [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)].forEach(function (y) { if (y < minY) minY = y; if (y > maxY) maxY = y; });
      });
      var rectL;
      if (isFinite(minX)) {
        rectL = { x1: minX, y1: minY, x2: maxX, y2: maxY };
      } else {
        // Pavimento vazio — nasce num tamanho padrão centralizado,
        // igual telhado/varanda fariam no mesmo caso.
        var halfL = (LAJE_DEFAULT_SIZE_M * Core.GRID) / 2;
        rectL = { x1: -halfL, y1: -halfL, x2: halfL, y2: halfL };
      }
      // Já existe laje no pavimento? Nasce AO LADO de tudo que já
      // existe (mesmo espírito de computeNextRoomSlot pra cômodo) —
      // uma peça nova, separada, que a pessoa arrasta como bloco até
      // encostar; o "colar sem sobrepor" acontece pelo ímã do próprio
      // arraste (nearestWallFaceCoord/snapLajeBodyDelta), sem fundir
      // (decisão revista — ver DEC-37, Sessão 6).
      var existingLajes = Store.currentLajes();
      if (existingLajes.length) {
        var lajeMinX = Infinity, lajeMaxX = -Infinity;
        existingLajes.forEach(function (l) {
          l.points.forEach(function (p: any) { if (p.x < lajeMinX) lajeMinX = p.x; if (p.x > lajeMaxX) lajeMaxX = p.x; });
        });
        var gapL = 1 * Core.GRID; // 1m de respiro, mesmo espírito do gap entre cômodos
        var widthL = rectL.x2 - rectL.x1, depthL = rectL.y2 - rectL.y1;
        var newX1 = Math.max(rectL.x2, lajeMaxX) + gapL;
        rectL = { x1: newX1, y1: rectL.y1, x2: newX1 + widthL, y2: rectL.y1 + depthL };
      }
      deselect();
      var newLaje = Store.commands.createLaje(Core.rectPoints(rectL.x1, rectL.y1, rectL.x2, rectL.y2));
      if (newLaje) selectLaje(newLaje.id);
      hintEl.textContent = existingLajes.length
        ? 'Nova laje criada ao lado — arraste o corpo dela pra encostar em outra (gruda sozinha, sem sobrepor).'
        : 'Laje criada cobrindo o pavimento — arraste o corpo pra reposicionar, ou as bordas pra ajustar o formato (inclusive além da parede, pra criar um balanço/sacada).';
      return;
    }
    if (key === 'glazing') {
      // Painel de Envidraçamento (DEC-56) — nasce solto, numa posição
      // padrão perto do que já existe no pavimento (mesmo espírito de
      // gap usado por laje/cômodo). Arraste o corpo até perto de uma
      // parede pra encostar (ímã automático) e recortar a camada
      // visível dela — ver nearestWallForGlazingAttach/
      // attachGlazingPanelToWall (Etapa 2b). O grid de perfis + vidro
      // reflexivo de verdade (Etapa 2c) ainda não existe — o painel
      // aparece como placeholder até lá.
      var wallsG = Store.currentWalls();
      var minXg = Infinity, maxXg = -Infinity, minYg = Infinity;
      wallsG.forEach(function (w) {
        [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
          if (p[0] < minXg) minXg = p[0]; if (p[0] > maxXg) maxXg = p[0];
          if (p[1] < minYg) minYg = p[1];
        });
      });
      var gapG = 1 * Core.GRID;
      var gx = isFinite(maxXg) ? maxXg + gapG : 0;
      var gy = isFinite(minYg) ? minYg : 0;
      deselect();
      var newPanel = Store.commands.createGlazingPanel(gx, gy);
      hintEl.textContent = newPanel
        ? 'Painel de Fachada criado — arraste o corpo dele até perto de uma parede pra encostar (o grid de perfis e o vidro reflexivo ainda não estão prontos, por enquanto é só o volume).'
        : 'Não foi possível criar o painel de Fachada.';
      return;
    }
    var preset = ROOM_PRESETS[key];
    if (!preset) return;
    var rect = computeNextRoomSlot(preset.widthM, preset.depthM);
    deselect();
    Store.commands.createRoom(rect.x1, rect.y1, rect.x2, rect.y2);
    placeDefaultFurniture(key, rect);
    hintEl.textContent = preset.label + ' criado(a) — arraste as paredes se quiser ajustar a posição ou o tamanho.';
  }

  // Pavimento acima do térreo só pode ganhar parede/cômodo depois que o
  // pavimento de baixo já tem uma laje colocada (ver DEC-35) — sem
  // isso, não existe "chão" nenhum pra sustentar o que nasceria ali.
  // Térreo nunca precisa (ele já nasce apoiado no terreno).
  function floorBelowMissingLaje() {
    var project = Store.getProject();
    var idx = project.currentFloorIndex;
    if (idx <= 0) return false;
    // Ático/Chalé é uma configuração livre do nível atual. Pode representar
    // um A-frame no térreo ou um mezanino parcial, portanto não exige uma
    // laje completa no nível imediatamente inferior.
    if (project.floors[idx] && project.floors[idx]!.kind === 'attic') return false;
    var belowFloor = project.floors[idx - 1];
    return !belowFloor || !belowFloor.lajes || !belowFloor.lajes.length;
  }
  function requireLajeBelowOrHint() {
    if (floorBelowMissingLaje()) {
      hintEl.textContent = 'Antes de construir neste pavimento, coloque (e ajuste) a laje do pavimento de baixo — botão "Laje", na seção Cobertura.';
      return false;
    }
    return true;
  }

  function flashDisabledHint(label: any) {
    hintEl.textContent = label + ' ainda não está disponível nesta versão do protótipo.';
  }

  export function init(opts: { container: HTMLElement; camera: THREE.Camera; scene: THREE.Scene; renderer: THREE.WebGLRenderer }) {
    container = opts.container; camera = opts.camera; scene = opts.scene; renderer = opts.renderer;
    Scene3DRenderer.setOnFurnitureAssetLoaded(render);
    gizmoEl = document.getElementById('wallGizmo');
    gzSwapBtnEl = document.getElementById('gzSwapBtn');
    openingGizmoEl = document.getElementById('openingGizmo');
    roomGizmoEl = document.getElementById('roomGizmo');
    layersContextMenuEl = document.getElementById('layersContextMenu');
    columnShapePanelEl = document.getElementById('columnShapePanel');
    roofTypePanelEl = document.getElementById('roofTypePanel');
    generateAtticBtnEl = document.getElementById('generateAtticBtn');
    finishPanelEl = document.getElementById('finishPanel');
    paintPickerPanelEl = document.getElementById('paintPickerPanel');
    objectPanelEl = document.getElementById('objectPanel');
    objectPanelTitleEl = document.getElementById('objectPanelTitle');
    objectPanelBodyEl = document.getElementById('objectPanelBody');
    hintEl = document.getElementById('viewportHint');
    if (window.matchMedia('(pointer: coarse)').matches) {
      hintEl.textContent = 'Toque para construir. Use dois dedos para girar a cÃ¢mera e dar zoom.';
    }
    wallDiagnosticsPanelEl = document.getElementById('wallDiagnosticsPanel');
    wallDiagnosticsOutputEl = document.getElementById('wallDiagnosticsOutput');
    dimLabelAEl = document.getElementById('dimLabelA');
    dimLabelBEl = document.getElementById('dimLabelB');
    liveRoomDimensionLineEl = document.getElementById('liveRoomDimensionLine');
    liveRoomDimensionLineBEl = document.getElementById('liveRoomDimensionLineB');
    dimCotaLayerEl = document.getElementById('dimCotaLayer');

    terrenoModalOverlayEl = document.getElementById('terrenoModalOverlay');
    terrenoLarguraInputEl = document.getElementById('terrenoLarguraInput');
    terrenoComprimentoInputEl = document.getElementById('terrenoComprimentoInput');
    terrenoErrorEl = document.getElementById('terrenoError');
    terrenoModalOverlayEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    document.getElementById('terrenoModalClose')!.addEventListener('click', function () { closeTerrenoModal(true); });
    document.getElementById('terrenoSubmit')!.addEventListener('click', submitTerrenoModal);
    [terrenoLarguraInputEl, terrenoComprimentoInputEl].forEach(function (input: any) {
      input.addEventListener('keydown', function (e: any) { if (e.key === 'Enter') submitTerrenoModal(); });
    });

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
      var commitBtn = e.target.closest('button.roof-commit');
      if (commitBtn && selectedRoofId) {
        var candidates = roofCompoundCandidateIds(selectedRoofId);
        if (candidates.length < 2) {
          hintEl.textContent = 'Encoste ou sobreponha uma cobertura transversal antes de engastar.';
          return;
        }
        Store.commands.commitRoofCompound(candidates);
        hintEl.textContent = 'Cobertura engastada: recorte, metragem líquida e movimento conjunto ativados.';
        render();
        return;
      }
      var btn = e.target.closest('button.rt');
      if (!btn || !selectedRoofId) return;
      Store.commands.setRoofPieceType(selectedRoofId, btn.dataset.rooftype);
    });
    if (generateAtticBtnEl) {
      generateAtticBtnEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
      generateAtticBtnEl.addEventListener('click', function () {
        if (!pendingGenerateRoofId) return;
        Store.commands.generateAttic(pendingGenerateRoofId);
        selectRoof(pendingGenerateRoofId);
        pendingGenerateRoofId = null;
        generateAtticBtnEl.classList.remove('visible');
        hintEl.textContent = 'Ático gerado. As paredes agora acompanham o telhado de forma paramétrica.';
      });
    }
    finishPanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    finishPanelEl.addEventListener('click', function (e: any) {
      var btn = e.target.closest('button.fn');
      if (!btn) return;
      var productId = btn.dataset.product;
      if (selectedRoofId) { Store.commands.setRoofFinish(selectedRoofId, productId); return; }
    });
    paintPickerPanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    paintPickerPanelEl.addEventListener('click', function (e: any) {
      var surfaceBtn = e.target.closest('button.paint-surface');
      if (surfaceBtn) {
        currentPaintSurface = surfaceBtn.dataset.surface;
        selectedPaintRoomKey = null;
        var category: any = currentPaintSurface === 'roofs' ? 'roof_tile' : (currentPaintSurface === 'floors' || currentPaintSurface === 'external') ? 'floor_tile' : 'paint';
        var firstProduct = Catalog.getProductsByCategory(category)[0];
        currentPaintProductId = firstProduct ? firstProduct.id : null;
        refreshPaintPickerPanel();
        return;
      }
      var applyBtn = e.target.closest('button.paint-apply');
      if (applyBtn && selectedPaintRoomKey && currentPaintProductId) {
        Store.commands.setRoomFinish(selectedPaintRoomKey, currentPaintProductId, floorFinishScale, floorFinishRotation);
        hintEl.textContent = 'Revestimento aplicado somente ao piso do cômodo selecionado.';
        return;
      }
      var btn = e.target.closest('button.fn');
      if (!btn) return;
      currentPaintProductId = btn.dataset.product;
      refreshPaintPickerPanel();
    });
    paintPickerPanelEl.addEventListener('input', function (e: any) {
      if (e.target.matches('[data-floor-scale]')) {
        floorFinishScale = Number(e.target.value);
        refreshPaintPickerPanel();
      }
      if (e.target.matches('[data-floor-rotation]')) {
        floorFinishRotation = Number(e.target.value);
        refreshPaintPickerPanel();
      }
    });
    gizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    openingGizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    roomGizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    layersContextMenuEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    layersContextMenuEl.addEventListener('contextmenu', function (e: any) { e.preventDefault(); });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn: any) {
      btn.addEventListener('click', function () {
        // Parede e cômodo (mas não porta/janela/coluna/telhado/etc.)
        // exigem a laje do pavimento de baixo já colocada — ver
        // requireLajeBelowOrHint / DEC-35.
        if ((btn.dataset.tool === 'wall' || btn.dataset.tool === 'room') && !requireLajeBelowOrHint()) return;
        // Clicar na ferramenta já ativa desativa ela (volta pro modo
        // seleção, sem ferramenta nenhuma) — em vez de ficar preso nela
        // até escolher outra.
        setTool(currentTool === btn.dataset.tool ? null : btn.dataset.tool);
      });
    });
    document.querySelectorAll('[data-room-preset]').forEach(function (btn: any) {
      btn.addEventListener('click', function () {
        if (btn.dataset.roomPreset !== 'varanda' && btn.dataset.roomPreset !== 'laje' && btn.dataset.roomPreset !== 'glazing' && !requireLajeBelowOrHint()) return;
        placeRoomPreset(btn.dataset.roomPreset);
      });
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
    // Captura antes dos paineis flutuantes. Eles interrompem a propagacao
    // para nao clicar no 3D por baixo, mas o fim de um arraste iniciado no
    // canvas precisa ser registrado mesmo quando o mouse e solto sobre UI.
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    container.addEventListener('pointermove', function (e: any) { updateHoverMarker(e.clientX, e.clientY); });
    container.addEventListener('pointerleave', function () { hoverMarker.visible = false; });
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    updateCam();
  }

  export function getSelectedWallId() { return selectedWallId; }
  export function getSelectedColumnId() { return selectedColumnId; }
  export function getSelectedRoofId() { return selectedRoofId; }
  export function getSelectedOpeningId() { return selectedOpeningId; }
  export function getSelectedVarandaId() { return selectedVarandaId; }
  export function getSelectedLajeId() { return selectedLajeId; }
  export function getSelectedFurnitureId() { return selectedFurnitureId; }
  export function getSelectedGlazingPanelId() { return selectedGlazingPanelId; }
  export function getSelectedRoomWallIds() { return selectedRoomWallIds; }
  export function setNextRoofAtticMode(enabled: boolean) { pendingRoofAttic = enabled; }

// Namespace de compatibilidade — mesma razão de Core.ts/Store.ts/Catalog.ts/
// Scene3DRenderer.ts (chamadas ViewportController.xxx no código legado).
export const ViewportController = {
  init, render, onModelChanged, deselect,
  select, selectColumn, selectRoof, selectOpening, selectVaranda, selectFurniture, selectGlazingPanel,
  getSelectedWallId, getSelectedColumnId, getSelectedRoofId,
  getSelectedOpeningId, getSelectedVarandaId, getSelectedLajeId, getSelectedFurnitureId, getSelectedGlazingPanelId, getSelectedRoomWallIds,
  setNextRoofAtticMode, toggleDimensions,
  toggleWallDiagnostics,
  resetCamera,
  toggleTouchCameraMode,
  getZoomPercent, zoomIn, zoomOut, setOnZoomChanged,
  toggleLayersMenuAtElement,
  repositionDimensions: repositionDimensionCotas
};