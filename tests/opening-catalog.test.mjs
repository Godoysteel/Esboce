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
  assert.match(source, /op\.height = productOverride\.heightM;/);
  assert.match(source, /op\.productId = productOverride\.productId;/);
});

test('janela de catálogo nasce alinhada pelo topo às portas de 2,10 m', () => {
  const source = storeSource();
  assert.match(source, /kind === 'window'\) op\.sillHeight = Math\.max\(0, Core\.OPENING_DEFAULT_HEAD_HEIGHT - op\.height\)/);
  const core = readFileSync(new URL('../src/core/Core.ts', import.meta.url), 'utf8');
  assert.match(core, /OPENING_DEFAULT_HEAD_HEIGHT = 2\.10/);
  // Maxim-ar 0,60 m: peitoril 1,50 m; janela grande 1,20 m: 0,90 m.
  assert.ok(Math.abs((2.10 - 0.60) - 1.50) < 1e-9);
  assert.ok(Math.abs((2.10 - 1.20) - 0.90) < 1e-9);
});

test('todo produto door/window tem material, dimensões e uma representação 3D', () => {
  const doorsAndWindows = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')];
  assert.ok(doorsAndWindows.length >= 17);
  doorsAndWindows.forEach((p) => {
    assert.ok(p.frameMaterial, `${p.id} sem frameMaterial`);
    assert.ok(p.assets.nominalWidthM && p.assets.nominalWidthM > 0, `${p.id} sem nominalWidthM válido`);
    assert.ok(p.assets.nominalHeightM && p.assets.nominalHeightM > 0, `${p.id} sem nominalHeightM válido`);
    assert.ok(p.assets.modelUrl || p.assets.proceduralOpeningStyle, `${p.id} sem modelo GLB nem procedural`);
  });
});

test('filtro por frameMaterial traz 17 esquadrias de vidro e 6 de madeira', () => {
  const vidro = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')]
    .filter((p) => p.frameMaterial === 'vidro');
  assert.equal(vidro.length, 17);
  const madeira = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')]
    .filter((p) => p.frameMaterial === 'madeira');
  assert.equal(madeira.length, 6);
  assert.equal(new Set(madeira.map((p) => p.assets.proceduralOpeningStyle)).size, 6);
});

test('seletor de esquadria (ViewportController) guarda o produto escolhido antes de posicionar, com aba "Padrão"', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(source, /var pendingOpeningProductId: string \| null = null/);
  assert.match(source, /function refreshOpeningPickerPanel/);
  assert.match(source, /Padrão \(editável depois\)/);
});

test('todas as 28 esquadrias têm thumbnail', () => {
  const doorsAndWindows = [...Catalog.getProductsByCategory('door'), ...Catalog.getProductsByCategory('window')];
  assert.equal(doorsAndWindows.length, 28);
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

test('linha PVC Tomelin oferece as cinco tipologias oficiais com foto e modelo procedural próprios', () => {
  const pvc = Catalog.getProductsByCategory('window').filter((p) => p.frameMaterial === 'pvc');
  assert.equal(pvc.length, 5);
  assert.deepEqual(new Set(pvc.map((p) => p.manufacturer)), new Set(['tomelin']));
  assert.equal(new Set(pvc.map((p) => p.assets.proceduralOpeningStyle)).size, 5);
  pvc.forEach((p) => {
    assert.match(p.id, /^tomelin\.janela\.pvc-/);
    assert.match(p.assets.thumbnailUrl, /^images\/esquadrias\/tomelin\//);
  });
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /function buildProceduralPvcOpening/);
  assert.match(renderer, /pvc-window-integrated/);
  assert.match(renderer, /pvc-window-sliding/);
  assert.match(renderer, /pvc-window-casement/);
  assert.match(renderer, /pvc-window-awning/);
  assert.match(renderer, /pvc-window-tilt-turn/);
});

test('persiana integrada fica faceada externamente e encontra o perfil horizontal sem fresta', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /var glassH = innerH - shutterH;/);
  assert.match(renderer, /var shutterZ = depth \/ 2 - shutterDepth \/ 2;/);
  assert.match(renderer, /var slatZ = depth \/ 2 - slatDepth \/ 2;/);
});

test('detalhes das portas de madeira são gerados nas faces externa e interna', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /-depth \/ 2 - 0\.025, metal/);
  assert.match(renderer, /-depth \* 0\.05, woodDark/);
  assert.match(renderer, /var grooveBack = box/);
});

