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

test('nível 2 (Vórtice) só preenche o que o nível 1 (fornecedor real) não resolveu — não sobrescreve', () => {
  const start = materialsSource.indexOf('if (vortice) {');
  const end = materialsSource.indexOf('\n    }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /if \(realPrices\[key\]\) return; \/\/ já resolvido por fornecedor real/);
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

test('volume de madeira ganha custo próprio (woodPerM3); ripas/caibros/terças continuam sem custo individual, pra não duplicar o mesmo volume', () => {
  const start = materialsSource.indexOf("const tLabel = 'Madeiramento (ref. SINAPI 92539)';");
  const end = materialsSource.indexOf('\n  }', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /push\(tLabel, 'Ripas', q\.roofTimber\.ripaLinearM, 'm', null\)/);
  assert.match(body, /push\(tLabel, 'Caibros', q\.roofTimber\.caibroLinearM, 'm', null\)/);
  assert.match(body, /push\(tLabel, 'Terças', q\.roofTimber\.tercaLinearM, 'm', null\)/);
  assert.match(body, /push\(tLabel, 'Volume total de madeira', q\.roofTimber\.volumeM3, 'm³', q\.roofTimber\.volumeM3 \* materialPrice\('woodPerM3'\)\)/);
});

// DEC-106/107: portas e janelas deixam de ficar sem preço. São
// esquadrias de tamanho livre (largura/altura ajustáveis por abertura),
// então o preço é por M² REAL da abertura, não por unidade fixa —
// senão uma janela pequena custaria igual a uma grande. Porta/janela
// com Opening.productId de um fornecedor real (ex.: parceiro de vidro)
// usa o preço próprio (pela área real); sem produto escolhido, a área
// cai na média Vórtice por m² — mesmo padrão fornecedor real > média
// já validado pro cimento.
test('doorPerM2/windowPerM2 têm SKU de fallback no Vórtice e valor de emergência em REFERENCE_PRICES', () => {
  const skuStart = materialsSource.indexOf('const VORTICE_MATERIAL_SKUS');
  const skuEnd = materialsSource.indexOf('};', skuStart);
  const skuBody = materialsSource.slice(skuStart, skuEnd);
  assert.match(skuBody, /doorPerM2:\s*\{\s*sku:/);
  assert.match(skuBody, /windowPerM2:\s*\{\s*sku:/);

  const refStart = materialsSource.indexOf('const REFERENCE_PRICES');
  const refEnd = materialsSource.indexOf('};', refStart);
  const refBody = materialsSource.slice(refStart, refEnd);
  assert.match(refBody, /doorPerM2:\s*700/);
  assert.match(refBody, /windowPerM2:\s*150/);
});

test('productUnitCost aceita unidade "un" (porta/janela de fornecedor real) igual a "m2", multiplica preço × quantidade', () => {
  const start = materialsSource.indexOf('function productUnitCost(');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /p\.commercial\.unit === 'm2' \|\| p\.commercial\.unit === 'un'/);
});

test('contagem de aberturas usa a ÁREA REAL de cada porta/janela (largura×altura), não unidade fixa, e separa custo por produto real da área genérica', () => {
  const start = materialsSource.indexOf('if (hostWall && hostWall.demolished) return;');
  const end = materialsSource.indexOf('vergaSpanM += op.width', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const openingAreaM2 = op\.width \* op\.height;/);
  assert.match(body, /totals\.doorsProductCost \+= cost;/);
  assert.match(body, /totals\.doorsGenericAreaM2 \+= openingAreaM2;/);
  assert.match(body, /totals\.windowsProductCost \+= cost;/);
  assert.match(body, /totals\.windowsGenericAreaM2 \+= openingAreaM2;/);
});

test('linha de Portas/Janelas soma custo real do produto (m² dele) com a área genérica × média Vórtice/m²', () => {
  const start = materialsSource.indexOf('const doorCost');
  const end = materialsSource.indexOf("push('Geral', 'Janelas'", start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /q\.totals\.doorsProductCost \+ q\.totals\.doorsGenericAreaM2 \* materialPrice\('doorPerM2'\)/);
  assert.match(body, /q\.totals\.windowsProductCost \+ q\.totals\.windowsGenericAreaM2 \* materialPrice\('windowPerM2'\)/);
});

test('disclaimer do PDF avisa que o total é só material, sem mão de obra/projeto/taxas/instalações', () => {
  assert.match(materialsSource, /não inclui mão de obra/);
});
