import type { ConstructionSystem } from './types.js';

export interface ConstructionSystemDefinition {
  id: ConstructionSystem;
  label: string;
  description: string;
  image: string;
}

export const CONSTRUCTION_SYSTEMS: readonly ConstructionSystemDefinition[] = [
  {
    id: 'ceramic_masonry',
    label: 'Tijolos',
    description: 'Alvenaria com blocos cerâmicos',
    image: './images/construction-systems/tijolos.png',
  },
  {
    id: 'structural_block',
    label: 'Bloco estrutural',
    description: 'Alvenaria estrutural de concreto',
    image: './images/construction-systems/bloco-estrutural.png',
  },
  {
    id: 'light_steel_frame',
    label: 'Steel Frame',
    description: 'Estrutura leve em aço galvanizado',
    image: './images/construction-systems/light-steel-frame.png',
  },
] as const;

export function constructionSystemDefinition(system: ConstructionSystem): ConstructionSystemDefinition {
  return CONSTRUCTION_SYSTEMS.find((candidate) => candidate.id === system) ?? CONSTRUCTION_SYSTEMS[0]!;
}

export function hasCeramicMasonryEstimate(system: ConstructionSystem): boolean {
  return system === 'ceramic_masonry';
}
