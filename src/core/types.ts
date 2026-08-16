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
  // Altura própria, em metros — só usada por muros de terreno
  // (Terreno.muros). Paredes da casa (Floor.walls) ignoram este campo e
  // continuam com a altura fixa Core.WALL_HEIGHT.
  heightM?: number;
  // "Quebrar parede" (ferramenta demolish) NÃO remove a parede do
  // modelo — só marca ela como demolida. Continua entrando em
  // computeWallFootprints/detectRooms (senão o cômodo perderia o
  // fechamento e o piso desapareceria — era exatamente esse o problema
  // do comportamento antigo, que chamava deleteWall de verdade), mas
  // para de ser desenhada (Scene3DRenderer/Scene2DRenderer pulam ela) e
  // para de contar em qualquer quantitativo/orçamento (MaterialsPanel).
  demolished?: boolean;
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
  /** Fluxo paramétrico do ático: prévia transparente ou recorte confirmado. */
  atticMode?: 'preview' | 'generated';
  /** Altura do beiral em relação ao piso do pavimento, em metros. */
  baseHeightM?: number;
  /** Paredes controladas por este ático após a confirmação. */
  atticWallIds?: string[];
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

// Terreno (lote) — ver docs/02 - Domínio/Modelo de Domínio.md, seção 5, e
// ADR-008. Retângulo com origem em (0,0): largura no eixo X, comprimento
// no eixo Z (chamado 'y' no plano 2D, mesma convenção de Wall/Varanda).
// Definir o terreno é opcional e pode ser feito a qualquer momento do
// projeto, não só na criação.
export type TerrenoMuroSide = 'minX' | 'maxX' | 'minZ' | 'maxZ';

export interface Terreno {
  larguraM: number;
  comprimentoM: number;
  // Um Wall por lado com muro confirmado pelo usuário — reaproveita o
  // mesmo tipo de parede da casa (aceita Opening — portão/porta — e
  // acabamento por face). Vive fora de Floor.walls de propósito: um muro
  // de terreno não fecha com as paredes da casa, então não deve entrar
  // na detecção de cômodos nem na validação topológica da Casa. O id de
  // cada muro é determinístico (`terreno_muro_<side>`), então cada lado
  // tem no máximo um muro.
  muros: Wall[];
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
  /** Produto do Catálogo (categoria 'door'/'window') com modelo glTF —
   *  quando presente, o modelo substitui a geometria procedural padrão
   *  (batente/folha/vidro gerados na hora). Ausente = comportamento de
   *  sempre, sem mudança nenhuma. */
  productId?: string;
}

export type FloorKind = 'standard' | 'attic';

// Painel de Envidraçamento (categoria "Envidraçamento", ferramenta
// "Fachada" — DEC-56, substitui o campo Wall.glazingModuleWidthM do
// DEC-55). Mesmo espírito de objeto livre de Laje: nasce solto na
// viewport (`state: 'preview'`), redimensiona por arraste de borda
// (widthM/heightM). Ao encostar numa parede e confirmar, grava
// wallId/offsetM/sillHeightM e vira `state: 'attached'` — nesse
// momento widthM/heightM ficam travados no limite da parede
// hospedeira. O painel NÃO cria Opening nem afeta o quantitativo de
// alvenaria: a parede hospedeira continua contando como se estivesse
// inteira; só a malha 3D visível é que pula o trecho coberto pelo
// painel (técnica de banda já usada por Opening/buildWallOpeningBands,
// reaplicada sem gerar uma entidade Opening de verdade).
export type GlazingPanelState = 'preview' | 'attached';

export interface GlazingGlassMaterial {
  color: string;
  opacity: number;
  roughness: number;
  metalness: number;
  reflectionIntensity: number;
}

export interface GlazingPanel {
  id: string;
  state: GlazingPanelState;
  widthM: number;
  heightM: number;
  /** Largura-alvo do módulo (vidro + junta), configurável na interface — mantém a simetria do grid. */
  moduleTargetM: number;
  /** Ajuste visual próprio; ausente significa usar o padrão oficial da plataforma. */
  glassMaterial?: GlazingGlassMaterial;
  // Posição/orientação do painel enquanto solto (state === 'preview')
  // — mesma unidade de grade de Wall.x1/y1 e Furniture.x/y (20 =
  // 1 metro), não metros direto (diferente de widthM/heightM, que são
  // o TAMANHO do painel, sempre em metros). Deixam de ser usados
  // assim que o painel vira 'attached' (posição passa a vir de
  // wallId + offsetM).
  x?: number;
  y?: number;
  rotationDeg?: number;
  // Só existem quando state === 'attached':
  wallId?: string;
  /** Distância ao longo da parede, mesma convenção de Opening.offset. */
  offsetM?: number;
  /** Altura da base do painel em relação ao piso — 0 = do chão ao teto. */
  sillHeightM?: number;
}

// Bloco de Volumetria (fachada procedural) — box sólido que nasce
// solto ("preview") e pode ser arrastado até encostar numa parede
// ("attached"), mesmo espírito de state machine do GlazingPanel acima.
// Diferença chave: em vez de recortar a parede como um vão (a técnica
// de banda usada por Opening/GlazingPanel), o volume PROTRAI pra fora
// da face externa da parede — normalSign guarda de qual lado do eixo
// da parede ele nasceu, decidido uma única vez no momento do encosto
// (attachVolumeBoxToWall), pra saber pra que lado protrair depois.
export type VolumeBoxState = 'preview' | 'attached';