test('vidro dos modelos de esquadria usa o mesmo material de vidro do envidraçamento, mas com transparência real (não o padrão 100% opaco da fachada) e reflexo reduzido (DEC-99)', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(source, /glass\|vidro/i);
  // roughness/reflectionIntensity sobrescritos só aqui — reflexo reduzido
  // nas esquadrias sem mexer no padrão do vidro da fachada (Envidraçamento).
  assert.match(source, /buildGlazingGlassMaterial\(\{ \.\.\.DEFAULT_GLAZING_GLASS_MATERIAL, opacity: 0\.35, roughness: 0\.22, reflectionIntensity: 1\.0 \}\)/);
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
  assert.match(source, /function buildFloorTileMaterial\(product: any, scale: number, rotationDeg: number, surfaceKey: string\) \{/);
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
  assert.match(source, /var pisoMaterial = pisoHasRealTexture\s*\n\s*\? buildFloorTileMaterial\(effectiveFinish, roomFinishSettings\.scale, roomFinishSettings\.rotation, roomKey\)\s*\n\s*: null;/);
});

// DEC-98 — parede ganha o mesmo tratamento do piso (DEC-97): Product
// Owner trouxe uma textura de pedra empilhada, pediu pra aplicar em
// parede. A face da parede também só usava buildCeramicTexture (cor
// sólida + linha de rejunte) mesmo quando o produto tinha mapas PBR
// reais — mesmo gap arquitetônico do piso, só que na parede.
test('Catalog: produto de pedra empilhada (teste PBR) existe com os mapas certos, sem aoMap (fonte não trouxe)', () => {
  const product = Catalog.getProduct('teste.parede.pedra-empilhada-pbr');
  assert.ok(product, 'produto teste.parede.pedra-empilhada-pbr não encontrado no Catálogo');
  assert.equal(product.category, 'floor_tile');
  assert.ok(product.assets.textures, 'produto sem assets.textures');
  assert.match(product.assets.textures.map, /^data:image\/jpeg;base64,/);
  assert.match(product.assets.textures.normalMap, /^data:image\/jpeg;base64,/);
  assert.match(product.assets.textures.roughnessMap, /^data:image\/jpeg;base64,/);
  assert.equal(product.assets.textures.aoMap, undefined);
  assert.ok(product.assets.tileMeters > 0);
});

test('Scene3DRenderer: face da parede (e do oitão) usa a textura PBR de verdade (buildWallFaceMaterial, repeat em metros reais) quando o produto tem assets.textures — cai no padrão procedural de cerâmica só quando não tem', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(source, /function buildWallFaceMaterial\(product: any\) \{/);
  // Reaproveita o MESMO cache de textura decodificada do piso (chave por
  // product.id) — sem recarregar a imagem quando o mesmo produto já foi
  // usado em algum cômodo.
  assert.match(source, /function buildWallFaceMaterial\(product: any\) \{\s*\n\s*var tex = product\.assets\.textures!;\s*\n\s*if \(!floorTextureCache\[product\.id\]\)/);
  // Sem recalcular UV por vértice (a face é um quad plano, UV já em
  // unidades de WALL_PLASTER_TILE_METERS) — só repeat pela razão entre
  // essa unidade fixa e o tileMeters do produto.
  assert.match(source, /var repeatUnits = WALL_PLASTER_TILE_METERS \/ \(product\.assets\.tileMeters \|\| 1\);/);
  assert.match(source, /c\.repeat\.set\(repeatUnits, repeatUnits\);/);
  // Ramo de decisão na face da parede: produto com textura real usa
  // buildWallFaceMaterial (com normalMap/roughnessMap/aoMap de verdade);
  // sem isso, cai no buildCeramicTexture de sempre — comportamento
  // antigo preservado pra todo produto sem assets.textures.
  assert.match(source, /var hasRealTexture = !!\(product && product\.category === 'floor_tile' && product\.assets\.textures\);/);
  assert.match(source, /var wallPbrMaps = hasRealTexture \? buildWallFaceMaterial\(product\) : null;/);
  assert.match(source, /normalMap: DEBUG_COLOR_MODE \? null : \(hasRealTexture \? wallPbrMaps!\.normalMap : null\),/);
  // Oitão (parede triangular sob telhado de duas águas) usa a mesma
  // categoria de produto quando pintado como "parede" — ganha o mesmo
  // tratamento, senão a mesma textura aplicaria PBR na parede reta mas
  // cerâmica lisa no oitão da mesma casa.
  assert.match(source, /function buildGableWallMaterial\(productId: any, viewState: any\) \{/);
  assert.match(source, /if \(product && product\.category === 'floor_tile' && product\.assets\.textures\) \{/);
});
