import type {
  Column, Floor, Furniture, GlazingPanel, BalconyRailing, VolumeBox, Stair, PlanUnderlay, HydraulicNode, HydraulicSegment, Laje, Opening, Project, ProjectLayers, Roof, Terreno, Varanda, Wall, ForroBoardType, CommercialSelection,
} from './types.js';

// v6: adiciona `project.terreno` (opcional) — tamanho do lote e muros de
// perímetro. Documentos v5 e anteriores não têm o campo; abrem
// normalmente sem terreno definido (ver ADR-008).
// v8: adiciona `ownerFixtureId` opcional em HydraulicNode/HydraulicSegment,
// usado pelo percurso guiado de água fria (H2) para saber quais nós/trechos
// pertencem ao roteamento manual de qual ponto de consumo. Documentos v7 e
// anteriores continuam abrindo normalmente, sem essa marcação (ver DEC-61).
// v9: adiciona `guided` opcional em HydraulicNode/HydraulicSegment — distingue
// percurso desenhado à mão (H2) do traçado ingênuo automático, que também usa
// `ownerFixtureId` mas deve poder ser regenerado (ex.: ao mover a origem/caixa
// d'água, DEC-116). Documentos v8 e anteriores abrem normalmente sem a
// marcação — seus trechos ingênuos antigos passam a se comportar como
// regeneráveis (correto), e trechos guiados antigos só voltam a ficar
// protegidos contra sobrescrita depois de redesenhados uma vez nesta versão.
// v10: adiciona `normalSign` opcional em GlazingPanel, mesmo campo que
// VolumeBox já tinha — corrige o vidro nascendo virado pra dentro da casa em
// painéis já salvos antes desta versão (DEC-118). Documentos v9 e anteriores
// abrem normalmente; sem o campo, o painel usa o sinal padrão (+1) até ser
// reanexado a uma parede, quando passa a gravar o lado correto.
// v11: adiciona `floor.balconyRailings` (Sacada de vidro, categoria
// Aberturas) — mesmo espírito de GlazingPanel, mas sem máquina de
// estados preview/attached (nunca encosta em parede, ver Core.ts).
// Documentos v10 e anteriores abrem normalmente, sem nenhuma sacada
// (lista vazia).
// v12: adiciona `sillHeightM` opcional em BalconyRailing — Product
// Owner pediu alça embaixo pra subir/descer a peça inteira, além da de
// cima pra esticar a altura. Documentos v11 e anteriores abrem
// normalmente; sem o campo, a sacada nasce no piso (sillHeightM = 0).
// v13: VolumeBox perde a máquina de estados preview/attached (campos
// state/wallId/offsetM/normalSign) — Product Owner pediu bloco sempre
// livre, sem ímã de parede, com alças em todas as direções, mais
// `finishProductId` novo (acabamento tipo parede, categoria "paint").
// Documentos v12 e anteriores abrem normalmente; um volume que estava
// 'attached' abre solto na origem (0,0) — reposicionar é rápido.
// v14: HydraulicNetworkType ganha 'rainwater' (sistema de esgoto e
// pluvial, sem inclinação — Product Owner pediu; `kind: 'destination'`
// passa a ser instanciado de verdade: caixa de gordura/inspeção/saída
// pluvial). Documentos v13 e anteriores abrem normalmente, sem nenhum
// nó/segmento desses tipos (listas vazias/inexistentes).
// v15: `Floor.stairs` novo — escada (modelo reto), posição/largura
// livres, rotação em passos de 90°. Documentos v14 e anteriores abrem
// normalmente, sem nenhuma escada (lista vazia).
// v16: adiciona `Floor.roomForroGenerated` (opcional, mesmo padrão de
// roomLajeGenerated) e `ProjectLayers.forroDrywall` — botão/layer do forro
// de drywall procedural. Documentos v15 e anteriores continuam abrindo
// normalmente, sem forro gerado em nenhum cômodo.
// v17: adiciona `Floor.roomForroTipo` (opcional) — tipo de placa do forro
// por roomKey (ST/RU/RF/cimenticia), escolhido no painel que aparece ao
// selecionar o forro. Documentos v16 e anteriores abrem normalmente; sem
// o campo, todo forro usa o tipo padrão ST.
// v18: adiciona `Project.commercialSelections`, snapshots das ofertas
// escolhidas por alvo aplicado. Projetos anteriores seguem sem escolhas.
export const CURRENT_PROJECT_SCHEMA_VERSION = 18;

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
  forroDrywall: true,
  paredesSuperiores: true,
  aberturas: true,
  varanda: true,
  instalacoes: true,
  paredesTransparentes: false,
  niveisSuperiores: true,
};

