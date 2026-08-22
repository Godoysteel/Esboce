import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../src/core/SupabaseClient.ts', import.meta.url), 'utf8');
const materials = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260822160000_unify_catalog_offers.sql', import.meta.url), 'utf8');
const ceralMigration = readFileSync(new URL('../supabase/migrations/20260822230000_fix_ceral_manufacturer.sql', import.meta.url), 'utf8');

test('catálogo distingue produto, fornecedor e oferta sem remover compatibilidade legada', () => {
  assert.match(client, /export interface CatalogOffer/);
  assert.match(client, /listCatalogOffers/);
  assert.match(client, /legacy:/);
  assert.match(migration, /create table if not exists public\.suppliers/);
  assert.match(migration, /create table if not exists public\.product_offers/);
});

test('Ceral é fabricante dos SKUs exatos e O Mercador permanece fornecedor', () => {
  assert.match(ceralMigration, /'Ceral'/);
  assert.match(ceralMigration, /p\.manufacturer_id = mercador\.id/);
  for (const sku of ['003230', '003231', '003229', '000317', '000291', '000300', '000290', '003135', '000852']) {
    assert.match(ceralMigration, new RegExp(`'${sku}'`));
  }
  assert.doesNotMatch(ceralMigration, /update public\.product_offers/);
  assert.match(client, /suppliedByMercador \? 'O Mercador'/);
});

test('referência Vórtice é regional, datada e não se apresenta como venda', () => {
  assert.match(migration, /market_reference/);
  assert.match(migration, /region text not null/);
  assert.match(migration, /price_date date not null/);
  assert.match(migration, /is_official boolean not null/);
  assert.match(materials, /Estimativa Vórtice; não constitui oferta comercial/);
});
