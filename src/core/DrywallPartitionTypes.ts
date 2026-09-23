// DrywallPartitionTypes.ts — catálogo de tipos de divisória de drywall
// (DEC-229), com espessura TOTAL real da divisória pronta (guia +
// montante + chapas dos dois lados), usada pra renderizar a peça
// (Scene3DRenderer.buildDrywallPartitionMesh) e pro quantitativo.
// Deliberadamente separado de SteelFrameAssemblies.ts: aquele arquivo
// descreve a composição de UMA FACE (chapa/tratamento de junta/
// parafusos, kg por m²) — espessura estrutural total da divisória é um
// conceito ortogonal e menor. Poucos tipos, preço uniforme por enquanto
// (Product Owner confirmou) — sem variação de preço por tipo ainda.

export interface DrywallPartitionType {
  id: string;
  label: string;
  /** Espessura total da divisória pronta, em milímetros. */
  totalThicknessMm: number;
  guideMm: 48 | 70 | 90;
  /** Dupla face reforçada/acústica (chapa extra por lado). */
  double?: boolean;
}

// Números-base calibrados em perfis comerciais reais: guia 48/70/90mm +
// 2x12,5mm de chapa de cada lado ≈ 73/95/115mm; a dupla acústica soma
// uma chapa extra por lado sobre a guia de 70mm.
export const DRYWALL_PARTITION_TYPES: readonly DrywallPartitionType[] = [
  { id: 'guide-48-simple', label: 'Simples 73mm (guia 48mm)', totalThicknessMm: 73, guideMm: 48 },
  { id: 'guide-70-simple', label: 'Reforçada 95mm (guia 70mm)', totalThicknessMm: 95, guideMm: 70 },
  { id: 'guide-90-simple', label: 'Reforçada 115mm (guia 90mm)', totalThicknessMm: 115, guideMm: 90 },
  { id: 'guide-70-double', label: 'Dupla acústica 145mm (guia 70mm, dupla)', totalThicknessMm: 145, guideMm: 70, double: true },
];

export const DRYWALL_PARTITION_DEFAULT_TYPE_ID = DRYWALL_PARTITION_TYPES[0]!.id;

export function findDrywallPartitionType(id?: string): DrywallPartitionType {
  return DRYWALL_PARTITION_TYPES.find((t) => t.id === id) || DRYWALL_PARTITION_TYPES[0]!;
}
