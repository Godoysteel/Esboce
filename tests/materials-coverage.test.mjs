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

test('telhas cerâmicas reais (não-teste) ganham tileMeters — sem isso productUnitCost não calcula quantidade nenhuma pra unit "peca"', () => {
  const start = catalogSource.indexOf("id: 'vortice.telha.ceramica-natural'");
  const end = catalogSource.indexOf('} },', start);
  const body = catalogSource.slice(start, end);
  assert.match(body, /tileMeters:\s*0\.06/);
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
