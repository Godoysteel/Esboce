// MaterialsPanel — quantitativo de materiais e estimativa de custo,
// calculado a partir do projeto inteiro (todos os pavimentos). Migrado
// de `var MaterialsPanel = (function(){...})()` no index.html monolítico
// original (ver legacy/index-monolito-original.html, linhas 6312-6885).

import { Core } from './Core.js';
import { Store } from './Store.js';
import { Catalog } from './Catalog.js';
import { Scene3DRenderer } from './Scene3DRenderer.js';
import type { Point, Wall, Roof, Column } from './types.js';

// MaterialsSheet ainda não foi migrado pra TypeScript (é o próximo da
// fila) — declarado como global ambiente nesse meio-tempo.
declare const MaterialsSheet: { open: () => void };

let bodyEl: HTMLElement | null, panelEl: HTMLElement | null;

function fmtM(v: number): string { return v.toFixed(2).replace('.', ',') + ' m'; }
function fmtM2(v: number): string { return v.toFixed(2).replace('.', ',') + ' m²'; }
function fmtBRL(v: number): string { return 'R$ ' + v.toFixed(2).replace('.', ','); }

function polygonPerimeterMeters(points: Point[]): number {
  let per = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!, p2 = points[(i + 1) % points.length]!;
    per += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return per / Core.GRID;
}

// Conta pontos de encontro de parede distintos (cantos, T, encontro em X,
// pontas soltas) usando a MESMA tolerância de coincidência que o resto
// do app usa pra decidir "isso é o mesmo ponto" (Core.COINCIDENCE_TOL) —
// cada um vira um pilarete na estimativa de estrutura. Unidades de
// entrada em unidades de MODELO (raw), não metros — mesma convenção de
// w.x1/w.y1.
function countWallJunctions(walls: Wall[]): number {
  const nodes: Point[] = [];
  function mark(x: number, y: number) {
    for (let i = 0; i < nodes.length; i++) {
      if (Math.hypot(nodes[i]!.x - x, nodes[i]!.y - y) <= Core.COINCIDENCE_TOL) return;
    }
    nodes.push({ x, y });
  }
  walls.forEach(function (w) {
    mark(w.x1, w.y1);
    mark(w.x2, w.y2);
  });
  return nodes.length;
}

function addTo(map: Record<string, number>, key: string, value: number): void {
  map[key] = (map[key] || 0) + value;
}

// Área REAL da água do telhado (a que a telha de fato cobre) — footprint
// ESTENDIDO pelos mesmos beirais (ROOF_OVERHANG/RAKE_OVERHANG) que o
// renderer 3D usa, dividido por cos(inclinação). Dedução: pra duasAguas e
// quatroAguas, a soma das águas sempre equivale a
// footprint_estendido/cos(pitch) — as pontas em rincão/espigão de um
// lado "roubam" exatamente a área que as tacaniças do outro lado
// "devolvem", a soma não muda. umaAgua é uma única água cobrindo o
// footprint estendido inteiro no mesmo ângulo, mesma fórmula. platibanda
// é laje plana sem beiral — ignora pitchDeg e overhangs.
function roofAreaMeters(roof: Roof): number {
  const widthM = Math.abs(roof.x2 - roof.x1) / Core.GRID;
  const depthM = Math.abs(roof.y2 - roof.y1) / Core.GRID;
  if (roof.type === 'platibanda') return widthM * depthM;

  const pitchRad = (roof.pitchDeg || 0) * Math.PI / 180;
  const ridgeAlongX = roof.ridgeAxis === 'x';
  const eave = Scene3DRenderer.ROOF_OVERHANG_GETTER();
  const rake = Scene3DRenderer.RAKE_OVERHANG_GETTER();

  let extWidth: number, extDepth: number;
  if (roof.type === 'quatroAguas') {
    // Quatro águas: beiral igual (ROOF_OVERHANG) nos dois eixos — não
    // tem oitão/rake, então não existe overhang "estreito".
    extWidth = widthM + 2 * eave;
    extDepth = depthM + 2 * eave;
  } else if (ridgeAlongX) {
    // duasAguas/umaAgua com cumeeira/caimento correndo no eixo X: a
    // largura (X) é a direção do oitão/rake; a profundidade (Z) é a
    // direção do beiral de goteira.
    extWidth = widthM + 2 * rake;
    extDepth = depthM + 2 * eave;
  } else {
    extWidth = widthM + 2 * eave;
    extDepth = depthM + 2 * rake;
  }
  return (extWidth * extDepth) / Math.cos(pitchRad);
}

