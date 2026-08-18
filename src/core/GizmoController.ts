// GizmoController — botões girar/mover/duplicar/excluir que aparecem
// junto do elemento selecionado (parede, coluna, telhado, varanda,
// abertura, cômodo). Migrado de `var GizmoController =
// (function(){...})()` no index.html monolítico original (ver
// legacy/index-monolito-original.html, linhas 5914-6037).

import { Core } from './Core.js';
import { Store } from './Store.js';
import { ViewportController } from './ViewportController.js';

function handleColumnAction(columnId: string, action: string): void {
  const c = Store.findColumn(columnId);
  if (!c) return;
  if (action === 'close') { ViewportController.deselect(); return; }
  if (action === 'delete') { Store.commands.deleteColumn(columnId); ViewportController.deselect(); return; }
  if (action === 'duplicate') {
    const copy = Store.commands.duplicateColumn(columnId);
    if (copy) ViewportController.selectColumn(copy.id);
    return;
  }
  if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
    const dx = action === 'left' ? -Core.SNAP_UNIT : action === 'right' ? Core.SNAP_UNIT : 0;
    const dy = action === 'up' ? -Core.SNAP_UNIT : action === 'down' ? Core.SNAP_UNIT : 0;
    Store.commands.moveColumnBody(columnId, c.x + dx, c.y + dy);
    return;
  }
}

// Telhado suporta fechar/duplicar/excluir e agora também girar — só
// isso muda a direção da cumeeira, nunca sozinho ao redimensionar.
// Mover não faz sentido aqui (o retângulo se ajusta pelas alças de borda).
function handleRoofAction(roofId: string, action: string): void {
  const r = Store.findRoof(roofId);
  if (!r) return;
  if (action === 'close') { ViewportController.deselect(); return; }
  if (action === 'delete') { Store.commands.deleteRoof(roofId); ViewportController.deselect(); return; }
  if (action === 'duplicate') {
    const copy = Store.commands.duplicateRoof(roofId);
    if (copy) ViewportController.selectRoof(copy.id);
    return;
  }
  if (action === 'rotateCw' || action === 'rotateCcw') {
    Store.commands.rotateRoofAxis(roofId);
    return;
  }
}

function handleVarandaAction(varandaId: string, action: string): void {
  const v = Store.findVaranda(varandaId);
  if (!v) return;
  if (action === 'close') { ViewportController.deselect(); return; }
  if (action === 'delete') { Store.commands.deleteVaranda(varandaId); ViewportController.deselect(); return; }
  // Girar reaproveita os mesmos botões de rotação do gizmo padrão — sem
  // "duplicate" nem "up/down/left/right" de propósito, a varanda só tem
  // essas duas ações por enquanto.
  if (action === 'rotateCw' || action === 'rotateCcw') {
    Store.commands.rotateVarandaFront(varandaId);
    return;
  }
}

// Laje deixou de ser objeto selecionável/deletável — nasce automática
// por cômodo fechado, junto com o piso (ver Scene3DRenderer,
// buildAutoLajePiece). handleLajeAction/getSelectedLajeId ficaram sem
// função nenhuma pra chamar; removidos.

// Painel de Envidraçamento (DEC-56) — só close/delete, mesmo espírito
// de Laje: sem girar (a orientação vem da parede quando anexado, ou é
// sempre 0 quando solto) nem duplicar (nasce pelo botão "Fachada" da
// barra lateral, um de cada vez).
function handleGlazingPanelAction(glazingPanelId: string, action: string): void {
  const p = Store.findGlazingPanel(glazingPanelId);
  if (!p) return;
  if (action === 'close') { ViewportController.deselect(); return; }
  if (action === 'delete') { Store.commands.deleteGlazingPanel(glazingPanelId); ViewportController.deselect(); return; }
}

// Bloco de Volumetria — mesmo espírito do painel de Envidraçamento
// acima: close/delete continuam aqui; os ajustes de forma/altura (ver
// #volumeBoxGizmo/index.html) são passo fixo de 0,1m por clique —
// ainda não é arrastar a borda de verdade (isso fica pra uma próxima
// etapa, se pedida), mas já dá controle real sem precisar de um painel
// numérico à parte.
const VOLUME_BOX_STEP_M = 0.1;
function handleVolumeBoxAction(volumeBoxId: string, action: string): void {
  const b = Store.findVolumeBox(volumeBoxId);
  if (!b) return;
  if (action === 'close') { ViewportController.deselect(); return; }
  if (action === 'delete') { Store.commands.deleteVolumeBox(volumeBoxId); ViewportController.deselect(); return; }
  if (action === 'up') { Store.commands.nudgeVolumeBoxHeight(volumeBoxId, VOLUME_BOX_STEP_M); return; }
  if (action === 'down') { Store.commands.nudgeVolumeBoxHeight(volumeBoxId, -VOLUME_BOX_STEP_M); return; }
  if (action === 'widthUp') { Store.commands.resizeVolumeBoxWidth(volumeBoxId, VOLUME_BOX_STEP_M); return; }
  if (action === 'widthDown') { Store.commands.resizeVolumeBoxWidth(volumeBoxId, -VOLUME_BOX_STEP_M); return; }
  if (action === 'heightUp') { Store.commands.resizeVolumeBoxHeight(volumeBoxId, VOLUME_BOX_STEP_M); return; }
  if (action === 'heightDown') { Store.commands.resizeVolumeBoxHeight(volumeBoxId, -VOLUME_BOX_STEP_M); return; }
}

