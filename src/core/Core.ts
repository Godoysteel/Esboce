// Core — geometria pura, snap e detecção de cômodos. Sem dependência de
// DOM ou Three.js: só matemática e criação/leitura de entidades.
//
// Migrado de `var Core = (function () {...})()` no index.html monolítico
// original (ver legacy/index-monolito-original.html). Lógica preservada
// linha a linha; só foram adicionados tipos e trocado var/function por
// const/arrow onde natural. Qualquer comentário explicando "por que" do
// código original foi mantido.

import type {
  Point, Wall, Column, ColumnShape, Roof, RoofType, RidgeAxis,
  Varanda, VarandaFrontSide, Opening, OpeningKind, Floor, Project,
  Room, WallFootprint, WallOBB, MTV, Interval, Furniture
} from './types.js';

export const GRID = 20; // unidade de grade do modelo (1 unidade = 1 metro)
// O snap bate na mesma malha que a grade PRINCIPAL desenhada no chão
// (0,5 m por célula) — senão a "seta" de posição cai no meio de um
// quadrado em vez de pular exatamente de cruzamento em cruzamento.
export const SNAP_UNIT = GRID / 2;
export const WALL_THICK = 0.12; // espessura da parede em metros
// Distância abaixo da qual dois pontos contam como "o mesmo lugar" —
// usada em TODO lugar do código que precisa decidir se duas pontas de
// parede se tocam (junção em T, detecção de cômodo, fusão, corner-
// following do redimensionar). Uma constante só, referenciada em todo
// canto, pra essa categoria de bug não conseguir mais acontecer.
export const COINCIDENCE_TOL = 3;
// Coluna modular (pilar): elemento pontual independente da parede.
export const COLUMN_SIZE = GRID * 0.3;

// Esquadrias (portas/janelas) — dimensões padrão residenciais comuns no Brasil.
export const DOOR_DEFAULT_WIDTH = 0.8;
export const DOOR_DEFAULT_HEIGHT = 2.1;
export const WINDOW_DEFAULT_WIDTH = 1.2;
export const WINDOW_DEFAULT_HEIGHT = 1.2;
export const WINDOW_DEFAULT_SILL = 1.0;
export const OPENING_MARGIN = 0.25;
// Distancia livre minima entre as bordas de duas esquadrias na mesma parede.
export const OPENING_GAP = 0.15;
// Afastamento minimo entre a borda de uma esquadria e uma parede
// transversal que esteja sendo empurrada em direcao a ela.
export const OPENING_WALL_CLEARANCE = 0.05;

export function snap(v: number): number {
  return Math.round(v / SNAP_UNIT) * SNAP_UNIT;
}

let _idSeq = 0;
export function nextId(prefix: string): string {
  return prefix + '_' + (_idSeq++);
}

export function createWallEntity(x1: number, y1: number, x2: number, y2: number, id?: string): Wall {
  return { id: id || nextId('wall'), x1, y1, x2, y2 };
}

export function createColumnEntity(x: number, y: number, shape?: ColumnShape, id?: string): Column {
  return { id: id || nextId('column'), x, y, shape: shape || 'quadrada' };
}

export function createRoofEntity(
  x1: number, y1: number, x2: number, y2: number,
  type?: RoofType, pitchDeg?: number, ridgeAxis?: RidgeAxis, id?: string
): Roof {
  return {
    id: id || nextId('roof'), x1, y1, x2, y2,
    type: type || 'duasAguas',
    pitchDeg: pitchDeg != null ? pitchDeg : 28,
    ridgeAxis: ridgeAxis || 'x'
  };
}

export function createVarandaEntity(
  x1: number, y1: number, x2: number, y2: number, frontSide?: VarandaFrontSide, id?: string
): Varanda {
  return { id: id || nextId('varanda'), x1, y1, x2, y2, frontSide: frontSide || 'minZ' };
}

export function createFloorEntity(name: string): Floor {
  return { id: nextId('floor'), name, walls: [], columns: [], roofs: [], openings: [], varandas: [], furniture: [], roomFinishes: {}, roomFinishSettings: {} };
}

// x,y: posição do "pé" do móvel no plano do pavimento. rotationDeg: passos
// de 90° (mesmo espírito do frontSide da varanda).
export function createFurnitureEntity(x: number, y: number, productId: string, rotationDeg?: number, id?: string, elevationM?: number): Furniture {
  return { id: id || nextId('furniture'), productId, x, y, rotationDeg: rotationDeg || 0, elevationM: elevationM || 0 };
}

// offset: distância em metros do x1,y1 da parede até o CENTRO da
// abertura, medida ao longo do eixo dela.
export function createOpeningEntity(wallId: string, kind: OpeningKind, offset: number, id?: string): Opening {
  const isDoor = kind === 'door';
  return {
    id: id || nextId('opening'),
    kind: isDoor ? 'door' : 'window',
    wallId,
    offset,
    width: isDoor ? DOOR_DEFAULT_WIDTH : WINDOW_DEFAULT_WIDTH,
    height: isDoor ? DOOR_DEFAULT_HEIGHT : WINDOW_DEFAULT_HEIGHT,
    sillHeight: isDoor ? 0 : WINDOW_DEFAULT_SILL
  };
}

export function wallLengthMeters(w: Wall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / GRID;
}

// ---- Telhado — snap assistido entre telhados vizinhos ----
// Altura da cumeeira acima do topo da parede, em metros. Só existe pra
// duasAguas/quatroAguas.
export function roofRidgeHeightMeters(roof: Roof): number | null {
  if (!roof || (roof.type !== 'duasAguas' && roof.type !== 'quatroAguas')) return null;
  const widthM = Math.abs(roof.x2 - roof.x1) / GRID;
  const depthM = Math.abs(roof.y2 - roof.y1) / GRID;
  const perpM = roof.ridgeAxis === 'x' ? depthM : widthM;
  const halfWidthM = perpM / 2;
  if (halfWidthM < 1e-6) return null;
  return halfWidthM * Math.tan(roof.pitchDeg * Math.PI / 180);
}

// Inclinação (graus) que faz ESTE telhado atingir a altura de cumeeira
// alvo, dado o próprio halfWidth dele.
export function roofPitchForRidgeHeight(roof: Roof, targetHeightM: number): number {
  const widthM = Math.abs(roof.x2 - roof.x1) / GRID;
  const depthM = Math.abs(roof.y2 - roof.y1) / GRID;
  const perpM = roof.ridgeAxis === 'x' ? depthM : widthM;
  const halfWidthM = perpM / 2;
  if (halfWidthM < 1e-6) return roof.pitchDeg;
  const deg = Math.atan(targetHeightM / halfWidthM) * 180 / Math.PI;
  return Math.max(5, Math.min(75, deg));
}

