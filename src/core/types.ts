// Tipos do domínio geométrico do Esboce. Migrado de `Core` (IIFE) do
// index.html monolítico original — ver legacy/index-monolito-original.html.

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Acabamento de cada face da parede (lado A / lado B) — id de Produto do Catalog.
  finishA?: string;
  finishB?: string;
}

export type ColumnShape = 'quadrada' | 'redonda';

export interface Column {
  id: string;
  x: number;
  y: number;
  shape: ColumnShape;
}

export type RoofType = 'duasAguas' | 'quatroAguas' | 'umaAgua' | 'platibanda';
export type RidgeAxis = 'x' | 'y';

export interface Roof {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: RoofType;
  pitchDeg: number;
  ridgeAxis: RidgeAxis;
  finishProductId?: string;
  gableFinishA?: string;
  gableFinishB?: string;
  /** Identifica uma cobertura composta confirmada pelo usuário. */
  compoundGroupId?: string;
  /** Altura do parapeito acima do topo da parede, em metros — só relevante pra type === 'platibanda'. */
  parapetHeight?: number;
}

export type VarandaFrontSide = 'minZ' | 'maxZ' | 'minX' | 'maxX';

export interface Varanda {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frontSide: VarandaFrontSide;
}

// Laje entre pavimentos (ou cobertura plana no último) — objeto
// colocável de verdade, igual telhado/varanda: nasce de um clique,
// arrasta como bloco pra reposicionar, e cada aresta do contorno
// arrasta independente pra ajustar o formato. Sem relação obrigatória
// com as paredes do pavimento — pode ficar menor (vão aberto, ex.: um
// poço de escada) ou maior (balanço, sacada) que o contorno de
// parede. Duas lajes encostadas grudam por um ímã de encaixe (sem
// sobrepor), mas continuam objetos SEPARADOS — sem fusão automática
// (ver DEC-35/37).
//
// `points` é o contorno de VERDADE — um polígono retilíneo (só cantos
// de 90°, nunca diagonal), sentido horário. Nasce com 4 pontos (um
// retângulo simples); cada segmento entre dois pontos consecutivos é
// UMA aresta independente, arrastável na seleção.
export interface Laje {
  id: string;
  points: { x: number; y: number }[];
}

// Móvel colocado na cena — posição do "pé" (x,y) no plano do pavimento,
// mais rotação em graus (passos de 90°, mesmo espírito do frontSide da
// varanda). O objeto 3D real (glTF) vem do Catalog via productId.
export interface Furniture {
  id: string;
  productId: string;
  x: number;
  y: number;
  rotationDeg: number;
  // Altura do "pé" da peça acima do chão, em METROS — só usada por
  // peças montadas na parede (TV, quadro etc). 0 = apoiada no chão,
  // que é o padrão pra quase tudo (sofá, cama, vaso...).
  elevationM?: number;
}

export type OpeningKind = 'door' | 'window' | 'arco';

export interface Opening {
  id: string;
  kind: OpeningKind;
  wallId: string;
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
}

export type FloorKind = 'standard' | 'attic';

export interface Floor {
  id: string;
  name: string;
  kind: FloorKind;
  /** Altura das paredes laterais do ático antes do início da cobertura. */
  wallHeightM?: number;
  walls: Wall[];
  columns: Column[];
  roofs: Roof[];
  openings: Opening[];
  varandas: Varanda[];
  lajes: Laje[];
  furniture: Furniture[];
  roomFinishes: Record<string, string>;
  roomFinishSettings?: Record<string, { scale: number; rotation: number }>;
}

export interface ProjectLayers {
  fundacao: boolean;
  calcada: boolean;
  marquise: boolean;
  telhado: boolean;
  paredesTerreo: boolean;
  colunas: boolean;
  laje: boolean;
  paredesSuperiores: boolean;
  aberturas: boolean;
  varanda: boolean;
}

export type FoundationType = 'radier' | 'baldrame';
export type ConstructionSystem = 'ceramic_masonry' | 'structural_block' | 'light_steel_frame';

export interface Project {
  floors: Floor[];
  currentFloorIndex: number;
  layers: ProjectLayers;
  foundationType: FoundationType;
  constructionSystem: ConstructionSystem;
}

export interface Room {
  points: Point[];
  area: number;
}

export interface WallFootprint {
  p1a: Point;
  p1b: Point;
  p2a: Point;
  p2b: Point;
  p1Free: boolean;
  p2Free: boolean;
  p1Extended: boolean;
  p2Extended: boolean;
}

export interface WallOBB {
  cx: number;
  cy: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  halfLen: number;
  halfThick: number;
}

export interface MTV {
  x: number;
  y: number;
}

export interface Interval {
  min: number;
  max: number;
}

// ---- Catalog (materiais/produtos) ----

export interface Manufacturer {
  id: string;
  name: string;
}

export type ProductCategory = 'paint' | 'floor_tile' | 'roof_tile' | 'trim' | 'furniture';

export interface ProductCommercial {
  sku: string;
  price: number;
  unit: string;
}

export interface ProductTextures {
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  aoMap?: string;
}

export interface ProductAssets {
  colorHex: string;
  textureUrl: string | null;
  tileMeters?: number;
  textures?: ProductTextures;
  // Caminho (relativo a public/, sem barra inicial) de um modelo glTF/GLB
  // pronto — usado por produtos da categoria 'furniture'. Nunca um caminho
  // absoluto fixo: o carregador sempre prefixa com import.meta.env.BASE_URL.
  modelUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  manufacturer: string;
  category: ProductCategory;
  commercial: ProductCommercial;
  assets: ProductAssets;
}

// ---- Store (estado/comandos/undo) ----

// Os eventos emitidos pelo Store têm formatos variados por tipo (mesmo
// padrão do original — um "type" mais campos extras conforme o evento).
// Tipagem pragmática: campos extras ficam livres, "type" é sempre string.
// TODO: refinar pra union discriminada por "type" quando fizer sentido.
export interface StoreEvent {
  type: string;
  live?: boolean;
  [key: string]: unknown;
}

export type StoreListener = (event: StoreEvent, project: Project) => void;

export interface WallSnapshot {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LinkedWallUpdate {
  id: string;
  which: 1 | 2;
  x: number;
  y: number;
}