// Volume estruturral de uma coluna (pilar), em m³ — lado/diâmetro fixo
// (Core.COLUMN_SIZE) vezes a altura do pé-direito do pavimento.
function columnVolumeM3(col: Column, wallHeight: number): number {
  const sizeM = Core.COLUMN_SIZE / Core.GRID;
  if (col.shape === 'redonda') {
    const r = sizeM / 2;
    return Math.PI * r * r * wallHeight;
  }
  return sizeM * sizeM * wallHeight;
}

// ---------------------------------------------------------------
// REFERÊNCIA ESTRUTURAL — taxa de aço por m³ de concreto, regra clássica
// de pré-dimensionamento ("Números Mágicos das Estruturas de Concreto",
// uso corrente no meio acadêmico/profissional de engenharia estrutural
// no Brasil, também refletido nas composições SINAPI de armação de
// pilar/viga vs. armação de baldrame/sapata):
//   - Superestrutura (vigas e pilares, acima do solo): ~100 kg/m³
//   - Infraestrutura (baldrame/radier, sobre solo): ~70 kg/m³
// São TAXAS MÉDIAS de pré-dimensionamento, não substituem o cálculo de
// um projeto estrutural (que define a bitola e quantidade real de
// ferragem por peça) — servem pra estimativa de compra antes de haver
// projeto estrutural fechado.
const STEEL_RATE_SUPERSTRUCTURE_KG_M3 = 100;
const STEEL_RATE_FOUNDATION_KG_M3 = 70;

// Pilaretes embutidos na alvenaria e viga de cinta/amarração no topo da
// parede: o modelo NÃO tem essas peças desenhadas (só as Colunas que o
// usuário posiciona manualmente com a ferramenta de coluna) — por isso,
// aqui, a quantidade é uma ESTIMATIVA a partir da própria geometria das
// paredes, seguindo a regra de bolso mais comum na construção
// residencial brasileira: pilarete de amarração em todo canto/encontro
// de parede, e nenhum trecho reto maior que ~3m sem pilarete
// intermediário (evita fissuração/flambagem da alvenaria). Isso não
// substitui projeto estrutural: pé-direito alto, parede sem amarração no
// cômodo vizinho ou vão de porta/janela grande podem exigir pilar em vão
// menor que 3m — sempre confirmar com calculista.
const COLUMN_MAX_SPAN_M = 3.0;
const COLUMN_SECTION_M = 0.15; // pilarete 15x15cm — seção mínima usual
const BEAM_HEIGHT_M = 0.10;    // altura usual de cinta de amarração/respaldo

// ---------------------------------------------------------------
// REFERÊNCIA DE ALVENARIA — SINAPI (Sistema Nacional de Pesquisa de
// Custos e Índices da Construção Civil, mantido pela Caixa Econômica
// Federal e IBGE; https://www.caixa.gov.br/poder-publico/modernizacao-
// gestao/sinapi). É a fonte oficial e gratuita usada por órgãos públicos
// brasileiros pra orçar obra — publica planilhas mensais, por estado,
// com o consumo de cada insumo (bloco, cimento, cal, areia, mão de obra)
// por m² de cada serviço. TCPO (PINI) é a referência paga equivalente,
// usada por construtoras privadas.
//
// Valores abaixo: alvenaria de vedação em bloco cerâmico furado
// 9x19x19cm (meia-vez, ~9cm de espessura), argamassa de assentamento
// traço 1:2:8 (cimento:cal:areia em volume), preparo manual —
// composições SINAPI 103332/103351/103359 (blocos) e 87292/88629
// (argamassa traço 1:2:8).
//   - Blocos: ~25 un/m² de parede
//   - Argamassa: ~0,01 m³/m² (rendimento SINAPI: 1 m³ argamassa / 100 m² parede)
//   - Por m³ de argamassa: 185,63 kg cimento · 193,7 kg cal hidratada · 1,29 m³ areia média
// Isso é um valor de REFERÊNCIA NACIONAL, não o traço de um projeto
// específico — bloco, traço e perdas variam por região e por projeto
// estrutural. Enquanto a entidade Parede não guarda qual alvenaria ela
// usa (ver limitação discutida antes), esse único traço é aplicado a
// TODA parede do projeto como estimativa.
const MASONRY_REF = {
  blocksPerM2: 25,
  mortarM3PerM2: 0.01,
  cementKgPerM3: 185.63,
  calKgPerM3: 193.7,
  sandM3PerM3: 1.29,
  // Perda mínima recomendada pelo SINAPI pra obra controlada — sobe pra
  // 15% em obra convencional e até 25% em obra com muito recorte.
  wasteFactor: 1.10
};