// Dois telhados podem se FUNDIR só quando são literalmente a MESMA água
// continuando (mesmo tipo, mesma inclinação, mesmo eixo de cumeeira, e a
// extensão perpendicular ao eixo da cumeeira batendo quase exata).
export function roofsCanFuse(a: Roof, b: Roof, toleranceUnits: number): boolean {
  if (!a || !b || a.id === b.id) return false;
  if (a.type !== b.type) return false;
  if (a.type !== 'duasAguas' && a.type !== 'quatroAguas') return false;
  if (a.ridgeAxis !== b.ridgeAxis) return false;
  if (Math.abs(a.pitchDeg - b.pitchDeg) > 0.5) return false;
  if (a.ridgeAxis === 'x') {
    if (Math.abs(a.y1 - b.y1) > toleranceUnits || Math.abs(a.y2 - b.y2) > toleranceUnits) return false;
    const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
    return overlapX > -toleranceUnits;
  }
  if (Math.abs(a.x1 - b.x1) > toleranceUnits || Math.abs(a.x2 - b.x2) > toleranceUnits) return false;
  const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return overlapY > -toleranceUnits;
}

export function fusedRoofBounds(a: Roof, b: Roof): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2)
  };
}

interface RectLike { x1: number; y1: number; x2: number; y2: number; }

// "perto" o bastante pra valer a pena tentar alinhar? Sobrepostos ou com
// uma folga pequena nos dois eixos.
export function rectsNearby(a: RectLike, b: RectLike, toleranceUnits: number): boolean {
  const aMinX = Math.min(a.x1, a.x2), aMaxX = Math.max(a.x1, a.x2);
  const aMinY = Math.min(a.y1, a.y2), aMaxY = Math.max(a.y1, a.y2);
  const bMinX = Math.min(b.x1, b.x2), bMaxX = Math.max(b.x1, b.x2);
  const bMinY = Math.min(b.y1, b.y2), bMaxY = Math.max(b.y1, b.y2);
  const overlapX = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX);
  const overlapY = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY);
  return overlapX > -toleranceUnits && overlapY > -toleranceUnits;
}

// Projeta um ponto (ex.: clique do mouse) na RETA da parede, devolvendo a
// distância em metros a partir de x1,y1 — pode vir negativa ou maior que
// o comprimento da parede se o ponto ficar fora do segmento.
export function wallOffsetAtPoint(w: Wall, px: number, py: number): number {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  const t = (px - w.x1) * ux + (py - w.y1) * uy;
  return t / GRID;
}

// Acha a posição (offset em metros) mais próxima de "desired" que:
// (a) mantém a MARGEM mínima até as duas pontas da parede;
// (b) não invade nenhuma outra abertura já existente na mesma parede.
// Devolve null se não existir espaço livre grande o bastante.
export function findValidOpeningOffset(
  w: Wall, openings: Opening[] | null | undefined, width: number, desired: number, excludeId?: string
): number | null {
  const lenM = wallLengthMeters(w);
  const half = width / 2;
  const lo = OPENING_MARGIN + half, hi = lenM - OPENING_MARGIN - half;
  if (lo > hi) return null;
  desired = Math.max(lo, Math.min(hi, desired));

  const blockers: [number, number][] = [];
  (openings || []).forEach((o) => {
    if (o.wallId !== w.id || o.id === excludeId) return;
    blockers.push([o.offset - o.width / 2 - OPENING_GAP, o.offset + o.width / 2 + OPENING_GAP]);
  });
  blockers.sort((a, b) => a[0] - b[0]);

  let free: [number, number][] = [];
  let cursor = lo;
  blockers.forEach((b) => {
    if (b[0] > cursor) free.push([cursor, Math.min(b[0], hi)]);
    cursor = Math.max(cursor, b[1]);
  });
  if (cursor < hi) free.push([cursor, hi]);
  free = free.filter((iv) => iv[1] - iv[0] > -1e-6);
  if (!free.length) return null;

  let chosen: [number, number] | null = null;
  free.forEach((iv) => { if (desired >= iv[0] - 1e-6 && desired <= iv[1] + 1e-6) chosen = iv; });
  if (!chosen) {
    let bestDist = Infinity;
    free.forEach((iv) => {
      const d = desired < iv[0] ? iv[0] - desired : desired - iv[1];
      if (d < bestDist) { bestDist = d; chosen = iv; }
    });
  }
  const finalChosen = chosen as [number, number] | null;
  if (!finalChosen) return null;
  return Math.max(finalChosen[0], Math.min(finalChosen[1], desired));
}

export function createProject(): Project {
  return {
    floors: [createFloorEntity('Térreo')],
    currentFloorIndex: 0,
    layers: {
      fundacao: true,
      calcada: false,
      marquise: false,
      telhado: true,
      paredesTerreo: true,
      colunas: true,
      laje: true,
      paredesSuperiores: true,
      aberturas: true,
      varanda: true
    },
    foundationType: 'baldrame'
  };
}

// ---- Geometria pura (hit-test) ----
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const lenSq = C * C + D * D;
  let t = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
  t = Math.max(0, Math.min(1, t));
  const xx = x1 + t * C, yy = y1 + t * D;
  return Math.hypot(px - xx, py - yy);
}

// Ponto exato em cima do CORPO de uma parede (não só nas pontas).
export function projectOnSegment(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number
): (Point & { dist: number }) | null {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return null;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const x = x1 + t * dx, y = y1 + t * dy;
  return { x, y, dist: Math.hypot(px - x, py - y) };
}

// Divide uma parede "passante" no ponto onde a ponta de OUTRA parede
// encosta no meio dela (junção em T) — sem isso, o grafo de detecção de
// cômodos não tem um nó ali. Só uma etapa de PREPARAÇÃO do grafo; nunca
// altera as paredes de verdade guardadas no modelo.
function splitWallsAtTJunctions(wallList: Wall[]): RectLike[] {
  const TOL = COINCIDENCE_TOL;
  const endpoints: Point[] = [];
  wallList.forEach((w) => {
    endpoints.push({ x: w.x1, y: w.y1 });
    endpoints.push({ x: w.x2, y: w.y2 });
  });

  const result: RectLike[] = [];
  wallList.forEach((w) => {
    const ts: number[] = [];
    endpoints.forEach((p) => {
      const res = projectOnSegment(p.x, p.y, w.x1, w.y1, w.x2, w.y2);
      if (!res) return;
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const lenSq = dx * dx + dy * dy;
      const t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / lenSq;
      if (res.dist <= TOL && t > 0.02 && t < 0.98) ts.push(t);
    });
    if (!ts.length) { result.push(w); return; }

    const uniqueTs: number[] = [];
    ts.sort((a, b) => a - b);
    ts.forEach((t) => {
      const last = uniqueTs[uniqueTs.length - 1];
      if (!uniqueTs.length || last === undefined || t - last > 0.02) uniqueTs.push(t);
    });

    let prevT = 0;
    uniqueTs.forEach((t) => {
      result.push({
        x1: w.x1 + (w.x2 - w.x1) * prevT, y1: w.y1 + (w.y2 - w.y1) * prevT,
        x2: w.x1 + (w.x2 - w.x1) * t, y2: w.y1 + (w.y2 - w.y1) * t
      });
      prevT = t;
    });
    result.push({
      x1: w.x1 + (w.x2 - w.x1) * prevT, y1: w.y1 + (w.y2 - w.y1) * prevT,
      x2: w.x2, y2: w.y2
    });
  });
  return result;
}

