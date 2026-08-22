import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('catálogo único carrega ofertas separadas e mostra fornecedor sem confundir com fabricante', () => {
  assert.match(app, /listCatalogOffers\(products\)/);
  assert.match(app, /offersForProduct\(product\.id\)/);
  assert.match(app, /Fabricante:/);
  assert.match(app, /bestOffer\.supplier_name/);
  assert.match(app, /Estimativa Vórtice/);
  assert.match(app, /não constitui oferta comercial/);
  assert.match(app, /catalogManufacturerLabel\(product\)/);
  assert.match(app, /toLocaleLowerCase\("pt-BR"\) !== "o mercador"/);
  assert.doesNotMatch(app, /Fabricante: \$\{manufacturer\?\.nome/);
});

test('ficha oferece uma ação coerente com a categoria do produto', () => {
  assert.match(app, /Adicionar ao projeto/);
  assert.match(app, /Aplicar na superfície/);
  assert.match(app, /Usar na construção/);
  assert.match(app, /ViewportController\.activateCatalogProduct\(product\.id, selection\)/);
  assert.match(viewport, /export function activateCatalogProduct/);
  assert.match(viewport, /currentPaintSurface = 'floors'/);
  assert.match(viewport, /pendingOpeningProductId = productId/);
  assert.match(html, /catalog-offer\.market_reference/);
});

test('oferta escolhida vira snapshot comercial persistido por alvo', () => {
  assert.match(app, /input\[name="catalogOffer"\]:checked/);
  assert.match(app, /selectedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(viewport, /setCommercialSelection\(Store\.currentFloor\(\)\.id \+ ':wall:'/);
  assert.match(viewport, /setCommercialSelection\(Store\.currentFloor\(\)\.id \+ ':room:'/);
  assert.match(viewport, /setCommercialSelection\(Store\.currentFloor\(\)\.id \+ ':roof:'/);
  assert.match(viewport, /setCommercialSelection\(Store\.currentFloor\(\)\.id \+ ':opening:'/);
  assert.match(viewport, /setCommercialSelection\(Store\.currentFloor\(\)\.id \+ ':furniture:'/);
});
