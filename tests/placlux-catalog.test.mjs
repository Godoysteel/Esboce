import assert from 'node:assert/strict';
import test from 'node:test';

import { PLACLUX_PRODUCTS, getPlacluxProduct } from '../src/core/PlacluxCatalog.ts';
import { STEEL_FRAME_FACE_ASSEMBLIES } from '../src/core/SteelFrameAssemblies.ts';

test('catálogo PlacLux cobre todas as famílias publicadas e as quatro espessuras ProFort Next', () => {
  const ids = new Set(PLACLUX_PRODUCTS.map((product) => product.id));
  assert.equal(ids.size, PLACLUX_PRODUCTS.length);
  for (const thickness of ['6mm', '8mm', '10mm', '12-5mm']) {
    assert.ok(ids.has(`placlux.profort-next-${thickness}`));
  }
  for (const id of [
    'placlux.base-coat-20kg', 'placlux.fita-fiberglass-10cm-50m',
    'placlux.membrana-hidrofuga-52-5m2', 'placlux.tela-fiberglass-1x50m',
    'placlux.pingadeira-pvc-2-5m', 'placlux.parafuso-pa-032',
    'placlux.parafuso-pb-032', 'placlux.cantoneira-pvc-2-5m',
    'placlux.chapa-drywall', 'placlux.la-de-rocha', 'placlux.massa-drywall',
    'placlux.protherm-18kg', 'placlux.total-wall', 'placlux.manta-acrilica',
    'placlux.primer-protect-wall-18kg', 'placlux.adesivo-chapisco',
    'placlux.perfis-drywall', 'placlux.perfis-steel-frame',
    'placlux.forro-mineral-knauf-ceiling',
  ]) assert.ok(ids.has(id), `produto ausente: ${id}`);
});

test('produtos sem ficha individual permanecem sem dimensões inventadas', () => {
  assert.equal(getPlacluxProduct('placlux.la-de-rocha').dimensions, undefined);
  assert.equal(getPlacluxProduct('placlux.total-wall').coverageM2, undefined);
});

test('composição cimentícia usa PB direto no perfil e PA sobre OSB', () => {
  const direct = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-direct');
  const withOsb = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-osb');
  assert.ok(direct.layers.some((layer) => layer.id === 'placlux.parafuso-pb-032'));
  assert.ok(withOsb.layers.some((layer) => layer.id === 'placlux.parafuso-pa-032'));
});
