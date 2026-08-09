// Store — estado da aplicação (projeto atual), comandos que o alteram, e
// undo. Migrado de `var Store = (function () {...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 1606-2299). Lógica preservada linha a linha; só tipos adicionados e
// var/function trocados por const/arrow onde natural.

import { Core } from './Core.js';
import type {
  Project, Floor, Wall, Column, Roof, Opening, OpeningKind, Varanda, Laje, Furniture, ColumnShape, RoofType,
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
export function currentLajes(): Laje[] {
  const f = currentFloor();
  if (!f.lajes) f.lajes = [];
  return f.lajes;
}
export function lajesOfFloor(floor: Floor): Laje[] {
  if (!floor.lajes) floor.lajes = [];
  return floor.lajes;
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
export function findLaje(id: string): Laje | null {
  const lajes = currentLajes();
  for (let i = 0; i < lajes.length; i++) if (lajes[i]!.id === id) return lajes[i]!;
  return null;
}
export function currentFurniture(): Furniture[] {
  const f = currentFloor();
  if (!f.furniture) f.furniture = [];
  return f.furniture;
}
export function findFurniture(id: string): Furniture | null {
  const list = currentFurniture();
  for (let i = 0; i < list.length; i++) if (list[i]!.id === id) return list[i]!;
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
  updateWallEndpointLive(
    wallId: string, which: 1 | 2, x: number, y: number, linkedUpdates?: Omit<LinkedWallUpdate, 'x' | 'y'>[]
  ): void {
    const w = findWall(wallId); if (!w) return;
    const sx = Core.snap(x), sy = Core.snap(y);
    applyEndpoint(w, which, sx, sy);
    // Uma quina é um único nó topológico, embora ainda seja armazenada
    // como duas pontas de paredes diferentes. Mover todas as pontas
    // coincidentes antes de emitir o evento mantém o circuito fechado
    // durante todo o arraste; assim detectRooms nunca perde o cômodo e o
    // piso não desaparece por um frame (nem fica um rasgo permanente).
    (linkedUpdates || []).forEach((u) => {
      const linkedWall = findWall(u.id); if (!linkedWall) return;
      applyEndpoint(linkedWall, u.which, sx, sy);
    });
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

  // Remove apenas os IDs explicitamente classificados pelo diagnostico
  // como residuos criados no gesto atual. Nao cria outro passo de undo:
  // a limpeza pertence a mesma transacao iniciada pelo arraste.
  pruneDegenerateWallsLive(wallIds: string[]): string[] {
    const allowed = new Set(wallIds || []);
    if (!allowed.size) return [];
    const walls = currentWalls();
    const removed: string[] = [];
    for (let i = walls.length - 1; i >= 0; i--) {
      const wall = walls[i]!;
      if (!allowed.has(wall.id)) continue;
      if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= 1) continue;
      removed.push(wall.id);
      walls.splice(i, 1);
    }
    if (!removed.length) return removed;
    const openings = currentOpenings();
    for (let i = openings.length - 1; i >= 0; i--) {
      if (removed.includes(openings[i]!.wallId)) openings.splice(i, 1);
    }
    emit({ type: 'DegenerateWallsPruned', wallIds: removed, count: removed.length, live: true });
    return removed;
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
    const openings = currentOpenings();
    const a = findWall(wallAId), b = findWall(wallBId);
    if (!a || !b) return;
    // O offset da esquadria pertence ao sentido e ao ponto inicial da
    // parede. A fusao pode encurtar, inverter ou remover esse segmento;
    // portanto, preservamos primeiro a posicao absoluta de cada vao.
    const openingPositions = openings
      .filter((opening) => opening.wallId === wallAId || opening.wallId === wallBId)
      .map((opening) => {
        const owner = opening.wallId === wallAId ? a : b;
        const ownerDx = owner.x2 - owner.x1, ownerDy = owner.y2 - owner.y1;
        const ownerLen = Math.hypot(ownerDx, ownerDy) || 1e-6;
        const distance = opening.offset * Core.GRID;
        return {
          opening,
          x: owner.x1 + ownerDx / ownerLen * distance,
          y: owner.y1 + ownerDy / ownerLen * distance,
        };
      });
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
    const resultingWalls: Wall[] = [];
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
        resultingWalls.push(w);
      } else {
        const piece = Core.createWallEntity(p1.x, p1.y, p2.x, p2.y);
        walls.push(piece);
        resultingWalls.push(piece);
      }
    });

    if (!usedA) { const ia = walls.indexOf(a); if (ia >= 0) walls.splice(ia, 1); }
    if (!usedB) { const ib = walls.indexOf(b); if (ib >= 0) walls.splice(ib, 1); }

    openingPositions.forEach(({ opening, x, y }) => {
      const owner = resultingWalls.find((wall) => (
        Core.distToSegment(x, y, wall.x1, wall.y1, wall.x2, wall.y2) <= Core.COINCIDENCE_TOL
      ));
      if (!owner) return;
      opening.wallId = owner.id;
      opening.offset = Core.wallOffsetAtPoint(owner, x, y);
    });
    emit({ type: 'WallsFused', wallAId, wallBId });
  },

  // Materializa junções em T no modelo. detectRooms já sabia dividir a
  // parede passante apenas para calcular faces; isso não bastava para a
  // edição, porque selecionar/mover a parede continuava tratando-a como
  // um único segmento. Esta normalização cria os trechos reais, conserva
  // acabamentos e transfere portas/janelas para o trecho correspondente.
  splitWallsAtTJunctions(): string[] {
    const walls = currentWalls();
    const openings = currentOpenings();
    const splitIds: string[] = [];
    const plans = Core.findWallTJunctionSplits(walls);

    plans.forEach((plan) => {
      const original = findWall(plan.wallId);
      if (!original) return;
      const dx = original.x2 - original.x1;
      const dy = original.y2 - original.y1;
      const originalLength = Math.hypot(dx, dy);
      if (originalLength < 1e-6) return;

      const boundaries = [
        { x: original.x1, y: original.y1, t: 0 },
        ...plan.points,
        { x: original.x2, y: original.y2, t: 1 },
      ];
      const pieces: { wall: Wall; startT: number; endT: number }[] = [];

      for (let index = 0; index < boundaries.length - 1; index++) {
        const p1 = boundaries[index]!;
        const p2 = boundaries[index + 1]!;
        let piece: Wall;
        if (index === 0) {
          piece = original;
          piece.x1 = p1.x; piece.y1 = p1.y; piece.x2 = p2.x; piece.y2 = p2.y;
        } else {
          piece = Core.createWallEntity(p1.x, p1.y, p2.x, p2.y);
          if (original.finishA !== undefined) piece.finishA = original.finishA;
          if (original.finishB !== undefined) piece.finishB = original.finishB;
          walls.push(piece);
        }
        pieces.push({ wall: piece, startT: p1.t, endT: p2.t });
      }

      openings.filter((opening) => opening.wallId === plan.wallId).forEach((opening) => {
        const centerUnits = opening.offset * Core.GRID;
        const centerT = centerUnits / originalLength;
        const owner = pieces.find((piece, index) => (
          centerT >= piece.startT - 1e-6 &&
          (centerT < piece.endT - 1e-6 || index === pieces.length - 1)
        ));
        if (!owner) return;
        opening.wallId = owner.wall.id;
        opening.offset = (centerUnits - owner.startT * originalLength) / Core.GRID;
      });

      splitIds.push(plan.wallId);
    });

    if (splitIds.length) emit({ type: 'WallsSplitAtTJunctions', wallIds: splitIds });
    return splitIds;
  },

  beginTransaction(): void { pushUndoSnapshot(); },

  // Descarta integralmente a transacao em curso e remove do historico o
  // snapshot criado por beginTransaction. Usado pelo protetor topologico:
  // uma operacao recusada nao pode deixar alteracoes parciais nem consumir
  // um passo de Ctrl+Z.
  rollbackTransaction(): void {
    if (!undoStack.length) return;
    project = undoStack.pop()!;
    emit({ type: 'TransactionRolledBack' });
  },

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
  setRoofGableFinish(roofId: string, face: 'a' | 'b', productId: string): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    if (face === 'a') r.gableFinishA = productId; else r.gableFinishB = productId;
    emit({ type: 'RoofGableFinishSet', roofId, face, productId });
  },
  setRoomFinish(roomKey: string, productId: string, scale = 1, rotation = 0): void {
    if (!roomKey) return;
    pushUndoSnapshot();
    const f = currentFloor();
    f.roomFinishes = f.roomFinishes || {};
    f.roomFinishSettings = f.roomFinishSettings || {};
    f.roomFinishes[roomKey] = productId;
    f.roomFinishSettings[roomKey] = { scale, rotation };
    emit({ type: 'RoomFinishSet', roomKey, productId, scale, rotation });
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
  // tacada só (um clique, um passo de undo). Só é chamado enquanto o
  // cômodo ainda está ISOLADO (ver findIsolatedRoomWallIds/selectRoomGroup
  // no ViewportController) — depois que ele se funde com outro, essa
  // ação deixa de existir na UI e vira exclusão de parede avulsa, que
  // não deve tocar nos móveis.
  deleteRoomGroup(wallIds: string[]): void {
    if (!wallIds || !wallIds.length) return;
    const walls = currentWalls();
    const existing = wallIds.filter((id) => walls.some((w) => w.id === id));
    if (!existing.length) return;
    pushUndoSnapshot();

    // Móvel não tem roomId — pertence ao cômodo por posição, igual ao
    // arraste rígido (ver dragElementStart.furnitureSnapshots no
    // ViewportController). Calcula a mesma caixa delimitadora ANTES de
    // apagar as paredes, senão perde a referência de onde o cômodo
    // estava, e apaga os móveis dentro dela junto — sem isso eles
    // ficavam órfãos, soltos no vazio.
    let roomMinX = Infinity, roomMaxX = -Infinity, roomMinY = Infinity, roomMaxY = -Infinity;
    const growBounds = (px: number, py: number) => {
      if (px < roomMinX) roomMinX = px; if (px > roomMaxX) roomMaxX = px;
      if (py < roomMinY) roomMinY = py; if (py > roomMaxY) roomMaxY = py;
    };
    existing.forEach((id) => {
      const w = walls.find((w2) => w2.id === id)!;
      growBounds(w.x1, w.y1);
      growBounds(w.x2, w.y2);
    });
    const furniture = currentFurniture();
    const deletedFurnitureIds: string[] = [];
    for (let k = furniture.length - 1; k >= 0; k--) {
      const f = furniture[k]!;
      if (f.x >= roomMinX && f.x <= roomMaxX && f.y >= roomMinY && f.y <= roomMaxY) {
        deletedFurnitureIds.push(f.id);
        furniture.splice(k, 1);
      }
    }

    const openings = currentOpenings();
    existing.forEach((id) => {
      let idx = -1;
      for (let i = 0; i < walls.length; i++) if (walls[i]!.id === id) { idx = i; break; }
      if (idx >= 0) walls.splice(idx, 1);
      for (let j = openings.length - 1; j >= 0; j--) {
        if (openings[j]!.wallId === id) openings.splice(j, 1);
      }
    });
    emit({ type: 'RoomDeleted', floorIndex: project.currentFloorIndex, wallIds: existing, furnitureIds: deletedFurnitureIds });
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
  insertOpening(wallId: string, kind: OpeningKind, px: number, py: number): Opening | null {
    const w = findWall(wallId); if (!w) return null;
    const width = kind === 'door' ? Core.DOOR_DEFAULT_WIDTH : kind === 'arco' ? Core.ARCO_DEFAULT_WIDTH : Core.WINDOW_DEFAULT_WIDTH;
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

  // Arraste ao vivo — redimensiona a LARGURA puxando uma borda (a outra
  // fica fixa). Um único passo de undo cobre o gesto inteiro (ver
  // beginTransaction, chamado no início do arraste pelo ViewportController).
  resizeOpeningEdgeLive(openingId: string, edge: 'left' | 'right', desiredOffset: number): void {
    const op = findOpening(openingId); if (!op) return;
    const w = findWall(op.wallId); if (!w) return;
    const result = Core.resolveOpeningEdgeResize(w, currentOpenings(), openingId, edge, desiredOffset);
    if (!result) return;
    op.offset = result.offset;
    op.width = result.width;
    emit({ type: 'OpeningResized', openingId, live: true });
  },

  // Arraste ao vivo — redimensiona a ALTURA puxando o topo (o peitoril,
  // base do vão, fica fixo).
  resizeOpeningHeightLive(openingId: string, desiredTop: number): void {
    const op = findOpening(openingId); if (!op) return;
    op.height = Core.resolveOpeningHeightResize(op, desiredTop);
    emit({ type: 'OpeningResized', openingId, live: true });
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
    const copy = Core.createRoofEntity(r.x1 + offset, r.y1 + offset, r.x2 + offset, r.y2 + offset, r.type, r.pitchDeg, r.ridgeAxis, undefined, r.parapetHeight);
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

  // Alça de altura do parapeito da platibanda — mesmo padrão da cumeeira
  // (setRoofPitch/updateRoofPitchLive): arrastar pra cima/baixo
  // recalcula a altura, clampada num intervalo razoável de parapeito
  // (20cm a 1,2m).
  setRoofParapetHeight(roofId: string, height: number): void {
    const r = findRoof(roofId); if (!r) return;
    pushUndoSnapshot();
    r.parapetHeight = Math.max(0.2, Math.min(1.2, height));
    emit({ type: 'RoofParapetHeightChanged', roofId });
  },
  updateRoofParapetHeightLive(roofId: string, height: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.parapetHeight = Math.max(0.2, Math.min(1.2, height));
    emit({ type: 'RoofParapetHeightChanged', roofId, live: true });
  },

  // Alças das bordas: arrastar uma borda estica/encolhe só aquele lado.
  updateRoofBoundsLive(roofId: string, x1: number, y1: number, x2: number, y2: number): void {
    const r = findRoof(roofId); if (!r) return;
    r.x1 = x1; r.y1 = y1; r.x2 = x2; r.y2 = y2;
    emit({ type: 'RoofBoundsChanged', roofId, live: true });
  },
  updateRoofsGroupBodyLive(snapshots: { id: string; x1: number; y1: number; x2: number; y2: number }[], dx: number, dy: number): void {
    snapshots.forEach((snapshot) => {
      const roof = findRoof(snapshot.id); if (!roof) return;
      roof.x1 = snapshot.x1 + dx; roof.y1 = snapshot.y1 + dy;
      roof.x2 = snapshot.x2 + dx; roof.y2 = snapshot.y2 + dy;
    });
    emit({ type: 'RoofGroupDragged', roofIds: snapshots.map((snapshot) => snapshot.id), live: true });
  },

  commitRoofCompound(roofIds: string[]): string | null {
    const roofs = roofIds.map((id) => findRoof(id)).filter((roof): roof is Roof => !!roof);
    if (roofs.length < 2) return null;
    pushUndoSnapshot();
    const groupId = Core.nextId('roof-group');
    roofs.forEach((roof) => { roof.compoundGroupId = groupId; });
    emit({ type: 'RoofCompoundCommitted', roofIds: roofs.map((roof) => roof.id), groupId });
    return groupId;
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

  // Laje: mesmo padrão de telhado/varanda — objeto independente, nasce
  // de um clique, redimensiona por ARESTA (não mais um retângulo de 4
  // lados fixos — depois de fundir, o contorno pode ter mais de 4
  // pontos, ex.: um "L") SEM travar em nenhum contorno de parede (pode
  // encolher pra virar um vão aberto, ou crescer além da parede pra
  // virar balanço/sacada — ver DEC-35/37).
  createLaje(points: { x: number; y: number }[]): Laje | null {
    if (!points || points.length < 4) return null;
    pushUndoSnapshot();
    const l = Core.createLajeEntity(points);
    currentLajes().push(l);
    emit({ type: 'LajeCreated', floorIndex: project.currentFloorIndex, lajeId: l.id });
    return l;
  },

  // Arrasta UMA aresta do contorno (o segmento entre points[edgeIndex]
  // e o próximo, sempre horizontal ou vertical) — atualiza os dois
  // pontos que a formam, mantendo o resto do contorno intacto. Esse é
  // o jeito de reshapear a laje aresta por aresta, cada uma
  // independente das outras.
  updateLajeEdgeLive(lajeId: string, edgeIndex: number, newValue: number): void {
    const l = findLaje(lajeId); if (!l) return;
    const n = l.points.length;
    if (edgeIndex < 0 || edgeIndex >= n) return;
    const p1 = l.points[edgeIndex]!, p2 = l.points[(edgeIndex + 1) % n]!;
    if (Math.abs(p1.x - p2.x) < 1e-6) { p1.x = newValue; p2.x = newValue; }
    else { p1.y = newValue; p2.y = newValue; }
    emit({ type: 'LajeBoundsChanged', lajeId, live: true });
  },

  // Move a laje INTEIRA (o "bloco" todo, sem mudar o formato) —
  // substitui o contorno pelos mesmos pontos deslocados. Usado pelo
  // arraste do corpo (clique fora das alças de aresta), com o ímã de
  // encaixe calculado no ViewportController (ver DEC-37 — decisão
  // revista: sem fusão automática, só um snap pra ficar colada na
  // vizinha sem sobrepor).
  updateLajePointsLive(lajeId: string, points: { x: number; y: number }[]): void {
    const l = findLaje(lajeId); if (!l) return;
    l.points = points;
    emit({ type: 'LajeBoundsChanged', lajeId, live: true });
  },

  deleteLaje(lajeId: string): void {
    const list = currentLajes();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === lajeId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'LajeDeleted', lajeId });
  },

  // Móvel: mesmo padrão de Coluna — um único ponto (x,y), arrastável
  // livremente, mais rotação em passos de 90°. productId aponta pro
  // Catalog (categoria 'furniture'), que resolve qual .glb carregar.
  createFurniture(x: number, y: number, productId: string, rotationDeg?: number, elevationM?: number): Furniture {
    pushUndoSnapshot();
    const item = Core.createFurnitureEntity(x, y, productId, rotationDeg, undefined, elevationM);
    currentFurniture().push(item);
    emit({ type: 'FurnitureCreated', floorIndex: project.currentFloorIndex, furnitureId: item.id });
    return item;
  },

  // Criação silenciosa (sem snapshot de undo próprio) — usada só pelo
  // preenchimento automático ao nascer um cômodo, que já empilha UM
  // snapshot pra criação do cômodo inteiro (paredes + móveis juntos
  // desfazem como uma unidade só, não passo a passo).
  createFurnitureSilent(x: number, y: number, productId: string, rotationDeg?: number, elevationM?: number): Furniture {
    const item = Core.createFurnitureEntity(x, y, productId, rotationDeg, undefined, elevationM);
    currentFurniture().push(item);
    emit({ type: 'FurnitureCreated', floorIndex: project.currentFloorIndex, furnitureId: item.id });
    return item;
  },

  moveFurnitureBody(furnitureId: string, x: number, y: number): void {
    const item = findFurniture(furnitureId); if (!item) return;
    pushUndoSnapshot();
    // Sem Core.snap aqui de propósito: móvel se posiciona livre (não
    // preso ao grid de 50cm), só travado contra parede — ver
    // ViewportController.resolveFurniturePosition, que já resolve isso
    // ANTES de chamar updateFurnitureBodyLive durante o arrasto.
    item.x = x; item.y = y;
    emit({ type: 'FurnitureMoved', furnitureId });
  },
  updateFurnitureBodyLive(furnitureId: string, x: number, y: number): void {
    const item = findFurniture(furnitureId); if (!item) return;
    item.x = x; item.y = y;
    emit({ type: 'FurnitureMoved', furnitureId, live: true });
  },

  rotateFurniture(furnitureId: string, stepDeg?: number): void {
    const item = findFurniture(furnitureId); if (!item) return;
    pushUndoSnapshot();
    const step = stepDeg || 90;
    item.rotationDeg = (item.rotationDeg + step + 360) % 360;
    emit({ type: 'FurnitureRotated', furnitureId });
  },

  duplicateFurniture(furnitureId: string): Furniture | null {
    const item = findFurniture(furnitureId); if (!item) return null;
    pushUndoSnapshot();
    const copy = Core.createFurnitureEntity(item.x + Core.GRID, item.y + Core.GRID, item.productId, item.rotationDeg);
    currentFurniture().push(copy);
    emit({ type: 'FurnitureCreated', floorIndex: project.currentFloorIndex, furnitureId: copy.id, duplicatedFrom: furnitureId });
    return copy;
  },

  deleteFurniture(furnitureId: string): void {
    const list = currentFurniture();
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.id === furnitureId) { idx = i; break; }
    if (idx < 0) return;
    pushUndoSnapshot();
    list.splice(idx, 1);
    emit({ type: 'FurnitureDeleted', furnitureId });
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

// Substitui o projeto inteiro em memória — usado só ao carregar um
// link compartilhado (ver EsboceApplication.start()). Diferente dos
// comandos normais, não empilha undo (carregar não é uma edição que
// alguém vá querer desfazer) — é o ponto de partida de uma sessão
// nova, análogo a createProject().
export function setProject(next: Project): void {
  project = next;
  emit({ type: 'ProjectLoaded' });
}

// Namespace de compatibilidade — mesma razão do Core.ts (chamadas
// Store.xxx no código legado, enquanto ViewportController/Scene3DRenderer
// etc. ainda não foram migrados).
export const Store = {
  getProject,
  setProject,
  currentFloor,
  currentWalls,
  currentColumns,
  currentRoofs,
  currentOpenings,
  currentVarandas,
  currentLajes,
  currentFurniture,
  findWall,
  findColumn,
  findRoof,
  findOpening,
  findVaranda,
  findLaje,
  findFurniture,
  onChange,
  commands
};