export interface WallTJunctionSplit {
  wallId: string;
  points: (Point & { t: number })[];
}

// Localiza as divisões que precisam existir de verdade no modelo. A
// versão usada por detectRooms acima é deliberadamente virtual, mas a
// edição exige uma topologia persistente: quando a ponta de uma parede
// perpendicular termina no corpo de outra, a parede passante deve virar
// dois trechos que compartilham aquele mesmo nó.
export function findWallTJunctionSplits(wallList: Wall[]): WallTJunctionSplit[] {
  const result: WallTJunctionSplit[] = [];

  wallList.forEach((support) => {
    const sdx = support.x2 - support.x1;
    const sdy = support.y2 - support.y1;
    const supportLenSq = sdx * sdx + sdy * sdy;
    const supportLen = Math.sqrt(supportLenSq);
    if (supportLen < 1e-6) return;

    const points: (Point & { t: number })[] = [];
    wallList.forEach((branch) => {
      if (branch.id === support.id) return;
      const bdx = branch.x2 - branch.x1;
      const bdy = branch.y2 - branch.y1;
      const branchLen = Math.hypot(bdx, bdy);
      if (branchLen < 1e-6) return;

      // Segmentos colineares são tratados pela fusão. Aqui interessam
      // apenas encontros com mudança real de direção (L ou T).
      const cross = Math.abs((sdx / supportLen) * (bdy / branchLen) - (sdy / supportLen) * (bdx / branchLen));
      if (cross < 0.05) return;

      [{ x: branch.x1, y: branch.y1 }, { x: branch.x2, y: branch.y2 }].forEach((endpoint) => {
        const projected = projectOnSegment(
          endpoint.x, endpoint.y,
          support.x1, support.y1, support.x2, support.y2,
        );
        if (!projected || projected.dist > COINCIDENCE_TOL) return;
        const t = ((projected.x - support.x1) * sdx + (projected.y - support.y1) * sdy) / supportLenSq;
        const endpointMargin = COINCIDENCE_TOL / supportLen;
        if (t <= endpointMargin || t >= 1 - endpointMargin) return;
        if (points.some((point) => Math.abs(point.t - t) * supportLen <= COINCIDENCE_TOL)) return;
        points.push({ x: projected.x, y: projected.y, t });
      });
    });

    if (points.length) {
      points.sort((a, b) => a.t - b.t);
      result.push({ wallId: support.id, points });
    }
  });

  return result;
}

interface GraphNode extends Point { id: string; }
interface HalfEdge {
  id: string;
  from: GraphNode;
  to: GraphNode;
  visited: boolean;
  twin?: HalfEdge;
}

// ---- Detecção automática de cômodos (grafo planar + face traversal) ----
export function detectRooms(wallList: Wall[]): Room[] {
  if (!wallList || wallList.length < 3) return [];
  const splitWalls = splitWallsAtTJunctions(wallList);
  // Tolerância de "mesmo ponto" pro grafo — mesma constante usada em todo
  // canto do código (fusão, junção em T etc.).
  const SNAP = COINCIDENCE_TOL;

  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleOf = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x);
  const signedArea = (pts: Point[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i]!, p2 = pts[(i + 1) % pts.length]!;
      s += p1.x * p2.y - p2.x * p1.y;
    }
    return s / 2;
  };

  const nodes: GraphNode[] = [];
  function findOrCreateNode(p: Point): GraphNode {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      if (dist(n, p) <= SNAP) return n;
    }
    const n: GraphNode = { id: 'n' + nodes.length, x: p.x, y: p.y };
    nodes.push(n);
    return n;
  }

  const resolved = splitWalls.map((w, idx) => ({
    id: 'w' + idx,
    startNode: findOrCreateNode({ x: w.x1, y: w.y1 }),
    endNode: findOrCreateNode({ x: w.x2, y: w.y2 })
  }));

  const halfEdges: HalfEdge[] = [];
  resolved.forEach((w) => {
    const he1: HalfEdge = { id: w.id + '_f', from: w.startNode, to: w.endNode, visited: false };
    const he2: HalfEdge = { id: w.id + '_b', from: w.endNode, to: w.startNode, visited: false };
    he1.twin = he2; he2.twin = he1;
    halfEdges.push(he1, he2);
  });

  const outgoing: Record<string, HalfEdge[]> = {};
  nodes.forEach((n) => { outgoing[n.id] = []; });
  halfEdges.forEach((he) => { outgoing[he.from.id]!.push(he); });
  Object.keys(outgoing).forEach((k) => {
    outgoing[k]!.sort((a, b) => angleOf(a.from, a.to) - angleOf(b.from, b.to));
  });

  function nextHalfEdge(incoming: HalfEdge): HalfEdge {
    const candidates = outgoing[incoming.to.id]!;
    const reverseAngle = angleOf(incoming.to, incoming.from);
    let bestIndex = 0, bestDiff = Infinity;
    candidates.forEach((cand, i) => {
      const candAngle = angleOf(cand.from, cand.to);
      let diff = reverseAngle - candAngle;
      while (diff <= 0) diff += Math.PI * 2;
      if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
    });
    return candidates[bestIndex]!;
  }

  const faces: HalfEdge[][] = [];
  halfEdges.forEach((start) => {
    if (start.visited) return;
    const faceEdges: HalfEdge[] = [];
    let current: HalfEdge | undefined = start;
    let guard = 0;
    do {
      current.visited = true;
      faceEdges.push(current);
      current = nextHalfEdge(current);
      guard++;
    } while (current && current !== start && guard < 10000);
    if (current === start && faceEdges.length >= 3) faces.push(faceEdges);
  });

  const adjacency: Record<string, string[]> = {};
  nodes.forEach((n) => { adjacency[n.id] = []; });
  halfEdges.forEach((he) => {
    adjacency[he.from.id]!.push(he.to.id);
    adjacency[he.to.id]!.push(he.from.id);
  });
  const nodeComponent: Record<string, number> = {};
  let compCount = 0;
  nodes.forEach((n) => {
    if (nodeComponent[n.id] !== undefined) return;
    const stack = [n.id];
    nodeComponent[n.id] = compCount;
    while (stack.length) {
      const cur = stack.pop()!;
      adjacency[cur]!.forEach((nb) => {
        if (nodeComponent[nb] === undefined) {
          nodeComponent[nb] = compCount;
          stack.push(nb);
        }
      });
    }
    compCount++;
  });

  const facesByComponent: Record<number, HalfEdge[][]> = {};
  faces.forEach((faceEdges) => {
    const compId = nodeComponent[faceEdges[0]!.from.id]!;
    if (!facesByComponent[compId]) facesByComponent[compId] = [];
    facesByComponent[compId]!.push(faceEdges);
  });

  const rooms: Room[] = [];
  Object.keys(facesByComponent).forEach((compIdKey) => {
    const compId = Number(compIdKey);
    facesByComponent[compId]!
      .map((faceEdges) => {
        const points = faceEdges.map((he) => ({ x: he.from.x, y: he.from.y }));
        // Uma aresta pendurada faz o percurso da face passar duas vezes
        // pelo mesmo nó (vai até a ponta aberta e volta). Antes esse
        // contorno não-simples ainda virava Room, produzindo pisos
        // atravessados ou deformados durante a edição de paredes.
        let simple = true;
        for (let i = 0; i < points.length && simple; i++) {
          for (let j = i + 1; j < points.length; j++) {
            if (dist(points[i]!, points[j]!) <= SNAP) { simple = false; break; }
          }
        }
        return { points, area: Math.abs(signedArea(points)), simple };
      })
      // A maior face de cada componente é o exterior. Das restantes,
      // aceita somente ciclos simples; uma ponta aberta aparece no
      // percurso como um nó repetido e não pode gerar piso.
      .sort((a, b) => b.area - a.area)
      .slice(1)
      .filter((face) => face.simple)
      .forEach(({ points, area }) => rooms.push({ points, area }));
  });

  return rooms;
}

