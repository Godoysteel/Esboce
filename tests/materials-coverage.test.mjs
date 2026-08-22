import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Mesma limitação/técnica dos demais testes deste módulo: MaterialsPanel.ts
// e Catalog.ts não são importáveis direto pelo test runner nativo do Node
// (redirecionamento '.js' -> '.ts' que só o Vite resolve) — testado por
// busca de texto (ver materials-real-price.test.mjs).
const materialsSource = await readFile(
  new URL('../src/core/MaterialsPanel.ts', import.meta.url),
  'utf8',
);
const catalogSource = await readFile(
  new URL('../src/core/Catalog.ts', import.meta.url),
  'utf8',
);
const typesSource = await readFile(
  new URL('../src/core/types.ts', import.meta.url),
  'utf8',
);
const rendererSource = await readFile(
  new URL('../src/core/Scene3DRenderer.ts', import.meta.url),
  'utf8',
);

// Pedido do Product Owner após auditoria de cobertura: piso, parede e
// telhado sem acabamento escolhido no editor não podem ficar de fora do
// orçamento silenciosamente — cada um cai num produto padrão de mercado.
test('parede sem acabamento (finishA/finishB) usa DEFAULT_PAINT_PRODUCT_ID como fallback', () => {
  assert.match(materialsSource, /const finishA = w\.finishA \|\| DEFAULT_PAINT_PRODUCT_ID;/);
  assert.match(materialsSource, /const finishB = w\.finishB \|\| DEFAULT_PAINT_PRODUCT_ID;/);
  assert.match(materialsSource, /addTo\(paint, finishA, faceArea\)/);
  assert.match(materialsSource, /addTo\(paint, finishB, faceArea\)/);
});

test('cômodo sem piso escolhido usa DEFAULT_FLOOR_TILE_PRODUCT_ID (porcelanato padrão) como fallback', () => {
  assert.match(materialsSource, /addTo\(floorTile, finishId \|\| DEFAULT_FLOOR_TILE_PRODUCT_ID, areaM2\)/);
});

test('telhado sem acabamento escolhido usa eternit pra platibanda e cerâmica pros demais tipos', () => {
  assert.match(
    materialsSource,
    /addTo\(roofTile, roof\.finishProductId \|\| \(roof\.type === 'platibanda' \? DEFAULT_ETERNIT_PRODUCT_ID : DEFAULT_CERAMIC_TILE_PRODUCT_ID\), areaM2\)/,
  );
});

test('oitão (empena) sem acabamento também usa o padrão de tinta, nas duas faces', () => {
  assert.match(materialsSource, /const gableFinishA = roof\.gableFinishA \|\| DEFAULT_PAINT_PRODUCT_ID;/);
  assert.match(materialsSource, /const gableFinishB = roof\.gableFinishB \|\| DEFAULT_PAINT_PRODUCT_ID;/);
  assert.match(materialsSource, /addTo\(paint, gableFinishA, oneGableArea\)/);
  assert.match(materialsSource, /addTo\(paint, gableFinishB, oneGableArea\)/);
});

// Forro de drywall não entrava em NENHUM quantitativo até esta versão —
// mesmo padrão condicional da laje (roomLajeGenerated), agrupado por
// tipo de placa porque cada tipo tem preço e espaçamento de perfil
// diferentes (ST 60cm, RU/RF/cimentícia 40cm — ver Scene3DRenderer.ts
// FORRO_RUNNER_SPACING_M/_TIGHT_M).
test('compute() soma o forro por cômodo condicionado a roomForroGenerated, agrupado por roomForroTipo (padrão ST se ausente)', () => {
  const start = materialsSource.indexOf("if (!(floor.roomForroGenerated || {})[roomKey]) return;");
  assert.notEqual(start, -1);
  const end = materialsSource.indexOf('});', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const tipo = \(floor\.roomForroTipo \|\| \{\}\)\[roomKey\] \|\| 'ST';/);
  assert.match(body, /const spacingM = tipo === 'ST' \? 0\.6 : 0\.4;/);
  assert.match(body, /const perimeterM = polygonPerimeterMeters\(room\.points\);/);
});

