import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';
import { BOLD_ACM_PRODUCTS } from '../src/core/BoldCatalog.ts';

const catalog = readFileSync(new URL('../src/core/BoldCatalog.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
Catalog.registerBoldCatalogProducts(BOLD_ACM_PRODUCTS);

test('catálogo Bold usa uma página própria e dados públicos rastreáveis', () => {
  assert.match(catalog, /BOLD_CATEGORY_URL/);
  assert.match(catalog, /BOLD_ACM_MANUAL_URL/);
  assert.match(catalog, /BOLD_PRICE_REFERENCE_DATE = "01\/09\/2026"/);
  assert.match(catalog, /não representa estoque, proposta comercial nem integração oficial/i);
  assert.equal((catalog.match(/id: "bold-acm-/g) ?? []).length, 10);
  assert.match(app, /BOLD_CATALOG_TAB/);
  assert.match(app, /Bold · ACM/);
  assert.match(app, /renderBoldCatalog\(bodyEl\)/);
});

test('página Bold diferencia referência pública de oferta comercial', () => {
  assert.match(app, /Referência pública consultada/);
  assert.match(app, /não representa parceria oficial nem proposta comercial/);
  assert.match(app, /Preço e disponibilidade devem ser confirmados no site da Bold/);
  assert.match(app, /Manual de instalação/);
  assert.match(html, /\.bold-catalog-hero/);
  assert.match(html, /\.bold-product-swatch/);
});

test('todos os acabamentos Bold possuem conjunto PBR e são aplicáveis em fachada', () => {
  const ids = [...catalog.matchAll(/id: "(bold-acm-[^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 10);
  for (const id of ids) {
    const product = Catalog.getProduct(id);
    assert.ok(product, `produto local ausente: ${id}`);
    assert.equal(product.assets.applicationSurface, 'external');
    assert.ok(product.assets.pbrMaterial);
    assert.ok(product.assets.pecaCoverageM2 > 6);
    for (const map of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
      const url = product.assets.textures[map];
      assert.ok(url, `${id} sem ${map}`);
      const relative = url.replace(/^\//, '');
      assert.ok(existsSync(new URL(`../public/${relative}`, import.meta.url)), `arquivo ausente: ${relative}`);
    }
  }
  assert.match(app, /Aplicar na fachada/);
  assert.match(app, /ViewportController\.activateCatalogProduct\(product\.id, selection\)/);
});
