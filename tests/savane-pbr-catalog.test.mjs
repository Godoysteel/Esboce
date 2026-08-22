import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/catalogo/revestimentos/manifest.json', import.meta.url), 'utf8'));

test('levantamento Savane fecha seis SKUs sem remover as três referências divergentes', () => {
  const savane = manifest.filter((item) => item.manufacturer === 'Savane');
  assert.equal(savane.length, 6);
  assert.deepEqual(savane.filter((item) => item.status === 'active').map((item) => item.sku).sort(), ['000253', '000333', '006558']);
  assert.deepEqual(savane.filter((item) => item.status === 'unverified').map((item) => item.sku).sort(), ['000243', '000265', '006617']);
  for (const item of savane.filter((candidate) => candidate.status === 'unverified')) {
    assert.equal(item.catalogPhoto, null);
    assert.equal(item.pbr, null);
    assert.match(item.verificationNote, /Mercador/);
  }
});

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

test('Travertino Suave 91x91 registra seis faces e fontes visuais distintas', () => {
  const item = manifest.find((candidate) => candidate.sku === '000253');
  assert.equal(item.manufacturerCode, '91110891');
  assert.equal(item.status, 'active');
  assert.equal(item.faces, 6);
  assert.equal(item.pieceWidthM, 0.91);
  assert.notEqual(item.catalogPhotoSource, item.materializeSourceOrigin);
  for (const path of [item.catalogPhoto, item.materializeSource, ...Object.values(item.pbr).filter((value) => typeof value === 'string')]) {
    assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `arquivo ausente: ${path}`);
  }

  Catalog.registerCommercialProducts([{ id: 'supabase-000253', sku: '000253', preco: 1, unidade: 'M2' }]);
  const product = Catalog.getProduct('supabase-000253');
  assert.ok(product);
  assert.equal(product.manufacturer, 'savane');
  assert.equal(product.assets.tileMeters, 0.91);
});

test('Amazon Brown 18x113 usa atlas desencontrado e escala da régua', () => {
  const item = manifest.find((candidate) => candidate.sku === '006558');
  assert.equal(item.manufacturerCode, '18111701');
  assert.equal(item.ean, '7908703300188');
  assert.equal(item.faces, 12);
  assert.equal(item.pieceWidthM, 1.13);
  assert.equal(item.pieceHeightM, 0.18);
  assert.match(item.pbr.layout, /desencontradas/);
  for (const path of [item.catalogPhoto, item.materializeSource, ...Object.values(item.pbr).filter((value) => typeof value === 'string' && !value.includes('fileiras'))]) {
    assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `arquivo ausente: ${path}`);
  }

  Catalog.registerCommercialProducts([{ id: 'supabase-006558', sku: '006558', preco: 1, unidade: 'M2' }]);
  const product = Catalog.getProduct('supabase-006558');
  assert.ok(product);
  assert.equal(product.assets.tileMeters, 1.13);
  assert.match(product.assets.textures.map, /savane-staggered-1/);
});
