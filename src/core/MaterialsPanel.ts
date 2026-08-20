// MaterialsPanel — quantitativo de materiais e estimativa de custo,
// calculado a partir do projeto inteiro (todos os pavimentos). Migrado
// de `var MaterialsPanel = (function(){...})()` no index.html monolítico
// original (ver legacy/index-monolito-original.html, linhas 6312-6885).

import { Core } from './Core.js';
import { Store } from './Store.js';
import { Catalog } from './Catalog.js';
import { Scene3DRenderer } from './Scene3DRenderer.js';
import { MaterialsSheet } from './MaterialsSheet.js';
import {
  computeFoundationQuantity,
  gableAreaMeters as calculateGableAreaMeters,
  roofAreaMeters as calculateRoofAreaMeters,
  roofNetAreas as calculateRoofNetAreas,
  umaAguaBackWallAreaMeters as calculateUmaAguaBackWallAreaMeters,
} from './QuantityGeometry.js';
import type { FoundationQuantity } from './QuantityGeometry.js';
import type { Point, Wall, Roof, Column, Laje, Project } from './types.js';
import { constructionSystemDefinition, hasCeramicMasonryEstimate } from './ConstructionSystem.js';
import { floorWallHeight } from './Attic.js';
import { listCatalogProducts, listManufacturers } from './SupabaseClient.js';
import { classifyHydraulicJunction, destinationLabelForNetwork } from './Hydraulics.js';
import type { HydraulicNetworkType, HydraulicNode, HydraulicSegment } from './types.js';

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
  return calculateRoofAreaMeters(roof, roofQuantityConfig());
}

function roofNetAreas(roofs: Roof[]): Record<string, number> {
  return calculateRoofNetAreas(roofs, roofQuantityConfig());
}

function roofQuantityConfig() {
  return {
    grid: Core.GRID,
    roofOverhang: Scene3DRenderer.ROOF_OVERHANG_GETTER(),
    rakeOverhang: Scene3DRenderer.RAKE_OVERHANG_GETTER(),
  };
}

function gableAreaMeters(roof: Roof): number {
  return calculateGableAreaMeters(roof, roofQuantityConfig());
}

function umaAguaBackWallAreaMeters(roof: Roof): number {
  return calculateUmaAguaBackWallAreaMeters(roof, roofQuantityConfig());
}

