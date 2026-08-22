import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../public/catalogo/revestimentos/manifest.json', import.meta.url), 'utf8'));
const catalog = readFileSync(new URL('../src/core/Catalog.ts', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/texturas/generate_forthart_pbr.py', import.meta.url), 'utf8');

test('ForthArt Pátina Polar coincide com o SKU comercial exato', () => {
  const product = manifest.find((item) => item.sku === '002884');
  assert.equal(product.manufacturer, 'ForthArt');
  assert.equal(product.model, 'Wood Homeflex Pátina Polar');
  assert.equal(product.status, 'official_source_verified');
  assert.equal(product.pieceWidthM, 1.2192);
  assert.equal(product.pieceHeightM, 0.2286);
  assert.equal(product.faces, null);
  assert.match(product.productPage, /obradec\.com\/revestimentos\/produto\/89\/6\/ForthArt-PVC\/Wood-Homeflex/);
});

test('ForthArt separa prancha comercial, amostra limpa e mapas PBR', () => {
  for (const file of [
    'produto-original.png', 'amostra-frontal-original.jpg',
    'pbr/albedo.jpg', 'pbr/normal.jpg', 'pbr/roughness.jpg', 'pbr/ao.jpg',
  ]) assert.ok(existsSync(new URL(`../public/catalogo/revestimentos/002884/${file}`, import.meta.url)), file);
  assert.match(catalog, /'002884'.*manufacturer: 'forthart'.*tileMeters: 1\.2192/);
  assert.match(generator, /source\.crop\(\(0, 0, source\.height, source\.height\)\)/);
});
