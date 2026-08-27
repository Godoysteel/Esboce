import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createProject, createWallEntity } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';
import {
  STEEL_FRAME_FACE_ASSEMBLIES,
  quantityWithWaste,
  steelFrameSpecificationIssues,
} from '../src/core/SteelFrameAssemblies.ts';

const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

test('catálogo inicial cobre fechamentos externos, drywall, beiral e tabeira de madeira', () => {
  const ids = STEEL_FRAME_FACE_ASSEMBLIES.map((item) => item.id);
  assert.deepEqual(ids.slice(0, 7), [
    'eifs', 'eifs-wood-substrate', 'cement-board-direct', 'cement-board-osb', 'glasroc-x-direct',
    'glasroc-x-therm', 'vinyl-siding-osb',
  ]);
  assert.ok(ids.includes('drywall-st'));
  assert.ok(ids.includes('soffit-cement-board'));
  assert.ok(ids.includes('fascia-cement-board'));
  assert.ok(ids.includes('fascia-wood'));
});

test('beiral e tabeira são escolhas globais únicas, não uma pendência por telhado', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push(
    { id: 'roof-a', x1: 0, y1: 0, x2: 100, y2: 100, type: 'quatroAguas', pitchDeg: 28, ridgeAxis: 'x' },
    { id: 'roof-b', x1: 100, y1: 0, x2: 200, y2: 100, type: 'quatroAguas', pitchDeg: 28, ridgeAxis: 'x' },
  );
  let issues = steelFrameSpecificationIssues(project);
  assert.equal(issues.filter((issue) => issue.kind === 'soffit').length, 1);
  assert.equal(issues.filter((issue) => issue.kind === 'fascia').length, 1);
  assert.equal(issues.find((issue) => issue.kind === 'soffit').entityId, '__project__');
  project.steelFrameSoffitAssemblyId = 'soffit-vinyl';
  project.steelFrameFasciaAssemblyId = 'fascia-wood';
  issues = steelFrameSpecificationIssues(project);
  assert.equal(issues.filter((issue) => issue.kind === 'soffit' || issue.kind === 'fascia').length, 0);
});

test('acabamentos globais de beiral e tabeira sobrevivem ao salvamento', () => {
  const project = createProject('light_steel_frame');
  project.steelFrameSoffitAssemblyId = 'soffit-cement-board';
  project.steelFrameFasciaAssemblyId = 'fascia-wood';
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project;
  assert.equal(restored.steelFrameSoffitAssemblyId, 'soffit-cement-board');
  assert.equal(restored.steelFrameFasciaAssemblyId, 'fascia-wood');
});

test('fixadores de revestimento são unidades e arredondam para cima após a perda', () => {
  const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-direct');
  const screws = assembly.layers.find((layer) => layer.fastener);
  assert.equal(screws.unit, 'unit');
  assert.equal(quantityWithWaste(10.01, screws), 211);
});

test('estrutura engenheirada usa parâmetro preliminar de 30 kg/m² e mantém 5% de perda explícitos', () => {
  assert.match(materialsSource, /const STEEL_FRAME_STRUCTURE_KG_PER_M2 = 30;/);
  assert.match(materialsSource, /parâmetro preliminar 30 kg\/m² \+ 5% de perda/);
  assert.match(materialsSource, /structuralArea \* STEEL_FRAME_STRUCTURE_KG_PER_M2 \* 1\.05/);
});

test('placa cimentícia inclui Base Coat, fita, tela Fiberglass e cantoneira telada com unidades corretas', () => {
  for (const assemblyId of ['cement-board-direct', 'cement-board-osb', 'soffit-cement-board', 'fascia-cement-board']) {
    const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === assemblyId);
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.base-coat-20kg')?.unit, 'kg');
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.fita-fiberglass-10cm-50m')?.unit, 'm');
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.tela-fiberglass-1x50m')?.unit, 'm2');
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.cantoneira-pvc-2-5m')?.unit, 'unit');
  }
});

test('cantoneira telada de 2,5 m usa parâmetro preliminar e arredonda para peças inteiras', () => {
  const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-direct');
  const corner = assembly.layers.find((layer) => layer.id === 'placlux.cantoneira-pvc-2-5m');
  assert.equal(corner.consumptionPerM2, 0.4);
  assert.equal(corner.wastePercent, 10);
  assert.equal(quantityWithWaste(10, corner), 5);
});