interface Totals {
  wallLength: number; wallAreaNet: number; floorArea: number; baseboard: number; roofArea: number;
  doors: number; windows: number; columnCount: number; columnVolume: number; estimatedColumnCount: number;
}
interface Masonry { blocks: number; mortarM3: number; cementKg: number; calKg: number; sandM3: number; }
interface Structure {
  pilareteCount: number; pilareteVolume: number; pilareteSteelKg: number;
  beamLength: number; beamVolume: number; beamSteelKg: number;
}
interface FoundationBaldrame { type: 'baldrame'; length: number; concreteVolume: number; steelKg: number; }
interface FoundationRadier { type: 'radier'; areaM2: number; concreteVolume: number; steelKg: number; }
type Foundation = FoundationBaldrame | FoundationRadier | null;
interface ComputeResult {
  totals: Totals; paint: Record<string, number>; floorTile: Record<string, number>; roofTile: Record<string, number>;
  masonry: Masonry; structure: Structure; foundation: Foundation;
}

// Percorre TODOS os pavimentos — a lista é do projeto inteiro, não só do
// pavimento em edição (senão trocar de aba faria a lista "sumir" com o
// que já foi construído embaixo).
export function compute(): ComputeResult {
  const project = Store.getProject();
  const wallHeight = Scene3DRenderer.WALL_HEIGHT_GETTER();
  const totals: Totals = {
    wallLength: 0, wallAreaNet: 0, floorArea: 0, baseboard: 0, roofArea: 0,
    doors: 0, windows: 0, columnCount: 0, columnVolume: 0, estimatedColumnCount: 0
  };
  const paint: Record<string, number> = {}, floorTile: Record<string, number> = {}, roofTile: Record<string, number> = {};

  project.floors.forEach(function (floor) {
    // Paredes: comprimento total + área a pintar (por face, descontando
    // a área das aberturas que atravessam a parede) + área líquida (uma
    // vez só, não por face — é a base do cálculo de alvenaria).
    floor.walls.forEach(function (w) {
      const lenM = Core.wallLengthMeters(w);
      totals.wallLength += lenM;
      let openingsArea = 0;
      floor.openings.forEach(function (op) {
        if (op.wallId === w.id) openingsArea += op.width * op.height;
      });
      const faceArea = Math.max(0, lenM * wallHeight - openingsArea);
      totals.wallAreaNet += faceArea;
      if (w.finishA) addTo(paint, w.finishA, faceArea);
      if (w.finishB) addTo(paint, w.finishB, faceArea);
    });

    // Portas e janelas.
    floor.openings.forEach(function (op) {
      if (op.kind === 'door') totals.doors++; else totals.windows++;
    });

    // Cômodos fechados: área de piso + comprimento de rodapé, e piso
    // agrupado por produto usando a MESMA assinatura de parede (roomKey)
    // que o renderer 3D já usa pra achar o acabamento do cômodo.
    const rooms = Core.detectRooms(floor.walls);
    rooms.forEach(function (room) {
      const areaM2 = room.area / (Core.GRID * Core.GRID);
      totals.floorArea += areaM2;
      totals.baseboard += polygonPerimeterMeters(room.points);
      const roomKey = Core.findRoomWallIds(floor.walls, room).slice().sort().join(',');
      const finishId = (floor.roomFinishes || {})[roomKey];
      if (finishId) addTo(floorTile, finishId, areaM2);
    });

    // Telhado: área REAL da água (considerando a inclinação de cada
    // telhado, não só a projeção horizontal — ver roofAreaMeters).
    (floor.roofs || []).forEach(function (roof) {
      const areaM2 = roofAreaMeters(roof);
      totals.roofArea += areaM2;
      if (roof.finishProductId) addTo(roofTile, roof.finishProductId, areaM2);
    });

    // Estrutura: colunas (pilares) — quantidade e volume de
    // concreto/madeira estimado a partir da seção fixa (Core.COLUMN_SIZE)
    // e do pé-direito do pavimento.
    (floor.columns || []).forEach(function (col) {
      totals.columnCount++;
      totals.columnVolume += columnVolumeM3(col, wallHeight);
    });

    // Pilaretes ESTIMADOS embutidos na alvenaria (ver comentário em
    // COLUMN_MAX_SPAN_M) — um em cada encontro de parede detectado, mais
    // um a cada vão reto que passe de 3m sem encontro nenhum.
    const junctions = countWallJunctions(floor.walls);
    let extraSpanColumns = 0;
    floor.walls.forEach(function (w) {
      const lenM = Core.wallLengthMeters(w);
      extraSpanColumns += Math.floor(lenM / COLUMN_MAX_SPAN_M);
    });
    totals.estimatedColumnCount += junctions + extraSpanColumns;
  });

  // Alvenaria — derivada da área líquida de parede, aplicando os índices
  // SINAPI de referência (ver MASONRY_REF) e a perda mínima recomendada.
  // Tudo em cima do total já calculado acima — nenhuma medição nova, só
  // conversão de m² pra insumo de obra.
  const masonryAreaWithWaste = totals.wallAreaNet * MASONRY_REF.wasteFactor;
  const mortarM3 = masonryAreaWithWaste * MASONRY_REF.mortarM3PerM2;
  const masonry: Masonry = {
    blocks: Math.ceil(masonryAreaWithWaste * MASONRY_REF.blocksPerM2),
    mortarM3: mortarM3,
    cementKg: mortarM3 * MASONRY_REF.cementKgPerM3,
    calKg: mortarM3 * MASONRY_REF.calKgPerM3,
    sandM3: mortarM3 * MASONRY_REF.sandM3PerM3
  };

  // Pilaretes estimados: concreto (seção fixa × pé-direito) + aço pela
  // taxa de superestrutura. Viga de cinta/amarração: acompanha TODO o
  // comprimento de parede já somado (totals.wallLength), seção
  // espessura-da-parede × BEAM_HEIGHT_M.
  const pilareteVolume = totals.estimatedColumnCount * COLUMN_SECTION_M * COLUMN_SECTION_M * wallHeight;
  const beamVolume = totals.wallLength * Core.WALL_THICK * BEAM_HEIGHT_M;
  const structure: Structure = {
    pilareteCount: totals.estimatedColumnCount,
    pilareteVolume: pilareteVolume,
    pilareteSteelKg: pilareteVolume * STEEL_RATE_SUPERSTRUCTURE_KG_M3,
    beamLength: totals.wallLength,
    beamVolume: beamVolume,
    beamSteelKg: beamVolume * STEEL_RATE_SUPERSTRUCTURE_KG_M3
  };

  // Fundação — só o TÉRREO (project.floors[0]), igual o renderer 3D já
  // faz (buildFoundation recebe só o pavimento 0). Radier: laje sobre a
  // área dos cômodos + margem que sai da parede pra fora (RADIER_MARGIN)
  // — aproximando o acréscimo de área da margem por perímetro × margem.
  // Baldrame: viga corrida por baixo de TODA parede do térreo
  // (comprimento de parede, sem duplicar as internas — mais preciso que
  // a malha 3D, que desenha um quadro por cômodo e sobrepõe nas paredes
  // compartilhadas).
  const groundFloor = project.floors[0];
  let foundation: Foundation = null;
  if (groundFloor) {
    let groundWallLength = 0, groundPerimeter = 0, groundAreaM2 = 0;
    groundFloor.walls.forEach(function (w) { groundWallLength += Core.wallLengthMeters(w); });
    const groundRooms = Core.detectRooms(groundFloor.walls);
    groundRooms.forEach(function (room) {
      groundAreaM2 += room.area / (Core.GRID * Core.GRID);
      groundPerimeter += polygonPerimeterMeters(room.points);
    });
    if (groundAreaM2 > 0 || groundWallLength > 0) {
      if (project.foundationType === 'baldrame') {
        const baldrameWidth = Scene3DRenderer.BALDRAME_WIDTH_GETTER();
        const baldrameThickness = Scene3DRenderer.BALDRAME_THICKNESS_GETTER();
        const baldrameVolume = groundWallLength * baldrameWidth * baldrameThickness;
        foundation = {
          type: 'baldrame',
          length: groundWallLength,
          concreteVolume: baldrameVolume,
          steelKg: baldrameVolume * STEEL_RATE_FOUNDATION_KG_M3
        };
      } else {
        const radierMargin = Scene3DRenderer.RADIER_MARGIN_GETTER();
        const radierThickness = Scene3DRenderer.RADIER_THICKNESS_GETTER();
        const radierAreaM2 = groundAreaM2 + groundPerimeter * radierMargin;
        const radierVolume = radierAreaM2 * radierThickness;
        foundation = {
          type: 'radier',
          areaM2: radierAreaM2,
          concreteVolume: radierVolume,
          steelKg: radierVolume * STEEL_RATE_FOUNDATION_KG_M3
        };
      }
    }
  }

  return { totals, paint, floorTile, roofTile, masonry, structure, foundation };
}

