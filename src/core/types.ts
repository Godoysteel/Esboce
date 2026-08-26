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
  /** Composição técnica de fechamento por face no Light Steel Frame. */
  faceAAssemblyId?: string;
  faceBAssemblyId?: string;
  /** Núcleo compartilhado pelas duas faces; não deve ser contado duas vezes. */
  cavityAssembly?: WallCavityAssembly;
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
  /** Composições técnicas para oitões, forro de beiral e tabeira no LSF. */
  gableFaceAAssemblyId?: string;
  gableFaceBAssemblyId?: string;
  soffitAssemblyId?: string;
  fasciaAssemblyId?: string;
  /** Revestimentos das duas faces da platibanda; aplicáveis somente a type=platibanda. */
  parapetOuterAssemblyId?: string;
  parapetInnerAssemblyId?: string;
  /** Identifica uma cobertura composta confirmada pelo usuário. */
  compoundGroupId?: string;
  /** Telhado inferior do mesmo eixo numa cumeeira interrompida. O
   * fechamento entre ambos pertence à cobertura, nunca a Floor.walls. */
  steppedLowerRoofId?: string;
  /** Telhado elevado autônomo com um volume visual de parede próprio. */
  steppedWallVolume?: boolean;
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
export type VarandaPostMaterial = 'madeira' | 'concreto' | 'tijolo';
export interface VarandaContourSegment { wallId: string; x1: number; y1: number; x2: number; y2: number; outwardSign: 1 | -1; }

export interface Varanda {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frontSide: VarandaFrontSide;
  contourSegments?: VarandaContourSegment[];
  widthM?: number;
  postMaterial?: VarandaPostMaterial;
  /** Altura livre entre o piso e a face inferior da cobertura. */
  heightM?: number;
  /** Inclinação própria da cobertura de uma água. */
  pitchDeg?: number;
  /** Parede externa à qual o primeiro trecho está aderido por snap. */
  attachedWallId?: string;
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
  /** De qual lado do eixo da parede o vidro fica virado (+1 ou -1) — mesmo campo/decisão de VolumeBox.normalSign, guardado uma vez no encosto (ver attachGlazingPanelToWall). Sem isso, o vidro (assimétrico no Z local do painel — fica só na face da frente) virava pro lado que a parede por acaso foi desenhada, não pro lado real do arraste. */
  normalSign?: 1 | -1;
}

// Sacada de vidro (guarda-corpo procedural, categoria Aberturas) —
// SEM máquina de estados preview/attached: ao contrário de GlazingPanel,
// nunca encosta numa parede (instalação real é na borda de laje/varanda,
// não num vão de parede) — confirmado com o Product Owner ("sim solta,
// pode ser deslocada para as quatro direções"). Sempre livre no plano;
// arraste do corpo em qualquer direção, redimensiona só a largura
// (alças esquerda/direita, mesmo padrão de GlazingPanel), gira em
// passos de 90° pelo mesmo botão dos móveis (rotateFurniture).
export interface BalconyRailing {
  id: string;
  /** Posição do centro, mesma unidade de grade de Wall.x1/Furniture.x (20 = 1m). */
  x: number;
  y: number;
  /** Passos de 90°, mesmo espírito de Furniture.rotationDeg. */
  rotationDeg: number;
  /** Comprimento do trecho, em metros — alça de arraste esquerda/direita. */
  widthM: number;
  /** Altura, em metros — alça de arraste no topo (estica pra cima, base fixa). */
  heightM: number;
  /** Elevação da base acima do piso, em metros — alça de arraste embaixo (sobe/desce a peça inteira). Ausente = 0 (nasce no piso). */
  sillHeightM?: number;
  /** Largura-alvo do módulo de vidro, mesmo espírito de GlazingPanel.moduleTargetM. */
  moduleTargetM: number;
  /** Ajuste visual próprio; ausente significa usar o padrão oficial. */
  glassMaterial?: GlazingGlassMaterial;
}

