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
import { Scene2DRenderer } from './Scene2DRenderer.js';
import { Scene3DRenderer, DEBUG_COLOR_MODE } from './Scene3DRenderer.js';
import { NavGizmo } from './NavGizmo.js';
import { touchCameraAnchor, updateTouchCamera, type TouchCameraAnchor } from './TouchCamera.js';
import { DEFAULT_GLAZING_GLASS_MATERIAL } from './Glazing.js';
import { hydraulicFixtureTemplate, hydraulicFixtureVisualPosition, hydraulicNodeWallOffsetsMeters, hydraulicPositionFromWallOffset, resolveHydraulicFixturePosition } from './Hydraulics.js';
import type { CommercialSelection } from './types.js';
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
  // Produto escolhido no catálogo e carregado para aplicação direta na
  // próxima face clicada. Não existe mais bandeja intermediária.
  var currentPaintProductId = Catalog.getProductsByCategory('paint')[0] ? Catalog.getProductsByCategory('paint')[0]!.id : null;
  var pendingCommercialSelection: CommercialSelection | null = null;
  var currentPaintSurface: any = null;
  var selectedPaintRoomKey: any = null;
  var floorFinishScale = 1;
  var floorFinishRotation = 0;
  var selectedWallId: any = null, selectedColumnId: any = null, selectedRoofId: any = null, selectedOpeningId: any = null, selectedVarandaId: any = null, selectedLajeId: any = null, selectedFurnitureId: any = null, selectedGlazingPanelId: any = null, selectedBalconyRailingId: any = null, selectedVolumeBoxId: any = null, selectedStairId: any = null, selectedForroRoomKey: any = null, selectedHydraulicNodeId: any = null;
  var steelFrameSurfaceSelectionHandler: ((target: { kind: 'wall-face' | 'gable-face' | 'stepped-wall-face' | 'roof'; entityId: string; side?: 'a' | 'b' }) => boolean) | null = null;
  var facadeWallSelectionHandler: ((wallId: string) => void) | null = null;
  var facadeIsolatedWallIds: string[] | null = null;
  var steelFrameRoofHidden = false;
  // Alça de altura do cômodo (DEC-116) só existe/é clicável enquanto
  // esta variável apontar pra parede selecionada — precisa de um clique
  // deliberado no botão "Ajustar altura" do gizmo pra armar, e desarma
  // sozinha depois de UM ajuste (armHeightAdjust/disarmHeightAdjust) ou
  // ao trocar seleção — nunca fica "ligada" à toa esperando um agarrão
  // acidental.
  var heightAdjustArmedWallId: any = null;
  // Planta baixa importada: singular por pavimento (não tem ID de
  // lista pra selecionar), então a "seleção" é só um flag — true
  // quando existe planUnderlay no pavimento atual E o usuário clicou
  // pra editar (mesmo espírito dos outros selectedXxxId, só que sem
  // precisar de um ID já que só existe UM por vez).
  var selectedPlanUnderlay: boolean = false;
  var selectedRoomWallIds: any = null; // cômodo isolado selecionado como módulo; após qualquer junção o clique volta a ser individual
  var resizeWallId: any = null; // parede em modo de deslocamento perpendicular, iniciado no primeiro clique/arraste
  var gizmoMenuOpen = false;
  var highlightedCategory: any = null; // categoria "de outro andar" ou sem seleção individual (fundação, laje...)

  var downButton: any = null, downPos: any = null;
  var dragMode: any = null; // 'orbit' | 'endpoint1' | 'endpoint2' | 'wallBody' | 'columnBody' | 'roofRidge' | 'openingSlide'
  var placingDraw = false; // true entre o 1º e o 2º clique de Cômodo/Parede
  var drawStart: any = null, drawPreview: any = null;
  var dragElementStart: any = null, dragGroundStart: any = null;
  // Candidato AO VIVO do arraste de "empurrar parede" (dragMode ===
  // 'wallResize', DEC-87) — o Store só é escrito no pointerup (ver
  // comentário ali embaixo), então a cota temporária (updateDimLabels)
  // não pode ler Store.findWall durante o arraste, senão mostra o
  // comprimento ANTIGO em vez de acompanhar a parede fantasma sendo
  // arrastada. Guardado aqui a cada pointermove, lido em
  // updateDimLabels, limpo junto do resto do estado de arraste.
  var wallResizeLiveCandidate: { id: string; x1: number; y1: number; x2: number; y2: number } | null = null;
  // Painel de Envidraçamento em arraste (DEC-56, correção de
  // performance): referência DIRETA ao mesh Three.js do painel sendo
  // arrastado — durante o pointermove, move só ESSE objeto (mutação
  // local, sem passar pelo Store), evitando reconstruir a cena inteira
  // dezenas de vezes por segundo. O Store só é atualizado UMA VEZ, ao
  // soltar o mouse.
  var glazingPanelDragMesh: any = null;
  var volumeBoxDragMesh: any = null;
  var stairDragMesh: any = null;
  var balconyRailingDragMesh: any = null;
  var glazingResizePreview: any = null;
  var glazingResizeHiddenObject: any = null;
  var balconyResizePreview: any = null;
  var balconyResizeHiddenObject: any = null;
  var volumeBoxResizePreview: any = null;
  var volumeBoxResizeHiddenObject: any = null;
  var stairResizePreview: any = null;
  var stairResizeHiddenObject: any = null;
  // Prévia incremental do arraste de um cômodo isolado. Guardamos os
  // objetos 3D recém-reconstruídos pela seleção e movemos somente suas
  // transforms durante o pointermove. A geometria persistida continua
  // intacta até o pointerup, quando o Store recebe o delta final uma vez.
  var roomGroupDragObjects: { object: any; startX: number; startZ: number }[] = [];
  // Mesmo princípio do roomGroupDragObjects acima, só que pra TODA a
  // construção (todos os pavimentos) de uma vez — usado por "Selecionar
  // tudo". O terreno nunca entra aqui (é a referência fixa).
  var wholeConstructionDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var furnitureDragObject: any = null;
  var hydraulicFixtureDragObjects: any[] = [];
  var columnDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var roofGroupDragObjects: { object: any; startX: number; startZ: number }[] = [];
  var roofResizePreviewMeshes: THREE.Object3D[] = [];
  var roofResizeHiddenObjects: THREE.Object3D[] = [];
  // Prévia fantasma do arraste de UMA parede (empurrar/redimensionar,
  // dragMode 'wallResize') — mesmo princípio do telhado acima: durante o
  // gesto, um footprint translúcido da parede + vizinhas diretamente
  // ligadas é reconstruído a cada pointermove SEM tocar no Store (evita
  // reconstruir a cena inteira dezenas de vezes por segundo); a parede
  // de verdade só é atualizada uma vez, no soltar (ver DEC-8x).
  var wallResizePreviewMeshes: THREE.Object3D[] = [];
  var wallResizePreviewFrame: number | null = null;
  var pendingWallResizePreview: { candidateWalls: any[]; previewIds: string[] } | null = null;
  var wallResizeHiddenObjects: THREE.Object3D[] = [];
  var pendingRoofAttic = false;
  var pendingGenerateRoofId: any = null;
  var generateAtticBtnEl: any = null;
  var pendingRoofType = 'duasAguas'; // tipo do próximo telhado a ser colocado
  // Seletor de esquadria (Janela/Porta) — mesma ideia de pendingRoofType:
  // a pessoa escolhe o MODELO antes de clicar na parede. null = "Padrão"
  // (geometria gerada na hora, do jeito que já era antes desta função
  // existir — continua funcionando igual, sem produto nenhum escolhido).
  var pendingOpeningProductId: string | null = null;
  var openingPickerMaterial: 'vidro' | 'aluminio' | 'pvc' | 'madeira' = 'vidro';
  var ROOF_DEFAULT_SIZE = 3 * Core.GRID; // 3m — tamanho inicial ao clicar pra colocar
  var VARANDA_DEFAULT_W_M = 3, VARANDA_DEFAULT_D_M = 2; // 3m x 2m — mesma escala de um cômodo comum
  var LAJE_DEFAULT_SIZE_M = 4; // usado só quando o pavimento está vazio (sem parede nenhuma pra "copiar" o contorno)
  // Snap assistido entre telhados vizinhos (Opção B — ver Registro de
  // Decisões Técnicas, Sessão 4): a inclinação "gruda" na que faria a
  // cumeeira bater com a de um vizinho do MESMO tipo, quando a pessoa já
  // está perto disso no arraste. Não gera vale de verdade — só alinha a
  // altura, feedback visual.
  var ROOF_PITCH_SNAP_DEG = 3.5;
  // Faixa de altura permitida pro arraste de altura de CÔMODO (DEC-88) —
  // teto liberal o bastante pra pé-direito duplo/vaulted, sem deixar
  // arrastar a parede a uma altura absurda por acidente.
  var ROOM_HEIGHT_MIN_M = 2.0;
  var ROOM_HEIGHT_MAX_M = 6.0;
  var ROOF_NEARBY_TOLERANCE = Core.SNAP_UNIT * 2; // ~1m de folga pra contar como "encostado"
  // Ímã de eixo entre borda de telhado e parede (ver Core.snapCoordinateToWalls):
  // mesma folga do snap comum (meio SNAP_UNIT), pra grudar exatamente no eixo
  // da parede assim que o arraste chega perto o bastante dela — sem competir
  // com o snap genérico quando a intenção é ficar longe de qualquer parede.
  var WALL_MAGNET_TOLERANCE = Core.SNAP_UNIT / 2;

  var camAngle = Math.PI / 4, camElev = 0.6, camDist = 13;
  var camTarget = { x: 0, y: 0, z: 0 }; // pra onde a câmera olha e orbita — Shift+scroll desloca isso
  var MIN_DIST = 3, MAX_DIST = 35;
  var touchCameraMode = false;

  var gizmoEl: any, gzSwapBtnEl: any, openingGizmoEl: any, roomGizmoEl: any, volumeBoxGizmoEl: any, stairGizmoEl: any, stairTypePanelEl: any, forroTypePanelEl: any, planUnderlayGizmoEl: any, columnShapePanelEl: any, roofTypePanelEl: any, roofElevationControlEl: any, roofElevationInputEl: any, roofElevationValueEl: any, roofPitchDragCotaEl: any, varandaTypePanelEl: any, varandaWidthInputEl: any, varandaHeightInputEl: any, varandaPitchInputEl: any, paintPickerPanelEl: any, openingPickerPanelEl: any, objectPanelEl: any, objectPanelTitleEl: any, objectPanelBodyEl: any, hintEl: any, layersContextMenuEl: any, hydraulicWallPromptEl: any, hydraulicWallElevationPanelEl: any, hydraulicWallElevationTitleEl: any, hydraulicWallElevationSvgEl: any, hydraulicRouteDrawBarEl: any, hydraulicRouteDrawCountEl: any;
  // Estado do desenho de percurso guiado (H2): fixtureId sendo roteada e os
  // pontos-guia já clicados (só plano — a queda vertical final é
  // automática, ver Hydraulics.buildGuidedColdWaterHeaderRoute). null =
  // fora do modo de desenho.
  var hydraulicRouteDrawState: { fixtureId: string; points: { x: number; y: number }[] } | null = null;
  var hydraulicRouteDrawMarkers: any[] = [];
  // Painel de piso 2D (ralos / pontos de piso) — reaproveita o
  // Scene2DRenderer inteiro, só desenhando os marcadores hidráulicos por
  // cima. fixtureKey = qual tipo de ponto está sendo posicionado.
  var hydraulicFloorPanelState: { fixtureKey: string } | null = null;
  var hydraulicFloorPanelEl: any, hydraulicFloorSvgEl: any, hydraulicFloorSceneRenderer: any;
  // Estado da aba de elevação da parede (H2 — fluxo guiado de posicionamento):
  // qual parede e qual tipo de ponto está sendo posicionado. null = painel fechado.
  var hydraulicWallElevationState: { wallId: string; fixtureKey: string } | null = null;
  var terrenoModalOverlayEl: any, terrenoLarguraInputEl: any, terrenoComprimentoInputEl: any, terrenoErrorEl: any;
  var dimLabelAEl: any, dimLabelBEl: any, liveRoomDimensionLineEl: any, liveRoomDimensionLineBEl: any;
  var hydraulicDragCotaLayerEl: any;
  var hydraulicDragCotaEntries: any[] = [];
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
    demolish: 'Clique numa parede pra quebrar ela — some da vista e do orçamento, mas o cômodo continua fechado (o piso não desaparece).',
    drywallPartition: 'Clique numa parede INTERNA (cômodo dos dois lados) pra marcar como divisória em drywall — clique de novo na mesma parede pra remover.',
    paintBucket: 'Material carregado do catálogo. Clique diretamente na face que deseja revestir.',
    terreno: 'Clique num lado destacado do retângulo pra adicionar ou remover o muro daquele lado.',
    wholeConstruction: 'Clique em qualquer ponto e arraste pra mover a construção inteira (todos os pavimentos) dentro do terreno.'
  };

  function hydraulicFixtureKeyFromTool(tool: any): string | null {
    return typeof tool === 'string' && tool.indexOf('hydraulic:') === 0 ? tool.slice('hydraulic:'.length) : null;
  }

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

  // "Selecionar tudo": coleta CADA objeto 3D que representa alguma
  // entidade do modelo (qualquer pavimento) — reconhecido pela mesma
  // tag de userData que cada tipo já usa pra ser encontrado em outros
  // lugares do arquivo (wallId, columnId, roofId, etc.). Ficam de fora
  // de propósito: tudo que é terreno (terrenoSide/terrenoMuroId — a
  // referência fixa que nunca se move) e as alças de gizmo
  // (userData.handle) e prévias transitórias de outro arraste em
  // andamento — nenhuma dessas é "a construção", são UI ou o terreno.
  function collectWholeConstructionDragObjects() {
    wholeConstructionDragObjects = [];
    scene.children.forEach(function (object: any) {
      var data = object.userData || {};
      if (data.terrenoSide != null || data.terrenoMuroId != null) return;
      if (data.handle != null || data.roofResizePreview || data.wallResizePreview) return;
      var belongs = !!(data.wallId || data.openingId || data.columnId || data.roofId
        || data.varandaId || data.furnitureId || data.roomKey || data.glazingPanelId
        || data.balconyRailingId || data.volumeBoxId || data.stairId
        || data.hydraulicNodeId || data.hydraulicSegmentId);
      if (!belongs) return;
      wholeConstructionDragObjects.push({ object: object, startX: object.position.x, startZ: object.position.z });
    });
  }

  function previewWholeConstructionDelta(dx: number, dy: number) {
    var worldDx = dx * scale, worldDz = dy * scale;
    wholeConstructionDragObjects.forEach(function (entry) {
      entry.object.position.x = entry.startX + worldDx;
      entry.object.position.z = entry.startZ + worldDz;
    });
  }

  function findGlazingPanelSceneObject(id: string) {
    return scene.children.find(function (object: any) {
      return object.userData && object.userData.glazingPanelId === id;
    }) || null;
  }

  function findVolumeBoxSceneObject(id: string) {
    return scene.children.find(function (object: any) {
      return object.userData && object.userData.volumeBoxId === id;
    }) || null;
  }
  function findStairSceneObject(id: string) {
    return scene.children.find(function (object: any) {
      return object.userData && object.userData.stairId === id;
    }) || null;
  }
  function findBalconyRailingSceneObject(id: string) {
    return scene.children.find(function (object: any) {
      return object.userData && object.userData.balconyRailingId === id;
    }) || null;
  }

  function clearGlazingResizePreview() {
    if (glazingResizePreview) {
      scene.remove(glazingResizePreview);
      glazingResizePreview.traverse(function (object: any) {
        if (object.geometry && object.geometry.dispose) object.geometry.dispose();
        var materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        materials.forEach(function (material: any) { if (material && material.dispose) material.dispose(); });
      });
    }
    glazingResizePreview = null;
    if (glazingResizeHiddenObject) glazingResizeHiddenObject.visible = true;
    glazingResizeHiddenObject = null;
  }

  function beginGlazingResizePreview(panelId: string) {
    clearGlazingResizePreview();
    var source: any = findGlazingPanelSceneObject(panelId);
    if (!source) return;
    glazingResizeHiddenObject = source;
    source.visible = false;
    var panel = Store.findGlazingPanel(panelId);
    if (!panel) { source.visible = true; glazingResizeHiddenObject = null; return; }
    // Durante o gesto não clonamos nem esticamos perfis/vidros reais.
    // Um único volume fantasma representa o tamanho pretendido; a malha
    // procedural definitiva só é reconstruída depois do pointerup.
    var previewGeometry = new THREE.BoxGeometry(panel.widthM, panel.heightM, 0.035);
    var previewMaterial = new THREE.MeshBasicMaterial({
      color: 0x79c8ee, transparent: true, opacity: 0.28,
      depthWrite: false, side: THREE.DoubleSide,
    });
    glazingResizePreview = new THREE.Mesh(previewGeometry, previewMaterial);
    glazingResizePreview.position.copy(source.position);
    glazingResizePreview.rotation.copy(source.rotation);
    glazingResizePreview.renderOrder = 998;
    scene.add(glazingResizePreview);
  }

  function clearBalconyResizePreview() {
    if (balconyResizePreview) {
      scene.remove(balconyResizePreview);
      balconyResizePreview.traverse(function (object: any) {
        if (object.geometry && object.geometry.dispose) object.geometry.dispose();
        var materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        materials.forEach(function (material: any) { if (material && material.dispose) material.dispose(); });
      });
    }
    balconyResizePreview = null;
    if (balconyResizeHiddenObject) balconyResizeHiddenObject.visible = true;
    balconyResizeHiddenObject = null;
  }

  function beginBalconyResizePreview(railingId: string) {
    clearBalconyResizePreview();
    var source: any = findBalconyRailingSceneObject(railingId);
    if (!source) return;
    balconyResizeHiddenObject = source;
    source.visible = false;
    var railing = Store.findBalconyRailing(railingId);
    if (!railing) { source.visible = true; balconyResizeHiddenObject = null; return; }
    // Mesma técnica de "volume fantasma" do redimensionamento da Pele
    // de vidro (beginGlazingResizePreview) — sem clonar/esticar perfis
    // e vidro reais durante o gesto; a malha procedural definitiva só é
    // reconstruída depois do pointerup.
    var previewGeometry = new THREE.BoxGeometry(railing.widthM, railing.heightM, 0.035);
    var previewMaterial = new THREE.MeshBasicMaterial({
      color: 0x79c8ee, transparent: true, opacity: 0.28,
      depthWrite: false, side: THREE.DoubleSide,
    });
    balconyResizePreview = new THREE.Mesh(previewGeometry, previewMaterial);
    balconyResizePreview.position.copy(source.position);
    balconyResizePreview.rotation.copy(source.rotation);
    balconyResizePreview.renderOrder = 998;
    scene.add(balconyResizePreview);
  }

  function clearVolumeBoxResizePreview() {
    if (volumeBoxResizePreview) {
      scene.remove(volumeBoxResizePreview);
      volumeBoxResizePreview.traverse(function (object: any) {
        if (object.geometry && object.geometry.dispose) object.geometry.dispose();
        var materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        materials.forEach(function (material: any) { if (material && material.dispose) material.dispose(); });
      });
    }
    volumeBoxResizePreview = null;
    if (volumeBoxResizeHiddenObject) volumeBoxResizeHiddenObject.visible = true;
    volumeBoxResizeHiddenObject = null;
  }

  // Cubo moldável — cópia independente dos 8 cantos (zero se
  // box.cornerOffsets ainda não existe) pra servir de base de trabalho
  // durante o arraste, sem tocar no dado persistido até o pointerup.
  function cloneVolumeBoxCornerOffsets(box: any): { x: number; y: number; z: number }[] {
    var base = box.cornerOffsets;
    var out = [];
    for (var i = 0; i < 8; i++) {
      var o = base ? base[i] : null;
      out.push({ x: o ? o.x : 0, y: o ? o.y : 0, z: o ? o.z : 0 });
    }
    return out;
  }

  function beginVolumeBoxResizePreview(volumeBoxId: string) {
    clearVolumeBoxResizePreview();
    var source: any = findVolumeBoxSceneObject(volumeBoxId);
    if (!source) return;
    volumeBoxResizeHiddenObject = source;
    source.visible = false;
    var box = Store.findVolumeBox(volumeBoxId);
    if (!box) { source.visible = true; volumeBoxResizeHiddenObject = null; return; }
    volumeBoxResizePreview = new THREE.Group();
    volumeBoxResizePreview.position.copy(source.position);
    volumeBoxResizePreview.rotation.copy(source.rotation);
    volumeBoxResizePreview.renderOrder = 998;
    scene.add(volumeBoxResizePreview);
    updateVolumeBoxSkewPreview(box, box.cornerOffsets);
  }

  // Reconstrói a malha fantasma a partir de uma cópia de trabalho de
  // cornerOffsets (Scene3DRenderer.buildVolumeBoxMesh aceita um box
  // sintético — entidade real + cornerOffsets ainda não commitados).
  // 8 vértices, 36 índices — barato o bastante pra rodar a cada
  // pointermove sem preocupação de desempenho.
  function updateVolumeBoxSkewPreview(box: any, cornerOffsets: any): void {
    if (!volumeBoxResizePreview) return;
    while (volumeBoxResizePreview.children.length) volumeBoxResizePreview.remove(volumeBoxResizePreview.children[0]);
    var previewGroup: any = Scene3DRenderer.buildVolumeBoxMesh(Object.assign({}, box, { cornerOffsets: cornerOffsets }));
    previewGroup.traverse(function (obj: any) {
      if (obj.isMesh) obj.material = new THREE.MeshBasicMaterial({ color: 0x79c8ee, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    });
    volumeBoxResizePreview.add(previewGroup);
  }

  function clearStairResizePreview() {
    if (stairResizePreview) {
      scene.remove(stairResizePreview);
      stairResizePreview.traverse(function (object: any) {
        if (object.geometry && object.geometry.dispose) object.geometry.dispose();
        var materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        materials.forEach(function (material: any) { if (material && material.dispose) material.dispose(); });
      });
    }
    stairResizePreview = null;
    if (stairResizeHiddenObject) stairResizeHiddenObject.visible = true;
    stairResizeHiddenObject = null;
  }

  function beginStairResizePreview(stairId: string) {
    clearStairResizePreview();
    var source: any = findStairSceneObject(stairId);
    if (!source) return;
    stairResizeHiddenObject = source;
    source.visible = false;
    var stair = Store.findStair(stairId);
    if (!stair) { source.visible = true; stairResizeHiddenObject = null; return; }
    // Caixa fantasma simples do bounding box inteiro (largura × pé-
    // direito × corrida), mesma técnica de "volume fantasma" do Bloco
    // de Volumetria — sem clonar o .glb a cada frame do arraste.
    // Geometria ancorada em y=0 (mesma convenção de buildStairHitMesh em
    // Scene3DRenderer.ts), pra copiar a posição do source direto, sem
    // ajuste extra. A corrida vem do bounding box real do modelo já
    // carregado (getStairFootprintMeters) — só cai no pé-direito como
    // aproximação se, por algum motivo, o .glb ainda não tiver
    // carregado quando o arraste começar (não deveria acontecer, já que
    // a peça só é selecionável depois de aparecer na cena).
    var floorStackHeight = Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER();
    var stFootprintPrev = Scene3DRenderer.getStairFootprintMeters(stair);
    var lengthM = stFootprintPrev ? stFootprintPrev.depthM : floorStackHeight;
    var previewGeometry = new THREE.BoxGeometry(stair.widthM, floorStackHeight, lengthM);
    previewGeometry.translate(0, floorStackHeight / 2, 0);
    var previewMaterial = new THREE.MeshBasicMaterial({
      color: 0x79c8ee, transparent: true, opacity: 0.28,
      depthWrite: false, side: THREE.DoubleSide,
    });
    stairResizePreview = new THREE.Mesh(previewGeometry, previewMaterial);
    stairResizePreview.position.copy(source.position);
    stairResizePreview.rotation.copy(source.rotation);
    stairResizePreview.renderOrder = 998;
    scene.add(stairResizePreview);
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
    var floorTopY = currentFloorYOffset() + ((roof.atticMode || roof.steppedWallVolume || roof.steppedLowerRoofId) ? (roof.baseHeightM || 1.2) : Scene3DRenderer.WALL_HEIGHT_GETTER());
    roofResizePreviewMeshes = Scene3DRenderer.createRoofResizePreviewMeshes(previewRoof, scale, offsetX, offsetY, floorTopY);
    roofResizePreviewMeshes.forEach(function (object) { scene.add(object); });
  }

  function beginWallResizePreview(wallIds: string[]) {
    wallResizeHiddenObjects = scene.children.filter(function (object: any) {
      return object.userData && object.userData.wallId && wallIds.indexOf(object.userData.wallId) !== -1;
    });
    wallResizeHiddenObjects.forEach(function (object) { object.visible = false; });
  }

  function clearWallResizePreview() {
    if (wallResizePreviewFrame != null) cancelAnimationFrame(wallResizePreviewFrame);
    wallResizePreviewFrame = null;
    pendingWallResizePreview = null;
    wallResizePreviewMeshes.forEach(function (object: any) {
      scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      var materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(function (material: any) { if (material && material.dispose) material.dispose(); });
    });
    wallResizePreviewMeshes = [];
    wallResizeHiddenObjects.forEach(function (object) { object.visible = true; });
    wallResizeHiddenObjects = [];
    wallResizeLiveCandidate = null;
  }

  // wallHeight opcional: usado tanto pelo arraste de UMA parede (altura
  // padrão do pavimento, footprint/posição mudando) quanto pelo arraste
  // de altura de CÔMODO (DEC-88: posição igual, só a altura candidata
  // muda) — mesma prévia fantasma, dois gestos diferentes.
  function previewWallResize(candidateWalls: any[], wallIds: string[], wallHeight?: number) {
    clearWallResizePreview();
    beginWallResizePreview(wallIds);
    var yOffset = currentFloorYOffset();
    wallResizePreviewMeshes = Scene3DRenderer.createWallResizePreviewMeshes(
      candidateWalls, wallIds, scale, offsetX, offsetY, yOffset, wallHeight != null ? wallHeight : Scene3DRenderer.WALL_HEIGHT_GETTER()
    );
    wallResizePreviewMeshes.forEach(function (object) { scene.add(object); });
  }

  // Eventos de ponteiro podem chegar bem mais rápido que a tela consegue
  // desenhar. Mantém somente a prévia mais recente e cria no máximo uma
  // geometria fantasma por quadro.
  function scheduleWallResizePreview(candidateWalls: any[], previewIds: string[]) {
    pendingWallResizePreview = { candidateWalls: candidateWalls, previewIds: previewIds };
    if (wallResizePreviewFrame != null) return;
    wallResizePreviewFrame = requestAnimationFrame(function () {
      wallResizePreviewFrame = null;
      var pending = pendingWallResizePreview;
      pendingWallResizePreview = null;
      if (pending) {
        var liveCandidate = wallResizeLiveCandidate;
        previewWallResize(pending.candidateWalls, pending.previewIds);
        wallResizeLiveCandidate = liveCandidate;
      }
    });
  }

  // Calcula o candidato de arraste (offset perpendicular, posição final
  // da parede arrastada e das vizinhas ligadas, e a lista de paredes
  // "como ficaria") a partir de um evento de ponteiro — usado tanto pela
  // prévia (pointermove, sem tocar no Store) quanto pelo commit final
  // (pointerup, chamando o Store uma única vez). Mesma matemática de
  // sempre (Core.resolveWallResizeOffset/resolveWallOffsetAgainstOpenings),
  // só que devolvida como dado em vez de aplicada direto.
  function resolveWallResizeCandidate(e: any) {
    if (!resizeWallId || !dragElementStart || !dragGroundStart) return null;
    var gp = getGroundModelPoint(e.clientX, e.clientY);
    if (!gp) return null;
    var rawDx = gp.x - dragGroundStart.x, rawDy = gp.y - dragGroundStart.y;
    var requestedOffset = Core.snap(rawDx * dragElementStart.nx + rawDy * dragElementStart.ny);
    var offsetResolution = dragElementStart.ownerCount > 0
      ? Core.resolveWallResizeOffset(
          dragElementStart.originalWall,
          dragElementStart.diagnosticBefore,
          requestedOffset,
          dragElementStart.nx,
          dragElementStart.ny
        )
      : { offset: requestedOffset, limited: false, blockingWallId: null };
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
    offset = openingResolution.offset;
    var hint: string | null = null;
    if (openingResolution.limited) {
      hint = 'Movimento bloqueado: a parede não pode atravessar uma porta ou janela.';
    } else if (offsetResolution.limited) {
      hint = 'Limite atingido: a parede não pode atravessar outra parede da planta.';
    }
    dragElementStart.resizeLimitWallId = offsetResolution.limited ? offsetResolution.blockingWallId : null;
    var rx1 = dragElementStart.x1 + dragElementStart.nx * offset, ry1 = dragElementStart.y1 + dragElementStart.ny * offset;
    var rx2 = dragElementStart.x2 + dragElementStart.nx * offset, ry2 = dragElementStart.y2 + dragElementStart.ny * offset;
    var linked = dragElementStart.linksStart.map(function (l: any) { return { id: l.id, which: l.which, x: rx1, y: ry1 }; })
      .concat(dragElementStart.linksEnd.map(function (l: any) { return { id: l.id, which: l.which, x: rx2, y: ry2 }; }));
    var candidateWalls = Store.currentWalls().map(function (cw: any) {
      if (cw.id === resizeWallId) return Object.assign({}, cw, { x1: rx1, y1: ry1, x2: rx2, y2: ry2 });
      var matchingLinks = linked.filter(function (l: any) { return l.id === cw.id; });
      if (!matchingLinks.length) return cw;
      var patched = cw;
      matchingLinks.forEach(function (l: any) {
        patched = Object.assign({}, patched, l.which === 1 ? { x1: l.x, y1: l.y } : { x2: l.x, y2: l.y });
      });
      return patched;
    });
    var previewIds = [resizeWallId].concat(linked.map(function (l: any) { return l.id; }));
    return { offset: offset, rx1: rx1, ry1: ry1, rx2: rx2, ry2: ry2, linked: linked, candidateWalls: candidateWalls, previewIds: previewIds, hint: hint };
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

  // Bloco de Volumetria sempre livre agora (sem ímã de parede, ver
  // types.ts) — posição do modelo é sempre x/y direto.
  function volumeBoxModelCenter(box: any) {
    return { x: box.x || 0, y: box.y || 0 };
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

  // Estúdio de Fachadas: enquadra frontalmente a maior parede do
  // pavimento (ou a parede informada). Continua usando a mesma câmera e
  // o mesmo Project; é apenas uma projeção de trabalho do modelo 3D.
  export function focusFacade(wallId?: string): string | null {
    const walls = Store.currentWalls().filter((wall) => !wall.demolished);
    if (!walls.length) return null;
    const chosen = (wallId ? walls.find((wall) => wall.id === wallId) : undefined)
      || walls.reduce((longest, wall) => Core.wallLengthMeters(wall) > Core.wallLengthMeters(longest) ? wall : longest);
    const dx = chosen.x2 - chosen.x1;
    const dz = chosen.y2 - chosen.y1;
    const lengthGrid = Math.hypot(dx, dz);
    if (lengthGrid < 1e-6) return null;
    const ux = dx / lengthGrid;
    const uz = dz / lengthGrid;
    camAngle = Math.atan2(ux, -uz);
    camElev = 0.08;
    camDist = Math.max(8, Core.wallLengthMeters(chosen) * 1.25);
    camTarget.x = (chosen.x1 + chosen.x2) / (2 * Core.GRID);
    camTarget.y = 1.45;
    camTarget.z = (chosen.y1 + chosen.y2) / (2 * Core.GRID);
    updateCam();
    return chosen.id;
  }

  export function setFacadeNightMode(enabled: boolean): void {
    Scene3DRenderer.setFacadeNightMode(enabled);
    render();
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
    // Com uma ferramenta hidráulica armada, o móvel vira só referência
    // visual — não pode "roubar" o clique da parede/piso atrás dele (ex.:
    // clicar na parede atrás de um vaso ou de um box de banheiro pra
    // posicionar o ponto de água/esgoto). Continua desenhado normalmente,
    // só sai da lista de coisas que o raycast enxerga.
    if (hydraulicFixtureKeyFromTool(currentTool)) return best ? best.object : null;
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
    // Mesma ideia pra porta/janela com modelo glTF (Opening.productId,
    // ver Scene3DRenderer.buildOpeningModelPiece) — também um grupo
    // aninhado, fora do caminho não-recursivo de 'targets' acima.
    var openingModelHits = raycaster.intersectObjects(Scene3DRenderer.getOpeningModelMeshes(), true);
    if (openingModelHits.length && (!best || openingModelHits[0]!.distance < best.distance) && (!furnitureHits.length || openingModelHits[0]!.distance < furnitureHits[0]!.distance)) {
      var openingNode: any = openingModelHits[0]!.object;
      while (openingNode && !openingNode.userData.openingId) openingNode = openingNode.parent;
      if (openingNode) return openingNode;
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
        (o.userData.category !== 'laje' || currentTool === 'paintBucket');
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
    // Quando duas alças se projetam próximas na tela, a elevação do
    // telhado inteiro não pode ser roubada pela esfera da cumeeira que
    // estiver alguns centímetros à frente no espaço 3D. A alça laranja
    // recebe prioridade sempre que o próprio raio realmente a atingiu.
    var wholeRoofHit = hits.find(function (hit: any) { return hit.object.userData.handle === 'roofBaseHeight'; });
    return wholeRoofHit ? wholeRoofHit.object.userData.handle : (hits.length ? hits[0]!.object.userData.handle : null);
  }

  function isEditableMesh(mesh: any) {
    if (!mesh) return false;
    var editingIdx = Store.getProject().currentFloorIndex;
    if (mesh.userData.floorIndex !== editingIdx) return false;
    return mesh.userData.category === 'paredesTerreo' || mesh.userData.category === 'paredesSuperiores' || mesh.userData.category === 'colunas' || mesh.userData.category === 'telhado' || mesh.userData.category === 'aberturas' || mesh.userData.category === 'varanda' || mesh.userData.category === 'furniture' || mesh.userData.category === 'glazingPanel' || mesh.userData.category === 'balconyRailing' || mesh.userData.category === 'volumeBox' || mesh.userData.category === 'stair' || mesh.userData.category === 'forroDrywall' || !!mesh.userData.lajeId || !!mesh.userData.hydraulicEditable;
  }

  function select(wallId: any) {
    selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedWallId = wallId; gizmoMenuOpen = false;
    heightAdjustArmedWallId = null;
    if (DEBUG_COLOR_MODE && wallId) hintEl.textContent = 'Debug — parede selecionada: ' + wallId;
    render();
  }
  function selectColumn(columnId: any) { selectedWallId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedColumnId = columnId; gizmoMenuOpen = false; render(); }
  function selectRoof(roofId: any) { selectedWallId = null; selectedColumnId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedRoofId = roofId; gizmoMenuOpen = true; render(); var selectedRoof = Store.findRoof(roofId); if (selectedRoof && (selectedRoof.steppedWallVolume || selectedRoof.steppedLowerRoofId)) hintEl.textContent = 'Telhado superior independente: suas alças controlam somente ele e sua parede de extensão.'; }

  function connectedRoofIds(startId: any) {
    var selected = Store.findRoof(startId);
    if (!selected || !selected.compoundGroupId) return [startId];
    return Store.currentRoofs().filter(function (roof) {
      return roof.compoundGroupId === selected!.compoundGroupId;
    }).map(function (roof) { return roof.id; });
  }

  // "Agarra" o cômodo inteiro (clique único numa parede que fecha só um
  // cômodo) — sem seleção de parede individual, sem gizmo de parede.
  function selectRoomGroup(wallIds: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedRoomWallIds = wallIds; gizmoMenuOpen = false; render(); }
  // Porta/janela: gizmo próprio (deslizar/excluir), sempre visível assim
  // que seleciona — diferente de parede/coluna/telhado, não precisa de
  // um segundo clique (clique direito) pra "abrir o menu", porque não
  // existe aqui a ambiguidade de "agarrar o cômodo inteiro" que motivou
  // aquele gesto extra nos outros tipos.
  function selectOpening(openingId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedOpeningId = openingId; gizmoMenuOpen = false; render(); }
  // Varanda: mesmo padrão do telhado (clique seleciona, clique direito
  // de novo abre o menu com girar/excluir).
  function selectVaranda(varandaId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedVarandaId = varandaId; gizmoMenuOpen = true; render(); }
  // Laje: mesmo padrão da varanda — clique seleciona, arraste livre nas
  // bordas (nunca trava em contorno de parede — ver DEC-35).

  function selectGlazingPanel(glazingPanelId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedGlazingPanelId = glazingPanelId; gizmoMenuOpen = false; openObjectPanel('glazingMaterial'); render(); }
  // Sacada de vidro: mesmo padrão do móvel — reaproveita o gizmo
  // genérico (girar/excluir), sem painel de material próprio nesta v1.
  function selectBalconyRailing(balconyRailingId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedBalconyRailingId = balconyRailingId; gizmoMenuOpen = false; render(); }
  function selectVolumeBox(volumeBoxId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedVolumeBoxId = volumeBoxId; gizmoMenuOpen = false; render(); }
  function selectStair(stairId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedStairId = stairId; gizmoMenuOpen = false; render(); }
  // Forro de drywall: sem entidade/id próprio (derivado do cômodo pelo
  // botão "Gerar Forro", ver Scene3DRenderer) — a chave é o roomKey
  // gravado em userData pelas peças da malha (placa/perfis/pendurais/
  // tabica), mesmo espírito de selectRoomGroup, mas com painel de tipo
  // de placa em vez de gizmo de girar/excluir.
  function selectForro(roomKey: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedPlanUnderlay = false; selectedForroRoomKey = roomKey; gizmoMenuOpen = false; render(); }
  // Planta baixa importada: sem ID (é singular por pavimento), só um
  // flag — mesmo padrão de gizmo dedicado do Bloco de Volumetria.
  function selectPlanUnderlay() { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = true; gizmoMenuOpen = false; render(); }
  // Móvel: mesmo padrão da coluna (clique seleciona e já mostra o gizmo
  // completo — girar/duplicar/excluir — sem precisar de segundo clique).
  function selectFurniture(furnitureId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedFurnitureId = furnitureId; gizmoMenuOpen = false; render(); }
  function selectHydraulicNode(hydraulicNodeId: any) { selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedHydraulicNodeId = hydraulicNodeId; gizmoMenuOpen = true; render(); }
  function deselect() {
    commitRoomGroupIfNeeded(); // "clicou fora do objeto" — decide agora se funde
    var leavingRoof = selectedRoofId ? Store.findRoof(selectedRoofId) : null;
    if (leavingRoof && leavingRoof.atticMode === 'preview') pendingGenerateRoofId = leavingRoof.id;
    selectedWallId = null; selectedColumnId = null; selectedRoofId = null; selectedRoomWallIds = null; resizeWallId = null; selectedOpeningId = null; selectedVarandaId = null; selectedLajeId = null; selectedFurnitureId = null; selectedGlazingPanelId = null; selectedBalconyRailingId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; selectedHydraulicNodeId = null;
    heightAdjustArmedWallId = null;
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

  function findHydraulicFixtureSceneObjects(id: string) {
    return scene.children.filter(function (object: any) {
      return object.userData && object.userData.hydraulicNodeId === id;
    });
  }
  function addMaterialRange(label: string, value: number, min: number, max: number, step: number, onPreview: (value: number) => void) {
    var row = document.createElement('label'); row.className = 'material-control';
    var caption = document.createElement('span'); caption.textContent = label;
    var input = document.createElement('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    var output = document.createElement('output'); output.textContent = value.toFixed(step < 0.1 ? 2 : 1);
    var transactionOpen = false;
    input.addEventListener('pointerdown', function () { Store.commands.beginTransaction(); transactionOpen = true; });
    input.addEventListener('input', function () { output.textContent = Number(input.value).toFixed(step < 0.1 ? 2 : 1); onPreview(Number(input.value)); });
    input.addEventListener('change', function () { if (!transactionOpen) { Store.commands.beginTransaction(); onPreview(Number(input.value)); } transactionOpen = false; });
    row.appendChild(caption); row.appendChild(input); row.appendChild(output); objectPanelBodyEl.appendChild(row);
  }
  function renderGlazingMaterialControls() {
    var panel = selectedGlazingPanelId ? Store.findGlazingPanel(selectedGlazingPanelId) : null;
    if (!panel) { closeObjectPanel(); return; }
    var material: any = { ...DEFAULT_GLAZING_GLASS_MATERIAL, ...(panel.glassMaterial || {}) };
    function preview(key: string, value: any) { material = { ...material, [key]: value }; Store.commands.updateGlazingGlassMaterialLive(panel!.id, material); }
    addSectionLabel('Vidro espelhado');
    var colorRow = document.createElement('label'); colorRow.className = 'material-control';
    var colorLabel = document.createElement('span'); colorLabel.textContent = 'Cor';
    var colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = material.color;
    var colorOutput = document.createElement('output'); colorOutput.textContent = material.color.toUpperCase();
    colorInput.addEventListener('input', function () { colorOutput.textContent = colorInput.value.toUpperCase(); });
    colorInput.addEventListener('pointerdown', function () { Store.commands.beginTransaction(); });
    colorInput.addEventListener('input', function () { colorOutput.textContent = colorInput.value.toUpperCase(); preview('color', colorInput.value); });
    colorRow.appendChild(colorLabel); colorRow.appendChild(colorInput); colorRow.appendChild(colorOutput); objectPanelBodyEl.appendChild(colorRow);
    addMaterialRange('Opacidade', material.opacity, 0.5, 1, 0.01, function (v) { preview('opacity', v); });
    addMaterialRange('Rugosidade', material.roughness, 0, 0.5, 0.01, function (v) { preview('roughness', v); });
    addMaterialRange('Metalicidade', material.metalness, 0, 1, 0.01, function (v) { preview('metalness', v); });
    addMaterialRange('Reflexo', material.reflectionIntensity, 0, 3, 0.02, function (v) { preview('reflectionIntensity', v); });
    var actions = document.createElement('div'); actions.className = 'material-actions';
    var reset = document.createElement('button'); reset.textContent = 'Restaurar padrão'; reset.title = 'Usar novamente o vidro inicial oficial do Esboce';
    reset.addEventListener('click', function () { Store.commands.setGlazingGlassMaterial(panel!.id, null); renderObjectPanelBody('glazingMaterial'); });
    actions.appendChild(reset); objectPanelBodyEl.appendChild(actions);
  }
  function renderObjectPanelBody(category: any) {
    objectPanelBodyEl.innerHTML = '';
    var project = Store.getProject();
    if (category === 'glazingMaterial') {
      renderGlazingMaterialControls();
    } else if (category === 'fundacao') {
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

  // Encosta "el" imediatamente à ESQUERDA de "refEl" (ambos já visíveis
  // e posicionados), com "gapPx" de respiro entre os dois — usa a
  // LARGURA REAL renderizada de cada um (getBoundingClientRect), não
  // um número fixo de pixel chutado. Painel de telhado (tipo de água),
  // gizmo de mover/girar e paleta de cor ficam em fila, um encostado
  // no outro sem sobrepor, não importa quantos botões cada um tenha
  // hoje ou ganhe no futuro — resolve a raiz do problema de overlap
  // (offsets fixos como -60/-100 não sabiam a largura de cada painel,
  // então painéis largos invadiam o vizinho).
  function stackLeftOf(el: any, refEl: any, gapPx: any) {
    var refRect = refEl.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    // style.left é o CENTRO do elemento (o CSS usa transform:
    // translate(-50%, ...) pra centralizar) — por isso soma metade da
    // própria largura na conta, não só a do vizinho.
    el.style.left = (refRect.left - gapPx - elRect.width / 2) + 'px';
  }

  // ---- Cotas temporárias durante o arraste de um ponto hidráulico
  // (altura + distância até cada ponta da parede) — independentes das
  // cotas persistentes acima: aparecem mesmo com o toggle "Cotas"
  // desligado, e só existem durante o próprio arraste. ----
  function clearHydraulicDragCotas() {
    hydraulicDragCotaEntries.forEach(function (entry) { entry.el.remove(); });
    hydraulicDragCotaEntries = [];
  }

  function showHydraulicDragCotas(node: any, wall: any) {
    if (!hydraulicDragCotaLayerEl) return;
    clearHydraulicDragCotas();
    var offsets = hydraulicNodeWallOffsetsMeters(node, wall);
    if (!offsets) return;
    var yOffset = currentFloorYOffset();
    function add(worldX: number, worldY: number, worldZ: number, text: string) {
      var el = document.createElement('div');
      el.className = 'dim-cota hydraulic-drag-cota';
      el.textContent = text;
      hydraulicDragCotaLayerEl.appendChild(el);
      hydraulicDragCotaEntries.push({ el: el, x: worldX, y: worldY, z: worldZ });
    }
    var pointWorld = modelToWorld(node.x, node.y);
    add(pointWorld.x, yOffset + node.elevationM, pointWorld.z, node.elevationM.toFixed(2).replace('.', ',') + ' m de altura');
    var start = modelToWorld(wall.x1, wall.y1);
    var startMid = { x: (pointWorld.x + start.x) / 2, z: (pointWorld.z + start.z) / 2 };
    add(startMid.x, yOffset + node.elevationM * 0.4, startMid.z, offsets.fromStartM.toFixed(2).replace('.', ',') + ' m');
    var end = modelToWorld(wall.x2, wall.y2);
    var endMid = { x: (pointWorld.x + end.x) / 2, z: (pointWorld.z + end.z) / 2 };
    add(endMid.x, yOffset + node.elevationM * 0.4, endMid.z, offsets.fromEndM.toFixed(2).replace('.', ',') + ' m');
  }

  function repositionHydraulicDragCotas() {
    if (!hydraulicDragCotaEntries.length) return;
    hydraulicDragCotaEntries.forEach(function (entry) { positionFloatingPanel(entry.el, entry.x, entry.y, entry.z, 0); });
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
    if (!selectedVarandaId) varandaTypePanelEl?.classList.remove('visible');
    if (selectedHydraulicNodeId) {
      var hydraulicNode = Store.findHydraulicNode(selectedHydraulicNodeId);
      var hydraulicFlipButton = roomGizmoEl.querySelector('[data-action="flipHydraulicFace"]');
      if (hydraulicFlipButton) hydraulicFlipButton.style.display = hydraulicNode && hydraulicNode.placementSurface === 'wall' ? '' : 'none';
      var hydraulicRouteButton = roomGizmoEl.querySelector('[data-action="routeHydraulicToSource"]');
      if (hydraulicRouteButton) hydraulicRouteButton.style.display = hydraulicNode && hydraulicNode.kind === 'fixture' && !!hydraulicNode.fixtureType ? '' : 'none';
      if (!hydraulicNode) {
        selectedHydraulicNodeId = null;
        roomGizmoEl.classList.remove('visible');
      } else {
        var hydraulicWorld = modelToWorld(hydraulicNode.x, hydraulicNode.y);
        var hydraulicTop = (hydraulicNode.floorIndex || 0) * Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER() + hydraulicNode.elevationM + 0.18;
        positionFloatingPanel(roomGizmoEl, hydraulicWorld.x, hydraulicTop, hydraulicWorld.z, 0);
        roomGizmoEl.classList.add('visible');
      }
      gizmoEl.classList.remove('visible'); openingGizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); volumeBoxGizmoEl?.classList.remove('visible'); stairGizmoEl?.classList.remove('visible'); stairTypePanelEl?.classList.remove('visible'); forroTypePanelEl?.classList.remove('visible'); planUnderlayGizmoEl?.classList.remove('visible');
      return;
    }
    var inactiveHydraulicFlipButton = roomGizmoEl.querySelector('[data-action="flipHydraulicFace"]');
    if (inactiveHydraulicFlipButton) inactiveHydraulicFlipButton.style.display = 'none';
    var inactiveHydraulicRouteButton = roomGizmoEl.querySelector('[data-action="routeHydraulicToSource"]');
    if (inactiveHydraulicRouteButton) inactiveHydraulicRouteButton.style.display = 'none';
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
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); volumeBoxGizmoEl?.classList.remove('visible'); stairGizmoEl?.classList.remove('visible'); stairTypePanelEl?.classList.remove('visible'); forroTypePanelEl?.classList.remove('visible'); planUnderlayGizmoEl?.classList.remove('visible');
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
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); volumeBoxGizmoEl?.classList.remove('visible'); stairGizmoEl?.classList.remove('visible'); stairTypePanelEl?.classList.remove('visible'); forroTypePanelEl?.classList.remove('visible'); planUnderlayGizmoEl?.classList.remove('visible');
      return;
    }
    roomGizmoEl.classList.remove('visible');

    // Bloco de Volumetria: gizmo PRÓPRIO (volumeBoxGizmoEl, não
    // reaproveita roomGizmoEl — ver GizmoController) porque tem mais
    // botões (altura/largura/subir/descer, além de fechar/excluir).
    if (selectedVolumeBoxId) {
      var vbSel = Store.findVolumeBox(selectedVolumeBoxId);
      if (!vbSel) {
        selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false;
        volumeBoxGizmoEl?.classList.remove('visible');
      } else {
        var centerVb = volumeBoxModelCenter(vbSel);
        var wpVb = modelToWorld(centerVb.x, centerVb.y);
        var topYVb = currentFloorYOffset() + (vbSel.sillHeightM || 0) + vbSel.heightM + 0.15;
        if (volumeBoxGizmoEl) {
          positionFloatingPanel(volumeBoxGizmoEl, wpVb.x, topYVb, wpVb.z, 0);
          volumeBoxGizmoEl.classList.add('visible');
        }
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); roomGizmoEl.classList.remove('visible'); planUnderlayGizmoEl?.classList.remove('visible');
      return;
    }
    roomGizmoEl.classList.remove('visible');
    volumeBoxGizmoEl?.classList.remove('visible');

    // Escada: gizmo próprio (stairGizmoEl), mesmo padrão do Bloco de
    // Volumetria — posicionado acima do topo do lance (nível do
    // pavimento de cima), só girar/excluir (largura é só pelas alças).
    if (selectedStairId) {
      var stSelG = Store.findStair(selectedStairId);
      if (!stSelG) {
        selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false;
        stairGizmoEl?.classList.remove('visible'); stairTypePanelEl?.classList.remove('visible');
      } else {
        var wpSt = modelToWorld(stSelG.x || 0, stSelG.y || 0);
        var topYSt = currentFloorYOffset() + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER() + 0.15;
        if (stairGizmoEl) {
          positionFloatingPanel(stairGizmoEl, wpSt.x, topYSt, wpSt.z, 0);
          stairGizmoEl.classList.add('visible');
        }
        if (stairTypePanelEl) {
          positionFloatingPanel(stairTypePanelEl, wpSt.x, topYSt, wpSt.z, -60);
          stairTypePanelEl.classList.add('visible');
          stackLeftOf(stairTypePanelEl, stairGizmoEl, 8);
          stairTypePanelEl.querySelectorAll('.st').forEach(function (btn: any) { btn.classList.toggle('active', btn.dataset.stairmodel === stSelG!.model); });
        }
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); roomGizmoEl.classList.remove('visible'); planUnderlayGizmoEl?.classList.remove('visible');
      return;
    }
    stairGizmoEl?.classList.remove('visible'); stairTypePanelEl?.classList.remove('visible');

    // Forro de drywall: sem gizmo de ação própria (fechar/excluir) —
    // não é entidade individual, é derivado do cômodo pelo botão
    // "Gerar Forro" (Store.commands.generateForroDrywallForCurrentFloor)
    // e some quando o layer é desligado ou o cômodo deixa de existir.
    // Só o painel de tipo de placa (ST/RU/RF/Cimentícia). Sem x/y
    // próprio como VolumeBox/Stair — o centro vem da caixa envolvente
    // das peças da cena com esse roomKey (a malha muda a cada render).
    if (selectedForroRoomKey) {
      var forroMeshesSel = scene.children.filter(function (o: any) {
        return o.userData && o.userData.category === 'forroDrywall' && o.userData.roomKey === selectedForroRoomKey;
      });
      if (!forroMeshesSel.length) {
        selectedForroRoomKey = null;
        forroTypePanelEl?.classList.remove('visible');
      } else {
        var forroBox = new THREE.Box3();
        forroMeshesSel.forEach(function (m: any) { forroBox.expandByObject(m); });
        var forroCenter = forroBox.getCenter(new THREE.Vector3());
        if (forroTypePanelEl) {
          positionFloatingPanel(forroTypePanelEl, forroCenter.x, forroCenter.y, forroCenter.z, 0);
          forroTypePanelEl.classList.add('visible');
          var currentForroFloor = Store.getProject().floors[Store.getProject().currentFloorIndex]!;
          var currentForroTipo = (currentForroFloor.roomForroTipo || {})[selectedForroRoomKey] || 'ST';
          forroTypePanelEl.querySelectorAll('.ft').forEach(function (btn: any) { btn.classList.toggle('active', btn.dataset.forrotipo === currentForroTipo); });
        }
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible'); roomGizmoEl.classList.remove('visible'); volumeBoxGizmoEl?.classList.remove('visible'); stairGizmoEl?.classList.remove('visible'); stairTypePanelEl?.classList.remove('visible'); planUnderlayGizmoEl?.classList.remove('visible');
      return;
    }
    forroTypePanelEl?.classList.remove('visible');

    // Planta baixa importada: gizmo próprio (planUnderlayGizmoEl),
    // mesmo padrão do Bloco de Volumetria acima — posicionado um
    // pouco acima do chão, no centro da planta.
    if (selectedPlanUnderlay) {
      var puSel = Store.currentPlanUnderlay();
      if (!puSel) {
        selectedPlanUnderlay = false;
        planUnderlayGizmoEl?.classList.remove('visible');
      } else {
        var wpU = modelToWorld(puSel.x, puSel.y);
        var topYU = currentFloorYOffset() + 0.3;
        if (planUnderlayGizmoEl) {
          positionFloatingPanel(planUnderlayGizmoEl, wpU.x, topYU, wpU.z, 0);
          planUnderlayGizmoEl.classList.add('visible');
        }
      }
      gizmoEl.classList.remove('visible'); columnShapePanelEl.classList.remove('visible'); roofTypePanelEl.classList.remove('visible');
      return;
    }
    planUnderlayGizmoEl?.classList.remove('visible');

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
      // Ancora o painel no PICO real do telhado (base + subida da água),
      // não numa altura genérica de piso — senão, em telhados íngremes,
      // altos ou elevados (ático, cumeeira em níveis), o ponto projetado
      // cai no meio da malha visível e o painel acaba cobrindo o próprio
      // telhado que o usuário está tentando editar.
      var roofBaseM = r.baseHeightM || Scene3DRenderer.WALL_HEIGHT_GETTER();
      var roofHalfSpanM = (r.ridgeAxis === 'x' ? Math.abs(r.y2 - r.y1) : Math.abs(r.x2 - r.x1)) / Core.GRID / 2;
      var roofRiseM = r.type === 'platibanda' ? (r.parapetHeight || 0.5) : roofHalfSpanM * Math.tan(r.pitchDeg * Math.PI / 180);
      var topY2 = yOffset + Math.max(Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), roofBaseM + roofRiseM);
      positionFloatingPanel(gizmoEl, mid2.x, topY2, mid2.z, 0);
      gizmoEl.classList.add('visible');
      positionFloatingPanel(roofTypePanelEl, mid2.x, topY2, mid2.z, -60);
      roofTypePanelEl.classList.add('visible');
      stackLeftOf(roofTypePanelEl, gizmoEl, 8);
      var elevationRoof = (r.atticMode || r.steppedWallVolume || r.steppedLowerRoofId) ? r : null;
      var canElevateWholeRoof = !!elevationRoof;
      if (roofElevationControlEl) roofElevationControlEl.style.display = canElevateWholeRoof ? 'grid' : 'none';
      if (elevationRoof && roofElevationInputEl && document.activeElement !== roofElevationInputEl) {
        var currentWallHeightM = Scene3DRenderer.WALL_HEIGHT_GETTER();
        var elevationM = (elevationRoof.steppedWallVolume || elevationRoof.steppedLowerRoofId) ? Math.max(elevationRoof.baseHeightM || currentWallHeightM, currentWallHeightM + 0.15) : (elevationRoof.baseHeightM || 1.2);
        roofElevationInputEl.value = String(elevationM);
        if (roofElevationValueEl) roofElevationValueEl.textContent = elevationM.toFixed(2).replace('.', ',') + ' m';
      }
      var axisBtn = roofTypePanelEl.querySelector('.roof-axis');
      if (axisBtn) {
        axisBtn.style.display = r.type === 'platibanda' ? 'none' : '';
        axisBtn.textContent = (r.type === 'umaAgua' ? '↔ Caimento: eixo ' : '↔ Cumeeira: eixo ') + r.ridgeAxis.toUpperCase();
      }
      var moldingBtn = roofTypePanelEl.querySelector('.roof-molding');
      if (moldingBtn) {
        moldingBtn.style.display = r.type === 'platibanda' ? '' : 'none';
        moldingBtn.classList.toggle('active', !!r.parapetMolding);
      }
      return;
    }
    roofTypePanelEl.classList.remove('visible');

    if (selectedVarandaId) {
      var vG = Store.findVaranda(selectedVarandaId);
      if (!vG) { selectedVarandaId = null; gizmoEl.classList.remove('visible'); return; }
      var midV = modelToWorld((vG.x1 + vG.x2) / 2, (vG.y1 + vG.y2) / 2);
      positionFloatingPanel(gizmoEl, midV.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), midV.z, 0);
      gizmoEl.classList.add('visible');
      varandaTypePanelEl?.classList.add('visible');
      if (varandaWidthInputEl && document.activeElement !== varandaWidthInputEl) varandaWidthInputEl.value = String(vG.widthM || 2.2);
      if (varandaHeightInputEl && document.activeElement !== varandaHeightInputEl) varandaHeightInputEl.value = String(vG.heightM || 2.7);
      if (varandaPitchInputEl && document.activeElement !== varandaPitchInputEl) varandaPitchInputEl.value = String(vG.pitchDeg || 12);
      if (varandaTypePanelEl) { positionFloatingPanel(varandaTypePanelEl, midV.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), midV.z, -60); stackLeftOf(varandaTypePanelEl, gizmoEl, 8); }
      return;
    }
    varandaTypePanelEl?.classList.remove('visible');

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
      if (!fItem) { selectedFurnitureId = null; selectedGlazingPanelId = null; selectedVolumeBoxId = null; selectedStairId = null; selectedForroRoomKey = null; selectedPlanUnderlay = false; gizmoEl.classList.remove('visible'); return; }
      var midF = modelToWorld(fItem.x, fItem.y);
      positionFloatingPanel(gizmoEl, midF.x, yOffset + Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER(), midF.z, 0);
      gizmoEl.classList.add('visible');
      if (gzSwapBtnEl) gzSwapBtnEl.style.display = '';
      return;
    }

    // Sacada de vidro: mesmo padrão do móvel acima — reaproveita o
    // gizmo genérico (girar via botão, "igual aos móveis" pedido pelo
    // Product Owner) — sem botão de troca de produto (gzSwapBtnEl já
    // fica escondido por padrão no topo desta função).
    if (selectedBalconyRailingId) {
      var brItem = Store.findBalconyRailing(selectedBalconyRailingId);
      if (!brItem) { selectedBalconyRailingId = null; gizmoEl.classList.remove('visible'); return; }
      var midBr = modelToWorld(brItem.x, brItem.y);
      var topYBr = yOffset + brItem.heightM + 0.15;
      positionFloatingPanel(gizmoEl, midBr.x, topYBr, midBr.z, 0);
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

  // Cota ao vivo enquanto arrasta — mesma ideia do "readout" do Sims: ao
  // arrastar um cômodo, mostra largura e profundidade; ao arrastar uma
  // parede solta, mostra o comprimento. Some assim que o arraste termina.
  function updateDimLabels() {
    if (!drawPreview) {
      var liveWall = dragMode === 'wallResize' && wallResizeLiveCandidate
        ? wallResizeLiveCandidate
        : (dragMode === 'endpoint1' || dragMode === 'endpoint2') && selectedWallId ? Store.findWall(selectedWallId) : null;
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
      // Sem cômodo fechado nos dois lados (parede solta/externa, ou
      // cômodo ainda não fechou) — findLiveRoomDimensions não acha
      // "parede oposta" nenhuma e volta vazio. Sem esse fallback a cota
      // simplesmente não aparecia nesses casos (reportado: "tem
      // momentos que eu arrasto a parede e a cota não aparece"). Mostra
      // o comprimento da PRÓPRIA parede — mesmo formato usado pra
      // desenhar parede nova (p.tool === 'wall' mais abaixo) — garante
      // que arrastar qualquer parede sempre mostra alguma cota.
      if (liveWall) {
        var wallLenM = Math.hypot(liveWall.x2 - liveWall.x1, liveWall.y2 - liveWall.y1) / Core.GRID;
        if (wallLenM >= 0.01) {
          var wallMid = modelToWorld((liveWall.x1 + liveWall.x2) / 2, (liveWall.y1 + liveWall.y2) / 2);
          var wallLabelY = currentFloorYOffset() + 0.12;
          var wallMidVisible = dimensionPointIsVisible({ x: wallMid.x, y: wallLabelY, z: wallMid.z });
          liveRoomDimensionLineEl.style.display = 'none';
          liveRoomDimensionLineBEl.style.display = 'none';
          dimLabelAEl.textContent = wallLenM.toFixed(2).replace('.', ',') + ' m';
          positionFloatingPanel(dimLabelAEl, wallMid.x, wallLabelY, wallMid.z, 0);
          dimLabelAEl.classList.add('visible');
          dimLabelAEl.style.display = wallMidVisible ? 'block' : 'none';
          dimLabelBEl.classList.remove('visible');
          return;
        }
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

  // Chamada a cada frame do loop de animação (ver animate() em
  // EsboceApplication.ts) — reprojeta as cotas temporárias ativas
  // (arraste de parede e de ponto hidráulico) na tela conforme a
  // câmera orbita, mesmo sem nenhuma mudança no modelo. Sem isso, girar
  // a câmera no meio de um arraste deixa a cota/linha "presa" na
  // posição de tela antiga, descolada da parede. updateDimLabels já sai
  // rápido quando nada está sendo arrastado (dragMode não bate com
  // nenhum caso e drawPreview é nulo), então é barato rodar sempre.
  function repositionLiveDimensions() {
    updateDimLabels();
    repositionHydraulicDragCotas();
  }

  function render() {
    if (selectedHydraulicNodeId && (selectedWallId || selectedColumnId || selectedRoofId || selectedOpeningId || selectedVarandaId || selectedLajeId || selectedFurnitureId || selectedGlazingPanelId || selectedBalconyRailingId || selectedVolumeBoxId || selectedRoomWallIds)) selectedHydraulicNodeId = null;
    var project = Store.getProject();
    var selectedWall = selectedWallId ? Store.findWall(selectedWallId) : null;
    var selectedColumn = selectedColumnId ? Store.findColumn(selectedColumnId) : null;
    var selectedRoof = selectedRoofId ? Store.findRoof(selectedRoofId) : null;
    var selectedOpening = selectedOpeningId ? Store.findOpening(selectedOpeningId) : null;
    var selectedVaranda = selectedVarandaId ? Store.findVaranda(selectedVarandaId) : null;
    var selectedLaje = selectedLajeId ? Store.findLaje(selectedLajeId) : null;
    Scene3DRenderer.rebuild(scene, project, { width: 0, height: 0 }, {
      highlightedCategory: steelFrameSurfaceSelectionHandler ? null : highlightedCategory,
      editingFloorIndex: project.currentFloorIndex,
      editingYOffset: currentFloorYOffset(),
      selectedWall: steelFrameSurfaceSelectionHandler ? null : selectedWall,
      selectedColumn: selectedColumn,
      selectedRoof: steelFrameSurfaceSelectionHandler ? null : selectedRoof,
      selectedOpening: selectedOpening,
      selectedVaranda: selectedVaranda,
      selectedLaje: selectedLaje,
      selectedGlazingPanel: selectedGlazingPanelId ? Store.findGlazingPanel(selectedGlazingPanelId) : null,
      selectedBalconyRailing: selectedBalconyRailingId ? Store.findBalconyRailing(selectedBalconyRailingId) : null,
      selectedVolumeBox: selectedVolumeBoxId ? Store.findVolumeBox(selectedVolumeBoxId) : null,
      selectedStair: selectedStairId ? Store.findStair(selectedStairId) : null,
      selectedHydraulicNode: selectedHydraulicNodeId ? Store.findHydraulicNode(selectedHydraulicNodeId) : null,
      roomGroupWallIds: selectedRoomWallIds,
      resizeWallId: resizeWallId,
      heightAdjustArmedWallId: heightAdjustArmedWallId,
      drawPreview: drawPreview,
      terrenoToolActive: currentTool === 'terreno',
      hideRoofs: steelFrameRoofHidden,
      steelFrameConfigMode: !!steelFrameSurfaceSelectionHandler
      ,facadeIsolatedWallIds: facadeIsolatedWallIds
    });
    positionGizmoAndShapePanel();
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
    if (selectedBalconyRailingId && !Store.findBalconyRailing(selectedBalconyRailingId)) selectedBalconyRailingId = null;
    if (selectedVolumeBoxId && !Store.findVolumeBox(selectedVolumeBoxId)) selectedVolumeBoxId = null;
    if (selectedStairId && !Store.findStair(selectedStairId)) selectedStairId = null;
    if (selectedPlanUnderlay && !Store.currentPlanUnderlay()) selectedPlanUnderlay = false;
    if (selectedHydraulicNodeId && !Store.findHydraulicNode(selectedHydraulicNodeId)) selectedHydraulicNodeId = null;
    if (resizeWallId && !Store.findWall(resizeWallId)) resizeWallId = null;
    if (selectedRoomWallIds) {
      selectedRoomWallIds = selectedRoomWallIds.filter(function (id: any) { return !!Store.findWall(id); });
      if (!selectedRoomWallIds.length) selectedRoomWallIds = null;
    }
    updateWallGridOverlay();
    render();
  }

  // Encaixa o SVG (width até 100% do painel, height até o max-height do
  // CSS) preservando a proporção do viewBox nos dois eixos — equivalente
  // a um "object-fit: contain" manual. Sem isso, width:100% e um
  // max-height fixos e independentes um do outro deixam sobrar margem
  // vazia (letterbox do preserveAspectRatio padrão do SVG) sempre que a
  // proporção do conteúdo não bater com a da caixa — e um clique nessa
  // margem vazia projeta pra bem longe do ponto real na régua (DEC-71).
  // CSS aspect-ratio sozinho não resolve: junto com um max-height que
  // realmente entra em ação, ele encolhe a altura mas NÃO encolhe de
  // volta o width (que continua fixo em 100%), então a proporção
  // continua errada — daqui vem a necessidade de calcular os dois
  // valores em pixel na mão.
  function fitSvgToAspectRatio(svg: any, vbWidth: number, vbHeight: number) {
    svg.style.width = '100%';
    svg.style.height = 'auto';
    var naturalWidth = svg.getBoundingClientRect().width;
    if (!naturalWidth) return;
    var maxHeight = parseFloat(getComputedStyle(svg).maxHeight) || Infinity;
    var idealHeight = naturalWidth * (vbHeight / vbWidth);
    if (idealHeight <= maxHeight) {
      svg.style.height = idealHeight + 'px';
    } else {
      svg.style.height = maxHeight + 'px';
      svg.style.width = (maxHeight * (vbWidth / vbHeight)) + 'px';
    }
  }

  // ---- aba de elevação da parede (H2 — fluxo guiado de posicionamento) ----
  var HYDRAULIC_ELEVATION_MAX_HEIGHT_M = 2.6; // mesmo teto já usado no clamp de Store.commands
  // Margem ao redor do desenho da parede, em cm (mesma unidade do viewBox),
  // reservada pra régua de altura (esquerda) e régua de distância (baixo).
  var HYDRAULIC_ELEVATION_MARGIN = { left: 46, right: 12, top: 22, bottom: 34 };
  // Distância perpendicular máxima (metros) até o eixo da parede pra um
  // móvel ainda ser considerado "relevante" o bastante pra desenhar no
  // painel — mostrar o cômodo inteiro só poluiria a régua sem ajudar a
  // decidir onde por o ponto. Começou em 1 m (DEC-69) mas subiu pra 2 m
  // (DEC-70): nos móveis padrão de um cômodo "Cozinha" (3×3 m), só a
  // geladeira ficava com folga confortável (0,47 m) — mesa (0,96 m) e
  // armário (~1,00 m) caíam bem em cima do limite antigo e sumiam do
  // painel na prática, mesmo "perto o bastante" aos olhos do usuário.
  var HYDRAULIC_ELEVATION_FURNITURE_MAX_DISTANCE_M = 2;

  // Silhuetas dos móveis já instalados perto da parede sendo editada
  // (DEC-69) — referência visual pro usuário não posicionar um ponto
  // hidráulico atrás de um armário, por exemplo. A dimensão real de um
  // móvel só existe depois que o glTF carrega (não tem largura/altura em
  // catálogo — ver Furniture em types.ts), então lê a caixa delimitadora
  // do objeto já carregado na cena 3D viva; se ainda não carregou
  // (findFurnitureSceneObject devolve null), pula esse móvel sem travar
  // o painel — o carregamento é assíncrono e o painel não reage em tempo
  // real a isso.
  function furnitureSilhouettesForWall(wall: any) {
    var dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    var lengthGrid = Math.hypot(dx, dy) || 1;
    var nx = -dy / lengthGrid, ny = dx / lengthGrid; // versor perpendicular à parede
    var yOffset = currentFloorYOffset();
    var results: { fromStartM: number; toStartM: number; minHeightM: number; maxHeightM: number; label: string }[] = [];
    Store.currentFurniture().forEach(function (item: any) {
      var object = findFurnitureSceneObject(item.id);
      if (!object) return;
      var box = new THREE.Box3().setFromObject(object);
      // 4 cantos da base da caixa (mundo -> modelo), em unidade de grade —
      // caixa alinhada aos eixos do MUNDO, então se o móvel estiver
      // rotacionado fora dos eixos a silhueta pode ficar levemente maior
      // que o footprint real. Aproximação visual deliberada (DEC-69),
      // mesmo espírito de simplificação já usado na vista de topo do
      // terreno (DEC-59/60) — não é CAD preciso.
      var cornerMinMin = worldToModel(box.min.x, box.min.z);
      var cornerMinMax = worldToModel(box.min.x, box.max.z);
      var cornerMaxMin = worldToModel(box.max.x, box.min.z);
      var cornerMaxMax = worldToModel(box.max.x, box.max.z);
      var corners = [cornerMinMin, cornerMinMax, cornerMaxMin, cornerMaxMax];
      var centerX = (cornerMinMin.x + cornerMaxMax.x) / 2, centerY = (cornerMinMin.y + cornerMaxMax.y) / 2;
      var distM = Math.abs((centerX - wall.x1) * nx + (centerY - wall.y1) * ny) / Core.GRID;
      if (distM > HYDRAULIC_ELEVATION_FURNITURE_MAX_DISTANCE_M) return;
      var ts = corners.map(function (c) { return ((c.x - wall.x1) * dx + (c.y - wall.y1) * dy) / (lengthGrid * lengthGrid); });
      var minT = Math.max(0, Math.min.apply(null, ts));
      var maxT = Math.min(1, Math.max.apply(null, ts));
      if (maxT <= minT) return; // projeção caiu inteira fora do trecho da parede
      var product = Catalog.getProduct(item.productId);
      results.push({
        fromStartM: (lengthGrid * minT) / Core.GRID,
        toStartM: (lengthGrid * maxT) / Core.GRID,
        minHeightM: box.min.y - yOffset,
        maxHeightM: box.max.y - yOffset,
        label: product ? product.name : '',
      });
    });
    return results;
  }

  function closeHydraulicWallElevationPanel() {
    hydraulicWallElevationState = null;
    if (hydraulicWallElevationPanelEl) hydraulicWallElevationPanelEl.classList.remove('visible');
  }

  function openHydraulicWallElevationPanel(wallId: string, fixtureKey: string) {
    var wall = Store.findWall(wallId);
    if (!wall || !hydraulicWallElevationPanelEl) return;
    hydraulicWallElevationState = { wallId: wallId, fixtureKey: fixtureKey };
    hydraulicWallElevationPanelEl.classList.add('visible');
    if (hydraulicWallPromptEl) hydraulicWallPromptEl.style.display = 'none';
    renderHydraulicWallElevationPanel();
  }

  function renderHydraulicWallElevationPanel() {
    if (!hydraulicWallElevationState || !hydraulicWallElevationSvgEl) return;
    var wall = Store.findWall(hydraulicWallElevationState.wallId);
    if (!wall) { closeHydraulicWallElevationPanel(); return; }
    var lengthM = Core.wallLengthMeters(wall);
    var lengthCm = Math.max(1, Math.round(lengthM * 100));
    var maxHeightCm = HYDRAULIC_ELEVATION_MAX_HEIGHT_M * 100;
    var margin = HYDRAULIC_ELEVATION_MARGIN;
    var ox = margin.left, oy = margin.top;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = hydraulicWallElevationSvgEl;
    var vbWidth = lengthCm + margin.left + margin.right, vbHeight = maxHeightCm + margin.top + margin.bottom;
    svg.setAttribute('viewBox', '0 0 ' + vbWidth + ' ' + vbHeight);
    fitSvgToAspectRatio(svg, vbWidth, vbHeight);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    function addLine(x1: number, y1: number, x2: number, y2: number, opts?: any) {
      var el = document.createElementNS(svgNS, 'line');
      el.setAttribute('x1', String(x1)); el.setAttribute('y1', String(y1));
      el.setAttribute('x2', String(x2)); el.setAttribute('y2', String(y2));
      el.setAttribute('stroke', (opts && opts.stroke) || '#D3D1C7');
      el.setAttribute('stroke-width', String((opts && opts.width) || 2));
      if (opts && opts.dashed) el.setAttribute('stroke-dasharray', '10 8');
      svg.appendChild(el);
    }
    function addText(x: number, y: number, text: string, opts?: any) {
      var el = document.createElementNS(svgNS, 'text');
      el.setAttribute('x', String(x)); el.setAttribute('y', String(y));
      el.setAttribute('font-size', String((opts && opts.size) || 13));
      el.setAttribute('fill', (opts && opts.fill) || '#4F4E49');
      if (opts && opts.anchor) el.setAttribute('text-anchor', opts.anchor);
      el.textContent = text;
      svg.appendChild(el);
    }

    // contorno da parede — retângulo visível (comprimento real × altura
    // máxima permitida), fundo branco pra se destacar da margem das réguas
    var wallRect = document.createElementNS(svgNS, 'rect');
    wallRect.setAttribute('x', String(ox)); wallRect.setAttribute('y', String(oy));
    wallRect.setAttribute('width', String(lengthCm)); wallRect.setAttribute('height', String(maxHeightCm));
    wallRect.setAttribute('fill', '#FFFFFF');
    wallRect.setAttribute('stroke', '#B9B6AB');
    wallRect.setAttribute('stroke-width', '2');
    svg.appendChild(wallRect);

    // régua de altura (esquerda) — marca a cada 0,5 m, com linha-guia bem
    // clara cruzando a parede inteira pra ajudar a mirar a altura ao clicar
    for (var h = 0; h <= HYDRAULIC_ELEVATION_MAX_HEIGHT_M + 0.001; h += 0.5) {
      var hy = oy + maxHeightCm - h * 100;
      addLine(ox, hy, ox + lengthCm, hy, { stroke: '#EDEAE1', width: 1 });
      addLine(ox - 6, hy, ox, hy, { stroke: '#9C9A92', width: 1.5 });
      addText(ox - 10, hy + 4, h.toFixed(1).replace('.', ',') + ' m', { anchor: 'end', size: 10, fill: '#77756E' });
    }

    // régua de distância (baixo) — marca a cada 0,5 m (ou 1 m se a parede
    // for comprida, pra não empilhar número em cima de número)
    var distanceStep = lengthM > 6 ? 1 : 0.5;
    for (var d = 0; d <= lengthM + 0.001; d += distanceStep) {
      var dx = ox + d * 100;
      addLine(dx, oy + maxHeightCm, dx, oy + maxHeightCm + 6, { stroke: '#9C9A92', width: 1.5 });
      addText(dx, oy + maxHeightCm + 18, d.toFixed(distanceStep < 1 ? 1 : 0).replace('.', ',') + ' m', { anchor: 'middle', size: 10, fill: '#77756E' });
    }

    // linha-guia tracejada com a altura de referência do TIPO de ponto sendo posicionado agora
    var activeTemplate = hydraulicFixtureTemplate(hydraulicWallElevationState.fixtureKey);
    if (activeTemplate && activeTemplate.referenceHeightM != null) {
      var refY = oy + maxHeightCm - activeTemplate.referenceHeightM * 100;
      addLine(ox, refY, ox + lengthCm, refY, { stroke: '#5A49C7', dashed: true, width: 1.5 });
      addText(ox + 8, refY - 6, 'altura usual: ' + activeTemplate.referenceHeightM.toFixed(2).replace('.', ',') + ' m', { fill: '#5A49C7', size: 11 });
    }

    // silhuetas dos móveis próximos (DEC-69) — desenhadas ANTES dos pontos
    // hidráulicos pra ficarem atrás, sem competir visualmente com o
    // círculo/rótulo de cada ponto já posicionado
    furnitureSilhouettesForWall(wall).forEach(function (item) {
      var clampedMinH = Math.max(0, item.minHeightM);
      var clampedMaxH = Math.min(HYDRAULIC_ELEVATION_MAX_HEIGHT_M, item.maxHeightM);
      if (clampedMaxH <= clampedMinH) return; // móvel fora da faixa de altura desenhada
      var rx = ox + item.fromStartM * 100;
      var rw = Math.max(1, (item.toStartM - item.fromStartM) * 100);
      var ry = oy + maxHeightCm - clampedMaxH * 100;
      var rh = (clampedMaxH - clampedMinH) * 100;
      var rect: any = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', String(rx)); rect.setAttribute('y', String(ry));
      rect.setAttribute('width', String(rw)); rect.setAttribute('height', String(rh));
      rect.setAttribute('fill', 'rgba(90,73,199,0.12)');
      rect.setAttribute('stroke', '#9C9A92');
      rect.setAttribute('stroke-width', '1');
      rect.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(rect);
      if (item.label && rw > 40 && rh > 16) {
        addText(rx + rw / 2, ry + 14, item.label, { anchor: 'middle', size: 10, fill: '#77756E' });
      }
    });

    // pontos já existentes nessa parede (de qualquer tipo — dá contexto de onde já tem coisa)
    var project = Store.getProject();
    (project.hydraulics.nodes || []).forEach(function (node: any) {
      if (node.wallId !== wall!.id) return;
      var offsets = hydraulicNodeWallOffsetsMeters(node, wall!);
      if (!offsets) return;
      var cx = ox + offsets.fromStartM * 100;
      var cy = oy + maxHeightCm - offsets.heightM * 100;
      var circle: any = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', '9');
      circle.setAttribute('fill', node.kind === 'fixture' ? '#5A49C7' : '#8B8878');
      circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '2');
      if (node.kind === 'fixture') {
        circle.style.cursor = 'grab';
        circle.addEventListener('pointerdown', function (dragEvent: any) { beginHydraulicWallElevationDrag(dragEvent, node.id, wall!); });
      }
      svg.appendChild(circle);
      var nodeTemplate = node.fixtureType ? hydraulicFixtureTemplate(node.fixtureType) : null;
      var labelParts = [nodeTemplate ? nodeTemplate.shortLabel : node.label, offsets.heightM.toFixed(2).replace('.', ',') + ' m'];
      addText(cx, cy - 14, labelParts.join(' · '), { anchor: 'middle', size: 11 });
    });

    addText(ox + lengthCm / 2, oy - 4, lengthM.toFixed(2).replace('.', ',') + ' m de parede', { anchor: 'middle', size: 11, fill: '#9C9A92' });
  }

  // Botão de ferramenta hidráulica é "pulso": gerou um ponto, desativa
  // sozinho — se o usuário quiser outro, precisa clicar no botão de novo.
  // Só desliga a ferramenta (currentTool + destaque do botão); os painéis
  // (parede/piso) continuam abertos, prontos pro próximo clique no botão.
  function deactivateHydraulicToolButton() {
    currentTool = null;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn: any) { btn.classList.remove('active'); });
    if (hydraulicWallPromptEl) hydraulicWallPromptEl.style.display = 'none';
  }

  // Arraste fluido de um ponto já existente dentro do painel de elevação:
  // só mexe no círculo em si a cada pointermove (nada de Store, nada de
  // re-render pesado no meio do gesto — mesmo princípio de prévia fantasma
  // já usado no 3D), e grava a posição final de uma vez só no soltar.
  function beginHydraulicWallElevationDrag(e: any, nodeId: string, wall: any) {
    e.stopPropagation();
    if (!hydraulicWallElevationSvgEl) return;
    var svg = hydraulicWallElevationSvgEl;
    var circle = e.target;
    var margin = HYDRAULIC_ELEVATION_MARGIN;
    var lengthCm = Math.max(1, Math.round(Core.wallLengthMeters(wall) * 100));
    var maxHeightCm = HYDRAULIC_ELEVATION_MAX_HEIGHT_M * 100;
    function toLocal(clientX: number, clientY: number) {
      var point = svg.createSVGPoint();
      point.x = clientX; point.y = clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm) return null;
      var local = point.matrixTransform(ctm.inverse());
      return { x: Math.max(0, Math.min(lengthCm, local.x - margin.left)), y: Math.max(0, Math.min(maxHeightCm, local.y - margin.top)) };
    }
    var lastLocal = toLocal(e.clientX, e.clientY);
    function onMove(moveEvent: any) {
      var local = toLocal(moveEvent.clientX, moveEvent.clientY);
      if (!local) return;
      lastLocal = local;
      circle.setAttribute('cx', String(margin.left + local.x));
      circle.setAttribute('cy', String(margin.top + local.y));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (lastLocal) {
        var offsetM = lastLocal.x / 100;
        var heightM = (maxHeightCm - lastLocal.y) / 100;
        var resolved = hydraulicPositionFromWallOffset(wall, offsetM, Math.max(0.05, Math.min(HYDRAULIC_ELEVATION_MAX_HEIGHT_M, heightM)));
        Store.commands.updateHydraulicFixtureBodyLive(nodeId, resolved.x, resolved.y, resolved.elevationM);
      }
      renderHydraulicWallElevationPanel();
      render();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onHydraulicWallElevationSvgPointerDown(e: any) {
    if (!hydraulicWallElevationState || !hydraulicWallElevationSvgEl) return;
    // Botão "pulso": só cria ponto novo enquanto a ferramenta está
    // realmente armada (currentTool). Um clique aqui com a ferramenta já
    // desativada não faz nada — evita criar ponto sem o usuário ter
    // clicado no botão de novo, como pedido.
    if (currentTool !== 'hydraulic:' + hydraulicWallElevationState.fixtureKey) return;
    var wall = Store.findWall(hydraulicWallElevationState.wallId);
    if (!wall) return;
    var svg = hydraulicWallElevationSvgEl;
    var point = svg.createSVGPoint();
    point.x = e.clientX; point.y = e.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return;
    var local = point.matrixTransform(ctm.inverse());
    var margin = HYDRAULIC_ELEVATION_MARGIN;
    var lengthCm = Math.max(1, Math.round(Core.wallLengthMeters(wall) * 100));
    var maxHeightCm = HYDRAULIC_ELEVATION_MAX_HEIGHT_M * 100;
    var localX = local.x - margin.left, localY = local.y - margin.top;
    // Clique fora do retângulo da parede (caiu na régua) não faz nada.
    if (localX < 0 || localX > lengthCm || localY < 0 || localY > maxHeightCm) return;
    var offsetM = localX / 100;
    var heightM = (maxHeightCm - localY) / 100;
    var resolved = hydraulicPositionFromWallOffset(wall, offsetM, Math.max(0.05, Math.min(HYDRAULIC_ELEVATION_MAX_HEIGHT_M, heightM)));
    var node = Store.commands.createHydraulicFixture(hydraulicWallElevationState.fixtureKey, resolved.x, resolved.y, wall.id);
    if (node) {
      hintEl.textContent = 'Ponto posicionado.';
      deactivateHydraulicToolButton();
      renderHydraulicWallElevationPanel();
      render();
    }
  }


  // ---- desenho de percurso guiado (H2) — clique-clique de pontos-guia ----
  function clearHydraulicRouteDrawMarkers() {
    hydraulicRouteDrawMarkers.forEach(function (marker: any) { scene.remove(marker); });
    hydraulicRouteDrawMarkers = [];
  }

  function updateHydraulicRouteDrawBar() {
    if (!hydraulicRouteDrawBarEl) return;
    if (!hydraulicRouteDrawState) { hydraulicRouteDrawBarEl.style.display = 'none'; return; }
    hydraulicRouteDrawBarEl.style.display = 'flex';
    if (hydraulicRouteDrawCountEl) {
      var count = hydraulicRouteDrawState.points.length;
      hydraulicRouteDrawCountEl.textContent = count + (count === 1 ? ' ponto' : ' pontos');
    }
  }

  function beginHydraulicRouteDraw(fixtureId: string) {
    var fixture = Store.findHydraulicNode(fixtureId);
    if (!fixture || fixture.kind !== 'fixture' || !fixture.fixtureType) return;
    hydraulicRouteDrawState = { fixtureId: fixtureId, points: [] };
    clearHydraulicRouteDrawMarkers();
    roomGizmoEl.classList.remove('visible');
    hintEl.textContent = 'Clique no chão pra marcar cada ponto do percurso. Toque em "Concluir" quando terminar.';
    updateHydraulicRouteDrawBar();
    render();
  }

  function finishHydraulicRouteDraw() {
    if (!hydraulicRouteDrawState) return;
    var ok = Store.commands.setGuidedHydraulicRoute(hydraulicRouteDrawState.fixtureId, hydraulicRouteDrawState.points);
    hydraulicRouteDrawState = null;
    clearHydraulicRouteDrawMarkers();
    updateHydraulicRouteDrawBar();
    hintEl.textContent = ok ? 'Percurso salvo.' : 'Não foi possível salvar o percurso.';
    onModelChanged();
    render();
  }

  function cancelHydraulicRouteDraw() {
    hydraulicRouteDrawState = null;
    clearHydraulicRouteDrawMarkers();
    updateHydraulicRouteDrawBar();
    hintEl.textContent = '';
    render();
  }

  function addHydraulicRouteDrawPoint(x: number, y: number) {
    if (!hydraulicRouteDrawState) return;
    hydraulicRouteDrawState.points.push({ x: x, y: y });
    var world = modelToWorld(x, y);
    var marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x5A49C7, emissive: 0x5A49C7, emissiveIntensity: 0.4 })
    );
    marker.position.set(world.x, currentFloorYOffset() + 0.05, world.z);
    scene.add(marker);
    hydraulicRouteDrawMarkers.push(marker);
    updateHydraulicRouteDrawBar();
    render();
  }

  // ---- painel de piso 2D (ralos e outros pontos de piso) ----
  function closeHydraulicFloorPanel() {
    hydraulicFloorPanelState = null;
    if (hydraulicFloorPanelEl) hydraulicFloorPanelEl.classList.remove('visible');
  }

  function openHydraulicFloorPanel(fixtureKey: string) {
    if (!hydraulicFloorPanelEl) return;
    hydraulicFloorPanelState = { fixtureKey: fixtureKey };
    hydraulicFloorPanelEl.classList.add('visible');
    if (hydraulicWallPromptEl) hydraulicWallPromptEl.style.display = 'none';
    renderHydraulicFloorPanel();
  }

  function renderHydraulicFloorPanel() {
    if (!hydraulicFloorPanelState || !hydraulicFloorSvgEl || !hydraulicFloorSceneRenderer) return;
    var walls = Store.currentWalls();
    var pad = Core.GRID * 1.5; // meio metro e meio de folga ao redor da planta
    var bounds = walls.length ? {
      minX: Math.min.apply(null, walls.flatMap(function (w: any) { return [w.x1, w.x2]; })),
      maxX: Math.max.apply(null, walls.flatMap(function (w: any) { return [w.x1, w.x2]; })),
      minY: Math.min.apply(null, walls.flatMap(function (w: any) { return [w.y1, w.y2]; })),
      maxY: Math.max.apply(null, walls.flatMap(function (w: any) { return [w.y1, w.y2]; })),
    } : { minX: -200, maxX: 200, minY: -200, maxY: 200 };
    var vbWidth = bounds.maxX - bounds.minX + pad * 2, vbHeight = bounds.maxY - bounds.minY + pad * 2;
    hydraulicFloorSvgEl.setAttribute('viewBox', (bounds.minX - pad) + ' ' + (bounds.minY - pad) + ' ' + vbWidth + ' ' + vbHeight);
    fitSvgToAspectRatio(hydraulicFloorSvgEl, vbWidth, vbHeight);
    hydraulicFloorSceneRenderer.render();
    var svgNS = 'http://www.w3.org/2000/svg';
    // silhuetas (vista de cima) dos móveis do pavimento — mesmo espírito
    // da DEC-69/70 no painel de parede, mas sem filtro de distância aqui:
    // o painel de piso já é a planta inteira, então mostra todo mundo.
    // Desenhado ANTES dos pontos hidráulicos, pra ficar atrás deles.
    Store.currentFurniture().forEach(function (item: any) {
      var object = findFurnitureSceneObject(item.id);
      if (!object) return;
      var box = new THREE.Box3().setFromObject(object);
      var c1 = worldToModel(box.min.x, box.min.z), c2 = worldToModel(box.max.x, box.max.z);
      var rect: any = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', String(Math.min(c1.x, c2.x)));
      rect.setAttribute('y', String(Math.min(c1.y, c2.y)));
      rect.setAttribute('width', String(Math.abs(c2.x - c1.x)));
      rect.setAttribute('height', String(Math.abs(c2.y - c1.y)));
      rect.setAttribute('fill', 'rgba(90,73,199,0.12)');
      rect.setAttribute('stroke', '#9C9A92');
      rect.setAttribute('stroke-width', String(Core.GRID * 0.02));
      rect.setAttribute('stroke-dasharray', (Core.GRID * 0.08) + ' ' + (Core.GRID * 0.06));
      hydraulicFloorSvgEl.appendChild(rect);
    });
    // pontos de piso já existentes, de qualquer tipo — dá contexto do que já foi posicionado
    var project = Store.getProject();
    var overlay = document.createElementNS(svgNS, 'g');
    (project.hydraulics.nodes || []).forEach(function (node: any) {
      if (node.placementSurface !== 'floor') return;
      var circle: any = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', String(node.x));
      circle.setAttribute('cy', String(node.y));
      circle.setAttribute('r', String(Core.GRID * 0.12));
      circle.setAttribute('fill', '#5A49C7');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '1.5');
      circle.style.cursor = 'grab';
      circle.addEventListener('pointerdown', function (dragEvent: any) { beginHydraulicFloorDrag(dragEvent, node.id); });
      overlay.appendChild(circle);
    });
    hydraulicFloorSvgEl.appendChild(overlay);
  }

  // Mesmo princípio do arraste no painel de parede: só mexe no círculo
  // durante o gesto, grava no Store de uma vez só no soltar.
  function beginHydraulicFloorDrag(e: any, nodeId: string) {
    e.stopPropagation();
    if (!hydraulicFloorSvgEl) return;
    var svg = hydraulicFloorSvgEl;
    var circle = e.target;
    var lastLocal: { x: number; y: number } | null = null;
    function toLocal(clientX: number, clientY: number) {
      var point = svg.createSVGPoint();
      point.x = clientX; point.y = clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm) return null;
      var local = point.matrixTransform(ctm.inverse());
      return { x: local.x, y: local.y };
    }
    function onMove(moveEvent: any) {
      var local = toLocal(moveEvent.clientX, moveEvent.clientY);
      if (!local) return;
      lastLocal = local;
      circle.setAttribute('cx', String(local.x));
      circle.setAttribute('cy', String(local.y));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // Posição livre — sem arredondar pro grid (mesma decisão da DEC-65).
      if (lastLocal) Store.commands.updateHydraulicFixtureBodyLive(nodeId, lastLocal.x, lastLocal.y);
      renderHydraulicFloorPanel();
      render();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onHydraulicFloorSvgPointerDown(e: any) {
    if (!hydraulicFloorPanelState || !hydraulicFloorSvgEl) return;
    // Mesma trava do painel de parede: só cria ponto com a ferramenta armada.
    if (currentTool !== 'hydraulic:' + hydraulicFloorPanelState.fixtureKey) return;
    var point = hydraulicFloorSvgEl.createSVGPoint();
    point.x = e.clientX; point.y = e.clientY;
    var ctm = hydraulicFloorSvgEl.getScreenCTM();
    if (!ctm) return;
    var local = point.matrixTransform(ctm.inverse());
    // Posição livre — sem arredondar pro grid, por decisão explícita do
    // Product Owner (pontos de piso não travam em unidade nenhuma).
    var node = Store.commands.createHydraulicFixture(hydraulicFloorPanelState.fixtureKey, local.x, local.y, undefined);
    if (node) {
      hintEl.textContent = 'Ponto posicionado.';
      deactivateHydraulicToolButton();
      renderHydraulicFloorPanel();
      render();
    }
  }


  // ---- ferramentas ----
  function setTool(tool: any) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn: any) {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    var toolHydraulicKey = hydraulicFixtureKeyFromTool(tool);
    var toolHydraulicTemplate = toolHydraulicKey ? hydraulicFixtureTemplate(toolHydraulicKey) : null;
    hintEl.textContent = toolHydraulicTemplate
      ? (toolHydraulicTemplate.placementSurface === 'wall'
          ? 'Escolha a parede relacionada ao ponto.'
          : 'Posicione o ponto na aba do piso que abriu.')
      : TOOL_HINTS[tool] || '';
    if (hydraulicWallPromptEl) hydraulicWallPromptEl.style.display = toolHydraulicTemplate && toolHydraulicTemplate.placementSurface === 'wall' ? '' : 'none';
    closeHydraulicWallElevationPanel();
    if (toolHydraulicTemplate && toolHydraulicTemplate.placementSurface === 'floor' && toolHydraulicKey) {
      openHydraulicFloorPanel(toolHydraulicKey);
    } else {
      closeHydraulicFloorPanel();
    }
    container.classList.remove('tool-demolish', 'tool-paintBucket');
    if (tool === 'demolish' || tool === 'paintBucket') container.classList.add('tool-' + tool);
    refreshOpeningPickerPanel();
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
    refreshOpeningPickerPanel();
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
    if (!paintPickerPanelEl) return;
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
      btn.setAttribute('aria-label', p.name);
      btn.style.background = p.assets.colorHex;
      if (p.assets.thumbnailUrl) {
        btn.classList.add('has-thumbnail');
        btn.style.backgroundImage = 'url("' + (import.meta as any).env.BASE_URL + p.assets.thumbnailUrl + '")';
      }
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

  // Seletor de esquadria — mesma ideia do balde de tinta acima: só
  // aparece com a ferramenta Janela/Porta ativa, fixo no topo (não
  // depende de nenhuma seleção). Abas por MATERIAL do caixilho
  // (vidro/alumínio/PVC/madeira), dentro de cada aba a lista de
  // modelos daquele tipo+material do Catálogo — com miniatura de
  // imagem (Product.assets.thumbnailUrl) quando disponível, senão só
  // nome+tamanho em texto. Escolher um modelo só guarda a escolha
  // (pendingOpeningProductId) — a Opening em si só nasce no clique
  // sobre a parede, igual sempre foi. "Padrão" continua disponível pra
  // quem só quer um vão genérico, editável depois.
  var OPENING_MATERIALS: ['vidro' | 'aluminio' | 'pvc' | 'madeira', string][] = [
    ['vidro', 'Vidro'], ['aluminio', 'Alumínio'], ['pvc', 'PVC'], ['madeira', 'Madeira']
  ];
  function refreshOpeningPickerPanel() {
    if (currentTool !== 'window' && currentTool !== 'door') {
      openingPickerPanelEl.classList.remove('visible');
      return;
    }
    openingPickerPanelEl.innerHTML = '';
    var nav = document.createElement('div');
    nav.className = 'paint-surface-nav';
    OPENING_MATERIALS.forEach(function (item) {
      var materialBtn = document.createElement('button');
      materialBtn.className = 'paint-surface' + (openingPickerMaterial === item[0] ? ' active' : '');
      materialBtn.dataset.openingMaterial = item[0];
      materialBtn.textContent = item[1];
      nav.appendChild(materialBtn);
    });
    openingPickerPanelEl.appendChild(nav);

    var products = Catalog.getProductsByCategory(currentTool as any).filter(function (p: any) { return p.frameMaterial === openingPickerMaterial; });
    var list = document.createElement('div');
    list.className = 'paint-surface-nav';
    var defaultBtn = document.createElement('button');
    defaultBtn.className = 'paint-surface' + (pendingOpeningProductId ? '' : ' active');
    defaultBtn.dataset.openingProduct = '';
    defaultBtn.textContent = 'Padrão (editável depois)';
    list.appendChild(defaultBtn);
    if (!products.length) {
      var soon = document.createElement('div');
      soon.className = 'paint-help';
      soon.textContent = 'Nenhum modelo de ' + (OPENING_MATERIALS.filter(function (m) { return m[0] === openingPickerMaterial; })[0]![1]).toLowerCase() + ' ainda — em breve.';
      list.appendChild(soon);
    } else {
      products.forEach(function (p: any) {
        var btn = document.createElement('button');
        btn.className = 'paint-surface opening-model-btn' + (pendingOpeningProductId === p.id ? ' active' : '');
        btn.dataset.openingProduct = p.id;
        var w = p.assets.nominalWidthM, h = p.assets.nominalHeightM;
        var label = p.name + (w && h ? ' (' + w.toFixed(2).replace('.', ',') + '×' + h.toFixed(2).replace('.', ',') + 'm)' : '');
        if (p.assets.thumbnailUrl) {
          var img = document.createElement('img');
          img.src = (import.meta as any).env.BASE_URL + p.assets.thumbnailUrl;
          img.alt = '';
          img.className = 'opening-model-thumb';
          btn.appendChild(img);
          var span = document.createElement('span');
          span.textContent = label;
          btn.appendChild(span);
        } else {
          btn.textContent = label;
        }
        list.appendChild(btn);
      });
    }
    openingPickerPanelEl.appendChild(list);
    openingPickerPanelEl.classList.add('visible');
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
      // Um cômodo novo encostado num já existente nasce com uma parede
      // DUPLICADA e sobreposta na fronteira (Store.commands.createRoom
      // sempre cria 4 paredes novas, nunca reaproveita uma que já
      // exista ali) — sem fundir, ficam DOIS segmentos coincidentes no
      // mesmo eixo, e o algoritmo de mitre de canto (Core.
      // computeWallFootprints) não sabe lidar com esse cruzamento de 4
      // vias, produzindo um canto mal calculado. Sintoma reportado:
      // laje "confusa"/com brecha exatamente na junção da parede
      // compartilhada. fuseAllOverlaps já resolve isso pro cômodo
      // arrastado até encostar (commitRoomGroupIfNeeded) — só faltava
      // chamar aqui também, mesma ordem (funde antes de dividir em T)
      // já usada no fim do arraste de ponta de parede.
      var newRoomWalls = Store.commands.createRoom(p.x1, p.y1, p.x2, p.y2);
      if (newRoomWalls && newRoomWalls.length) {
        fuseAllOverlaps(newRoomWalls.map(function (w: any) { return w.id; }));
      }
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

    if (hydraulicRouteDrawState) {
      // Modo de desenho de percurso (H2): todo clique esquerdo em área
      // livre vira um ponto-guia novo; clicar num objeto existente não faz
      // nada aqui (evita criar ponto em cima de móvel/parede sem querer).
      var routeDrawMesh = pickMesh(e.clientX, e.clientY);
      if (!routeDrawMesh) {
        var routeDrawGround = getGroundModelPoint(e.clientX, e.clientY);
        if (routeDrawGround) addHydraulicRouteDrawPoint(routeDrawGround.x, routeDrawGround.y);
      }
      return;
    }

    var hydraulicFixtureKey = hydraulicFixtureKeyFromTool(currentTool);
    if (hydraulicFixtureKey) {
      var hydraulicMesh = pickMesh(e.clientX, e.clientY);
      // Um ponto existente tem prioridade sobre a ferramenta ainda armada:
      // clicar nele deve selecionar/arrastar, nunca criar uma cópia.
      if (!(hydraulicMesh && hydraulicMesh.userData.hydraulicEditable)) {
        var hydraulicGround = getGroundModelPoint(e.clientX, e.clientY);
        if (!hydraulicGround) return;
        var requiresFloor = hydraulicFixtureKey === 'toilet_waste' || hydraulicFixtureKey === 'shower_drain' || hydraulicFixtureKey === 'floor_drain';
        var hydraulicWallId = hydraulicMesh && hydraulicMesh.userData.wallId ? hydraulicMesh.userData.wallId : undefined;
        if (!requiresFloor && !hydraulicWallId) {
          hintEl.textContent = 'Este ponto precisa ser colocado diretamente sobre uma parede.';
          return;
        }
        if (!requiresFloor) {
          // Pontos de parede não nascem mais no clique em si — o clique só
          // escolhe QUAL parede; a posição precisa vem da aba de elevação.
          openHydraulicWallElevationPanel(hydraulicWallId, hydraulicFixtureKey);
          return;
        }
        // Pontos de piso também não nascem mais no clique direto — abrem a
        // aba do piso, onde a posição é livre (sem grid).
        openHydraulicFloorPanel(hydraulicFixtureKey);
        return;
      }
    }

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

    // Ferramenta "Selecionar tudo": qualquer clique (em cima de parede,
    // móvel ou vazio, tanto faz) arma o arraste da construção inteira —
    // não tem sentido selecionar UM objeto aqui, é tudo ou nada.
    if (currentTool === 'wholeConstruction') {
      var wcGround = getGroundModelPoint(e.clientX, e.clientY);
      if (!wcGround) return;
      collectWholeConstructionDragObjects();
      dragElementStart = { lastDx: 0, lastDy: 0 };
      dragGroundStart = wcGround;
      dragMode = 'wholeConstruction';
      Store.commands.beginTransaction();
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
          // A cena é reconstruída enquanto a altura muda. Capturar o
          // ponteiro no canvas mantém todos os movimentos e o pointerup
          // ligados ao mesmo gesto, mesmo quando a esfera original deixa
          // de existir no meio do arraste por causa desse rebuild.
          try { if (container.setPointerCapture) container.setPointerCapture(e.pointerId); } catch (_) {}
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
      if (handle === 'roomHeight') {
        // Alça roxa acima da parede selecionada (DEC-88) — arrasta pra
        // cima/baixo pra aumentar/diminuir a altura do CÔMODO inteiro,
        // não só desta parede.
        startRoomHeightDrag(selectedWallId, e.clientY);
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
      } else if (handle.indexOf('glazingWidth') === 0) {
        var gpWidth = Store.findGlazingPanel(selectedGlazingPanelId);
        if (gpWidth) {
          var gpCenter = glazingPanelModelCenter(gpWidth);
          var axisX = 1, axisY = 0;
          if (gpWidth.state === 'attached' && gpWidth.wallId) {
            var gpWall = Store.findWall(gpWidth.wallId);
            if (gpWall) {
              var gpWallLen = Math.hypot(gpWall.x2 - gpWall.x1, gpWall.y2 - gpWall.y1) || 1;
              axisX = (gpWall.x2 - gpWall.x1) / gpWallLen; axisY = (gpWall.y2 - gpWall.y1) / gpWallLen;
            }
          } else if (gpWidth.rotationDeg) {
            var gpAngle = gpWidth.rotationDeg * Math.PI / 180;
            axisX = Math.cos(gpAngle); axisY = Math.sin(gpAngle);
          }
          var gpSide = handle === 'glazingWidthRight' ? 1 : -1;
          var gpMaxWidth = 20;
          if (gpWidth.state === 'attached' && gpWidth.wallId) {
            var gpHostWall = Store.findWall(gpWidth.wallId);
            if (gpHostWall) {
              var gpHostLen = Core.wallLengthMeters(gpHostWall);
              var gpOffset = gpWidth.offsetM || gpHostLen / 2;
              gpMaxWidth = gpSide > 0 ? gpHostLen - (gpOffset - gpWidth.widthM / 2) : gpOffset + gpWidth.widthM / 2;
            }
          }
          dragElementStart = { widthM: gpWidth.widthM, heightM: gpWidth.heightM, center: gpCenter, axisX: axisX, axisY: axisY, side: gpSide, maxWidthM: gpMaxWidth, lastWidthM: gpWidth.widthM, lastHeightM: gpWidth.heightM, centerDeltaM: 0 };
          beginGlazingResizePreview(gpWidth.id);
        }
      } else if (handle === 'glazingHeight') {
        var gpHeight = Store.findGlazingPanel(selectedGlazingPanelId);
        if (gpHeight) {
          dragElementStart = { widthM: gpHeight.widthM, heightM: gpHeight.heightM, startScreenY: e.clientY, lastWidthM: gpHeight.widthM, lastHeightM: gpHeight.heightM };
          beginGlazingResizePreview(gpHeight.id);
        }
      } else if (handle.indexOf('balconyWidth') === 0) {
        // Mesma alça de largura da Pele de vidro (handle.indexOf('glazingWidth')
        // acima), sem o caso de parede hospedeira — a sacada nunca encosta,
        // então o eixo vem só de rotationDeg e o teto de largura é fixo (30m).
        var brWidth = Store.findBalconyRailing(selectedBalconyRailingId);
        if (brWidth) {
          var brAngle = (brWidth.rotationDeg || 0) * Math.PI / 180;
          var brAxisX = Math.cos(brAngle), brAxisY = Math.sin(brAngle);
          var brSide = handle === 'balconyWidthRight' ? 1 : -1;
          dragElementStart = { widthM: brWidth.widthM, heightM: brWidth.heightM, center: { x: brWidth.x || 0, y: brWidth.y || 0 }, axisX: brAxisX, axisY: brAxisY, side: brSide, maxWidthM: 30, lastWidthM: brWidth.widthM, centerDeltaM: 0 };
          beginBalconyResizePreview(brWidth.id);
        }
      } else if (handle === 'balconyHeightTop') {
        // Alça de CIMA — estica heightM, base (sillHeightM) fixa. Mesma
        // técnica de dragElementStart.startScreenY da alça de altura da
        // Pele de vidro (glazingHeight).
        var brHeightTop = Store.findBalconyRailing(selectedBalconyRailingId);
        if (brHeightTop) {
          dragElementStart = { widthM: brHeightTop.widthM, heightM: brHeightTop.heightM, sillHeightM: brHeightTop.sillHeightM || 0, startScreenY: e.clientY, lastHeightM: brHeightTop.heightM, lastSillHeightM: brHeightTop.sillHeightM || 0 };
          beginBalconyResizePreview(brHeightTop.id);
        }
      } else if (handle === 'balconyHeightBottom') {
        // Alça de BAIXO — sobe/desce sillHeightM, heightM fixo (Product
        // Owner: "possibilidade de movimentar para cima com o arraste
        // do mouse") — translada a peça inteira na vertical.
        var brHeightBottom = Store.findBalconyRailing(selectedBalconyRailingId);
        if (brHeightBottom) {
          dragElementStart = { widthM: brHeightBottom.widthM, heightM: brHeightBottom.heightM, sillHeightM: brHeightBottom.sillHeightM || 0, startScreenY: e.clientY, lastHeightM: brHeightBottom.heightM, lastSillHeightM: brHeightBottom.sillHeightM || 0 };
          beginBalconyResizePreview(brHeightBottom.id);
        }
      } else if (handle.indexOf('volumeBoxCorner:') === 0) {
        // Cubo moldável — alça de CANTO: move 1 canto livre em X/Y/Z.
        // Horizontal (X/Z) vem do raycast contra o chão (mesma técnica
        // de sempre); vertical (Y) vem do delta de tela, mesmo
        // heurístico já usado pelas alças de altura antigas.
        var vbCornerBox = Store.findVolumeBox(selectedVolumeBoxId);
        var vbCornerGround = getGroundModelPoint(e.clientX, e.clientY);
        if (vbCornerBox && vbCornerGround) {
          dragElementStart = {
            cornerIndex: parseInt(handle.slice('volumeBoxCorner:'.length), 10),
            groundStart: vbCornerGround, startScreenY: e.clientY,
            baseOffsets: cloneVolumeBoxCornerOffsets(vbCornerBox),
          };
          beginVolumeBoxResizePreview(vbCornerBox.id);
        }
      } else if (handle.indexOf('volumeBoxEdge:') === 0) {
        // Alça de ARESTA: os 2 cantos da aresta se movem juntos (mesmo
        // delta) — meio-termo entre canto único e face inteira.
        var vbEdgeBox = Store.findVolumeBox(selectedVolumeBoxId);
        var vbEdgeGround = getGroundModelPoint(e.clientX, e.clientY);
        if (vbEdgeBox && vbEdgeGround) {
          dragElementStart = {
            edgeIndex: parseInt(handle.slice('volumeBoxEdge:'.length), 10),
            groundStart: vbEdgeGround, startScreenY: e.clientY,
            baseOffsets: cloneVolumeBoxCornerOffsets(vbEdgeBox),
          };
          beginVolumeBoxResizePreview(vbEdgeBox.id);
        }
      } else if (handle.indexOf('volumeBoxFace:') === 0) {
        // Alça de FACE: push-pull ao longo da PRÓPRIA normal da face —
        // calculada uma vez aqui (início do arraste), não muda de
        // direção no meio do gesto mesmo que a face já esteja torta.
        // Face majoritariamente vertical (topo/base) usa o delta de
        // tela (mesma técnica das antigas alças de altura); as outras 4
        // usam o raycast contra o chão, projetado na normal da face.
        var vbFaceBox = Store.findVolumeBox(selectedVolumeBoxId);
        if (vbFaceBox) {
          var vbFaceIndex = parseInt(handle.slice('volumeBoxFace:'.length), 10);
          var vbFace = Core.volumeBoxFaces(vbFaceBox)[vbFaceIndex];
          if (vbFace) {
            var vbFaceAngle = (vbFaceBox.rotationDeg || 0) * Math.PI / 180;
            var vbFaceAxisX = Math.cos(vbFaceAngle), vbFaceAxisY = Math.sin(vbFaceAngle);
            var vbFaceDepthAxisX = -Math.sin(vbFaceAngle), vbFaceDepthAxisY = Math.cos(vbFaceAngle);
            var vbFaceVertical = Math.abs(vbFace.normal.y) >= 0.5;
            dragElementStart = {
              faceIndex: vbFaceIndex, faceNormal: vbFace.normal, faceVertical: vbFaceVertical,
              // Normal (local X/Z) já rotacionada pro mundo, pra projetar
              // o movimento do chão nela sem precisar desfazer rotação de novo.
              worldNormalX: vbFaceAxisX * vbFace.normal.x + vbFaceDepthAxisX * vbFace.normal.z,
              worldNormalZ: vbFaceAxisY * vbFace.normal.x + vbFaceDepthAxisY * vbFace.normal.z,
              groundStart: getGroundModelPoint(e.clientX, e.clientY), startScreenY: e.clientY,
              baseOffsets: cloneVolumeBoxCornerOffsets(vbFaceBox),
              lastDeltaAlongNormalM: 0,
            };
            beginVolumeBoxResizePreview(vbFaceBox.id);
          }
        }
      } else if (handle.indexOf('stairWidth') === 0) {
        // Escada — largura (eixo local X, mesma técnica de balconyWidth/
        // volumeBoxWidth). Única alça livre — a corrida é derivada do
        // pé-direito, não é ajustável.
        var stWidth = Store.findStair(selectedStairId);
        if (stWidth) {
          var stWAngle = (stWidth.rotationDeg || 0) * Math.PI / 180;
          var stWAxisX = Math.cos(stWAngle), stWAxisY = Math.sin(stWAngle);
          var stWSide = handle === 'stairWidthRight' ? 1 : -1;
          dragElementStart = { widthM: stWidth.widthM, center: { x: stWidth.x || 0, y: stWidth.y || 0 }, axisX: stWAxisX, axisY: stWAxisY, side: stWSide, maxWidthM: Core.STAIR_MAX_WIDTH_M, lastWidthM: stWidth.widthM, centerDeltaM: 0 };
          beginStairResizePreview(stWidth.id);
        }
      } else if (handle === 'varandaTraceStart' || handle === 'varandaTraceEnd') {
        var traceVaranda = Store.findVaranda(selectedVarandaId);
        if (traceVaranda?.contourSegments?.length) dragElementStart = { traceHandle: handle };
      } else if (handle.indexOf('varandaEdge') === 0) {
        // Varanda não trava em região de cômodo nenhuma (decisão
        // explícita — sempre livre), então não precisa achar região
        // nenhuma aqui, só o retângulo de partida.
        var vrE = Store.findVaranda(selectedVarandaId);
        if (vrE) dragElementStart = { x1: vrE.x1, y1: vrE.y1, x2: vrE.x2, y2: vrE.y2 };
      } else if (handle === 'openingEdgeTop') {
        // Redimensionar altura arrasta na vertical — mesma técnica de
        // roofRidge (delta de tela, não raycast contra plano vertical).
        var opT = Store.findOpening(selectedOpeningId);
        if (opT) dragElementStart = { sillHeight: opT.sillHeight, height: opT.height, startScreenY: e.clientY };
      } else if (handle === 'openingEdgeBottom') {
        var opB = Store.findOpening(selectedOpeningId);
        if (opB) dragElementStart = { sillHeight: opB.sillHeight, height: opB.height, startScreenY: e.clientY };
      }
      Store.commands.beginTransaction();
      return;
    }

    // 2) elemento existente
    var mesh = pickMesh(e.clientX, e.clientY);

    if (facadeWallSelectionHandler) {
      if (mesh?.userData.wallId) {
        facadeWallSelectionHandler(mesh.userData.wallId);
        select(mesh.userData.wallId);
        hintEl.textContent = 'Parede marcada para a fachada. Selecione outras ou confirme a vista.';
      } else hintEl.textContent = 'Clique diretamente nas paredes que receberão a fachada.';
      return;
    }

    if (steelFrameSurfaceSelectionHandler) {
      var sfHit = pickMeshHit(e.clientX, e.clientY);
      if (sfHit && sfHit.object.userData.wallId) {
        var sfSide = wallFaceAtPoint(sfHit.object.userData.wallId, sfHit.point) as 'a' | 'b';
        var sfWallAccepted = steelFrameSurfaceSelectionHandler({ kind: 'wall-face', entityId: sfHit.object.userData.wallId, side: sfSide });
        if (!sfWallAccepted) { hintEl.textContent = 'Face já configurada — escolha uma face ainda sem marcação.'; return; }
        select(sfHit.object.userData.wallId);
        hintEl.textContent = 'Face ' + sfSide.toUpperCase() + ' selecionada — escolha o sistema no painel lateral.';
        return;
      }
      if (sfHit && sfHit.object.userData.roofId) {
        var sfSteppedFace = sfHit.object.userData.roofWallFace as string | undefined;
        if (sfSteppedFace && sfSteppedFace.indexOf('contorno') !== 0) {
          var sfSteppedSide = sfSteppedFace.indexOf('externa') === 0 ? 'a' as const : 'b' as const;
          var sfSteppedAccepted = steelFrameSurfaceSelectionHandler({ kind: 'stepped-wall-face', entityId: sfHit.object.userData.roofId, side: sfSteppedSide });
          if (!sfSteppedAccepted) { hintEl.textContent = 'Esta face da extensão já foi configurada.'; return; }
          hintEl.textContent = 'Extensão da cumeeira selecionada — escolha o revestimento da face.';
          return;
        }
        var sfRoofSide = sfHit.object.userData.gableSide as 'a' | 'b' | undefined;
        var sfRoofTarget = { kind: sfRoofSide ? 'gable-face' as const : 'roof' as const, entityId: sfHit.object.userData.roofId, ...(sfRoofSide ? { side: sfRoofSide } : {}) };
        var sfRoofAccepted = steelFrameSurfaceSelectionHandler(sfRoofTarget);
        if (!sfRoofAccepted) { hintEl.textContent = sfRoofSide ? 'Oitão já configurado — escolha outra face.' : 'Beiral, tabeira e platibanda deste telhado já foram configurados.'; return; }
        selectRoof(sfHit.object.userData.roofId);
        hintEl.textContent = sfRoofSide ? 'Oitão selecionado — escolha o revestimento no painel lateral.' : 'Cobertura selecionada — configure beiral, tabeira e platibanda no painel lateral.';
        return;
      }
      hintEl.textContent = 'Clique diretamente em uma face de parede, oitão ou cobertura.';
      return;
    }

    // A troca de nível é contextual: clicar em qualquer volume visível
    // ativa silenciosamente o nível técnico ao qual ele pertence.
    if (mesh && Number.isInteger(mesh.userData.floorIndex) && mesh.userData.floorIndex !== Store.getProject().currentFloorIndex) {
      Store.commands.setCurrentFloor(mesh.userData.floorIndex);
    }

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
        // 'arco' não tem produto de catálogo (nunca passou pelo seletor
        // de esquadria — ferramenta separada, sem aba própria), então
        // productOverride só se aplica pra door/window.
        var pendingProduct = pendingOpeningProductId && currentTool !== 'arco' ? Catalog.getProduct(pendingOpeningProductId) : null;
        var productOverride = pendingProduct && pendingProduct.assets.nominalWidthM && pendingProduct.assets.nominalHeightM
          ? { productId: pendingProduct.id, widthM: pendingProduct.assets.nominalWidthM, heightM: pendingProduct.assets.nominalHeightM }
          : undefined;
        var newOpening = Store.commands.insertOpening(mesh.userData.wallId, currentTool, gpIns.x, gpIns.y, productOverride);
        if (newOpening) {
          if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':opening:' + newOpening.id, pendingCommercialSelection);
          // Ferramenta desarma sozinha depois de UMA porta/janela/arco —
          // Product Owner relatou esquecer a ferramenta ainda armada e,
          // ao tentar arrastar uma parede/cômodo em seguida, criar uma
          // abertura sem querer (a inserção acontece no pointerdown, não
          // dá pra "virar" um arraste depois). setTool(null) já chama
          // deselect() internamente — por isso roda ANTES de
          // selectOpening, senão desmarcava a própria porta recém-criada.
          setTool(null);
          selectOpening(newOpening.id);
        }
        else {
          var openingLabel = currentTool === 'door' ? 'porta' : currentTool === 'window' ? 'janela' : 'arco';
          hintEl.textContent = 'Não cabe um' + (currentTool === 'window' ? 'a' : '') + ' ' + openingLabel + ' aqui — parede curta demais ou sem espaço livre.';
        }
      }
      return;
    }

    // Ferramenta Quebrar parede ativa + clicou numa parede: demole na
    // hora, sem passar por seleção/gizmo — igual Porta/Janela, um clique
    // já basta. A parede NÃO é removida do modelo (Store.commands.
    // demolishWall só marca `demolished: true`) — continua existindo
    // pra fechar o cômodo (senão o piso desaparecia junto, era
    // exatamente esse o bug do comportamento antigo com deleteWall).
    // Só some da tela e do quantitativo/orçamento. A ferramenta continua
    // armada depois, pra quebrar várias paredes em sequência.
    if (currentTool === 'demolish' && mesh && mesh.userData.wallId) {
      Store.commands.demolishWall(mesh.userData.wallId);
      hintEl.textContent = 'Parede quebrada — some da vista e do orçamento, mas o cômodo continua fechado. Clique em outra pra continuar, ou escolha outra ferramenta.';
      return;
    }

    // Mesma ferramenta "Apagar", agora numa peça de cumeeira/espigão de
    // telhado (mesh.userData.ridgePieceId) — as regras automáticas de
    // omitir peça sobreposta (DEC-152/160/165) não cobrem todo caso real
    // de composição em L; em vez de esperar mais uma rodada de ajuste de
    // regra geral, o usuário apaga a peça específica que sobrou errada
    // direto na tela. Clicar de novo na MESMA peça restaura (comando é
    // um toggle). O texto da dica é deliberadamente completo (telhado,
    // peça, coordenada) pra poder ser copiado e colado de volta na
    // conversa — é o dado exato que falta pra generalizar a regra certa.
    if (currentTool === 'demolish' && mesh && mesh.userData.ridgePieceId && mesh.userData.roofId) {
      var ridgePieceRoof = Store.findRoof(mesh.userData.roofId);
      Store.commands.toggleRoofRidgePieceHidden(mesh.userData.roofId, mesh.userData.ridgePieceId);
      var nowHidden = !!(ridgePieceRoof && ridgePieceRoof.hiddenRidgePieceIds && ridgePieceRoof.hiddenRidgePieceIds.indexOf(mesh.userData.ridgePieceId) !== -1);
      var ridgePieceCoord = mesh.userData.hipCornerXZ || mesh.userData.ridgeCapEndsXZ || null;
      hintEl.textContent = (nowHidden ? 'Peça de telhado ocultada' : 'Peça de telhado restaurada')
        + ' — telhado ' + mesh.userData.roofId + ', peça "' + mesh.userData.ridgePieceId + '"'
        + (ridgePieceCoord ? ', coordenada ' + JSON.stringify(ridgePieceCoord) : '')
        + '. Clique de novo na mesma peça pra desfazer.';
      return;
    }

    // Mesma ferramenta "Apagar", agora como diagnóstico GENÉRICO pra
    // qualquer peça clicável do projeto (parede, telhado — água/tabeira/
    // oitão —, coluna, laje, móvel, o que tiver userData.category) sem
    // um comando mais específico já ter tratado o clique acima (quebrar
    // parede, alternar espigão/cumeeira). Só lê e mostra, nunca
    // apaga/oculta nada. Existe porque descrever de longe qual peça
    // está errada numa junção complexa (ex.: "a tabeira passando reto"
    // num encontro em L de duas-águas) é impreciso — clicar direto na
    // peça e ler a categoria/ids/coordenada exata (convertida pra
    // unidade do modelo, a mesma do console) tira a ambiguidade.
    //
    // Importante: o raycast acerta a MALHA de verdade mesmo quando o
    // fragmento ali está sendo escondido por sombreamento de pixel
    // (discard no shader, ver applyRoomBoxClipping) — isso é invisível
    // pro raycast, que só enxerga geometria. Clicar "na peça errada" às
    // vezes na real acerta uma peça que já está corretamente invisível
    // ali, e o que aparece na tela é outra peça por baixo — por isso o
    // aviso no final da dica.
    if (currentTool === 'demolish' && mesh) {
      var diagHit = pickMeshHit(e.clientX, e.clientY);
      var diagModelPt = diagHit ? worldToModel(diagHit.point.x, diagHit.point.z) : null;
      var diagIdFields = ['roofId', 'wallId', 'gableSide', 'ridgePieceId', 'columnId', 'lajeId', 'furnitureId', 'openingId', 'varandaId', 'glazingPanelId', 'balconyRailingId', 'volumeBoxId', 'stairId', 'hydraulicNodeId', 'floorIndex'];
      var diagIds = diagIdFields.filter(function (k) { return mesh.userData[k] !== undefined; })
        .map(function (k) { return k + '=' + mesh.userData[k]; }).join(', ');
      hintEl.textContent = 'Diagnóstico (não apaga) — categoria "' + (mesh.userData.category || '?') + '"'
        + (diagIds ? ', ' + diagIds : '')
        + (diagHit ? ', clique em x=' + diagModelPt!.x.toFixed(2) + ' y=' + diagModelPt!.y.toFixed(2) + ' (altura mundo=' + diagHit.point.y.toFixed(2) + 'm)' : '')
        + '. Obs.: o clique acerta a malha real mesmo se ela estiver escondida por sombreamento de pixel — pode não ser a peça que você vê na tela.';
      return;
    }

    // Ferramenta Drywall ativa + clicou numa parede: alterna a parede
    // entre drywall (padrão Standard-ST nas duas faces) e o sistema
    // construtivo padrão do projeto — mesmo princípio de clique único e
    // instantâneo do balde de tinta/quebrar parede acima, sem diálogo
    // modal. Só aceita parede INTERNA (cômodo fechado dos dois lados,
    // Core.wallIsInteriorPartition) — uma parede externa da casa nunca
    // devia virar divisória de drywall.
    if (currentTool === 'drywallPartition' && mesh && mesh.userData.wallId) {
      var drywallWall = Store.findWall(mesh.userData.wallId);
      if (!drywallWall) return;
      if (drywallWall.partitionSystem === 'drywall') {
        Store.commands.setWallPartitionSystem(drywallWall.id, undefined);
        hintEl.textContent = 'Drywall removido — parede volta ao sistema construtivo padrão do projeto.';
        return;
      }
      var drywallRooms = Core.detectRooms(Store.currentWalls());
      if (!Core.wallIsInteriorPartition(drywallWall, drywallRooms)) {
        hintEl.textContent = 'Só é possível aplicar drywall em paredes internas — com cômodo fechado dos dois lados.';
        return;
      }
      Store.commands.setWallPartitionSystem(drywallWall.id, {
        partitionSystem: 'drywall', faceAAssemblyId: 'drywall-st', faceBAssemblyId: 'drywall-st', cavityAssembly: undefined,
      });
      hintEl.textContent = 'Divisória em drywall (Standard-ST) aplicada. Clique de novo na mesma parede pra remover, ou em outra pra continuar.';
      return;
    }

    // Ferramenta Lata de tinta ativa + clicou numa parede: pinta só o
    // lado clicado (face A ou B, mesma lógica de dois lados que já
    // existe em Store.commands.setWallFinishFace) com a cor "carregada"
    // na paleta fixa do topo — não precisa selecionar a parede nem abrir
    // o painel de acabamento por clique direito primeiro.
    if (currentTool === 'paintBucket') {
      var paintHit = pickMeshHit(e.clientX, e.clientY);
      var paintProduct = currentPaintProductId ? Catalog.getProduct(currentPaintProductId) : null;
      var canPaintSurface = paintProduct && (paintProduct.category === 'paint' || paintProduct.category === 'floor_tile');
      if (canPaintSurface && paintHit && paintHit.object.userData.wallId && currentPaintProductId) {
        var faceHit = wallFaceAtPoint(paintHit.object.userData.wallId, paintHit.point);
        Store.commands.setWallFinishFace(paintHit.object.userData.wallId, faceHit as any, currentPaintProductId);
        if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':wall:' + paintHit.object.userData.wallId + ':' + faceHit, pendingCommercialSelection);
        hintEl.textContent = 'Lado ' + faceHit.toUpperCase() + ' pintado. Clique em outra pra continuar.';
        return;
      }
      if (canPaintSurface && paintHit && paintHit.object.userData.gableSide && paintHit.object.userData.roofId && currentPaintProductId) {
        Store.commands.setRoofGableFinish(paintHit.object.userData.roofId, paintHit.object.userData.gableSide, currentPaintProductId);
        if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':gable:' + paintHit.object.userData.roofId + ':' + paintHit.object.userData.gableSide, pendingCommercialSelection);
        hintEl.textContent = 'Acabamento aplicado somente à face clicada do oitão.';
        return;
      }
      // Bloco de Volumetria: mesmo catálogo de acabamento de parede
      // (Product Owner: "ele deve poder ser pintado como as paredes")
      // — o box inteiro usa o mesmo acabamento nas 6 faces, sem
      // distinção de lado A/B como a parede tem.
      if (canPaintSurface && paintHit && paintHit.object.userData.volumeBoxId && currentPaintProductId) {
        Store.commands.setVolumeBoxFinish(paintHit.object.userData.volumeBoxId, currentPaintProductId);
        if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':volume:' + paintHit.object.userData.volumeBoxId, pendingCommercialSelection);
        hintEl.textContent = 'Bloco pintado. Clique em outro pra continuar.';
        return;
      }
      if (canPaintSurface && paintHit && paintHit.object.userData.roomKey && currentPaintProductId) {
        var roomKey = paintHit.object.userData.roomKey;
        Store.commands.setRoomFinish(roomKey, currentPaintProductId, floorFinishScale, floorFinishRotation);
        if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':room:' + roomKey, pendingCommercialSelection);
        hintEl.textContent = 'Revestimento aplicado diretamente ao piso. Clique em outra face para continuar.';
        return;
      }
      if (paintProduct && paintProduct.category === 'roof_tile' && paintHit && paintHit.object.userData.roofId && currentPaintProductId) {
        Store.commands.setRoofFinish(paintHit.object.userData.roofId, currentPaintProductId);
        if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':roof:' + paintHit.object.userData.roofId, pendingCommercialSelection);
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
          var varandaId = mesh.userData.varandaId;
          selectVaranda(varandaId);
          dragMode = 'varandaBody';
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          dragElementStart = { lastGround: dragGroundStart };
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
        } else if (mesh.userData.hydraulicNodeId) {
          var hydraulicId = mesh.userData.hydraulicNodeId;
          var hydraulicEntity = Store.findHydraulicNode(hydraulicId);
          if (!hydraulicEntity) return;
          if (hydraulicEntity.kind === 'junction' && hydraulicEntity.ownerFixtureId) {
            // Ponto-guia de um percurso desenhado manualmente (H2): arraste
            // livre no plano, sem trocar de parede/piso e sem ajuste de
            // altura — a cota vertical do trecho horizontal é fixa (mesmo
            // recorte de escopo da DEC-61: só o traçado horizontal é
            // manual). Prévia fantasma no viewport; grava no Store só ao
            // soltar (mesmo padrão de hydraulicFixtureBody).
            selectHydraulicNode(hydraulicId);
            dragMode = 'hydraulicJunctionBody';
            dragElementStart = { lastX: hydraulicEntity.x, lastY: hydraulicEntity.y };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            hydraulicFixtureDragObjects = findHydraulicFixtureSceneObjects(hydraulicId);
            Store.commands.beginTransaction();
            return;
          }
          if (hydraulicEntity.kind === 'source') {
            // Caixa d'água: arraste livre no plano (sem parede, sem grid —
            // mesmo tratamento dos pontos de piso). A rede é regenerada só
            // no soltar (updateHydraulicSourceBodyLive), pra não desconectar
            // os canos já traçados da nova posição.
            selectHydraulicNode(hydraulicId);
            dragMode = 'hydraulicSourceBody';
            dragElementStart = { x: hydraulicEntity.x, y: hydraulicEntity.y, lastX: hydraulicEntity.x, lastY: hydraulicEntity.y };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            hydraulicFixtureDragObjects = findHydraulicFixtureSceneObjects(hydraulicId);
            Store.commands.beginTransaction();
            return;
          }
          if (hydraulicEntity.kind === 'destination') {
            // Caixa de gordura/inspeção/saída pluvial: mesmo tratamento da
            // caixa d'água — arraste livre, rede regenerada só no soltar
            // (updateHydraulicDestinationBodyLive).
            selectHydraulicNode(hydraulicId);
            dragMode = 'hydraulicDestinationBody';
            dragElementStart = { x: hydraulicEntity.x, y: hydraulicEntity.y, lastX: hydraulicEntity.x, lastY: hydraulicEntity.y };
            dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
            hydraulicFixtureDragObjects = findHydraulicFixtureSceneObjects(hydraulicId);
            Store.commands.beginTransaction();
            return;
          }
          if (!hydraulicEntity.fixtureType) return;
          selectHydraulicNode(hydraulicId);
          dragMode = 'hydraulicFixtureBody';
          dragElementStart = { x: hydraulicEntity.x, y: hydraulicEntity.y, elevationM: hydraulicEntity.elevationM, lastX: hydraulicEntity.x, lastY: hydraulicEntity.y, lastElevationM: hydraulicEntity.elevationM, startScreenX: e.clientX, startScreenY: e.clientY };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          hydraulicFixtureDragObjects = findHydraulicFixtureSceneObjects(hydraulicId);
          hydraulicFixtureDragObjects.forEach(function (object: any) { if (object.userData.hydraulicLabel) object.visible = false; });
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
        } else if (mesh.userData.balconyRailingId) {
          // Sacada de vidro: sempre solta (sem estado attached — ver
          // Core.ts), arraste do corpo livre nas 4 direções, confirmado
          // pelo Product Owner.
          var balconyRailingId = mesh.userData.balconyRailingId;
          var brEnt = Store.findBalconyRailing(balconyRailingId)!;
          selectBalconyRailing(balconyRailingId);
          dragMode = 'balconyRailingBody';
          dragElementStart = { x: brEnt.x || 0, y: brEnt.y || 0 };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          balconyRailingDragMesh = findBalconyRailingSceneObject(balconyRailingId);
          Store.commands.beginTransaction();
        } else if (mesh.userData.volumeBoxId) {
          // Bloco de Volumetria: sempre livre, arrasta o corpo direto
          // (sem ímã de parede — ver types.ts).
          var volumeBoxId = mesh.userData.volumeBoxId;
          var vbEnt = Store.findVolumeBox(volumeBoxId)!;
          selectVolumeBox(volumeBoxId);
          dragMode = 'volumeBoxBody';
          dragElementStart = { x: vbEnt.x || 0, y: vbEnt.y || 0 };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          volumeBoxDragMesh = findVolumeBoxSceneObject(volumeBoxId);
          Store.commands.beginTransaction();
        } else if (mesh.userData.stairId) {
          // Escada: sempre livre, arrasta o corpo direto (sem ímã de
          // parede) — o aviso de apoio (parede/coluna perto) só aparece
          // ao SOLTAR (ver dragMode === 'stairBody' no pointerup).
          var stairId = mesh.userData.stairId;
          var stEnt = Store.findStair(stairId)!;
          selectStair(stairId);
          dragMode = 'stairBody';
          dragElementStart = { x: stEnt.x || 0, y: stEnt.y || 0 };
          dragGroundStart = getGroundModelPoint(e.clientX, e.clientY);
          stairDragMesh = findStairSceneObject(stairId);
          Store.commands.beginTransaction();
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
        } else if (mesh.userData.category === 'forroDrywall') {
          // Forro de drywall: sem corpo pra arrastar (derivado do
          // cômodo, ver Scene3DRenderer) — só seleciona, mesmo espírito
          // de selectRoomGroup (clique único, sem dragMode).
          selectForro(mesh.userData.roomKey);
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
      // Um modelo composto continua formado por peças independentes.
      // Em especial, na "Cumeeira em níveis" as duas coberturas têm o
      // mesmo eixo e podem se sobrepor quando uma borda é dimensionada;
      // isso é intencional e não significa que devam virar um telhado só.
      if (roof.compoundGroupId && roof.compoundGroupId === o.compoundGroupId) return;
      if (roof.steppedLowerRoofId === o.id || o.steppedLowerRoofId === roof.id) return;
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

  function onPointerMove(e: any) {
    // Os navegadores também emitem pointermove para cada dedo. Durante
    // o gesto de dois dedos, somente onTouchMove controla a câmera;
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
    if (dragMode === 'wholeConstruction') {
      var gpWc = getGroundModelPoint(e.clientX, e.clientY);
      if (gpWc && dragGroundStart && dragElementStart) {
        var wcDx = Core.snap(gpWc.x - dragGroundStart.x);
        var wcDy = Core.snap(gpWc.y - dragGroundStart.y);
        dragElementStart.lastDx = wcDx;
        dragElementStart.lastDy = wcDy;
        previewWholeConstructionDelta(wcDx, wcDy);
      }
      return;
    }
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
      // Prévia fantasma (DEC-87): NÃO chama Store aqui — atualizar a
      // parede a cada pointermove disparava reconstrução da cena
      // inteira dezenas de vezes por segundo (mesmo problema já corrigido
      // pro painel de Envidraçamento e pro Bloco de Volumetria, ver
      // comentários deles). resolveWallResizeCandidate faz a MESMA
      // matemática de sempre (offset perpendicular, limite de junção,
      // limite contra abertura) só que devolvendo o candidato como dado;
      // previewWallResize desenha um footprint translúcido só da parede
      // arrastada + vizinhas diretamente ligadas, sem tocar no Store.
      // Rastro (parede-ponte), diagnóstico ao vivo e o commit de verdade
      // ficam pro pointerup, uma única vez — mesmo princípio já usado no
      // arraste de cômodo individual (roomGroup/DEC-57).
      var wallResizeCandidate = resolveWallResizeCandidate(e);
      if (wallResizeCandidate) {
        if (wallResizeCandidate.hint) hintEl.textContent = wallResizeCandidate.hint;
        scheduleWallResizePreview(wallResizeCandidate.candidateWalls, wallResizeCandidate.previewIds);
        dragElementStart.diagnosticDeltaX = wallResizeCandidate.rx1 - dragElementStart.x1;
        dragElementStart.diagnosticDeltaY = wallResizeCandidate.ry1 - dragElementStart.y1;
        wallResizeLiveCandidate = {
          id: selectedWallId,
          x1: wallResizeCandidate.rx1, y1: wallResizeCandidate.ry1,
          x2: wallResizeCandidate.rx2, y2: wallResizeCandidate.ry2,
        };
      }
      return;
    }
    if (dragMode === 'roomHeight') {
      // Mesma prévia fantasma do arraste de UMA parede (DEC-87), reusada
      // aqui: a posição das paredes não muda, só a altura candidata —
      // por isso não precisa de resolveWallResizeCandidate nenhum,
      // Store.currentWalls() já serve de "candidateWalls" direto.
      if (dragElementStart) {
        var deltaScreenH = dragElementStart.startScreenY - e.clientY; // positivo = arrastou pra cima
        var candidateHeight = Math.max(ROOM_HEIGHT_MIN_M, Math.min(ROOM_HEIGHT_MAX_M, dragElementStart.startHeight + deltaScreenH * 0.01));
        dragElementStart.lastHeight = candidateHeight;
        previewWallResize(Store.currentWalls(), dragElementStart.roomWallIds, candidateHeight);
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
    if (dragMode === 'volumeBoxBody') {
      // Mesmo raciocínio de performance do painel de Envidraçamento
      // acima — só move o mesh visual direto durante o arraste.
      var vbG = getGroundModelPoint(e.clientX, e.clientY);
      if (vbG && dragGroundStart && volumeBoxDragMesh) {
        var dxVb = vbG.x - dragGroundStart.x, dyVb = vbG.y - dragGroundStart.y;
        var liveXVb = dragElementStart.x + dxVb, liveYVb = dragElementStart.y + dyVb;
        var wpVb = modelToWorld(liveXVb, liveYVb);
        volumeBoxDragMesh.position.x = wpVb.x;
        volumeBoxDragMesh.position.z = wpVb.z;
      }
      return;
    }
    if (dragMode === 'stairBody') {
      // Mesmo raciocínio de performance do Bloco de Volumetria acima —
      // só move o mesh visual direto durante o arraste. Sem ímã de
      // parede/coluna (o aviso de apoio só aparece ao soltar).
      var stG = getGroundModelPoint(e.clientX, e.clientY);
      if (stG && dragGroundStart && stairDragMesh) {
        var dxSt = stG.x - dragGroundStart.x, dySt = stG.y - dragGroundStart.y;
        var liveXSt = dragElementStart.x + dxSt, liveYSt = dragElementStart.y + dySt;
        var wpSt = modelToWorld(liveXSt, liveYSt);
        stairDragMesh.position.x = wpSt.x;
        stairDragMesh.position.z = wpSt.z;
      }
      return;
    }
    if (dragMode === 'balconyRailingBody') {
      // Mesmo raciocínio de performance do painel de Envidraçamento
      // acima — só move o mesh visual direto durante o arraste. Sem
      // ímã de parede (a sacada nunca encosta) — livre nas 4 direções.
      var brG = getGroundModelPoint(e.clientX, e.clientY);
      if (brG && dragGroundStart && balconyRailingDragMesh) {
        var dxBr = brG.x - dragGroundStart.x, dyBr = brG.y - dragGroundStart.y;
        var liveXBr = dragElementStart.x + dxBr, liveYBr = dragElementStart.y + dyBr;
        var wpBr = modelToWorld(liveXBr, liveYBr);
        balconyRailingDragMesh.position.x = wpBr.x;
        balconyRailingDragMesh.position.z = wpBr.z;
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
        if (rNow && roofPitchDragCotaEl) {
          var pitchMid = modelToWorld((rNow.x1 + rNow.x2) / 2, (rNow.y1 + rNow.y2) / 2);
          var pitchBaseM = rNow.baseHeightM || Scene3DRenderer.WALL_HEIGHT_GETTER();
          var pitchHalfSpanM = (rNow.ridgeAxis === 'x' ? Math.abs(rNow.y2 - rNow.y1) : Math.abs(rNow.x2 - rNow.x1)) / Core.GRID / 2;
          var pitchPeakY = currentFloorYOffset() + pitchBaseM + pitchHalfSpanM * Math.tan(finalPitch * Math.PI / 180);
          roofPitchDragCotaEl.textContent = Math.round(finalPitch) + '°';
          roofPitchDragCotaEl.style.display = 'block';
          positionFloatingPanel(roofPitchDragCotaEl, pitchMid.x, pitchPeakY, pitchMid.z, 0);
        }
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
        var wholeRoofHeight = dragElementStart.baseHeightM + deltaBase * 0.01;
        Store.commands.updateRoofBaseHeightLive(selectedRoofId, wholeRoofHeight);
        hintEl.textContent = 'Telhado inteiro elevado individualmente — base em ' + Math.max(Core.WALL_HEIGHT, Math.min(8, wholeRoofHeight)).toFixed(2).replace('.', ',') + ' m.';
      }
      return;
    }
    if (dragMode && dragMode.indexOf('roofEdge') === 0) {
      var gpE = getGroundModelPoint(e.clientX, e.clientY);
      if (gpE && dragElementStart) {
        var wallsForMagnet = Store.currentWalls();
        var snappedX = Core.snapCoordinateToWalls(gpE.x, wallsForMagnet, 'x', WALL_MAGNET_TOLERANCE);
        var snappedY = Core.snapCoordinateToWalls(gpE.y, wallsForMagnet, 'y', WALL_MAGNET_TOLERANCE);
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
    if (dragMode === 'hydraulicFixtureBody') {
      var hydraulicGround = getGroundModelPoint(e.clientX, e.clientY);
      var hydraulicNode = selectedHydraulicNodeId ? Store.findHydraulicNode(selectedHydraulicNodeId) : null;
      if (hydraulicGround && dragGroundStart && hydraulicFixtureDragObjects.length && hydraulicNode) {
        var hydraulicWall = hydraulicNode.wallId ? Store.findWall(hydraulicNode.wallId) || undefined : undefined;
        var screenDx = e.clientX - dragElementStart.startScreenX, screenDy = e.clientY - dragElementStart.startScreenY;
        var verticalGesture = Math.abs(screenDy) > Math.abs(screenDx) * 1.15;
        var hydraulicDx = hydraulicGround.x - dragGroundStart.x, hydraulicDy = hydraulicGround.y - dragGroundStart.y;
        var hydraulicResolved = verticalGesture
          ? { x: dragElementStart.x, y: dragElementStart.y }
          : resolveHydraulicFixturePosition(hydraulicNode, dragElementStart.x + hydraulicDx, dragElementStart.y + hydraulicDy, hydraulicWall);
        var nextElevationM = verticalGesture
          ? Math.max(0.05, Math.min(2.6, dragElementStart.elevationM - screenDy * 0.01))
          : dragElementStart.elevationM;
        dragElementStart.lastX = hydraulicResolved.x;
        dragElementStart.lastY = hydraulicResolved.y;
        dragElementStart.lastElevationM = nextElevationM;
        var previewNode = { ...hydraulicNode, x: hydraulicResolved.x, y: hydraulicResolved.y, elevationM: nextElevationM };
        var hydraulicVisual = hydraulicFixtureVisualPosition(previewNode, hydraulicWall, Store.getProject().floors.flatMap(function (floor) { return floor.walls; }));
        var hydraulicWorld = modelToWorld(hydraulicVisual.x, hydraulicVisual.y);
        var hydraulicFloorIndex = hydraulicNode.floorIndex || 0;
        hydraulicFixtureDragObjects.forEach(function (object: any) {
          object.position.x = hydraulicWorld.x;
          object.position.z = hydraulicWorld.z;
          if (!object.userData.hydraulicLabel) object.position.y = hydraulicFloorIndex * Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER() + nextElevationM;
        });
        if (hydraulicWall) showHydraulicDragCotas(previewNode, hydraulicWall);
      }
      return;
    }
    if (dragMode === 'hydraulicJunctionBody') {
      var junctionGround = getGroundModelPoint(e.clientX, e.clientY);
      var junctionNode = selectedHydraulicNodeId ? Store.findHydraulicNode(selectedHydraulicNodeId) : null;
      if (junctionGround && dragGroundStart && hydraulicFixtureDragObjects.length && junctionNode) {
        var junctionDx = junctionGround.x - dragGroundStart.x, junctionDy = junctionGround.y - dragGroundStart.y;
        var junctionNextX = dragElementStart.x + junctionDx, junctionNextY = dragElementStart.y + junctionDy;
        dragElementStart.lastX = junctionNextX;
        dragElementStart.lastY = junctionNextY;
        var junctionWorld = modelToWorld(junctionNextX, junctionNextY);
        var junctionFloorIndex = junctionNode.floorIndex || 0;
        hydraulicFixtureDragObjects.forEach(function (object: any) {
          object.position.x = junctionWorld.x;
          object.position.z = junctionWorld.z;
        });
        var junctionPreviewNode = { ...junctionNode, x: junctionNextX, y: junctionNextY, placementSurface: 'wall' };
        var ownerFixture = junctionNode.ownerFixtureId ? Store.findHydraulicNode(junctionNode.ownerFixtureId) : null;
        var ownerWall = ownerFixture && ownerFixture.wallId ? Store.findWall(ownerFixture.wallId) : null;
        if (ownerWall) showHydraulicDragCotas(junctionPreviewNode, ownerWall);
      }
      return;
    }
    if (dragMode === 'hydraulicSourceBody') {
      var sourceGround = getGroundModelPoint(e.clientX, e.clientY);
      if (sourceGround && dragGroundStart && hydraulicFixtureDragObjects.length) {
        var sourceDx = sourceGround.x - dragGroundStart.x, sourceDy = sourceGround.y - dragGroundStart.y;
        var sourceNextX = dragElementStart.x + sourceDx, sourceNextY = dragElementStart.y + sourceDy;
        dragElementStart.lastX = sourceNextX;
        dragElementStart.lastY = sourceNextY;
        var sourceWorld = modelToWorld(sourceNextX, sourceNextY);
        hydraulicFixtureDragObjects.forEach(function (object: any) {
          object.position.x = sourceWorld.x;
          object.position.z = sourceWorld.z;
        });
      }
      return;
    }
    if (dragMode === 'hydraulicDestinationBody') {
      var destGround = getGroundModelPoint(e.clientX, e.clientY);
      if (destGround && dragGroundStart && hydraulicFixtureDragObjects.length) {
        var destDx = destGround.x - dragGroundStart.x, destDy = destGround.y - dragGroundStart.y;
        var destNextX = dragElementStart.x + destDx, destNextY = dragElementStart.y + destDy;
        dragElementStart.lastX = destNextX;
        dragElementStart.lastY = destNextY;
        var destWorld = modelToWorld(destNextX, destNextY);
        hydraulicFixtureDragObjects.forEach(function (object: any) {
          object.position.x = destWorld.x;
          object.position.z = destWorld.z;
        });
      }
      return;
    }
    if (dragMode && dragMode.indexOf('glazingWidth') === 0) {
      var gpResizeW = Store.findGlazingPanel(selectedGlazingPanelId);
      var groundResizeW = getGroundModelPoint(e.clientX, e.clientY);
      if (gpResizeW && groundResizeW && dragElementStart) {
        var along = ((groundResizeW.x - dragElementStart.center.x) * dragElementStart.axisX + (groundResizeW.y - dragElementStart.center.y) * dragElementStart.axisY) / Core.GRID;
        var candidateW = Math.max(0.5, Math.min(dragElementStart.maxWidthM, dragElementStart.widthM / 2 + along * dragElementStart.side));
        var centerDeltaW = dragElementStart.side * (candidateW - dragElementStart.widthM) / 2;
        dragElementStart.lastWidthM = candidateW;
        dragElementStart.centerDeltaM = centerDeltaW;
        if (glazingResizePreview) {
          glazingResizePreview.scale.x = candidateW / gpResizeW.widthM;
          var worldDeltaW = centerDeltaW * Core.GRID * scale;
          glazingResizePreview.position.x = glazingResizeHiddenObject.position.x + dragElementStart.axisX * worldDeltaW;
          glazingResizePreview.position.z = glazingResizeHiddenObject.position.z + dragElementStart.axisY * worldDeltaW;
        }
      }
      return;
    }
    if (dragMode === 'glazingHeight') {
      var gpResizeH = Store.findGlazingPanel(selectedGlazingPanelId);
      if (gpResizeH && dragElementStart && glazingResizePreview) {
        // 0,02m/px (não os 0,01m/px padrão de altura de cômodo/telhado) —
        // com o teto de altura da pele de vidro liberado até 10m (Store.
        // updateGlazingPanelSizeLive), o padrão exigiria arrastar quase
        // 800px pra alcançar o topo da faixa; dobrado pra caber num
        // arrasto de tela confortável.
        var candidateH = Math.max(0.5, dragElementStart.heightM + (dragElementStart.startScreenY - e.clientY) * 0.02);
        dragElementStart.lastHeightM = candidateH;
        glazingResizePreview.scale.y = candidateH / gpResizeH.heightM;
        // Ponto fixo é a base (sillHeightM, nunca muda aqui) — cresce só
        // pra CIMA: o centro do preview sobe metade do delta de altura
        // (base = centro - altura/2 permanece igual; topo = centro +
        // altura/2 sobe o delta inteiro).
        glazingResizePreview.position.y = glazingResizeHiddenObject.position.y + (candidateH - gpResizeH.heightM) / 2;
      }
      return;
    }
    if (dragMode && dragMode.indexOf('balconyWidth') === 0) {
      // Cópia direta do redimensionamento de largura da Pele de vidro
      // acima (handle.indexOf('glazingWidth')) — sem parede hospedeira.
      var brResizeW = Store.findBalconyRailing(selectedBalconyRailingId);
      var groundResizeBr = getGroundModelPoint(e.clientX, e.clientY);
      if (brResizeW && groundResizeBr && dragElementStart) {
        var alongBr = ((groundResizeBr.x - dragElementStart.center.x) * dragElementStart.axisX + (groundResizeBr.y - dragElementStart.center.y) * dragElementStart.axisY) / Core.GRID;
        var candidateBrW = Math.max(0.5, Math.min(dragElementStart.maxWidthM, dragElementStart.widthM / 2 + alongBr * dragElementStart.side));
        var centerDeltaBr = dragElementStart.side * (candidateBrW - dragElementStart.widthM) / 2;
        dragElementStart.lastWidthM = candidateBrW;
        dragElementStart.centerDeltaM = centerDeltaBr;
        if (balconyResizePreview) {
          balconyResizePreview.scale.x = candidateBrW / brResizeW.widthM;
          var worldDeltaBr = centerDeltaBr * Core.GRID * scale;
          balconyResizePreview.position.x = balconyResizeHiddenObject.position.x + dragElementStart.axisX * worldDeltaBr;
          balconyResizePreview.position.z = balconyResizeHiddenObject.position.z + dragElementStart.axisY * worldDeltaBr;
        }
      }
      return;
    }
    if (dragMode === 'balconyHeightTop') {
      // Estica a altura pra CIMA — mesma sensibilidade (0,02m/px) e
      // mesma técnica de crescimento com base fixa da alça de altura da
      // Pele de vidro (glazingHeight): o centro do preview sobe metade
      // do delta, a base (sillHeightM) nunca muda aqui.
      var brTopEnt = Store.findBalconyRailing(selectedBalconyRailingId);
      if (brTopEnt && dragElementStart && balconyResizePreview) {
        var candidateBrH = Math.max(0.5, dragElementStart.heightM + (dragElementStart.startScreenY - e.clientY) * 0.02);
        dragElementStart.lastHeightM = candidateBrH;
        balconyResizePreview.scale.y = candidateBrH / brTopEnt.heightM;
        balconyResizePreview.position.y = balconyResizeHiddenObject.position.y + (candidateBrH - brTopEnt.heightM) / 2;
      }
      return;
    }
    if (dragMode === 'balconyHeightBottom') {
      // Sobe/desce a base (sillHeightM) — heightM fixo, a peça inteira
      // translada na vertical (Product Owner: "movimentar para cima
      // com o arraste do mouse"). Sem scale nenhum: só a posição Y do
      // preview se move, o mesmo delta de tela em metros.
      var brBottomEnt = Store.findBalconyRailing(selectedBalconyRailingId);
      if (brBottomEnt && dragElementStart && balconyResizePreview) {
        var deltaSillM = (dragElementStart.startScreenY - e.clientY) * 0.02;
        var candidateSillM = Math.max(0, dragElementStart.sillHeightM + deltaSillM);
        dragElementStart.lastSillHeightM = candidateSillM;
        balconyResizePreview.position.y = balconyResizeHiddenObject.position.y + (candidateSillM - dragElementStart.sillHeightM);
      }
      return;
    }
    if (dragMode && dragMode.indexOf('stairWidth') === 0) {
      // Cópia direta do redimensionamento de largura do Bloco de
      // Volumetria — mesma matemática, eixo local X.
      var stResizeW = Store.findStair(selectedStairId);
      var groundResizeSt = getGroundModelPoint(e.clientX, e.clientY);
      if (stResizeW && groundResizeSt && dragElementStart) {
        var alongSt = ((groundResizeSt.x - dragElementStart.center.x) * dragElementStart.axisX + (groundResizeSt.y - dragElementStart.center.y) * dragElementStart.axisY) / Core.GRID;
        var candidateStW = Math.max(Core.STAIR_MIN_WIDTH_M, Math.min(dragElementStart.maxWidthM, dragElementStart.widthM / 2 + alongSt * dragElementStart.side));
        var centerDeltaSt = dragElementStart.side * (candidateStW - dragElementStart.widthM) / 2;
        dragElementStart.lastWidthM = candidateStW;
        dragElementStart.centerDeltaM = centerDeltaSt;
        if (stairResizePreview) {
          stairResizePreview.scale.x = candidateStW / stResizeW.widthM;
          var worldDeltaSt = centerDeltaSt * Core.GRID * scale;
          stairResizePreview.position.x = stairResizeHiddenObject.position.x + dragElementStart.axisX * worldDeltaSt;
          stairResizePreview.position.z = stairResizeHiddenObject.position.z + dragElementStart.axisY * worldDeltaSt;
        }
      }
      return;
    }
    if (dragMode && dragMode.indexOf('volumeBoxCorner:') === 0) {
      var vbCornerDragBox = Store.findVolumeBox(selectedVolumeBoxId);
      var vbCornerGroundNow = getGroundModelPoint(e.clientX, e.clientY);
      if (vbCornerDragBox && vbCornerGroundNow && dragElementStart) {
        var vbCornerDx = (vbCornerGroundNow.x - dragElementStart.groundStart.x) / Core.GRID;
        var vbCornerDz = (vbCornerGroundNow.y - dragElementStart.groundStart.y) / Core.GRID;
        var vbCornerDy = (dragElementStart.startScreenY - e.clientY) * 0.02;
        dragElementStart.lastDelta = { x: vbCornerDx, y: vbCornerDy, z: vbCornerDz };
        var vbCornerWorking = dragElementStart.baseOffsets.map(function (o: any) { return { x: o.x, y: o.y, z: o.z }; });
        var vbCornerTarget = vbCornerWorking[dragElementStart.cornerIndex];
        vbCornerTarget.x += vbCornerDx; vbCornerTarget.y += vbCornerDy; vbCornerTarget.z += vbCornerDz;
        updateVolumeBoxSkewPreview(vbCornerDragBox, vbCornerWorking);
      }
      return;
    }
    if (dragMode && dragMode.indexOf('volumeBoxEdge:') === 0) {
      var vbEdgeDragBox = Store.findVolumeBox(selectedVolumeBoxId);
      var vbEdgeGroundNow = getGroundModelPoint(e.clientX, e.clientY);
      if (vbEdgeDragBox && vbEdgeGroundNow && dragElementStart) {
        var vbEdgeDx = (vbEdgeGroundNow.x - dragElementStart.groundStart.x) / Core.GRID;
        var vbEdgeDz = (vbEdgeGroundNow.y - dragElementStart.groundStart.y) / Core.GRID;
        var vbEdgeDy = (dragElementStart.startScreenY - e.clientY) * 0.02;
        dragElementStart.lastDelta = { x: vbEdgeDx, y: vbEdgeDy, z: vbEdgeDz };
        var vbEdgeWorking = dragElementStart.baseOffsets.map(function (o: any) { return { x: o.x, y: o.y, z: o.z }; });
        var vbEdgePair = Core.VOLUME_BOX_EDGES[dragElementStart.edgeIndex]!;
        vbEdgePair.forEach(function (ci: number) {
          vbEdgeWorking[ci].x += vbEdgeDx; vbEdgeWorking[ci].y += vbEdgeDy; vbEdgeWorking[ci].z += vbEdgeDz;
        });
        updateVolumeBoxSkewPreview(vbEdgeDragBox, vbEdgeWorking);
      }
      return;
    }
    if (dragMode && dragMode.indexOf('volumeBoxFace:') === 0) {
      // Push-pull: vertical usa o delta de tela (mesma heurística das
      // antigas alças de altura); as outras 4 projetam o movimento do
      // chão na normal da face (já calculada em coordenadas de mundo
      // no início do arraste — ver pointerdown).
      var vbFaceDragBox = Store.findVolumeBox(selectedVolumeBoxId);
      if (vbFaceDragBox && dragElementStart) {
        var vbFaceDeltaAlongNormal = 0;
        if (dragElementStart.faceVertical) {
          vbFaceDeltaAlongNormal = -dragElementStart.faceNormal.y * (e.clientY - dragElementStart.startScreenY) * 0.02;
        } else {
          var vbFaceGroundNow = getGroundModelPoint(e.clientX, e.clientY);
          if (vbFaceGroundNow) {
            var vbFaceGdx = (vbFaceGroundNow.x - dragElementStart.groundStart.x) / Core.GRID;
            var vbFaceGdz = (vbFaceGroundNow.y - dragElementStart.groundStart.y) / Core.GRID;
            vbFaceDeltaAlongNormal = vbFaceGdx * dragElementStart.worldNormalX + vbFaceGdz * dragElementStart.worldNormalZ;
          }
        }
        dragElementStart.lastDeltaAlongNormalM = vbFaceDeltaAlongNormal;
        var vbFaceWorking = dragElementStart.baseOffsets.map(function (o: any) { return { x: o.x, y: o.y, z: o.z }; });
        var vbFaceCornerIndices = Core.volumeBoxFaces(vbFaceDragBox)[dragElementStart.faceIndex]!.cornerIndices;
        var vbFaceLocalDx = dragElementStart.faceNormal.x * vbFaceDeltaAlongNormal;
        var vbFaceLocalDy = dragElementStart.faceNormal.y * vbFaceDeltaAlongNormal;
        var vbFaceLocalDz = dragElementStart.faceNormal.z * vbFaceDeltaAlongNormal;
        vbFaceCornerIndices.forEach(function (ci: number) {
          vbFaceWorking[ci].x += vbFaceLocalDx; vbFaceWorking[ci].y += vbFaceLocalDy; vbFaceWorking[ci].z += vbFaceLocalDz;
        });
        updateVolumeBoxSkewPreview(vbFaceDragBox, vbFaceWorking);
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
    if (dragMode === 'varandaBody') {
      var gpVB = getGroundModelPoint(e.clientX, e.clientY);
      if (gpVB && dragElementStart?.lastGround) {
        var deltaVBX = gpVB.x - dragElementStart.lastGround.x, deltaVBY = gpVB.y - dragElementStart.lastGround.y;
        Store.commands.updateVarandaBodyLive(selectedVarandaId, deltaVBX, deltaVBY, !e.altKey);
        dragElementStart.lastGround = gpVB;
      }
      return;
    }
    if (dragMode === 'varandaTraceEnd' || dragMode === 'varandaTraceStart') {
      var gpVT = getGroundModelPoint(e.clientX, e.clientY);
      if (gpVT) Store.commands.extendVarandaLive(selectedVarandaId, Core.snap(gpVT.x), Core.snap(gpVT.y), !!e.shiftKey);
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
    if (dragMode === 'openingEdgeBottom') {
      if (dragElementStart) {
        var deltaSillO = dragElementStart.startScreenY - e.clientY;
        Store.commands.updateOpeningSillHeightLive(selectedOpeningId, dragElementStart.sillHeight + deltaSillO * 0.01);
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
        // Acompanha a altura PRÓPRIA do cômodo embaixo do centro do
        // retângulo (Core.roofHeightAtRect, mesma regra da laje) — arrastar
        // o fantasma pra cima de um cômodo diferente muda a altura junto,
        // sempre a altura do cômodo em que o fantasma está, sem subir por
        // causa de parede vizinha (essa parte agora é só visual, ver
        // Scene3DRenderer.applyRoomBoxClipping).
        var roofHeightT = Core.roofHeightAtRect(Store.currentWalls(), rectT.x1, rectT.y1, rectT.x2, rectT.y2, Scene3DRenderer.WALL_HEIGHT_GETTER());
        drawPreview = { tool: 'telhado', x1: rectT.x1, y1: rectT.y1, x2: rectT.x2, y2: rectT.y2, yOffset: currentFloorYOffset(), roofType: pendingRoofType, pitchDeg: 28, roofBaseHeightM: roofHeightT };
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
        var hitsSelected = mesh && ((mesh.userData.wallId && mesh.userData.wallId === selectedWallId) || (mesh.userData.columnId && mesh.userData.columnId === selectedColumnId) || (mesh.userData.roofId && mesh.userData.roofId === selectedRoofId) || (mesh.userData.varandaId && mesh.userData.varandaId === selectedVarandaId) || (mesh.userData.lajeId && mesh.userData.lajeId === selectedLajeId) || (mesh.userData.furnitureId && mesh.userData.furnitureId === selectedFurnitureId) || (mesh.userData.balconyRailingId && mesh.userData.balconyRailingId === selectedBalconyRailingId));
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
        // Commit final da prévia fantasma — a ÚNICA vez que o Store é
        // tocado no gesto inteiro (ver resolveWallResizeCandidate /
        // previewWallResize no pointermove). Recalcula o candidato uma
        // última vez a partir da posição de soltar do mouse (mesma
        // matemática, evita guardar valores "penúltimos" de um frame
        // anterior) e só então aplica de verdade, incluindo a
        // parede-ponte (rastro) se algum lado precisar — mesma lógica
        // que antes rodava a cada pointermove, agora uma vez só.
        var finalCandidate = resolveWallResizeCandidate(e);
        if (finalCandidate) {
          Store.commands.updateWallResizeLive(
            resizeWallId, finalCandidate.rx1, finalCandidate.ry1, finalCandidate.rx2, finalCandidate.ry2, finalCandidate.linked
          );
          var endpointStillOnSupport = function (supportIds: any[], x: number, y: number) {
            return supportIds.some(function (supportId: any) {
              var support = Store.findWall(supportId);
              return support && Core.distToSegment(x, y, support.x1, support.y1, support.x2, support.y2) <= Core.COINCIDENCE_TOL;
            });
          };
          var startSlides = endpointStillOnSupport(dragElementStart.startSlidingSupports, finalCandidate.rx1, finalCandidate.ry1);
          var endSlides = endpointStillOnSupport(dragElementStart.endSlidingSupports, finalCandidate.rx2, finalCandidate.ry2);
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
          var startCovered = oldNodeCoveredByMovedLink(dragElementStart.linksStart, dragElementStart.x1, dragElementStart.y1);
          var endCovered = oldNodeCoveredByMovedLink(dragElementStart.linksEnd, dragElementStart.x2, dragElementStart.y2);
          var needsBridgeStart = Core.wallResizeEndpointNeedsBridge(dragElementStart.rawStart, dragElementStart.linksStart, startSlides || startCovered);
          var needsBridgeEnd = Core.wallResizeEndpointNeedsBridge(dragElementStart.rawEnd, dragElementStart.linksEnd, endSlides || endCovered);
          if (needsBridgeStart && Math.hypot(finalCandidate.rx1 - dragElementStart.x1, finalCandidate.ry1 - dragElementStart.y1) > 0.5) {
            dragElementStart.bridgeStartId = Store.commands.createBridgeWallLive(dragElementStart.x1, dragElementStart.y1, finalCandidate.rx1, finalCandidate.ry1);
          }
          if (needsBridgeEnd && Math.hypot(finalCandidate.rx2 - dragElementStart.x2, finalCandidate.ry2 - dragElementStart.y2) > 0.5) {
            dragElementStart.bridgeEndId = Store.commands.createBridgeWallLive(dragElementStart.x2, dragElementStart.y2, finalCandidate.rx2, finalCandidate.ry2);
          }
          dragElementStart.diagnosticDeltaX = finalCandidate.rx1 - dragElementStart.x1;
          dragElementStart.diagnosticDeltaY = finalCandidate.ry1 - dragElementStart.y1;
        }
        clearWallResizePreview();
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
      // Rede de segurança: garante que nenhuma malha real fique escondida
      // pra sempre se o gesto terminou de um jeito que o bloco acima não
      // previu (ex.: resizeWallId zerado no meio do caminho) — a prévia
      // já devia ter sido limpa lá em cima, isso só evita vazamento.
      clearWallResizePreview();
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'roomHeight') {
      // Commit único (DEC-88): resolve a altura de cada parede do
      // contorno de uma vez, aplicando a regra combinada com o Product
      // Owner — parede compartilhada com outro cômodo nunca fica mais
      // baixa do que esse outro cômodo já está (Core.resolveRoomHeightUpdate).
      if (dragElementStart && dragElementStart.roomWallIds && dragElementStart.lastHeight != null) {
        var heightUpdates = Core.resolveRoomHeightUpdate(
          Store.currentWalls(),
          dragElementStart.roomWallIds,
          dragElementStart.lastHeight,
          Scene3DRenderer.WALL_HEIGHT_GETTER()
        );
        Store.commands.updateRoomWallsHeightLive(heightUpdates);
        hintEl.textContent = 'Altura do cômodo ajustada — ' + dragElementStart.lastHeight.toFixed(2).replace('.', ',') + ' m.';
      }
      // Desarma sozinho depois de UM ajuste (DEC-116) — próxima mudança
      // de altura exige clicar "Ajustar altura" de novo, de propósito.
      heightAdjustArmedWallId = null;
      clearWallResizePreview();
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
    if (dragMode === 'wholeConstruction') {
      if (dragElementStart) {
        Store.commands.moveEntireConstruction(dragElementStart.lastDx || 0, dragElementStart.lastDy || 0);
      }
      wholeConstructionDragObjects = [];
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
      Store.commands.autoComposeRoofs();
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if ((dragMode && dragMode.indexOf('glazingWidth') === 0) || dragMode === 'glazingHeight') {
      var finalGlazingWidth = dragElementStart && dragElementStart.lastWidthM;
      var finalGlazingHeight = dragElementStart && dragElementStart.lastHeightM;
      clearGlazingResizePreview();
      if (selectedGlazingPanelId && finalGlazingWidth && finalGlazingHeight) {
        Store.commands.updateGlazingPanelSizeLive(selectedGlazingPanelId, finalGlazingWidth, finalGlazingHeight, dragElementStart.centerDeltaM || 0);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode && dragMode.indexOf('balconyWidth') === 0) {
      var finalBalconyWidth = dragElementStart && dragElementStart.lastWidthM;
      clearBalconyResizePreview();
      if (selectedBalconyRailingId && finalBalconyWidth) {
        Store.commands.updateBalconyRailingSizeLive(selectedBalconyRailingId, finalBalconyWidth, dragElementStart.centerDeltaM || 0);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'balconyHeightTop' || dragMode === 'balconyHeightBottom') {
      var finalBalconyHeight = dragElementStart && dragElementStart.lastHeightM;
      var finalBalconySill = dragElementStart && dragElementStart.lastSillHeightM;
      clearBalconyResizePreview();
      if (selectedBalconyRailingId && finalBalconyHeight != null && finalBalconySill != null) {
        Store.commands.updateBalconyRailingVerticalLive(selectedBalconyRailingId, finalBalconyHeight, finalBalconySill);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode && dragMode.indexOf('stairWidth') === 0) {
      var finalStWidth = dragElementStart && dragElementStart.lastWidthM;
      clearStairResizePreview();
      if (selectedStairId && finalStWidth) {
        Store.commands.updateStairWidthLive(selectedStairId, finalStWidth, dragElementStart.centerDeltaM || 0);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode && dragMode.indexOf('volumeBoxCorner:') === 0) {
      var finalVbCornerDelta = dragElementStart && dragElementStart.lastDelta;
      clearVolumeBoxResizePreview();
      if (selectedVolumeBoxId && finalVbCornerDelta) {
        Store.commands.updateVolumeBoxCornerLive(selectedVolumeBoxId, dragElementStart.cornerIndex, finalVbCornerDelta.x, finalVbCornerDelta.y, finalVbCornerDelta.z);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode && dragMode.indexOf('volumeBoxEdge:') === 0) {
      var finalVbEdgeDelta = dragElementStart && dragElementStart.lastDelta;
      clearVolumeBoxResizePreview();
      if (selectedVolumeBoxId && finalVbEdgeDelta) {
        Store.commands.updateVolumeBoxEdgeLive(selectedVolumeBoxId, dragElementStart.edgeIndex, finalVbEdgeDelta.x, finalVbEdgeDelta.y, finalVbEdgeDelta.z);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode && dragMode.indexOf('volumeBoxFace:') === 0) {
      var finalVbFaceDelta = dragElementStart ? dragElementStart.lastDeltaAlongNormalM : 0;
      clearVolumeBoxResizePreview();
      if (selectedVolumeBoxId && finalVbFaceDelta) {
        Store.commands.updateVolumeBoxFaceLive(selectedVolumeBoxId, dragElementStart.faceIndex, finalVbFaceDelta);
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    // Elevação do telhado inteiro: faltava encerrar este modo no
    // pointerup. Sem este bloco, o cursor continuava alterando baseHeightM
    // mesmo depois de soltar o mouse; ao mover o ponteiro para baixo, a
    // cobertura podia voltar ao topo das paredes e os fechamentos próprios
    // dela pareciam desaparecer. O gesto agora termina exatamente ao soltar.
    if (dragMode === 'roofBaseHeight') {
      if (selectedRoofId && dragElementStart && dragElementStart.startScreenY != null) {
        var finalWholeRoofHeight = dragElementStart.baseHeightM + (dragElementStart.startScreenY - e.clientY) * 0.01;
        Store.commands.updateRoofBaseHeightLive(selectedRoofId, finalWholeRoofHeight);
      }
      var elevatedRoof = selectedRoofId ? Store.findRoof(selectedRoofId) : null;
      if (elevatedRoof) {
        hintEl.textContent = 'Telhado inteiro posicionado individualmente — base em ' + (elevatedRoof.baseHeightM || Core.WALL_HEIGHT).toFixed(2).replace('.', ',') + ' m.';
      }
      try { if (container.hasPointerCapture && container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId); } catch (_) {}
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'roofRidge' || dragMode === 'roofParapetHeight') {
      if (roofPitchDragCotaEl) roofPitchDragCotaEl.style.display = 'none';
      if (selectedRoofId && fuseRoofsIfTouching(selectedRoofId)) {
        hintEl.textContent = 'Telhados fundidos — a cumeeira agora é uma só.';
        onModelChanged();
      }
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
    if (dragMode === 'volumeBoxBody') {
      // Mesmo padrão do painel de Envidraçamento — única atualização de
      // Store no fim do arraste. Sem ímã de parede (Product Owner
      // pediu bloco sempre livre — "tirar o imã e fazer as alças em
      // todas as direções").
      var vbId = selectedVolumeBoxId;
      if (vbId && dragElementStart && dragGroundStart) {
        var vbUp = getGroundModelPoint(e.clientX, e.clientY);
        if (vbUp) {
          var dxVbUp = vbUp.x - dragGroundStart.x, dyVbUp = vbUp.y - dragGroundStart.y;
          Store.commands.updateVolumeBoxBodyLive(vbId, dragElementStart.x + dxVbUp, dragElementStart.y + dyVbUp);
        }
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      volumeBoxDragMesh = null;
      return;
    }
    if (dragMode === 'stairBody') {
      // Mesmo padrão do Bloco de Volumetria — única atualização de Store
      // no fim do arraste. Sem ímã de parede/coluna: depois de commitar
      // a posição, só CALCULA a distância até o apoio mais próximo e
      // avisa no rodapé se estiver longe — não trava nada (Product
      // Owner confirmou: aviso, sem travar, mesma filosofia do Bloco de
      // Volumetria sem ímã).
      var stId = selectedStairId;
      if (stId && dragElementStart && dragGroundStart) {
        var stUp = getGroundModelPoint(e.clientX, e.clientY);
        if (stUp) {
          var dxStUp = stUp.x - dragGroundStart.x, dyStUp = stUp.y - dragGroundStart.y;
          var finalStX = dragElementStart.x + dxStUp, finalStY = dragElementStart.y + dyStUp;
          Store.commands.updateStairBodyLive(stId, finalStX, finalStY);
          var stEntUp = Store.findStair(stId);
          if (stEntUp) {
            var stFootprintUp = Scene3DRenderer.getStairFootprintMeters(stEntUp);
            var stDepthUp = stFootprintUp ? stFootprintUp.depthM : Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER();
            var stAngleUp = (stEntUp.rotationDeg || 0) * Math.PI / 180;
            var travelAxisX = -Math.sin(stAngleUp), travelAxisY = Math.cos(stAngleUp);
            var halfLengthGrid = stDepthUp * Core.GRID / 2;
            var startX = finalStX - travelAxisX * halfLengthGrid, startY = finalStY - travelAxisY * halfLengthGrid;
            var supportDistM = Core.nearestSupportDistanceMeters(startX, startY, Store.currentWalls(), Store.currentColumns());
            if (supportDistM > Core.STAIR_SUPPORT_HINT_TOLERANCE_M) {
              hintEl.textContent = 'A base da escada está longe de uma parede ou coluna — considere reposicionar pra ter apoio estrutural.';
            }
          }
        }
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      stairDragMesh = null;
      return;
    }
    if (dragMode === 'balconyRailingBody') {
      // Mesmo padrão do painel de Envidraçamento — única atualização de
      // Store no fim do arraste. Sem ímã de parede (a sacada nunca
      // encosta, confirmado pelo Product Owner).
      var brId = selectedBalconyRailingId;
      if (brId && dragElementStart && dragGroundStart) {
        var brUp = getGroundModelPoint(e.clientX, e.clientY);
        if (brUp) {
          var dxBrUp = brUp.x - dragGroundStart.x, dyBrUp = brUp.y - dragGroundStart.y;
          Store.commands.updateBalconyRailingBodyLive(brId, dragElementStart.x + dxBrUp, dragElementStart.y + dyBrUp);
        }
      }
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      balconyRailingDragMesh = null;
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
    if (dragMode === 'hydraulicFixtureBody') {
      if (selectedHydraulicNodeId && dragElementStart) {
        Store.commands.updateHydraulicFixtureBodyLive(selectedHydraulicNodeId, dragElementStart.lastX, dragElementStart.lastY, dragElementStart.lastElevationM);
      }
      clearHydraulicDragCotas();
      hydraulicFixtureDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      return;
    }
    if (dragMode === 'hydraulicJunctionBody') {
      if (selectedHydraulicNodeId && dragElementStart) {
        Store.commands.moveHydraulicJunction(selectedHydraulicNodeId, dragElementStart.lastX, dragElementStart.lastY);
      }
      clearHydraulicDragCotas();
      hydraulicFixtureDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      render();
      return;
    }
    if (dragMode === 'hydraulicSourceBody') {
      if (selectedHydraulicNodeId && dragElementStart) {
        Store.commands.updateHydraulicSourceBodyLive(selectedHydraulicNodeId, dragElementStart.lastX, dragElementStart.lastY);
      }
      hydraulicFixtureDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      render();
      return;
    }
    if (dragMode === 'hydraulicDestinationBody') {
      if (selectedHydraulicNodeId && dragElementStart) {
        Store.commands.updateHydraulicDestinationBodyLive(selectedHydraulicNodeId, dragElementStart.lastX, dragElementStart.lastY);
      }
      hydraulicFixtureDragObjects = [];
      dragMode = null; dragElementStart = null; dragGroundStart = null; downButton = null;
      render();
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
    if (dragMode === 'openingSlide' || dragMode === 'openingEdgeLeft' || dragMode === 'openingEdgeRight' || dragMode === 'openingEdgeTop' || dragMode === 'openingEdgeBottom' || dragMode === 'varandaBody' || dragMode === 'varandaTraceEnd' || dragMode === 'varandaTraceStart' || (dragMode && dragMode.indexOf('varandaEdge') === 0)) {
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

  // Início do arraste de altura de CÔMODO (DEC-88) — clique na alça
  // 'roomHeight'. Congela o contorno do cômodo (Core.roomsContainingWall
  // + findRoomWallIds) e a altura efetiva atual logo no começo do gesto,
  // mesmo espírito de "congelar a rede" já usado em startWallResizeDrag:
  // recalcular a topologia a cada frame não é necessário aqui (a forma
  // do cômodo não muda, só a altura), então fica mais simples travar uma
  // vez só.
  function startRoomHeightDrag(wallId: any, clientY: any) {
    var w = Store.findWall(wallId);
    if (!w) return;
    var owningRooms = Core.roomsContainingWall(Store.currentWalls(), wallId);
    if (!owningRooms.length) return;
    var roomWallIds = Core.findRoomWallIds(Store.currentWalls(), owningRooms[0]!);
    if (!roomWallIds.length) return;
    // roomOwnHeightM (não roomHeightM) — parte da altura PRÓPRIA do
    // cômodo, ignorando uma parede compartilhada que só esteja alta
    // porque acompanha um vizinho (DEC-89); senão o próximo arraste
    // "herdaria" sem querer a altura do vizinho como ponto de partida.
    var startHeight = Core.roomOwnHeightM(Store.currentWalls(), roomWallIds, Scene3DRenderer.WALL_HEIGHT_GETTER());
    dragElementStart = { roomWallIds: roomWallIds, startHeight: startHeight, startScreenY: clientY };
    dragMode = 'roomHeight';
    Store.commands.beginTransaction();
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
        ? 'Modo câmera ativo: arraste um dedo para girar. Toque em Câmera para voltar a construir.'
        : 'Modo construção ativo. Use dois dedos para girar a câmera e dar zoom.';
    }
    return touchCameraMode;
  }

  var hoverMarker: any;
  var wallGridOverlay: any; // grade sobre as paredes do pavimento, só na ferramenta Telhado

  // Mesmo desenho da logo do Esboce (index.html, .brand-logo — casinha
  // em contorno, com a "portinha" terracota) — reaproveitado aqui como
  // textura de canvas, igual a técnica já usada pros rótulos de
  // hidráulica (hydraulicLabelSprite, Scene3DRenderer.ts). Path2D cria
  // o desenho direto a partir do MESMO atributo "d" do SVG original —
  // não é um redesenho à mão, garante que fica idêntico à marca. Vira
  // Sprite (sempre de frente pra câmera, como um rótulo), não um plano
  // fixo — assim continua legível de qualquer ângulo de câmera.
  function buildLogoSprite() {
    var canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d')!;
    // Fundo — sem isso, o traço fino (mesmo escuro) quase some por
    // cima da grama verde, baixo contraste demais pra ler de longe
    // (mesma técnica de "cartão" branco atrás do desenho já usada em
    // hydraulicLabelSprite, Scene3DRenderer.ts).
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.strokeStyle = 'rgba(211,209,199,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(4, 4, 120, 120, 26); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.translate(14, 14);
    ctx.scale(1.0, 1.0); // viewBox do SVG original é 0 0 100 100, canvas útil ~100x100 após a margem acima
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 8;
    ctx.strokeStyle = '#1B1C1E'; // mais escuro que o #2C2C2A original — precisa de mais peso pra não sumir a distância
    ctx.globalAlpha = 1;
    [
      'M12,94 L11,59 L50,14 L89,58 L88,95',
      'M14,93 L13,60 L51,17 L90,59 L86,93',
      'M50,14 L55,9',
      'M12,58 L5,55',
      'M89,58 L96,54',
      'M12,94 L4,96',
      'M88,95 L96,97',
    ].forEach(function (d) {
      ctx.stroke(new Path2D(d));
    });
    ctx.strokeStyle = '#C1673F';
    ctx.stroke(new Path2D('M41,94 L40,72 L60,72 L61,94'));
    ctx.restore();
    var texture = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(0.46, 0.46, 1);
    sprite.renderOrder = 1000;
    return sprite;
  }

  // O mesmo indicador do Sims: a logo do Esboce no alto de uma haste,
  // com uma seta apontando pro chão — mostra exatamente em qual
  // interseção da grade o desenho vai começar, antes mesmo de clicar.
  function buildHoverMarker() {
    var group = new THREE.Group();
    var poleHeight = 1.3;
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, poleHeight, 8),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    pole.position.y = poleHeight / 2 + 0.1;
    group.add(pole);

    var cap = buildLogoSprite();
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
    escritorio: { label: 'Escritório', widthM: 2.8, depthM: 3.0 },
    circulacao: { label: 'Área de Circulação', widthM: 1.0, depthM: 1.0 }
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
    if (key === 'glazing') {
      // Painel de Envidraçamento (DEC-56) — nasce solto, numa posição
      // padrão perto do que já existe no pavimento (mesmo espírito de
      // gap usado por laje/cômodo). Arraste o corpo até perto de uma
      // parede pra encostar (ímã automático) e recortar a camada
      // visível dela — ver nearestWallForGlazingAttach/
      // attachGlazingPanelToWall (Etapa 2b). O grid de perfis + vidro
      // reflexivo de verdade (Etapa 2c) já existe, ver
      // Scene3DRenderer.buildGlazingPanelGroup.
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
        ? 'Painel de Fachada criado — arraste o corpo dele até perto de uma parede pra encostar.'
        : 'Não foi possível criar o painel de Fachada.';
      return;
    }
    if (key === 'volumetria') {
      // Bloco de Volumetria — sempre livre nas 3 dimensões, sem ímã de
      // parede (Product Owner: "tirar o imã e fazer as alças em todas
      // as direções, para que ele possa formar sacadas, marquises,
      // volumetria, etc") — nasce perto do que já existe (mesmo espírito
      // de vão de 1m da Pele de vidro/Sacada de vidro).
      var wallsV = Store.currentWalls();
      var minXv = Infinity, maxXv = -Infinity, minYv = Infinity;
      wallsV.forEach(function (w) {
        [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
          if (p[0] < minXv) minXv = p[0]; if (p[0] > maxXv) maxXv = p[0];
          if (p[1] < minYv) minYv = p[1];
        });
      });
      var gapV = 1 * Core.GRID;
      var gxV = isFinite(maxXv) ? maxXv + gapV : 0;
      var gyV = isFinite(minYv) ? minYv : 0;
      deselect();
      var newBox = Store.commands.createVolumeBox(gxV, gyV);
      hintEl.textContent = newBox
        ? 'Volume criado — arraste o corpo pra posicionar e as alças nas bordas pra ajustar largura, profundidade e altura. Pinte com a Lata de tinta, igual uma parede.'
        : 'Não foi possível criar o volume.';
      return;
    }
    if (key === 'escada') {
      // Escada — mesmo padrão de nascimento solto do Bloco de Volumetria
      // (perto do que já existe, sem ímã de parede): arraste livre,
      // rotação em passos de 90° (Product Owner confirmou manter o
      // padrão do resto do app em vez de uma alça de giro livre).
      var wallsS = Store.currentWalls();
      var minXs = Infinity, maxXs = -Infinity, minYs = Infinity;
      wallsS.forEach(function (w) {
        [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
          if (p[0] < minXs) minXs = p[0]; if (p[0] > maxXs) maxXs = p[0];
          if (p[1] < minYs) minYs = p[1];
        });
      });
      var gapS = 1 * Core.GRID;
      var gxS = isFinite(maxXs) ? maxXs + gapS : 0;
      var gyS = isFinite(minYs) ? minYs : 0;
      deselect();
      var newStair = Store.commands.createStair(gxS, gyS);
      hintEl.textContent = newStair
        ? 'Escada criada — arraste o corpo pra posicionar perto de uma parede ou coluna (a base precisa de apoio), as alças laterais pra ajustar a largura, e escolha o formato (reta/L/U) no painel ao lado do gizmo.'
        : 'Não foi possível criar a escada.';
      return;
    }
    if (key === 'sacada-vidro') {
      // Sacada de vidro — mesmo padrão de nascimento solto do painel de
      // Envidraçamento acima (perto do que já existe, com 1m de vão),
      // mas SEM ímã de parede nenhum: confirmado com o Product Owner
      // ("sim solta, pode ser deslocada para as quatro direções") —
      // nunca encosta, arraste do corpo é sempre livre.
      var wallsBr = Store.currentWalls();
      var minXbr = Infinity, maxXbr = -Infinity, minYbr = Infinity;
      wallsBr.forEach(function (w) {
        [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (p: any) {
          if (p[0] < minXbr) minXbr = p[0]; if (p[0] > maxXbr) maxXbr = p[0];
          if (p[1] < minYbr) minYbr = p[1];
        });
      });
      var gapBr = 1 * Core.GRID;
      var gxBr = isFinite(maxXbr) ? maxXbr + gapBr : 0;
      var gyBr = isFinite(minYbr) ? minYbr : 0;
      deselect();
      var newRailing = Store.commands.createBalconyRailing(gxBr, gyBr);
      hintEl.textContent = newRailing
        ? 'Sacada de vidro criada — arraste o corpo pra posicionar e as alças laterais pra ajustar o comprimento. Aproxime a ponta de outra sacada pra formar um canto.'
        : 'Não foi possível criar a sacada de vidro.';
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
  // pavimento de baixo já tem pelo menos um cômodo fechado (ver DEC-35
  // e a correção que trocou a laje manual pela automática por cômodo,
  // sessão seguinte) — sem isso, não existe "chão" nenhum pra sustentar
  // o que nasceria ali. A laje em si não é mais um objeto colocado à
  // parte: ela nasce sozinha, calculada junto com o piso, em cima de
  // QUALQUER cômodo fechado (mesmo mecanismo de Core.detectRooms usado
  // pra desenhar o piso) — então a trava passa a checar cômodo fechado
  // no andar de baixo, não mais uma entidade Laje separada.
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
    return !belowFloor || Core.detectRooms(belowFloor.walls).length === 0;
  }
  function requireLajeBelowOrHint() {
    if (floorBelowMissingLaje()) {
      hintEl.textContent = 'Antes de construir neste pavimento, feche pelo menos um cômodo com parede no pavimento de baixo — a laje nasce sozinha em cima dele.';
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
    volumeBoxGizmoEl = document.getElementById('volumeBoxGizmo');
    stairGizmoEl = document.getElementById('stairGizmo');
    stairTypePanelEl = document.getElementById('stairTypePanel');
    forroTypePanelEl = document.getElementById('forroTypePanel');
    planUnderlayGizmoEl = document.getElementById('planUnderlayGizmo');
    layersContextMenuEl = document.getElementById('layersContextMenu');
    columnShapePanelEl = document.getElementById('columnShapePanel');
    roofTypePanelEl = document.getElementById('roofTypePanel');
    roofElevationControlEl = document.getElementById('roofElevationControl');
    roofElevationInputEl = document.getElementById('roofElevationInput');
    roofElevationValueEl = document.getElementById('roofElevationValue');
    roofPitchDragCotaEl = document.getElementById('roofPitchDragCota');
    varandaTypePanelEl = document.getElementById('varandaTypePanel');
    varandaWidthInputEl = document.getElementById('varandaWidthInput');
    varandaHeightInputEl = document.getElementById('varandaHeightInput');
    varandaPitchInputEl = document.getElementById('varandaPitchInput');
    generateAtticBtnEl = document.getElementById('generateAtticBtn');
    paintPickerPanelEl = document.getElementById('paintPickerPanel');
    openingPickerPanelEl = document.getElementById('openingPickerPanel');
    objectPanelEl = document.getElementById('objectPanel');
    objectPanelTitleEl = document.getElementById('objectPanelTitle');
    objectPanelBodyEl = document.getElementById('objectPanelBody');
    hintEl = document.getElementById('viewportHint');
    hydraulicWallPromptEl = document.getElementById('hydraulicWallPrompt');
    hydraulicWallElevationPanelEl = document.getElementById('hydraulicWallElevationPanel');
    hydraulicWallElevationTitleEl = document.getElementById('hydraulicWallElevationTitle');
    hydraulicWallElevationSvgEl = document.getElementById('hydraulicWallElevationSvg');
    var hydraulicWallElevationCloseBtn = document.getElementById('hydraulicWallElevationClose');
    if (hydraulicWallElevationCloseBtn) hydraulicWallElevationCloseBtn.addEventListener('click', closeHydraulicWallElevationPanel);
    if (hydraulicWallElevationSvgEl) hydraulicWallElevationSvgEl.addEventListener('pointerdown', onHydraulicWallElevationSvgPointerDown);
    hydraulicRouteDrawBarEl = document.getElementById('hydraulicRouteDrawBar');
    hydraulicRouteDrawCountEl = document.getElementById('hydraulicRouteDrawCount');
    var hydraulicRouteDrawFinishBtn = document.getElementById('hydraulicRouteDrawFinish');
    var hydraulicRouteDrawCancelBtn = document.getElementById('hydraulicRouteDrawCancel');
    if (hydraulicRouteDrawFinishBtn) hydraulicRouteDrawFinishBtn.addEventListener('click', finishHydraulicRouteDraw);
    if (hydraulicRouteDrawCancelBtn) hydraulicRouteDrawCancelBtn.addEventListener('click', cancelHydraulicRouteDraw);
    hydraulicFloorPanelEl = document.getElementById('hydraulicFloorPanel');
    hydraulicFloorSvgEl = document.getElementById('hydraulicFloorSvg');
    if (hydraulicFloorSvgEl) hydraulicFloorSceneRenderer = new Scene2DRenderer(hydraulicFloorSvgEl);
    var hydraulicFloorPanelCloseBtn = document.getElementById('hydraulicFloorPanelClose');
    if (hydraulicFloorPanelCloseBtn) hydraulicFloorPanelCloseBtn.addEventListener('click', closeHydraulicFloorPanel);
    if (hydraulicFloorSvgEl) hydraulicFloorSvgEl.addEventListener('pointerdown', onHydraulicFloorSvgPointerDown);
    if (window.matchMedia('(pointer: coarse)').matches) {
      hintEl.textContent = 'Toque para construir. Use dois dedos para girar a câmera e dar zoom.';
    }
    wallDiagnosticsPanelEl = document.getElementById('wallDiagnosticsPanel');
    wallDiagnosticsOutputEl = document.getElementById('wallDiagnosticsOutput');
    dimLabelAEl = document.getElementById('dimLabelA');
    dimLabelBEl = document.getElementById('dimLabelB');
    liveRoomDimensionLineEl = document.getElementById('liveRoomDimensionLine');
    liveRoomDimensionLineBEl = document.getElementById('liveRoomDimensionLineB');
    hydraulicDragCotaLayerEl = document.getElementById('hydraulicDragCotaLayer');

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
    // toolSidebar virou dois containers (rail de categorias + painéis
    // flutuantes, um por categoria — ver index.html) — cada um precisa
    // da mesma proteção que o container único de antes tinha.
    var toolSidebarEls = document.querySelectorAll('.category-rail, .category-panel');
    toolSidebarEls.forEach(function (el: any) { el.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); }); });

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
      var axisBtn = e.target.closest('button.roof-axis');
      if (axisBtn && selectedRoofId) {
        Store.commands.rotateRoofAxis(selectedRoofId);
        // Girar o eixo pode tornar dois telhados vizinhos elegíveis (ou não)
        // pra composição automática — sem isso, um telhado em L só se
        // compõe se o usuário também arrastar uma borda depois.
        Store.commands.autoComposeRoofs();
        render();
        return;
      }
      var moldingBtn = e.target.closest('button.roof-molding');
      if (moldingBtn && selectedRoofId) {
        var moldingRoof = Store.findRoof(selectedRoofId);
        if (moldingRoof) Store.commands.setRoofParapetMolding(selectedRoofId, !moldingRoof.parapetMolding);
        render();
        return;
      }
    });
    if (roofElevationInputEl) {
      roofElevationInputEl.addEventListener('pointerdown', function () { Store.commands.beginTransaction(); });
      roofElevationInputEl.addEventListener('input', function () {
        if (!selectedRoofId) return;
        var heightM = Number(roofElevationInputEl.value);
        if (!Number.isFinite(heightM)) return;
        var selectedRoof = Store.findRoof(selectedRoofId);
        if (!selectedRoof) return;
        var elevationTarget = (selectedRoof.atticMode || selectedRoof.steppedWallVolume || selectedRoof.steppedLowerRoofId) ? selectedRoof : null;
        if (!elevationTarget) return;
        Store.commands.updateRoofBaseHeightLive(elevationTarget.id, heightM);
        var appliedRoof = Store.findRoof(elevationTarget.id);
        var appliedHeightM = appliedRoof && appliedRoof.baseHeightM != null ? appliedRoof.baseHeightM : heightM;
        if (roofElevationValueEl) roofElevationValueEl.textContent = appliedHeightM.toFixed(2).replace('.', ',') + ' m';
        hintEl.textContent = 'Telhado inteiro elevado individualmente — base em ' + appliedHeightM.toFixed(2).replace('.', ',') + ' m.';
      });
    }
    [varandaWidthInputEl, varandaHeightInputEl, varandaPitchInputEl].forEach(function (input) {
      input?.addEventListener('change', function () {
        if (!selectedVarandaId) return;
        Store.commands.setVarandaParameters(selectedVarandaId, Number(varandaWidthInputEl.value), Number(varandaHeightInputEl.value), Number(varandaPitchInputEl.value));
        render();
      });
      input?.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
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
    if (paintPickerPanelEl) {
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
        if (pendingCommercialSelection) Store.commands.setCommercialSelection(Store.currentFloor().id + ':room:' + selectedPaintRoomKey, pendingCommercialSelection);
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
    }
    openingPickerPanelEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    openingPickerPanelEl.addEventListener('click', function (e: any) {
      var btn = e.target.closest('button.paint-surface');
      if (!btn) return;
      if (btn.dataset.openingMaterial) {
        openingPickerMaterial = btn.dataset.openingMaterial;
      } else {
        pendingOpeningProductId = btn.dataset.openingProduct || null;
      }
      refreshOpeningPickerPanel();
    });
    gizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    openingGizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    roomGizmoEl.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    roomGizmoEl.addEventListener('click', function (e: any) {
      var raiseBtn = e.target.closest('button[data-action="raiseRoom"]');
      if (!raiseBtn || !selectedRoomWallIds) return;
      var raisedWalls = Store.commands.raiseRoom(selectedRoomWallIds);
      if (!raisedWalls) {
        hintEl.textContent = 'Não foi possível subir este cômodo.';
        return;
      }
      selectRoomGroup(raisedWalls.map(function (wall: any) { return wall.id; }));
      hintEl.textContent = 'Cômodo movido para cima com a laje de entrepiso criada automaticamente.';
    });
    volumeBoxGizmoEl?.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    stairGizmoEl?.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    stairTypePanelEl?.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    stairTypePanelEl?.addEventListener('click', function (e: any) {
      var stBtn = e.target.closest('button.st');
      if (!stBtn || !selectedStairId) return;
      Store.commands.setStairModel(selectedStairId, stBtn.dataset.stairmodel);
    });
    forroTypePanelEl?.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
    forroTypePanelEl?.addEventListener('click', function (e: any) {
      var ftBtn = e.target.closest('button.ft');
      if (!ftBtn || !selectedForroRoomKey) return;
      Store.commands.setForroBoardType(selectedForroRoomKey, ftBtn.dataset.forrotipo);
      render();
    });
    planUnderlayGizmoEl?.addEventListener('pointerdown', function (e: any) { e.stopPropagation(); });
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
        if (btn.dataset.roomPreset !== 'varanda' && btn.dataset.roomPreset !== 'glazing' && btn.dataset.roomPreset !== 'volumetria' && btn.dataset.roomPreset !== 'sacada-vidro' && !requireLajeBelowOrHint()) return;
        placeRoomPreset(btn.dataset.roomPreset);
      });
    });
    document.querySelectorAll('[data-disabled-label]').forEach(function (btn: any) {
      btn.addEventListener('click', function () { flashDisabledHint(btn.dataset.disabledLabel); });
    });

    container.addEventListener('contextmenu', function (e: any) { e.preventDefault(); });
    window.addEventListener('keydown', function (e: any) {
      if (e.key === 'Escape' && placingDraw) cancelPlacing();
      if (e.key === 'Escape' && hydraulicRouteDrawState) cancelHydraulicRouteDraw();
      if (e.key === 'Enter' && hydraulicRouteDrawState) finishHydraulicRouteDraw();
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
  export function getSelectedBalconyRailingId() { return selectedBalconyRailingId; }
  export function getSelectedVolumeBoxId() { return selectedVolumeBoxId; }
  export function getSelectedStairId() { return selectedStairId; }
  export function getSelectedForroRoomKey() { return selectedForroRoomKey; }
  export function getSelectedPlanUnderlay() { return selectedPlanUnderlay; }
  export function getSelectedHydraulicNodeId() { return selectedHydraulicNodeId; }
  export function getSelectedRoomWallIds() { return selectedRoomWallIds; }
  export function setNextRoofAtticMode(enabled: boolean) { pendingRoofAttic = enabled; }
  // Categoria "Cobertura" da barra nova — escolher o tipo (1/2/4 Águas,
  // Platibanda) ANTES de clicar em Telhado, em vez de nascer sempre
  // duasAguas e trocar depois pelo painel de tipo. Não pula a checagem
  // Ático/Normal (`atticModeOverlay`) — só pré-seleciona qual tipo vale
  // se a pessoa escolher "Normal" ali.
  export function setNextRoofType(type: any) { pendingRoofType = type; }
  export function activateRoofTool() { setTool('telhado'); }
  export function cancelActiveTool() { setTool(null); }
  export function setSteelFrameSurfaceSelectionHandler(handler: typeof steelFrameSurfaceSelectionHandler) {
    steelFrameSurfaceSelectionHandler = handler;
    if (handler) {
      setTool(null);
      hintEl.textContent = 'Clique diretamente em uma face de parede, oitão ou cobertura.';
    }
  }
  export function beginFacadeWallSelection(handler: ((wallId: string) => void) | null): void {
    facadeWallSelectionHandler = handler;
    facadeIsolatedWallIds = null;
    setTool(null);
    hintEl.textContent = handler ? 'Clique nas paredes que receberão a fachada e depois confirme.' : '';
    render();
  }
  export function isolateFacadeWalls(wallIds: string[]): void {
    facadeWallSelectionHandler = null;
    facadeIsolatedWallIds = wallIds.slice();
    deselect();
    const totalWidthM = wallIds.reduce((total, id) => total + (Store.findWall(id) ? Core.wallLengthMeters(Store.findWall(id)!) : 0), 0) + Math.max(0, wallIds.length - 1);
    camAngle = Math.PI / 2; camElev = 0.04; camDist = Math.max(8, totalWidthM * 0.72);
    camTarget.x = 0; camTarget.y = 1.45; camTarget.z = 0; updateCam(); render();
  }
  export function clearFacadeIsolation(): void {
    facadeWallSelectionHandler = null; facadeIsolatedWallIds = null; render();
  }
  export function setSteelFrameRoofHidden(hidden: boolean) {
    if (steelFrameRoofHidden === hidden) return;
    steelFrameRoofHidden = hidden;
    render();
  }
  export function activateCatalogProduct(productId: string, selection: CommercialSelection): boolean {
    var product = Catalog.getProduct(productId);
    if (!product) return false;
    pendingCommercialSelection = selection;
    if (product.category === 'paint') {
      currentPaintSurface = 'walls'; currentPaintProductId = productId; setTool('paintBucket');
      hintEl.textContent = 'Produto carregado. Clique somente nas paredes compatíveis.';
      return true;
    }
    if (product.category === 'floor_tile') {
      currentPaintSurface = 'floors'; currentPaintProductId = productId; selectedPaintRoomKey = null; setTool('paintBucket');
      hintEl.textContent = 'Produto carregado. Clique no piso compatível e confirme Aplicar.';
      return true;
    }
    if (product.category === 'roof_tile') {
      currentPaintSurface = 'roofs'; currentPaintProductId = productId; setTool('paintBucket');
      hintEl.textContent = 'Produto carregado. Clique somente em coberturas compatíveis.';
      return true;
    }
    if (product.category === 'door' || product.category === 'window') {
      pendingOpeningProductId = productId; setTool(product.category);
      hintEl.textContent = 'Produto carregado. Clique numa parede compatível para posicionar.';
      return true;
    }
    if (product.category === 'furniture') {
      var item = Store.commands.createFurniture(camTarget.x * Core.GRID, camTarget.z * Core.GRID, productId, 0, 0);
      Store.commands.setCommercialSelection(Store.currentFloor().id + ':furniture:' + item.id, selection);
      selectFurniture(item.id);
      hintEl.textContent = 'Produto adicionado no centro da vista. Arraste para posicionar.';
      render();
      return true;
    }
    return false;
  }
  // Botão "Ajustar altura" do gizmo (DEC-116) — arma a alça de altura
  // do cômodo SÓ pra esta parede, só até o próximo ajuste/seleção. Sem
  // isso, a alça nem existe na cena (ver renderSelectionHandles em
  // Scene3DRenderer.ts) — nada pra agarrar por engano.
  export function armHeightAdjust(wallId: string) { heightAdjustArmedWallId = wallId; render(); }

// Namespace de compatibilidade — mesma razão de Core.ts/Store.ts/Catalog.ts/
// Scene3DRenderer.ts (chamadas ViewportController.xxx no código legado).
export const ViewportController = {
  init, render, onModelChanged, deselect,
  select, selectColumn, selectRoof, selectOpening, selectVaranda, selectFurniture, selectGlazingPanel, selectVolumeBox, selectStair, selectForro, selectPlanUnderlay, selectHydraulicNode, beginHydraulicRouteDraw,
  getSelectedWallId, getSelectedColumnId, getSelectedRoofId,
  getSelectedOpeningId, getSelectedVarandaId, getSelectedLajeId, getSelectedFurnitureId, getSelectedGlazingPanelId, getSelectedBalconyRailingId, getSelectedVolumeBoxId, getSelectedStairId, getSelectedForroRoomKey, getSelectedPlanUnderlay, getSelectedHydraulicNodeId, getSelectedRoomWallIds,
  setNextRoofAtticMode, setNextRoofType, activateRoofTool, cancelActiveTool, setSteelFrameSurfaceSelectionHandler, setSteelFrameRoofHidden, activateCatalogProduct, armHeightAdjust,
  toggleWallDiagnostics,
  resetCamera,
  focusFacade,
  setFacadeNightMode,
  beginFacadeWallSelection, isolateFacadeWalls, clearFacadeIsolation,
  toggleTouchCameraMode,
  getZoomPercent, zoomIn, zoomOut, setOnZoomChanged,
  toggleLayersMenuAtElement,
  repositionDimensions: repositionLiveDimensions,
};