// Teste ponto-dentro-do-polígono (ray casting) — usado pra achar em qual
// cômodo o mouse está passando por cima, com a ferramenta Telhado.
export function pointInPolygon(x: number, y: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i]!, pj = points[j]!;
    const xi = pi.x, yi = pi.y, xj = pj.x, yj = pj.y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Limites de um cômodo em unidades de MODELO, já com a meia-espessura da
// parede somada — os pontos de detectRooms são cruzamentos do EIXO das
// paredes, não da face externa.
export function roomModelBounds(room: Room): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (!room.points || !room.points.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const half = (WALL_THICK / 2) * GRID;
  room.points.forEach((p) => {
    if (p.x - half < minX) minX = p.x - half;
    if (p.x + half > maxX) maxX = p.x + half;
    if (p.y - half < minY) minY = p.y - half;
    if (p.y + half > maxY) maxY = p.y + half;
  });
  return { minX, maxX, minY, maxY };
}

// Um cômodo detectado (detectRooms) só tem pontos — depois do split de
// junção em T, as arestas do polígono não carregam mais o id da parede
// original. Volta das arestas pra quais paredes (com id) formam esse
// cômodo, pelo ponto médio de cada aresta.
export function findRoomWallIds(wallList: Wall[], room: Room): string[] {
  const TOL = COINCIDENCE_TOL;
  const ids: string[] = [];
  const pts = room.points;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]!, p2 = pts[(i + 1) % pts.length]!;
    const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
    let best: Wall | null = null, bestDist = Infinity;
    wallList.forEach((w) => {
      const d = distToSegment(midX, midY, w.x1, w.y1, w.x2, w.y2);
      if (d < bestDist) { bestDist = d; best = w; }
    });
    const bestWall = best as Wall | null;
    if (bestWall && bestDist <= TOL && ids.indexOf(bestWall.id) === -1) ids.push(bestWall.id);
  }
  return ids;
}

// Devolve o contorno inteiro apenas quando a parede clicada pertence a um
// unico comodo fechado e esse contorno ainda nao tem nenhuma ligacao com
// paredes externas. Essa e a fronteira entre dois modos de edicao:
//
// - modulo isolado: um clique pode selecionar/mover o comodo inteiro;
// - construcao incorporada: um clique seleciona somente a parede.
//
// Contar apenas quantos comodos possuem a parede clicada nao basta. Uma
// parede externa do mesmo comodo pode ter recebido uma juncao em T, por
// exemplo, enquanto a parede clicada continua pertencendo a apenas uma
// face. Por isso verificamos o contorno completo contra todas as paredes
// que ficaram fora dele.
export function findIsolatedRoomWallIds(wallList: Wall[], wallId: string): string[] | null {
  const owningRooms = detectRooms(wallList).filter((room) => (
    findRoomWallIds(wallList, room).indexOf(wallId) !== -1
  ));
  if (owningRooms.length !== 1) return null;

  const roomWallIds = findRoomWallIds(wallList, owningRooms[0]!);
  if (!roomWallIds.length) return null;
  const roomIdSet = new Set(roomWallIds);
  const roomWalls = wallList.filter((wall) => roomIdSet.has(wall.id));
  const externalWalls = wallList.filter((wall) => !roomIdSet.has(wall.id));

  const connectedToExternalWall = roomWalls.some((roomWall) => (
    externalWalls.some((externalWall) => wallsMeetAtEndpoint(roomWall, externalWall))
  ));
  return connectedToExternalWall ? null : roomWallIds;
}

export interface WallEndpointLink {
  id: string;
  which: 1 | 2;
}

export interface WallResizeTopology {
  ownerCount: number;
  start: WallEndpointLink[];
  end: WallEndpointLink[];
  startSlidingSupports: string[];
  endSlidingSupports: string[];
}

export interface WallResizeOffsetResolution {
  offset: number;
  limited: boolean;
  blockingWallId?: string;
}

