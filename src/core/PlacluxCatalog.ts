export type PlacluxProductCategory = 'board' | 'compound' | 'membrane' | 'mesh' | 'trim'
  | 'fastener' | 'insulation' | 'profile' | 'ceiling';

export interface PlacluxCatalogProduct {
  id: string;
  name: string;
  category: PlacluxProductCategory;
  unit: 'sheet' | 'bag' | 'roll' | 'piece' | 'bucket' | 'm2' | 'kg';
  dimensions?: string;
  weightKg?: number;
  coverageM2?: number;
  sourceUrl: string;
  notes?: string;
}

const source = (slug: string) => `https://placlux.com.br/produtos/${slug}/`;

/** Portfólio publicado pela PlacLux; sem preços ou SKUs comerciais inventados. */
export const PLACLUX_PRODUCTS: readonly PlacluxCatalogProduct[] = [
  { id: 'placlux.profort-next-6mm', name: 'Chapa Cimentícia ProFort Next 6 mm', category: 'board', unit: 'sheet', dimensions: '1200 x 2400 x 6 mm', sourceUrl: source('chapa-cimenticia'), notes: 'Uso interno conforme fabricante.' },
  { id: 'placlux.profort-next-8mm', name: 'Chapa Cimentícia ProFort Next 8 mm', category: 'board', unit: 'sheet', dimensions: '1200 x 2400 x 8 mm', weightKg: 30, coverageM2: 2.88, sourceUrl: source('chapa-cimenticia'), notes: 'Uso interno conforme fabricante.' },
  { id: 'placlux.profort-next-10mm', name: 'Chapa Cimentícia ProFort Next 10 mm', category: 'board', unit: 'sheet', dimensions: '1200 x 2400 x 10 mm', weightKg: 34, coverageM2: 2.88, sourceUrl: source('chapa-cimenticia'), notes: 'Uso interno e externo; indicada para beiral, forro, platibanda e LSF com painel estrutural de madeira.' },
  { id: 'placlux.profort-next-12-5mm', name: 'Chapa Cimentícia ProFort Next 12,5 mm', category: 'board', unit: 'sheet', dimensions: '1200 x 2400 x 12,5 mm', weightKg: 43, coverageM2: 2.88, sourceUrl: source('chapa-cimenticia'), notes: 'Uso interno e externo; indicada para fachadas e LSF com contraventamento metálico.' },
  { id: 'placlux.base-coat-20kg', name: 'Massa Base Coat ProFort System 20 kg', category: 'compound', unit: 'bag', weightKg: 20, coverageM2: 6, sourceUrl: source('base-coat'), notes: 'Rendimento oficial informado como faixa de 5 a 7 m²; catálogo usa 6 m² como valor médio.' },
  { id: 'placlux.fita-fiberglass-10cm-50m', name: 'Fita Fiberglass 10 cm x 50 m', category: 'mesh', unit: 'roll', dimensions: '0,10 x 50 m', sourceUrl: source('fita-fiber-glass') },
  { id: 'placlux.membrana-hidrofuga-52-5m2', name: 'Membrana Hidrófuga ProFort System', category: 'membrane', unit: 'roll', dimensions: '1,05 x 50 m', weightKg: 7, coverageM2: 45, sourceUrl: source('membrana-hidrofuga-2'), notes: 'Área geométrica 52,5 m²; rendimento aproximado oficial de 45 m² considera sobreposições.' },
  { id: 'placlux.tela-fiberglass-1x50m', name: 'Tela Fiberglass 1 x 50 m', category: 'mesh', unit: 'roll', dimensions: '1 x 50 m', weightKg: 7.25, coverageM2: 50, sourceUrl: source('tela-fiber-glass') },
  { id: 'placlux.pingadeira-pvc-2-5m', name: 'Pingadeira em PVC ProFort 2,5 m', category: 'trim', unit: 'piece', dimensions: '60 x 15 x 2500 mm', weightKg: 0.35, sourceUrl: source('pingadeira-profort') },
  { id: 'placlux.parafuso-pa-032', name: 'Parafuso Rusper PA 032', category: 'fastener', unit: 'piece', dimensions: '4,2 x 32 mm', sourceUrl: source('parafuso-pa32'), notes: 'Ponta agulha; fixação da ProFort Next em OSB.' },
  { id: 'placlux.parafuso-pb-032', name: 'Parafuso Rusper PB 032', category: 'fastener', unit: 'piece', dimensions: '4,2 x 32 mm', sourceUrl: source('parafuso-pb32'), notes: 'Ponta broca; fixação da ProFort Next em perfis LSF a partir de 0,80 mm.' },
  { id: 'placlux.cantoneira-pvc-2-5m', name: 'Cantoneira PVC com tela 2,5 m', category: 'trim', unit: 'piece', dimensions: '100 x 100 x 2500 mm', weightKg: 0.25, sourceUrl: source('cantoneira-pvc') },
  { id: 'placlux.chapa-drywall', name: 'Chapa de Drywall', category: 'board', unit: 'sheet', sourceUrl: 'https://placlux.com.br/produtos/' },
  { id: 'placlux.la-de-rocha', name: 'Lã de Rocha', category: 'insulation', unit: 'm2', sourceUrl: 'https://placlux.com.br/produtos/' },
  { id: 'placlux.massa-drywall', name: 'Massa para Drywall', category: 'compound', unit: 'kg', sourceUrl: 'https://placlux.com.br/produtos/' },
  { id: 'placlux.protherm-18kg', name: 'Isolante Térmico Protherm 18 kg', category: 'insulation', unit: 'bucket', weightKg: 18, sourceUrl: source('isolante-protherm') },
  { id: 'placlux.total-wall', name: 'PlacLux Total Wall', category: 'compound', unit: 'bucket', sourceUrl: 'https://placlux.com.br/produtos/' },
  { id: 'placlux.manta-acrilica', name: 'Manta Acrílica', category: 'membrane', unit: 'bucket', sourceUrl: 'https://placlux.com.br/produtos/' },
  { id: 'placlux.primer-protect-wall-18kg', name: 'Primer Protect Wall 18 kg', category: 'compound', unit: 'bucket', weightKg: 18, sourceUrl: source('selador-acrilico') },
  { id: 'placlux.adesivo-chapisco', name: 'Adesivo Chapisco', category: 'compound', unit: 'bucket', sourceUrl: 'https://placlux.com.br/produtos/' },
  { id: 'placlux.perfis-drywall', name: 'Perfis para Drywall', category: 'profile', unit: 'kg', sourceUrl: source('perfis-drywall') },
  { id: 'placlux.perfis-steel-frame', name: 'Perfis para Steel Frame', category: 'profile', unit: 'kg', sourceUrl: source('perfis-steel-frame'), notes: 'Família de referência; quantitativo do Esboce permanece agregado em kg/m².' },
  { id: 'placlux.forro-mineral-knauf-ceiling', name: 'Forro Mineral Knauf Ceiling', category: 'ceiling', unit: 'm2', sourceUrl: 'https://placlux.com.br/produtos/' },
] as const;

export function getPlacluxProduct(id: string): PlacluxCatalogProduct | undefined {
  return PLACLUX_PRODUCTS.find((product) => product.id === id);
}