function productLine(productId: string, areaM2: number): string {
  const p = Catalog.getProduct(productId);
  const name = p ? p.name : productId;
  let extra = '';
  // Peças estimadas quando o produto informa a metragem coberta por
  // peça (hoje só os materiais de teste PBR de telha/tabeira têm
  // tileMeters — ver comentário no Catalog).
  if (p && p.assets && p.assets.tileMeters) {
    extra = ' &middot; ~' + Math.ceil(areaM2 / p.assets.tileMeters) + ' peças';
  }
  return '<div class="materials-line"><span>' + name + '</span><span>' + fmtM2(areaM2) + extra + '</span></div>';
}

function groupSection(title: string, map: Record<string, number>): string {
  const keys = Object.keys(map);
  if (!keys.length) return '';
  let html = '<div class="object-panel-section-label">' + title + '</div>';
  keys.forEach(function (id) { html += productLine(id, map[id]!); });
  return html;
}

export function render(): void {
  if (!bodyEl) return;
  const q = compute();
  let html = '';
  html += '<div class="object-panel-section-label">Quantitativos gerais</div>';
  html += '<div class="materials-line"><span>Paredes</span><span>' + fmtM(q.totals.wallLength) + '</span></div>';
  html += '<div class="materials-line"><span>Piso</span><span>' + fmtM2(q.totals.floorArea) + '</span></div>';
  html += '<div class="materials-line"><span>Rodapé</span><span>' + fmtM(q.totals.baseboard) + '</span></div>';
  html += '<div class="materials-line"><span>Telhado (área real da água)</span><span>' + fmtM2(q.totals.roofArea) + '</span></div>';
  html += '<div class="materials-line"><span>Portas</span><span>' + q.totals.doors + ' un.</span></div>';
  html += '<div class="materials-line"><span>Janelas</span><span>' + q.totals.windows + ' un.</span></div>';
  if (q.foundation) {
    const f = q.foundation;
    html += '<div class="object-panel-section-label">Fundação (' + (f.type === 'baldrame' ? 'baldrame' : 'radier') + ' — ref. taxa de aço 70 kg/m³)</div>';
    if (f.type === 'baldrame') {
      html += '<div class="materials-line"><span>Viga baldrame</span><span>' + fmtM(f.length) + '</span></div>';
    } else {
      html += '<div class="materials-line"><span>Área da laje</span><span>' + fmtM2(f.areaM2) + '</span></div>';
    }
    html += '<div class="materials-line"><span>Concreto</span><span>' + f.concreteVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
    html += '<div class="materials-line"><span>Aço (estimado)</span><span>' + f.steelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
  }
  if (q.totals.columnCount > 0 || q.structure.pilareteCount > 0) {
    html += '<div class="object-panel-section-label">Estrutura</div>';
    if (q.totals.columnCount > 0) {
      html += '<div class="materials-line"><span>Colunas (posicionadas)</span><span>' + q.totals.columnCount + ' un.</span></div>';
      html += '<div class="materials-line"><span>Volume de colunas</span><span>' + q.totals.columnVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
    }
    if (q.structure.pilareteCount > 0) {
      html += '<div class="materials-line"><span>Pilaretes em parede (estimado, vão ≤ 3m)</span><span>' + q.structure.pilareteCount + ' un.</span></div>';
      html += '<div class="materials-line"><span>Concreto — pilaretes</span><span>' + q.structure.pilareteVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
      html += '<div class="materials-line"><span>Aço — pilaretes</span><span>' + q.structure.pilareteSteelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
      html += '<div class="materials-line"><span>Viga de cinta/amarração</span><span>' + fmtM(q.structure.beamLength) + '</span></div>';
      html += '<div class="materials-line"><span>Concreto — cinta</span><span>' + q.structure.beamVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
      html += '<div class="materials-line"><span>Aço — cinta</span><span>' + q.structure.beamSteelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
    }
  }
  if (q.totals.wallAreaNet > 0) {
    html += '<div class="object-panel-section-label">Alvenaria (ref. SINAPI — bloco 9x19x19, traço 1:2:8, com 10% de perda)</div>';
    html += '<div class="materials-line"><span>Blocos/tijolos</span><span>' + q.masonry.blocks + ' un.</span></div>';
    html += '<div class="materials-line"><span>Argamassa de assentamento</span><span>' + q.masonry.mortarM3.toFixed(3).replace('.', ',') + ' m³</span></div>';
    html += '<div class="materials-line"><span>Cimento</span><span>' + q.masonry.cementKg.toFixed(1).replace('.', ',') + ' kg (~' + Math.ceil(q.masonry.cementKg / 50) + ' sacos 50kg)</span></div>';
    html += '<div class="materials-line"><span>Cal hidratada</span><span>' + q.masonry.calKg.toFixed(1).replace('.', ',') + ' kg (~' + Math.ceil(q.masonry.calKg / 20) + ' sacos 20kg)</span></div>';
    html += '<div class="materials-line"><span>Areia média</span><span>' + q.masonry.sandM3.toFixed(2).replace('.', ',') + ' m³</span></div>';
  }
  html += groupSection('Pintura — por acabamento', q.paint);
  html += groupSection('Piso — por acabamento', q.floorTile);
  html += groupSection('Telhado — por acabamento', q.roofTile);
  // Só o TOTAL aqui (o painel é pra leitura rápida) — o detalhe de preço
  // por item fica na planilha (🗂️), pra não virar uma segunda lista
  // inteira dentro do painel pequeno.
  const allRows = buildRows();
  const totalRow = allRows.length && allRows[allRows.length - 1]![0] === 'TOTAL' ? allRows[allRows.length - 1]! : null;
  if (totalRow) {
    html += '<div class="object-panel-section-label">Custo</div>';
    html += '<div class="materials-line"><span>Estimado (preço médio de referência)</span><span>' + totalRow[5] + '</span></div>';
  }
  bodyEl.innerHTML = html;
}