// Altura real do parapeito da platibanda (muretinha) — mesmo clamp do
// 3D (ver Scene3DRenderer.clampParapetHeight), lido pelos getters em
// vez de duplicar os 3 valores aqui soltos (mesma técnica de
// roofQuantityConfig acima). Auditoria pedida pelo Product Owner: a
// platibanda é geometria pura (Scene3DRenderer.buildParapetWalls), não
// uma Wall de verdade — sem isso, o loop de `floor.walls` nunca via
// essa alvenaria.
function clampParapetHeight(h: number | undefined): number {
  const min = Scene3DRenderer.PARAPET_HEIGHT_MIN_GETTER();
  const max = Scene3DRenderer.PARAPET_HEIGHT_MAX_GETTER();
  const def = Scene3DRenderer.PARAPET_HEIGHT_DEFAULT_GETTER();
  return Math.max(min, Math.min(max, h != null ? h : def));
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

// Área de uma Laje (elemento independente, arrastável — ver types.ts),
// em m² — mesma fórmula de área de polígono que Core.detectRooms usa
// pra cômodo (Core.polygonAreaModelUnits), só convertida de unidade de
// modelo pra m² (dividindo por GRID ao quadrado, mesma convenção de
// room.area em Core.ts).
function lajeAreaMeters(laje: Laje): number {
  return Math.abs(Core.polygonAreaModelUnits(laje.points)) / (Core.GRID * Core.GRID);
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
// Laje maciça (elemento independente, arrastável — ver types.ts Laje)
// tem taxa própria, um pouco abaixo da de viga/pilar: armação de laje é
// mais distribuída (malha), menos concentrada que viga/pilar — mesma
// família de referência ("Números Mágicos das Estruturas de Concreto"),
// mas com o valor mais baixo da faixa usual pra laje maciça. Decidido
// nesta sessão (ver Registro de Decisões Técnicas) — não é um consenso
// único na literatura, é uma escolha de pré-dimensionamento própria do
// Esboce, documentada aqui pra poder ser revista.
const STEEL_RATE_LAJE_KG_M3 = 90;

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
const BEAM_HEIGHT_M = 0.10;    // altura usual de cinta de amarração/respaldo — mesma seção reaproveitada pra verga (ver VERGA_BEARING_M)
// Verga — reforço acima de QUALQUER vão (porta, janela ou arco), pra
// redistribuir o peso da parede em volta do vazio. O renderer 3D não
// desenha uma peça própria pra isso (o "verga" que aparece nos
// comentários do Scene3DRenderer é só a faixa de parede/reboco que
// continua acima do vão, sem geometria estrutural própria) — então,
// diferente de pilarete/cinta, não existe nenhum valor 3D já desenhado
// pra reaproveitar; é uma estimativa nova, mesma família de regra de
// bolso. Regra usual de obra residencial: a verga ultrapassa o vão em
// pelo menos ~20cm de cada lado (apoio sobre a alvenaria), seção igual
// à cinta (espessura da parede × BEAM_HEIGHT_M). Se pé-direito baixo
// entre o topo do vão e o teto, "quanto sobra" fica fora do escopo
// desta estimativa; não substitui projeto estrutural.
const VERGA_BEARING_M = 0.20;

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

// ---------------------------------------------------------------
// REFERÊNCIA DE MADEIRAMENTO — SINAPI 92539 (TRAMA DE MADEIRA COMPOSTA
// POR RIPAS, CAIBROS E TERÇAS PARA TELHADOS DE ATÉ 2 ÁGUAS, TELHA
// CERÂMICA OU DE CONCRETO, INCLUSO TRANSPORTE VERTICAL — AF_10/2025).
// A composição documenta ESPAÇAMENTO e SEÇÃO de cada peça (não uma
// tabela pronta de "m³ por m²") — os metros lineares por m² abaixo são
// DERIVADOS do espaçamento (1 ÷ espaçamento), mesma lógica que
// qualquer orçamentista usaria com esses dados; volume vem de
// multiplicar cada comprimento pela seção transversal da peça.
//   - Ripa: seção 1,5×5,0cm, a cada 0,32m (galga pra telha cerâmica/concreto)
//   - Caibro: seção 5,0×6,0cm, a cada 0,55m
//   - Terça: seção 6,0×12,0cm, a cada 1,5–2,0m (usado o meio da faixa, 1,75m)
// Aplicado uniformemente a QUALQUER telhado com água (duasAguas,
// quatroAguas, umaAgua) — mesma simplificação já aceita pra alvenaria
// (traço único pra toda parede, ver MASONRY_REF): existe uma
// composição SINAPI própria pra "mais de 2 águas" (92542, espaçamento
// de caibro mais apertado), mas manter uma referência só evita
// multiplicar simplificações sem dado que realmente diferencie os
// casos no modelo atual (o Roof não guarda hoje se é telhado simples
// ou composto de verdade pra esse fim). Platibanda ENTRA também — na
// prática construtiva real (confirmado pelo Product Owner), o telhado
// "embutido" atrás do parapeito ainda é uma estrutura de madeira comum
// coberta com telha eternit/fibrocimento, não uma laje maciça exposta
// sem cobertura nenhuma (correção desta sessão — ver Registro de
// Decisões Técnicas, DEC-108).
// Tesoura (treliça, só necessária em vãos maiores — SINAPI tem
// composição própria, 92548, por peça e por vão) e frechal (a viga de
// apoio no topo da parede pro madeiramento — na prática, o mesmo papel
// estrutural que a viga de cinta já calculada em `structure` cumpre;
// somar um frechal à parte duplicaria essa peça, mesmo raciocínio já
// usado pra não somar viga própria de Laje) ficam FORA de escopo desta
// rodada — registrado como pendência no Registro de Decisões Técnicas.
// Preço de madeira serrada (R$/m³, ripa/caibro/terça tratada) —
// ver DEC-100 correção pós-lançamento nº2: preço médio de varejo
// (por metro linear, convertido pra m³ pela seção de cada peça),
// cadastrado como produto Vórtice Materiais (`woodPerM3`). Cada
// peça (Ripa/Caibro/Terça) tem seu próprio preço por UNIDADE,
// derivado da mesma taxa R$/m³ aplicada ao volume de UMA peça de
// WOOD_PIECE_LENGTH_M (bitola própria de cada uma) — sem duplicar
// custo entre uma visão "linha por peça" e uma "volume total"
// separada (pedido do Product Owner: madeira em peças de 3m, igual
// se compra na loja).
const ROOF_TIMBER_REF = {
  ripaSpacingM: 0.32, ripaSectionM2: 0.015 * 0.05,
  caibroSpacingM: 0.55, caibroSectionM2: 0.05 * 0.06,
  tercaSpacingM: 1.75, tercaSectionM2: 0.06 * 0.12,
  wasteFactor: 1.10
};
const WOOD_PIECE_LENGTH_M = 3;

// Consumo de prego do madeiramento (ripa+caibro+terça) — SINAPI 92539:
// prego 22x48 0,03kg + prego 19x36 0,05kg + prego 15x15 0,07kg, por m²
// de telhado (soma dos três tipos, tratados aqui como um único insumo
// "pregos" — o quantitativo não distingue bitola).
const ROOF_TIMBER_NAIL_KG_PER_M2 = 0.03 + 0.05 + 0.07;

// Traço 1:3 (cimento:areia), 3-5mm de espessura, aplicado sobre TODA
// alvenaria antes do reboco — consumo direto por m² (fonte: pesquisa de
// mercado/composições públicas de chapisco convencional, ago/2026).
const CHAPISCO_REF = { cementKgPerM2: 2.25, sandM3PerM2: 0.0053 };

// Reboco/emboço, traço 1:2:8 (mesmo traço já usado em MASONRY_REF pra
// assentamento — reaproveita os mesmos kg/m³ de cimento/cal e m³/m³ de
// areia), espessura padrão 2cm — volume = espessura × área, igual
// qualquer cálculo de argamassa/concreto por camada.
const REBOCO_THICKNESS_M = 0.02;

// Contrapiso, traço 1:4 (cimento:areia), espessura padrão 3cm — consumo
// direto por m² (fonte: pesquisa de mercado, ago/2026): 0,21 saco de
// cimento (50kg) e 0,033 m³ de areia por m², pra 3cm.
const CONTRAPISO_REF = { cementKgPerM2: 0.21 * 50, sandM3PerM2: 0.033 };

// Produtos-padrão de mercado usados quando o usuário NÃO escolhe
// acabamento nenhum no editor (piso/parede/telhado) — sem isso, a
// superfície ficava de fora do orçamento silenciosamente, mesmo
// problema já corrigido pros materiais de teste PBR (DEC-105). Cada um
// aponta pra um produto real do Catalog, preço pesquisado ago/2026.
const DEFAULT_PAINT_PRODUCT_ID = 'vortice.tinta.fosco-branco-gelo';
const DEFAULT_FLOOR_TILE_PRODUCT_ID = 'vortice.piso.porcelanato-padrao';
const DEFAULT_CERAMIC_TILE_PRODUCT_ID = 'vortice.telha.ceramica-natural';
const DEFAULT_ETERNIT_PRODUCT_ID = 'vortice.telha.eternit-6mm';

interface Totals {
  wallLength: number; wallAreaNet: number; floorArea: number; baseboard: number; roofArea: number;
  doors: number; windows: number; arcos: number; soleiraCount: number; soleiraLength: number;
  // Porta/janela de VIDRO (Opening.productId aponta um produto real do
  // catálogo) vira item por metro quadrado — convenção de mercado pra
  // esquadria de vidro/alumínio (pedido do Product Owner) — agrupada
  // por produto em `doorProducts`/`windowProducts` (mesmo padrão de
  // `paint`/`floorTile`/`roofTile`, ver addProductRows). Porta SEM
  // produto escolhido assume porta de madeira padrão (não existe
  // produto de porta de madeira no catálogo ainda) — por UNIDADE, não
  // m², porque uma porta de madeira pronta é vendida como peça inteira
  // de tamanho padrão, não por metro quadrado de vão. Janela sem
  // produto continua por m² genérico (não existe conceito de "janela
  // de madeira" no catálogo — toda janela aqui é esquadria de vidro).
  doorGenericCount: number; windowsGenericAreaM2: number;
  columnCount: number; columnVolume: number; estimatedColumnCount: number;
  lajeCount: number; lajeAreaM2: number;
  vergaCount: number; vergaSpanM: number;
  roofTimberAreaM2: number;
  // Peças que não tinham NENHUMA linha no quantitativo até esta versão
  // (auditoria pedida pelo Product Owner: "como podemos aferir se tudo
  // o que está sendo criado, está mesmo sendo quantificado e
  // orçado?") — Pele de vidro, Sacada de vidro e Varanda não têm
  // produto de catálogo próprio, então usam sempre a média de mercado
  // ESTIMATED_MARKET_PRICES. Bloco de Volumetria segue o mesmo padrão
  // fornecedor-real-primeiro de portas/janelas (productCost quando tem
  // finishProductId escolhido, genericAreaM2 caindo pra média quando
  // não tem). Móveis somam o preço do próprio produto do Catálogo
  // (Furniture.productId) — sem estimativa nova, é o preço já
  // cadastrado ali (hoje zerado nos móveis de exemplo).
  glazingPanelAreaM2: number;
  balconyRailingLengthM: number;
  varandaAreaM2: number;
  volumeBoxAreaM2: number; volumeBoxProductCost: number; volumeBoxGenericAreaM2: number;
  furnitureCount: number; furnitureCost: number;
}
interface Masonry { blocks: number; mortarM3: number; cementKg: number; calKg: number; sandM3: number; }
interface Structure {
  pilareteCount: number; pilareteVolume: number; pilareteSteelKg: number;
  beamLength: number; beamVolume: number; beamSteelKg: number;
  vergaCount: number; vergaVolume: number; vergaSteelKg: number;
}
interface LajeQuantities { count: number; areaM2: number; volumeM3: number; steelKg: number; }
interface RoofTimber { areaM2: number; ripaLinearM: number; caibroLinearM: number; tercaLinearM: number; volumeM3: number; }
// Esgoto de cozinha, esgoto sanitário e pluvial — cada um com seu ponto
// fixo próprio (caixa de gordura/inspeção/saída pluvial, ver
// Hydraulics.ts). Água fria fica de fora por ora (gap pré-existente,
// nenhum tipo de hidráulica era contado antes desta seção — resolver
// água fria também é tarefa maior, fora do pedido específico de esgoto
// e pluvial).
// Item por item — "01 joelho de PVC 50mm linha esgoto", pedido explícito
// do Product Owner pra lista dar pra levar direto na loja. `productLine`
// agrupa kitchen_sewer+sanitary_sewer (mesmo tubo/conexão de PVC linha
// esgoto — o preço de mercado não muda por causa de qual pia/vaso ele
// atende) separado de rainwater (linha pluvial, produto Aquapluv
// diferente).
type HydraulicProductLine = 'esgoto' | 'pluvial';
interface HydraulicPipeGroup { productLine: HydraulicProductLine; diameterMm: number; lengthM: number; bars: number; }
interface HydraulicFittingGroup { productLine: HydraulicProductLine; diameterMm: number; kind: 'elbow45' | 'elbow90' | 'tee' | 'cross'; count: number; }
interface HydraulicDestinationGroup { networkType: HydraulicNetworkType; label: string; count: number; }
interface HydraulicsQuantities {
  pipeGroups: HydraulicPipeGroup[];
  fittingGroups: HydraulicFittingGroup[];
  destinationGroups: HydraulicDestinationGroup[];
}
type Foundation = FoundationQuantity;
interface ComputeResult {
  totals: Totals; paint: Record<string, number>; floorTile: Record<string, number>; roofTile: Record<string, number>;
  doorProducts: Record<string, number>; windowProducts: Record<string, number>;
  masonry: Masonry; structure: Structure; foundation: Foundation; laje: LajeQuantities; roofTimber: RoofTimber;
  hydraulics: HydraulicsQuantities;
  constructionSystem: Project['constructionSystem'];
}

function computeFoundation(project: Project): Foundation {
  const groundFloor = project.floors[0];
  if (!groundFloor) return null;

  let groundWallLength = 0, groundPerimeter = 0, groundAreaM2 = 0;
  // Parede quebrada continua fechando o cômodo (entra em detectRooms
  // abaixo, sem filtro nenhum), mas não pesa mais no comprimento pra
  // fundação — não faz sentido calcular baldrame/radier pra uma parede
  // que não vai mais ser construída.
  groundFloor.walls.forEach(function (w) { if (!w.demolished) groundWallLength += Core.wallLengthMeters(w); });
  const groundRooms = Core.detectRooms(groundFloor.walls);
  groundRooms.forEach(function (room) {
    groundAreaM2 += room.area / (Core.GRID * Core.GRID);
    groundPerimeter += polygonPerimeterMeters(room.points);
  });

  return computeFoundationQuantity(
    project.foundationType,
    groundWallLength,
    groundAreaM2,
    groundPerimeter,
    {
      baldrameWidth: Scene3DRenderer.BALDRAME_WIDTH_GETTER(),
      baldrameThickness: Scene3DRenderer.BALDRAME_THICKNESS_GETTER(),
      radierMargin: Scene3DRenderer.RADIER_MARGIN_GETTER(),
      radierThickness: Scene3DRenderer.RADIER_THICKNESS_GETTER(),
      steelRateKgM3: STEEL_RATE_FOUNDATION_KG_M3,
    },
  );
}

// Percorre TODOS os pavimentos — a lista é do projeto inteiro, não só do
// pavimento em edição (senão trocar de aba faria a lista "sumir" com o
// que já foi construído embaixo).
export function compute(): ComputeResult {
  const project = Store.getProject();
  const standardWallHeight = Scene3DRenderer.WALL_HEIGHT_GETTER();
  let estimatedPilareteVolume = 0;
  const totals: Totals = {
    wallLength: 0, wallAreaNet: 0, floorArea: 0, baseboard: 0, roofArea: 0,
    doors: 0, windows: 0, arcos: 0, soleiraCount: 0, soleiraLength: 0,
    doorGenericCount: 0, windowsGenericAreaM2: 0,
    columnCount: 0, columnVolume: 0, estimatedColumnCount: 0,
    lajeCount: 0, lajeAreaM2: 0,
    vergaCount: 0, vergaSpanM: 0,
    roofTimberAreaM2: 0,
    glazingPanelAreaM2: 0, balconyRailingLengthM: 0, varandaAreaM2: 0,
    volumeBoxAreaM2: 0, volumeBoxProductCost: 0, volumeBoxGenericAreaM2: 0,
    furnitureCount: 0, furnitureCost: 0
  };
  const paint: Record<string, number> = {}, floorTile: Record<string, number> = {}, roofTile: Record<string, number> = {};
  const doorProducts: Record<string, number> = {}, windowProducts: Record<string, number> = {};

  project.floors.forEach(function (floor) {
    const currentWallHeight = floorWallHeight(floor, standardWallHeight);
    // Paredes: comprimento total + área a pintar (por face, descontando
    // a área das aberturas que atravessam a parede) + área líquida (uma
    // vez só, não por face — é a base do cálculo de alvenaria). Parede
    // quebrada (Wall.demolished) NÃO entra aqui — deixou de ser
    // construída, não faz sentido cobrar material/pintura dela — mas
    // continua entrando em detectRooms (mais abaixo) sem filtro nenhum,
    // pra o cômodo/piso não quebrar junto.
    floor.walls.forEach(function (w) {
      if (w.demolished) return;
      const lenM = Core.wallLengthMeters(w);
      totals.wallLength += lenM;
      const atticRoof = (floor.roofs || []).find((roof) => roof.atticMode === 'generated' && (roof.atticWallIds || []).includes(w.id));
      const effectiveWallHeight = atticRoof ? (atticRoof.baseHeightM || 1.2) : currentWallHeight;
      let openingsArea = 0;
      floor.openings.forEach(function (op) {
        if (op.wallId === w.id) openingsArea += op.width * op.height;
      });
      const atticExtensionArea = atticRoof ? Core.atticWallExtensionAreaMeters(w, atticRoof) : 0;
      const faceArea = Math.max(0, lenM * effectiveWallHeight + atticExtensionArea - openingsArea);
      totals.wallAreaNet += faceArea;
      // Parede sem acabamento escolhido no editor não pode ficar de fora
      // do orçamento — cai no padrão de mercado (mesma tinta já
      // cadastrada, ver DEFAULT_PAINT_PRODUCT_ID), pra nenhuma face ficar
      // sem custo só porque ninguém clicou nela ainda.
      addTo(paint, w.finishA || DEFAULT_PAINT_PRODUCT_ID, faceArea);
      addTo(paint, w.finishB || DEFAULT_PAINT_PRODUCT_ID, faceArea);
    });

    // Portas, janelas e arcos — e a verga (reforço acima do vão), que
    // se aplica a QUALQUER abertura em alvenaria, tenha porta/janela
    // instalada ou não (arco também precisa, é vão estrutural puro —
    // ver comentário em VERGA_BEARING_M). Abertura numa parede quebrada
    // (Wall.demolished) não conta mais — a parede que sustentaria
    // batente/verga não existe de verdade.
    floor.openings.forEach(function (op) {
      const hostWall = floor.walls.filter(function (w) { return w.id === op.wallId; })[0];
      if (hostWall && hostWall.demolished) return;
      const openingAreaM2 = op.width * op.height;
      if (op.kind === 'door') {
        totals.doors++;
        const product = op.productId ? Catalog.getProduct(op.productId) : null;
        if (product) addTo(doorProducts, op.productId!, openingAreaM2);
        else totals.doorGenericCount++;
      } else if (op.kind === 'arco') {
        totals.arcos++;
      } else {
        totals.windows++;
        const product = op.productId ? Catalog.getProduct(op.productId) : null;
        if (product) addTo(windowProducts, op.productId!, openingAreaM2);
        else totals.windowsGenericAreaM2 += openingAreaM2;
      }
      totals.vergaCount++;
      totals.vergaSpanM += op.width + 2 * VERGA_BEARING_M;
    });

    // Cômodos fechados: área de piso + comprimento de rodapé, e piso
    // agrupado por produto usando a MESMA assinatura de parede (roomKey)
    // que o renderer 3D já usa pra achar o acabamento do cômodo.
    const rooms = Core.detectRooms(floor.walls);

    // Soleiras externas — mesma regra do renderer 3D (Core.findRoomsAdjacentToOpening,
    // DEC-30): abertura no nível do chão com cômodo de UM lado só. Só
    // conta a peça própria (externa); a soleira "escondida" entre dois
    // cômodos não é um item de compra separado, não entra aqui.
    floor.openings.forEach(function (op) {
      if (op.sillHeight > 0.02) return;
      const wall = floor.walls.filter(function (w) { return w.id === op.wallId; })[0];
      if (!wall || wall.demolished) return;
      const adj = Core.findRoomsAdjacentToOpening(wall, op, rooms);
      if ((adj.roomA && !adj.roomB) || (!adj.roomA && adj.roomB)) {
        totals.soleiraCount++;
        totals.soleiraLength += op.width;
      }
    });

    rooms.forEach(function (room) {
      const areaM2 = room.area / (Core.GRID * Core.GRID);
      totals.floorArea += areaM2;
      totals.baseboard += polygonPerimeterMeters(room.points);
      const roomKey = Core.findRoomWallIds(floor.walls, room).slice().sort().join(',');
      const finishId = (floor.roomFinishes || {})[roomKey];
      // Cômodo sem piso escolhido no editor não pode ficar de fora do
      // orçamento — cai no padrão de mercado (porcelanato médio, ver
      // DEFAULT_FLOOR_TILE_PRODUCT_ID).
      addTo(floorTile, finishId || DEFAULT_FLOOR_TILE_PRODUCT_ID, areaM2);
    });

    // Telhado: área REAL da água (considerando a inclinação de cada
    // telhado, não só a projeção horizontal — ver roofAreaMeters).
    const netRoofAreas = roofNetAreas(floor.roofs || []);
    (floor.roofs || []).forEach(function (roof) {
      const areaM2 = netRoofAreas[roof.id] ?? roofAreaMeters(roof);
      totals.roofArea += areaM2;
      // Madeiramento (ripa/caibro/terça, ver ROOF_TIMBER_REF) — se aplica
      // a QUALQUER água, INCLUSIVE platibanda: na prática construtiva
      // real, o telhado "embutido" atrás do parapeito ainda é uma
      // estrutura de madeira comum (com telha eternit/fibrocimento por
      // cima), não uma laje maciça sem cobertura nenhuma — corrigido
      // nesta sessão (ver Registro de Decisões Técnicas).
      totals.roofTimberAreaM2 += areaM2;
      // Telha: sem escolha explícita, cai no padrão por tipo de telhado
      // — platibanda usa eternit/fibrocimento (telhado embutido atrás do
      // parapeito), os demais usam cerâmica comum.
      addTo(roofTile, roof.finishProductId || (roof.type === 'platibanda' ? DEFAULT_ETERNIT_PRODUCT_ID : DEFAULT_CERAMIC_TILE_PRODUCT_ID), areaM2);
      // Muretinha da platibanda — alvenaria de VERDADE (mesmo material
      // das paredes, confirmado em pesquisa: platibanda é sempre
      // construída com o mesmo bloco/tijolo da parede) que fica de fora
      // do orçamento até esta versão porque não é uma Wall — é
      // geometria pura desenhada a partir do próprio retângulo do
      // telhado (ver Scene3DRenderer.buildParapetWalls). Perímetro do
      // retângulo × altura real do parapeito (mesmo clamp do 3D, ver
      // clampParapetHeight acima) — soma em wallAreaNet (entra
      // automaticamente em bloco/argamassa/chapisco/reboco, já
      // calculados a partir dessa mesma variável) e em paint nas DUAS
      // faces (dentro/fora, mesmo padrão do oitão logo abaixo).
      if (roof.type === 'platibanda') {
        const parapetHeightM = clampParapetHeight(roof.parapetHeight);
        const parapetWidthM = Math.abs(roof.x2 - roof.x1) / Core.GRID;
        const parapetDepthM = Math.abs(roof.y2 - roof.y1) / Core.GRID;
        const parapetAreaM2 = 2 * (parapetWidthM + parapetDepthM) * parapetHeightM;
        totals.wallAreaNet += parapetAreaM2;
        addTo(paint, DEFAULT_PAINT_PRODUCT_ID, parapetAreaM2);
        addTo(paint, DEFAULT_PAINT_PRODUCT_ID, parapetAreaM2);
      }
      // O oitão/fechamento lateral é alvenaria derivada do telhado: entra
      // como parede, mas não participa do contorno dos cômodos. Duas
      // águas possui duas faces triangulares/retangulares iguais, uma em
      // cada empena — uma água também tem duas (o fechamento reto dos
      // dois lados do caimento único, ver buildRoofUmaAgua).
      if ((roof.type === 'duasAguas' || roof.type === 'umaAgua') && roof.atticMode !== 'generated') {
        const oneGableArea = gableAreaMeters(roof);
        totals.wallAreaNet += oneGableArea * 2;
        addTo(paint, roof.gableFinishA || DEFAULT_PAINT_PRODUCT_ID, oneGableArea);
        addTo(paint, roof.gableFinishB || DEFAULT_PAINT_PRODUCT_ID, oneGableArea);
      }
      // Painel de trás do uma-água (lado alto do caimento, ver
      // buildRoofUmaAgua) — parede de verdade se estendendo pra fechar o
      // vão, não um oitão decorativo; entra com o mesmo padrão de tinta
      // das demais paredes sem acabamento escolhido (DEFAULT_PAINT_PRODUCT_ID).
      if (roof.type === 'umaAgua' && roof.atticMode !== 'generated') {
        const backWallArea = umaAguaBackWallAreaMeters(roof);
        totals.wallAreaNet += backWallArea;
        addTo(paint, DEFAULT_PAINT_PRODUCT_ID, backWallArea);
      }
    });

    // Estrutura: colunas (pilares) — quantidade e volume de
    // concreto/madeira estimado a partir da seção fixa (Core.COLUMN_SIZE)
    // e do pé-direito do pavimento.
    (floor.columns || []).forEach(function (col) {
      totals.columnCount++;
      totals.columnVolume += columnVolumeM3(col, currentWallHeight);
    });

    // Varanda: área do retângulo (mesmo espírito de piso/laje, mas sem
    // Core.detectRooms — varanda não é fechada por parede, ver
    // comentário mais abaixo sobre a laje automática por cômodo não
    // cobrir esse caso).
    (floor.varandas || []).forEach(function (v) {
      totals.varandaAreaM2 += Math.abs((v.x2 - v.x1) * (v.y2 - v.y1)) / (Core.GRID * Core.GRID);
    });

    // Pele de vidro: área real do painel (widthM × heightM) — sempre
    // média de mercado (ESTIMATED_MARKET_PRICES), não tem produto de
    // catálogo próprio ainda (glassMaterial é só cor/opacidade, não uma
    // referência de fornecedor).
    (floor.glazingPanels || []).forEach(function (p) {
      totals.glazingPanelAreaM2 += p.widthM * p.heightM;
    });

    // Sacada de vidro: comprimento (widthM) — guarda-corpo de vidro é
    // sempre vendido/orçado por metro linear no mercado, não por m².
    (floor.balconyRailings || []).forEach(function (r) {
      totals.balconyRailingLengthM += r.widthM;
    });

    // Bloco de Volumetria: mesmo padrão fornecedor-real-primeiro de
    // portas/janelas — se tem finishProductId (pintado com a Lata de
    // tinta, ver DEC-134), usa o preço do próprio produto pela área de
    // superfície total (6 faces, mesmo material nas 6); sem acabamento
    // escolhido, cai na média de mercado genérica em buildRows().
    (floor.volumeBoxes || []).forEach(function (b) {
      const surfaceAreaM2 = 2 * (b.widthM * b.heightM + b.widthM * b.depthM + b.heightM * b.depthM);
      totals.volumeBoxAreaM2 += surfaceAreaM2;
      const cost = b.finishProductId ? productUnitCost(b.finishProductId, surfaceAreaM2) : null;
      if (cost != null) totals.volumeBoxProductCost += cost;
      else totals.volumeBoxGenericAreaM2 += surfaceAreaM2;
    });

    // Móveis: soma o preço do próprio produto do Catálogo
    // (Furniture.productId) — não é estimativa nova, é o preço já
    // cadastrado no produto (hoje 0 nos móveis de exemplo do Catálogo;
    // populando um preço real lá, aparece aqui automaticamente).
    (floor.furniture || []).forEach(function (f) {
      totals.furnitureCount++;
      const product = Catalog.getProduct(f.productId);
      if (product && product.commercial && product.commercial.price) totals.furnitureCost += product.commercial.price;
    });

    // Laje: passou a nascer automática por cômodo fechado, exatamente
    // como o piso (mesmo Core.detectRooms, mesmo polígono de área) — não
    // é mais um objeto independente arrastável (ver DEC-35 revista,
    // correção pós-lançamento nesta sessão). Volume = área de cada
    // cômodo × espessura real (mesma constante que o 3D usa pra
    // desenhar, ver LAJE_THICKNESS_GETTER). Trata como concreto armado
    // na taxa própria de laje (STEEL_RATE_LAJE_KG_M3) — SEM somar uma
    // viga própria por cômodo: a viga de cinta/amarração já calculada
    // mais abaixo roda por cima de toda parede do projeto, e é ela quem
    // estruturalmente já cumpre o papel de apoio da laje — uma viga
    // adicional aqui duplicaria essa mesma peça. Vão de laje sem apoio
    // intermediário (sem parede no meio de um cômodo grande) fica fora
    // do escopo — é decisão de projeto estrutural, mesmo tratamento que
    // pilarete em parede já dá pro vão grande. Varanda/balanço/sacada
    // ficam de fora da conta (não são cômodo fechado por parede) — a
    // laje automática por cômodo não cobre esses casos, ver decisão
    // registrada. A partir da DEC-90: cômodo nasce SEM laje contabilizada
    // — só entra depois que o botão "Gerar Laje" marcou o roomKey dele
    // (mesma assinatura de parede usada pelo acabamento de piso acima),
    // igual o 3D só desenha a malha nessa mesma condição.
    rooms.forEach(function (room) {
      const roomKey = Core.findRoomWallIds(floor.walls, room).slice().sort().join(',');
      if (!(floor.roomLajeGenerated || {})[roomKey]) return;
      totals.lajeCount++;
      totals.lajeAreaM2 += room.area / (Core.GRID * Core.GRID);
    });

    // Platibanda avançando pra fora das paredes: o retângulo do telhado
    // (roof.x1/y1/x2/y2) é arrastável independente das paredes — se ele
    // ficar maior que o cômodo embaixo, a LAJE de verdade (a que o
    // parapeito assenta em cima, e que sustenta a estrutura do telhado
    // "embutido" atrás dele) precisa acompanhar esse tamanho maior, não
    // parar no contorno da parede. Soma só a DIFERENÇA (a área do
    // cômodo já foi somada no loop acima) — evita contar duas vezes, e
    // não faz nada se o telhado não avançou (diferença ≤ 0) ou se não
    // achou nenhum cômodo com laje gerada embaixo do centro dele.
    (floor.roofs || []).forEach(function (roof) {
      if (roof.type !== 'platibanda') return;
      const cx = (roof.x1 + roof.x2) / 2, cy = (roof.y1 + roof.y2) / 2;
      const room = Core.roomAtPoint(floor.walls, cx, cy);
      if (!room) return;
      const roomKey = Core.findRoomWallIds(floor.walls, room).slice().sort().join(',');
      if (!(floor.roomLajeGenerated || {})[roomKey]) return;
      const roofFootprintAreaM2 = (Math.abs(roof.x2 - roof.x1) / Core.GRID) * (Math.abs(roof.y2 - roof.y1) / Core.GRID);
      const roomAreaM2 = room.area / (Core.GRID * Core.GRID);
      if (roofFootprintAreaM2 > roomAreaM2) totals.lajeAreaM2 += roofFootprintAreaM2 - roomAreaM2;
    });

    // Pilaretes ESTIMADOS embutidos na alvenaria (ver comentário em
    // COLUMN_MAX_SPAN_M) — um em cada encontro de parede detectado, mais
    // um a cada vão reto que passe de 3m sem encontro nenhum. Parede
    // quebrada não entra (não vai ser construída, não precisa de
    // pilarete embutido nela).
    const activeWalls = floor.walls.filter(function (w) { return !w.demolished; });
    const junctions = countWallJunctions(activeWalls);
    let extraSpanColumns = 0;
    activeWalls.forEach(function (w) {
      const lenM = Core.wallLengthMeters(w);
      extraSpanColumns += Math.floor(lenM / COLUMN_MAX_SPAN_M);
    });
    const estimatedCountForFloor = junctions + extraSpanColumns;
    totals.estimatedColumnCount += estimatedCountForFloor;
    estimatedPilareteVolume += estimatedCountForFloor * COLUMN_SECTION_M * COLUMN_SECTION_M * currentWallHeight;
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
  const pilareteVolume = estimatedPilareteVolume;
  const beamVolume = totals.wallLength * Core.WALL_THICK * BEAM_HEIGHT_M;
  const vergaVolume = totals.vergaSpanM * Core.WALL_THICK * BEAM_HEIGHT_M;
  const structure: Structure = {
    pilareteCount: totals.estimatedColumnCount,
    pilareteVolume: pilareteVolume,
    pilareteSteelKg: pilareteVolume * STEEL_RATE_SUPERSTRUCTURE_KG_M3,
    beamLength: totals.wallLength,
    beamVolume: beamVolume,
    beamSteelKg: beamVolume * STEEL_RATE_SUPERSTRUCTURE_KG_M3,
    vergaCount: totals.vergaCount,
    vergaVolume: vergaVolume,
    vergaSteelKg: vergaVolume * STEEL_RATE_SUPERSTRUCTURE_KG_M3
  };

  // Fundação — só o TÉRREO (project.floors[0]), igual o renderer 3D já
  // faz (buildFoundation recebe só o pavimento 0). Radier: laje sobre a
  // área dos cômodos + margem que sai da parede pra fora (RADIER_MARGIN)
  // — aproximando o acréscimo de área da margem por perímetro × margem.
  // Baldrame: viga corrida por baixo de TODA parede do térreo
  // (comprimento de parede, sem duplicar as internas — mais preciso que
  // a malha 3D, que desenha um quadro por cômodo e sobrepõe nas paredes
  // compartilhadas).
  const foundation = computeFoundation(project);

  // Laje — volume = área total já somada × espessura real (mesma
  // constante que o 3D usa pra desenhar), aço pela taxa própria de laje
  // (ver STEEL_RATE_LAJE_KG_M3 — mais baixa que viga/pilar de propósito,
  // sem viga adicional: ver comentário no loop acima).
  const lajeThickness = Scene3DRenderer.LAJE_THICKNESS_GETTER();
  const lajeVolumeM3 = totals.lajeAreaM2 * lajeThickness;
  const laje: LajeQuantities = {
    count: totals.lajeCount,
    areaM2: totals.lajeAreaM2,
    volumeM3: lajeVolumeM3,
    steelKg: lajeVolumeM3 * STEEL_RATE_LAJE_KG_M3
  };

  // Madeiramento — metros lineares de cada peça DERIVADOS do
  // espaçamento (área com perda ÷ espaçamento), volume de cada um vezes
  // a seção transversal (ver comentário completo em ROOF_TIMBER_REF).
  const roofTimberAreaWithWaste = totals.roofTimberAreaM2 * ROOF_TIMBER_REF.wasteFactor;
  const ripaLinearM = roofTimberAreaWithWaste / ROOF_TIMBER_REF.ripaSpacingM;
  const caibroLinearM = roofTimberAreaWithWaste / ROOF_TIMBER_REF.caibroSpacingM;
  const tercaLinearM = roofTimberAreaWithWaste / ROOF_TIMBER_REF.tercaSpacingM;
  const roofTimber: RoofTimber = {
    areaM2: totals.roofTimberAreaM2,
    ripaLinearM: ripaLinearM,
    caibroLinearM: caibroLinearM,
    tercaLinearM: tercaLinearM,
    volumeM3: ripaLinearM * ROOF_TIMBER_REF.ripaSectionM2
      + caibroLinearM * ROOF_TIMBER_REF.caibroSectionM2
      + tercaLinearM * ROOF_TIMBER_REF.tercaSectionM2
  };

  // Esgoto/pluvial — item por item (tubo por diâmetro em barras de 6m,
  // conexão por diâmetro+tipo), pedido explícito do Product Owner ("01
  // joelho de PVC 50mm linha esgoto...", pra dar pra levar a lista direto
  // na loja). Comprimento é o 3D real de cada segmento (não a linha reta
  // 2D: soma a diferença de cota, inclusive entre pavimentos, mesma
  // convenção de altura global usada em
  // Hydraulics.buildOrthogonalNetworkFromFixtures). Água fria fica de
  // fora (ver comentário na interface HydraulicsQuantities).
  const hydraulicNodesById = new Map((project.hydraulics.nodes || []).map((node) => [node.id, node]));
  const floorStackHeight = Scene3DRenderer.FLOOR_STACK_HEIGHT_GETTER();
  function hydraulicSegmentLengthMeters(segment: HydraulicSegment): number {
    const start = hydraulicNodesById.get(segment.startNodeId), end = hydraulicNodesById.get(segment.endNodeId);
    if (!start || !end) return 0;
    const dx = (end.x - start.x) / Core.GRID, dy = (end.y - start.y) / Core.GRID;
    const dz = ((end.floorIndex || 0) - (start.floorIndex || 0)) * floorStackHeight + (end.elevationM - start.elevationM);
    return Math.hypot(dx, dy, dz);
  }
  function hydraulicProductLine(networkType: HydraulicNetworkType): HydraulicProductLine {
    return networkType === 'rainwater' ? 'pluvial' : 'esgoto';
  }
  const HYDRAULIC_SEWER_RAINWATER_TYPES: HydraulicNetworkType[] = ['kitchen_sewer', 'sanitary_sewer', 'rainwater'];
  // Tubo — soma comprimento por (linha do produto, diâmetro), depois
  // converte pra barra de 6m (padrão comercial brasileiro), arredondando
  // pra cima o TOTAL do grupo (mesma lógica já usada em sacos de
  // cimento/latas de tinta — você não compra fração de barra).
  const pipeLengthByGroup = new Map<string, { productLine: HydraulicProductLine; diameterMm: number; lengthM: number }>();
  (project.hydraulics.segments || []).forEach((segment) => {
    if (!HYDRAULIC_SEWER_RAINWATER_TYPES.includes(segment.networkType)) return;
    const productLine = hydraulicProductLine(segment.networkType);
    const key = productLine + '|' + segment.diameterMm;
    const existing = pipeLengthByGroup.get(key) || { productLine, diameterMm: segment.diameterMm, lengthM: 0 };
    existing.lengthM += hydraulicSegmentLengthMeters(segment);
    pipeLengthByGroup.set(key, existing);
  });
  const pipeGroups: HydraulicPipeGroup[] = Array.from(pipeLengthByGroup.values())
    .map((group) => ({ ...group, bars: Math.ceil(group.lengthM / HYDRAULIC_PIPE_BAR_LENGTH_M) }))
    .sort((a, b) => a.productLine.localeCompare(b.productLine) || a.diameterMm - b.diameterMm);
  // Conexões — cada nó vira um joelho/tê/cruzeta real por (linha,
  // diâmetro, tipo); diâmetro do nó vem de um segmento vizinho (todo
  // trecho de uma mesma fixture nasce com o mesmo diâmetro, ver
  // Hydraulics.buildOrthogonalNetworkFromFixtures). 'straight'/'end' não
  // viram conexão (trecho reto/ponta solta não precisa de peça própria
  // nesta simplificação).
  function hydraulicNodeDiameterMm(nodeId: string): number {
    const segment = (project.hydraulics.segments || []).find((s) => s.startNodeId === nodeId || s.endNodeId === nodeId);
    return segment ? segment.diameterMm : 50;
  }
  const fittingCountByGroup = new Map<string, HydraulicFittingGroup>();
  HYDRAULIC_SEWER_RAINWATER_TYPES.forEach((networkType) => {
    const productLine = hydraulicProductLine(networkType);
    (project.hydraulics.nodes || [])
      .filter((node) => node.networkType === networkType && (node.kind === 'junction' || node.kind === 'destination'))
      .forEach((node) => {
        const kind = classifyHydraulicJunction(project.hydraulics, node.id);
        if (kind !== 'elbow45' && kind !== 'elbow90' && kind !== 'tee' && kind !== 'cross') return;
        const diameterMm = hydraulicNodeDiameterMm(node.id);
        const key = productLine + '|' + diameterMm + '|' + kind;
        const existing = fittingCountByGroup.get(key) || { productLine, diameterMm, kind, count: 0 };
        existing.count++;
        fittingCountByGroup.set(key, existing);
      });
  });
  const fittingGroups: HydraulicFittingGroup[] = Array.from(fittingCountByGroup.values())
    .sort((a, b) => a.productLine.localeCompare(b.productLine) || a.diameterMm - b.diameterMm || a.kind.localeCompare(b.kind));
  // Caixas — uma linha por tipo (gordura/inspeção/saída pluvial), nunca
  // lumped: são estruturas fisicamente diferentes (NBR 8160).
  const destinationGroups: HydraulicDestinationGroup[] = HYDRAULIC_SEWER_RAINWATER_TYPES
    .map((networkType) => ({
      networkType, label: destinationLabelForNetwork(networkType),
      count: (project.hydraulics.nodes || []).filter((node) => node.kind === 'destination' && node.networkType === networkType).length,
    }))
    .filter((group) => group.count > 0);
  const hydraulics: HydraulicsQuantities = { pipeGroups, fittingGroups, destinationGroups };

  return { totals, paint, floorTile, roofTile, doorProducts, windowProducts, masonry, structure, foundation, laje, roofTimber, hydraulics, constructionSystem: project.constructionSystem };
}

function productLine(productId: string, areaM2: number): string {
  const p = Catalog.getProduct(productId);
  const name = p ? p.name : productId;
  let extra = '';
  // Peças estimadas quando o produto informa a cobertura física por
  // peça (pecaCoverageM2 — NUNCA tileMeters, que é escala de textura
  // na renderização 3D, campo separado de propósito).
  if (p && p.assets && p.assets.pecaCoverageM2) {
    extra = ' &middot; ~' + Math.ceil(areaM2 / p.assets.pecaCoverageM2) + ' peças';
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
  // Dispara a busca do preço real na primeira vez que o painel
  // renderiza (não bloqueia: usa a referência genérica enquanto isso).
  // Quando a busca voltar (achou ou não), re-renderiza uma vez pra
  // atualizar os números — só se o painel ainda estiver aberto.
  if (!realPricesFetchStarted) {
    onRealPricesLoaded = function () { if (bodyEl) render(); };
    ensureRealPrices();
  }
  const q = compute();
  let html = '';
  const system = constructionSystemDefinition(q.constructionSystem);
  html += '<div class="object-panel-section-label">Sistema construtivo</div>';
  html += '<div class="materials-line"><span>Escolhido no projeto</span><span>' + system.label + '</span></div>';
  if (!hasCeramicMasonryEstimate(q.constructionSystem)) {
    const missing = q.constructionSystem === 'light_steel_frame'
      ? 'perfis, placas, membranas e isolamento'
      : 'blocos estruturais, graute e armaduras';
    html += '<div class="materials-empty">O quantitativo específico de ' + missing + ' ainda não está disponível. Áreas, acabamentos, fundação, laje e cobertura continuam calculados.</div>';
  }
  html += '<div class="object-panel-section-label">Quantitativos gerais</div>';
  html += '<div class="materials-line"><span>Paredes</span><span>' + fmtM(q.totals.wallLength) + '</span></div>';
  html += '<div class="materials-line"><span>Piso</span><span>' + fmtM2(q.totals.floorArea) + '</span></div>';
  html += '<div class="materials-line"><span>Rodapé</span><span>' + fmtM(q.totals.baseboard) + '</span></div>';
  html += '<div class="materials-line"><span>Telhado (área real da água)</span><span>' + fmtM2(q.totals.roofArea) + '</span></div>';
  html += '<div class="materials-line"><span>Portas</span><span>' + q.totals.doors + ' un.</span></div>';
  html += '<div class="materials-line"><span>Janelas</span><span>' + q.totals.windows + ' un.</span></div>';
  html += '<div class="materials-line"><span>Arcos</span><span>' + q.totals.arcos + ' un.</span></div>';
  html += '<div class="materials-line"><span>Soleiras externas</span><span>' + q.totals.soleiraCount + ' un. · ' + fmtM(q.totals.soleiraLength) + '</span></div>';
  if (q.totals.glazingPanelAreaM2 > 0) html += '<div class="materials-line"><span>Pele de vidro</span><span>' + fmtM2(q.totals.glazingPanelAreaM2) + '</span></div>';
  if (q.totals.balconyRailingLengthM > 0) html += '<div class="materials-line"><span>Sacada de vidro</span><span>' + fmtM(q.totals.balconyRailingLengthM) + '</span></div>';
  if (q.totals.varandaAreaM2 > 0) html += '<div class="materials-line"><span>Varanda</span><span>' + fmtM2(q.totals.varandaAreaM2) + '</span></div>';
  if (q.totals.volumeBoxAreaM2 > 0) html += '<div class="materials-line"><span>Bloco de Volumetria (superfície)</span><span>' + fmtM2(q.totals.volumeBoxAreaM2) + '</span></div>';
  if (q.totals.furnitureCount > 0) html += '<div class="materials-line"><span>Móveis posicionados</span><span>' + q.totals.furnitureCount + ' un.</span></div>';
  // Painel rápido: só o resumo (mesmo padrão de Pintura/Piso/Telhado
  // acima, que também só mostram área aqui — a lista item por item
  // completa, com tubo/conexão por diâmetro, fica no PDF/planilha/CSV
  // (buildRows(), ver "Instalações hidrossanitárias" lá).
  if (q.hydraulics.pipeGroups.length > 0 || q.hydraulics.destinationGroups.length > 0) {
    html += '<div class="object-panel-section-label">Instalações hidrossanitárias (esgoto e pluvial, sem inclinação)</div>';
    q.hydraulics.pipeGroups.forEach(function (group) {
      html += '<div class="materials-line"><span>Tubo ' + HYDRAULIC_PRODUCT_LINE_LABEL[group.productLine] + ' ' + group.diameterMm + 'mm</span><span>' + fmtM(group.lengthM) + '</span></div>';
    });
    const fittingTotal = q.hydraulics.fittingGroups.reduce(function (sum, group) { return sum + group.count; }, 0);
    if (fittingTotal > 0) html += '<div class="materials-line"><span>Conexões</span><span>' + fittingTotal + ' un.</span></div>';
    q.hydraulics.destinationGroups.forEach(function (group) {
      html += '<div class="materials-line"><span>' + group.label + '</span><span>' + group.count + ' un.</span></div>';
    });
  }
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
  if (q.totals.columnCount > 0 || (hasCeramicMasonryEstimate(q.constructionSystem) && q.structure.pilareteCount > 0)) {
    html += '<div class="object-panel-section-label">Estrutura</div>';
    if (q.totals.columnCount > 0) {
      html += '<div class="materials-line"><span>Colunas (posicionadas)</span><span>' + q.totals.columnCount + ' un.</span></div>';
      html += '<div class="materials-line"><span>Volume de colunas</span><span>' + q.totals.columnVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
    }
    if (hasCeramicMasonryEstimate(q.constructionSystem) && q.structure.pilareteCount > 0) {
      html += '<div class="materials-line"><span>Pilaretes em parede (estimado, vão ≤ 3m)</span><span>' + q.structure.pilareteCount + ' un.</span></div>';
      html += '<div class="materials-line"><span>Concreto — pilaretes</span><span>' + q.structure.pilareteVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
      html += '<div class="materials-line"><span>Aço — pilaretes</span><span>' + q.structure.pilareteSteelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
      html += '<div class="materials-line"><span>Viga de cinta/amarração</span><span>' + fmtM(q.structure.beamLength) + '</span></div>';
      html += '<div class="materials-line"><span>Concreto — cinta</span><span>' + q.structure.beamVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
      html += '<div class="materials-line"><span>Aço — cinta</span><span>' + q.structure.beamSteelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
    }
    if (hasCeramicMasonryEstimate(q.constructionSystem) && q.structure.vergaCount > 0) {
      html += '<div class="materials-line"><span>Vergas acima de vãos (estimado, vão + 20cm de apoio/lado)</span><span>' + q.structure.vergaCount + ' un.</span></div>';
      html += '<div class="materials-line"><span>Concreto — vergas</span><span>' + q.structure.vergaVolume.toFixed(3).replace('.', ',') + ' m³</span></div>';
      html += '<div class="materials-line"><span>Aço — vergas</span><span>' + q.structure.vergaSteelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
    }
  }
  if (q.laje.count > 0) {
    html += '<div class="object-panel-section-label">Laje (automática por cômodo fechado — ref. taxa de aço 90 kg/m³, sem viga própria, apoiada na cinta já contada em Estrutura)</div>';
    html += '<div class="materials-line"><span>Cômodos com laje</span><span>' + q.laje.count + ' un.</span></div>';
    html += '<div class="materials-line"><span>Área</span><span>' + fmtM2(q.laje.areaM2) + '</span></div>';
    html += '<div class="materials-line"><span>Concreto</span><span>' + q.laje.volumeM3.toFixed(3).replace('.', ',') + ' m³</span></div>';
    html += '<div class="materials-line"><span>Aço (estimado)</span><span>' + q.laje.steelKg.toFixed(1).replace('.', ',') + ' kg</span></div>';
  }
  if (hasCeramicMasonryEstimate(q.constructionSystem) && q.totals.wallAreaNet > 0) {
    html += '<div class="object-panel-section-label">Alvenaria (ref. SINAPI — bloco 9x19x19, traço 1:2:8, com 10% de perda)</div>';
    html += '<div class="materials-line"><span>Blocos/tijolos</span><span>' + q.masonry.blocks + ' un.</span></div>';
    html += priceSourceLine('brickPerUnit', '/un');
    html += '<div class="materials-line"><span>Argamassa de assentamento</span><span>' + q.masonry.mortarM3.toFixed(3).replace('.', ',') + ' m³</span></div>';
    html += '<div class="materials-line"><span>Cimento</span><span>' + q.masonry.cementKg.toFixed(1).replace('.', ',') + ' kg (~' + Math.ceil(q.masonry.cementKg / 50) + ' sacos 50kg)</span></div>';
    html += priceSourceLine('cementPerKg', '/kg');
    html += '<div class="materials-line"><span>Cal hidratada</span><span>' + q.masonry.calKg.toFixed(1).replace('.', ',') + ' kg (~' + Math.ceil(q.masonry.calKg / 20) + ' sacos 20kg)</span></div>';
    html += priceSourceLine('limePerKg', '/kg');
    html += '<div class="materials-line"><span>Areia média</span><span>' + q.masonry.sandM3.toFixed(2).replace('.', ',') + ' m³</span></div>';
    html += priceSourceLine('sandPerM3', '/m³');
  }
  if (q.roofTimber.areaM2 > 0) {
    html += '<div class="object-panel-section-label">Madeiramento (ref. SINAPI 92539 — ripa/caibro/terça, telha cerâmica/concreto, com 10% de perda)</div>';
    html += '<div class="materials-line"><span>Ripas</span><span>' + fmtM(q.roofTimber.ripaLinearM) + '</span></div>';
    html += '<div class="materials-line"><span>Caibros</span><span>' + fmtM(q.roofTimber.caibroLinearM) + '</span></div>';
    html += '<div class="materials-line"><span>Terças</span><span>' + fmtM(q.roofTimber.tercaLinearM) + '</span></div>';
    html += '<div class="materials-line"><span>Volume total de madeira</span><span>' + q.roofTimber.volumeM3.toFixed(3).replace('.', ',') + ' m³</span></div>';
    html += priceSourceLine('woodPerM3', '/m³');
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
    const resolvedCount = (Object.keys(VORTICE_MATERIAL_SKUS) as MaterialPriceKey[]).filter(function (k) { return !!realPrices[k]; }).length;
    const totalMaterials = (Object.keys(VORTICE_MATERIAL_SKUS) as MaterialPriceKey[]).length;
    const custoLabel = resolvedCount === totalMaterials ? 'Estimado (todo material com preço de catálogo — real ou média de mercado)'
      : resolvedCount > 0 ? 'Estimado (parte dos materiais com preço de catálogo; restante em referência de emergência)'
      : 'Estimado (referência de emergência — catálogo ainda não carregou)';
    html += '<div class="materials-line"><span>' + custoLabel + '</span><span>' + totalRow[5] + '</span></div>';
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
// ---------------------------------------------------------------
// PREÇO REAL DO CATÁLOGO (Supabase) — substitui a referência genérica
// fixa no código por um produto de verdade, sempre visível/rastreável
// (ver DEC-88, e DEC-100/101: "nenhum material sem preço" — todo
// material estrutural tem um produto de catálogo garantido, mesmo
// quando nenhum fornecedor real (O Mercador) tem o item certo).
//
// Dois níveis de prioridade por material:
//   1) FORNECEDOR REAL (O Mercador) — quando existe um produto que
//      representa a MESMA coisa que o quantitativo assume (mesma
//      unidade de referência), com confiança suficiente pra não estar
//      comparando coisa diferente disfarçada de "preço real". Hoje só
//      cimento tem esse match limpo (saco de 50kg) — bloco/aço/areia/
//      cal/concreto do Mercador ou não existem no catálogo, ou são
//      produto de tamanho/unidade incompatível (ver DEC-88 e DEC-100).
//   2) MÉDIA DE MERCADO (Vórtice Materiais, origem 'generico') — um
//      produto próprio, cadastrado com preço médio nacional pesquisado
//      (fontes: Calculobra, SINAPI, Lar Pontual Engenharia, Reforma &
//      Construção, ago/2026 — ver migration correspondente), garante
//      que TODO material sempre resolve pra um produto real do
//      catálogo, mesmo sem fornecedor específico pra ele ainda.
//
// Busca uma vez só (cacheada), silenciosa se falhar — nesse caso o
// REFERENCE_PRICES abaixo (agora só um fallback de EMERGÊNCIA, pra
// quando nem o Supabase responde) continua valendo, mesmo espírito de
// resiliência da ADR-007 §7: preço indisponível nunca trava nada, só
// degrada.
interface RealPriceMatch { value: number; source: string; }
type MaterialPriceKey = 'cementPerKg' | 'limePerKg' | 'sandPerM3' | 'concretePerM3' | 'steelPerKg' | 'brickPerUnit' | 'woodPerM3' | 'windowPerM2' | 'nailPerKg';
let realPrices: { [K in MaterialPriceKey]?: RealPriceMatch } = {};
let realPricesFetchStarted = false;
let onRealPricesLoaded: (() => void) | null = null;

// SKUs fixos dos produtos "Vórtice Materiais" (preço médio de mercado)
// — combinam com os cadastrados na migration; busca exata por SKU, sem
// depender de casar texto de nome de produto (ao contrário do Mercador,
// aqui o próprio Esboce controla os dois lados, então não tem risco de
// desalinhar se o cadastro mudar de nome).
const VORTICE_MATERIAL_SKUS: Record<MaterialPriceKey, { sku: string; unitDivisor: number }> = {
  cementPerKg: { sku: 'vortice-cimento-50kg', unitDivisor: 50 },
  limePerKg: { sku: 'vortice-cal-20kg', unitDivisor: 20 },
  sandPerM3: { sku: 'vortice-areia-m3', unitDivisor: 1 },
  concretePerM3: { sku: 'vortice-concreto-usinado-m3', unitDivisor: 1 },
  steelPerKg: { sku: 'vortice-aco-ca50-kg', unitDivisor: 1 },
  brickPerUnit: { sku: 'vortice-tijolo-9x19x19-un', unitDivisor: 1 },
  woodPerM3: { sku: 'vortice-madeira-telhado-m3', unitDivisor: 1 },
  windowPerM2: { sku: 'vortice-janela-aluminio-m2', unitDivisor: 1 },
  nailPerKg: { sku: 'vortice-prego-kg', unitDivisor: 1 },
};

async function ensureRealPrices(): Promise<void> {
  if (realPricesFetchStarted) return;
  realPricesFetchStarted = true;
  try {
    const [manufacturers, products] = await Promise.all([listManufacturers(), listCatalogProducts()]);
    const mercador = manufacturers.find(function (m) { return m.nome === 'O Mercador'; });
    const vortice = manufacturers.find(function (m) { return m.nome === 'Vórtice Materiais'; });

    // Nível 1 — fornecedor real: só cimento, por enquanto (ver DEC-88
    // pra o motivo dos demais não terem match seguro no Mercador).
    if (mercador) {
      const cimento = products.find(function (p) {
        return p.manufacturer_id === mercador.id && p.categoria === 'Cimento e Argamassa' &&
          /^CIMENTO\b/i.test(p.nome) && !/BRANCO/i.test(p.nome) &&
          p.unidade === 'SC' && /50\s*KG/i.test(p.nome);
      });
      if (cimento) realPrices.cementPerKg = { value: cimento.preco / 50, source: cimento.nome + ' — O Mercador' };
    }

    // Nível 2 — média de mercado (Vórtice): preenche qualquer material
    // que o nível 1 não resolveu, SEMPRE (garante que nenhum material
    // fica sem preço de catálogo).
    if (vortice) {
      (Object.keys(VORTICE_MATERIAL_SKUS) as MaterialPriceKey[]).forEach(function (key) {
        if (realPrices[key]) return; // já resolvido por fornecedor real
        const cfg = VORTICE_MATERIAL_SKUS[key];
        const product = products.find(function (p) { return p.manufacturer_id === vortice.id && p.sku === cfg.sku; });
        if (product) realPrices[key] = { value: product.preco / cfg.unitDivisor, source: product.nome + ' — preço médio de mercado' };
      });
    }
  } catch (err) {
    console.error('Falha ao buscar preço de material no catálogo (segue com a referência de emergência):', err);
  } finally {
    if (onRealPricesLoaded) onRealPricesLoaded();
  }
}

// Fallback de EMERGÊNCIA — só usado se nem o Supabase responder (rede
// fora do ar). Em uso normal, todo material sempre resolve por um
// produto de catálogo (nível 1 ou 2 acima), nunca por este valor fixo.
const REFERENCE_PRICES = {
  cementPerKg: 0.75,
  limePerKg: 0.95,
  sandPerM3: 130,
  concretePerM3: 450,
  steelPerKg: 8.00,
  brickPerUnit: 1.20,
  woodPerM3: 5000.00,
  windowPerM2: 150.00,
  nailPerKg: 14.00
};

// Preços médios ESTIMADOS de mercado (Brasil, referência 2025-2026)
// pra peças que não têm produto de catálogo/fornecedor próprio ainda —
// diferente de REFERENCE_PRICES acima, não têm o mecanismo de preço
// real via Supabase (MaterialPriceKey/ensureRealPrices), são só uma
// referência fixa. Auditoria pedida pelo Product Owner ("como podemos
// aferir se tudo o que está sendo criado está sendo quantificado e
// orçado?") encontrou 5 peças com ZERO linha no quantitativo — ver
// Registro de Decisões Técnicas.
//   • glazingPanelPerM2: fachada/esquadria de vidro temperado + perfil
//     de alumínio, instalada — faixa de mercado ~R$450-700/m²,
//     usando o meio da faixa.
//   • balconyRailingPerM: guarda-corpo de vidro temperado (8-10mm) +
//     perfil de alumínio, sempre orçado por METRO LINEAR no mercado
//     (não por m², a altura já é padronizada pela norma) — faixa
//     ~R$350-500/m.
//   • varandaPerM2: laje + piso + acabamento básico de varanda
//     coberta — não é cômodo fechado (sem parede pra Core.detectRooms
//     cobrir), então nunca tinha custo de piso/laje nenhum.
//   • volumeBoxGenericPerM2: bloco de volumetria SEM acabamento
//     escolhido (sem finishProductId — ver Store.commands.
//     setVolumeBoxFinish, DEC-134) — estrutura + reboco básico nas 6
//     faces, valor mais conservador que o CUB/m² residencial completo
//     (~R$1.950-3.100/m² pra PR/RS/SC em 2025, fonte blog Cassol) já
//     que não inclui fundação/telhado/instalações — só a massa em si.
//   • rodapePerM: rodapé cerâmico/poliestireno assentado, faixa de
//     mercado ~R$12-25/m instalado — meio da faixa.
//   • soleiraPerM: soleira de granito/mármore sob porta, faixa de
//     mercado ~R$70-110/m instalada — meio da faixa.
//   Arco não tem preço aqui de propósito — ver comentário em buildRows()
//   perto de 'Arcos': é um vão sem folha, a alvenaria que deixa de
//   existir ali já reduz custo em outras linhas, um preço fixo pareceria
//   custo extra quando o efeito líquido tende a ser economia.
//   • hydraulicDestinationBoxUnit: caixa de gordura/inspeção/saída
//     pluvial em PVC pré-moldado, faixa de mercado ~R$80-150/un — meio
//     da faixa, mesmo valor pras 3 (a norma diferencia função, não
//     custo de mercado do item em si).
//   • woodDoorPerUnit: porta de madeira pronta (semi-oca, c/batente e
//     ferragem básica) instalada — assumida pra toda porta SEM produto
//     de catálogo escolhido, já que não existe produto de porta de
//     madeira cadastrado ainda (só esquadria de vidro); faixa de
//     mercado ~R$350-550/un instalada — meio da faixa.
const ESTIMATED_MARKET_PRICES = {
  glazingPanelPerM2: 580.00,
  balconyRailingPerM: 420.00,
  varandaPerM2: 320.00,
  volumeBoxGenericPerM2: 260.00,
  rodapePerM: 18.00,
  soleiraPerM: 90.00,
  hydraulicDestinationBoxUnit: 115.00,
  woodDoorPerUnit: 450.00,
};

// Tubo/conexão de PVC pra esgoto/pluvial — item por item (pedido
// explícito do Product Owner: "01 joelho de PVC 50mm linha esgoto...",
// pra lista dar pra levar direto na loja). Linha "esgoto" cobre
// kitchen_sewer+sanitary_sewer (mesmo tubo/conexão de PVC Predial Tigre
// Série Normal — o preço de mercado não muda por causa de qual pia/vaso
// atende); "pluvial" é a linha Aquapluv, produto diferente. Diâmetros
// batem com os já usados por fixture (40/50/75/100mm).
// Barra de tubo = 6m, padrão comercial brasileiro (mesma lógica de
// arredondar pra cima já usada em sacos de cimento/latas de tinta).
// Único preço ancorado numa fonte real encontrada na pesquisa (tubo
// esgoto 75mm, barra de 3m, R$103,10 — Lojas Solar, ref. Tigre
// 11030904 — dobrado aqui pra barra de 6m); os demais são estimativa de
// faixa de mercado pro mesmo padrão de marca/qualidade — busca de preço
// exato por item bloqueada por proteção anti-bot nas lojas online.
const HYDRAULIC_PIPE_BAR_LENGTH_M = 6;
const HYDRAULIC_PIPE_BAR_PRICE: Record<HydraulicProductLine, Record<number, number>> = {
  esgoto: { 40: 70.00, 50: 95.00, 75: 206.00, 100: 280.00 },
  pluvial: { 75: 180.00 },
};
const HYDRAULIC_FITTING_PRICE: Record<HydraulicProductLine, Record<number, Record<string, number>>> = {
  esgoto: {
    40: { elbow90: 8.00, elbow45: 7.00, tee: 14.00, cross: 22.00 },
    50: { elbow90: 10.00, elbow45: 9.00, tee: 18.00, cross: 28.00 },
    75: { elbow90: 22.00, elbow45: 19.00, tee: 38.00, cross: 55.00 },
    100: { elbow90: 32.00, elbow45: 28.00, tee: 55.00, cross: 80.00 },
  },
  pluvial: {
    75: { elbow90: 20.00, elbow45: 17.00, tee: 34.00, cross: 50.00 },
  },
};
const HYDRAULIC_FITTING_KIND_LABEL: Record<string, string> = { elbow90: 'Joelho 90°', elbow45: 'Joelho 45°', tee: 'Tê', cross: 'Cruzeta' };
const HYDRAULIC_PRODUCT_LINE_LABEL: Record<HydraulicProductLine, string> = { esgoto: 'linha esgoto', pluvial: 'linha pluvial' };

// Rendimento de referência pra converter área de parede em latas de
// tinta (o Catalog vende tinta por lata, não por m² — não existe ainda
// um campo "rendimento" no produto, então uso uma referência de bula
// típica: ~11 m²/L por demão, 2 demãos).
const PAINT_COATS = 2;
const PAINT_YIELD_M2_PER_CAN_PER_COAT = 200;

// Preço de um material por kg/m³/unidade — do catálogo (fornecedor
// real ou média Vórtice, o que tiver resolvido) ou o fallback de
// emergência, se nem isso carregou ainda/falhou.
function materialPrice(key: MaterialPriceKey): number {
  return realPrices[key] ? realPrices[key]!.value : REFERENCE_PRICES[key];
}

// Cimento e cal são vendidos em saco fechado (50kg e 20kg), não a
// granel — não dá pra comprar "67,28kg", só sacos inteiros. Arredonda
// pra cima; o custo usa a mesma quantidade arredondada (você paga o
// saco cheio, não a fração), não o kg exato calculado.
function bagsQty(kg: number, bagKg: number): number {
  return Math.ceil(kg / bagKg);
}

// Linha "↳ ..." mostrando de onde veio o preço em uso — só aparece
// quando já resolveu por um produto de catálogo (fornecedor real OU
// Vórtice); enquanto isso não chegou (ou se falhou de vez), não mostra
// nada, e o valor usado no cálculo já é o REFERENCE_PRICES de
// emergência silenciosamente (ver ADR-006 §12/17, rastreabilidade —
// "de onde veio esse número" — e §15, não esconder atrás de tooltip).
function priceSourceLine(key: MaterialPriceKey, unitSuffix: string): string {
  const match = realPrices[key];
  if (!match) return '';
  return '<div class="materials-line" style="color:#77746C; font-size:11px;"><span>↳ R$ ' + match.value.toFixed(2).replace('.', ',') + unitSuffix + '</span><span>' + match.source + '</span></div>';
}

// Custo de um produto do Catalog pra uma área/quantidade — lê o preço e
// a unidade comercial DO PRÓPRIO PRODUTO (commercial.price/unit), nunca
// um valor solto aqui. Retorna null quando não dá pra converter (unidade
// comercial desconhecida).
function productUnitCost(productId: string, areaM2: number): number | null {
  const p = Catalog.getProduct(productId);
  if (!p || !p.commercial || p.commercial.price == null) return null;
  const price = p.commercial.price;
  if (p.commercial.unit === 'm2' || p.commercial.unit === 'un') return areaM2 * price;
  if (p.commercial.unit === 'peca') {
    if (p.assets && p.assets.pecaCoverageM2) return Math.ceil(areaM2 / p.assets.pecaCoverageM2) * price;
    // Peça sem "cobertura" declarada (ex.: uma porta/janela específica,
    // já do tamanho certo pro vão) — 1 abertura = 1 peça inteira, preço
    // não escala pela área.
    return price;
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
      if (w.demolished) return;
      rows.push([label, 'Parede ' + (i + 1) + ' — id ' + w.id, Core.wallLengthMeters(w).toFixed(2), 'm']);
    });
    const rooms = Core.detectRooms(floor.walls);
    rooms.forEach(function (room, i) {
      const areaM2 = room.area / (Core.GRID * Core.GRID);
      rows.push([label, 'Cômodo ' + (i + 1), areaM2.toFixed(2), 'm²']);
    });
    floor.openings.forEach(function (op, i) {
      const kindLabel = op.kind === 'door' ? 'Porta' : op.kind === 'arco' ? 'Arco' : 'Janela';
      rows.push([label, kindLabel + ' ' + (i + 1) + ' (' + op.width.toFixed(2) + '×' + op.height.toFixed(2) + 'm)', 1, 'un']);
    });
    (floor.roofs || []).forEach(function (r, i) {
      rows.push([label, 'Telhado ' + (i + 1) + ' (' + r.type + ')', roofAreaMeters(r).toFixed(2), 'm²']);
    });
    (floor.columns || []).forEach(function (c, i) {
      rows.push([label, 'Coluna ' + (i + 1) + ' (' + c.shape + ')', 1, 'un']);
    });
    (floor.lajes || []).forEach(function (laje, i) {
      rows.push([label, 'Laje ' + (i + 1), lajeAreaMeters(laje).toFixed(2), 'm²']);
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
  push('Geral', 'Rodapé (comprimento)', q.totals.baseboard, 'm', q.totals.baseboard > 0 ? q.totals.baseboard * ESTIMATED_MARKET_PRICES.rodapePerM : null);
  push('Geral', 'Telhado (área real da água)', q.totals.roofArea, 'm²', null);
  // Porta/janela de VIDRO (produto real de catálogo escolhido) — item
  // por PRODUTO, quantidade em m² real da abertura (convenção de
  // mercado pra esquadria de vidro/alumínio, pedido do Product Owner),
  // mesmo padrão de Pintura/Piso/Telhado logo abaixo (addProductRows).
  // Porta SEM produto escolhido assume porta de madeira padrão — por
  // UNIDADE, com preço de referência de mercado (não existe produto de
  // porta de madeira no catálogo ainda). Janela sem produto continua
  // por m² genérico, média Vórtice — não existe "janela de madeira" no
  // catálogo, toda janela aqui é esquadria de vidro.
  addProductRows('Esquadrias de vidro', q.doorProducts);
  addProductRows('Esquadrias de vidro', q.windowProducts);
  if (q.totals.doorGenericCount > 0) {
    push('Geral', 'Porta de madeira (padrão)', q.totals.doorGenericCount, 'un', q.totals.doorGenericCount * ESTIMATED_MARKET_PRICES.woodDoorPerUnit);
  }
  if (q.totals.windowsGenericAreaM2 > 0) {
    push('Geral', 'Janela (padrão)', q.totals.windowsGenericAreaM2, 'm²', q.totals.windowsGenericAreaM2 * materialPrice('windowPerM2'));
  }
  // Sem preço próprio: o arco é um vão sem batente/folha — a alvenaria
  // que deixa de existir ali já reduz wallAreaNet (bloco/argamassa/
  // pintura, ver o desconto de openingsArea logo acima) e a verga acima
  // do vão já tem linha própria ("Vergas acima de vãos"). Um preço fixo
  // aqui daria a impressão de custo extra quando o efeito líquido tende
  // a ser economia, não gasto.
  push('Geral', 'Arcos', q.totals.arcos, 'un', null);
  // Soleira é vendida/orçada por metro linear — o preço entra só na
  // linha de comprimento, "unidades" fica informativo (evita contar
  // o mesmo material duas vezes).
  push('Geral', 'Soleiras externas (unidades)', q.totals.soleiraCount, 'un', null);
  push('Geral', 'Soleiras externas (comprimento)', q.totals.soleiraLength, 'm', q.totals.soleiraLength > 0 ? q.totals.soleiraLength * ESTIMATED_MARKET_PRICES.soleiraPerM : null);
  // Pele de vidro, Sacada de vidro e Varanda não têm produto de
  // catálogo próprio — sempre média de mercado (ESTIMATED_MARKET_PRICES,
  // ver comentário completo ali).
  if (q.totals.glazingPanelAreaM2 > 0) {
    push('Geral', 'Pele de vidro (área)', q.totals.glazingPanelAreaM2, 'm²', q.totals.glazingPanelAreaM2 * ESTIMATED_MARKET_PRICES.glazingPanelPerM2);
  }
  if (q.totals.balconyRailingLengthM > 0) {
    push('Geral', 'Sacada de vidro (comprimento)', q.totals.balconyRailingLengthM, 'm', q.totals.balconyRailingLengthM * ESTIMATED_MARKET_PRICES.balconyRailingPerM);
  }
  if (q.totals.varandaAreaM2 > 0) {
    push('Geral', 'Varanda (área)', q.totals.varandaAreaM2, 'm²', q.totals.varandaAreaM2 * ESTIMATED_MARKET_PRICES.varandaPerM2);
  }
  if (q.foundation) {
    const f = q.foundation;
    const fLabel = 'Fundação (' + f.type + ')';
    if (f.type === 'baldrame') push(fLabel, 'Viga baldrame (comprimento)', f.length, 'm', null);
    else push(fLabel, 'Área da laje', f.areaM2, 'm²', null);
    push(fLabel, 'Concreto', f.concreteVolume, 'm³', f.concreteVolume * materialPrice('concretePerM3'));
    push(fLabel, 'Aço (estimado)', f.steelKg, 'kg', f.steelKg * materialPrice('steelPerKg'));
  }
  if (q.totals.columnCount > 0) {
    push('Estrutura', 'Colunas (posicionadas)', q.totals.columnCount, 'un', null);
    push('Estrutura', 'Volume de colunas', q.totals.columnVolume, 'm³', q.totals.columnVolume * materialPrice('concretePerM3'));
  }
  if (hasCeramicMasonryEstimate(q.constructionSystem) && q.structure.pilareteCount > 0) {
    push('Estrutura', 'Pilaretes em parede (estimado)', q.structure.pilareteCount, 'un', null);
    push('Estrutura', 'Concreto — pilaretes', q.structure.pilareteVolume, 'm³', q.structure.pilareteVolume * materialPrice('concretePerM3'));
    push('Estrutura', 'Aço — pilaretes', q.structure.pilareteSteelKg, 'kg', q.structure.pilareteSteelKg * materialPrice('steelPerKg'));
    push('Estrutura', 'Viga de cinta/amarração (comprimento)', q.structure.beamLength, 'm', null);
    push('Estrutura', 'Concreto — cinta', q.structure.beamVolume, 'm³', q.structure.beamVolume * materialPrice('concretePerM3'));
    push('Estrutura', 'Aço — cinta', q.structure.beamSteelKg, 'kg', q.structure.beamSteelKg * materialPrice('steelPerKg'));
  }
  if (hasCeramicMasonryEstimate(q.constructionSystem) && q.structure.vergaCount > 0) {
    push('Estrutura', 'Vergas acima de vãos (estimado)', q.structure.vergaCount, 'un', null);
    push('Estrutura', 'Concreto — vergas', q.structure.vergaVolume, 'm³', q.structure.vergaVolume * materialPrice('concretePerM3'));
    push('Estrutura', 'Aço — vergas', q.structure.vergaSteelKg, 'kg', q.structure.vergaSteelKg * materialPrice('steelPerKg'));
  }
  if (q.laje.count > 0) {
    const lLabel = 'Laje (ref. taxa de aço 90 kg/m³)';
    push(lLabel, 'Lajes (posicionadas)', q.laje.count, 'un', null);
    push(lLabel, 'Área', q.laje.areaM2, 'm²', null);
    push(lLabel, 'Concreto', q.laje.volumeM3, 'm³', q.laje.volumeM3 * materialPrice('concretePerM3'));
    push(lLabel, 'Aço (estimado)', q.laje.steelKg, 'kg', q.laje.steelKg * materialPrice('steelPerKg'));
  }
  if (hasCeramicMasonryEstimate(q.constructionSystem) && q.totals.wallAreaNet > 0) {
    push('Alvenaria (ref. SINAPI)', 'Blocos/tijolos', q.masonry.blocks, 'un', q.masonry.blocks * materialPrice('brickPerUnit'));
    push('Alvenaria (ref. SINAPI)', 'Argamassa de assentamento', q.masonry.mortarM3, 'm³', null);
    const masonryCementBags = bagsQty(q.masonry.cementKg, 50);
    const masonryCalBags = bagsQty(q.masonry.calKg, 20);
    push('Alvenaria (ref. SINAPI)', 'Cimento', masonryCementBags, 'sc(50kg)', masonryCementBags * 50 * materialPrice('cementPerKg'));
    push('Alvenaria (ref. SINAPI)', 'Cal hidratada', masonryCalBags, 'sc(20kg)', masonryCalBags * 20 * materialPrice('limePerKg'));
    push('Alvenaria (ref. SINAPI)', 'Areia média', q.masonry.sandM3, 'm³', q.masonry.sandM3 * materialPrice('sandPerM3'));
  }
  // Chapisco (traço 1:3) + Reboco (traço 1:2:8, 2cm) — aplicado nas DUAS
  // faces de toda parede (wallAreaNet é área de UMA face; alvenaria
  // recebe reboco por dentro e por fora), mesma fonte de área já usada
  // pra pintura/alvenaria.
  if (q.totals.wallAreaNet > 0) {
    const bothFacesAreaM2 = q.totals.wallAreaNet * 2;
    const rLabel = 'Chapisco e Reboco (ref. mercado)';
    const chapiscoCementBags = bagsQty(bothFacesAreaM2 * CHAPISCO_REF.cementKgPerM2, 50);
    const chapiscoSandM3 = bothFacesAreaM2 * CHAPISCO_REF.sandM3PerM2;
    const rebocoVolumeM3 = bothFacesAreaM2 * REBOCO_THICKNESS_M;
    const rebocoCementBags = bagsQty(rebocoVolumeM3 * MASONRY_REF.cementKgPerM3, 50);
    const rebocoCalBags = bagsQty(rebocoVolumeM3 * MASONRY_REF.calKgPerM3, 20);
    const rebocoSandM3 = rebocoVolumeM3 * MASONRY_REF.sandM3PerM3;
    push(rLabel, 'Cimento (chapisco)', chapiscoCementBags, 'sc(50kg)', chapiscoCementBags * 50 * materialPrice('cementPerKg'));
    push(rLabel, 'Areia (chapisco)', chapiscoSandM3, 'm³', chapiscoSandM3 * materialPrice('sandPerM3'));
    push(rLabel, 'Cimento (reboco)', rebocoCementBags, 'sc(50kg)', rebocoCementBags * 50 * materialPrice('cementPerKg'));
    push(rLabel, 'Cal hidratada (reboco)', rebocoCalBags, 'sc(20kg)', rebocoCalBags * 20 * materialPrice('limePerKg'));
    push(rLabel, 'Areia (reboco)', rebocoSandM3, 'm³', rebocoSandM3 * materialPrice('sandPerM3'));
  }
  // Contrapiso (traço 1:4, 3cm) — sobre a mesma área de piso já usada
  // pro acabamento (cerâmica/porcelanato).
  if (q.totals.floorArea > 0) {
    const cLabel = 'Contrapiso (ref. mercado)';
    const contrapisoCementBags = bagsQty(q.totals.floorArea * CONTRAPISO_REF.cementKgPerM2, 50);
    const contrapisoSandM3 = q.totals.floorArea * CONTRAPISO_REF.sandM3PerM2;
    push(cLabel, 'Cimento', contrapisoCementBags, 'sc(50kg)', contrapisoCementBags * 50 * materialPrice('cementPerKg'));
    push(cLabel, 'Areia', contrapisoSandM3, 'm³', contrapisoSandM3 * materialPrice('sandPerM3'));
  }
  if (q.roofTimber.areaM2 > 0) {
    const tLabel = 'Madeiramento (ref. SINAPI 92539)';
    // Peça de loja padrão (3m) — mesma lógica de barra de 6m já usada
    // pro tubo hidráulico: comprimento linear vira Nº de peças inteiras,
    // arredondado pra cima; cada peça custa pela seção transversal
    // própria dela (ripa/caibro/terça têm bitolas diferentes — ver
    // ROOF_TIMBER_REF), não uma média por m³ solta numa linha à parte.
    const woodPricePerM3 = materialPrice('woodPerM3');
    function woodPieceCost(sectionM2: number): number { return sectionM2 * WOOD_PIECE_LENGTH_M * woodPricePerM3; }
    const ripaPieces = Math.ceil(q.roofTimber.ripaLinearM / WOOD_PIECE_LENGTH_M);
    const caibroPieces = Math.ceil(q.roofTimber.caibroLinearM / WOOD_PIECE_LENGTH_M);
    const tercaPieces = Math.ceil(q.roofTimber.tercaLinearM / WOOD_PIECE_LENGTH_M);
    push(tLabel, 'Ripa 1,5x5cm (peça ' + WOOD_PIECE_LENGTH_M + 'm)', ripaPieces, 'un', ripaPieces * woodPieceCost(ROOF_TIMBER_REF.ripaSectionM2));
    push(tLabel, 'Caibro 5x6cm (peça ' + WOOD_PIECE_LENGTH_M + 'm)', caibroPieces, 'un', caibroPieces * woodPieceCost(ROOF_TIMBER_REF.caibroSectionM2));
    push(tLabel, 'Terça 6x12cm (peça ' + WOOD_PIECE_LENGTH_M + 'm)', tercaPieces, 'un', tercaPieces * woodPieceCost(ROOF_TIMBER_REF.tercaSectionM2));
    const nailKg = q.roofTimber.areaM2 * ROOF_TIMBER_NAIL_KG_PER_M2;
    push(tLabel, 'Pregos', nailKg, 'kg', nailKg * materialPrice('nailPerKg'));
  }
  // Quantidade em unidade de COMPRA (o que dá pra pedir na loja), não na
  // unidade de cálculo interno — pedido explícito do Product Owner após
  // ver o PDF ("orçamento por quantidade de produto, ex: 02 sacos de
  // cimento 50kg"). Latas e peças arredondam pra cima (não dá pra
  // comprar meia lata/peça); m² continua m² pra produto vendido assim
  // (porcelanato, pedra) — já é unidade de compra de verdade.
  function purchaseQuantity(p: any, areaM2: number): { qty: number; unit: string } {
    if (p && p.commercial && p.commercial.unit === 'lata_18L') {
      return { qty: Math.ceil((areaM2 * PAINT_COATS) / PAINT_YIELD_M2_PER_CAN_PER_COAT), unit: 'lata(s) 18L' };
    }
    if (p && p.commercial && p.commercial.unit === 'peca' && p.assets && p.assets.pecaCoverageM2) {
      return { qty: Math.ceil(areaM2 / p.assets.pecaCoverageM2), unit: 'peça(s)' };
    }
    return { qty: areaM2, unit: 'm²' };
  }
  function addProductRows(category: string, map: Record<string, number>) {
    Object.keys(map).forEach(function (id) {
      const p = Catalog.getProduct(id);
      const areaM2 = map[id]!;
      const { qty, unit } = purchaseQuantity(p, areaM2);
      push(category, p ? p.name : id, qty, unit, productUnitCost(id, areaM2));
    });
  }
  addProductRows('Pintura', q.paint);
  addProductRows('Piso', q.floorTile);
  addProductRows('Telhado', q.roofTile);

  // Bloco de Volumetria: mesmo padrão fornecedor-real > média já usado
  // em portas/janelas — a fração com finishProductId escolhido (Lata de
  // tinta, DEC-134) usa o preço do próprio produto (volumeBoxProductCost,
  // já resolvido em compute()); a fração sem acabamento cai na média de
  // mercado genérica. Área de superfície total (as 6 faces do box)
  // sempre mostrada, seja qual for a origem do preço.
  if (q.totals.volumeBoxAreaM2 > 0) {
    const volumeBoxCost = q.totals.volumeBoxProductCost + q.totals.volumeBoxGenericAreaM2 * ESTIMATED_MARKET_PRICES.volumeBoxGenericPerM2;
    push('Volumetria', 'Bloco de Volumetria (área de superfície)', q.totals.volumeBoxAreaM2, 'm²', volumeBoxCost);
  }
  // Móveis: preço do próprio produto do Catálogo (Furniture.productId),
  // já somado em compute() — sem média de mercado nova (ver comentário
  // em Totals).
  if (q.totals.furnitureCount > 0) {
    push('Mobiliário', 'Móveis posicionados', q.totals.furnitureCount, 'un', q.totals.furnitureCost > 0 ? q.totals.furnitureCost : null);
  }

  // Esgoto e pluvial — item por item (pedido explícito do Product Owner:
  // "01 joelho de PVC 50mm linha esgoto...", pra dar pra levar direto na
  // loja). Sem inclinação (traçado esquemático, ver Hydraulics.ts). Água
  // fria fica de fora por ora (gap pré-existente maior, fora do pedido
  // específico desta seção).
  const hLabel = 'Instalações hidrossanitárias';
  q.hydraulics.pipeGroups.forEach(function (group) {
    const unitPrice = HYDRAULIC_PIPE_BAR_PRICE[group.productLine][group.diameterMm];
    const item = 'Tubo PVC ' + HYDRAULIC_PRODUCT_LINE_LABEL[group.productLine] + ' ' + group.diameterMm + 'mm (barra ' + HYDRAULIC_PIPE_BAR_LENGTH_M + 'm)';
    push(hLabel, item, group.bars, 'un', unitPrice != null ? group.bars * unitPrice : null);
  });
  q.hydraulics.fittingGroups.forEach(function (group) {
    const unitPrice = HYDRAULIC_FITTING_PRICE[group.productLine]?.[group.diameterMm]?.[group.kind];
    const item = (HYDRAULIC_FITTING_KIND_LABEL[group.kind] || group.kind) + ' PVC ' + HYDRAULIC_PRODUCT_LINE_LABEL[group.productLine] + ' ' + group.diameterMm + 'mm';
    push(hLabel, item, group.count, 'un', unitPrice != null ? group.count * unitPrice : null);
  });
  q.hydraulics.destinationGroups.forEach(function (group) {
    push(hLabel, group.label, group.count, 'un', group.count * ESTIMATED_MARKET_PRICES.hydraulicDestinationBoxUnit);
  });

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

// ---------------------------------------------------------------
// ORÇAMENTO EM PDF — pedido explícito do Product Owner: "bem bonito e
// organizado, lista simples, não confuso", rodapé "Orçamento gerado
// por esboce.com.br". Reaproveita buildRows() (mesma fonte de dados
// da tela/CSV/planilha — nunca uma leitura própria) e reagrupa em
// seções por categoria (um título por categoria, sem repetir o nome
// dela em toda linha como a tabela do painel/planilha faz) — o pedido
// era "lista simples", uma seção por categoria lê mais limpo que uma
// tabela com a mesma palavra repetida em cada linha.
//
// Sem biblioteca de geração de PDF nenhuma: abre uma aba só com HTML
// impresso (mesma técnica já usada em MaterialsSheet.open()), estilizada
// pra impressão, e aciona window.print() — o "Salvar como PDF" do
// próprio navegador gera o arquivo. Isso evita adicionar mais uma
// dependência pesada ao bundle (já sinalizado grande demais no build)
// só pra um recurso que o navegador já faz nativamente.
//
// Aviso de responsabilidade técnica (ADR-006 §13-15) É OBRIGATÓRIO
// aqui — a própria ADR-006 §15 lista "PDF" explicitamente entre os
// lugares onde o aviso precisa aparecer, não só nos Termos de Uso.
const PDF_DISCLAIMER = 'O Esboce é uma ferramenta de apoio ao planejamento. Ele não substitui arquiteto ou engenheiro. Os quantitativos e valores deste orçamento são uma estimativa — merecem a validação de um profissional legalmente habilitado antes de qualquer execução. Este total cobre apenas material de construção — não inclui mão de obra, projeto, taxas, licenças, terreno, nem instalações elétricas/hidráulicas.';

const PDF_STYLE = '' +
  '@page { margin: 18mm 16mm 22mm; }' +
  'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0;color:#2C2C2A;}' +
  '.pdf-header{display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #534AB7; padding-bottom:10px; margin-bottom:4px;}' +
  '.pdf-header h1{font-size:22px; margin:0; color:#534AB7;}' +
  '.pdf-header .date{font-size:12px; color:#5F5E5A;}' +
  '.pdf-disclaimer{font-size:10.5px; color:#5F5E5A; background:#F4F1EA; border-radius:6px; padding:8px 10px; margin:12px 0 18px; line-height:1.4;}' +
  '.pdf-section{margin-bottom:14px; break-inside:avoid;}' +
  '.pdf-section h2{font-size:13px; text-transform:uppercase; letter-spacing:.03em; color:#534AB7; border-bottom:1px solid #D3D1C7; padding-bottom:4px; margin:0 0 6px;}' +
  '.pdf-row{display:flex; justify-content:space-between; gap:12px; padding:4px 0; font-size:13px; border-bottom:1px solid #F0EEE7;}' +
  '.pdf-row .item{flex:1; color:#2C2C2A;}' +
  '.pdf-row .qty{color:#77746C; white-space:nowrap;}' +
  '.pdf-row .cost{width:100px; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap;}' +
  '.pdf-total{display:flex; justify-content:space-between; align-items:center; margin-top:18px; padding-top:12px; border-top:2px solid #534AB7;}' +
  '.pdf-total .label{font-size:14px; font-weight:600;}' +
  '.pdf-total .value{font-size:22px; font-weight:700; color:#534AB7;}' +
  '.pdf-footer{position:fixed; bottom:8mm; left:16mm; right:16mm; font-size:10px; color:#9C9A92; border-top:1px solid #EDEAE1; padding-top:6px; text-align:center;}' +
  '.pdf-noprint{margin:16px 0;}' +
  '.pdf-noprint button{background:#534AB7; color:#FFFFFF; border:none; border-radius:6px; padding:9px 16px; font-size:13px; cursor:pointer;}' +
  '@media print { .pdf-noprint{display:none;} }';

function pdfSections(rows: (string | number)[][]): string {
  let html = '';
  let currentCat: string | number | null = null;
  let sectionOpen = false;
  rows.forEach(function (r) {
    if (r[0] === 'TOTAL') return; // total vira o bloco especial no fim, não mais uma seção
    if (r[0] !== currentCat) {
      if (sectionOpen) html += '</div>';
      currentCat = r[0]!;
      html += '<div class="pdf-section"><h2>' + escapeCell(currentCat) + '</h2>';
      sectionOpen = true;
    }
    const item = r[1], qty = r[2] + ' ' + r[3], cost = r[5] && r[5] !== '—' ? r[5] : '';
    html += '<div class="pdf-row"><span class="item">' + escapeCell(item) + '</span><span class="qty">' + escapeCell(qty) + '</span><span class="cost">' + escapeCell(cost) + '</span></div>';
  });
  if (sectionOpen) html += '</div>';
  return html;
}

function escapeCell(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function exportPdf(): void {
  const rows = buildRows();
  const totalRow = rows.length && rows[rows.length - 1]![0] === 'TOTAL' ? rows[rows.length - 1]! : null;
  const win = window.open('', 'esboce-orcamento-pdf');
  if (!win) return; // pop-up bloqueado pelo navegador
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  win.document.title = 'Orçamento — Esboce';
  win.document.head.innerHTML = '<meta charset="UTF-8"><style>' + PDF_STYLE + '</style>';
  win.document.body.innerHTML =
    '<div class="pdf-noprint"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>' +
    '<div class="pdf-header"><h1>Orçamento Estimado</h1><span class="date">' + today + '</span></div>' +
    '<div class="pdf-disclaimer">' + PDF_DISCLAIMER + '</div>' +
    pdfSections(rows) +
    (totalRow ? '<div class="pdf-total"><span class="label">Total estimado</span><span class="value">' + totalRow[5] + '</span></div>' : '') +
    '<div class="pdf-footer">Orçamento gerado por esboce.com.br</div>';
  win.focus();
  setTimeout(function () { win.print(); }, 300); // dá tempo do layout assentar antes do diálogo abrir
}

export function init(): void {
  panelEl = document.getElementById('materialsPanel');
  bodyEl = document.getElementById('materialsPanelBody');
  const toggleBtn = document.getElementById('materialsToggleBtn');
  const closeBtn = document.getElementById('materialsPanelClose');
  const exportBtn = document.getElementById('materialsExportBtn');
  const sheetBtn = document.getElementById('materialsSheetBtn');
  const pdfBtn = document.getElementById('materialsPdfBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportCsv);
  if (sheetBtn) sheetBtn.addEventListener('click', function () { MaterialsSheet.open(); });
  if (pdfBtn) pdfBtn.addEventListener('click', exportPdf);
  if (toggleBtn) toggleBtn.addEventListener('click', function () {
    panelEl!.classList.toggle('visible');
    if (panelEl!.classList.contains('visible')) render();
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { panelEl!.classList.remove('visible'); });
  render();
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const MaterialsPanel = { init, refresh: render, buildRows, buildDetailRows, compute };