// Composição real de telhados por interseção de sólidos (manifold-3d, WASM).
//
// Substitui, para a peça de espigão/cumeeira, a pilha de regras posicionais
// escritas à mão em Scene3DRenderer.ts (hipCornerRidgeCrossingRect,
// ridgeCapPartialOverlapFootprints, otherRoofHeightAtPoint,
// hipCornerOnOtherRoofStraightEdge, hipCornerCoincidesWithLowerIdRoof) por
// geometria sólida de verdade: cada telhado quatro-águas/duas-águas vira um
// sólido real (interseção de semi-espaços, um por aresta inclinada — mesma
// técnica documentada no BRABIM, DEC-0008, via OCCT), e o encontro entre
// dois telhados do mesmo compoundGroupId é a união/subtração booleana real
// desses sólidos. O trecho de espigão/cumeeira que sobrevive nessa
// composição é extraído por amostragem ao longo do segmento original.
//
// Eixo Y = vertical (convenção Three.js/Scene3DRenderer). x/z do sólido
// correspondem a x/y do plano 2D do projeto (ver comentário em types.ts
// sobre Varanda: "eixo Z chamado 'y' no plano 2D").
import Module from 'manifold-3d';

type ManifoldCtor = any;
type ManifoldInstance = any;

let ManifoldClass: ManifoldCtor | null = null;
let readyPromise: Promise<void> | null = null;

/** Carrega o módulo WASM uma única vez. Chamar no bootstrap do app, antes
 * do primeiro rebuild() que possa envolver telhados compostos — as funções
 * abaixo são síncronas depois disso, exatamente como o resto do rebuild(). */
export function ensureRoofSolidGeometryReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const wasm = await Module();
      wasm.setup();
      ManifoldClass = wasm.Manifold;
    })();
  }
  return readyPromise;
}

function Manifold(): ManifoldCtor {
  if (!ManifoldClass) {
    throw new Error(
      'roofSolidGeometry: ensureRoofSolidGeometryReady() ainda não resolveu — chame e aguarde no bootstrap do app antes do primeiro rebuild().'
    );
  }
  return ManifoldClass;
}

/** Suficientemente grande pra qualquer planta real, pequeno o bastante pra
 * não perder precisão de ponto flutuante nas operações booleanas. */
const BIG = 1e5;

export interface RoofFootprintInput {
  x1: number;
  y1: number; // "y" do plano 2D — mapeado pro eixo Z do sólido 3D.
  x2: number;
  y2: number;
  /** Altura do beiral (base do telhado) em relação ao piso do pavimento. */
  baseHeightM: number;
  pitchDeg: number;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Semi-espaço "abaixo do plano que nasce na aresta em edgeCoord, subindo
 * com tanTheta ao longo de +axis (sign=+1) ou -axis (sign=-1)". Construído
 * como uma caixa enorme cuja face superior coincide com o plano antes de
 * rotacionar — validado (spike) contra pico e comprimento de cumeeira
 * exatos em casos analíticos conhecidos. */
function halfSpaceBelowSlopedPlane(opts: {
  axis: 'x' | 'z';
  edgeCoord: number;
  sign: 1 | -1;
  baseY: number;
  tanTheta: number;
}): ManifoldInstance {
  const { axis, edgeCoord, sign, baseY, tanTheta } = opts;
  let box = Manifold().cube([BIG, BIG, BIG], true);
  box = box.translate([0, -BIG / 2, 0]);
  const thetaDeg = (Math.atan(tanTheta) * 180) / Math.PI;
  if (axis === 'z') {
    box = box.rotate([sign > 0 ? -thetaDeg : thetaDeg, 0, 0]);
    box = box.translate([0, baseY, edgeCoord]);
  } else {
    box = box.rotate([0, 0, sign > 0 ? thetaDeg : -thetaDeg]);
    box = box.translate([edgeCoord, baseY, 0]);
  }
  return box;
}

function verticalPrism(xMin: number, xMax: number, zMin: number, zMax: number, baseY: number, capHeight: number): ManifoldInstance {
  const width = xMax - xMin;
  const depth = zMax - zMin;
  let prism = Manifold().cube([width, capHeight, depth], true);
  return prism.translate([(xMin + xMax) / 2, baseY + capHeight / 2, (zMin + zMax) / 2]);
}

export interface WorldBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  tanTheta: number;
}

/** Telhado quatro-águas a partir de valores já em espaço de mundo (mesmo
 * referencial de `roofPeakBoxes`/`hipCornerXZ` em Scene3DRenderer.ts — usar
 * esta variante na integração de produção evita reconverter escala/graus e
 * garante o mesmo referencial que o resto do arquivo já usa). Interseção
 * das 4 semi-espaços (um por aresta do footprint) com o prisma vertical —
 * o pico nasce sozinho da geometria: footprint quadrado, os 4 planos se
 * encontram num ponto só; retangular, sobra uma cumeeira reta cujo
 * comprimento é exatamente lado comprido menos lado curto (validado no
 * spike). */
