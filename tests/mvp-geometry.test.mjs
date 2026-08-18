import assert from 'node:assert/strict';
import test from 'node:test';

import { createProject, createRoofEntity, createWallEntity, roofsCanFuse, snapCoordinateToWalls } from '../src/core/Core.ts';
import {
  computeFoundationQuantity,
  gableAreaMeters,
  roofAreaMeters,
  roofNetAreas,
  umaAguaBackWallAreaMeters,
} from '../src/core/QuantityGeometry.ts';

const roofConfig = { grid: 20, roofOverhang: 0.4, rakeOverhang: 0.2 };
const foundationConfig = {
  baldrameWidth: 0.25,
  baldrameThickness: 0.2,
  radierMargin: 0.15,
  radierThickness: 0.18,
  steelRateKgM3: 70,
};

test('projeto novo nasce com baldrame e camada de fundação visível', () => {
  const project = createProject();
  assert.equal(project.foundationType, 'baldrame');
  assert.equal(project.layers.fundacao, true);
});

test('baldrame acompanha o comprimento das paredes mesmo com a camada oculta', () => {
  const project = createProject();
  project.layers.fundacao = false;
  const foundation = computeFoundationQuantity(project.foundationType, 14, 12, 14, foundationConfig);
  assert.equal(foundation?.type, 'baldrame');
  assert.equal(foundation.length, 14);
  assert.equal(foundation.concreteVolume, 14 * foundationConfig.baldrameWidth * foundationConfig.baldrameThickness);
});

test('trocar para radier usa a área do cômodo mais sua margem periférica', () => {
  const project = createProject();
  project.foundationType = 'radier';
  const foundation = computeFoundationQuantity(project.foundationType, 14, 12, 14, foundationConfig);
  const expectedArea = 12 + 14 * foundationConfig.radierMargin;
  assert.equal(foundation?.type, 'radier');
  assert.equal(foundation.areaM2, expectedArea);
  assert.equal(foundation.concreteVolume, expectedArea * foundationConfig.radierThickness);
});

test('oitão de duas águas entra como área de parede derivada da cobertura', () => {
  const roof = createRoofEntity(0, 0, 80, 60, 'duasAguas', 30, 'x', 'roof');
  const widthM = 3;
  const pitch = Math.PI / 6;
  const expected = widthM * roofConfig.roofOverhang * Math.tan(pitch) +
    widthM * (widthM / 2 * Math.tan(pitch)) / 2;
  assert.ok(Math.abs(gableAreaMeters(roof, roofConfig) - expected) < 1e-9);
  assert.equal(gableAreaMeters({ ...roof, type: 'quatroAguas' }, roofConfig), 0);
});

// Pedido do Product Owner: "está aberto, tem que fazer os fechamentos
// laterais assim como funcionam no duas aguas" — uma-água ganhou o
// mesmo fechamento lateral (ver buildRoofUmaAgua, Scene3DRenderer.ts),
// mas sem cumeeira central o triângulo sobe reto pela largura INTEIRA,
// não a metade como no duas-águas simétrico — por isso o dobro do termo
// triangular pro mesmo pitch/largura.
test('fechamento lateral de uma água entra como área de parede — triângulo de largura inteira, sem cumeeira', () => {
  const roof = createRoofEntity(0, 0, 80, 60, 'umaAgua', 30, 'x', 'roof');
  const widthM = 3;
  const pitch = Math.PI / 6;
  const expected = widthM * roofConfig.roofOverhang * Math.tan(pitch) +
    widthM * (widthM * Math.tan(pitch)) / 2;
  assert.ok(Math.abs(gableAreaMeters(roof, roofConfig) - expected) < 1e-9);
  // Exatamente o dobro do termo triangular do duas-águas (DEC-31),
  // mesmo pitch e largura — confirma que é largura inteira, não metade.
  const duasAguasArea = gableAreaMeters({ ...roof, type: 'duasAguas' }, roofConfig);
  const baseRiseTerm = widthM * roofConfig.roofOverhang * Math.tan(pitch);
  const duasAguasTriangle = duasAguasArea - baseRiseTerm;
  const umaAguaTriangle = expected - baseRiseTerm;
  assert.ok(Math.abs(umaAguaTriangle - duasAguasTriangle * 2) < 1e-9);
});

// Segundo relato do Product Owner: os fechamentos laterais fecharam,
// mas faltava a parede de trás (lado alto) subir. umaAguaBackWallAreaMeters
// é um painel RETANGULAR (largura = eixo perpendicular à água), não
// triangular como o fechamento lateral — dimensão diferente de propósito.
test('painel de trás (lado alto) do uma-água tem área própria, retangular — largura no eixo perpendicular à água', () => {
  const roof = createRoofEntity(0, 0, 80, 60, 'umaAgua', 30, 'x', 'roof');
  const slopeSpanM = 3; // eixo Y/Z (mesmo widthM do fechamento lateral) — direção da água
  const backWidthM = 4; // eixo X — direção perpendicular, a própria largura da parede de trás
  const pitch = Math.PI / 6;
  const riseM = (slopeSpanM + roofConfig.roofOverhang) * Math.tan(pitch);
  const expected = backWidthM * riseM;
  assert.ok(Math.abs(umaAguaBackWallAreaMeters(roof, roofConfig) - expected) < 1e-9);
  assert.equal(umaAguaBackWallAreaMeters({ ...roof, type: 'duasAguas' }, roofConfig), 0, 'duas-águas não tem painel de trás — as duas águas já se encontram na cumeeira');
  assert.equal(umaAguaBackWallAreaMeters({ ...roof, type: 'quatroAguas' }, roofConfig), 0);
});

