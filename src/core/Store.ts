// Store — estado da aplicação (projeto atual), comandos que o alteram, e
// undo. Migrado de `var Store = (function () {...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 1606-2299). Lógica preservada linha a linha; só tipos adicionados e
// var/function trocados por const/arrow onde natural.

import { Core } from './Core.js';
import type {
  Project, Floor, Wall, Column, Roof, Opening, Varanda, ColumnShape, RoofType,
  RidgeAxis, VarandaFrontSide, FoundationType, StoreEvent, StoreListener,
  WallSnapshot, LinkedWallUpdate
} from './types.js';

let project: Project = Core.createProject();
const listeners: StoreListener[] = [];
const events: StoreEvent[] = [];
const undoStack: Project[] = [];
const UNDO_LIMIT = 50;

function emit(event: StoreEvent): void {
  events.push(event);
  listeners.forEach((fn) => fn(event, project));
}

export function onChange(fn: StoreListener): void {
  listeners.push(fn);
}

function pushUndoSnapshot(): void {
  undoStack.push(JSON.parse(JSON.stringify(project)));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

export function currentFloor(): Floor {
  return project.floors[project.currentFloorIndex]!;
}
export function currentWalls(): Wall[] { return currentFloor().walls; }
export function currentColumns(): Column[] {
  const f = currentFloor();
  if (!f.columns) f.columns = [];
  return f.columns;
}
export function currentRoofs(): Roof[] {
  const f = currentFloor();
  if (!f.roofs) f.roofs = [];
  return f.roofs;
}
export function currentOpenings(): Opening[] {
  const f = currentFloor();
  if (!f.openings) f.openings = [];
  return f.openings;
}
export function currentVarandas(): Varanda[] {
  const f = currentFloor();
  if (!f.varandas) f.varandas = [];
  return f.varandas;
}
export function findWall(id: string): Wall | null {
  const walls = currentWalls();
  for (let i = 0; i < walls.length; i++) if (walls[i]!.id === id) return walls[i]!;
  return null;
}
export function findColumn(id: string): Column | null {
  const columns = currentColumns();
  for (let i = 0; i < columns.length; i++) if (columns[i]!.id === id) return columns[i]!;
  return null;
}
export function findRoof(id: string): Roof | null {
  const roofs = currentRoofs();
  for (let i = 0; i < roofs.length; i++) if (roofs[i]!.id === id) return roofs[i]!;
  return null;
}
export function findOpening(id: string): Opening | null {
  const openings = currentOpenings();
  for (let i = 0; i < openings.length; i++) if (openings[i]!.id === id) return openings[i]!;
  return null;
}
export function findVaranda(id: string): Varanda | null {
  const varandas = currentVarandas();
  for (let i = 0; i < varandas.length; i++) if (varandas[i]!.id === id) return varandas[i]!;
  return null;
}

function applyEndpoint(w: Wall, which: 1 | 2, x: number, y: number): void {
  const sx = Core.snap(x), sy = Core.snap(y);
  if (which === 1) { w.x1 = sx; w.y1 = sy; } else { w.x2 = sx; w.y2 = sy; }
}
function applyBody(w: Wall, x1: number, y1: number, x2: number, y2: number): void {
  w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2;
}

export const commands = {
  createWall(x1: number, y1: number, x2: number, y2: number): Wall | null {
    x1 = Core.snap(x1); y1 = Core.snap(y1);
    x2 = Core.snap(x2); y2 = Core.snap(y2);
    if (x1 === x2 && y1 === y2) return null;
    pushUndoSnapshot();
    const wall = Core.createWallEntity(x1, y1, x2, y2);
    currentWalls().push(wall);
    emit({ type: 'WallCreated', floorIndex: project.currentFloorIndex, wallId: wall.id });
    return wall;
  },

  // A ferramenta padrão: UM gesto vira um cômodo fechado inteiro (4
  // paredes), num único passo de undo — inspirado na Room Tool do
  // Sims 4. x1,y1,x2,y2 são dois cantos opostos do retângulo.
  createRoom(x1: number, y1: number, x2: number, y2: number): Wall[] | null {
    x1 = Core.snap(x1); y1 = Core.snap(y1);
    x2 = Core.snap(x2); y2 = Core.snap(y2);
    if (x1 === x2 || y1 === y2) return null; // sem área, não é um cômodo
    pushUndoSnapshot();
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const walls = [
      Core.createWallEntity(minX, minY, maxX, minY),
      Core.createWallEntity(maxX, minY, maxX, maxY),
      Core.createWallEntity(maxX, maxY, minX, maxY),
      Core.createWallEntity(minX, maxY, minX, minY)
    ];
    walls.forEach((w) => currentWalls().push(w));
    emit({ type: 'RoomCreated', floorIndex: project.currentFloorIndex, wallIds: walls.map((w) => w.id) });
    return walls;
  },

  moveWallEndpoint(wallId: string, which: 1 | 2, x: number, y: number): void {
    const w = findWall(wallId); if (!w) return;
    pushUndoSnapshot();
    applyEndpoint(w, which, x, y);
    emit({ type: 'WallEndpointMoved', wallId, which });
  },
  updateWallEndpointLive(wallId: string, which: 1 | 2, x: number, y: number): void {
    const w = findWall(wallId); if (!w) return;
    applyEndpoint(w, which, x, y);
    emit({ type: 'WallEndpointMoved', wallId, which, live: true });
  },

  moveWallBody(wallId: string, x1: number, y1: number, x2: number, y2: number): void {
    const w = findWall(wallId); if (!w) return;
    pushUndoSnapshot();
    applyBody(w, x1, y1, x2, y2);
    emit({ type: 'WallMoved', wallId });
  },
  updateWallBodyLive(wallId: string, x1: number, y1: number, x2: number, y2: number): void {
    const w = findWall(wallId); if (!w) return;
    applyBody(w, x1, y1, x2, y2);
    emit({ type: 'WallMoved', wallId, live: true });
  },

  // Cria a parede-rastro (o "pedacinho novo perpendicular") que fecha o
  // buraco deixado quando a ponta de uma parede se afasta de onde estava
  // — sem empilhar undo (parte da mesma transação do arraste que já
  // começou). x1,y1 é o ponto antigo (fixo); x2,y2 é a ponta que está se
  // movendo ao vivo.
  createBridgeWallLive(x1: number, y1: number, x2: number, y2: number): string {
    const w = Core.createWallEntity(x1, y1, x2, y2);
    currentWalls().push(w);
    emit({ type: 'BridgeWallCreated', wallId: w.id, live: true });
    return w.id;
  },
  updateBridgeWallLive(wallId: string, x1: number, y1: number, x2: number, y2: number): void {
    const w = findWall(wallId); if (!w) return;
    w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2;
    emit({ type: 'WallMoved', wallId, live: true });
  },
  // Some com a parede-rastro sem deixar rastro no histórico de undo
  // (usado quando ela acaba ficando comprimento ~0).
  removeBridgeWallSilent(wallId: string): void {
    const walls = currentWalls();
    let idx = -1;
    for (let i = 0; i < walls.length; i++) if (walls[i]!.id === wallId) { idx = i; break; }
    if (idx < 0) return;
    walls.splice(idx, 1);
    emit({ type: 'BridgeWallRemoved', wallId, live: true });
  },

  // Arrasta o "módulo" (cômodo) inteiro — todas as paredes que formam
  // aquele cômodo se movem juntas, mantendo a forma.
  updateWallsGroupBodyLive(snapshots: WallSnapshot[], dx: number, dy: number): void {
    snapshots.forEach((s) => {
      const w = findWall(s.id); if (!w) return;
      w.x1 = s.x1 + dx; w.y1 = s.y1 + dy; w.x2 = s.x2 + dx; w.y2 = s.y2 + dy;
    });
    emit({ type: 'WallsGroupDragged', live: true });
  },

  // "Empurra" uma parede na direção perpendicular a ela mesma, e arrasta
  // junto qualquer ponta de OUTRA parede que estava encostada nas pontas
  // dela — assim o canto nunca abre um vão.
  updateWallResizeLive(
    wallId: string, x1: number, y1: number, x2: number, y2: number, linkedUpdates?: LinkedWallUpdate[]
  ): void {
    const w = findWall(wallId); if (!w) return;
    w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2;
    (linkedUpdates || []).forEach((u) => {
      const lw = findWall(u.id); if (!lw) return;
      if (u.which === 1) { lw.x1 = u.x; lw.y1 = u.y; } else { lw.x2 = u.x; lw.y2 = u.y; }
    });
    emit({ type: 'WallResizeDragged', wallId, live: true });
  },

  // Funde o trecho onde A e B se sobrepõem na mesma linha, sem apagar
  // identidade de quem sobra fora da sobreposição. Ver comentário
  // histórico completo em legacy/index-monolito-original.html.
  fuseOverlappingWalls(wallAId: string, wallBId: string): void {
    const walls = currentWalls();
    const a = findWall(wallAId), b = findWall(wallBId);
    if (!a || !b) return;
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const bLen = Math.hypot(dx, dy);
    if (bLen < 1e-6) return;
    const ux = dx / bLen, uy = dy / bLen, ox = b.x1, oy = b.y1;
    const proj = (x: number, y: number) => (x - ox) * ux + (y - oy) * uy;
    const toPoint = (t: number) => ({ x: ox + ux * t, y: oy + uy * t });

    const ta1 = proj(a.x1, a.y1), ta2 = proj(a.x2, a.y2);
    const aLo = Math.min(ta1, ta2), aHi = Math.max(ta1, ta2);
    const bLo = 0, bHi = bLen;
    const oLo = Math.max(aLo, bLo), oHi = Math.min(aHi, bHi);
    if (oHi - oLo < Core.SNAP_UNIT * 0.5) return; // sobreposição pequena demais pra valer a pena fundir

    const EPS = 1;
    interface Segment { lo: number; hi: number; from: 'a' | 'b' | 'shared'; }
    const segments: Segment[] = [];
    if (bLo < oLo - EPS) segments.push({ lo: bLo, hi: oLo, from: 'b' });
    if (bHi > oHi + EPS) segments.push({ lo: oHi, hi: bHi, from: 'b' });
    if (aLo < oLo - EPS) segments.push({ lo: aLo, hi: oLo, from: 'a' });
    if (aHi > oHi + EPS) segments.push({ lo: oHi, hi: aHi, from: 'a' });
    segments.push({ lo: oLo, hi: oHi, from: 'shared' });

    const MIN_WALL_LEN = 1;
    let usedA = false, usedB = false;
    segments.forEach((seg) => {
      const p1 = toPoint(seg.lo), p2 = toPoint(seg.hi);
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < MIN_WALL_LEN) return;
      let id: string | null = null;
      if (seg.from === 'b' && !usedB) { id = wallBId; usedB = true; }
      else if (seg.from === 'a' && !usedA) { id = wallAId; usedA = true; }
      else if (seg.from === 'shared') {
        if (!usedA) { id = wallAId; usedA = true; }
        else if (!usedB) { id = wallBId; usedB = true; }
      }
      if (id) {
        const w = findWall(id)!;
        w.x1 = p1.x; w.y1 = p1.y; w.x2 = p2.x; w.y2 = p2.y;
      } else {
        walls.push(Core.createWallEntity(p1.x, p1.y, p2.x, p2.y));
      }
    });

    if (!usedA) { const ia = walls.indexOf(a); if (ia >= 0) walls.splice(ia, 1); }
    if (!usedB) { const ib = walls.indexOf(b); if (ib >= 0) walls.splice(ib, 1); }
    emit({ type: 'WallsFused', wallAId, wallBId });
  },

  beginTransaction(): void { pushUndoSnapshot(); },

  // Rede de segurança geral: remove qualquer parede que tenha zerado de
  // comprimento (sujeira invisível que pode sobrar de qualquer operação
  // de corte/fusão).
  pruneDegenerateWalls(): number {
    const walls = currentWalls();
    const degenerateIdx: number[] = [];
    walls.forEach((w, i) => { if (Math.hypot(w.x2 - w.x1, w.y2 - w.y1) < 1) degenerateIdx.push(i); });
    if (!degenerateIdx.length) return 0;
    pushUndoSnapshot();
    for (let k = degenerateIdx.length - 1; k >= 0; k--) walls.splice(degenerateIdx[k]!, 1);
    emit({ type: 'DegenerateWallsPruned', count: degenerateIdx.length });
    return degenerateIdx.length;
  },

  resizeWallLength(wallId: string, newLengthMeters: number): void {
    const w = findWall(wallId); if (!w) return;
    const newLenPx = newLengthMeters * Core.GRID;
    if (!(newLenPx > 0)) return;
    const curLen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (curLen < 1e-6) return;
    const midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    const ux = (w.x2 - w.x1) / curLen, uy = (w.y2 - w.y1) / curLen;
    const half = newLenPx / 2;
    pushUndoSnapshot();
    w.x1 = Core.snap(midX - ux * half); w.y1 = Core.snap(midY - uy * half);
    w.x2 = Core.snap(midX + ux * half); w.y2 = Core.snap(midY + uy * half);
    emit({ type: 'WallResized', wallId, length: newLengthMeters });
  },

  rotateWall(wallId: string, angleRad: number): void {
    const w = findWall(wallId); if (!w) return;
    pushUndoSnapshot();
    const midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
    const rotatePt = (x: number, y: number) => {
      const dx = x - midX, dy = y - midY;
      return {
        x: midX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: midY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
      };
    };
    const p1 = rotatePt(w.x1, w.y1), p2 = rotatePt(w.x2, w.y2);
    w.x1 = Core.snap(p1.x); w.y1 = Core.snap(p1.y);
    w.x2 = Core.snap(p2.x); w.y2 = Core.snap(p2.y);
    emit({ type: 'WallRotated', wallId });
  },

  // Aplica um Produto do Catálogo a um elemento — ver comentário
  // histórico completo em legacy/index-monolito-original.html.
  setWallFinishFace(wallId: string, face: 'a' | 'b', productId: string): void {
    const w = findWall(wallId); if (!w) return;
    if (face !== 'a' && face !== 'b') return;
    pushUndoSnapshot();
    if (face === 'a') w.finishA = productId; else w.finishB = productId;
    emit({ type: 'WallFinishSet', wallId, face, productId });
  },
  setRoofFinish(roofId: string, productId: string): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.finishProductId = productId;
    emit({ type: 'RoofFinishSet', roofId, productId });
  },
  setRoomFinish(roomKey: string, productId: string): void {
    if (!roomKey) return;
    pushUndoSnapshot();
    const f = currentFloor();
    f.roomFinishes = f.roomFinishes || {};
    f.roomFinishes[roomKey] = productId;
    emit({ type: 'RoomFinishSet', roomKey, productId });
  },

  duplicateWall(wallId: string): Wall | null {
    const w = findWall(wallId); if (!w) return null;
    pushUndoSnapshot();
    const offset = Core.GRID;
    const copy = Core.createWallEntity(w.x1 + offset, w.y1 + offset, w.x2 + offset, w.y2 + offset);
    currentWalls().push(copy);
    emit({ type: 'WallCreated', floorIndex: project.currentFloorIndex, wallId: copy.id, duplicatedFrom: wallId });
    return copy;
  },

  deleteWall(wallId: string): void {
    const walls = currentWalls();
    let idx = -1;
    for (let i = 0; i < walls.length; i++) if (walls[i]!.id === wallId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    walls.splice(idx, 1);
    // Sem a parede, qualquer porta/janela que morava nela fica órfã —
    // remove junto, na mesma transação de undo.
    const openings = currentOpenings();
    for (let j = openings.length - 1; j >= 0; j--) {
      if (openings[j]!.wallId === wallId) openings.splice(j, 1);
    }
    emit({ type: 'WallDeleted', wallId });
  },

  // Exclui um cômodo inteiro — todas as paredes que fecham ele, numa
  // tacada só (um clique, um passo de undo).
  deleteRoomGroup(wallIds: string[]): void {
    if (!wallIds || !wallIds.length) return;
    const walls = currentWalls();
    const existing = wallIds.filter((id) => walls.some((w) => w.id === id));
    if (!existing.length) return;
    pushUndoSnapshot();
    const openings = currentOpenings();
    existing.forEach((id) => {
      let idx = -1;
      for (let i = 0; i < walls.length; i++) if (walls[i]!.id === id) { idx = i; break; }
      if (idx >= 0) walls.splice(idx, 1);
      for (let j = openings.length - 1; j >= 0; j--) {
        if (openings[j]!.wallId === id) openings.splice(j, 1);
      }
    });
    emit({ type: 'RoomDeleted', floorIndex: project.currentFloorIndex, wallIds: existing });
  },

  clearCurrentFloor(): void {
    pushUndoSnapshot();
    currentFloor().walls = [];
    currentFloor().columns = [];
    currentFloor().roofs = [];
    currentFloor().openings = [];
    currentFloor().varandas = [];
    emit({ type: 'FloorCleared', floorIndex: project.currentFloorIndex });
  },

  // Insere uma porta/janela genérica na parede clicada.
  insertOpening(wallId: string, kind: 'door' | 'window', px: number, py: number): Opening | null {
    const w = findWall(wallId); if (!w) return null;
    const width = kind === 'door' ? Core.DOOR_DEFAULT_WIDTH : Core.WINDOW_DEFAULT_WIDTH;
    const desired = Core.wallOffsetAtPoint(w, px, py);
    const offset = Core.findValidOpeningOffset(w, currentOpenings(), width, desired);
    if (offset == null) return null; // parede curta demais / sem espaço livre
    pushUndoSnapshot();
    const op = Core.createOpeningEntity(wallId, kind, offset);
    currentOpenings().push(op);
    emit({ type: 'OpeningCreated', floorIndex: project.currentFloorIndex, openingId: op.id });
    return op;
  },

  // Arraste ao vivo — desliza a abertura ao longo da MESMA parede.
  updateOpeningOffsetLive(openingId: string, desiredOffset: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const offset = Core.findValidOpeningOffset(w, currentOpenings(), op.width, desiredOffset, openingId);
    if (offset == null) return;
    op.offset = offset;
    emit({ type: 'OpeningMoved', openingId, live: true });
  },

  // Botões ←/→ do gizmo: passo fixo pequeno, com undo próprio.
  nudgeOpening(openingId: string, deltaMeters: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const offset = Core.findValidOpeningOffset(w, currentOpenings(), op.width, op.offset + deltaMeters, openingId);
    if (offset == null) return;
    pushUndoSnapshot();
    op.offset = offset;
    emit({ type: 'OpeningMoved', openingId });
  },

  deleteOpening(openingId: string): void {
    const openings = currentOpenings();
    let idx = -1;
    for (let i = 0; i < openings.length; i++) if (openings[i]!.id === openingId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    openings.splice(idx, 1);
    emit({ type: 'OpeningDeleted', openingId });
  },

  createColumn(x: number, y: number, shape?: ColumnShape): Column {
    pushUndoSnapshot();
    const col = Core.createColumnEntity(Core.snap(x), Core.snap(y), shape);
    currentColumns().push(col);
    emit({ type: 'ColumnCreated', floorIndex: project.currentFloorIndex, columnId: col.id });
    return col;
  },

  moveColumnBody(columnId: string, x: number, y: number): void {
    const c = findColumn(columnId); if (!c) return;
    pushUndoSnapshot();
    c.x = Core.snap(x); c.y = Core.snap(y);
    emit({ type: 'ColumnMoved', columnId });
  },
  updateColumnBodyLive(columnId: string, x: number, y: number): void {
    const c = findColumn(columnId); if (!c) return;
    c.x = x; c.y = y;
    emit({ type: 'ColumnMoved', columnId, live: true });
  },

  duplicateColumn(columnId: string): Column | null {
    const c = findColumn(columnId); if (!c) return null;
    pushUndoSnapshot();
    const copy = Core.createColumnEntity(c.x + Core.GRID, c.y + Core.GRID, c.shape);
    currentColumns().push(copy);
    emit({ type: 'ColumnCreated', floorIndex: project.currentFloorIndex, columnId: copy.id, duplicatedFrom: columnId });
    return copy;
  },

  deleteColumn(columnId: string): void {
    const columns = currentColumns();
    let idx = -1;
    for (let i = 0; i < columns.length; i++) if (columns[i]!.id === columnId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    columns.splice(idx, 1);
    emit({ type: 'ColumnDeleted', columnId });
  },

  setColumnShape(columnId: string, shape: ColumnShape): void {
    const c = findColumn(columnId); if (!c) return;
    if (['quadrada', 'redonda'].indexOf(shape) === -1) return;
    c.shape = shape;
    emit({ type: 'ColumnShapeChanged', columnId, value: shape });
  },

  // Telhado é um objeto de verdade — nasce de um clique (igual
  // parede/coluna). x1,y1,x2,y2 são os dois cantos do retângulo que cobre.
  createRoof(x1: number, y1: number, x2: number, y2: number, type?: RoofType): Roof | null {
    // sem Core.snap() aqui de propósito — ver comentário histórico completo.
    if (x1 === x2 || y1 === y2) return null;
    pushUndoSnapshot();
    const roof = Core.createRoofEntity(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), type);
    currentRoofs().push(roof);
    emit({ type: 'RoofCreated', floorIndex: project.currentFloorIndex, roofId: roof.id });
    return roof;
  },

  // Funde dois telhados que são literalmente a MESMA água continuando.
  fuseRoofs(roofAId: string, roofBId: string): Roof | null {
    const a = findRoof(roofAId), b = findRoof(roofBId);
    if (!a || !b) return null;
    const bounds = Core.fusedRoofBounds(a, b);
    a.x1 = bounds.x1; a.y1 = bounds.y1; a.x2 = bounds.x2; a.y2 = bounds.y2;
    const roofs = currentRoofs();
    let idx = -1;
    for (let i = 0; i < roofs.length; i++) if (roofs[i]!.id === b.id) { idx = i; break; }
    if (idx >= 0) roofs.splice(idx, 1);
    emit({ type: 'RoofsFused', floorIndex: project.currentFloorIndex, roofId: a.id, fusedFrom: b.id });
    return a;
  },

  duplicateRoof(roofId: string): Roof | null {
    const r = findRoof(roofId); if (!r) return null;
    pushUndoSnapshot();
    const offset = Core.GRID;
    const copy = Core.createRoofEntity(r.x1 + offset, r.y1 + offset, r.x2 + offset, r.y2 + offset, r.type, r.pitchDeg, r.ridgeAxis);
    currentRoofs().push(copy);
    emit({ type: 'RoofCreated', floorIndex: project.currentFloorIndex, roofId: copy.id, duplicatedFrom: roofId });
    return copy;
  },

  // Gira a direção da cumeeira manualmente — a única forma dela mudar
  // agora, nunca sozinha ao redimensionar.
  rotateRoofAxis(roofId: string): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.ridgeAxis = r.ridgeAxis === 'x' ? 'y' : 'x';
    emit({ type: 'RoofAxisChanged', roofId });
  },

  deleteRoof(roofId: string): void {
    const roofs = currentRoofs();
    let idx = -1;
    for (let i = 0; i < roofs.length; i++) if (roofs[i]!.id === roofId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    roofs.splice(idx, 1);
    emit({ type: 'RoofDeleted', roofId });
  },

  setRoofPieceType(roofId: string, type: RoofType): void {
    const r = findRoof(roofId); if (!r) return;
    if (['duasAguas', 'quatroAguas', 'umaAgua', 'platibanda'].indexOf(type) === -1) return;
    r.type = type;
    emit({ type: 'RoofTypeChanged', roofId, value: type });
  },

  // Alça da cumeeira: arrastar pra cima/baixo recalcula a inclinação.
  setRoofPitch(roofId: string, pitchDeg: number): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.pitchDeg = Math.max(5, Math.min(75, pitchDeg));
    emit({ type: 'RoofPitchChanged', roofId });
  },
  updateRoofPitchLive(roofId: string, pitchDeg: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.pitchDeg = Math.max(5, Math.min(75, pitchDeg));
    emit({ type: 'RoofPitchChanged', roofId, live: true });
  },

  // Alças das bordas: arrastar uma borda estica/encolhe só aquele lado.
  updateRoofBoundsLive(roofId: string, x1: number, y1: number, x2: number, y2: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.x1 = x1; r.y1 = y1; r.x2 = x2; r.y2 = y2;
    emit({ type: 'RoofBoundsChanged', roofId, live: true });
  },

  // Varanda: mesmo padrão do telhado — objeto independente, nasce de um
  // clique, x1..y2 são os dois cantos do piso.
  createVaranda(x1: number, y1: number, x2: number, y2: number, frontSide?: VarandaFrontSide): Varanda | null {
    if (x1 === x2 || y1 === y2) return null;
    pushUndoSnapshot();
    const v = Core.createVarandaEntity(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), frontSide);
    currentVarandas().push(v);
    emit({ type: 'VarandaCreated', floorIndex: project.currentFloorIndex, varandaId: v.id });
    return v;
  },

  updateVarandaBoundsLive(varandaId: string, x1: number, y1: number, x2: number, y2: number): void {
    const v = findVaranda(varandaId); if (!v) return;
    v.x1 = x1; v.y1 = y1; v.x2 = x2; v.y2 = y2;
    emit({ type: 'VarandaBoundsChanged', varandaId, live: true });
  },

  // Gira qual lado é a frente (onde ficam as colunas) em passos de 90°.
  rotateVarandaFront(varandaId: string): void {
    const v = findVaranda(varandaId); if (!v) return;
    pushUndoSnapshot();
    const order: VarandaFrontSide[] = ['minZ', 'maxX', 'maxZ', 'minX'];
    const idx = order.indexOf(v.frontSide);
    v.frontSide = order[(idx + 1) % order.length]!;
    emit({ type: 'VarandaFrontChanged', varandaId });
  },

  deleteVaranda(varandaId: string): void {
    const list = currentVarandas();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === varandaId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'VarandaDeleted', varandaId });
  },

  addFloor(): void {
    pushUndoSnapshot();
    const floorNumber = project.floors.length;
    const floor = Core.createFloorEntity(floorNumber + 'º Pavimento');
    project.floors.push(floor);
    project.currentFloorIndex = project.floors.length - 1;
    emit({ type: 'FloorAdded', floorId: floor.id });
  },

  setCurrentFloor(index: number): void {
    if (index < 0 || index >= project.floors.length) return;
    project.currentFloorIndex = index;
    emit({ type: 'CurrentFloorChanged', floorIndex: index });
  },

  setLayerVisible(name: keyof Project['layers'], value: boolean): void {
    if (!(name in project.layers)) return;
    project.layers[name] = value;
    emit({ type: 'LayerVisibilityChanged', name, value });
  },

  undo(): void {
    if (!undoStack.length) return;
    project = undoStack.pop()!;
    emit({ type: 'Undo' });
  },

  setFoundationType(type: FoundationType): void {
    if (['radier', 'baldrame'].indexOf(type) === -1) return;
    project.foundationType = type;
    emit({ type: 'FoundationTypeChanged', value: type });
  }
};

export function getProject(): Project { return project; }

// Namespace de compatibilidade — mesma razão do Core.ts (chamadas
// Store.xxx no código legado, enquanto ViewportController/Scene3DRenderer
// etc. ainda não foram migrados).
export const Store = {
  getProject,
  currentFloor,
  currentWalls,
  currentColumns,
  currentRoofs,
  currentOpenings,
  currentVarandas,
  findWall,
  findColumn,
  findRoof,
  findOpening,
  findVaranda,
  onChange,
  commands
};
