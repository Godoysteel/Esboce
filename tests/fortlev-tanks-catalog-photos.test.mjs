import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

const manifestUrl = new URL('../public/catalogo/produtos/fortlev-tanks-images.json', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260823020000_import_fortlev_tanks_catalog_photos.sql', import.meta.url);

test('tanques Fortlev usam 13 SKUs exatos e imagens oficiais únicas', () => {
  const items = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  assert.equal(items.length, 13);
  assert.equal(new Set(items.map((item) => item.sku)).size, 13);
  const hashes = new Set();
  for (const item of items) {
    assert.equal(item.manufacturer, 'Fortlev');
    assert.equal(item.supplier, 'O Mercador');
    assert.equal(item.status, 'official_source_verified');
    assert.equal(item.catalogOnly, true);
    assert.match(item.officialPage, /^https:\/\/www\.fortlev\.com\.br\//);
    assert.match(item.imageSource, /^https:\/\/www\.fortlev\.com\.br\//);
    const imageUrl = new URL(`../..${item.image}`, manifestUrl);
    assert.ok(existsSync(imageUrl));
    hashes.add(createHash('sha256').update(readFileSync(imageUrl)).digest('hex'));
  }
  assert.equal(hashes.size, items.length);
});

test('migration dos tanques altera somente foto e fabricante', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /set foto_url = imported\.foto_url/);
  assert.match(sql, /manufacturer_id = manufacturer\.id/);
  assert.match(sql, /product\.foto_url is null/);
  assert.doesNotMatch(sql, /delete\s+from/i);
  assert.doesNotMatch(sql, /product_offers/i);
});