// Impede que uma parede de um comodo atravesse outra parede paralela
// durante o empurrao perpendicular. O limite conserva uma celula principal
// da grade (0,50 m) entre os dois eixos: alem de evitar a inversao do
// contorno, isso impede que o ambiente colapse ate largura zero antes que o
// protetor topologico final tenha a chance de validar a transacao.
//
// A funcao usa sempre a fotografia do INICIO do gesto. Assim o obstaculo nao
// muda de lugar conforme as paredes vizinhas alongam/encurtam na previa.
export function resolveWallResizeOffset(
  target: Wall,
  wallsAtDragStart: Wall[],
  requestedOffset: number,
  nx: number,
  ny: number,
  minimumSeparation = SNAP_UNIT,
): WallResizeOffsetResolution {
  const requested = snap(requestedOffset);
  if (!target || Math.abs(requested) < 1e-6) return { offset: 0, limited: false };

  const dx = target.x2 - target.x1;
  const dy = target.y2 - target.y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { offset: requested, limited: false };
  const ux = dx / length;
  const uy = dy / length;
  let allowed = requested;
  let blockingWallId: string | undefined;

  for (const other of wallsAtDragStart) {
    if (!other || other.id === target.id) continue;
    const odx = other.x2 - other.x1;
    const ody = other.y2 - other.y1;
    const otherLength = Math.hypot(odx, ody);
    if (otherLength < 1e-6) continue;

    // Apenas outra parede paralela pode ser "atravessada" pelo corpo
    // inteiro da parede movida. Vizinhas perpendiculares sao as quinas que
    // alongam/encurtam e nao constituem barreira para este gesto.
    const parallelCross = Math.abs(ux * (ody / otherLength) - uy * (odx / otherLength));
    if (parallelCross > 0.05) continue;

    const project = (x: number, y: number) => (x - target.x1) * ux + (y - target.y1) * uy;
    const otherA = project(other.x1, other.y1);
    const otherB = project(other.x2, other.y2);
    const overlap = Math.min(length, Math.max(otherA, otherB)) - Math.max(0, Math.min(otherA, otherB));
    if (overlap <= COINCIDENCE_TOL) continue;

    const otherMidX = (other.x1 + other.x2) / 2;
    const otherMidY = (other.y1 + other.y2) / 2;
    const signedDistance = (otherMidX - target.x1) * nx + (otherMidY - target.y1) * ny;
    if (Math.abs(signedDistance) <= COINCIDENCE_TOL) continue;

    if (requested > 0 && signedDistance > 0 && requested >= signedDistance - minimumSeparation) {
      const candidate = Math.max(0, snap(signedDistance - minimumSeparation));
      if (candidate < allowed) {
        allowed = candidate;
        blockingWallId = other.id;
      }
    } else if (requested < 0 && signedDistance < 0 && requested <= signedDistance + minimumSeparation) {
      const candidate = Math.min(0, snap(signedDistance + minimumSeparation));
      if (candidate > allowed) {
        allowed = candidate;
        blockingWallId = other.id;
      }
    }
  }

  return blockingWallId
    ? { offset: allowed, limited: true, blockingWallId }
    : { offset: requested, limited: false };
}

// Decide se uma extremidade precisa ganhar uma parede curta ligando o no
// antigo ao novo durante o "empurrar parede". Comparar apenas a quantidade
// de comodos da parede nao e suficiente: um trecho compartilhado pode ter,
// no mesmo no, vizinhas perpendiculares que acompanham o movimento E uma
// continuacao colinear que deve permanecer no lugar. Essa continuacao e uma
// conexao original nao movida e, portanto, exige a ponte.
export function wallResizeEndpointNeedsBridge(
  originalLinks: WallEndpointLink[],
  movingLinks: WallEndpointLink[],
  connectionAlreadyCovered: boolean,
): boolean {
  if (connectionAlreadyCovered) return false;
  // Uma ponta livre nao deixa nenhuma ligacao para tras quando a parede
  // se move. Criar uma ponte nesse caso transforma o arraste em um U:
  // ficam a parede nova e dois rastros partindo da posicao antiga. Alem
  // da copia visual, esses rastros passam a ser materializados como novas
  // juncoes em T nos arrastes seguintes. Ponte so existe para preservar
  // uma conexao real que permaneceu no no antigo.
  if (!originalLinks.length) return false;
  return originalLinks.some((original) => !movingLinks.some(
    (moving) => moving.id === original.id && moving.which === original.which,
  ));
}

// Ao empurrar uma parede, as quinas que pertencem aos cômodos dos dois
// lados são um único nó topológico. Uma parede fundida não pode escolher
// somente um dos cômodos: isso moveria a vizinha de um lado e deixaria a
// do outro no ponto antigo, abrindo uma fresta unilateral.
//
// A busca usa apenas as vizinhas imediatas da parede em cada contorno de
// cômodo. Assim, mesmo que várias paredes coincidam no mesmo ponto, não
// arrastamos por engano uma parede distante que apenas toca essa quina.
export function wallResizeTopology(wallList: Wall[], wallId: string): WallResizeTopology {
  const target = wallList.find((wall) => wall.id === wallId);
  if (!target) return {
    ownerCount: 0,
    start: [],
    end: [],
    startSlidingSupports: [],
    endSlidingSupports: [],
  };

  const dx = target.x2 - target.x1;
  const dy = target.y2 - target.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const start: WallEndpointLink[] = [];
  const end: WallEndpointLink[] = [];
  const startSlidingSupports: string[] = [];
  const endSlidingSupports: string[] = [];
  let ownerCount = 0;

  const addUnique = (list: WallEndpointLink[], link: WallEndpointLink) => {
    if (!list.some((item) => item.id === link.id && item.which === link.which)) list.push(link);
  };
  const addMatchingEndpoint = (neighbor: Wall, x: number, y: number, list: WallEndpointLink[]) => {
    const ndx = neighbor.x2 - neighbor.x1;
    const ndy = neighbor.y2 - neighbor.y1;
    const nlen = Math.hypot(ndx, ndy) || 1;
    const cross = Math.abs(ux * (ndy / nlen) - uy * (ndx / nlen));
    if (cross < 0.05) return;
    if (Math.hypot(neighbor.x1 - x, neighbor.y1 - y) <= COINCIDENCE_TOL) addUnique(list, { id: neighbor.id, which: 1 });
    if (Math.hypot(neighbor.x2 - x, neighbor.y2 - y) <= COINCIDENCE_TOL) addUnique(list, { id: neighbor.id, which: 2 });
  };

  // Uma ponta pode formar uma junção em T no MEIO de uma parede passante.
  // Nesse caso não há endpoint vizinho para mover. Como o redimensionamento
  // acontece na normal da parede-alvo (paralela à parede passante), a ponta
  // deve deslizar sobre esse segmento. Guardamos esse apoio separadamente
  // para que a UI não crie uma parede-rastro no vértice antigo.
  wallList.forEach((neighbor) => {
    if (neighbor.id === wallId) return;
    const ndx = neighbor.x2 - neighbor.x1;
    const ndy = neighbor.y2 - neighbor.y1;
    const nlen = Math.hypot(ndx, ndy) || 1;
    const cross = Math.abs(ux * (ndy / nlen) - uy * (ndx / nlen));
    if (cross < 0.95) return;

    const collectSupport = (x: number, y: number, list: string[]) => {
      const projected = projectOnSegment(x, y, neighbor.x1, neighbor.y1, neighbor.x2, neighbor.y2);
      if (!projected || projected.dist > COINCIDENCE_TOL) return;
      const t = ((projected.x - neighbor.x1) * ndx + (projected.y - neighbor.y1) * ndy) / (nlen * nlen);
      if (t <= 0.02 || t >= 0.98) return;
      if (list.indexOf(neighbor.id) === -1) list.push(neighbor.id);
    };

    collectSupport(target.x1, target.y1, startSlidingSupports);
    collectSupport(target.x2, target.y2, endSlidingSupports);
  });

  // Depois que uma junção em T é materializada, a parede passante vira
  // dois trechos e o ponto do encontro passa a reunir três endpoints
  // reais. Esses vínculos não podem depender apenas de detectRooms: em
  // uma construção já fundida/dividida, a inferência do contorno pode
  // escolher somente um dos trechos e o segundo arraste abre o outro.
  // Endpoint coincidente é o próprio nó topológico; portanto, todas as
  // paredes não colineares que terminam nele devem acompanhá-lo.
  wallList.forEach((neighbor) => {
    if (neighbor.id === wallId) return;
    addMatchingEndpoint(neighbor, target.x1, target.y1, start);
    addMatchingEndpoint(neighbor, target.x2, target.y2, end);
  });

  detectRooms(wallList).forEach((room) => {
    const ids = findRoomWallIds(wallList, room);
    const index = ids.indexOf(wallId);
    if (index === -1 || ids.length < 2) return;
    ownerCount++;
    const neighborIds = [ids[(index - 1 + ids.length) % ids.length], ids[(index + 1) % ids.length]];
    neighborIds.forEach((neighborId) => {
      if (!neighborId || neighborId === wallId) return;
      const neighbor = wallList.find((wall) => wall.id === neighborId);
      if (!neighbor) return;
      addMatchingEndpoint(neighbor, target.x1, target.y1, start);
      addMatchingEndpoint(neighbor, target.x2, target.y2, end);
    });
  });

  return { ownerCount, start, end, startSlidingSupports, endSlidingSupports };
}