function parseHydraulicNode(value: unknown, path: string): HydraulicNode {
  const v = record(value, path);
  const node: HydraulicNode = {
    id: string(v.id, `${path}.id`),
    kind: enumValue(v.kind, ['source', 'fixture', 'junction', 'destination'], `${path}.kind`, 'junction'),
    networkType: enumValue(v.networkType, ['cold_water', 'sanitary_sewer', 'kitchen_sewer', 'sanitary_vent', 'rainwater'], `${path}.networkType`, 'cold_water'),
    label: string(v.label, `${path}.label`, 'Ponto hidráulico'),
    x: number(v.x, `${path}.x`), y: number(v.y, `${path}.y`),
    elevationM: number(v.elevationM, `${path}.elevationM`, 0),
  };
  if (v.floorIndex != null) {
    const floorIndex = number(v.floorIndex, `${path}.floorIndex`, 0);
    if (!Number.isInteger(floorIndex) || floorIndex < 0) fail(`${path}.floorIndex`, 'pavimento inválido');
    node.floorIndex = floorIndex;
  }
  const equipmentId = optionalString(v.equipmentId, `${path}.equipmentId`);
  const connectorKey = optionalString(v.connectorKey, `${path}.connectorKey`);
  const fixtureType = optionalString(v.fixtureType, `${path}.fixtureType`);
  const wallId = optionalString(v.wallId, `${path}.wallId`);
  const ownerFixtureId = optionalString(v.ownerFixtureId, `${path}.ownerFixtureId`);
  const placementSurface = v.placementSurface == null ? undefined
    : enumValue(v.placementSurface, ['wall', 'floor'], `${path}.placementSurface`, 'wall');
  if (equipmentId !== undefined) node.equipmentId = equipmentId;
  if (connectorKey !== undefined) node.connectorKey = connectorKey;
  if (fixtureType !== undefined) node.fixtureType = fixtureType;
  if (wallId !== undefined) node.wallId = wallId;
  if (ownerFixtureId !== undefined) node.ownerFixtureId = ownerFixtureId;
  if (placementSurface !== undefined) node.placementSurface = placementSurface;
  if (v.guided === true) node.guided = true;
  if (v.wallFaceSide != null) {
    const wallFaceSide = number(v.wallFaceSide, `${path}.wallFaceSide`);
    if (wallFaceSide !== -1 && wallFaceSide !== 1) fail(`${path}.wallFaceSide`, 'face da parede inválida');
    node.wallFaceSide = wallFaceSide;
  }
  return node;
}

