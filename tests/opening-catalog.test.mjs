import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Catalog } from '../src/core/Catalog.ts';

// Store.ts importa outros módulos do projeto com extensão '.js' (convenção
// resolvida pelo Vite em tempo de build/dev, apontando pro '.ts' irmão) —
// o test runner nativo do Node (--experimental-strip-types) NÃO faz esse
// redirecionamento, então importar Store.ts direto aqui quebra com
// ERR_MODULE_NOT_FOUND ('Core.js' não existe, só 'Core.ts'). Mesma
// limitação já documentada em hydraulics.test.mjs — por isso nenhum teste
// deste projeto importa Store.ts como módulo; os que precisam checar
// comportamento específico dele leem o arquivo como texto.
function storeSource() {
  return readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
}

test('insertOpening aceita productOverride e usa o tamanho/productId do produto escolhido', () => {
  const source = storeSource();
  assert.match(source, /insertOpening\(wallId: string, kind: OpeningKind, px: number, py: number, productOverride\?/);
  assert.match(source, /productOverride \? productOverride\.widthM/);
  assert.match(source, /op\.height = productOverride\.heightM; op\.productId = productOverride\.productId/);
});

test('todo produto door/window do catálogo tem frameMaterial e dimensões nominais', () => {
  const doorsAndWindows = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')];
  assert.ok(doorsAndWindows.length >= 17);
  doorsAndWindows.forEach((p) => {
    assert.ok(p.frameMaterial, `${p.id} sem frameMaterial`);
    assert.ok(p.assets.nominalWidthM && p.assets.nominalWidthM > 0, `${p.id} sem nominalWidthM válido`);
    assert.ok(p.assets.nominalHeightM && p.assets.nominalHeightM > 0, `${p.id} sem nominalHeightM válido`);
    assert.ok(p.assets.modelUrl, `${p.id} sem modelUrl`);
  });
});

test('filtro por frameMaterial "vidro" traz as 17 esquadrias enviadas; "madeira" vem vazio (ainda sem modelo)', () => {
  const vidro = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')]
    .filter((p) => p.frameMaterial === 'vidro');
  assert.equal(vidro.length, 17);
  const madeira = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')]
    .filter((p) => p.frameMaterial === 'madeira');
  assert.equal(madeira.length, 0);
});

test('seletor de esquadria (ViewportController) guarda o produto escolhido antes de posicionar, com aba "Padrão"', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(source, /var pendingOpeningProductId: string \| null = null/);
  assert.match(source, /function refreshOpeningPickerPanel/);
  assert.match(source, /Padrão \(editável depois\)/);
});

test('todas as 17 esquadrias já têm thumbnail — última imagem (Basculante) chegou nesta sessão', () => {
  const doorsAndWindows = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')];
  assert.equal(doorsAndWindows.length, 17);
  doorsAndWindows.forEach((p) => {
    assert.ok(p.assets.thumbnailUrl, `${p.id} ainda sem thumbnailUrl`);
  });
  // A Basculante teve o nome corrigido (o arquivo original chamava
  // "Máximo-Ar", nome errado — avisado pelo Product Owner). id/modelUrl
  // mantidos como estavam, só o nome de exibição mudou.
  const basculante = Catalog.getProduct('vortice.janela.maximo-ar-700x500');
  assert.ok(basculante);
  assert.equal(basculante.name, 'Basculante 700x500');
  assert.equal(basculante.assets.thumbnailUrl, 'images/esquadrias/janela-basculante-700x500.png');
});

test('vidro dos modelos de esquadria usa o mesmo material de vidro do envidraçamento, mas com transparência real (não o padrão 100% opaco da fachada)', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(source, /glass\|vidro/i);
  assert.match(source, /buildGlazingGlassMaterial\(\{ \.\.\.DEFAULT_GLAZING_GLASS_MATERIAL, opacity: 0\.35 \}\)/);
});

