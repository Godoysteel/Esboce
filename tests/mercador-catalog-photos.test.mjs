import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const manifestUrl = new URL('../public/catalogo/produtos/mercador-images.json', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260823003000_import_mercador_catalog_photos.sql', import.meta.url);

test('fotos importadas do Mercador possuem SKU, fabricante, arquivo e rastreabilidade', () => {
  assert.ok(existsSync(manifestUrl));
  const items = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  assert.equal(items.length, 607);
  assert.equal(new Set(items.map((item) => item.sku)).size, items.length);
  for (const item of items) {
    assert.match(item.sku, /^\d{6}$/);
    assert.ok(item.manufacturerName);
    assert.match(item.imageFile, /^\/produtos\//);
    assert.ok(existsSync(new URL(`../public${item.imageFile}`, import.meta.url)), `imagem ausente: ${item.imageFile}`);
  }
});

test('migration altera somente foto e fabricante, preservando ofertas e aplicação visual', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /set foto_url = imported\.foto_url/);
  assert.match(sql, /manufacturer_id = manufacturer\.id/);
  assert.match(sql, /and product\.foto_url is null/);
  assert.doesNotMatch(sql, /product_offers|delete from|update public\.product_offers/);
});