// ---------------------------------------------------------------
// REFERÊNCIA DE PREÇO MÉDIO — pesquisa de mercado nacional (Calculobra,
// SINAPI, Lar Pontual Engenharia — jun/jul 2026). São MÉDIAS NACIONAIS,
// variam bastante por região/fornecedor — servem pra dar uma ORDEM DE
// GRANDEZA do custo, não uma cotação real. Sempre que o material tem
// produto no Catalog (tinta, piso, telha), o preço vem do próprio
// produto (commercial.price) — essa referência genérica só cobre o que
// ainda não é produto (cimento, cal, areia, bloco, concreto, aço).
const REFERENCE_PRICES = {
  cementPerKg: 0.75,     // saco 50kg ~R$35-40 média nacional
  limePerKg: 0.95,       // saco 20kg ~R$16-22
  sandPerM3: 130,        // areia média ~R$100-160/m³
  concretePerM3: 450,    // concreto usinado, fck 20-25MPa, ~R$330-680/m³
  steelPerKg: 8.00,      // aço CA-50, referência de mercado
  brickPerUnit: 1.20     // bloco cerâmico 9x19x19, referência de mercado
};
// Rendimento de referência pra converter área de parede em latas de
// tinta (o Catalog vende tinta por lata, não por m² — não existe ainda
// um campo "rendimento" no produto, então uso uma referência de bula
// típica: ~11 m²/L por demão, 2 demãos).
const PAINT_COATS = 2;
const PAINT_YIELD_M2_PER_CAN_PER_COAT = 200;