test('modelo de esquadria ganha 4 tiras de requadro fechando a folga entre o caixilho e a espessura da parede', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(source, /function addRevealStrip/);
  assert.match(source, /addRevealStrip\(op\.width \+ revealTrim, revealTrim, 0, op\.height\)/); // topo
  assert.match(source, /addRevealStrip\(op\.width \+ revealTrim, revealTrim, 0, 0\)/); // base
  assert.match(source, /addRevealStrip\(revealTrim, op\.height, -op\.width \/ 2, op\.height \/ 2\)/); // esquerda
  assert.match(source, /addRevealStrip\(revealTrim, op\.height, op\.width \/ 2, op\.height \/ 2\)/); // direita
  // A tira atravessa a espessura TODA da parede — funciona pra qualquer
  // profundidade de caixilho, sem precisar conhecer a do modelo específico.
  assert.match(source, /new THREE\.BoxGeometry\(sizeX, sizeY, Core\.WALL_THICK\)/);
});

// DEC-97 — piso com textura PBR de verdade (Product Owner trouxe uma
// textura de piso laminado real, pediu pra "ter essa textura para
// piso"). Produto de teste segue a MESMA convenção já usada pra
// telhado/tabeira (teste.telha.ceramica-pbr, teste.tabeira.madeira-pbr):
// mapas reais (cor+normal+rugosidade), sku/preço placeholder, tileMeters
// como estimativa visual.
test('Catalog: produto de piso laminado (teste PBR) existe com os mapas certos, sem aoMap (fonte não trouxe)', () => {
  const product = Catalog.getProduct('teste.piso.laminado-pbr');
  assert.ok(product, 'produto teste.piso.laminado-pbr não encontrado no Catálogo');
  assert.equal(product.category, 'floor_tile');
  assert.ok(product.assets.textures, 'produto sem assets.textures');
  assert.match(product.assets.textures.map, /^data:image\/jpeg;base64,/);
  assert.match(product.assets.textures.normalMap, /^data:image\/jpeg;base64,/);
  assert.match(product.assets.textures.roughnessMap, /^data:image\/jpeg;base64,/);
  assert.equal(product.assets.textures.aoMap, undefined);
  assert.ok(product.assets.tileMeters > 0);
});

test('Scene3DRenderer: piso usa a textura PBR de verdade (buildFloorTileMaterial, UV em metros reais) quando o produto tem assets.textures — cai no padrão procedural de cerâmica só quando não tem', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(source, /function buildFloorTileMaterial\(product: any, scale: number, rotationDeg: number\) \{/);
  // Cache por produto (evita recarregar a imagem a cada rebuild da cena,
  // igual buildRoofTileMaterial já faz), clone por cômodo (cada um pode
  // ter escala/rotação própria em cima do mesmo produto).
  assert.match(source, /var floorTextureCache: Record<string, any> = \{\};/);
  assert.match(source, /var c = t\.clone\(\);/);
  // UV recalculado em metros reais (posição do vértice \/ tileMeters),
  // não o UV normalizado 0-1 padrão do ExtrudeGeometry — só quando um
  // material de verdade (materialOverride) é passado pra makeSlabMesh.
  assert.match(source, /uvArr\[i \* 2\] = posAttr\.getX\(i\) \/ uvTileMeters;/);
  // Ramo de decisão no render do piso: produto com textura real usa
  // buildFloorTileMaterial; sem isso, cai no buildCeramicTexture de
  // sempre (cor sólida + linha de rejunte) — comportamento antigo
  // preservado pra todo produto que não tem assets.textures.
  assert.match(source, /var pisoHasRealTexture = !!\(effectiveFinish && effectiveFinish\.assets\.textures\);/);
  assert.match(source, /var pisoMaterial = pisoHasRealTexture\s*\n\s*\? buildFloorTileMaterial\(effectiveFinish, roomFinishSettings\.scale, roomFinishSettings\.rotation\)\s*\n\s*: null;/);
});