test('drywall inclui massa e fita telada para tratamento de juntas', () => {
  for (const assemblyId of ['drywall-st', 'drywall-ru', 'drywall-rf']) {
    const assembly = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === assemblyId);
    assert.equal(assembly.layers.find((layer) => layer.id === 'placlux.massa-drywall')?.unit, 'kg');
    assert.equal(assembly.layers.find((layer) => layer.id === 'drywall-joint-tape')?.unit, 'm');
  }
});

test('quantitativo inclui manta asfáltica e pingadeira de base sob todo o perímetro das paredes, com 10% de perda', () => {
  assert.match(materialsSource, /lowerGuideLengthM \+= wallLengthM/);
  assert.match(materialsSource, /Manta asfáltica sob a guia inferior \(\+ 10% de perda\)/);
  assert.match(materialsSource, /lowerGuideLengthM \* 1\.1/);
  assert.match(materialsSource, /'placlux\.pingadeira-pvc-2-5m', 'Pingadeira de base \(perímetro das paredes, \+ 10% de perda\)', \(lowerGuideLengthM \* 1\.1\) \/ 2\.5/);
});

test('placa cimentícia com e sem OSB levam a mesma Membrana Hidrófuga — pingadeira não é uma camada por composição', () => {
  const direct = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-direct');
  const withOsb = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-osb');
  assert.ok(direct.layers.some((layer) => layer.id === 'placlux.membrana-hidrofuga-52-5m2'), 'sistema sem OSB também precisa da membrana hidrófuga');
  assert.ok(withOsb.layers.some((layer) => layer.id === 'placlux.membrana-hidrofuga-52-5m2'));
  assert.ok(!direct.layers.some((layer) => layer.id === 'placlux.pingadeira-pvc-2-5m'), 'pingadeira cobre o perímetro inteiro da construção, calculada à parte — não é camada de uma composição específica');
});

test('EIFS tem duas variantes de substrato — a fixação do EPS/XPS muda conforme o material do substrato', () => {
  const onCementBoard = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'eifs');
  const onWood = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'eifs-wood-substrate');
  assert.match(onCementBoard.label, /substrato cimentício/);
  assert.match(onWood.label, /substrato de madeira/);

  // Substrato cimentício: EPS colado com basecoat (2 passadas do MESMO
  // produto — colagem + reforço da malha — somadas numa linha só de
  // sacos), sem parafuso com arandela.
  const cementBoardSubstrate = onCementBoard.layers.find((layer) => layer.id === 'placlux.profort-next-10mm');
  assert.ok(cementBoardSubstrate, 'falta a placa cimentícia do substrato');
  assert.equal(cementBoardSubstrate.role, 'structural_sheathing', 'a placa do substrato precisa ter role structural_sheathing pra acionar a folga de 0,6m/m da membrana (MaterialsPanel.hasSubstrate)');
  assert.equal(onCementBoard.layers.filter((layer) => layer.id === 'placlux.base-coat-20kg').length, 2, 'colagem do EPS/XPS + reforço da malha devem ser 2 passadas do mesmo produto');
  assert.ok(!onCementBoard.layers.some((layer) => layer.id === 'eifs-eps-fixers-arandela'), 'substrato cimentício não deveria usar parafuso com arandela');

  // Substrato de madeira: EPS parafusado com arandela, só 1 passada de basecoat (reforço da malha, sem colagem).
  assert.ok(onWood.layers.some((layer) => layer.id === 'cement-board-substrate'), 'falta o painel do substrato de madeira');
  assert.ok(onWood.layers.some((layer) => layer.id === 'eifs-eps-fixers-arandela'), 'falta o parafuso com arandela pro substrato de madeira');
  assert.equal(onWood.layers.filter((layer) => layer.id === 'placlux.base-coat-20kg').length, 1, 'substrato de madeira não deveria colar o EPS com basecoat — só a passada de reforço da malha');

  // Compartilhado pelas duas variantes: EPS/XPS, tela, cantoneira, membrana, acabamento.
  for (const assembly of [onCementBoard, onWood]) {
    assert.ok(assembly.layers.some((layer) => layer.id === 'eifs-eps'), 'falta a placa isolante EPS/XPS');
    assert.ok(assembly.layers.some((layer) => layer.id === 'placlux.tela-fiberglass-1x50m'));
    assert.ok(assembly.layers.some((layer) => layer.id === 'placlux.cantoneira-pvc-2-5m'));
    assert.ok(assembly.layers.some((layer) => layer.id === 'placlux.membrana-hidrofuga-52-5m2'));
    assert.ok(assembly.layers.some((layer) => layer.id === 'eifs-finish'));
  }
});