test('telhados sobrepostos não perdem área antes do engaste', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'duasAguas', 30, 'x', 'roof-a');
  const roofB = createRoofEntity(40, 20, 100, 60, 'duasAguas', 30, 'y', 'roof-b');
  const areas = roofNetAreas([roofA, roofB], roofConfig);
  assert.equal(areas[roofA.id], roofAreaMeters(roofA, roofConfig));
  assert.equal(areas[roofB.id], roofAreaMeters(roofB, roofConfig));
});

test('engaste transversal desconta a sobreposição uma única vez', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'duasAguas', 30, 'x', 'roof-a');
  const roofB = createRoofEntity(40, 20, 100, 60, 'duasAguas', 30, 'y', 'roof-b');
  roofA.compoundGroupId = 'compound';
  roofB.compoundGroupId = 'compound';
  const gross = roofAreaMeters(roofA, roofConfig) + roofAreaMeters(roofB, roofConfig);
  const areas = roofNetAreas([roofA, roofB], roofConfig);
  const net = areas[roofA.id] + areas[roofB.id];
  assert.ok(net > 0);
  assert.ok(net < gross);
  assert.equal(
    [areas[roofA.id] < roofAreaMeters(roofA, roofConfig), areas[roofB.id] < roofAreaMeters(roofB, roofConfig)].filter(Boolean).length,
    1,
  );
});

test('coberturas paralelas não recebem corte de água-furtada', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'duasAguas', 30, 'x', 'roof-a');
  const roofB = createRoofEntity(40, 20, 100, 60, 'duasAguas', 30, 'x', 'roof-b');
  roofA.compoundGroupId = 'compound';
  roofB.compoundGroupId = 'compound';
  const areas = roofNetAreas([roofA, roofB], roofConfig);
  assert.equal(areas[roofA.id], roofAreaMeters(roofA, roofConfig));
  assert.equal(areas[roofB.id], roofAreaMeters(roofB, roofConfig));
});

test('duas platibandas encostando no mesmo eixo se fundem, como cômodo', () => {
  // roofA vai de x=0..80, roofB começa exatamente onde A termina (x=80..160),
  // mesma faixa em y — encostadas lado a lado, mesmo eixo de cumeeira 'x'.
  const roofA = createRoofEntity(0, 0, 80, 60, 'platibanda', 28, 'x', 'roof-a');
  const roofB = createRoofEntity(80, 0, 160, 60, 'platibanda', 28, 'x', 'roof-b');
  assert.equal(roofsCanFuse(roofA, roofB, 4), true);
});

test('platibandas com eixo de cumeeira diferente não se fundem', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'platibanda', 28, 'x', 'roof-a');
  const roofB = createRoofEntity(80, 0, 160, 60, 'platibanda', 28, 'y', 'roof-b');
  assert.equal(roofsCanFuse(roofA, roofB, 4), false);
});

test('platibandas com pitchDeg diferente ainda se fundem (campo não usado na laje plana)', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'platibanda', 28, 'x', 'roof-a');
  const roofB = createRoofEntity(80, 0, 160, 60, 'platibanda', 45, 'x', 'roof-b');
  assert.equal(roofsCanFuse(roofA, roofB, 4), true);
});

test('platibanda longe demais da outra não se funde', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'platibanda', 28, 'x', 'roof-a');
  const roofB = createRoofEntity(200, 0, 280, 60, 'platibanda', 28, 'x', 'roof-b');
  assert.equal(roofsCanFuse(roofA, roofB, 4), false);
});

test('platibanda não funde com telhado de outro tipo', () => {
  const roofA = createRoofEntity(0, 0, 80, 60, 'platibanda', 28, 'x', 'roof-a');
  const roofB = createRoofEntity(80, 0, 160, 60, 'duasAguas', 28, 'x', 'roof-b');
  assert.equal(roofsCanFuse(roofA, roofB, 4), false);
});

test('snapCoordinateToWalls: gruda exatamente no eixo de uma parede próxima, mesmo fora do grid redondo', () => {
  // Parede com coordenada "torta" (não múltipla de SNAP_UNIT) — simula
  // imprecisão de ponto flutuante acumulada por uma fusão antiga.
  const walls = [createWallEntity(0, 0, 79.6, 0)];
  // Arrastando perto da ponta torta (79.6): deve grudar EXATAMENTE nela,
  // não só arredondar pro múltiplo de SNAP_UNIT mais próximo (80).
  assert.equal(snapCoordinateToWalls(79.5, walls, 'x', 5), 79.6);
});

test('snapCoordinateToWalls: longe de qualquer parede, cai no snap comum do grid', () => {
  const walls = [createWallEntity(0, 0, 200, 0)];
  // SNAP_UNIT = 5 (250mm, ver Core.ts) — 45 já é múltiplo exato de 5,
  // então Core.snap(45) = 45 (sem arredondar), nenhuma parede por perto.
  assert.equal(snapCoordinateToWalls(45, walls, 'x', 5), 45);
});

test('snapCoordinateToWalls: ignora paredes fora da tolerância', () => {
  const walls = [createWallEntity(0, 0, 200, 0)];
  // 200 está a 20 unidades de 180 — maior que a tolerância de 5, então
  // não deve grudar em 200, só cair no snap comum.
  assert.equal(snapCoordinateToWalls(178, walls, 'x', 5), 180);
});