// Corte de canto por interseção de RETA com RETA, por face, separadamente
// — como CAD resolve isso. Num canto simples (exatamente 2 paredes se
// encontram no ponto), pra cada face desta parede, cruza a reta dela com
// a face correspondente da vizinha. Ver comentário histórico completo em
// legacy/index-monolito-original.html — lógica preservada sem alteração.
export function computeWallFootprints(wallList: Wall[]): Record<string, WallFootprint> {
  const halfThick = (WALL_THICK * GRID) / 2;

  function touchersAt(x: number, y: number, excludeId: string): { w: Wall; end: 1 | 2 }[] {
    const list: { w: Wall; end: 1 | 2 }[] = [];
    wallList.forEach((w) => {
      if (w.id === excludeId) return;
      if (Math.hypot(w.x1 - x, w.y1 - y) <= COINCIDENCE_TOL) list.push({ w, end: 1 });
      else if (Math.hypot(w.x2 - x, w.y2 - y) <= COINCIDENCE_TOL) list.push({ w, end: 2 });
    });
    return list;
  }
  function wallDir(w: Wall) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy) || 1e-6;
    return { ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len };
  }
  function cross(ax: number, ay: number, bx: number, by: number): number {
    return ax * by - ay * bx;
  }
  // Cruza a reta (P+o1, direção d1) com a reta (P+o2, direção d2). null se
  // forem paralelas.
  function intersect(
    px: number, py: number, o1x: number, o1y: number, d1x: number, d1y: number,
    o2x: number, o2y: number, d2x: number, d2y: number
  ): Point | null {
    const a1x = px + o1x, a1y = py + o1y, a2x = px + o2x, a2y = py + o2y;
    const denom = cross(d1x, d1y, d2x, d2y);
    if (Math.abs(denom) < 1e-9) return null;
    const t = cross(a2x - a1x, a2y - a1y, d2x, d2y) / denom;
    return { x: a1x + d1x * t, y: a1y + d1y * t };
  }

  const footprints: Record<string, WallFootprint> = {};
  wallList.forEach((w) => {
    const dir = wallDir(w);
    const ux = dir.ux, uy = dir.uy, nx = dir.nx, ny = dir.ny;
    const touchStart = touchersAt(w.x1, w.y1, w.id);
    const touchEnd = touchersAt(w.x2, w.y2, w.id);

    function endPoints(
      px: number, py: number, end: 1 | 2, touchers: { w: Wall; end: 1 | 2 }[]
    ): { a: Point; b: Point; free: boolean; extended: boolean } {
      if (touchers.length === 1) {
        const leave1x = end === 1 ? ux : -ux, leave1y = end === 1 ? uy : -uy;
        const left1x = -leave1y, left1y = leave1x;
        const right1x = leave1y, right1y = -leave1x;

        const other = touchers[0]!;
        const od = wallDir(other.w);
        const leave2x = other.end === 1 ? od.ux : -od.ux, leave2y = other.end === 1 ? od.uy : -od.uy;
        const left2x = -leave2y, left2y = leave2x;
        const right2x = leave2y, right2y = -leave2x;

        // "Limite de mitre" — ver comentário histórico completo no
        // arquivo original. Ângulo raso entre as duas paredes => trata
        // como ponta livre em vez de arriscar um "espinho" longe.
        const joinAngleSin = Math.abs(cross(leave1x, leave1y, leave2x, leave2y));
        if (joinAngleSin > 0.5) {
          const c1 = intersect(px, py, right1x * halfThick, right1y * halfThick, leave1x, leave1y,
                                        left2x * halfThick, left2y * halfThick, leave2x, leave2y);
          const c2 = intersect(px, py, left1x * halfThick, left1y * halfThick, leave1x, leave1y,
                                        right2x * halfThick, right2y * halfThick, leave2x, leave2y);
          if (c1 && c2) {
            const rightIsA = (right1x * nx + right1y * ny) > 0;
            return { a: rightIsA ? c1 : c2, b: rightIsA ? c2 : c1, free: false, extended: false };
          }
        } else {
          const exShallow = halfThick;
          const dOutXShallow = end === 1 ? -ux : ux, dOutYShallow = end === 1 ? -uy : uy;
          const bxShallow = px + dOutXShallow * exShallow, byShallow = py + dOutYShallow * exShallow;
          return {
            a: { x: bxShallow + nx * halfThick, y: byShallow + ny * halfThick },
            b: { x: bxShallow - nx * halfThick, y: byShallow - ny * halfThick },
            free: true, extended: true
          };
        }
      }
      // Junção em T "disfarçada" de 3 vias — ver comentário histórico
      // completo no arquivo original.
      if (touchers.length === 2) {
        function leavingOf(t: { w: Wall; end: 1 | 2 }): Point {
          const od2 = wallDir(t.w);
          return t.end === 1 ? { x: od2.ux, y: od2.uy } : { x: -od2.ux, y: -od2.uy };
        }
        const l0 = leavingOf(touchers[0]!), l1 = leavingOf(touchers[1]!);
        const othersCollinear = Math.abs(cross(l0.x, l0.y, l1.x, l1.y)) < 0.02 && (l0.x * l1.x + l0.y * l1.y) < 0;
        if (othersCollinear) {
          const leaveTapX = end === 1 ? ux : -ux, leaveTapY = end === 1 ? uy : -uy;
          const bxT = px + leaveTapX * halfThick, byT = py + leaveTapY * halfThick;
          return {
            a: { x: bxT + nx * halfThick, y: byT + ny * halfThick },
            b: { x: bxT - nx * halfThick, y: byT - ny * halfThick },
            free: false, extended: true
          };
        }
        const leaveMe = end === 1 ? { x: ux, y: uy } : { x: -ux, y: -uy };
        const iAmPartOfThrough = touchers.some((t) => {
          const lt = leavingOf(t);
          return Math.abs(cross(leaveMe.x, leaveMe.y, lt.x, lt.y)) < 0.02 && (leaveMe.x * lt.x + leaveMe.y * lt.y) < 0;
        });
        if (iAmPartOfThrough) {
          return {
            a: { x: px + nx * halfThick, y: py + ny * halfThick },
            b: { x: px - nx * halfThick, y: py - ny * halfThick },
            free: false, extended: false
          };
        }
      }
      // ponta livre (0) ou junção de 3+ vias sem nenhum par colinear.
      const free = touchers.length === 0;
      const extend = free || touchers.map((t) => t.w.id).concat([w.id]).sort()[0] === w.id;
      const ex = extend ? halfThick : 0;
      const dOutX = end === 1 ? -ux : ux, dOutY = end === 1 ? -uy : uy;
      const bx = px + dOutX * ex, by = py + dOutY * ex;
      return {
        a: { x: bx + nx * halfThick, y: by + ny * halfThick },
        b: { x: bx - nx * halfThick, y: by - ny * halfThick },
        free, extended: true
      };
    }

    const e1 = endPoints(w.x1, w.y1, 1, touchStart);
    const e2 = endPoints(w.x2, w.y2, 2, touchEnd);
    footprints[w.id] = {
      p1a: e1.a, p1b: e1.b, p2a: e2.a, p2b: e2.b,
      p1Free: e1.free, p2Free: e2.free,
      p1Extended: e1.extended, p2Extended: e2.extended
    };
  });
  return footprints;
}

