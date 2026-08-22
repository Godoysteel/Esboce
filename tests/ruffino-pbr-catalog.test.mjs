import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../public/catalogo/revestimentos/manifest.json', import.meta.url), 'utf8'));
const catalog = readFileSync(new URL('../src/core/Catalog.ts', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/texturas/generate_ruffino_pbr.py', import.meta.url), 'utf8');

test('Ruffino Acácia R31031 usa somente fontes oficiais exatas', () => {
  const product = manifest.find((item) => item.sku === '000042');
  assert.equal(product.manufacturer, 'Ruffino');
  assert.equal(product.manufacturerCode, 'R31031');
  assert.equal(product.status, 'official_source_verified');
  assert.equal(product.pieceWidthM, 1.2192);
  assert.equal(product.pieceHeightM, 0.1778);
  assert.match(product.productPage, /ruffinoacabamentos\.com\/sofisticato/);
  assert.match(product.catalogPhotoSource, /R31031/);
  assert.match(product.materializeSourceOrigin, /R31031/);
});

test('Ruffino R31031 possui foto comercial e quatro mapas PBR', () => {
  for (const file of [
    'produto-original.jpg', 'amostra-frontal-original.jpg',
    'pbr/albedo.jpg', 'pbr/normal.jpg', 'pbr/roughness.jpg', 'pbr/ao.jpg',
  ]) assert.ok(existsSync(new URL(`../public/catalogo/revestimentos/000042/${file}`, import.meta.url)), file);
  assert.match(catalog, /'000042'.*manufacturer: 'ruffino'.*tileMeters: 1\.2192/);
  assert.match(generator, /atlas frontal com réguas e emendas desencontradas/);
});