export function buildHipSolidFromWorldBox(box: WorldBox): ManifoldInstance {
  const { minX: xMin, maxX: xMax, minZ: zMin, maxZ: zMax, baseY, tanTheta } = box;
  const halfSpan = Math.min(xMax - xMin, zMax - zMin) / 2;
  const peak = halfSpan * tanTheta;
  const capHeight = peak + 1;

  const prism = verticalPrism(xMin, xMax, zMin, zMax, baseY, capHeight);
  const south = halfSpaceBelowSlopedPlane({ axis: 'z', edgeCoord: zMin, sign: 1, baseY, tanTheta });
  const north = halfSpaceBelowSlopedPlane({ axis: 'z', edgeCoord: zMax, sign: -1, baseY, tanTheta });
  const west = halfSpaceBelowSlopedPlane({ axis: 'x', edgeCoord: xMin, sign: 1, baseY, tanTheta });
  const east = halfSpaceBelowSlopedPlane({ axis: 'x', edgeCoord: xMax, sign: -1, baseY, tanTheta });
  return prism.intersect(south).intersect(north).intersect(west).intersect(east);
}

/** Telhado quatro-águas: interseção das 4 semi-espaços (um por aresta do
 * footprint) com o prisma vertical — o pico nasce sozinho da geometria,
 * sem precisar decidir "hip" vs "cumeeira central" antes: se o footprint
 * for quadrado, os 4 planos se encontram num ponto só; se for retangular,
 * sobra uma cumeeira reta cujo comprimento é exatamente lado comprido menos
 * lado curto (validado no spike). API voltada pra testes/uso isolado — a
 * integração de produção usa buildHipSolidFromWorldBox diretamente. */
export function buildHipSolid(roof: RoofFootprintInput): ManifoldInstance {
  return buildHipSolidFromWorldBox({
    minX: Math.min(roof.x1, roof.x2),
    maxX: Math.max(roof.x1, roof.x2),
    minZ: Math.min(roof.y1, roof.y2),
    maxZ: Math.max(roof.y1, roof.y2),
    baseY: roof.baseHeightM,
    tanTheta: Math.tan(degToRad(roof.pitchDeg)),
  });
}

/** Telhado duas-águas: só as 2 arestas ao longo do eixo perpendicular à
 * cumeeira são inclinadas — as outras duas (as pontas, onde nasce o oitão)
 * ficam verticais, então a seção transversal é constante ao longo do
 * ridgeAxis (um prisma triangular reto, sem "hip" nas pontas). */
/** Variante duas-águas a partir de valores em espaço de mundo (ver
 * buildHipSolidFromWorldBox). `ridgeAlongX=true` quando a cumeeira corre no
 * eixo X (arestas inclinadas são a sul/norte, em Z) — mesma convenção de
 * `axisIsZ`/`ridgeAlongX` já usada em `roofSlopeSurfaceParams`. */
export function buildGableSolidFromWorldBox(box: WorldBox, ridgeAlongX: boolean): ManifoldInstance {
  const { minX: xMin, maxX: xMax, minZ: zMin, maxZ: zMax, baseY, tanTheta } = box;
  const halfSpan = ridgeAlongX ? (zMax - zMin) / 2 : (xMax - xMin) / 2;
  const peak = halfSpan * tanTheta;
  const capHeight = peak + 1;

  const prism = verticalPrism(xMin, xMax, zMin, zMax, baseY, capHeight);
  if (ridgeAlongX) {
    const south = halfSpaceBelowSlopedPlane({ axis: 'z', edgeCoord: zMin, sign: 1, baseY, tanTheta });
    const north = halfSpaceBelowSlopedPlane({ axis: 'z', edgeCoord: zMax, sign: -1, baseY, tanTheta });
    return prism.intersect(south).intersect(north);
  }
  const west = halfSpaceBelowSlopedPlane({ axis: 'x', edgeCoord: xMin, sign: 1, baseY, tanTheta });
  const east = halfSpaceBelowSlopedPlane({ axis: 'x', edgeCoord: xMax, sign: -1, baseY, tanTheta });
  return prism.intersect(west).intersect(east);
}

/** Telhado duas-águas: só as 2 arestas ao longo do eixo perpendicular à
 * cumeeira são inclinadas — as outras duas (as pontas, onde nasce o oitão)
 * ficam verticais. API voltada pra testes/uso isolado. */
