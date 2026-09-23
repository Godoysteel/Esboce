// BarnPricing.ts — modelos, cores, limites, tabela de preços e cotação do
// configurador de celeiro/galpão metálico (DEC-230). Módulo PURO: sem
// nenhum import de valor de outros arquivos do projeto (a suíte importa
// direto via node --experimental-strip-types, que não resolve .js->.ts).
//
// ATENÇÃO — PREÇOS PROVISÓRIOS: os valores de BARN_PRICES abaixo são
// placeholders de referência, NÃO uma tabela real do fabricante. Rogério
// vai fornecer a tabela oficial; basta editar BARN_PRICES (e a data em
// BARN_PRICE_REFERENCE_DATE) — o resto do configurador lê tudo daqui.

export type BarnModel = 'fechado' | 'aberto' | 'celeiro';
export type BarnRoof = 'metalica' | 'termoacustica' | 'fibrocimento';
export type BarnGateType = 'correr' | 'duas-folhas' | 'enrolar' | 'sanfonado';

export interface BarnConfig {
  model: BarnModel;
  widthM: number;
  lengthM: number;
  eaveHeightM: number;
  roof: BarnRoof;
  colorId: string;
  windows: number;
  doors: number;
  gates: number;
  gateType: BarnGateType;
  gateWidthM: number;
  gateHeightM: number;
  silo: boolean;
  acm: boolean;
}

export interface BarnContact {
  name: string;
  phone: string;
  city: string;
  notes: string;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  areaM2: number;
  lines: QuoteLine[];
  total: number;
  low: number;
  high: number;
}

export const BARN_PRICE_REFERENCE_DATE = 'PROVISÓRIO — aguardando tabela oficial';
export const BARN_WHATSAPP_NUMBER = '5547991987805';

export const BARN_LIMITS = {
  widthM: { min: 6, max: 30 },
  lengthM: { min: 6, max: 100 },
  eaveHeightM: { min: 3, max: 10 },
  gateWidthM: { min: 2, max: 8 },
  gateHeightM: { min: 2, max: 6 },
  openings: { min: 0, max: 20 },
} as const;

export const BARN_MODELS: { id: BarnModel; label: string; description: string }[] = [
  { id: 'fechado', label: 'Galpão Fechado', description: 'Fechado nas laterais e no fundo, com portão e porta de acesso.' },
  { id: 'aberto', label: 'Galpão Aberto', description: 'Aberto por todos os lados: só colunas e cobertura, ideal para veículos, máquinas e feno.' },
  { id: 'celeiro', label: 'Celeiro', description: 'Nave central elevada com janelas, telhado verde, portão em X, cúpula e silo opcional. Estilo americano.' },
];

export const BARN_ROOFS: { id: BarnRoof; label: string }[] = [
  { id: 'metalica', label: 'Telha metálica trapezoidal' },
  { id: 'termoacustica', label: 'Telha termoacústica' },
  { id: 'fibrocimento', label: 'Fibrocimento' },
];

export const BARN_GATE_TYPES: { id: BarnGateType; label: string }[] = [
  { id: 'correr', label: 'Correr' },
  { id: 'duas-folhas', label: 'Duas folhas (abrir)' },
  { id: 'enrolar', label: 'Enrolar' },
  { id: 'sanfonado', label: 'Sanfonado' },
];

export const BARN_COLORS: { id: string; label: string; hex: string; premium?: boolean }[] = [
  { id: 'branco', label: 'Branco', hex: '#EDEEEC' },
  { id: 'cinza', label: 'Cinza grafite', hex: '#5A5F63' },
  { id: 'preto', label: 'Preto fosco', hex: '#26282A', premium: true },
  { id: 'vermelho', label: 'Vermelho celeiro', hex: '#8E2B22', premium: true },
  { id: 'azul', label: 'Azul', hex: '#2F5D8C' },
  { id: 'verde', label: 'Verde', hex: '#3E6B47' },
  { id: 'bege', label: 'Bege areia', hex: '#C9B99A' },
];

// Todos os valores em R$ — PROVISÓRIOS (ver cabeçalho).
export const BARN_PRICES = {
  perM2: { fechado: 380, aberto: 290, celeiro: 460 } as Record<BarnModel, number>,
  roofPerM2: { metalica: 0, termoacustica: 75, fibrocimento: 45 } as Record<BarnRoof, number>,
  eaveExtraPerMeterAbove4: 0.05,
  premiumColorFactor: 0.03,
  window: 650,
  door: 1200,
  gatePerM2: { correr: 900, 'duas-folhas': 700, enrolar: 1100, sanfonado: 800 } as Record<BarnGateType, number>,
  silo: 18000,
  acmPerM2Facade: 220,
  rangeLow: 0.9,
  rangeHigh: 1.1,
};

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function defaultBarnConfig(): BarnConfig {
  return {
    model: 'fechado', widthM: 12, lengthM: 24, eaveHeightM: 5, roof: 'metalica', colorId: 'branco',
    windows: 4, doors: 1, gates: 1, gateType: 'correr', gateWidthM: 4, gateHeightM: 4, silo: false, acm: false,
  };
}