// Primeiros itens de Steel Frame com preço real, pesquisado pelo
// Product Owner na Espaço Smart em 27/08/2026 (ver migration
// 20260827140000_seed_steel_frame_vortice_references.sql) — o restante
// do quantitativo continua sem preço (cost: null), nenhum número
// inventado pros itens que ainda não têm essa pesquisa.
test('itens de Steel Frame com preço pesquisado (Espaço Smart) calculam custo em buildRows(); os demais continuam sem preço', () => {
  assert.match(materialsSource, /eifsWasherPerUnit: \{ sku: 'vortice-eifs-arandela-pct100', unitDivisor: 100 \}/);
  assert.match(materialsSource, /pingadeiraPerUnit: \{ sku: 'vortice-pingadeira-pvc-2-5m', unitDivisor: 1 \}/);
  assert.match(materialsSource, /glasrocXBoardPerM2: \{ sku: 'placo-glasroc-x-12-5mm', unitDivisor: 2\.88 \}/);
  assert.match(materialsSource, /glasrocBasecoatPerKg: \{ sku: 'placo-placoplast-basecoat-20kg', unitDivisor: 20 \}/);
  assert.match(materialsSource, /glasrocMeshPerM2: \{ sku: 'placo-malha-grx-superficie-1x50m', unitDivisor: 50 \}/);
  assert.match(materialsSource, /glasrocWrbPerM2: \{ sku: 'placo-tyvek-homewrap-0-91x30-5m', unitDivisor: 27\.8 \}/);
  assert.match(materialsSource, /glasrocScrewPerUnit: \{ sku: 'placo-parafuso-glasroc-pb-25mm-cx1000', unitDivisor: 1000 \}/);
  assert.match(materialsSource, /glasrocEpsPerM2: \{ sku: 'vortice-eps-eifs-t7f-30mm-m2', unitDivisor: 1 \}/);
  assert.match(materialsSource, /substrateBoardPerM2: \{ sku: 'vortice-osb-11-1mm', unitDivisor: 2\.88 \}/);

  const start = materialsSource.indexOf('const STEEL_FRAME_PRICE_KEY_BY_LAYER_ID');
  const end = materialsSource.indexOf('};', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /'eifs-eps-fixers-arandela': 'eifsWasherPerUnit'/);
  assert.match(body, /'placlux\.pingadeira-pvc-2-5m': 'pingadeiraPerUnit'/);
  assert.match(body, /'glasroc-x': 'glasrocXBoardPerM2'/);
  assert.match(body, /'glasroc-basecoat': 'glasrocBasecoatPerKg'/);
  assert.match(body, /'glasroc-therm-eps': 'glasrocEpsPerM2'/);
  // 'osb' e 'cement-board-substrate' são o MESMO produto físico (painel do
  // substrato) em composições diferentes — apontam pra chave única.
  assert.match(body, /'osb': 'substrateBoardPerM2'/);
  assert.match(body, /'cement-board-substrate': 'substrateBoardPerM2'/);

  const buildRowsStart = materialsSource.indexOf("steelFrameQuantities(Store.getProject()).forEach((line) => {", materialsSource.indexOf('export function buildRows'));
  const buildRowsEnd = materialsSource.indexOf('});', buildRowsStart);
  const buildRowsBody = materialsSource.slice(buildRowsStart, buildRowsEnd);
  assert.match(buildRowsBody, /const priceKey = STEEL_FRAME_PRICE_KEY_BY_LAYER_ID\[line\.id\];/);
  assert.match(buildRowsBody, /if \(priceKey\) pushMaterial\('Steel Frame', line\.label, line\.quantity, line\.unit, \(line\.technicalQuantity \?\? line\.quantity\) \* materialPrice\(priceKey\), priceKey\);/);
  assert.match(buildRowsBody, /else push\('Steel Frame', line\.label, line\.quantity, line\.unit, null\);/);
});