export function buildGableSolid(roof: RoofFootprintInput, ridgeAxis: 'x' | 'y'): ManifoldInstance {
  return buildGableSolidFromWorldBox(
    {
      minX: Math.min(roof.x1, roof.x2),
      maxX: Math.max(roof.x1, roof.x2),
      minZ: Math.min(roof.y1, roof.y2),
      maxZ: Math.max(roof.y1, roof.y2),
      baseY: roof.baseHeightM,
      tanTheta: Math.tan(degToRad(roof.pitchDeg)),
    },
    ridgeAxis === 'x'
  );
}

/** Altura (y) do topo do sólido bem no ponto (x,z), amostrada em pé-de-letra:
 * sobe uma linha vertical curta a partir de startY e acha o maior y ainda
 * dentro do sólido, por bisseção — usado só pra diagnosticar/testar, não
 * pro caminho de produção (que usa surviveOnSolid abaixo). */
export function heightAtPoint(solid: ManifoldInstance, x: number, z: number, searchFrom: number, searchTo: number, tolerance = 1e-4): number | null {
  const containsAtY = (y: number): boolean => pointInsideSolid(solid, x, y, z);
  if (!containsAtY(searchFrom)) return null;
  let lo = searchFrom;
  let hi = searchTo;
  if (containsAtY(hi)) return hi;
  while (hi - lo > tolerance) {
    const mid = (lo + hi) / 2;
    if (containsAtY(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Teste ponto-dentro-do-sólido via bounding box + volume: manifold-3d não
 * expõe um "contains point" direto, então usamos um cubo minúsculo
 * centrado no ponto e checamos se a interseção com o sólido tem volume
 * positivo — barato o bastante pra amostragem ao longo de uma linha (uso
 * em survivingSegments), não pra malhas inteiras. */
function pointInsideSolid(solid: ManifoldInstance, x: number, y: number, z: number, eps = 1e-3): boolean {
  const probe = Manifold()
    .cube([eps, eps, eps], true)
    .translate([x, y, z]);
  return solid.intersect(probe).volume() > (eps * eps * eps) / 8;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Compõe dois telhados do mesmo compoundGroupId como um único sólido real
 * (união booleana dos dois volumes completos). Uma única operação cobre os
 * dois casos que antes precisavam de regras separadas: onde um telhado é
 * claramente mais alto, a união simplesmente tem a superfície dele ali;
 * onde os picos empatam (DEC-167), a união funde os dois sem duplicar nem
 * abrir buraco — quem "sobra" em cada ponto sai direto da geometria, sem
 * precisar de desempate por id. */
export function composeRoofPair(ownSolid: ManifoldInstance, neighborSolid: ManifoldInstance): ManifoldInstance {
  return ownSolid.add(neighborSolid);
}

/** Um ponto do espigão/cumeeira original de "own" sobrevive na composição
 * se ele continuar na SUPERFÍCIE (fronteira) do sólido unido — ou seja, se
 * nada do vizinho ocupa o espaço logo ACIMA dele. Se o vizinho for mais
 * alto ali, o ponto fica ENTERRADO dentro do sólido unido (coberto por
 * cima), não mais na fronteira — é exatamente esse teste que decide
 * "esconder" sem precisar de nenhuma regra de posição escrita à mão. */
export function survivesOnUnion(union: ManifoldInstance, x: number, y: number, z: number, eps = 1e-3): boolean {
  return !pointInsideSolid(union, x, y + eps, z);
}

/** Dado o segmento 3D que buildRidgeCapMesh desenharia hoje (canto→pico ou
 * canto→canto) e a união real dos telhados envolvidos (composeRoofPair),
 * devolve o(s) sub-trecho(s) [t0,t1] (fração 0..1 ao longo do segmento) que
 * sobrevivem — ou [] se a peça inteira for engolida pelo vizinho. Amostra
 * em `samples` pontos; suficiente pra segmentos retos de poucos metros
 * (mesma ordem de grandeza dos casos reais DEC-165 a DEC-209). */
export function survivingSegments(a: Point3, b: Point3, union: ManifoldInstance, samples = 200): Array<{ t0: number; t1: number }> {
  const surviving: boolean[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + t * (b.x - a.x);
    const y = a.y + t * (b.y - a.y);
    const z = a.z + t * (b.z - a.z);
    surviving.push(survivesOnUnion(union, x, y, z));
  }
  const segments: Array<{ t0: number; t1: number }> = [];
  let start: number | null = null;
  for (let i = 0; i <= samples; i++) {
    if (surviving[i] && start === null) start = i;
    if ((!surviving[i] || i === samples) && start !== null) {
      const end = surviving[i] ? i : i - 1;
      segments.push({ t0: start / samples, t1: end / samples });
      start = null;
    }
  }
  return segments;
}