// Móvel: girar (90° por clique)/duplicar/excluir. Mover é só arrasto
// livre direto na peça (ver ViewportController — dragMode
// 'furnitureBody'); os botões de seta não fazem sentido aqui porque o
// objetivo do móvel é justamente NÃO ficar preso ao grid de 50cm.
//
// "Trocar" (swap) não mexe em nada aqui dentro — só avisa quem
// registrou o callback (EsboceApplication, que sabe abrir o catálogo
// filtrado). GizmoController não conhece Supabase nem catálogo, só
// avisa "o usuário quer trocar o produto deste móvel".
let onSwapRequested: ((productId: string) => void) | null = null;
export function setOnSwapRequested(callback: (productId: string) => void): void {
  onSwapRequested = callback;
}

function handleFurnitureAction(furnitureId: string, action: string): void {
  const f = Store.findFurniture(furnitureId);
  if (!f) return;
  if (action === 'close') { ViewportController.deselect(); return; }
  if (action === 'delete') { Store.commands.deleteFurniture(furnitureId); ViewportController.deselect(); return; }
  if (action === 'duplicate') {
    const copy = Store.commands.duplicateFurniture(furnitureId);
    if (copy) ViewportController.selectFurniture(copy.id);
    return;
  }
  if (action === 'rotateCw' || action === 'rotateCcw') {
    Store.commands.rotateFurniture(furnitureId, action === 'rotateCw' ? 90 : -90);
    return;
  }
  if (action === 'swap') {
    if (onSwapRequested) onSwapRequested(f.productId);
    return;
  }
}

