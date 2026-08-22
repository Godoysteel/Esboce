import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../src/core/SupabaseClient.ts', import.meta.url), 'utf8');
const materials = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260822160000_unify_catalog_offers.sql', import.meta.url), 'utf8');

test('catálogo distingue produto, fornecedor e oferta sem remover compatibilidade legada', () => {
  assert.match(client, /export interface CatalogOffer/);
  assert.match(client, /listCatalogOffers/);
  assert.match(client, /legacy:/);
  assert.match(migration, /create table if not exists public\.suppliers/);
  assert.match(migration, /create table if not exists public\.product_offers/);
});

test('referência Vórtice é regional, datada e não se apresenta como venda', () => {
  assert.match(migration, /market_reference/);
  assert.match(migration, /region text not null/);
  assert.match(migration, /price_date date not null/);
  assert.match(migration, /is_official boolean not null/);
  assert.match(materials, /Estimativa Vórtice; não constitui oferta comercial/);
});
