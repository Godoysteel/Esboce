import type { Project, Roof, Wall } from './types.js';

export type AssemblyUse = 'external' | 'internal' | 'both' | 'soffit' | 'fascia';
export type QuantityUnit = 'm2' | 'm' | 'kg' | 'unit';

export interface AssemblyLayerDefinition {
  id: string;
  label: string;
  role: 'finish' | 'basecoat' | 'mesh' | 'external_insulation' | 'external_board'
    | 'water_barrier' | 'structural_sheathing' | 'internal_board' | 'joint_tape' | 'joint_compound';
  unit: QuantityUnit;
  /** Consumo antes da perda. Para fixadores, unidades por m². */
  consumptionPerM2: number;
  wastePercent: number;
  fastener?: boolean;
}

export interface WallFaceAssemblyDefinition {
  id: string;
  label: string;
  use: AssemblyUse;
  layers: readonly AssemblyLayerDefinition[];
}

const area = (id: string, label: string, role: AssemblyLayerDefinition['role'], wastePercent = 10): AssemblyLayerDefinition =>
  ({ id, label, role, unit: 'm2', consumptionPerM2: 1, wastePercent });
const fixers = (id: string, label: string, unitsPerM2: number): AssemblyLayerDefinition =>
  ({ id, label, role: 'finish', unit: 'unit', consumptionPerM2: unitsPerM2, wastePercent: 5, fastener: true });
const measured = (id: string, label: string, role: AssemblyLayerDefinition['role'], unit: 'm' | 'kg', consumptionPerM2: number, wastePercent = 10): AssemblyLayerDefinition =>
  ({ id, label, role, unit, consumptionPerM2, wastePercent });
const pieces = (id: string, label: string, role: AssemblyLayerDefinition['role'], piecesPerM2: number, wastePercent = 10): AssemblyLayerDefinition =>
  ({ id, label, role, unit: 'unit', consumptionPerM2: piecesPerM2, wastePercent });

const profortJointTreatment: readonly AssemblyLayerDefinition[] = [
  measured('placlux.base-coat-20kg', 'Massa Base Coat ProFort System', 'basecoat', 'kg', 20 / 6, 5),
  measured('placlux.fita-fiberglass-10cm-50m', 'Fita Fiberglass para juntas', 'joint_tape', 'm', 1.25),
  area('placlux.tela-fiberglass-1x50m', 'Tela Fiberglass', 'mesh'),
  pieces('placlux.cantoneira-pvc-2-5m', 'Cantoneira PVC telada 2,5 m', 'mesh', 0.4),
];

const drywallJointTreatment: readonly AssemblyLayerDefinition[] = [
  measured('placlux.massa-drywall', 'Massa para tratamento de juntas de drywall', 'joint_compound', 'kg', 0.5, 10),
  measured('drywall-joint-tape', 'Fita telada para juntas de drywall', 'joint_tape', 'm', 1.25, 10),
];

/**
 * Presets técnicos iniciais. Consumos de fixadores são parâmetros de orçamento,
 * não dimensionamento; devem poder ser substituídos pela ficha do fabricante.
 */
