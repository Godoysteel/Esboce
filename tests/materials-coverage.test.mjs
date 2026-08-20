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

// Pedido do Product Owner após auditoria de cobertura: piso, parede e
// telhado sem acabamento escolhido no editor não podem ficar de fora do
// orçamento silenciosamente — cada um cai num produto padrão de mercado.
test('parede sem acabamento (finishA/finishB) usa DEFAULT_PAINT_PRODUCT_ID como fallback', () => {
  assert.match(materialsSource, /addTo\(paint, w\.finishA \|\| DEFAULT_PAINT_PRODUCT_ID, faceArea\)/);
  assert.match(materialsSource, /addTo\(paint, w\.finishB \|\| DEFAULT_PAINT_PRODUCT_ID, faceArea\)/);
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
  assert.match(materialsSource, /addTo\(paint, roof\.gableFinishA \|\| DEFAULT_PAINT_PRODUCT_ID, oneGableArea\)/);
  assert.match(materialsSource, /addTo\(paint, roof\.gableFinishB \|\| DEFAULT_PAINT_PRODUCT_ID, oneGableArea\)/);
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

// Correção pós-lançamento: tileMeters é escala de repetição de TEXTURA
// na renderização 3D — usar o mesmo campo pra cobertura física de
// orçamento fazia telha cerâmica real mudar de escala visual sem
// querer. pecaCoverageM2 é um campo separado, só pra orçamento.
test('telhas cerâmicas reais NÃO ganham tileMeters — isso mudaria a escala visual da textura sem querer', () => {
  const start = catalogSource.indexOf("id: 'vortice.telha.ceramica-natural'");
  const end = catalogSource.indexOf('} },', start);
  const body = catalogSource.slice(start, end);
  assert.doesNotMatch(body, /tileMeters/);
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
  assert.match(materialsSource, /push\(tLabel, 'Pregos', nailKg, 'kg', nailKg \* materialPrice\('nailPerKg'\)\)/);
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
  assert.match(materialsSource, /push\('Alvenaria \(ref\. SINAPI\)', 'Cimento', masonryCementBags, 'sc\(50kg\)', masonryCementBags \* 50 \* materialPrice\('cementPerKg'\)\)/);
  assert.match(materialsSource, /const masonryCalBags = bagsQty\(q\.masonry\.calKg, 20\);/);
  assert.match(materialsSource, /const chapiscoCementBags = bagsQty\(bothFacesAreaM2 \* CHAPISCO_REF\.cementKgPerM2, 50\);/);
  assert.match(materialsSource, /const rebocoCementBags = bagsQty\(rebocoVolumeM3 \* MASONRY_REF\.cementKgPerM3, 50\);/);
  assert.match(materialsSource, /const rebocoCalBags = bagsQty\(rebocoVolumeM3 \* MASONRY_REF\.calKgPerM3, 20\);/);
  assert.match(materialsSource, /const contrapisoCementBags = bagsQty\(q\.totals\.floorArea \* CONTRAPISO_REF\.cementKgPerM2, 50\);/);
});

test('areia continua em m³ (unidade de compra normal em loja de material) — não vira "saco"', () => {
  assert.match(materialsSource, /push\('Alvenaria \(ref\. SINAPI\)', 'Areia média', q\.masonry\.sandM3, 'm³'/);
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

test('addProductRows usa purchaseQuantity pra exibir (não mais sempre m² cru), mas o custo continua vindo de productUnitCost sobre a área real', () => {
  const start = materialsSource.indexOf('function addProductRows(');
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const \{ qty, unit \} = purchaseQuantity\(p, areaM2\);/);
  assert.match(body, /push\(category, p \? p\.name : id, qty, unit, productUnitCost\(id, areaM2\)\)/);
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
  assert.match(body, /const cost = b\.finishProductId \? productUnitCost\(b\.finishProductId, surfaceAreaM2\) : null;/);
  assert.match(materialsSource, /const volumeBoxCost = q\.totals\.volumeBoxProductCost \+ q\.totals\.volumeBoxGenericAreaM2 \* ESTIMATED_MARKET_PRICES\.volumeBoxGenericPerM2;/);
});

// Móveis: soma o preço já cadastrado no PRÓPRIO produto do Catálogo
// (Furniture.productId) — sem estimativa nova inventada aqui (os
// móveis de exemplo do Catálogo estão com preço 0 hoje; é uma tarefa
// separada de dados de catálogo, não deste quantitativo).
test('Móveis somam o preço do produto do Catálogo (Furniture.productId), sem estimativa nova pra móvel', () => {
  assert.match(materialsSource, /const product = Catalog\.getProduct\(f\.productId\);/);
  assert.match(materialsSource, /if \(product && product\.commercial && product\.commercial\.price\) totals\.furnitureCost \+= product\.commercial\.price;/);
  assert.match(materialsSource, /push\('Mobiliário', 'Móveis posicionados', q\.totals\.furnitureCount, 'un', q\.totals\.furnitureCost > 0 \? q\.totals\.furnitureCost : null\)/);
});