// Custo de um produto do Catalog pra uma área/quantidade — lê o preço e
// a unidade comercial DO PRÓPRIO PRODUTO (commercial.price/unit), nunca
// um valor solto aqui. Retorna null quando não dá pra converter (unidade
// comercial desconhecida).
function productUnitCost(productId: string, areaM2: number): number | null {
  const p = Catalog.getProduct(productId);
  if (!p || !p.commercial || p.commercial.price == null) return null;
  const price = p.commercial.price;
  if (p.commercial.unit === 'm2') return areaM2 * price;
  if (p.commercial.unit === 'peca' && p.assets && p.assets.tileMeters) {
    return Math.ceil(areaM2 / p.assets.tileMeters) * price;
  }
  if (p.commercial.unit === 'lata_18L') {
    const latas = Math.ceil((areaM2 * PAINT_COATS) / PAINT_YIELD_M2_PER_CAN_PER_COAT);
    return latas * price;
  }
  return null;
}

// Linhas ELEMENTO A ELEMENTO (uma por parede, um por cômodo, uma por
// abertura...), em vez de agregado por categoria — é o que permite
// AFERIR: conferir uma medida específica do desenho (ex.: "Parede 7,
// 4,20 m") contra a régua/planta, em vez de só ver o total somado. Soma
// de todas as linhas "Parede N" == a linha agregada "Paredes" do
// buildRows() — é o mesmo Core.wallLengthMeters chamado nos dois
// lugares, então as duas visões nunca podem divergir.
export function buildDetailRows(): (string | number)[][] {
  const project = Store.getProject();
  const rows: (string | number)[][] = [];
  project.floors.forEach(function (floor, floorIdx) {
    const label = floor.name || ('Pavimento ' + (floorIdx + 1));
    floor.walls.forEach(function (w, i) {
      rows.push([label, 'Parede ' + (i + 1) + ' — id ' + w.id, Core.wallLengthMeters(w).toFixed(2), 'm']);
    });
    const rooms = Core.detectRooms(floor.walls);
    rooms.forEach(function (room, i) {
      const areaM2 = room.area / (Core.GRID * Core.GRID);
      rows.push([label, 'Cômodo ' + (i + 1), areaM2.toFixed(2), 'm²']);
    });
    floor.openings.forEach(function (op, i) {
      const kindLabel = op.kind === 'door' ? 'Porta' : 'Janela';
      rows.push([label, kindLabel + ' ' + (i + 1) + ' (' + op.width.toFixed(2) + '×' + op.height.toFixed(2) + 'm)', 1, 'un']);
    });
    (floor.roofs || []).forEach(function (r, i) {
      rows.push([label, 'Telhado ' + (i + 1) + ' (' + r.type + ')', roofAreaMeters(r).toFixed(2), 'm²']);
    });
    (floor.columns || []).forEach(function (c, i) {
      rows.push([label, 'Coluna ' + (i + 1) + ' (' + c.shape + ')', 1, 'un']);
    });
  });
  return rows;
}