test('migration Vórtice do Steel Frame cadastra os 4 produtos pesquisados na Espaço Smart, com produto E oferta market_reference', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260827140000_seed_steel_frame_vortice_references.sql', import.meta.url), 'utf8');
  for (const sku of ['vortice-eifs-arandela-pct100', 'vortice-pingadeira-pvc-2-5m', 'vortice-glasroc-x-12-5mm', 'vortice-osb-11-1mm']) {
    assert.ok(migration.includes(sku), `SKU ausente na migration: ${sku}`);
  }
  assert.match(migration, /insert into public\.products/);
  assert.match(migration, /insert into public\.product_offers/);
  assert.match(migration, /'market_reference'/);
  assert.match(migration, /Espaço Smart/);
});

test('composição "com substrato" cobre tanto OSB quanto Compensado, com parafusos próprios de fixação do painel', () => {
  const withSubstrate = STEEL_FRAME_FACE_ASSEMBLIES.find((item) => item.id === 'cement-board-osb');
  assert.match(withSubstrate.label, /OSB ou Compensado/);
  const panel = withSubstrate.layers.find((layer) => layer.id === 'cement-board-substrate');
  assert.ok(panel, 'painel do substrato ausente');
  assert.equal(panel.role, 'structural_sheathing');
  const screws = withSubstrate.layers.find((layer) => layer.id === 'cement-board-substrate-screws');
  assert.ok(screws, 'parafusos de fixação do substrato ausentes');
  assert.equal(screws.consumptionPerM2, 18);
});

