import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// MaterialsPanel.ts não é importável direto pelo test runner nativo do
// Node (mesma limitação documentada nos demais testes deste módulo:
// redirecionamento '.js' -> '.ts' que só o Vite resolve) — testado por
// busca de texto, igual construction-system.test.mjs e
// materials-real-price.test.mjs.
const materialsSource = await readFile(
  new URL('../src/core/MaterialsPanel.ts', import.meta.url),
  'utf8',
);
const indexHtmlSource = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

test('botão "Exportar PDF" existe na barra do painel, ao lado dos outros dois já existentes (planilha e CSV)', () => {
  assert.match(indexHtmlSource, /id="materialsPdfBtn"/);
});

test('exportPdf() usa a MESMA fonte de dados da tela/CSV/planilha (buildRows) — nunca uma leitura própria', () => {
  const start = materialsSource.indexOf('function exportPdf(): void {');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const rows = buildRows\(\);/);
});

// ADR-006 §13-15 exige o aviso de responsabilidade técnica em PDF
// explicitamente (não só nos Termos de Uso) — não é opcional.
test('PDF traz o aviso de responsabilidade técnica (ADR-006 §13-15) — obrigatório, não escondido', () => {
  assert.match(materialsSource, /const PDF_DISCLAIMER = /);
  assert.match(materialsSource, /não substitui arquiteto ou engenheiro/);
  const start = materialsSource.indexOf('function exportPdf(): void {');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /PDF_DISCLAIMER/);
});

test('rodapé exato pedido pelo Product Owner: "Orçamento gerado por esboce.com.br"', () => {
  assert.match(materialsSource, /Orçamento gerado por esboce\.com\.br/);
});

// "Lista simples, não confusa" — pedido explícito: agrupa por
// categoria com um título por seção, em vez de repetir o nome da
// categoria em toda linha (como a tabela do painel/planilha faz).
test('pdfSections agrupa por categoria com um título por seção, sem repetir a categoria em cada linha', () => {
  const start = materialsSource.indexOf('function pdfSections(');
  const end = materialsSource.indexOf('\nfunction escapeCell', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /if \(r\[0\] !== currentCat\) \{/);
  assert.match(body, /<h2>/);
  // A linha "TOTAL" do buildRows() não vira mais uma seção — vira o
  // bloco de destaque separado no fim do documento.
  assert.match(body, /if \(r\[0\] === 'TOTAL'\) return;/);
});

test('total estimado aparece destacado, separado das seções, só quando existe (hasCost)', () => {
  const start = materialsSource.indexOf('function exportPdf(): void {');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const totalRow = rows\.length && rows\[rows\.length - 1\]!\[0\] === 'TOTAL' \? rows\[rows\.length - 1\]! : null;/);
  assert.match(body, /\(totalRow \? '<div class="pdf-total">/);
});

test('rodapé se repete em toda página impressa (position: fixed no CSS de impressão), não só na primeira', () => {
  const start = materialsSource.indexOf("'.pdf-footer{");
  assert.notEqual(start, -1);
  const line = materialsSource.slice(start, materialsSource.indexOf(';', start + 20));
  assert.match(materialsSource.slice(start, start + 60), /position:fixed/);
});

test('não adiciona biblioteca de geração de PDF nova — usa window.print() nativo do navegador', () => {
  const start = materialsSource.indexOf('function exportPdf(): void {');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /window\.open\(/);
  assert.match(body, /win\.print\(\)/);
});

test('init() conecta o botão novo à exportPdf, sem mexer nos outros dois (planilha e CSV) já existentes', () => {
  const start = materialsSource.indexOf('export function init(): void {');
  const end = materialsSource.indexOf('\n  render();', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const pdfBtn = document\.getElementById\('materialsPdfBtn'\);/);
  assert.match(body, /if \(pdfBtn\) pdfBtn\.addEventListener\('click', exportPdf\);/);
  assert.match(body, /if \(exportBtn\) exportBtn\.addEventListener\('click', exportCsv\);/);
  assert.match(body, /if \(sheetBtn\) sheetBtn\.addEventListener\('click', function \(\) \{ MaterialsSheet\.open\(\); \}\);/);
});
