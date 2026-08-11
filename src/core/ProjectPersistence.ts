import type {
  Column, Floor, Furniture, GlazingPanel, Laje, Opening, Project, ProjectLayers, Roof, Varanda, Wall,
} from './types.js';

export const CURRENT_PROJECT_SCHEMA_VERSION = 5;

export interface StoredProjectDocument {
  schemaVersion: number;
  project: Project;
}

export interface DecodedProjectDocument {
  project: Project;
  sourceVersion: number;
  migrated: boolean;
}

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFormatError';
  }
}

const DEFAULT_LAYERS: ProjectLayers = {
  fundacao: true,
  calcada: true,
  marquise: true,
  telhado: true,
  paredesTerreo: true,
  colunas: true,
  laje: true,
  paredesSuperiores: true,
  aberturas: true,
  varanda: true,
};

function fail(path: string, message: string): never {
  throw new ProjectFormatError(`${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'objeto esperado');
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string, optional = false): unknown[] {
  if (value == null && optional) return [];
  if (!Array.isArray(value)) fail(path, 'lista esperada');
  if (value.length > 10_000) fail(path, 'limite de 10.000 itens excedido');
  return value;
}

function string(value: unknown, path: string, fallback?: string): string {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) fail(path, 'texto inválido');
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value == null) return undefined;
  return string(value, path);
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value == null) return undefined;
  return number(value, path);
}

function number(value: unknown, path: string, fallback?: number): number {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'número finito esperado');
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string, fallback?: T): T {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) fail(path, `valor inválido: ${String(value)}`);
  return value as T;
}

function parseWall(value: unknown, path: string): Wall {
  const v = record(value, path);
  const wall: Wall = {
    id: string(v.id, `${path}.id`),
    x1: number(v.x1, `${path}.x1`), y1: number(v.y1, `${path}.y1`),
    x2: number(v.x2, `${path}.x2`), y2: number(v.y2, `${path}.y2`),
  };
  const finishA = optionalString(v.finishA, `${path}.finishA`);
  const finishB = optionalString(v.finishB, `${path}.finishB`);
  if (finishA !== undefined) wall.finishA = finishA;
  if (finishB !== undefined) wall.finishB = finishB;
  return wall;
}

function parseColumn(value: unknown, path: string): Column {
  const v = record(value, path);
  return {
    id: string(v.id, `${path}.id`), x: number(v.x, `${path}.x`), y: number(v.y, `${path}.y`),
    shape: enumValue(v.shape, ['quadrada', 'redonda'], `${path}.shape`, 'quadrada'),
  };
}

function parseRoof(value: unknown, path: string): Roof {
  const v = record(value, path);
  const roof: Roof = {
    id: string(v.id, `${path}.id`),
    x1: number(v.x1, `${path}.x1`), y1: number(v.y1, `${path}.y1`),
    x2: number(v.x2, `${path}.x2`), y2: number(v.y2, `${path}.y2`),
    type: enumValue(v.type, ['duasAguas', 'quatroAguas', 'umaAgua', 'platibanda'], `${path}.type`, 'duasAguas'),
    pitchDeg: number(v.pitchDeg, `${path}.pitchDeg`, 28),
    ridgeAxis: enumValue(v.ridgeAxis, ['x', 'y'], `${path}.ridgeAxis`, 'x'),
    parapetHeight: number(v.parapetHeight, `${path}.parapetHeight`, 0.5),
  };
  const optionalFields = {
    finishProductId: optionalString(v.finishProductId, `${path}.finishProductId`),
    gableFinishA: optionalString(v.gableFinishA, `${path}.gableFinishA`),
    gableFinishB: optionalString(v.gableFinishB, `${path}.gableFinishB`),
    compoundGroupId: optionalString(v.compoundGroupId, `${path}.compoundGroupId`),
    atticMode: v.atticMode == null ? undefined : enumValue(v.atticMode, ['preview', 'generated'], `${path}.atticMode`),
  };
  for (const [key, item] of Object.entries(optionalFields)) {
    if (item !== undefined) (roof as unknown as Record<string, unknown>)[key] = item;
  }
  if (roof.atticMode) {
    roof.baseHeightM = number(v.baseHeightM, `${path}.baseHeightM`, 1.2);
    roof.atticWallIds = array(v.atticWallIds, `${path}.atticWallIds`, true).map((id, index) => string(id, `${path}.atticWallIds[${index}]`));
  }
  return roof;
}

function parseOpening(value: unknown, path: string): Opening {
  const v = record(value, path);
  return {
    id: string(v.id, `${path}.id`),
    kind: enumValue(v.kind, ['door', 'window', 'arco'], `${path}.kind`),
    wallId: string(v.wallId, `${path}.wallId`),
    offset: number(v.offset, `${path}.offset`), width: number(v.width, `${path}.width`),
    height: number(v.height, `${path}.height`), sillHeight: number(v.sillHeight, `${path}.sillHeight`),
  };
}

function parseVaranda(value: unknown, path: string): Varanda {
  const v = record(value, path);
  return {
    id: string(v.id, `${path}.id`),
    x1: number(v.x1, `${path}.x1`), y1: number(v.y1, `${path}.y1`),
    x2: number(v.x2, `${path}.x2`), y2: number(v.y2, `${path}.y2`),
    frontSide: enumValue(v.frontSide, ['minZ', 'maxZ', 'minX', 'maxX'], `${path}.frontSide`, 'minZ'),
  };
}

function parseLaje(value: unknown, path: string): Laje {
  const v = record(value, path);
  const points = array(v.points, `${path}.points`).map((point, index) => {
    const p = record(point, `${path}.points[${index}]`);
    return { x: number(p.x, `${path}.points[${index}].x`), y: number(p.y, `${path}.points[${index}].y`) };
  });
  if (points.length < 3) fail(`${path}.points`, 'a laje precisa de pelo menos 3 pontos');
  return { id: string(v.id, `${path}.id`), points };
}

function parseGlazingPanel(value: unknown, path: string): GlazingPanel {
  const v = record(value, path);
  const panel: GlazingPanel = {
    id: string(v.id, `${path}.id`),
    state: enumValue(v.state, ['preview', 'attached'], `${path}.state`, 'preview'),
    widthM: number(v.widthM, `${path}.widthM`),
    heightM: number(v.heightM, `${path}.heightM`),
    moduleTargetM: number(v.moduleTargetM, `${path}.moduleTargetM`, 1.2),
  };
  const wallId = optionalString(v.wallId, `${path}.wallId`);
  const offsetM = optionalNumber(v.offsetM, `${path}.offsetM`);
  const sillHeightM = optionalNumber(v.sillHeightM, `${path}.sillHeightM`);
  const x = optionalNumber(v.x, `${path}.x`);
  const y = optionalNumber(v.y, `${path}.y`);
  const rotationDeg = optionalNumber(v.rotationDeg, `${path}.rotationDeg`);
  if (wallId !== undefined) panel.wallId = wallId;
  if (offsetM !== undefined) panel.offsetM = offsetM;
  if (sillHeightM !== undefined) panel.sillHeightM = sillHeightM;
  if (x !== undefined) panel.x = x;
  if (y !== undefined) panel.y = y;
  if (rotationDeg !== undefined) panel.rotationDeg = rotationDeg;
  if (panel.state === 'attached' && !panel.wallId) fail(`${path}.wallId`, 'painel anexado precisa de parede hospedeira');
  return panel;
}

function parseFurniture(value: unknown, path: string): Furniture {
  const v = record(value, path);
  return {
    id: string(v.id, `${path}.id`), productId: string(v.productId, `${path}.productId`),
    x: number(v.x, `${path}.x`), y: number(v.y, `${path}.y`),
    rotationDeg: number(v.rotationDeg, `${path}.rotationDeg`, 0),
    elevationM: number(v.elevationM, `${path}.elevationM`, 0),
  };
}

function stringMap(value: unknown, path: string): Record<string, string> {
  if (value == null) return {};
  const source = record(value, path);
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(source)) result[key] = string(item, `${path}.${key}`);
  return result;
}

function settingsMap(value: unknown, path: string): Record<string, { scale: number; rotation: number }> {
  if (value == null) return {};
  const source = record(value, path);
  const result: Record<string, { scale: number; rotation: number }> = {};
  for (const [key, item] of Object.entries(source)) {
    const setting = record(item, `${path}.${key}`);
    result[key] = {
      scale: number(setting.scale, `${path}.${key}.scale`, 1),
      rotation: number(setting.rotation, `${path}.${key}.rotation`, 0),
    };
  }
  return result;
}

function parseFloor(value: unknown, path: string): Floor {
  const v = record(value, path);
  const floor: Floor = {
    id: string(v.id, `${path}.id`),
    name: string(v.name, `${path}.name`, 'Pavimento'),
    kind: enumValue(v.kind, ['standard', 'attic'], `${path}.kind`, 'standard'),
    walls: array(v.walls, `${path}.walls`, true).map((item, i) => parseWall(item, `${path}.walls[${i}]`)),
    columns: array(v.columns, `${path}.columns`, true).map((item, i) => parseColumn(item, `${path}.columns[${i}]`)),
    roofs: array(v.roofs, `${path}.roofs`, true).map((item, i) => parseRoof(item, `${path}.roofs[${i}]`)),
    openings: array(v.openings, `${path}.openings`, true).map((item, i) => parseOpening(item, `${path}.openings[${i}]`)),
    varandas: array(v.varandas, `${path}.varandas`, true).map((item, i) => parseVaranda(item, `${path}.varandas[${i}]`)),
    lajes: array(v.lajes, `${path}.lajes`, true).map((item, i) => parseLaje(item, `${path}.lajes[${i}]`)),
    furniture: array(v.furniture, `${path}.furniture`, true).map((item, i) => parseFurniture(item, `${path}.furniture[${i}]`)),
    glazingPanels: array(v.glazingPanels, `${path}.glazingPanels`, true).map((item, i) => parseGlazingPanel(item, `${path}.glazingPanels[${i}]`)),
    roomFinishes: stringMap(v.roomFinishes, `${path}.roomFinishes`),
    roomFinishSettings: settingsMap(v.roomFinishSettings, `${path}.roomFinishSettings`),
  };
  if (floor.kind === 'attic') floor.wallHeightM = number(v.wallHeightM, `${path}.wallHeightM`, 1.2);
  const wallIds = new Set(floor.walls.map((wall) => wall.id));
  floor.openings.forEach((opening, index) => {
    if (!wallIds.has(opening.wallId)) fail(`${path}.openings[${index}].wallId`, 'parede hospedeira não existe');
  });
  floor.glazingPanels.forEach((panel, index) => {
    if (panel.wallId && !wallIds.has(panel.wallId)) fail(`${path}.glazingPanels[${index}].wallId`, 'parede hospedeira não existe');
  });
  const ids = [...floor.walls, ...floor.columns, ...floor.roofs, ...floor.openings, ...floor.varandas, ...floor.lajes, ...floor.furniture, ...floor.glazingPanels].map((item) => item.id);
  if (new Set(ids).size !== ids.length) fail(path, 'há identificadores de entidades duplicados');
  return floor;
}

function normalizeProject(value: unknown): Project {
  const source = record(value, 'project');
  const floors = array(source.floors, 'project.floors').map((floor, index) => parseFloor(floor, `project.floors[${index}]`));
  if (floors.length === 0) fail('project.floors', 'o projeto precisa de pelo menos um pavimento');
  if (floors.length > 100) fail('project.floors', 'limite de 100 pavimentos excedido');
  const rawIndex = number(source.currentFloorIndex, 'project.currentFloorIndex', 0);
  if (!Number.isInteger(rawIndex)) fail('project.currentFloorIndex', 'número inteiro esperado');
  const sourceLayers = source.layers == null ? {} : record(source.layers, 'project.layers');
  const layers = { ...DEFAULT_LAYERS };
  for (const key of Object.keys(DEFAULT_LAYERS) as (keyof ProjectLayers)[]) {
    const value = sourceLayers[key];
    if (value != null && typeof value !== 'boolean') fail(`project.layers.${key}`, 'booleano esperado');
    if (typeof value === 'boolean') layers[key] = value;
  }
  return {
    floors,
    currentFloorIndex: Math.max(0, Math.min(floors.length - 1, rawIndex)),
    layers,
    foundationType: enumValue(source.foundationType, ['radier', 'baldrame'], 'project.foundationType', 'baldrame'),
    constructionSystem: enumValue(
      source.constructionSystem,
      ['ceramic_masonry', 'structural_block', 'light_steel_frame'],
      'project.constructionSystem',
      'ceramic_masonry',
    ),
  };
}

export function encodeProjectDocument(project: Project): StoredProjectDocument {
  return { schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION, project: normalizeProject(project) };
}

export function decodeProjectDocument(value: unknown): DecodedProjectDocument {
  const candidate = record(value, 'document');
  const isEnvelope = Object.prototype.hasOwnProperty.call(candidate, 'schemaVersion');
  const sourceVersion = isEnvelope ? number(candidate.schemaVersion, 'document.schemaVersion') : 0;
  if (!Number.isInteger(sourceVersion) || sourceVersion < 0) fail('document.schemaVersion', 'versão inválida');
  if (sourceVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    fail('document.schemaVersion', `versão ${sourceVersion} é mais nova que a suportada (${CURRENT_PROJECT_SCHEMA_VERSION})`);
  }
  const project = normalizeProject(isEnvelope ? candidate.project : value);
  return { project, sourceVersion, migrated: sourceVersion !== CURRENT_PROJECT_SCHEMA_VERSION };
}

export function exportProjectBackup(project: Project, pretty = true): string {
  return JSON.stringify(encodeProjectDocument(project), null, pretty ? 2 : undefined);
}

export function importProjectBackup(json: string): DecodedProjectDocument {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new ProjectFormatError('O arquivo não contém JSON válido.');
  }
  return decodeProjectDocument(value);
}