export function init(): void {
  const gizmoEl = document.getElementById('wallGizmo');
  gizmoEl?.addEventListener('click', function (e: any) {
    const btn = e.target.closest('button.gz');
    if (!btn) return;
    const action = btn.dataset.action;

    const columnId = ViewportController.getSelectedColumnId();
    if (columnId) { handleColumnAction(columnId, action); return; }

    const roofId = ViewportController.getSelectedRoofId();
    if (roofId) { handleRoofAction(roofId, action); return; }

    const varandaId = ViewportController.getSelectedVarandaId();
    if (varandaId) { handleVarandaAction(varandaId, action); return; }

    const furnitureId = ViewportController.getSelectedFurnitureId();
    if (furnitureId) { handleFurnitureAction(furnitureId, action); return; }

    const wallId = ViewportController.getSelectedWallId();
    if (!wallId) return;
    const w = Store.findWall(wallId);
    if (!w) return;

    if (action === 'close') { ViewportController.deselect(); return; }
    if (action === 'delete') { Store.commands.deleteWall(wallId); ViewportController.deselect(); return; }
    if (action === 'duplicate') {
      const copy = Store.commands.duplicateWall(wallId);
      if (copy) ViewportController.select(copy.id);
      return;
    }
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      const dx = action === 'left' ? -Core.SNAP_UNIT : action === 'right' ? Core.SNAP_UNIT : 0;
      const dy = action === 'up' ? -Core.SNAP_UNIT : action === 'down' ? Core.SNAP_UNIT : 0;
      Store.commands.moveWallBody(wallId, w.x1 + dx, w.y1 + dy, w.x2 + dx, w.y2 + dy);
      return;
    }
    if (action === 'rotateCw' || action === 'rotateCcw') {
      // Restrito a 90° por vez (era 15°) — qualquer ângulo livre deixaria
      // a parede diagonal, e toda a lógica de "seguir o canto", fusão e
      // detecção de colinearidade assume paredes sempre alinhadas ao
      // eixo. Girar em múltiplos de 90° garante que a parede nunca sai
      // do grid.
      Store.commands.rotateWall(wallId, (action === 'rotateCw' ? 1 : -1) * (Math.PI / 2));
      return;
    }
    if (action === 'heightMode') {
      // Clique deliberado (DEC-116) — só a partir daqui a alça de
      // altura do cômodo passa a existir/ser clicável (ver
      // renderSelectionHandles, Scene3DRenderer.ts). Sem isso, ela nem
      // aparece na cena.
      ViewportController.armHeightAdjust(wallId);
      return;
    }
  });

  const openingGizmoEl = document.getElementById('openingGizmo');
  openingGizmoEl?.addEventListener('click', function (e: any) {
    const btn = e.target.closest('button.gz');
    if (!btn) return;
    const openingId = ViewportController.getSelectedOpeningId();
    if (!openingId) return;
    const action = btn.dataset.action;
    if (action === 'close') { ViewportController.deselect(); return; }
    if (action === 'delete') { Store.commands.deleteOpening(openingId); ViewportController.deselect(); return; }
    if (action === 'slideLeft') { Store.commands.nudgeOpening(openingId, -0.1); return; }
    if (action === 'slideRight') { Store.commands.nudgeOpening(openingId, 0.1); return; }
  });

  const roomGizmoEl = document.getElementById('roomGizmo');
  roomGizmoEl?.addEventListener('click', function (e: any) {
    const btn = e.target.closest('button.gz');
    if (!btn) return;
    const action = btn.dataset.action;

    const hydraulicNodeId = ViewportController.getSelectedHydraulicNodeId();
    if (hydraulicNodeId) {
      if (action === 'close') ViewportController.deselect();
      if (action === 'delete') { Store.commands.deleteHydraulicFixture(hydraulicNodeId); ViewportController.deselect(); }
      if (action === 'flipHydraulicFace') Store.commands.flipHydraulicFixtureFace(hydraulicNodeId);
      if (action === 'routeHydraulicToSource') ViewportController.beginHydraulicRouteDraw(hydraulicNodeId);
      return;
    }

    const glazingPanelId = ViewportController.getSelectedGlazingPanelId();
    if (glazingPanelId) { handleGlazingPanelAction(glazingPanelId, action); return; }

    const wallIds = ViewportController.getSelectedRoomWallIds();
    if (!wallIds || !wallIds.length) return;
    if (action === 'close') { ViewportController.deselect(); return; }
    if (action === 'delete') { Store.commands.deleteRoomGroup(wallIds); ViewportController.deselect(); return; }
  });

  // Gizmo próprio do Bloco de Volumetria (index.html#volumeBoxGizmo) —
  // separado do roomGizmo compartilhado acima porque tem botões demais
  // (altura/largura/subir/descer) pra conviver com os botões de
  // hidráulica sem confundir visualmente qual ação pertence a qual tipo
  // de seleção.
  const volumeBoxGizmoEl = document.getElementById('volumeBoxGizmo');
  volumeBoxGizmoEl?.addEventListener('click', function (e: any) {
    const btn = e.target.closest('button.gz');
    if (!btn) return;
    const volumeBoxId = ViewportController.getSelectedVolumeBoxId();
    if (!volumeBoxId) return;
    handleVolumeBoxAction(volumeBoxId, btn.dataset.action);
  });

  // Gizmo da Planta Baixa importada (index.html#planUnderlayGizmo) —
  // mover/girar/escalar por passo fixo, mesmo espírito do gizmo do
  // Bloco de Volumetria acima. Sem ID (é singular por pavimento — ver
  // Store.commands.setPlanUnderlay), então nenhuma checagem de "qual
  // objeto", só se existe planta importada no pavimento atual.
  const PLAN_UNDERLAY_MOVE_STEP_M = 0.2, PLAN_UNDERLAY_ROTATE_STEP_DEG = 5, PLAN_UNDERLAY_SCALE_STEP = 1.05;
  const planUnderlayGizmoEl = document.getElementById('planUnderlayGizmo');
  planUnderlayGizmoEl?.addEventListener('click', function (e: any) {
    const btn = e.target.closest('button.gz');
    if (!btn) return;
    if (!ViewportController.getSelectedPlanUnderlay()) return;
    const action = btn.dataset.action;
    if (action === 'close') { ViewportController.deselect(); return; }
    if (action === 'delete') { Store.commands.deletePlanUnderlay(); ViewportController.deselect(); return; }
    if (action === 'up') { Store.commands.movePlanUnderlay(0, -PLAN_UNDERLAY_MOVE_STEP_M); return; }
    if (action === 'down') { Store.commands.movePlanUnderlay(0, PLAN_UNDERLAY_MOVE_STEP_M); return; }
    if (action === 'left') { Store.commands.movePlanUnderlay(-PLAN_UNDERLAY_MOVE_STEP_M, 0); return; }
    if (action === 'right') { Store.commands.movePlanUnderlay(PLAN_UNDERLAY_MOVE_STEP_M, 0); return; }
    if (action === 'rotateCw') { Store.commands.rotatePlanUnderlay(PLAN_UNDERLAY_ROTATE_STEP_DEG); return; }
    if (action === 'rotateCcw') { Store.commands.rotatePlanUnderlay(-PLAN_UNDERLAY_ROTATE_STEP_DEG); return; }
    if (action === 'scaleUp') { Store.commands.scalePlanUnderlay(PLAN_UNDERLAY_SCALE_STEP); return; }
    if (action === 'scaleDown') { Store.commands.scalePlanUnderlay(1 / PLAN_UNDERLAY_SCALE_STEP); return; }
  });
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const GizmoController = { init, setOnSwapRequested };