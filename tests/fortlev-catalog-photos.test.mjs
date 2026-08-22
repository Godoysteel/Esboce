import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const manifestUrl = new URL('../public/catalogo/produtos/fortlev-official-images.json', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260823013000_import_fortlev_ondalev_catalog_photo.sql', import.meta.url);

test('Telha Ondalev usa SKU, medida e foto oficial exatos', () => {
  const [item] = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  assert.equal(item.sku, '000092');
  assert.equal(item.manufacturer, 'Fortlev');
  assert.equal(item.supplier, 'O Mercador');
  assert.equal(item.model, 'Telha de PVC Leitosa Ondalev');
  assert.deepEqual(item.dimensions, { lengthM: 2.44, widthM: 0.5, waveHeightMm: 21, thicknessMm: 0.7 });
  assert.equal(item.status, 'official_source_verified');
  assert.equal(item.catalogOnly, true);
  assert.match(item.officialPage, /^https:\/\/www\.fortlev\.com\.br\//);
  assert.match(item.imageSource, /^https:\/\/www\.fortlev\.com\.br\//);
  assert.ok(existsSync(new URL(`../..${item.image}`, manifestUrl)));
});

test('migration Ondalev altera apenas foto e fabricante do SKU 000092', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /product\.sku = '000092'/);
  assert.match(sql, /set foto_url =/);
  assert.match(sql, /manufacturer_id = manufacturer\.id/);
  assert.match(sql, /product\.foto_url is null/);
  assert.doesNotMatch(sql, /delete\s+from/i);
  assert.doesNotMatch(sql, /product_offers/i);
});
