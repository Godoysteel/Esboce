import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const manifestUrl = new URL('../public/catalogo/produtos/brasilit-images.json', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260823010000_import_brasilit_catalog_photos.sql', import.meta.url);

test('lote Brasilit usa cinco SKUs exatos e fotos rastreadas', () => {
  const items = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  assert.equal(items.length, 5);
  assert.equal(new Set(items.map((item) => item.sku)).size, 5);

  for (const item of items) {
    assert.equal(item.manufacturer, 'Brasilit');
    assert.equal(item.supplier, 'O Mercador');
    assert.equal(item.status, 'official_source_verified');
    assert.equal(item.catalogOnly, true);
    assert.match(item.officialPage, /^https:\/\/(cloud\.mkt\.)?brasilit\.com\.br\//);
    assert.ok(item.imagePage);
    assert.ok(item.imageSource);
    assert.ok(existsSync(new URL(`../..${item.image}`, manifestUrl)));
  }
});

test('migration Brasilit altera somente foto e fabricante', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /set foto_url = imported\.foto_url/);
  assert.match(sql, /manufacturer_id = manufacturer\.id/);
  assert.match(sql, /product\.foto_url is null/);
  assert.doesNotMatch(sql, /delete\s+from/i);
  assert.doesNotMatch(sql, /product_offers/i);
});