test('buildRows() empurra uma linha "Forro" por tipo de placa (preço diferente cada) e uma linha combinada de F530/tabica/pendural (preço igual pra qualquer tipo)', () => {
  const start = materialsSource.indexOf('Object.keys(q.totals.forroByTipo).forEach(function (tipo) {');
  assert.notEqual(start, -1);
  const end = materialsSource.indexOf('\n  }\n\n  // Esgoto e pluvial', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /pushMaterial\('Forro', 'Placa ' \+ \(FORRO_TIPO_LABEL\[tipo\] \|\| tipo\) \+ ' \(área\)'/);
  assert.match(body, /pushMaterial\('Forro', 'Perfil F530 \(estimado\)'/);
  assert.match(body, /pushMaterial\('Forro', 'Tabica de perímetro'/);
  assert.match(body, /pushMaterial\('Forro', 'Pendural — arame e regulador \(estimado\)'/);
});

test('os 4 produtos padrão apontam pra IDs reais existentes no Catalog', () => {
  const ids = ['vortice.tinta.fosco-branco-gelo', 'vortice.piso.porcelanato-padrao', 'vortice.telha.ceramica-natural', 'vortice.telha.eternit-6mm'];
  for (const id of ids) {
    assert.match(catalogSource, new RegExp("id: '" + id.replace('.', '\\.') + "'"), `produto ${id} não existe no Catalog`);
  }
});

test('telhas cerâmicas reais (não-teste) ganham pecaCoverageM2 — sem isso productUnitCost não calcula quantidade nenhuma pra unit "peca"', () => {
  const start = catalogSource.indexOf("id: 'vortice.telha.ceramica-natural'");
  const end = catalogSource.indexOf('} },', start);
  const body = catalogSource.slice(start, end);
  assert.match(body, /pecaCoverageM2:\s*0\.06/);
});

// tileMeters é escala visual e pecaCoverageM2 é cobertura comercial. Os dois
// podem coexistir, mas o quantitativo nunca pode usar a escala da textura.
test('telha cerâmica real declara escala visual separada da cobertura comercial', () => {
  const start = catalogSource.indexOf("id: 'vortice.telha.ceramica-natural'");
  const end = catalogSource.indexOf('} },', start);
  const body = catalogSource.slice(start, end);
  assert.match(body, /tileMeters:\s*3\.0/);
  assert.match(body, /pecaCoverageM2:\s*0\.06/);
});

test('produtiUnitCost/purchaseQuantity leem pecaCoverageM2, nunca tileMeters, pra calcular quantidade de peça', () => {
  assert.match(materialsSource, /p\.commercial\.unit === 'peca' && p\.assets && p\.assets\.pecaCoverageM2/);
  assert.match(materialsSource, /Math\.ceil\(areaM2 \/ p\.assets\.pecaCoverageM2\) \* price/);
});

// Correção de domínio: telhado platibanda ("embutido" atrás do
// parapeito) usa estrutura de madeira real na prática construtiva,
// não é laje maciça sem cobertura — a exclusão antiga zerava
// madeiramento/telha pra esse tipo inteiro.
test('platibanda NÃO é mais excluída do madeiramento de telhado (ripa/caibro/terça)', () => {
  assert.doesNotMatch(materialsSource, /if \(roof\.type !== 'platibanda'\) totals\.roofTimberAreaM2/);
  assert.match(materialsSource, /totals\.roofTimberAreaM2 \+= areaM2;/);
});

test('pregos do madeiramento (SINAPI 92539: 0,03+0,05+0,07 kg/m²) viram linha de custo própria', () => {
  assert.match(materialsSource, /const ROOF_TIMBER_NAIL_KG_PER_M2 = 0\.03 \+ 0\.05 \+ 0\.07;/);
  assert.match(materialsSource, /const nailKg = q\.roofTimber\.areaM2 \* ROOF_TIMBER_NAIL_KG_PER_M2;/);
  assert.match(materialsSource, /pushMaterial\(tLabel, 'Pregos', nailKg, 'kg', nailKg \* materialPrice\('nailPerKg'\), 'nailPerKg'\)/);
});

test('nailPerKg tem SKU de fallback no Vórtice e valor de emergência em REFERENCE_PRICES', () => {
  assert.match(materialsSource, /nailPerKg:\s*\{\s*sku: 'vortice-prego-kg'/);
  assert.match(materialsSource, /nailPerKg:\s*14\.00/);
});

test('Contrapiso (traço 1:4, 3cm) vira categoria própria, cobrando cimento e areia sobre a área de piso', () => {
  assert.match(materialsSource, /const CONTRAPISO_REF = \{ cementKgPerM2: 0\.21 \* 50, sandM3PerM2: 0\.033 \};/);
  const start = materialsSource.indexOf("const cLabel = 'Contrapiso");
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /q\.totals\.floorArea \* CONTRAPISO_REF\.cementKgPerM2/);
  assert.match(body, /q\.totals\.floorArea \* CONTRAPISO_REF\.sandM3PerM2/);
});

// Pedido do Product Owner após ver o PDF: quantidade em unidade de
// COMPRA de verdade (sacos, latas, peças), não na unidade de cálculo
// interno (kg, m²) — "orçamento por quantidade de produto, ex: 02
// sacos de cimento 50kg".
test('bagsQty arredonda pra cima — cimento/cal só vêm em saco fechado, não a granel', () => {
  assert.match(materialsSource, /function bagsQty\(kg: number, bagKg: number\): number \{\s*\n\s*return Math\.ceil\(kg \/ bagKg\);/);
});

test('cimento/cal da alvenaria, chapisco/reboco e contrapiso aparecem em sacos (50kg/20kg), custo pela quantidade arredondada', () => {
  assert.match(materialsSource, /const masonryCementBags = bagsQty\(q\.masonry\.cementKg, 50\);/);
  assert.match(materialsSource, /pushMaterial\('Alvenaria \(ref\. SINAPI\)', 'Cimento', masonryCementBags, 'sc\(50kg\)', masonryCementBags \* 50 \* materialPrice\('cementPerKg'\), 'cementPerKg'\)/);
  assert.match(materialsSource, /const masonryCalBags = bagsQty\(q\.masonry\.calKg, 20\);/);
  assert.match(materialsSource, /const chapiscoCementBags = bagsQty\(bothFacesAreaM2 \* CHAPISCO_REF\.cementKgPerM2, 50\);/);
  assert.match(materialsSource, /const rebocoCementBags = bagsQty\(rebocoVolumeM3 \* MASONRY_REF\.cementKgPerM3, 50\);/);
  assert.match(materialsSource, /const rebocoCalBags = bagsQty\(rebocoVolumeM3 \* MASONRY_REF\.calKgPerM3, 20\);/);
  assert.match(materialsSource, /const contrapisoCementBags = bagsQty\(q\.totals\.floorArea \* CONTRAPISO_REF\.cementKgPerM2, 50\);/);
});

test('areia continua em m³ (unidade de compra normal em loja de material) — não vira "saco"', () => {
  assert.match(materialsSource, /pushMaterial\('Alvenaria \(ref\. SINAPI\)', 'Areia média', q\.masonry\.sandM3, 'm³'/);
});

test('purchaseQuantity converte tinta pra lata(s) 18L e telha/peça pra peça(s), mas mantém m² pra produto vendido assim (porcelanato/pedra)', () => {
  const start = materialsSource.indexOf('function purchaseQuantity(');
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /unit === 'lata_18L'/);
  assert.match(body, /Math\.ceil\(\(areaM2 \* PAINT_COATS\) \/ PAINT_YIELD_M2_PER_CAN_PER_COAT\)/);
  assert.match(body, /unit === 'peca' && p\.assets && p\.assets\.pecaCoverageM2/);
  assert.match(body, /Math\.ceil\(areaM2 \/ p\.assets\.pecaCoverageM2\)/);
  assert.match(body, /return \{ qty: areaM2, unit: 'm²' \};/);
});

test('addProductRows usa purchaseQuantity e prioriza o preço congelado da oferta sobre o catálogo atual', () => {
  const start = materialsSource.indexOf('function addProductRows(');
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const \{ qty, unit \} = purchaseQuantity\(p, areaM2\);/);
  assert.match(body, /productUnitCost\(line\.productId, areaM2, selection\?\.price\)/);
  assert.match(body, /selection\.supplierName/);
  assert.match(body, /selection\.region/);
  assert.match(body, /selection\.priceDate/);
});

test('quantitativo comercial separa o mesmo produto por oferta e só aceita snapshot do produto aplicado', () => {
  assert.match(materialsSource, /const key = productId \+ '::' \+ \(validSelection \? validSelection\.offerId : 'catalog'\);/);
  assert.match(materialsSource, /return selection\?\.productId === productId \? selection : undefined;/);
});

test('orçamento soma ofertas escolhidas por fornecedor sem atribuir fallback a uma loja', () => {
  assert.match(materialsSource, /const supplierTotals = new Map/);
  assert.match(materialsSource, /if \(cost != null && selection\)/);
  assert.match(materialsSource, /supplierTotals\.get\(selection\.supplierId\)/);
  assert.match(materialsSource, /'Subtotal — ' \+ supplier\.supplierName/);
  assert.match(materialsSource, /estimativa, não constitui oferta comercial/);
});

test('Chapisco+Reboco vira categoria própria, aplicado nas DUAS faces de toda parede (wallAreaNet × 2)', () => {
  assert.match(materialsSource, /const CHAPISCO_REF = \{ cementKgPerM2: 2\.25, sandM3PerM2: 0\.0053 \};/);
  assert.match(materialsSource, /const REBOCO_THICKNESS_M = 0\.02;/);
  const start = materialsSource.indexOf("const bothFacesAreaM2");
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /q\.totals\.wallAreaNet \* 2/);
  assert.match(body, /bothFacesAreaM2 \* CHAPISCO_REF\.cementKgPerM2/);
  assert.match(body, /bothFacesAreaM2 \* REBOCO_THICKNESS_M/);
  // Reboco reaproveita os MESMOS kg/m³ de cimento/cal/areia já usados
  // pra argamassa de assentamento (MASONRY_REF, traço 1:2:8) — não
  // duplica constante.
  assert.match(body, /rebocoVolumeM3 \* MASONRY_REF\.cementKgPerM3/);
  assert.match(body, /rebocoVolumeM3 \* MASONRY_REF\.calKgPerM3/);
  assert.match(body, /rebocoVolumeM3 \* MASONRY_REF\.sandM3PerM3/);
});

// Product Owner: "como podemos aferir se tudo o que está sendo criado
// está mesmo sendo quantificado e orçado?" — auditoria manual encontrou
// 5 peças com ZERO linha no quantitativo (Pele de vidro, Sacada de
// vidro, Varanda, Bloco de Volumetria, Móveis). Corrigidas nesta
// versão (ver Registro de Decisões Técnicas), e este teste passa a
// existir especificamente pra NUNCA mais depender de auditoria manual
// de novo: qualquer array de entidade novo adicionado em `Floor`
// (types.ts) que não apareça em algum lugar de MaterialsPanel.ts falha
// aqui automaticamente, na hora que a peça for criada — não meses
// depois, numa conversa como esta.
test('cobertura de quantitativo: TODO array de entidade de Floor (types.ts) aparece em algum lugar de MaterialsPanel.ts', () => {
  const floorStart = typesSource.indexOf('export interface Floor {');
  assert.ok(floorStart !== -1, 'Floor não encontrada em types.ts — o arquivo mudou de formato?');
  const floorEnd = typesSource.indexOf('\n}', floorStart);
  const floorBody = typesSource.slice(floorStart, floorEnd);
  // Só campos que são ARRAY de entidade (ex.: "walls: Wall[];") — id/
  // name/kind/planUnderlay/roomFinishes(*) não representam uma peça
  // construída que precise de linha de quantitativo.
  const arrayFields = Array.from(floorBody.matchAll(/^\s*(\w+): \w+\[\];/gm)).map((m) => m[1]);
  assert.ok(arrayFields.length >= 10, 'esperava pelo menos 10 arrays de entidade em Floor — a extração por regex quebrou?');
  arrayFields.forEach((field) => {
    assert.match(
      materialsSource,
      new RegExp('floor\\.' + field + '\\b'),
      `floor.${field} não aparece em MaterialsPanel.ts — peça nova sem cobertura de quantitativo (ver DEC de auditoria)`,
    );
  });
});

test('Pele de vidro, Sacada de vidro e Varanda viram linha de custo real em buildRows(), pela média de mercado (ESTIMATED_MARKET_PRICES)', () => {
  assert.match(materialsSource, /totals\.glazingPanelAreaM2 \+= p\.widthM \* p\.heightM;/);
  assert.match(materialsSource, /totals\.balconyRailingLengthM \+= r\.widthM;/);
  assert.match(materialsSource, /totals\.varandaAreaM2 \+= Math\.abs\(\(v\.x2 - v\.x1\) \* \(v\.y2 - v\.y1\)\) \/ \(Core\.GRID \* Core\.GRID\);/);
  assert.match(materialsSource, /push\('Geral', 'Pele de vidro \(área\)', q\.totals\.glazingPanelAreaM2, 'm²', q\.totals\.glazingPanelAreaM2 \* ESTIMATED_MARKET_PRICES\.glazingPanelPerM2\)/);
  assert.match(materialsSource, /push\('Geral', 'Sacada de vidro \(comprimento\)', q\.totals\.balconyRailingLengthM, 'm', q\.totals\.balconyRailingLengthM \* ESTIMATED_MARKET_PRICES\.balconyRailingPerM\)/);
  assert.match(materialsSource, /push\('Geral', 'Varanda \(área\)', q\.totals\.varandaAreaM2, 'm²', q\.totals\.varandaAreaM2 \* ESTIMATED_MARKET_PRICES\.varandaPerM2\)/);
});

test('ESTIMATED_MARKET_PRICES tem os 4 valores de referência esperados (m² de vidro, m linear de guarda-corpo, m² de varanda, m² de volumetria genérica)', () => {
  const start = materialsSource.indexOf('const ESTIMATED_MARKET_PRICES = {');
  const end = materialsSource.indexOf('};', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /glazingPanelPerM2:\s*580\.00/);
  assert.match(body, /balconyRailingPerM:\s*420\.00/);
  assert.match(body, /varandaPerM2:\s*320\.00/);
  assert.match(body, /volumeBoxGenericPerM2:\s*260\.00/);
});

// Bloco de Volumetria: mesmo padrão fornecedor-real-primeiro de portas/
// janelas — se tem finishProductId escolhido (Lata de tinta, DEC-134),
// usa o preço do PRÓPRIO produto pela área de superfície (as 6 faces);
// sem acabamento, cai na média de mercado genérica.
test('Bloco de Volumetria: custo usa o produto pintado (Lata de tinta) quando existe, senão a média de mercado genérica pela área de superfície', () => {
  const start = materialsSource.indexOf('(floor.volumeBoxes || []).forEach(function (b) {');
  const end = materialsSource.indexOf('\n    });', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const surfaceAreaM2 = 2 \* \(b\.widthM \* b\.heightM \+ b\.widthM \* b\.depthM \+ b\.heightM \* b\.depthM\);/);
  assert.match(body, /productUnitCost\(b\.finishProductId, surfaceAreaM2, selection\?\.price\)/);
  assert.match(body, /addCommercialQuantity\(volumeBoxCommercial, b\.finishProductId, surfaceAreaM2, selection\)/);
  assert.match(materialsSource, /push\('Volumetria', 'Bloco de Volumetria \(sem acabamento\)'/);
});

// Móveis: soma o preço já cadastrado no PRÓPRIO produto do Catálogo
// (Furniture.productId) — sem estimativa nova inventada aqui (os
// móveis de exemplo do Catálogo estão com preço 0 hoje; é uma tarefa
// separada de dados de catálogo, não deste quantitativo).
test('Móveis usam o snapshot da oferta e caem no preço do produto quando ele não existe', () => {
  assert.match(materialsSource, /const product = Catalog\.getProduct\(f\.productId\);/);
  assert.match(materialsSource, /const price = selection\?\.price \?\? product\?\.commercial\?\.price;/);
  assert.match(materialsSource, /addCommercialQuantity\(furnitureCommercial, f\.productId, 1, selection\)/);
  assert.match(materialsSource, /push\('Mobiliário', \(p \? p\.name : line\.productId\) \+ trace, line\.quantity, 'un'/);
});

// Product Owner, depois de conferir a auditoria de quantitativo: "está
// contabilizando as paredes da platibanda, aquelas muretinhas e quando
// ela avança para fora das paredes tem que contabilizar a laje do
// bairal também, isso é contabilizado hoje?" — pesquisado antes de
// implementar (platibanda é geometricamente o OPOSTO do beiral —
// parede que sobe, sem projeção horizontal — mas sempre construída com
// o mesmo bloco/tijolo da parede comum). Dois buracos reais
// confirmados e corrigidos: a muretinha em si (geometria pura, nunca
// foi uma Wall) e a laje que precisa acompanhar o retângulo do telhado
// quando ele é arrastado pra além do contorno da parede.

test('Scene3DRenderer expõe os getters de altura do parapeito (clamp) pro quantitativo não duplicar o valor', () => {
  assert.match(rendererSource, /export function PARAPET_HEIGHT_MIN_GETTER\(\) \{ return PARAPET_HEIGHT_MIN; \}/);
  assert.match(rendererSource, /export function PARAPET_HEIGHT_MAX_GETTER\(\) \{ return PARAPET_HEIGHT_MAX; \}/);
  assert.match(rendererSource, /export function PARAPET_HEIGHT_DEFAULT_GETTER\(\) \{ return PARAPET_HEIGHT_DEFAULT; \}/);
  const start = rendererSource.indexOf('export const Scene3DRenderer = {');
  const end = rendererSource.indexOf('};', start);
  const body = rendererSource.slice(start, end);
  assert.match(body, /PARAPET_HEIGHT_MIN_GETTER/);
  assert.match(body, /PARAPET_HEIGHT_MAX_GETTER/);
  assert.match(body, /PARAPET_HEIGHT_DEFAULT_GETTER/);
});

test('muretinha da platibanda (geometria pura, nunca foi Wall) vira alvenaria de verdade: perímetro × altura real do parapeito, em wallAreaNet e pintada nas duas faces', () => {
  const start = materialsSource.indexOf("addTo(roofTile, roof.finishProductId ||");
  const end = materialsSource.indexOf('\n      }', materialsSource.indexOf("if (roof.type === 'platibanda') {", start));
  const body = materialsSource.slice(start, end);
  assert.match(body, /const parapetHeightM = clampParapetHeight\(roof\.parapetHeight\);/);
  assert.match(body, /const parapetAreaM2 = 2 \* \(parapetWidthM \+ parapetDepthM\) \* parapetHeightM;/);
  assert.match(body, /totals\.wallAreaNet \+= parapetAreaM2;/);
  const paintCount = (body.match(/addTo\(paint, DEFAULT_PAINT_PRODUCT_ID, parapetAreaM2\);/g) || []).length;
  assert.equal(paintCount, 2, 'a muretinha tem duas faces (dentro/fora) — mesmo padrão do oitão');
});

test('clampParapetHeight usa os mesmos 3 valores do 3D via getter, não duplica o clamp', () => {
  const start = materialsSource.indexOf('function clampParapetHeight(');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /Scene3DRenderer\.PARAPET_HEIGHT_MIN_GETTER\(\)/);
  assert.match(body, /Scene3DRenderer\.PARAPET_HEIGHT_MAX_GETTER\(\)/);
  assert.match(body, /Scene3DRenderer\.PARAPET_HEIGHT_DEFAULT_GETTER\(\)/);
});

test('laje acompanha o retângulo do telhado platibanda quando ele avança pra fora das paredes — soma só a diferença, sem contar duas vezes', () => {
  const start = materialsSource.indexOf("if (roof.type !== 'platibanda') return;");
  assert.ok(start !== -1, 'bloco de laje-vs-platibanda não encontrado');
  const end = materialsSource.indexOf('\n    });', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const room = Core\.roomAtPoint\(floor\.walls, cx, cy\);/);
  assert.match(body, /if \(!\(floor\.roomLajeGenerated \|\| \{\}\)\[roomKey\]\) return;/);
  assert.match(body, /if \(roofFootprintAreaM2 > roomAreaM2\) totals\.lajeAreaM2 \+= roofFootprintAreaM2 - roomAreaM2;/);
});