function parseHydraulicSegment(value: unknown, path: string): HydraulicSegment {
  const v = record(value, path);
  const diameterMm = number(v.diameterMm, `${path}.diameterMm`);
  if (!(diameterMm > 0 && diameterMm <= 1000)) fail(`${path}.diameterMm`, 'diâmetro fora do intervalo suportado');
  const segment: HydraulicSegment = {
    id: string(v.id, `${path}.id`),
    networkType: enumValue(v.networkType, ['cold_water', 'sanitary_sewer', 'kitchen_sewer', 'sanitary_vent', 'rainwater'], `${path}.networkType`, 'cold_water'),
    startNodeId: string(v.startNodeId, `${path}.startNodeId`),
    endNodeId: string(v.endNodeId, `${path}.endNodeId`),
    diameterMm,
  };
  const ownerFixtureId = optionalString(v.ownerFixtureId, `${path}.ownerFixtureId`);
  if (ownerFixtureId !== undefined) segment.ownerFixtureId = ownerFixtureId;
  if (v.guided === true) segment.guided = true;
  return segment;
}

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
  const heightM = optionalNumber(v.heightM, `${path}.heightM`);
  const faceAAssemblyId = optionalString(v.faceAAssemblyId, `${path}.faceAAssemblyId`);
  const faceBAssemblyId = optionalString(v.faceBAssemblyId, `${path}.faceBAssemblyId`);
  if (finishA !== undefined) wall.finishA = finishA;
  if (finishB !== undefined) wall.finishB = finishB;
  if (heightM !== undefined) wall.heightM = heightM;
  if (faceAAssemblyId !== undefined) wall.faceAAssemblyId = faceAAssemblyId;
  if (faceBAssemblyId !== undefined) wall.faceBAssemblyId = faceBAssemblyId;
  if (v.cavityAssembly != null) {
    const cavity = record(v.cavityAssembly, `${path}.cavityAssembly`);
    const thicknessMm = number(cavity.thicknessMm, `${path}.cavityAssembly.thicknessMm`);
    if (thicknessMm < 0) fail(`${path}.cavityAssembly.thicknessMm`, 'espessura não pode ser negativa');
    wall.cavityAssembly = {
      insulationSystemId: string(cavity.insulationSystemId, `${path}.cavityAssembly.insulationSystemId`),
      thicknessMm,
      purpose: enumValue(cavity.purpose, ['thermal', 'acoustic', 'thermal_acoustic'], `${path}.cavityAssembly.purpose`),
    };
  }
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
    gableFaceAAssemblyId: optionalString(v.gableFaceAAssemblyId, `${path}.gableFaceAAssemblyId`),
    gableFaceBAssemblyId: optionalString(v.gableFaceBAssemblyId, `${path}.gableFaceBAssemblyId`),
    soffitAssemblyId: optionalString(v.soffitAssemblyId, `${path}.soffitAssemblyId`),
    fasciaAssemblyId: optionalString(v.fasciaAssemblyId, `${path}.fasciaAssemblyId`),
    parapetOuterAssemblyId: optionalString(v.parapetOuterAssemblyId, `${path}.parapetOuterAssemblyId`),
    parapetInnerAssemblyId: optionalString(v.parapetInnerAssemblyId, `${path}.parapetInnerAssemblyId`),
    compoundGroupId: optionalString(v.compoundGroupId, `${path}.compoundGroupId`),
    steppedLowerRoofId: optionalString(v.steppedLowerRoofId, `${path}.steppedLowerRoofId`),
    atticMode: v.atticMode == null ? undefined : enumValue(v.atticMode, ['preview', 'generated'], `${path}.atticMode`),
  };
  for (const [key, item] of Object.entries(optionalFields)) {
    if (item !== undefined) (roof as unknown as Record<string, unknown>)[key] = item;
  }
  if (roof.atticMode || roof.steppedLowerRoofId) {
    roof.baseHeightM = number(v.baseHeightM, `${path}.baseHeightM`, 1.2);
  }
  // Projetos antigos vinculavam o telhado elevado ao telhado baixo. Ao
  // carregar, convertemos o vínculo para o novo volume autônomo.
  if (v.steppedWallVolume === true || roof.steppedLowerRoofId) {
    roof.steppedWallVolume = true;
    delete roof.steppedLowerRoofId;
    delete roof.compoundGroupId;
    roof.baseHeightM = number(v.baseHeightM, `${path}.baseHeightM`, 3.15);
  }
  if (roof.atticMode) {
    roof.atticWallIds = array(v.atticWallIds, `${path}.atticWallIds`, true).map((id, index) => string(id, `${path}.atticWallIds[${index}]`));
  }
  return roof;
}

function parseOpening(value: unknown, path: string): Opening {
  const v = record(value, path);
  const productId = optionalString(v.productId, `${path}.productId`);
  return {
    id: string(v.id, `${path}.id`),
    kind: enumValue(v.kind, ['door', 'window', 'arco'], `${path}.kind`),
    wallId: string(v.wallId, `${path}.wallId`),
    offset: number(v.offset, `${path}.offset`), width: number(v.width, `${path}.width`),
    height: number(v.height, `${path}.height`), sillHeight: number(v.sillHeight, `${path}.sillHeight`),
    ...(productId !== undefined ? { productId } : {}),
  };
}

