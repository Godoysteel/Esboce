import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// MaterialsPanel.ts não é importável direto pelo test runner nativo do
// Node (mesma limitação documentada em outros testes deste arquivo:
// redirecionamento '.js' -> '.ts' que só o Vite resolve) — testado por
// busca de texto, igual aos demais testes deste módulo já existentes
// (ver construction-system.test.mjs).
const materialsSource = await readFile(
  new URL('../src/core/MaterialsPanel.ts', import.meta.url),
  'utf8',
);

// Preço real de cimento (catálogo do fornecedor "O Mercador", ver
// DEC-88): primeira ligação entre o quantitativo e o preço real do
// Supabase — só cimento, porque foi o único material estrutural com
// match limpo (mesma unidade de referência — saco 50kg — que o
// quantitativo já assumia). Bloco/aço do Mercador continuam sem match
// seguro: o catálogo só tem bloco de concreto celular 60x30x10
// (tamanho/material incompatível com o tijolo 9x19x19 que o
// quantitativo conta) e vergalhão vendido por barra (sem peso/metro
// confiável pra converter em R$/kg) — usar o preço deles pro cálculo
// deixaria a estimativa PIOR, não melhor.
test('busca de preço real de cimento (nível 1, fornecedor) exclui cimento branco (decorativo) e exige saco de 50kg', () => {
  const start = materialsSource.indexOf('const cimento = products.find(function (p) {');
  const end = materialsSource.indexOf('});', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /categoria === 'Cimento e Argamassa'/);
  assert.match(body, /!\/BRANCO\/i\.test\(p\.nome\)/);
  assert.match(body, /p\.unidade === 'SC'/);
  assert.match(body, /\/50\\s\*KG\/i\.test\(p\.nome\)/);
});

// "Não vamos deixar nada sem preços" (DEC-100/101): todo material
// estrutural do quantitativo tem um SKU garantido no fabricante
// "Vórtice Materiais" (preço médio de mercado) como nível 2 — só
// preenche o que o nível 1 (fornecedor real) não resolveu.
test('todo material do quantitativo (cimento/cal/areia/concreto/aço/tijolo) tem SKU de fallback no Vórtice Materiais', () => {
  const start = materialsSource.indexOf('const VORTICE_MATERIAL_SKUS');
  const end = materialsSource.indexOf('};', start);
  const body = materialsSource.slice(start, end);
  for (const key of ['cementPerKg', 'limePerKg', 'sandPerM3', 'concretePerM3', 'steelPerKg', 'brickPerUnit', 'woodPerM3']) {
    assert.match(body, new RegExp(key + ":\\s*\\{\\s*sku:"), `falta SKU de fallback pra ${key}`);
  }
});

// Forro de drywall (placa ST/RU/RF/cimentícia, F530, tabica, pendural)
// — mesmo padrão de "nenhum material sem preço garantido" acima,
// estendido pros 7 insumos novos do orçamento de forro.
test('todo material do forro (placa ST/RU/RF/cimentícia, F530, tabica, pendural) tem SKU de fallback no Vórtice Materiais', () => {
  const start = materialsSource.indexOf('const VORTICE_MATERIAL_SKUS');
  const end = materialsSource.indexOf('};', start);
  const body = materialsSource.slice(start, end);
  for (const key of ['forroPlacaSTPerM2', 'forroPlacaRUPerM2', 'forroPlacaRFPerM2', 'forroPlacaCimenticiaPerM2', 'forroF530PerM', 'forroTabicaPerM', 'forroPenduralPerUnit']) {
    assert.match(body, new RegExp(key + ":\\s*\\{\\s*sku:"), `falta SKU de fallback pra ${key}`);
  }
});