// Linhas [categoria, item, quantidade, unidade, preço médio, custo
// estimado] — fonte única usada tanto pelo .csv quanto pela planilha em
// página separada (ver MaterialsSheet mais abaixo), pra nunca existir
// duas versões da mesma lista que podem dessincronizar. Preço/custo vêm
// de productUnitCost() (produto real do Catalog) ou de REFERENCE_PRICES
// (insumo genérico, sem produto ainda) — linhas sem base de preço
// mostram '—' em vez de inventar um número.
export function buildRows(): (string | number)[][] {
  const q = compute();
  const rows: (string | number)[][] = [];
  let grandTotal = 0;
  let hasCost = false;

  function push(cat: string, item: string, qtyNum: number | string, unit: string, cost: number | null) {
    const qtyDisplay = typeof qtyNum === 'number' ? qtyNum.toFixed(qtyNum % 1 === 0 ? 0 : 2) : qtyNum;
    const avgPrice = (cost != null && typeof qtyNum === 'number' && qtyNum > 0) ? cost / qtyNum : null;
    if (cost != null) { grandTotal += cost; hasCost = true; }
    rows.push([cat, item, qtyDisplay, unit, avgPrice != null ? fmtBRL(avgPrice) : '—', cost != null ? fmtBRL(cost) : '—']);
  }

  push('Geral', 'Paredes (comprimento)', q.totals.wallLength, 'm', null);
  push('Geral', 'Piso (área)', q.totals.floorArea, 'm²', null);
  push('Geral', 'Rodapé (comprimento)', q.totals.baseboard, 'm', null);
  push('Geral', 'Telhado (área real da água)', q.totals.roofArea, 'm²', null);
  push('Geral', 'Portas', q.totals.doors, 'un', null);
  push('Geral', 'Janelas', q.totals.windows, 'un', null);
  if (q.foundation) {
    const f = q.foundation;
    const fLabel = 'Fundação (' + f.type + ')';
    if (f.type === 'baldrame') push(fLabel, 'Viga baldrame (comprimento)', f.length, 'm', null);
    else push(fLabel, 'Área da laje', f.areaM2, 'm²', null);
    push(fLabel, 'Concreto', f.concreteVolume, 'm³', f.concreteVolume * REFERENCE_PRICES.concretePerM3);
    push(fLabel, 'Aço (estimado)', f.steelKg, 'kg', f.steelKg * REFERENCE_PRICES.steelPerKg);
  }
  if (q.totals.columnCount > 0) {
    push('Estrutura', 'Colunas (posicionadas)', q.totals.columnCount, 'un', null);
    push('Estrutura', 'Volume de colunas', q.totals.columnVolume, 'm³', q.totals.columnVolume * REFERENCE_PRICES.concretePerM3);
  }
  if (q.structure.pilareteCount > 0) {
    push('Estrutura', 'Pilaretes em parede (estimado)', q.structure.pilareteCount, 'un', null);
    push('Estrutura', 'Concreto — pilaretes', q.structure.pilareteVolume, 'm³', q.structure.pilareteVolume * REFERENCE_PRICES.concretePerM3);
    push('Estrutura', 'Aço — pilaretes', q.structure.pilareteSteelKg, 'kg', q.structure.pilareteSteelKg * REFERENCE_PRICES.steelPerKg);
    push('Estrutura', 'Viga de cinta/amarração (comprimento)', q.structure.beamLength, 'm', null);
    push('Estrutura', 'Concreto — cinta', q.structure.beamVolume, 'm³', q.structure.beamVolume * REFERENCE_PRICES.concretePerM3);
    push('Estrutura', 'Aço — cinta', q.structure.beamSteelKg, 'kg', q.structure.beamSteelKg * REFERENCE_PRICES.steelPerKg);
  }
  if (q.totals.wallAreaNet > 0) {
    push('Alvenaria (ref. SINAPI)', 'Blocos/tijolos', q.masonry.blocks, 'un', q.masonry.blocks * REFERENCE_PRICES.brickPerUnit);
    push('Alvenaria (ref. SINAPI)', 'Argamassa de assentamento', q.masonry.mortarM3, 'm³', null);
    push('Alvenaria (ref. SINAPI)', 'Cimento', q.masonry.cementKg, 'kg', q.masonry.cementKg * REFERENCE_PRICES.cementPerKg);
    push('Alvenaria (ref. SINAPI)', 'Cal hidratada', q.masonry.calKg, 'kg', q.masonry.calKg * REFERENCE_PRICES.limePerKg);
    push('Alvenaria (ref. SINAPI)', 'Areia média', q.masonry.sandM3, 'm³', q.masonry.sandM3 * REFERENCE_PRICES.sandPerM3);
  }
  function addProductRows(category: string, map: Record<string, number>) {
    Object.keys(map).forEach(function (id) {
      const p = Catalog.getProduct(id);
      const areaM2 = map[id]!;
      push(category, p ? p.name : id, areaM2, 'm²', productUnitCost(id, areaM2));
    });
  }
  addProductRows('Pintura', q.paint);
  addProductRows('Piso', q.floorTile);
  addProductRows('Telhado', q.roofTile);

  if (hasCost) rows.push(['TOTAL', 'Custo estimado (soma dos itens com preço)', '', '', '', fmtBRL(grandTotal)]);
  return rows;
}