// Bloco de Volumetria (massa procedural — sacada, marquise, qualquer
// volume solto) — box sólido, SEMPRE livre nas 3 dimensões (posição,
// altura/elevação, profundidade), sem ímã de parede nenhum: Product
// Owner pediu explicitamente pra tirar o encosto automático ("tirar o
// imã e fazer as alças em todas as direções, para que ele possa
// formar sacadas, marquises, volumetria, etc") depois de perceber que
// o antigo ímã (encostar e protrair a até 1,5m de uma parede) grudava
// sem querer ao tentar só posicionar livremente perto de uma parede.
// Pintável com o mesmo catálogo de acabamento de parede
// (finishProductId, categoria "paint") — "deve poder ser pintado como
// as paredes".
export interface VolumeBox {
  id: string;
  /** Posição do centro, mesma unidade de grade de Wall.x1/Furniture.x (20 = 1m). */
  x: number;
  y: number;
  /** Passos de 90°, mesmo espírito de Furniture.rotationDeg — útil pra alinhar o volume com uma parede em ângulo. */
  rotationDeg: number;
  widthM: number;
  heightM: number;
  /** Profundidade, em metros — alça de arraste frente/trás. */
  depthM: number;
  /** Elevação da base acima do piso, em metros — alça de arraste embaixo. Ausente = 0 (nasce no piso). */
  sillHeightM?: number;
  /** Cor sólida — usada só quando não há finishProductId. */
  colorHex?: string;
  /** Acabamento tipo parede aplicado pela ferramenta Lata de tinta (mesmo catálogo de "paint" usado em Wall.finishA/B). Presente = sobrescreve colorHex. */
  finishProductId?: string;
}

// Cada modelo é uma malha .glb de verdade (ver Scene3DRenderer.STAIR_MODEL_URLS),
// escalada em runtime pra bater com o pé-direito do pavimento — mesmo
// espírito de RoofType, mas geometria real em vez de procedural.
export type StairModel = 'reta' | 'L' | 'U';

export interface Stair {
  id: string;
  /** Centro do retângulo (bounding box em planta) da malha carregada, mesma unidade de grade de Wall.x1/VolumeBox.x (20 = 1m). */
  x: number;
  y: number;
  /** Passos de 90°, mesmo padrão de VolumeBox/Furniture — sem alça de giro livre. */
  rotationDeg: number;
  model: StairModel;
  /** Única dimensão livre por alça — escala o eixo X da malha. A altura é sempre travada no pé-direito do pavimento (escala Y/Z uniforme); a corrida sai da proporção natural do modelo, não é ajustável direto. */
  widthM: number;
  /** Cor sólida — usada só quando não há finishProductId. */
  colorHex?: string;
  /** Acabamento tipo parede (mesmo catálogo "paint" de Wall/VolumeBox). Presente = sobrescreve colorHex. */
  finishProductId?: string;
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

// Tipo de placa do forro de drywall — ST (standard), RU (resistente à
// umidade, verde), RF (resistente ao fogo, rosa), cimentícia (cinza).
export type ForroBoardType = 'ST' | 'RU' | 'RF' | 'cimenticia';

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
  balconyRailings: BalconyRailing[];
  volumeBoxes: VolumeBox[];
  stairs: Stair[];
  planUnderlay?: PlanUnderlay | null;
  roomFinishes: Record<string, string>;
  roomFinishSettings?: Record<string, { scale: number; rotation: number }>;
  // Cômodo nasce SEM laje visível/contabilizada (DEC-90) — só passa a
  // existir depois que o botão "Gerar Laje" é clicado. Chave = mesmo
  // roomKey (ids de parede do contorno, ordenados e unidos) já usado por
  // roomFinishes/roomFinishSettings; presença com valor `true` = gerada.
  // Se as paredes do cômodo mudarem o bastante pra trocar o roomKey, a
  // laje volta a ficar pendente até gerar de novo — mesmo comportamento
  // (aceito) que roomFinishes já tem hoje.
  roomLajeGenerated?: Record<string, boolean>;
  /** Laje sob um cômodo elevado, criada automaticamente junto com a elevação. */
  roomBaseLajeGenerated?: Record<string, boolean>;
  // Mesmo espírito de roomLajeGenerated acima, mas pro forro de drywall
  // do teto — botão "Gerar Forro de Drywall" separado, flag independente
  // (um cômodo pode ter laje sem forro, ou forro sem laje, os dois, ou
  // nenhum).
  roomForroGenerated?: Record<string, boolean>;
  // Tipo de placa do forro por roomKey — muda espaçamento dos perfis
  // F530 (60cm no ST padrão, 40cm nas placas especiais) e a cor da
  // placa. Ausente = 'ST' (padrão), mesmo espírito opcional de
  // roomFinishes/roomLajeGenerated acima.
  roomForroTipo?: Record<string, ForroBoardType>;
}

