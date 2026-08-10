import assert from 'node:assert/strict';
import test from 'node:test';

import { createProject, createRoofEntity } from '../src/core/Core.ts';
import {
  computeFoundationQuantity,
  gableAreaMeters,
  roofAreaMeters,
  roofNetAreas,
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
