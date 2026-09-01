export interface BoldCatalogProduct {
  id: string;
  name: string;
  line: "EasyBold +5";
  color: string;
  finish: "Brilho" | "Fosco" | "Metálico" | "Madeira" | "Cimento";
  dimensions: string;
  thicknessMm: 3;
  publicPriceBrl: number;
  swatch: string;
  textureSlug: string;
  pbr: { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; normalScale: number };
  sourceUrl: string;
}

export const BOLD_CATEGORY_URL = "https://www.bold.net/BoldB2b/categoria/todos-os-departamentos/chapas-de-acm/0ZGN400000003u0OAA";
export const BOLD_ACM_MANUAL_URL = "https://institucional.bold.net/wp-content/uploads/2025/10/BOLD_Manual_Instalacao_ACM_ALTERADO_SETEMBRO25.pdf";
export const BOLD_PRICE_REFERENCE_DATE = "01/09/2026";

/**
 * Recorte curado do catálogo público da Bold para descoberta no Esboce.
 * Não representa estoque, proposta comercial nem integração oficial. Preços
 * podem mudar e devem ser confirmados no site de origem antes da compra.
 */
export const BOLD_ACM_PRODUCTS: readonly BoldCatalogProduct[] = [
  { id: "bold-acm-azul-cobalto-1220", name: "ACM Azul Cobalto Fosco", line: "EasyBold +5", color: "Azul Cobalto", finish: "Fosco", dimensions: "1.220 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 851.85, swatch: "#164a8a", textureSlug: "azul-cobalto-fosco", pbr: { metalness: .2, roughness: .7, clearcoat: .12, clearcoatRoughness: .62, normalScale: .12 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-azul-cobalto-1500", name: "ACM Azul Cobalto Fosco", line: "EasyBold +5", color: "Azul Cobalto", finish: "Fosco", dimensions: "1.500 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 1047.35, swatch: "#164a8a", textureSlug: "azul-cobalto-fosco", pbr: { metalness: .2, roughness: .7, clearcoat: .12, clearcoatRoughness: .62, normalScale: .12 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-grafite-1220", name: "ACM Grafite Metálico", line: "EasyBold +5", color: "Grafite", finish: "Metálico", dimensions: "1.220 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 767.80, swatch: "linear-gradient(135deg,#303438,#777d82 50%,#26292c)", textureSlug: "grafite-metalico", pbr: { metalness: .8, roughness: .34, clearcoat: .3, clearcoatRoughness: .28, normalScale: .08 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-grafite-1500", name: "ACM Grafite Metálico", line: "EasyBold +5", color: "Grafite", finish: "Metálico", dimensions: "1.500 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 944.02, swatch: "linear-gradient(135deg,#303438,#777d82 50%,#26292c)", textureSlug: "grafite-metalico", pbr: { metalness: .8, roughness: .34, clearcoat: .3, clearcoatRoughness: .28, normalScale: .08 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-laranja-1220", name: "ACM Laranja Brilho", line: "EasyBold +5", color: "Laranja", finish: "Brilho", dimensions: "1.220 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 767.80, swatch: "linear-gradient(135deg,#e55416,#ff9a4f 46%,#c83d0d)", textureSlug: "laranja-brilho", pbr: { metalness: .16, roughness: .19, clearcoat: .9, clearcoatRoughness: .12, normalScale: .04 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-dourado-1500", name: "ACM Dourado Metálico", line: "EasyBold +5", color: "Dourado", finish: "Metálico", dimensions: "1.500 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 1042.18, swatch: "linear-gradient(135deg,#7f5e20,#d6b66c 48%,#8d6b2d)", textureSlug: "dourado-metalico", pbr: { metalness: .84, roughness: .3, clearcoat: .34, clearcoatRoughness: .25, normalScale: .07 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-branco-1220", name: "ACM Branco Brilho", line: "EasyBold +5", color: "Branco", finish: "Brilho", dimensions: "1.220 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 767.80, swatch: "linear-gradient(135deg,#e9e9e6,#ffffff 52%,#d2d4d1)", textureSlug: "branco-brilho", pbr: { metalness: .14, roughness: .16, clearcoat: .95, clearcoatRoughness: .1, normalScale: .03 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-branco-1500", name: "ACM Branco Brilho", line: "EasyBold +5", color: "Branco", finish: "Brilho", dimensions: "1.500 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 944.02, swatch: "linear-gradient(135deg,#e9e9e6,#ffffff 52%,#d2d4d1)", textureSlug: "branco-brilho", pbr: { metalness: .14, roughness: .16, clearcoat: .95, clearcoatRoughness: .1, normalScale: .03 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-madeira-clara-1220", name: "ACM Madeira Clara", line: "EasyBold +5", color: "Madeira Clara", finish: "Madeira", dimensions: "1.220 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 965.34, swatch: "repeating-linear-gradient(100deg,#b77c42 0 10px,#d4a66d 10px 18px,#9e6636 18px 21px)", textureSlug: "madeira-clara", pbr: { metalness: .18, roughness: .41, clearcoat: .52, clearcoatRoughness: .3, normalScale: .13 }, sourceUrl: BOLD_CATEGORY_URL },
  { id: "bold-acm-cimento-queimado-1220", name: "ACM Cimento Queimado", line: "EasyBold +5", color: "Cimento Queimado", finish: "Cimento", dimensions: "1.220 × 5.000 mm", thicknessMm: 3, publicPriceBrl: 1120.38, swatch: "linear-gradient(145deg,#777978,#a4a6a4 48%,#676a68)", textureSlug: "cimento-queimado", pbr: { metalness: .18, roughness: .52, clearcoat: .25, clearcoatRoughness: .45, normalScale: .08 }, sourceUrl: BOLD_CATEGORY_URL },
];