// Distância perpendicular de um ponto até a RETA infinita que passa por
// (x1,y1)-(x2,y2) — diferente de distToSegment, que limita ao segmento.
export function distPointToLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Math.hypot(px - x1, py - y1);
  return Math.abs((px - x1) * dy - (py - y1) * dx) / len;
}

// Trata uma parede como um retângulo orientado — base pra testar colisão
// entre duas paredes em QUALQUER ângulo.
export function wallOBB(w: Wall): WallOBB {
  const cx = (w.x1 + w.x2) / 2, cy = (w.y1 + w.y2) / 2;
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  // Os pontos da parede estão em unidades de modelo (GRID por metro).
  // A espessura precisa estar na mesma unidade; usar WALL_THICK / 2 aqui
  // deixava a caixa de colisão 20x mais fina do que a parede renderizada.
  return { cx, cy, ux, uy, nx: -uy, ny: ux, halfLen: len / 2, halfThick: WALL_THICK * GRID / 2 };
}

// Mesmo retângulo orientado, mas pro "rodapé" de um móvel — usado só
// pra travar o arrasto livre contra parede (ver
// ViewportController.resolveFurniturePosition). widthMeters/depthMeters
// vêm da caixa delimitadora real do .glb carregado (largura/profundidade
// no próprio eixo local do modelo, ANTES da rotação — a rotação entra
// aqui via rotationDeg, não fica embutida no tamanho). Precisam virar
// unidade de modelo (× GRID) pra comparar com wallOBB, que já está
// nessa unidade.
export function furnitureOBB(
  item: { x: number; y: number; rotationDeg: number },
  widthMeters: number,
  depthMeters: number
): WallOBB {
  const angleRad = (item.rotationDeg || 0) * Math.PI / 180;
  const ux = Math.cos(angleRad), uy = Math.sin(angleRad);
  return {
    cx: item.x, cy: item.y, ux, uy, nx: -uy, ny: ux,
    halfLen: (widthMeters / 2) * GRID,
    halfThick: (depthMeters / 2) * GRID,
  };
}

// A abertura ocupa um trecho real da parede hospedeira. Esse retangulo e
// usado durante arrastes para impedir que outra parede atravesse uma porta
// ou janela, mesmo que visualmente o vao nao tenha geometria de parede ali.
export function openingOBB(opening: Opening, owner: Wall): WallOBB {
  const dx = owner.x2 - owner.x1, dy = owner.y2 - owner.y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  const centerDistance = opening.offset * GRID;
  return {
    cx: owner.x1 + ux * centerDistance,
    cy: owner.y1 + uy * centerDistance,
    ux,
    uy,
    nx: -uy,
    ny: ux,
    halfLen: (opening.width / 2 + OPENING_WALL_CLEARANCE) * GRID,
    halfThick: WALL_THICK * GRID / 2,
  };
}

export function wallOverlapsForeignOpening(
  candidate: Wall,
  movedWallIds: string[],
  openings: Opening[],
  walls: Wall[],
): boolean {
  const candidateBox = wallOBB(candidate);
  for (const opening of openings) {
    if (movedWallIds.indexOf(opening.wallId) !== -1) continue;
    const owner = walls.find((wall) => wall.id === opening.wallId);
    if (owner && obbOverlapMTV(candidateBox, openingOBB(opening, owner))) return true;
  }
  return false;
}

// Verifica todo o caminho do empurrao, e nao apenas a posicao final. Eventos
// de ponteiro podem saltar varias celulas entre dois frames; sem essa
// varredura uma parede atravessava a largura inteira do vao sem jamais ser
// observada exatamente sobre ele.
export function resolveWallOffsetAgainstOpenings(
  source: Wall,
  requestedOffset: number,
  nx: number,
  ny: number,
  movedWallIds: string[],
  openings: Opening[],
  walls: Wall[],
): { offset: number; limited: boolean } {
  const requested = snap(requestedOffset);
  if (Math.abs(requested) < 1e-6) return { offset: 0, limited: false };
  const direction = requested > 0 ? 1 : -1;
  let lastSafe = 0;
  for (let distance = SNAP_UNIT; distance <= Math.abs(requested); distance += SNAP_UNIT) {
    const offset = Math.min(distance, Math.abs(requested)) * direction;
    const candidate: Wall = {
      ...source,
      x1: source.x1 + nx * offset,
      y1: source.y1 + ny * offset,
      x2: source.x2 + nx * offset,
      y2: source.y2 + ny * offset,
    };
    if (wallOverlapsForeignOpening(candidate, movedWallIds, openings, walls)) {
      return { offset: lastSafe, limited: true };
    }
    lastSafe = offset;
  }
  return { offset: requested, limited: false };
}

function projectOBB(o: WallOBB, axisX: number, axisY: number): Interval {
  const ex = o.ux * o.halfLen, ey = o.uy * o.halfLen;
  const fx = o.nx * o.halfThick, fy = o.ny * o.halfThick;
  const c1 = (o.cx + ex + fx) * axisX + (o.cy + ey + fy) * axisY;
  const c2 = (o.cx + ex - fx) * axisX + (o.cy + ey - fy) * axisY;
  const c3 = (o.cx - ex + fx) * axisX + (o.cy - ey + fy) * axisY;
  const c4 = (o.cx - ex - fx) * axisX + (o.cy - ey - fy) * axisY;
  return { min: Math.min(c1, c2, c3, c4), max: Math.max(c1, c2, c3, c4) };
}