// Exporta a MESMA leitura que está na tela (buildRows() de novo, não
// guarda estado à parte) como um .csv que o usuário pode abrir no
// Excel/Sheets, imprimir ou levar pra loja/orçamentista — é o "Lista de
// materiais" do Documento de Visão virando arquivo de verdade, primeiro
// passo antes de existir Orçamento automático.
function buildCsv(): string {
  const rows = [['Categoria', 'Item', 'Quantidade', 'Unidade', 'Preço médio', 'Custo estimado']].concat(buildRows() as string[][]);
  return rows.map(function (r) {
    return r.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n');
}

function exportCsv(): void {
  const csv = '\uFEFF' + buildCsv(); // BOM — acentuação correta ao abrir no Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lista-de-materiais.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function init(): void {
  panelEl = document.getElementById('materialsPanel');
  bodyEl = document.getElementById('materialsPanelBody');
  const toggleBtn = document.getElementById('materialsToggleBtn');
  const closeBtn = document.getElementById('materialsPanelClose');
  const exportBtn = document.getElementById('materialsExportBtn');
  const sheetBtn = document.getElementById('materialsSheetBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportCsv);
  if (sheetBtn) sheetBtn.addEventListener('click', function () { MaterialsSheet.open(); });
  if (toggleBtn) toggleBtn.addEventListener('click', function () {
    panelEl!.classList.toggle('visible');
    if (panelEl!.classList.contains('visible')) render();
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { panelEl!.classList.remove('visible'); });
  render();
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const MaterialsPanel = { init, refresh: render, buildRows, buildDetailRows, compute };