function parseVaranda(value: unknown, path: string): Varanda {
  const v = record(value, path);
  const contourSegments = array(v.contourSegments, `${path}.contourSegments`, true).map((item, index) => {
    const segment = record(item, `${path}.contourSegments[${index}]`);
    return {
      wallId: string(segment.wallId, `${path}.contourSegments[${index}].wallId`),
      x1: number(segment.x1, `${path}.contourSegments[${index}].x1`), y1: number(segment.y1, `${path}.contourSegments[${index}].y1`),
      x2: number(segment.x2, `${path}.contourSegments[${index}].x2`), y2: number(segment.y2, `${path}.contourSegments[${index}].y2`),
      outwardSign: number(segment.outwardSign, `${path}.contourSegments[${index}].outwardSign`) >= 0 ? 1 as const : -1 as const,
    };
  });
  const result: Varanda = {
    id: string(v.id, `${path}.id`),
    x1: number(v.x1, `${path}.x1`), y1: number(v.y1, `${path}.y1`),
    x2: number(v.x2, `${path}.x2`), y2: number(v.y2, `${path}.y2`),
    frontSide: enumValue(v.frontSide, ['minZ', 'maxZ', 'minX', 'maxX'], `${path}.frontSide`, 'minZ'),
  };
  if (contourSegments.length) result.contourSegments = contourSegments;
  if (v.widthM != null) result.widthM = number(v.widthM, `${path}.widthM`);
  if (v.postMaterial != null) result.postMaterial = enumValue(v.postMaterial, ['madeira', 'concreto', 'tijolo'], `${path}.postMaterial`);
  if (v.heightM != null) result.heightM = number(v.heightM, `${path}.heightM`);
  if (v.pitchDeg != null) result.pitchDeg = number(v.pitchDeg, `${path}.pitchDeg`);
  if (v.attachedWallId != null) result.attachedWallId = string(v.attachedWallId, `${path}.attachedWallId`);
  return result;
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
  const normalSign = optionalNumber(v.normalSign, `${path}.normalSign`);
  if (v.glassMaterial != null) {
    const material = record(v.glassMaterial, `${path}.glassMaterial`);
    const color = string(material.color, `${path}.glassMaterial.color`);
    if (!/^#[0-9a-f]{6}$/i.test(color)) fail(`${path}.glassMaterial.color`, 'cor deve estar no formato #RRGGBB');
    panel.glassMaterial = {
      color,
      opacity: number(material.opacity, `${path}.glassMaterial.opacity`, 1),
      roughness: number(material.roughness, `${path}.glassMaterial.roughness`, 0.1),
      metalness: number(material.metalness, `${path}.glassMaterial.metalness`, 0.72),
      reflectionIntensity: number(material.reflectionIntensity, `${path}.glassMaterial.reflectionIntensity`, 1.65),
    };
  }
  if (wallId !== undefined) panel.wallId = wallId;
  if (offsetM !== undefined) panel.offsetM = offsetM;
  if (sillHeightM !== undefined) panel.sillHeightM = sillHeightM;
  if (x !== undefined) panel.x = x;
  if (y !== undefined) panel.y = y;
  if (rotationDeg !== undefined) panel.rotationDeg = rotationDeg;
  if (normalSign !== undefined) panel.normalSign = normalSign < 0 ? -1 : 1;
  if (panel.state === 'attached' && !panel.wallId) fail(`${path}.wallId`, 'painel anexado precisa de parede hospedeira');
  return panel;
}

function parseBalconyRailing(value: unknown, path: string): BalconyRailing {
  const v = record(value, path);
  const railing: BalconyRailing = {
    id: string(v.id, `${path}.id`),
    x: number(v.x, `${path}.x`),
    y: number(v.y, `${path}.y`),
    rotationDeg: number(v.rotationDeg, `${path}.rotationDeg`, 0),
    widthM: number(v.widthM, `${path}.widthM`),
    heightM: number(v.heightM, `${path}.heightM`),
    moduleTargetM: number(v.moduleTargetM, `${path}.moduleTargetM`, 1.0),
  };
  const sillHeightM = optionalNumber(v.sillHeightM, `${path}.sillHeightM`);
  if (sillHeightM !== undefined) railing.sillHeightM = sillHeightM;
  if (v.glassMaterial != null) {
    const material = record(v.glassMaterial, `${path}.glassMaterial`);
    const color = string(material.color, `${path}.glassMaterial.color`);
    if (!/^#[0-9a-f]{6}$/i.test(color)) fail(`${path}.glassMaterial.color`, 'cor deve estar no formato #RRGGBB');
    railing.glassMaterial = {
      color,
      opacity: number(material.opacity, `${path}.glassMaterial.opacity`, 0.116),
      roughness: number(material.roughness, `${path}.glassMaterial.roughness`, 0.2),
      metalness: number(material.metalness, `${path}.glassMaterial.metalness`, 0),
      reflectionIntensity: number(material.reflectionIntensity, `${path}.glassMaterial.reflectionIntensity`, 1),
    };
  }
  return railing;
}

function parseVolumeBox(value: unknown, path: string): VolumeBox {
  const v = record(value, path);
  const box: VolumeBox = {
    id: string(v.id, `${path}.id`),
    // v13: campos de encosto em parede (state/wallId/offsetM/normalSign)
    // removidos — Product Owner pediu bloco sempre livre ("tirar o imã
    // e fazer as alças em todas as direções"). Documentos salvos antes
    // desta versão com um volume 'attached' (sem x/y próprios, só
    // wallId+offsetM) abrem soltos na origem — reposicionar é rápido, e
    // reconstituir a posição exata exigiria reabrir a parede hospedeira
    // aqui, fora do escopo deste parser.
    x: optionalNumber(v.x, `${path}.x`) ?? 0,
    y: optionalNumber(v.y, `${path}.y`) ?? 0,
    rotationDeg: number(v.rotationDeg, `${path}.rotationDeg`, 0),
    widthM: number(v.widthM, `${path}.widthM`),
    heightM: number(v.heightM, `${path}.heightM`),
    depthM: number(v.depthM, `${path}.depthM`, 0.3),
  };
  const colorHex = optionalString(v.colorHex, `${path}.colorHex`);
  const sillHeightM = optionalNumber(v.sillHeightM, `${path}.sillHeightM`);
  const finishProductId = optionalString(v.finishProductId, `${path}.finishProductId`);
  if (colorHex !== undefined) box.colorHex = colorHex;
  if (sillHeightM !== undefined) box.sillHeightM = sillHeightM;
  if (finishProductId !== undefined) box.finishProductId = finishProductId;
  return box;
}

function parseStair(value: unknown, path: string): Stair {
  const v = record(value, path);
  const stair: Stair = {
    id: string(v.id, `${path}.id`),
    x: number(v.x, `${path}.x`),
    y: number(v.y, `${path}.y`),
    rotationDeg: number(v.rotationDeg, `${path}.rotationDeg`, 0),
    model: enumValue(v.model, ['reta', 'L', 'U'], `${path}.model`, 'reta'),
    widthM: number(v.widthM, `${path}.widthM`),
  };
  const colorHex = optionalString(v.colorHex, `${path}.colorHex`);
  const finishProductId = optionalString(v.finishProductId, `${path}.finishProductId`);
  if (colorHex !== undefined) stair.colorHex = colorHex;
  if (finishProductId !== undefined) stair.finishProductId = finishProductId;
  return stair;
}

// Planta baixa importada — dataURL pode ser um texto BEM grande (uma
// imagem inteira em base64); tratado como uma string comum igual
// qualquer outra, sem limite especial — o projeto inteiro já vira um
// JSON grande quando tem fotos/materiais customizados, essa não é a
// primeira vez.
function parsePlanUnderlay(value: unknown, path: string): PlanUnderlay {
  const v = record(value, path);
  const naturalAspect = number(v.naturalAspect, `${path}.naturalAspect`, 1);
  return {
    id: string(v.id, `${path}.id`),
    imageDataUrl: string(v.imageDataUrl, `${path}.imageDataUrl`),
    naturalAspect: naturalAspect > 0 ? naturalAspect : 1,
    widthM: number(v.widthM, `${path}.widthM`),
    heightM: number(v.heightM, `${path}.heightM`),
    x: number(v.x, `${path}.x`),
    y: number(v.y, `${path}.y`),
    rotationDeg: number(v.rotationDeg, `${path}.rotationDeg`, 0),
    opacity: number(v.opacity, `${path}.opacity`, 0.65),
    visible: v.visible !== false,
  };
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

function booleanMap(value: unknown, path: string): Record<string, boolean> {
  if (value == null) return {};
  const source = record(value, path);
  const result: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(source)) {
    if (typeof item === 'boolean') result[key] = item;
  }
  return result;
}

const FORRO_BOARD_TYPES = ['ST', 'RU', 'RF', 'cimenticia'] as const;

function forroTipoMap(value: unknown, path: string): Record<string, ForroBoardType> {
  if (value == null) return {};
  const source = record(value, path);
  const result: Record<string, ForroBoardType> = {};
  for (const [key, item] of Object.entries(source)) {
    if (typeof item === 'string' && (FORRO_BOARD_TYPES as readonly string[]).includes(item)) {
      result[key] = item as ForroBoardType;
    }
  }
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

function commercialSelectionsMap(value: unknown, path: string): Record<string, CommercialSelection> {
  if (value == null) return {};
  const source = record(value, path);
  const result: Record<string, CommercialSelection> = {};
  for (const [key, item] of Object.entries(source)) {
    const v = record(item, `${path}.${key}`);
    const supplierSku = optionalString(v.supplierSku, `${path}.${key}.supplierSku`);
    result[key] = {
      productId: string(v.productId, `${path}.${key}.productId`),
      offerId: string(v.offerId, `${path}.${key}.offerId`),
      supplierId: string(v.supplierId, `${path}.${key}.supplierId`),
      supplierName: string(v.supplierName, `${path}.${key}.supplierName`),
      ...(supplierSku ? { supplierSku } : {}),
      price: number(v.price, `${path}.${key}.price`),
      currency: string(v.currency, `${path}.${key}.currency`),
      region: string(v.region, `${path}.${key}.region`),
      priceDate: string(v.priceDate, `${path}.${key}.priceDate`),
      kind: enumValue(v.kind, ['official', 'market_reference'], `${path}.${key}.kind`),
      selectedAt: string(v.selectedAt, `${path}.${key}.selectedAt`),
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
    balconyRailings: array(v.balconyRailings, `${path}.balconyRailings`, true).map((item, i) => parseBalconyRailing(item, `${path}.balconyRailings[${i}]`)),
    volumeBoxes: array(v.volumeBoxes, `${path}.volumeBoxes`, true).map((item, i) => parseVolumeBox(item, `${path}.volumeBoxes[${i}]`)),
    stairs: array(v.stairs, `${path}.stairs`, true).map((item, i) => parseStair(item, `${path}.stairs[${i}]`)),
    roomFinishes: stringMap(v.roomFinishes, `${path}.roomFinishes`),
    roomFinishSettings: settingsMap(v.roomFinishSettings, `${path}.roomFinishSettings`),
  };
  // Só entra no objeto quando existe de verdade — mesmo padrão de
  // wallHeightM logo abaixo (campo opcional, não "sempre null"), pra
  // não acrescentar uma chave nova em todo projeto salvo antes desta
  // feature existir (e não quebrar o teste de round-trip que compara
  // o projeto serializado com um molde fixo).
  if (v.planUnderlay) floor.planUnderlay = parsePlanUnderlay(v.planUnderlay, `${path}.planUnderlay`);
  if (floor.kind === 'attic') floor.wallHeightM = number(v.wallHeightM, `${path}.wallHeightM`, 1.2);
  if (v.roomLajeGenerated) floor.roomLajeGenerated = booleanMap(v.roomLajeGenerated, `${path}.roomLajeGenerated`);
  if (v.roomBaseLajeGenerated) floor.roomBaseLajeGenerated = booleanMap(v.roomBaseLajeGenerated, `${path}.roomBaseLajeGenerated`);
  if (v.roomForroGenerated) floor.roomForroGenerated = booleanMap(v.roomForroGenerated, `${path}.roomForroGenerated`);
  if (v.roomForroTipo) floor.roomForroTipo = forroTipoMap(v.roomForroTipo, `${path}.roomForroTipo`);
  const wallIds = new Set(floor.walls.map((wall) => wall.id));
  floor.openings.forEach((opening, index) => {
    if (!wallIds.has(opening.wallId)) fail(`${path}.openings[${index}].wallId`, 'parede hospedeira não existe');
  });
  floor.glazingPanels.forEach((panel, index) => {
    if (panel.wallId && !wallIds.has(panel.wallId)) fail(`${path}.glazingPanels[${index}].wallId`, 'parede hospedeira não existe');
  });
  const ids = [...floor.walls, ...floor.columns, ...floor.roofs, ...floor.openings, ...floor.varandas, ...floor.lajes, ...floor.furniture, ...floor.glazingPanels, ...floor.balconyRailings, ...floor.volumeBoxes].map((item) => item.id);
  if (new Set(ids).size !== ids.length) fail(path, 'há identificadores de entidades duplicados');
  return floor;
}

const TERRENO_MURO_SIDES = ['minX', 'maxX', 'minZ', 'maxZ'] as const;

function parseTerreno(value: unknown, path: string): Terreno {
  const v = record(value, path);
  const larguraM = number(v.larguraM, `${path}.larguraM`);
  const comprimentoM = number(v.comprimentoM, `${path}.comprimentoM`);
  if (!(larguraM > 0) || !(comprimentoM > 0)) fail(path, 'largura e comprimento devem ser maiores que zero');
  const muros = array(v.muros, `${path}.muros`, true).map((item, i) => parseWall(item, `${path}.muros[${i}]`));
  // Cada muro só faz sentido geométrico associado a um lado do
  // retângulo — o id é a fonte da verdade de qual lado é (ver
  // Core.terrenoMuroId), não a posição bruta salva.
  const ids = muros.map((m) => m.id);
  if (new Set(ids).size !== ids.length) fail(`${path}.muros`, 'há muros duplicados');
  ids.forEach((id, index) => {
    if (!TERRENO_MURO_SIDES.some((side) => `terreno_muro_${side}` === id)) {
      fail(`${path}.muros[${index}].id`, 'muro de terreno com id fora do padrão esperado');
    }
  });
  return { larguraM, comprimentoM, muros };
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
  const project: Project = {
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
    hydraulics: { nodes: [], segments: [] },
  };
  if (source.hydraulics != null) {
    const hydraulics = record(source.hydraulics, 'project.hydraulics');
    project.hydraulics = {
      nodes: array(hydraulics.nodes, 'project.hydraulics.nodes', true).map((item, i) => parseHydraulicNode(item, `project.hydraulics.nodes[${i}]`)),
      segments: array(hydraulics.segments, 'project.hydraulics.segments', true).map((item, i) => parseHydraulicSegment(item, `project.hydraulics.segments[${i}]`)),
    };
    const nodeIds = new Set(project.hydraulics.nodes.map((node) => node.id));
    if (nodeIds.size !== project.hydraulics.nodes.length) fail('project.hydraulics.nodes', 'há identificadores duplicados');
    const fixtureNodeIds = new Set(project.hydraulics.nodes.filter((node) => node.kind === 'fixture').map((node) => node.id));
    project.hydraulics.nodes.forEach((node, index) => {
      if (node.ownerFixtureId !== undefined && !fixtureNodeIds.has(node.ownerFixtureId)) fail(`project.hydraulics.nodes[${index}]`, 'ownerFixtureId referencia ponto de consumo inexistente');
    });
    project.hydraulics.segments.forEach((segment, index) => {
      if (!nodeIds.has(segment.startNodeId) || !nodeIds.has(segment.endNodeId)) fail(`project.hydraulics.segments[${index}]`, 'segmento referencia ponto inexistente');
      if (segment.ownerFixtureId !== undefined && !fixtureNodeIds.has(segment.ownerFixtureId)) fail(`project.hydraulics.segments[${index}]`, 'ownerFixtureId referencia ponto de consumo inexistente');
    });
  }
  if (source.terreno != null) project.terreno = parseTerreno(source.terreno, 'project.terreno');
  if (source.commercialSelections != null) project.commercialSelections = commercialSelectionsMap(source.commercialSelections, 'project.commercialSelections');
  return project;
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