// SAT entre dois retângulos orientados. Se sobrepõem, devolve o menor
// vetor (x,y) que separa A de B (empurra A pra fora). Se não sobrepõem,
// devolve null.
export function obbOverlapMTV(a: WallOBB, b: WallOBB): MTV | null {
  const axes: [number, number][] = [[a.ux, a.uy], [a.nx, a.ny], [b.ux, b.uy], [b.nx, b.ny]];
  let minOverlap = Infinity, minAxisX = 0, minAxisY = 0;
  for (let i = 0; i < axes.length; i++) {
    const [ax, ay] = axes[i]!;
    const pa = projectOBB(a, ax, ay), pb = projectOBB(b, ax, ay);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null; // achou eixo separador — não colide
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const cdx = a.cx - b.cx, cdy = a.cy - b.cy;
      const sign = (cdx * ax + cdy * ay) < 0 ? -1 : 1;
      minAxisX = ax * sign; minAxisY = ay * sign;
    }
  }
  return { x: minAxisX * minOverlap, y: minAxisY * minOverlap };
}

// Duas paredes podem ocupar o mesmo eixo somente quando esse encontro
// representa uma fusão real: direções paralelas, linhas coincidentes e
// um trecho compartilhado com comprimento suficiente. Essa exceção é
// importante no arraste de cômodos: a caixa de colisão não pode expulsar
// a parede móvel justamente da linha onde ela deve se fundir à existente.
export function wallsCanFuse(
  a: Wall,
  b: Wall,
  toleranceDistance = COINCIDENCE_TOL,
  toleranceAngle = 0.05,
  minimumOverlap = SNAP_UNIT * 0.5,
): boolean {
  if (!a || !b || a.id === b.id) return false;
  const aLen = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
  const bLen = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
  if (aLen < 1e-6 || bLen < 1e-6) return false;

  const aAngle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const bAngle = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
  let angleDiff = Math.abs(aAngle - bAngle) % Math.PI;
  if (angleDiff > Math.PI / 2) angleDiff = Math.PI - angleDiff;
  if (angleDiff > toleranceAngle) return false;

  const lineDistance = distPointToLine(
    (a.x1 + a.x2) / 2,
    (a.y1 + a.y2) / 2,
    b.x1,
    b.y1,
    b.x2,
    b.y2,
  );
  if (lineDistance > toleranceDistance) return false;

  const ux = (b.x2 - b.x1) / bLen;
  const uy = (b.y2 - b.y1) / bLen;
  const ta1 = (a.x1 - b.x1) * ux + (a.y1 - b.y1) * uy;
  const ta2 = (a.x2 - b.x1) * ux + (a.y2 - b.y1) * uy;
  const overlap = Math.min(Math.max(ta1, ta2), bLen) - Math.max(Math.min(ta1, ta2), 0);
  return overlap >= minimumOverlap;
}

// Contatos exatos de ponta tambem sao juncoes validas. Ao encaixar dois
// comodos completos, a parede compartilhada fica colinear, mas as paredes
// perpendiculares do contorno encostam nela pelas pontas (quinas/juncoes em
// T). As caixas orientadas se sobrepoem nessas quinas por causa da espessura
// da parede; isso nao pode ser confundido com uma parede atravessando outra.
export function wallsMeetAtEndpoint(
  a: Wall,
  b: Wall,
  toleranceDistance = COINCIDENCE_TOL,
): boolean {
  if (!a || !b || a.id === b.id) return false;
  return (
    distToSegment(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2) <= toleranceDistance ||
    distToSegment(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2) <= toleranceDistance ||
    distToSegment(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2) <= toleranceDistance ||
    distToSegment(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2) <= toleranceDistance
  );
}

// Resolve o movimento de um cômodo exclusivamente em passos do grid.
// Se a posição pedida colidir com uma parede externa sem formar um
// encaixe fundível, conserva a última posição válida. Nunca devolve o
// pequeno deslocamento contínuo de uma MTV, que colocaria o eixo da
// parede entre duas linhas da malha.
export function resolveWallGroupGridDelta(
  group: Wall[],
  others: Wall[],
  requestedDx: number,
  requestedDy: number,
  lastValidDx = 0,
  lastValidDy = 0,
  openings: Opening[] = [],
  allWalls: Wall[] = [],
): Point {
  const dx = snap(requestedDx);
  const dy = snap(requestedDy);
  const groupIds = group.map((wall) => wall.id);
  for (const source of group) {
    const candidate: Wall = {
      ...source,
      x1: source.x1 + dx,
      y1: source.y1 + dy,
      x2: source.x2 + dx,
      y2: source.y2 + dy,
    };
    if (wallOverlapsForeignOpening(candidate, groupIds, openings, allWalls)) {
      return { x: snap(lastValidDx), y: snap(lastValidDy) };
    }
    for (const other of others) {
      if (wallsCanFuse(candidate, other)) continue;
      if (wallsMeetAtEndpoint(candidate, other)) continue;
      if (obbOverlapMTV(wallOBB(candidate), wallOBB(other))) {
        return { x: snap(lastValidDx), y: snap(lastValidDy) };
      }
    }
  }
  return { x: dx, y: dy };
}

// Namespace de compatibilidade — permite chamar `Core.snap(...)` igual ao
// código legado, útil enquanto os outros módulos (Store, ViewportController
// etc.) ainda não foram migrados e continuam chamando no formato antigo.
export const Core = {
  GRID, SNAP_UNIT, WALL_THICK, COINCIDENCE_TOL, COLUMN_SIZE,
  DOOR_DEFAULT_WIDTH, DOOR_DEFAULT_HEIGHT,
  WINDOW_DEFAULT_WIDTH, WINDOW_DEFAULT_HEIGHT, WINDOW_DEFAULT_SILL,
  OPENING_MARGIN, OPENING_GAP, OPENING_WALL_CLEARANCE,
  snap, nextId,
  createOpeningEntity, wallLengthMeters, wallOffsetAtPoint, findValidOpeningOffset,
  roofRidgeHeightMeters, roofPitchForRidgeHeight, roofsCanFuse, fusedRoofBounds,
  rectsNearby, pointInPolygon, roomModelBounds, findRoomWallIds, findIsolatedRoomWallIds, wallResizeTopology, resolveWallResizeOffset, computeWallFootprints,
  wallResizeEndpointNeedsBridge,
  distPointToLine, wallOBB, furnitureOBB, openingOBB, obbOverlapMTV, wallOverlapsForeignOpening, resolveWallOffsetAgainstOpenings, wallsCanFuse, wallsMeetAtEndpoint, resolveWallGroupGridDelta,
  findWallTJunctionSplits,
  createWallEntity, createColumnEntity, createRoofEntity, createVarandaEntity, createFloorEntity,
  createFurnitureEntity,
  createProject, distToSegment, projectOnSegment, detectRooms
};