export const STEEL_FRAME_FACE_ASSEMBLIES: readonly WallFaceAssemblyDefinition[] = [
  // EIFS sempre assenta sobre um substrato — a fixação do EPS/XPS muda
  // conforme o material desse substrato: colado com basecoat quando é
  // cimentício, parafusado (com arandela) quando é de madeira (OSB ou
  // Compensado). As duas variantes compartilham EPS/XPS, tela, cantoneira,
  // membrana e acabamento — só o substrato e a fixação do isolante mudam.
  { id: 'eifs', label: 'EIFS sobre substrato cimentício', use: 'external', layers: [
    area('placlux.profort-next-10mm', 'ProFort Next 10 mm (substrato)', 'structural_sheathing'),
    fixers('placlux.parafuso-pb-032', 'Parafusos Rusper PB 032 (fixação do substrato)', 20),
    area('eifs-eps', 'Placa isolante EPS/XPS 50x1000x1000mm (densidade ≥ 18 kg/m³)', 'external_insulation'),
    // Mesmo id e label do basecoat de reforço (profortJointTreatment,
    // abaixo) DE PROPÓSITO — é o mesmo produto ProFort, comprado uma vez
    // só; o quantitativo soma as duas passadas (colagem do EPS/XPS +
    // reforço da malha) numa única linha de sacos, sem duplicar produto.
    measured('placlux.base-coat-20kg', 'Massa Base Coat ProFort System', 'basecoat', 'kg', 20 / 6, 5),
    ...profortJointTreatment,
    area('placlux.membrana-hidrofuga-52-5m2', 'Membrana Hidrófuga ProFort', 'water_barrier'),
    area('eifs-finish', 'Acabamento EIFS', 'finish', 5),
  ] },
  { id: 'eifs-wood-substrate', label: 'EIFS sobre substrato de madeira (OSB ou Compensado)', use: 'external', layers: [
    area('cement-board-substrate', 'Painel estrutural do substrato (OSB ou Compensado)', 'structural_sheathing'),
    fixers('cement-board-substrate-screws', 'Parafusos de fixação do substrato (OSB/Compensado)', 18),
    area('eifs-eps', 'Placa isolante EPS/XPS 50x1000x1000mm (densidade ≥ 18 kg/m³)', 'external_insulation'),
    fixers('eifs-eps-fixers-arandela', 'Parafusos com arandela para fixação do EPS/XPS no substrato de madeira', 6),
    ...profortJointTreatment,
    area('placlux.membrana-hidrofuga-52-5m2', 'Membrana Hidrófuga ProFort', 'water_barrier'),
    area('eifs-finish', 'Acabamento EIFS', 'finish', 5),
  ] },
  { id: 'cement-board-direct', label: 'Placa cimentícia sem OSB', use: 'external', layers: [
    area('placlux.profort-next-12-5mm', 'ProFort Next 12,5 mm', 'external_board'),
    area('placlux.membrana-hidrofuga-52-5m2', 'Membrana Hidrófuga ProFort', 'water_barrier'),
    ...profortJointTreatment,
    fixers('placlux.parafuso-pb-032', 'Parafusos Rusper PB 032', 20),
  ] },
  { id: 'cement-board-osb', label: 'Placa cimentícia com substrato (OSB ou Compensado)', use: 'external', layers: [
    area('placlux.profort-next-10mm', 'ProFort Next 10 mm', 'external_board'),
    area('placlux.membrana-hidrofuga-52-5m2', 'Membrana Hidrófuga ProFort', 'water_barrier'),
    area('cement-board-substrate', 'Painel estrutural do substrato (OSB ou Compensado)', 'structural_sheathing'),
    ...profortJointTreatment,
    fixers('placlux.parafuso-pa-032', 'Parafusos Rusper PA 032', 20),
    fixers('cement-board-substrate-screws', 'Parafusos de fixação do substrato (OSB/Compensado)', 18),
  ] },
  { id: 'glasroc-x-direct', label: 'Glasroc X', use: 'both', layers: [
    area('glasroc-finish', 'Acabamento Glasroc X', 'finish', 5),
    measured('glasroc-basecoat', 'Placoplast Basecoat', 'basecoat', 'kg', 5, 5),
    area('glasroc-mesh', 'Malha GRX para Superfície', 'mesh'),
    area('glasroc-x', 'Placa Glasroc X 12,5 mm', 'external_board'),
    area('wrb', 'Membrana Hidrófuga Tyvek HomeWrap', 'water_barrier'),
    fixers('glasroc-screws', 'Parafuso Glasroc PB 25 mm', 20),
  ] },
  { id: 'glasroc-x-therm', label: 'Glasroc X Therm', use: 'external', layers: [
    area('glasroc-therm-finish', 'Acabamento Glasroc X Therm', 'finish', 5),
    measured('glasroc-therm-basecoat', 'Placoplast Basecoat', 'basecoat', 'kg', 5, 5),
    area('glasroc-therm-mesh', 'Malha GRX para Superfície', 'mesh'),
    area('glasroc-therm-eps', 'Placa isolante EPS T7F 30 mm', 'external_insulation'),
    area('glasroc-x', 'Placa Glasroc X 12,5 mm', 'external_board'),
    area('wrb', 'Membrana Hidrófuga Tyvek HomeWrap', 'water_barrier'),
    fixers('glasroc-screws', 'Parafuso Glasroc PB 25 mm', 20),
  ] },
  { id: 'vinyl-siding-osb', label: 'OSB + siding vinílico', use: 'external', layers: [
    area('vinyl-siding', 'Siding vinílico', 'finish'),
    area('wrb', 'Membrana hidrófuga', 'water_barrier'),
    area('osb', 'Painel OSB estrutural', 'structural_sheathing'),
    fixers('vinyl-siding-fixers', 'Fixadores para siding vinílico', 8),
    fixers('osb-screws', 'Parafusos para OSB', 18),
  ] },
  { id: 'drywall-st', label: 'Drywall Standard (ST)', use: 'internal', layers: [
    area('drywall-st', 'Chapa de drywall ST', 'internal_board'),
    ...drywallJointTreatment,
    fixers('drywall-screws', 'Parafusos para drywall', 15),
  ] },
  { id: 'drywall-ru', label: 'Drywall resistente à umidade (RU)', use: 'internal', layers: [
    area('drywall-ru', 'Chapa de drywall RU', 'internal_board'),
    ...drywallJointTreatment,
    fixers('drywall-screws', 'Parafusos para drywall', 15),
  ] },
  { id: 'drywall-rf', label: 'Drywall resistente ao fogo (RF)', use: 'internal', layers: [
    area('drywall-rf', 'Chapa de drywall RF', 'internal_board'),
    ...drywallJointTreatment,
    fixers('drywall-screws', 'Parafusos para drywall', 15),
  ] },
  { id: 'soffit-cement-board', label: 'Beiral em placa cimentícia', use: 'soffit', layers: [
    area('placlux.profort-next-10mm', 'ProFort Next 10 mm para beiral', 'external_board'),
    ...profortJointTreatment,
    fixers('placlux.parafuso-pb-032', 'Parafusos Rusper PB 032', 20),
  ] },
  { id: 'soffit-vinyl', label: 'Beiral vinílico', use: 'soffit', layers: [
    area('vinyl-soffit', 'Forro de beiral vinílico', 'finish'),
    fixers('vinyl-soffit-fixers', 'Fixadores para beiral vinílico', 8),
  ] },
  { id: 'fascia-cement-board', label: 'Tabeira em placa cimentícia', use: 'fascia', layers: [
    area('placlux.profort-next-10mm', 'ProFort Next 10 mm para tabeira', 'external_board'),
    ...profortJointTreatment,
    fixers('placlux.parafuso-pb-032', 'Parafusos Rusper PB 032', 20),
  ] },
  { id: 'fascia-wood', label: 'Tabeira de madeira', use: 'fascia', layers: [
    area('wood-fascia-board', 'Tábua de madeira para tabeira', 'finish'),
    fixers('wood-fascia-fixers', 'Fixadores para tabeira de madeira', 8),
  ] },
] as const;

