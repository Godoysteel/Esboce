import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260823000000_fix_revestimento_manufacturers.sql', import.meta.url),
  'utf8',
);

test('migration separa fabricantes verificados do fornecedor O Mercador', () => {
  assert.match(migration, /\('Eucafloor'\), \('Savane'\)/);
  assert.match(migration, /p\.manufacturer_id = mercador\.id/g);
  assert.match(migration, /set manufacturer_id = manufacturer\.id/g);
  assert.doesNotMatch(migration, /product_offers/);
});

test('migration cobre os SKUs levantados de Eucafloor e Savane', () => {
  const expectedSkus = [
    '003712', '000359', '003193', '003423', '003898', '005813', '006316',
    '001142', '003064', '002890', '001803', '001601', '006114', '004015',
    '001949', '003870', '006441', '001927', '003869',
    '000333', '000253', '006558', '000265', '000243', '006617',
  ];
  for (const sku of expectedSkus) assert.match(migration, new RegExp(`'${sku}'`));
});
