// BalconyRailing.ts — constantes de perfil/vidro da Sacada de vidro
// (guarda-corpo procedural, categoria Aberturas). Reaproveita o layout
// de grid puro de Glazing.ts (computeGlazingLayout/netGlassSizeM/
// MIN_MODULE_M) sem duplicar a matemática — só as medidas do perfil e
// o material padrão do vidro mudam, calibradas no modelo de referência
// enviado pelo Product Owner (Sacada de vidro.glb): malha "Perfis"
// (travessa superior + 2 montantes, formato "П", sem moldura inferior
// — o vidro fica preso direto na borda da laje) e malha "Vidro 8mm"
// (alphaMode BLEND, doubleSided, baseColorFactor [0.8,0.8,0.8,0.116]
// — cinza claro bem transparente).

export { computeGlazingLayout, netGlassSizeM, MIN_MODULE_M } from './Glazing.js';
export type { AxisLayout, GlazingLayout } from './Glazing.js';

/** Profundidade do perfil de alumínio (eixo Z do montante/travessa), em metros — ~7cm no modelo de referência. */
export const RAILING_FRAME_DEPTH_M = 0.07;

/** Largura dos montantes verticais (de canto e entre módulos), em metros — mesma largura da Pele de vidro até termos vértices exatos do modelo de referência. */
export const RAILING_POST_WIDTH_M = 0.049;

/** Altura da travessa/caixilho superior, em metros. */
export const RAILING_TOP_RAIL_HEIGHT_M = 0.049;

/** Material padrão do vidro — aproximado do baseColorFactor [0.8,0.8,0.8,0.116] do modelo de referência (~88% transparente). */
export const DEFAULT_RAILING_GLASS_MATERIAL = Object.freeze({
  color: '#cccccc',
  opacity: 0.116,
  roughness: 0.2,
  metalness: 0,
  reflectionIntensity: 1,
});

/** Material padrão do perfil de alumínio — baseColorFactor [0.8,0.8,0.8,1] do modelo de referência, opaco, roughness 0.5. */
export const RAILING_FRAME_COLOR = '#cccccc';
export const RAILING_FRAME_ROUGHNESS = 0.5;
export const RAILING_FRAME_METALNESS = 0.3;
