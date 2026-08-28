import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Scene3DRenderer.ts não é importável direto (depende de Three.js/DOM em
// tempo de carga) — testado por busca de texto, mesma técnica já usada
// pelos demais testes deste módulo (ver roof-uma-agua-gable.test.mjs).
const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const persistence = readFileSync(new URL('../src/core/ProjectPersistence.ts', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/core/types.ts', import.meta.url), 'utf8');

// Pedido do Product Owner, com fotos de referência: o beiral (avanço da
// água de verdade) ficava aberto — o próprio telhado inclinado aparecia
// por baixo. Precisa de um forro EM NÍVEL (plano, não seguindo a água),
// só nos beirais de verdade — a ponta em diagonal do oitão (RAKE_OVERHANG)
// continua aberta, igual sempre foi.
test('buildEaveSoffitPanel constrói um painel plano (não segue a inclinação), independente do beiral aberto original', () => {
  const start = source.indexOf('function buildEaveSoffitPanel(');
  assert.notEqual(start, -1);
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /new THREE\.BoxGeometry\(Math\.max\(sizeX, 0\.01\), SOFFIT_THICKNESS, Math\.max\(sizeZ, 0\.01\)\)/);
  assert.match(body, /mesh\.position\.set\(centerX, topYForPanel - SOFFIT_THICKNESS \/ 2, centerZ\)/);
  assert.match(body, /mesh\.userData\.roofClosure = 'soffit'/);
});

// Pedido do Product Owner reverteu a decisão acima especificamente pro
// duas-águas: o forro EM NÍVEL saiu, entra um forro que ACOMPANHA a
// inclinação da água (mesmo plano da face inferior já visível ali, só
// um pouco mais abaixo — SOFFIT_THICKNESS — pra não brigar com ela). O
// beirão do oitão (RAKE_OVERHANG), que ficava aberto, também fecha
// agora, seguindo o perfil de duas águas do próprio telhado (2 quads
// por lado da cumeeira, porque o perfil não é plano num quad só).
// quatro-águas e uma-água NÃO mudam (pedido era só duas-águas).
test('duas-águas troca o forro em nível por um que acompanha a inclinação da água e fecha também o beirão do oitão', () => {
  const start = source.indexOf('function buildRoofDuasAguas(');
  const end = source.indexOf('\n  function buildRoofQuatroAguas(', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofDuasAguas\([^)]*soffitColor: any\)/);
  assert.equal((body.match(/buildEaveSoffitPanel\(/g) || []).length, 0, 'não usa mais o forro em nível pra duas-águas');
  const quadCallCount = (body.match(/buildQuadMesh\(/g) || []).length;
  assert.equal(quadCallCount, 12, 'esperava 12 chamadas (2 beiral + 4 oitão) × 2 branches de ridgeAxis');
  assert.match(body, /var eaveTipUnderY = topY - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /var wallFaceUnderY = topY \+ gableBaseRise - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /var ridgeUnderY = ridgeY - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /var eaveTipUnderY2 = topY - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /var wallFaceUnderY2 = topY \+ gableBaseRise - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /var ridgeUnderY2 = ridgeY2 - verticalDrop - SOFFIT_THICKNESS;/);

  // Prova numérica (ridgeAxis 'x'): telhado 6×4m, beiral 0,4m, oitão
  // 0,4m (RAKE_OVERHANG igualado ao ROOF_OVERHANG), inclinação 28°. Na
  // ponta do beiral (Z=eMinZ) o forro deve estar exatamente no mesmo Y
  // do beiral de antes (topY-verticalDrop), só descontado o
  // SOFFIT_THICKNESS; na parede (Z=topBounds.minZ) deve ter SUBIDO
  // acompanhando a água — mais alto que na ponta, nunca em nível.
  const pitchRad = 28 * Math.PI / 180;
  const verticalDrop = 0.12 / Math.cos(pitchRad);
  const ROOF_OVERHANG = 0.4, SOFFIT_THICKNESS = 0.03;
  const topY = 2.7;
  const eaveTipUnderY = topY - verticalDrop - SOFFIT_THICKNESS;
  const gableBaseRise = ROOF_OVERHANG * Math.tan(pitchRad);
  const wallFaceUnderY = topY + gableBaseRise - verticalDrop - SOFFIT_THICKNESS;
  assert.ok(wallFaceUnderY > eaveTipUnderY, 'o forro do beiral sobe da ponta pra parede, seguindo a mesma inclinação da água — nunca fica em nível');
  assert.ok(Math.abs((wallFaceUnderY - eaveTipUnderY) - gableBaseRise) < 1e-9, 'a subida do forro bate exatamente com a subida real da água nesse trecho (gableBaseRise)');
});

test('quatro-águas fecha o forro no anel inteiro (todo lado é beiral de verdade, sem oitão)', () => {
  const start = source.indexOf('function buildRoofQuatroAguas(');
  const end = source.indexOf('\n  function buildRoofUmaAgua(', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofQuatroAguas\([^)]*soffitColor: any\)/);
  const soffitCallCount = (body.match(/buildEaveSoffitPanel\(/g) || []).length;
  assert.equal(soffitCallCount, 4, 'esperava 4 chamadas (4 lados do anel)');
  // Frente/fundo avançam pelas quinas (+2*ROOF_OVERHANG) pra não sobrar
  // buraco onde encontram as faixas laterais.
  assert.match(body, /\(topBounds\.maxX - topBounds\.minX\) \+ 2 \* ROOF_OVERHANG, ROOF_OVERHANG, topY - verticalDrop, soffitColor/);
});

test('uma-água fecha o forro só no beiral baixo — lado alto (sem avanço) e os dois lados em rampa continuam abertos', () => {
  const start = source.indexOf('function buildRoofUmaAgua(');
  const end = source.indexOf('\n  // Quatro paredes baixas', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofUmaAgua\([^)]*soffitColor: any\)/);
  const soffitCallCount = (body.match(/buildEaveSoffitPanel\(/g) || []).length;
  assert.equal(soffitCallCount, 2, 'esperava 2 chamadas (1 beiral baixo × 2 branches de ridgeAxis)');
  assert.match(body, /buildEaveSoffitPanel\(\(eMinX \+ eMaxX\) \/ 2, topBounds\.minZ - ROOF_OVERHANG \/ 2, eMaxX - eMinX, ROOF_OVERHANG, topY - verticalDrop, soffitColor\)/);
  assert.match(body, /buildEaveSoffitPanel\(topBounds\.minX - ROOF_OVERHANG \/ 2, \(eMinZ2 \+ eMaxZ2\) \/ 2, ROOF_OVERHANG, eMaxZ2 - eMinZ2, topY - verticalDrop, soffitColor\)/);
});

test('buildRoofPiece calcula soffitColor a partir da cor da parede da casa e repassa pra cada tipo de telhado', () => {
  assert.match(source, /var soffitColor = pickColor\(wallMatchColor != null \? wallMatchColor : GABLE_COLOR, 'telhado', viewState\);/);
  assert.match(source, /buildRoofQuatroAguas\(bounds, floorTopY, roofColor, pitchDeg, ridgeAxis, tabeiraColor, soffitColor\)/);
  assert.match(source, /buildRoofUmaAgua\(bounds, floorTopY, roofColor, gableColors, backWallColor, pitchDeg, ridgeAxis, tabeiraColor, soffitColor\)/);
  assert.match(source, /buildRoofDuasAguas\(bounds, floorTopY, roofColor, gableColors, pitchDeg, ridgeAxis, tabeiraColor, soffitColor\)/);
});

// Segundo pedido, mesmas fotos de referência: opção de moldura em
// relevo no topo do parapeito da platibanda — um toggle simples, perfil
// fixo (sem campos de largura/espessura editáveis por ora).
test('Roof.parapetMolding existe no domínio, é persistido e só platibanda expõe o toggle', () => {
  assert.match(types, /parapetMolding\?: boolean;/);
  assert.match(persistence, /if \(v\.parapetMolding === true\) \{\s*roof\.parapetMolding = true;/);
  assert.match(store, /setRoofParapetMolding\(roofId: string, hasMolding: boolean\): void/);
  assert.match(store, /r\.parapetMolding = hasMolding;/);
  assert.match(html, /class="roof-molding" title="Adiciona uma moldura em relevo no topo do parapeito"/);
  assert.match(viewport, /moldingBtn\.style\.display = r\.type === 'platibanda' \? '' : 'none';/);
  assert.match(viewport, /moldingBtn\.classList\.toggle\('active', !!r\.parapetMolding\);/);
  assert.match(viewport, /Store\.commands\.setRoofParapetMolding\(selectedRoofId, !moldingRoof\.parapetMolding\)/);
});

test('buildRoofPlatibanda constrói um segundo anel (moldura), mais largo e mais baixo, só quando hasMolding é true', () => {
  const start = source.indexOf('function buildRoofPlatibanda(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofPlatibanda\([^)]*hasMolding: any\)/);
  assert.match(body, /if \(hasMolding\) \{/);
  assert.match(body, /var moldingThickness = PARAPET_THICK \+ MOLDING_PROJECTION \* 2;/);
  assert.match(body, /var moldingTopY = topY \+ Math\.max\(height - MOLDING_HEIGHT, 0\);/);
  assert.match(body, /buildParapetWalls\(topBounds, moldingTopY, MOLDING_HEIGHT, moldingThickness, parapetColorResolved\)/);
  assert.match(source, /buildRoofPlatibanda\(bounds, floorTopY, roofColor, ridgeAxis, roof\.parapetHeight, parapetColor, !!roof\.parapetMolding\)/);
});