export function normalizeBarnConfig(config: BarnConfig): BarnConfig {
  const L = BARN_LIMITS;
  const widthM = clamp(config.widthM, L.widthM.min, L.widthM.max);
  const lengthM = clamp(config.lengthM, L.lengthM.min, L.lengthM.max);
  const eaveHeightM = clamp(config.eaveHeightM, L.eaveHeightM.min, L.eaveHeightM.max);
  const gateWidthM = clamp(config.gateWidthM, L.gateWidthM.min, L.gateWidthM.max);
  const gateHeightM = clamp(config.gateHeightM, L.gateHeightM.min, Math.min(L.gateHeightM.max, eaveHeightM - 0.6));
  // Portões só na frente fechada, e só quantos cabem lado a lado na largura.
  const maxGates = Math.max(1, Math.floor((widthM - 1) / (gateWidthM + 1)));
  const gates = config.model === 'aberto' ? 0 : Math.min(maxGates, Math.round(clamp(config.gates, L.openings.min, L.openings.max)));
  // Portas + janelas nas duas laterais, com pelo menos ~2,4 m por vão.
  const maxSide = 2 * Math.floor(lengthM / 2.4);
  // Galpão aberto não tem paredes, então não há portas, janelas nem portões.
  const isOpen = config.model === 'aberto';
  const doors = isOpen ? 0 : Math.min(maxSide, Math.round(clamp(config.doors, L.openings.min, L.openings.max)));
  const windows = isOpen ? 0 : Math.min(maxSide - doors, Math.round(clamp(config.windows, L.openings.min, L.openings.max)));
  return {
    ...config, widthM, lengthM, eaveHeightM, gateWidthM, gateHeightM, gates, doors, windows,
    // Silo só existe no Celeiro; ACM só faz sentido com parede frontal (não no aberto).
    silo: config.model === 'celeiro' ? config.silo : false,
    acm: config.model === 'aberto' ? false : config.acm,
  };
}

export function findBarnColor(id: string) {
  return BARN_COLORS.find((c) => c.id === id) || BARN_COLORS[0]!;
}

export function computeQuote(input: BarnConfig): Quote {
  const c = normalizeBarnConfig(input);
  const P = BARN_PRICES;
  const areaM2 = Math.round(c.widthM * c.lengthM * 100) / 100;
  const eaveFactor = 1 + Math.max(0, c.eaveHeightM - 4) * P.eaveExtraPerMeterAbove4;
  const lines: QuoteLine[] = [];
  const add = (label: string, amount: number) => { if (amount > 0) lines.push({ label, amount: Math.round(amount) }); };

  const model = BARN_MODELS.find((m) => m.id === c.model)!;
  add(`${model.label} — ${areaM2} m² (pé-direito ${c.eaveHeightM} m)`, areaM2 * P.perM2[c.model] * eaveFactor);
  add(`Cobertura: ${BARN_ROOFS.find((r) => r.id === c.roof)!.label}`, areaM2 * P.roofPerM2[c.roof]);
  add(`Janelas (${c.windows})`, c.windows * P.window);
  add(`Portas (${c.doors})`, c.doors * P.door);
  const gateType = BARN_GATE_TYPES.find((g) => g.id === c.gateType)!;
  add(`Portões ${gateType.label.toLowerCase()} (${c.gates} × ${c.gateWidthM}×${c.gateHeightM} m)`, c.gates * c.gateWidthM * c.gateHeightM * P.gatePerM2[c.gateType]);
  if (c.silo) add('Silo decorativo', P.silo);
  if (c.acm) add('Revestimento em ACM na fachada', c.widthM * c.eaveHeightM * P.acmPerM2Facade);

  let total = lines.reduce((sum, line) => sum + line.amount, 0);
  if (findBarnColor(c.colorId).premium) {
    const extra = Math.round(total * P.premiumColorFactor);
    lines.push({ label: `Cor premium (${findBarnColor(c.colorId).label})`, amount: extra });
    total += extra;
  }
  return { areaM2, lines, total, low: Math.round(total * P.rangeLow), high: Math.round(total * P.rangeHigh) };
}

export function formatBRL(value: number): string {
  return 'R$ ' + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function buildWhatsappMessage(config: BarnConfig, quote: Quote, contact: BarnContact): string {
  const c = normalizeBarnConfig(config);
  const model = BARN_MODELS.find((m) => m.id === c.model)!;
  const parts = [
    'Olá! Fiz uma simulação no configurador de celeiros da Artuz Express / Godoy Construtor e gostaria de um orçamento.',
    '',
    `Modelo: ${model.label}`,
    `Dimensões: ${c.widthM} m × ${c.lengthM} m (${quote.areaM2} m²), pé-direito ${c.eaveHeightM} m`,
    `Cobertura: ${BARN_ROOFS.find((r) => r.id === c.roof)!.label}`,
    `Cor: ${findBarnColor(c.colorId).label}`,
    `Janelas: ${c.windows} | Portas: ${c.doors} | Portões: ${c.gates} (${BARN_GATE_TYPES.find((g) => g.id === c.gateType)!.label}, ${c.gateWidthM}×${c.gateHeightM} m)`,
  ];
  if (c.silo) parts.push('Silo: sim');
  if (c.acm) parts.push('Fachada em ACM: sim');
  parts.push('', `Estimativa: ${formatBRL(quote.low)} a ${formatBRL(quote.high)} (valor sujeito a confirmação)`);
  parts.push('', `Nome: ${contact.name || '-'}`, `Contato: ${contact.phone || '-'}`, `Local da obra: ${contact.city || '-'}`);
  if (contact.notes) parts.push(`Observações: ${contact.notes}`);
  return parts.join('\n');
}

export function buildWhatsappUrl(config: BarnConfig, quote: Quote, contact: BarnContact): string {
  return `https://wa.me/${BARN_WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsappMessage(config, quote, contact))}`;
}