export const STEEL_FRAME_STRUCTURE_WASTE_PERCENT = 5;

/** Cor de conferência visual de cada sistema no assistente. */
export function steelFrameAssemblyColorHex(assemblyId?: string): number {
  const colors: Record<string, number> = {
    'eifs': 0x2563EB, 'eifs-wood-substrate': 0xEAB308, 'cement-board-direct': 0x0891B2,
    'cement-board-osb': 0xD97706, 'glasroc-x-direct': 0x7C3AED,
    'glasroc-x-therm': 0xDB2777, 'vinyl-siding-osb': 0x0F766E,
    'drywall-st': 0x3FAE67, 'drywall-ru': 0x0EA5E9,
    'drywall-rf': 0xDC2626, 'soffit-cement-board': 0x64748B,
    'soffit-vinyl': 0xA855F7, 'fascia-cement-board': 0x475569,
    'fascia-wood': 0x92400E,
  };
  return assemblyId ? (colors[assemblyId] ?? 0x3FAE67) : 0x3FAE67;
}

export function quantityWithWaste(areaM2: number, layer: AssemblyLayerDefinition): number {
  const raw = Math.max(0, areaM2) * layer.consumptionPerM2 * (1 + layer.wastePercent / 100);
  return layer.unit === 'unit' ? Math.ceil(raw) : Math.round(raw * 100) / 100;
}

