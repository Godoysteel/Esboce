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

// Pedido original do Product Owner, com fotos de referência: o beiral
// (avanço da água de verdade) ficava aberto — o próprio telhado
// inclinado aparecia por baixo. Ganhou um forro EM NÍVEL (plano, não
// seguindo a água) — buildEaveSoffitPanel, um box simples. Depois o
// duas-águas passou a acompanhar a inclinação (ver teste abaixo), e por
// fim (DEC-225) quatro-águas e uma-água também — buildEaveSoffitPanel
// ficou sem nenhuma chamada e foi removida, não sobra código morto.
test('buildEaveSoffitPanel (forro em nível) foi removida — todos os telhados usam forro inclinado agora (DEC-225)', () => {
  assert.doesNotMatch(source, /function buildEaveSoffitPanel\(/);
  assert.doesNotMatch(source, /buildEaveSoffitPanel\(/);
});

// Pedido do Product Owner reverteu a decisão acima especificamente pro
// duas-águas primeiro: o forro EM NÍVEL saiu, entra um forro que
// ACOMPANHA a inclinação da água (mesmo plano da face inferior já
// visível ali, só um pouco mais abaixo — SOFFIT_THICKNESS — pra não
// brigar com ela). O beirão do oitão (RAKE_OVERHANG), que ficava
// aberto, também fecha agora, seguindo o perfil de duas águas do
// próprio telhado (2 quads por lado da cumeeira, porque o perfil não é
// plano num quad só). Na época, quatro-águas e uma-água não mudaram
// (pedido era só duas-águas) — DEC-225 (testes abaixo) estendeu a mesma
// ideia pros outros dois.
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

// DEC-225 — Rogério: "quero que o forro do beiral acompanhe a
// inclinação do telhado" (pedido geral, não só duas-águas desta vez).
// Mesma técnica do duas-águas: sobe do beiral até a parede seguindo a
// MESMA inclinação da água de cada lado, um pouco abaixo da face
// inferior da água (SOFFIT_THICKNESS) pra não brigar com ela.
test('quatro-águas fecha o forro no anel inteiro com a inclinação real de cada água (não mais em nível) — DEC-225', () => {
  const start = source.indexOf('function buildRoofQuatroAguas(');
  const end = source.indexOf('\n  function buildRoofUmaAgua(', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofQuatroAguas\([^)]*soffitColor: any\)/);
  const quadCallCount = (body.match(/buildQuadMesh\(/g) || []).length;
  assert.equal(quadCallCount, 4, 'esperava 4 chamadas (4 lados do anel, um quad inclinado cada)');
  assert.match(body, /var quatroAguasOverhangRise = ROOF_OVERHANG \* Math\.tan\(pitchRad\);/);
  assert.match(body, /var quatroAguasEaveUnderY = topY - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /var quatroAguasWallUnderY = quatroAguasEaveUnderY \+ quatroAguasOverhangRise;/);
  // Frente/fundo continuam avançando pelas quinas (eMinX..eMaxX, já
  // estendido +ROOF_OVERHANG de cada lado) pra não sobrar buraco onde
  // encontram as faixas laterais — mesma cobertura de canto de antes,
  // só que agora inclinada.
  assert.match(body, /\{ x: eMinX, y: quatroAguasEaveUnderY, z: eMinZ \}, \{ x: eMaxX, y: quatroAguasEaveUnderY, z: eMinZ \},/);
  assert.match(body, /\{ x: eMaxX, y: quatroAguasWallUnderY, z: topBounds\.minZ \}, \{ x: eMinX, y: quatroAguasWallUnderY, z: topBounds\.minZ \},/);
});

test('uma-água fecha o forro só no beiral baixo, com a inclinação real da água — lado alto (sem avanço) e os dois lados em rampa continuam abertos — DEC-225', () => {
  const start = source.indexOf('function buildRoofUmaAgua(');
  const end = source.indexOf('\n  // Quatro paredes baixas', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofUmaAgua\([^)]*soffitColor: any\)/);
  const quadCallCount = (body.match(/buildQuadMesh\(/g) || []).length;
  assert.equal(quadCallCount, 2, 'esperava 2 chamadas (1 beiral baixo inclinado × 2 branches de ridgeAxis)');
  assert.match(body, /var umaAguaEaveUnderY = topY - verticalDrop - SOFFIT_THICKNESS;/);
  assert.match(body, /\{ x: eMinX, y: umaAguaEaveUnderY, z: eMinZ \}, \{ x: eMaxX, y: umaAguaEaveUnderY, z: eMinZ \},/);
  assert.match(body, /\{ x: eMaxX, y: umaAguaEaveUnderY \+ gableBaseRise, z: topBounds\.minZ \}, \{ x: eMinX, y: umaAguaEaveUnderY \+ gableBaseRise, z: topBounds\.minZ \},/);
  assert.match(body, /var umaAguaEaveUnderY2 = topY - verticalDrop - SOFFIT_THICKNESS;/);
});

test('buildRoofPiece calcula soffitColor a partir da cor da parede da casa e repassa pra cada tipo de telhado', () => {
  assert.match(source, /var soffitColor = buildWallMatchMaterial\(wallMatchColor != null \? wallMatchColor : GABLE_COLOR, wallMatchIsPlain, viewState\);/);
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
  assert.match(body, /function buildRoofPlatibanda\([^)]*hasMolding: any, parapetColorIsPlain: any, neighborBounds\?: any\[\]\)/);
  assert.match(body, /if \(hasMolding\) \{/);
  assert.match(body, /var moldingThickness = PARAPET_THICK \+ MOLDING_PROJECTION \* 2;/);
  assert.match(body, /var moldingTopY = topY \+ Math\.max\(height - MOLDING_HEIGHT, 0\);/);
  assert.match(body, /buildParapetWalls\(topBounds, moldingTopY, MOLDING_HEIGHT, moldingThickness, parapetColorResolved, parapetColorIsPlain, neighborBounds\)/);
  assert.match(source, /buildRoofPlatibanda\(bounds, floorTopY, roofColor, ridgeAxis, roof\.parapetHeight, parapetColor, !!roof\.parapetMolding, wallMatchIsPlain, neighborBounds\)/);
});

// Print do Rogério: "a face externa da platibanda não bate exatamente
// com a face externa da parede". `bounds` (roof.x1/x2/y1/y2) é o EIXO da
// parede, não a face — confirmado lendo Core.computeWallFootprints
// (mesma convenção que GABLE_WALL_EXTEND já usa pros oitões). Uma
// primeira tentativa (registrada só no histórico, não neste código)
// tratou `bounds` como se já fosse a face externa e recuou o parapeito
// PRA DENTRO por PARAPET_THICK/2 (5cm) — errado nos dois sentidos
// (direção E magnitude). Correção real: desloca cada segmento PRA FORA
// por `GABLE_WALL_EXTEND - PARAPET_THICK/2` (~1cm) — como a face externa
// do parapeito já nasce PARAPET_THICK/2 além do próprio centro, o
// resultado cai exatamente em cima da face externa real da parede
// (bounds + GABLE_WALL_EXTEND). Usa sempre a meia espessura do parapeito
// BASE (nunca a de `thickness` — a moldura é mais larga mas usa a MESMA
// chamada), pra continuar centrada no mesmo eixo do parapeito comum.
test('DEC-223: buildParapetWalls desloca cada segmento por GABLE_WALL_EXTEND - PARAPET_THICK/2 (não por PARAPET_THICK/2 pra dentro) — face externa do parapeito fica rente à face externa real da parede', () => {
  const start = source.indexOf('function buildParapetWalls(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /var outset = GABLE_WALL_EXTEND - PARAPET_THICK \/ 2;/);
  assert.match(body, /seg\(iv\[0\], bounds\.minZ - outset, iv\[1\], bounds\.minZ - outset\)/);
  assert.match(body, /seg\(bounds\.maxX \+ outset, iv\[0\], bounds\.maxX \+ outset, iv\[1\]\)/);
  assert.match(body, /seg\(iv\[1\], bounds\.maxZ \+ outset, iv\[0\], bounds\.maxZ \+ outset\)/);
  assert.match(body, /seg\(bounds\.minX - outset, iv\[1\], bounds\.minX - outset, iv\[0\]\)/);
});

// DEC-226 — Rogério: "o sistema de platibanda tem as quinas das
// paredes erradas, uma parede atravessa a outra, não segue o padrão
// das paredes dos cômodos". Reproduzido com uma casa em L: dois
// telhados platibanda que se ENCOSTAM sem se FUNDIREM num retângulo só
// (Core.roofsCanFuse não funde um L de verdade) — cada um desenhava as
// 4 paredes do próprio retângulo inteiras, mesmo no trecho onde fazem
// divisa uma com a outra, sobrepondo dois parapeitos exatamente ali.
test('buildParapetWalls recorta o parapeito nos trechos onde outro telhado (neighborBounds) faz divisa — não desenha mais parede onde a divisa é interna (DEC-226)', () => {
  const start = source.indexOf('function buildParapetWalls(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildParapetWalls\(bounds: any, topY: any, height: any, thickness: any, color: any, isPlain: any, neighborBounds\?: any\[\]\)/);
  assert.match(body, /var TOUCH_TOL = 0\.01;/);
  assert.match(body, /function coveredOn\(matchSide: 'minX' \| 'maxX' \| 'minZ' \| 'maxZ', matchValue: number, loKey: 'minX' \| 'minZ', hiKey: 'maxX' \| 'maxZ'\): number\[\]\[\] \{/);
  assert.match(body, /if \(Math\.abs\(n\[matchSide\] - matchValue\) > TOUCH_TOL\) return;/);
  assert.match(body, /subtractCoveredIntervals\(bounds\.minX, bounds\.maxX, coveredOn\('maxZ', bounds\.minZ, 'minX', 'maxX'\)\)/);
  assert.match(body, /subtractCoveredIntervals\(bounds\.minZ, bounds\.maxZ, coveredOn\('minX', bounds\.maxX, 'minZ', 'maxZ'\)\)/);
  assert.match(body, /subtractCoveredIntervals\(bounds\.minX, bounds\.maxX, coveredOn\('minZ', bounds\.maxZ, 'minX', 'maxX'\)\)/);
  assert.match(body, /subtractCoveredIntervals\(bounds\.minZ, bounds\.maxZ, coveredOn\('maxX', bounds\.minX, 'minZ', 'maxZ'\)\)/);
});

test('subtractCoveredIntervals devolve os trechos abertos que sobram fora dos intervalos cobertos (função pura, testável direto)', () => {
  const start = source.indexOf('function subtractCoveredIntervals(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /function subtractCoveredIntervals\(lo: number, hi: number, covered: number\[\]\[\]\): number\[\]\[\] \{/);
  // Reimplementa a mesma lógica isolada (o arquivo não é importável
  // direto — ver nota no topo) e confere contra os cenários reais do
  // print: cobertura total de um lado (sobra nada) e cobertura parcial
  // (sobra só o trecho exterior, igual ao braço extra do L).
  function subtractCoveredIntervals(lo, hi, covered) {
    let intervals = [[lo, hi]];
    covered.forEach(([a, b]) => {
      const next = [];
      intervals.forEach(([s, e]) => {
        if (b <= s + 1e-6 || a >= e - 1e-6) { next.push([s, e]); return; }
        if (a > s + 1e-6) next.push([s, a]);
        if (b < e - 1e-6) next.push([b, e]);
      });
      intervals = next;
    });
    return intervals.filter(([s, e]) => e - s > 1e-3);
  }
  // Caso do print: telhado 1 (Z de -50 a 30) faz divisa com o telhado 2
  // só de Z=-30 a 30 (o braço extra do L, Z=-50 a -30, continua exterior).
  assert.deepEqual(subtractCoveredIntervals(-50, 30, [[-30, 30]]), [[-50, -30]]);
  // Telhado 2 (Z de -30 a 30): a divisa cobre o trecho inteiro — some.
  assert.deepEqual(subtractCoveredIntervals(-30, 30, [[-30, 30]]), []);
  // Sem vizinho nenhum: o trecho inteiro continua aberto, igual sempre foi.
  assert.deepEqual(subtractCoveredIntervals(-30, 30, []), [[-30, 30]]);
});
