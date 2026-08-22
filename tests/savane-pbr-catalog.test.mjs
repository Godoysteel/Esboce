import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/catalogo/revestimentos/manifest.json', import.meta.url), 'utf8'));

test('Urban Branco 91x91 registra identidade, fontes e escala física', () => {
  const item = manifest.find((candidate) => candidate.sku === '000333');
  assert.equal(item.manufacturer, 'Savane');
  assert.equal(item.model, 'Urban Branco Acetinado 91x91');
  assert.equal(item.status, 'active');
  assert.equal(item.pieceWidthM, 0.91);
  assert.equal(item.pieceHeightM, 0.91);
  assert.equal(item.faces, 4);
  assert.match(item.manufacturerTechnicalDocument, /\.pdf$/);
  assert.notEqual(item.catalogPhotoSource, item.materializeSourceOrigin);
  for (const path of [item.catalogPhoto, item.materializeSource, ...Object.values(item.pbr).filter((value) => typeof value === 'string')]) {
    assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `arquivo ausente: ${path}`);
  }
});

test('Urban Branco 91x91 fica aplicável pelo SKU comercial', () => {
  Catalog.registerCommercialProducts([{ id: 'supabase-000333', sku: '000333', preco: 1, unidade: 'M2' }]);
  const product = Catalog.getProduct('supabase-000333');
  assert.ok(product);
  assert.equal(product.manufacturer, 'savane');
  assert.equal(product.assets.tileMeters, 0.91);
  assert.match(product.assets.thumbnailUrl, /000333\/produto-original\.jpg$/);
  assert.match(product.assets.textures.map, /000333\/pbr\/albedo\.jpg\?v=savane-1$/);
});