test('membrana hidrófuga nunca desconta aberturas (sempre face total) e ganha 0,6 m de folga por metro de parede quando há substrato', () => {
  const start = materialsSource.indexOf("floor.walls.forEach((wall) => {", materialsSource.indexOf('function steelFrameQuantities'));
  const end = materialsSource.indexOf('const insulationId', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /const grossFaceArea = wallLengthM \* wallHeight;/);
  assert.match(body, /if \(layer\.role === 'water_barrier'\) \{/);
  assert.match(body, /const wrapAllowanceM2 = hasSubstrate \? wallLengthM \* 0\.6 : 0;/);
  assert.match(body, /quantityWithWaste\(grossFaceArea \+ wrapAllowanceM2, layer\)/);
  assert.match(body, /hasSubstrate = !!assembly\?\.layers\.some\(\(item\) => item\.role === 'structural_sheathing'\)/);
});

// ADR-006 §9 — quantitativo comercial (placas/rolos/sacos), não só
// técnico (m²/m/kg) — só quando o catálogo PlacLux já publica o
// rendimento oficial do produto (coverageM2/weightKg/lengthM); sem essa
// ficha, a linha continua em m²/m/kg, sem embalagem inventada.
test('steelFrameCommercialUnit converte quantidades técnicas em unidades reais de compra', () => {
  const start = materialsSource.indexOf('function steelFrameCommercialUnit(');
  const end = materialsSource.indexOf('\n}', start);
  const body = materialsSource.slice(start, end);
  assert.match(materialsSource, /'drywall-st': \{ size: 2\.16, unit: 'placas \(1,20 x 1,80 m\)'/);
  assert.match(materialsSource, /'placlux\.massa-drywall': \{ size: 25, unit: 'baldes \(25 kg\)'/);
  assert.match(materialsSource, /'glasroc-basecoat': \{ size: 20, unit: 'sacos \(20 kg\)'/);
  assert.match(materialsSource, /'glasroc-x': \{ size: 2\.88, unit: 'placas \(1,20 x 2,40 m\)'/);
  assert.match(materialsSource, /'placlux\.pingadeira-pvc-2-5m': \{ size: 1, unit: 'barras \(2,5 m\)'/);
  assert.match(body, /product\.category === 'board' \? 'placa' : 'rolo'/);
  assert.match(body, /Math\.ceil\(rawQuantity \/ product\.coverageM2\)/);
  assert.match(body, /product\.unit === 'bucket' \? 'balde' : 'saco'/);
  assert.match(body, /Math\.ceil\(rawQuantity \/ product\.lengthM\)/);
});

test('quantitativo final aplica a conversão comercial e marca quantidades sem casa decimal (whole)', () => {
  assert.match(materialsSource, /const commercial = steelFrameCommercialUnit\(line\.id, line\.unit, technicalQuantity\);/);
  assert.match(materialsSource, /unit: 'unidades'/);
  assert.match(materialsSource, /technicalQuantity/);
});

test('quantitativo de steel frame aponta faces e isolamento ainda não especificados', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].walls.push(createWallEntity(0, 0, 100, 0));
  const wall = project.floors[0].walls[0];
  const issues = steelFrameSpecificationIssues(project);
  assert.ok(issues.some((issue) => issue.kind === 'wall-face' && issue.entityId === wall.id && issue.side === 'a'));
  assert.ok(issues.some((issue) => issue.kind === 'wall-cavity' && issue.entityId === wall.id));
});

test('alvenaria não exige especificações de fechamento de steel frame', () => {
  assert.deepEqual(steelFrameSpecificationIssues(createProject('ceramic_masonry')), []);
});

test('composições de faces e núcleo sobrevivem ao salvamento do projeto', () => {
  const project = createProject('light_steel_frame');
  const wall = createWallEntity(0, 0, 100, 0);
  wall.faceAAssemblyId = 'cement-board-osb';
  wall.faceBAssemblyId = 'drywall-ru';
  wall.cavityAssembly = {
    insulationSystemId: 'mineral-wool',
    thicknessMm: 90,
    purpose: 'thermal_acoustic',
  };
  project.floors[0].walls.push(wall);
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].walls[0];
  assert.equal(restored.faceAAssemblyId, 'cement-board-osb');
  assert.equal(restored.faceBAssemblyId, 'drywall-ru');
  assert.deepEqual(restored.cavityAssembly, wall.cavityAssembly);
});

test('platibanda exige revestimento externo e interno no steel frame', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push({
    id: 'roof-platibanda', x1: 0, y1: 0, x2: 100, y2: 100,
    type: 'platibanda', pitchDeg: 0, ridgeAxis: 'x', parapetHeight: 0.8,
    soffitAssemblyId: 'soffit-cement-board', fasciaAssemblyId: 'placlux.profort-next-10mm',
  });
  const issues = steelFrameSpecificationIssues(project);
  assert.ok(issues.some((issue) => issue.kind === 'parapet-face' && issue.side === 'outer'));
  assert.ok(issues.some((issue) => issue.kind === 'parapet-face' && issue.side === 'inner'));
  project.floors[0].roofs[0].parapetOuterAssemblyId = 'cement-board-osb';
  project.floors[0].roofs[0].parapetInnerAssemblyId = 'cement-board-direct';
  assert.equal(steelFrameSpecificationIssues(project).filter((issue) => issue.kind === 'parapet-face').length, 0);
});

test('revestimentos da platibanda sobrevivem ao salvamento', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push({
    id: 'roof-platibanda', x1: 0, y1: 0, x2: 100, y2: 100,
    type: 'platibanda', pitchDeg: 0, ridgeAxis: 'x', parapetHeight: 0.8,
    parapetOuterAssemblyId: 'cement-board-osb',
    parapetInnerAssemblyId: 'cement-board-direct',
  });
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].roofs[0];
  assert.equal(restored.parapetOuterAssemblyId, 'cement-board-osb');
  assert.equal(restored.parapetInnerAssemblyId, 'cement-board-direct');
});

test('extensão da cumeeira em níveis exige duas faces e sobrevive ao salvamento', () => {
  const project = createProject('light_steel_frame');
  project.floors[0].roofs.push({
    id: 'roof-stepped', x1: 0, y1: 0, x2: 100, y2: 100,
    type: 'duasAguas', pitchDeg: 28, ridgeAxis: 'x', steppedWallVolume: true,
    baseHeightM: 3.15, gableFaceAAssemblyId: 'eifs', gableFaceBAssemblyId: 'eifs',
    soffitAssemblyId: 'soffit-cement-board', fasciaAssemblyId: 'cement-board-direct',
  });
  assert.equal(steelFrameSpecificationIssues(project).filter((issue) => issue.kind === 'stepped-wall-face').length, 2);
  project.floors[0].roofs[0].steppedWallFaceAAssemblyId = 'eifs';
  project.floors[0].roofs[0].steppedWallFaceBAssemblyId = 'drywall-st';
  const restored = decodeProjectDocument(encodeProjectDocument(project)).project.floors[0].roofs[0];
  assert.equal(restored.steppedWallFaceAAssemblyId, 'eifs');
  assert.equal(restored.steppedWallFaceBAssemblyId, 'drywall-st');
});
