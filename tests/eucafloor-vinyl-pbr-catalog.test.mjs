import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';

const eucafloorVerified = ['003870', '006441'];
const verified = [...eucafloorVerified, '000042'];
const unverified = ['004883', '002227', '002228', '003470', '002509', '002088', '002884', '001927', '003869', '002680'];
const manifest = JSON.parse(readFileSync(new URL('../public/catalogo/revestimentos/manifest.json', import.meta.url), 'utf8'));

test('levantamento vinílico fecha os 13 SKUs sem usar produto semelhante', () => {
  const vinylSkus = [...verified, ...unverified];
  const items = manifest.filter((item) => vinylSkus.includes(item.sku));
  assert.equal(items.length, vinylSkus.length);
  assert.deepEqual(items.filter((item) => item.status === 'official_source_verified').map((item) => item.sku).sort(), [...verified].sort());
  assert.deepEqual(items.filter((item) => item.status === 'unverified').map((item) => item.sku).sort(), [...unverified].sort());
});

test('primeiro lote vinílico Eucafloor registra somente modelos oficiais exatos', () => {
  const items = manifest.filter((item) => eucafloorVerified.includes(item.sku));
  assert.equal(items.length, eucafloorVerified.length);
  for (const item of items) {
    assert.equal(item.manufacturer, 'Eucafloor');
    assert.equal(item.status, 'official_source_verified');
    assert.match(item.productPage, /^https:\/\/www\.eucatex\.com\.br\/pisos\/produto\/pisos-vinilicos-lvt\//);
    for (const path of [item.catalogPhoto, item.materializeSource, ...Object.values(item.pbr).filter((value) => typeof value === 'string')]) {
      assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `arquivo ausente: ${path}`);
    }
  }
});

test('vinílicos Eucafloor são aplicáveis com fabricante e escala física corretos', () => {
  Catalog.registerCommercialProducts([...verified, ...unverified].map((sku) => ({ id: `vinyl-${sku}`, sku, preco: 100, unidade: 'M2' })));
  assert.equal(Catalog.getProduct('vinyl-003870').assets.tileMeters, 1.219);
  assert.equal(Catalog.getProduct('vinyl-006441').assets.tileMeters, 0.9144);
  for (const sku of eucafloorVerified) {
    const product = Catalog.getProduct(`vinyl-${sku}`);
    assert.equal(product.manufacturer, 'eucafloor');
    assert.match(product.assets.textures.map, /albedo\.jpg\?v=vinyl-1$/);
    assert.match(Catalog.getCommercialCatalogPhoto(sku), new RegExp(`${sku}/produto-original\\.jpg$`));
  }
  for (const sku of unverified) {
    assert.equal(Catalog.getProduct(`vinyl-${sku}`), null, `SKU unverified ${sku} não deve ser aplicável`);
  }
});

test('gerador diferencia régua desencontrada de placa quadrada', () => {
  const source = readFileSync(new URL('../scripts/texturas/generate_eucafloor_vinyl_pbr.py', import.meta.url), 'utf8');
  assert.match(source, /"003870": \{"piece_width_m": 1\.219, "piece_height_m": 0\.238, "plank": True/);
  assert.match(source, /"006441": \{"piece_width_m": 0\.9144, "piece_height_m": 0\.9144, "plank": False/);
  assert.match(source, /STAGGER_OFFSETS = \(0\.00, 0\.37, 0\.74, 0\.18, 0\.55, 0\.92\)/);
});