export interface ProjectLayers {
  fundacao: boolean;
  calcada: boolean;
  marquise: boolean;
  telhado: boolean;
  paredesTerreo: boolean;
  colunas: boolean;
  laje: boolean;
  forroDrywall: boolean;
  paredesSuperiores: boolean;
  aberturas: boolean;
  varanda: boolean;
  instalacoes: boolean;
  /** Deixa as paredes vazadas (opacidade reduzida) — pra comparar com uma Planta Baixa importada no chão, ou só enxergar melhor o miolo da casa. */
  paredesTransparentes: boolean;
  /** Mantém os níveis acima do nível em edição visíveis. */
  niveisSuperiores: boolean;
}

export type HydraulicNetworkType = 'cold_water' | 'sanitary_sewer' | 'kitchen_sewer' | 'sanitary_vent' | 'rainwater';
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
  /** Presente somente em pontos-guia (junctions) criados por um percurso manual (H2) OU pelo traçado ingênuo automático. Identifica a `fixture` dona do trecho, para permitir substituir só aquele percurso ao redesenhar. */
  ownerFixtureId?: string;
  /** true apenas nos nós de um percurso manual (H2, buildGuidedColdWaterHeaderRoute) — nunca nos do traçado ingênuo automático, mesmo esses também tendo `ownerFixtureId`. Distingue "usuário desenhou este trecho, preserve" de "isto foi gerado automaticamente da última vez, pode regenerar" (ex.: ao mover a origem/caixa d'água). */
  guided?: boolean;
}

export interface HydraulicSegment {
  id: string;
  networkType: HydraulicNetworkType;
  startNodeId: string;
  endNodeId: string;
  diameterMm: number;
  /** Mesma finalidade de `HydraulicNode.ownerFixtureId`, aplicada ao trecho. */
  ownerFixtureId?: string;
  /** Mesma finalidade de `HydraulicNode.guided`, aplicada ao trecho. */
  guided?: boolean;
}

export type HydraulicJunctionKind = 'straight' | 'elbow45' | 'elbow90' | 'tee' | 'cross' | 'end';

export interface HydraulicSystem {
  nodes: HydraulicNode[];
  segments: HydraulicSegment[];
}

export type FoundationType = 'radier' | 'baldrame';
export type ConstructionSystem = 'ceramic_masonry' | 'structural_block' | 'light_steel_frame';

export type InsulationPurpose = 'thermal' | 'acoustic' | 'thermal_acoustic';

export interface WallCavityAssembly {
  /** `none` é uma escolha explícita válida e diferente de campo ausente. */
  insulationSystemId: string;
  thicknessMm: number;
  purpose: InsulationPurpose;
}

export interface CommercialSelection {
  productId: string;
  offerId: string;
  supplierId: string;
  supplierName: string;
  supplierSku?: string;
  price: number;
  currency: string;
  region: string;
  priceDate: string;
  kind: 'official' | 'market_reference';
  selectedAt: string;
}

export interface Project {
  floors: Floor[];
  currentFloorIndex: number;
  layers: ProjectLayers;
  foundationType: FoundationType;
  constructionSystem: ConstructionSystem;
  hydraulics: HydraulicSystem;
  /** Snapshot comercial por alvo aplicado; preço histórico não muda com o catálogo. */
  commercialSelections?: Record<string, CommercialSelection>;
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
  p1Corner: boolean;
  p2Corner: boolean;
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
  // Escala de repetição da TEXTURA na renderização 3D (metros reais por
  // repetição da imagem) — NUNCA usado pra cálculo de orçamento. Ver
  // pecaCoverageM2 pra cobertura física de peça (telha, unit: 'peca').
  tileMeters?: number;
  // Cobertura física real de UMA peça, em m² — usado só por
  // MaterialsPanel.productUnitCost()/purchaseQuantity() pra calcular
  // quantidade de compra (telha vendida em unit: 'peca'). Separado de
  // tileMeters de propósito: são conceitos diferentes que coincidem só
  // por acaso pra alguns produtos — misturar os dois já causou telha
  // cerâmica real mudar de escala visual sem querer (ver Registro de
  // Decisões Técnicas).
  pecaCoverageM2?: number;
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