export interface VolumeBox {
  id: string;
  state: VolumeBoxState;
  widthM: number;
  heightM: number;
  /** Profundidade da protrusão a partir da face da parede, em metros. */
  depthM: number;
  colorHex?: string;
  // Posição/orientação enquanto solto (state === 'preview') — mesma
  // unidade de grade de Wall.x1/y1 (20 = 1 metro). Deixam de ser
  // usados assim que vira 'attached'.
  x?: number;
  y?: number;
  rotationDeg?: number;
  // Só existem quando state === 'attached':
  wallId?: string;
  /** Distância ao longo da parede, mesma convenção de Opening.offset. */
  offsetM?: number;
  /** Altura da base do volume em relação ao piso — 0 = nível do chão. */
  sillHeightM?: number;
  /** De qual lado do eixo da parede o volume protrai (+1 ou -1). */
  normalSign?: 1 | -1;
}

// Planta baixa importada (imagem, ou primeira página de um PDF já
// rasterizada) — vira uma referência visual no CHÃO do pavimento, pra
// o Product Owner desenhar as paredes por cima em vez de medir tudo do
// zero. Uma por pavimento (não uma lista — não faz sentido ter duas
// plantas de referência sobrepostas no mesmo andar). Nasce com um
// tamanho padrão (10m de largura, mantendo a proporção original da
// imagem) e é ajustada por PASSO FIXO (mover/girar/escalar), mesmo
// espírito dos botões do Bloco de Volumetria — arrastar de verdade
// fica pra uma etapa futura (ver DEC).
export interface PlanUnderlay {
  id: string;
  imageDataUrl: string;
  /** Proporção largura/altura da imagem original — preservada ao escalar. */
  naturalAspect: number;
  widthM: number;
  heightM: number;
  /** Centro, mesma unidade de grade de Wall.x1/y1 (GRID=20 por metro). */
  x: number;
  y: number;
  rotationDeg: number;
  opacity: number;
  visible: boolean;
}

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
  glazingPanels: GlazingPanel[];
  volumeBoxes: VolumeBox[];
  planUnderlay?: PlanUnderlay | null;
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
  instalacoes: boolean;
}

export type HydraulicNetworkType = 'cold_water' | 'sanitary_sewer' | 'kitchen_sewer' | 'sanitary_vent';
export type HydraulicNodeKind = 'source' | 'fixture' | 'junction' | 'destination';
export type HydraulicPlacementSurface = 'wall' | 'floor';

export interface HydraulicNode {
  id: string;
  kind: HydraulicNodeKind;
  networkType: HydraulicNetworkType;
  label: string;
  /** Coordenadas de planta na mesma grade das paredes (20 unidades = 1 m). */
  x: number;
  y: number;
  /** Altura em metros a partir do piso do pavimento. */
  elevationM: number;
  floorIndex?: number;
  fixtureType?: string;
  placementSurface?: HydraulicPlacementSurface;
  wallId?: string;
  /** Face visual da parede. Permite escolher o lado em paredes compartilhadas. */
  wallFaceSide?: 1 | -1;
  equipmentId?: string;
  connectorKey?: string;
  /** Presente somente em pontos-guia (junctions) criados por um percurso manual (H2). Identifica a `fixture` dona do trecho, para permitir substituir só aquele percurso ao redesenhar. */
  ownerFixtureId?: string;
}

export interface HydraulicSegment {
  id: string;
  networkType: HydraulicNetworkType;
  startNodeId: string;
  endNodeId: string;
  diameterMm: number;
  /** Mesma finalidade de `HydraulicNode.ownerFixtureId`, aplicada ao trecho. */
  ownerFixtureId?: string;
}

export type HydraulicJunctionKind = 'straight' | 'elbow45' | 'elbow90' | 'tee' | 'cross' | 'end';

export interface HydraulicSystem {
  nodes: HydraulicNode[];
  segments: HydraulicSegment[];
}

export type FoundationType = 'radier' | 'baldrame';
export type ConstructionSystem = 'ceramic_masonry' | 'structural_block' | 'light_steel_frame';

export interface Project {
  floors: Floor[];
  currentFloorIndex: number;
  layers: ProjectLayers;
  foundationType: FoundationType;
  constructionSystem: ConstructionSystem;
  hydraulics: HydraulicSystem;
  // Opcional: ausente até o usuário definir o tamanho do terreno.
  terreno?: Terreno;
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

export type ProductCategory = 'paint' | 'floor_tile' | 'roof_tile' | 'trim' | 'furniture' | 'door' | 'window';

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
  // Tamanho real medido do modelo (door/window) — usado pra criar a
  // Opening já do tamanho certo na hora do clique, sem precisar esperar
  // o glTF carregar de forma assíncrona (o carregamento em si continua
  // assíncrono só pra aparecer visualmente; a largura/altura salva na
  // Opening não depende disso).
  nominalWidthM?: number;
  nominalHeightM?: number;
  // Caminho de uma imagem de referência (relativo a public/, sem barra
  // inicial) pra mostrar como miniatura no seletor — opcional; sem ela,
  // o seletor mostra só o nome/tamanho em texto.
  thumbnailUrl?: string | null;
}

export interface Product {
  id: string;
  name: string;
  manufacturer: string;
  category: ProductCategory;
  commercial: ProductCommercial;
  assets: ProductAssets;
  // Só relevante pra 'door'/'window' — agrupa o seletor por tipo de
  // material do caixilho, espelhando a taxonomia real de catálogo de
  // esquadria (vidro, alumínio, PVC, madeira).
  frameMaterial?: 'vidro' | 'aluminio' | 'pvc' | 'madeira';
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