test('placa ST do forro tem match de fornecedor real (O Mercador) além do fallback Vórtice — mesmo padrão de dois níveis do cimento', () => {
  const start = materialsSource.indexOf('const placaST = products.find(function (p) {');
  const end = materialsSource.indexOf('});', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /manufacturer_id === mercador\.id/);
  assert.match(body, /\/\^PLACA GESSO ST\\b\/i\.test\(p\.nome\)/);
  assert.match(body, /p\.unidade === 'PC'/);
  assert.match(materialsSource, /realPrices\.forroPlacaSTPerM2 = \{/);
  assert.match(materialsSource, /value: placaST\.preco \/ 2\.16, source: placaST\.nome \+ ' — O Mercador'/);
  assert.match(materialsSource, /supplierName: 'O Mercador'/);
  assert.match(materialsSource, /kind: 'official'/);
});

test('todas as 7 chaves de preço do forro têm valor de emergência (REFERENCE_PRICES) — nunca ficam sem número nenhum', () => {
  const start = materialsSource.indexOf('const REFERENCE_PRICES');
  const end = materialsSource.indexOf('};', start);
  const body = materialsSource.slice(start, end);
  for (const key of ['forroPlacaSTPerM2', 'forroPlacaRUPerM2', 'forroPlacaRFPerM2', 'forroPlacaCimenticiaPerM2', 'forroF530PerM', 'forroTabicaPerM', 'forroPenduralPerUnit']) {
    assert.match(body, new RegExp(key + ':\\s*[\\d.]+'), `falta REFERENCE_PRICES pra ${key}`);
  }
});

test('nível 2 (Vórtice) só preenche o que o nível 1 (fornecedor real) não resolveu — não sobrescreve', () => {
  const start = materialsSource.indexOf('if (vortice) {');
  const end = materialsSource.indexOf('\n    }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /if \(realPrices\[key\]\) return; \/\/ já resolvido por fornecedor real/);
});

test('preço resolvido de material derivado carrega fornecedor, região e data para orçamento por fornecedor', () => {
  assert.match(materialsSource, /function materialCommercialSelection\(key: MaterialPriceKey\)/);
  assert.match(materialsSource, /supplierId: match\.supplierId/);
  assert.match(materialsSource, /region: match\.region/);
  assert.match(materialsSource, /priceDate: match\.priceDate/);
  assert.match(materialsSource, /kind: match\.kind/);
  assert.match(materialsSource, /push\(cat, item, qtyNum, unit, cost, materialCommercialSelection\(key\)\)/);
});

test('materialPrice cai pro fallback de emergência (REFERENCE_PRICES) quando nada do catálogo resolveu — sem quebrar, sem travar', () => {
  assert.match(materialsSource, /function materialPrice\(key: MaterialPriceKey\): number \{\s*\n\s*return realPrices\[key\] \? realPrices\[key\]!\.value : REFERENCE_PRICES\[key\];/);
});

test('busca de preço é assíncrona, cacheada (só busca uma vez) e nunca trava o render — erro de rede cai no catch, sem propagar', () => {
  const start = materialsSource.indexOf('async function ensureRealPrices(): Promise<void> {');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /if \(realPricesFetchStarted\) return;/);
  assert.match(body, /realPricesFetchStarted = true;/);
  assert.match(body, /catch \(err\) \{/);
  assert.match(body, /finally \{\s*\n\s*if \(onRealPricesLoaded\) onRealPricesLoaded\(\);/);
});

test('render() dispara a busca de preço só na primeira vez, sem bloquear o quantitativo em exibição', () => {
  const start = materialsSource.indexOf('export function render(): void {');
  const end = materialsSource.indexOf('const q = compute();', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /if \(!realPricesFetchStarted\) \{/);
  assert.match(body, /ensureRealPrices\(\);/);
  // Não usa "await" aqui — dispara e segue o render síncrono de
  // imediato, com o valor de emergência; o real chega depois, via
  // re-render.
  assert.doesNotMatch(body, /await ensureRealPrices/);
});

test('preço de catálogo aparece de forma visível (não escondido em tooltip) quando disponível — ver ADR-006 §15', () => {
  const start = materialsSource.indexOf('function priceSourceLine(');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /match\.source/);
  assert.doesNotMatch(body, /title=/); // nada de tooltip escondido
});

test('painel resumido mostra a linha de fonte pros 5 materiais visíveis ali (bloco, cimento, cal, areia, madeira)', () => {
  assert.match(materialsSource, /priceSourceLine\('brickPerUnit', '\/un'\)/);
  assert.match(materialsSource, /priceSourceLine\('cementPerKg', '\/kg'\)/);
  assert.match(materialsSource, /priceSourceLine\('limePerKg', '\/kg'\)/);
  assert.match(materialsSource, /priceSourceLine\('sandPerM3', '\/m³'\)/);
  assert.match(materialsSource, /priceSourceLine\('woodPerM3', '\/m³'\)/);
});

test('madeira do madeiramento vira peça de loja (3m) — ripa/caibro/terça cada uma com preço PRÓPRIO pela seção transversal dela, não uma média de m³ solta', () => {
  const start = materialsSource.indexOf("const tLabel = 'Madeiramento (ref. SINAPI 92539)';");
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(materialsSource, /const WOOD_PIECE_LENGTH_M = 3;/);
  assert.match(body, /Math\.ceil\(q\.roofTimber\.ripaLinearM \/ WOOD_PIECE_LENGTH_M\)/);
  assert.match(body, /Math\.ceil\(q\.roofTimber\.caibroLinearM \/ WOOD_PIECE_LENGTH_M\)/);
  assert.match(body, /Math\.ceil\(q\.roofTimber\.tercaLinearM \/ WOOD_PIECE_LENGTH_M\)/);
  assert.match(body, /woodPieceCost\(ROOF_TIMBER_REF\.ripaSectionM2\)/);
  assert.match(body, /woodPieceCost\(ROOF_TIMBER_REF\.caibroSectionM2\)/);
  assert.match(body, /woodPieceCost\(ROOF_TIMBER_REF\.tercaSectionM2\)/);
});

// DEC-106/107 (revisão): porta/janela de VIDRO (produto real de
// catálogo escolhido) vira item por PRODUTO, quantidade em m² real da
// abertura — convenção de mercado pra esquadria de vidro/alumínio,
// pedido do Product Owner. Porta SEM produto assume porta de madeira
// padrão, por UNIDADE (não existe produto de porta de madeira no
// catálogo ainda); janela sem produto continua por m² genérico (toda
// janela do catálogo é vidro, sem equivalente de madeira).
test('windowPerM2 continua com SKU de fallback no Vórtice e valor de emergência em REFERENCE_PRICES (doorPerM2 foi removido — porta sem produto agora é por unidade, não m²)', () => {
  const skuStart = materialsSource.indexOf('const VORTICE_MATERIAL_SKUS');
  const skuEnd = materialsSource.indexOf('};', skuStart);
  const skuBody = materialsSource.slice(skuStart, skuEnd);
  assert.doesNotMatch(skuBody, /doorPerM2/);
  assert.match(skuBody, /windowPerM2:\s*\{\s*sku:/);

  const refStart = materialsSource.indexOf('const REFERENCE_PRICES');
  const refEnd = materialsSource.indexOf('};', refStart);
  const refBody = materialsSource.slice(refStart, refEnd);
  assert.doesNotMatch(refBody, /doorPerM2/);
  assert.match(refBody, /windowPerM2:\s*150/);
});

test('productUnitCost aceita unidade "un" (porta/janela de fornecedor real) igual a "m2", multiplica preço × quantidade', () => {
  const start = materialsSource.indexOf('function productUnitCost(');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /p\.commercial\.unit === 'm2' \|\| p\.commercial\.unit === 'un'/);
});

test('contagem de aberturas usa a ÁREA REAL de cada porta/janela (largura×altura) e separa por produto real (m²) vs genérico — porta genérica conta por UNIDADE, janela genérica por ÁREA', () => {
  const start = materialsSource.indexOf('if (hostWall && hostWall.demolished) return;');
  const end = materialsSource.indexOf('vergaSpanM += op.width', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const openingAreaM2 = op\.width \* op\.height;/);
  assert.match(body, /addTo\(doorProducts, op\.productId!, openingAreaM2\)/);
  assert.match(body, /totals\.doorGenericCount\+\+;/);
  assert.match(body, /addTo\(windowProducts, op\.productId!, openingAreaM2\)/);
  assert.match(body, /totals\.windowsGenericAreaM2 \+= openingAreaM2;/);
});

test('porta/janela de vidro vira addProductRows (mesmo padrão de Pintura/Piso/Telhado), porta genérica vira porta de madeira por unidade, janela genérica continua m² pela média Vórtice', () => {
  const start = materialsSource.indexOf("addProductRows('Esquadrias de vidro', q.doorProducts, q.doorProductsCommercial);");
  const end = materialsSource.indexOf("if (q.totals.windowsGenericAreaM2 > 0)", start);
  const body = materialsSource.slice(start, materialsSource.indexOf('\n  }', end));
  assert.match(body, /addProductRows\('Esquadrias de vidro', q\.doorProducts, q\.doorProductsCommercial\);/);
  assert.match(body, /addProductRows\('Esquadrias de vidro', q\.windowProducts, q\.windowProductsCommercial\);/);
  assert.match(body, /q\.totals\.doorGenericCount \* ESTIMATED_MARKET_PRICES\.woodDoorPerUnit/);
  assert.match(body, /q\.totals\.windowsGenericAreaM2 \* materialPrice\('windowPerM2'\)/);
});

test('disclaimer do PDF avisa que o total é só material, sem mão de obra/projeto/taxas/instalações', () => {
  assert.match(materialsSource, /não inclui mão de obra/);
});
