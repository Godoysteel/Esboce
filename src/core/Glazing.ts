// Glazing.ts — layout puro do grid 2D de um painel de Envidraçamento
// (ferramenta "Fachada", DEC-56). Sem dependência de Three.js/DOM: dado
// o tamanho real do painel (largura e altura, em metros) e uma
// largura-alvo de módulo, calcula quantas divisões cabem em cada eixo
// — sempre arredondando pro inteiro mais próximo e recalculando o
// módulo real, pra encaixar exato nas duas pontas, sem nunca sobrar
// módulo cortado. Os dois eixos (largura/colunas, altura/linhas) são
// calculados de forma independente, mirando o mesmo `moduleTargetM` —
// é isso que mantém a simetria visual entre divisões verticais e
// horizontais mesmo quando o painel não é quadrado.
//
// Mullion (perfil), moldura de contorno e material ficam fora deste
// módulo — são responsabilidade da camada de renderização (Three.js),
// que consome este layout puro.

/** Tamanho mínimo de segurança pra um módulo, em metros — evita módulo/vidro estreito demais. */
export const MIN_MODULE_M = 0.6;

/** Folga (junta) entre vidros vizinhos, em milímetros — espaço do silicone estrutural. */
export const JOINT_MM = 10;

// Largura/profundidade dos perfis — valores extraídos do modelo de
// referência feito no Blender pelo usuário (Fachada_Glazing.glb,
// mesh "Perfis"): moldura de contorno e travessa central com a MESMA
// largura (~4,9cm cada, medido nos vértices exportados), profundidade
// ~9,58cm. Nesse modelo de referência o perfil é uma caixa retangular
// simples (sem entalhe/reentrância — confirmado inspecionando os
// vértices: só 2 valores no eixo de profundidade), então a mesma
// geometria por caixas já usada aqui reproduz o formato corretamente,
// sem precisar de extrusão de seção 2D.
export const MULLION_VERTICAL_WIDTH_M = 0.049;
export const MULLION_HORIZONTAL_WIDTH_M = 0.049;
export const FRAME_WIDTH_M = 0.049;
export const PROFILE_DEPTH_M = 0.0958;

/** Calibração oficial inicial do vidro. Fachadas antigas sem override usam estes valores. */
export const DEFAULT_GLAZING_GLASS_MATERIAL = Object.freeze({
  color: '#a9c5cf',
  opacity: 1,
  roughness: 0.06,
  metalness: 0.92,
  reflectionIntensity: 2.15,
});

export interface AxisLayout {
  /** Número de módulos ao longo do eixo (sempre >= 1). */
  count: number;
  /** Largura real de cada módulo nesse eixo, em metros (todos iguais). */
  moduleSizeM: number;
}

export interface GlazingLayout {
  /** Divisão ao longo da largura do painel — perfis verticais entre colunas. */
  columns: AxisLayout;
  /** Divisão ao longo da altura do painel — perfis horizontais entre linhas. */
  rows: AxisLayout;
}

function computeAxisLayout(sizeM: number, targetM: number): AxisLayout {
  const safeSize = Math.max(sizeM, 1e-6);
  const safeTarget = Math.max(targetM, MIN_MODULE_M);
  let count = Math.max(1, Math.round(safeSize / safeTarget));
  // Se o arredondamento acima produzir um módulo mais estreito que o
  // piso de segurança (painel pequeno, alvo pequeno), reduz o número
  // de módulos até respeitar MIN_MODULE_M — nunca deixa passar módulo
  // fino demais, mesmo em painéis pequenos.
  while (count > 1 && safeSize / count < MIN_MODULE_M) count -= 1;
  return { count, moduleSizeM: safeSize / count };
}

/**
 * Calcula o grid 2D (colunas x linhas) de um painel de Envidraçamento.
 * `widthM`/`heightM` são o tamanho real do painel; `moduleTargetM` é a
 * largura-alvo, usada como referência nos dois eixos.
 */
export function computeGlazingLayout(widthM: number, heightM: number, moduleTargetM: number): GlazingLayout {
  return {
    columns: computeAxisLayout(widthM, moduleTargetM),
    rows: computeAxisLayout(heightM, moduleTargetM),
  };
}

/**
 * Tamanho líquido do vidro dentro de um módulo, descontada a junta de
 * JOINT_MM (o vão total reservado entre um vidro e o vizinho — metade
 * fica de cada lado do perfil que passa por ali). Vale tanto pro eixo
 * de colunas quanto pro de linhas.
 */
export function netGlassSizeM(moduleSizeM: number): number {
  const jointM = JOINT_MM / 1000;
  return Math.max(0, moduleSizeM - jointM);
}
