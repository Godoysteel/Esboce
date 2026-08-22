import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';

const verified = ['003712', '000359', '003193', '003423', '003898', '005813', '006316', '001142'];
const unverified = ['003064', '002890', '001803', '001601', '006114', '004015', '001949'];
const manifest = JSON.parse(readFileSync(new URL('../public/catalogo/revestimentos/manifest.json', import.meta.url), 'utf8'));

test('levantamento Eucafloor fecha os 15 SKUs sem aproximar linhas ou dimensões', () => {
  const laminateSkus = [...verified, ...unverified];
  const items = manifest.filter((item) => laminateSkus.includes(item.sku));
  assert.equal(items.length, verified.length + unverified.length);
  assert.deepEqual(items.filter((item) => item.status === 'official_source_verified').map((item) => item.sku).sort(), [...verified].sort());
  assert.deepEqual(items.filter((item) => item.status === 'unverified').map((item) => item.sku).sort(), [...unverified].sort());
});

test('primeiro lote Eucafloor registra oito SKUs com fonte oficial exata', () => {
  const items = manifest.filter((item) => verified.includes(item.sku));
  assert.equal(items.length, verified.length);
  for (const item of items) {
    assert.equal(item.manufacturer, 'Eucafloor');
    assert.equal(item.status, 'official_source_verified');
    assert.match(item.productPage, /^https:\/\/www\.eucatex\.com\.br\/pisos\/produto\//);
    assert.ok(item.pieceWidthM > item.pieceHeightM);
    for (const path of [item.catalogPhoto, item.materializeSource, ...Object.values(item.pbr).filter((value) => typeof value === 'string')]) {
      assert.ok(existsSync(new URL(`../public/${path}`, import.meta.url)), `arquivo ausente: ${path}`);
    }
  }
});

test('SKUs Eucafloor são aplicáveis e preservam fabricante separado do fornecedor', () => {
  Catalog.registerCommercialProducts([...verified, ...unverified].map((sku) => ({ id: `euca-${sku}`, sku, preco: 88.85, unidade: 'M2' })));
  for (const sku of verified) {
    const product = Catalog.getProduct(`euca-${sku}`);
    assert.ok(product);
    assert.equal(product.manufacturer, 'eucafloor');
    assert.equal(product.commercial.sku, sku);
    assert.match(product.assets.textures.map, /albedo\.jpg\?v=staggered-2$/);
    assert.match(Catalog.getCommercialCatalogPhoto(sku), new RegExp(`${sku}/produto-original\\.jpg$`));
  }
  for (const sku of unverified) {
    assert.equal(Catalog.getProduct(`euca-${sku}`), null, `SKU unverified ${sku} não deve ser aplicável`);
  }
});

test('Smart Oak duplicado no Mercador referencia conscientemente o mesmo modelo oficial', () => {
  const items = manifest.filter((item) => ['000359', '003193'].includes(item.sku));
  assert.equal(items[0].manufacturerCode, items[1].manufacturerCode);
  assert.equal(items[0].materializeSourceOrigin, items[1].materializeSourceOrigin);
  assert.match(items.find((item) => item.sku === '003193').verificationNote, /Mesmo modelo oficial/);
});

test('gerador Eucafloor mantém escala real por linha e todos os mapas PBR', () => {
  const source = readFileSync(new URL('../scripts/texturas/generate_eucafloor_pbr.py', import.meta.url), 'utf8');
  assert.match(source, /"003712": \{"plank_width_m": 0\.357/);
  assert.match(source, /"000359": \{"plank_width_m": 0\.292/);
  assert.match(source, /"003423": \{"plank_width_m": 0\.217/);
  assert.match(source, /source\.crop\(\(inset_x, inset_y, source\.width - inset_x, source\.height - inset_y\)\)/);
  assert.match(source, /y1 = round\(\(row \+ 1\) \* SIZE \/ rows\)/);
  assert.match(source, /plank = ImageOps\.mirror\(plank\)/);
  assert.match(source, /plank = ImageOps\.flip\(plank\)/);
  assert.match(source, /STAGGER_OFFSETS = \(0\.00, 0\.37, 0\.74, 0\.18, 0\.55, 0\.92\)/);
  assert.match(source, /plank = ImageChops\.offset\(plank, round\(STAGGER_OFFSETS\[row % len\(STAGGER_OFFSETS\)\] \* SIZE\), 0\)/);
  assert.doesNotMatch(source, /joint =|canvas = Image\.new\("RGB", \(SIZE, SIZE\), \(75, 66, 56\)\)/);
});

test('renderização varia a posição da textura por superfície sem mudar sua escala física', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(source, /function textureOffsetForSurface\(surfaceKey: string\)/);
  assert.match(source, /c\.offset\.set\(textureOffset\.x, textureOffset\.y\)/);
  assert.match(source, /buildFloorTileMaterial\(effectiveFinish, roomFinishSettings\.scale, roomFinishSettings\.rotation, roomKey\)/);
});
