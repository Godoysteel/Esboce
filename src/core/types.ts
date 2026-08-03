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

export type OpeningKind = 'door' | 'window';

export interface Opening {
  id: string;
  kind: OpeningKind;
  wallId: string;
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
}

export interface Floor {
  id: string;
  name: string;
  walls: Wall[];
  columns: Column[];
  roofs: Roof[];
  openings: Opening[];
  varandas: Varanda[];
  roomFinishes: Record<string, unknown>;
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

export interface Project {
  floors: Floor[];
  currentFloorIndex: number;
  layers: ProjectLayers;
  foundationType: FoundationType;
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

export type ProductCategory = 'paint' | 'floor_tile' | 'roof_tile' | 'trim';

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
}

export interface Product {
  id: string;
  name: string;
  manufacturer: string;
  category: ProductCategory;
  commercial: ProductCommercial;
  assets: ProductAssets;
}