import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';

const verified = ['003230', '003231', '003229', '000317', '000291', '000300'];
const unverified = ['000290', '003135', '000852'];

test('catálogo visual registra somente os seis SKUs Ceral verificados pelos UUIDs dinâmicos do Supabase', () => {
  const rows = [...verified, ...unverified].map((sku) => ({
    id: `supabase-${sku}`, sku, preco: 23.82, unidade: 'M2',
  }));
  Catalog.registerCommercialProducts(rows);

  for (const sku of verified) {
    const product = Catalog.getProduct(`supabase-${sku}`);
    assert.ok(product, `SKU ${sku} não foi registrado`);
    assert.equal(product.category, 'floor_tile');
    assert.equal(product.commercial.sku, sku);
    assert.ok(product.assets.tileMeters > 0);
    for (const path of Object.values(product.assets.textures)) {
      assert.match(path, new RegExp(`catalogo/revestimentos/${sku}/pbr/`));
      assert.ok(existsSync(new URL(`../public/${path.replace(/^\//, '')}`, import.meta.url)), `mapa ausente: ${path}`);
    }
    assert.match(Catalog.getCommercialCatalogPhoto(sku), new RegExp(`catalogo/revestimentos/${sku}/produto-original\\.jpeg$`));
  }

  for (const sku of unverified) {
    assert.equal(Catalog.getProduct(`supabase-${sku}`), null, `SKU unverified ${sku} não deve ser aplicável`);
    assert.equal(Catalog.getCommercialCatalogPhoto(sku), null);
  }
});

test('SKU retangular 000317 usa atlas de 203 mm com duas peças 203 x 102 mm', () => {
  const source = readFileSync(new URL('../scripts/texturas/generate_ceral_pbr.py', import.meta.url), 'utf8');
  assert.match(source, /"000317": \{"width_m": 0\.203, "height_m": 0\.102, "roughness": 0\.2, "rows": 2\}/);
  const product = Catalog.getProduct('supabase-000317');
  assert.equal(product.assets.tileMeters, 0.203);
});

test('carregamento do catálogo associa por SKU e substitui a foto pela ambientada oficial', () => {
  const source = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
  assert.match(source, /Catalog\.registerCommercialProducts\(products\)/);
  assert.match(source, /const officialPhoto = Catalog\.getCommercialCatalogPhoto\(product\.sku\)/);
  assert.match(source, /if \(officialPhoto\) product\.foto_url = officialPhoto/);
});