export interface SteelFrameSpecificationIssue {
  kind: 'wall-face' | 'wall-cavity' | 'gable-face' | 'stepped-wall-face' | 'soffit' | 'fascia' | 'parapet-face';
  entityId: string;
  side?: 'a' | 'b' | 'outer' | 'inner';
}

function roofHasGable(roof: Roof): boolean {
  return roof.type === 'duasAguas' || roof.type === 'umaAgua' || !!roof.steppedWallVolume;
}

/** Lista tudo que impede o quantitativo específico de LSF. */
export function steelFrameSpecificationIssues(project: Project): SteelFrameSpecificationIssue[] {
  if (project.constructionSystem !== 'light_steel_frame') return [];
  const issues: SteelFrameSpecificationIssue[] = [];
  project.floors.forEach((floor) => {
    floor.walls.forEach((wall: Wall) => {
      // Divisória em drywall (Wall.partitionSystem) tem validação própria
      // (drywallPartitionSpecificationIssues, abaixo) — não é a estrutura
      // Steel Frame do projeto, não deveria aparecer como pendência do LSF.
      if (wall.demolished || wall.partitionSystem === 'drywall') return;
      if (!wall.faceAAssemblyId) issues.push({ kind: 'wall-face', entityId: wall.id, side: 'a' });
      if (!wall.faceBAssemblyId) issues.push({ kind: 'wall-face', entityId: wall.id, side: 'b' });
      if (!wall.cavityAssembly) issues.push({ kind: 'wall-cavity', entityId: wall.id });
    });
    floor.roofs.forEach((roof) => {
      if (roof.steppedWallVolume || roof.steppedLowerRoofId) {
        if (!roof.steppedWallFaceAAssemblyId) issues.push({ kind: 'stepped-wall-face', entityId: roof.id, side: 'a' });
        if (!roof.steppedWallFaceBAssemblyId) issues.push({ kind: 'stepped-wall-face', entityId: roof.id, side: 'b' });
      }
      if (roofHasGable(roof)) {
        if (!roof.gableFaceAAssemblyId) issues.push({ kind: 'gable-face', entityId: roof.id, side: 'a' });
        if (!roof.gableFaceBAssemblyId) issues.push({ kind: 'gable-face', entityId: roof.id, side: 'b' });
      }
      if (roof.type === 'platibanda') {
        if (!roof.parapetOuterAssemblyId) issues.push({ kind: 'parapet-face', entityId: roof.id, side: 'outer' });
        if (!roof.parapetInnerAssemblyId) issues.push({ kind: 'parapet-face', entityId: roof.id, side: 'inner' });
      }
    });
  });
  if (!project.steelFrameSoffitAssemblyId) issues.push({ kind: 'soffit', entityId: '__project__' });
  if (!project.steelFrameFasciaAssemblyId) issues.push({ kind: 'fascia', entityId: '__project__' });
  return issues;
}

export interface DrywallPartitionSpecificationIssue {
  kind: 'wall-face';
  entityId: string;
  side: 'a' | 'b';
}

/**
 * Lista paredes marcadas como divisória em drywall (Wall.partitionSystem)
 * sem face A/B definida — roda em QUALQUER sistema de projeto (alvenaria,
 * bloco estrutural ou Steel Frame), diferente de steelFrameSpecificationIssues
 * acima, que só se aplica quando o projeto INTEIRO é Light Steel Frame.
 */
export function drywallPartitionSpecificationIssues(project: Project): DrywallPartitionSpecificationIssue[] {
  const issues: DrywallPartitionSpecificationIssue[] = [];
  project.floors.forEach((floor) => {
    floor.walls.forEach((wall: Wall) => {
      if (wall.demolished || wall.partitionSystem !== 'drywall') return;
      if (!wall.faceAAssemblyId) issues.push({ kind: 'wall-face', entityId: wall.id, side: 'a' });
      if (!wall.faceBAssemblyId) issues.push({ kind: 'wall-face', entityId: wall.id, side: 'b' });
    });
  });
  return issues;
}
