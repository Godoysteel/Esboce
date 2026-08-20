import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createProject } from '../src/core/Core.ts';
import {
  buildColdWaterNetworkFromFixtures,
  buildDestinationNetworkFromFixtures,
  buildGuidedHydraulicRoute,
  classifyHydraulicJunction,
  createPositionedHydraulicFixture,
  destinationLabelForNetwork,
  hydraulicFixtureTemplate,
  removeGuidedRouteForFixture,
} from '../src/core/Hydraulics.ts';

// Store.ts/MaterialsPanel.ts/Scene3DRenderer.ts/ViewportController.ts não
// são importáveis direto pelo test runner nativo (mesma limitação já
// documentada nos outros testes de hidráulica) — cobertos por busca de
// texto sobre o arquivo fonte.
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeWall(id, x1, y1, x2, y2) { return { id, x1, y1, x2, y2 }; }
function makeFloor(walls) {
  return { id: 'f0', name: 'Térreo', walls, openings: [], columns: [], roofs: [], varandas: [], lajes: [], furniture: [] };
}

test('template de captação pluvial existe, com superfície de parede e diâmetro comercial (Tigre Aquapluv, mínimo técnico 70mm)', () => {
  const template = hydraulicFixtureTemplate('rainwater_intake');
  assert.ok(template);
  assert.equal(template.networkType, 'rainwater');
  assert.equal(template.placementSurface, 'wall');
  assert.equal(template.diameterMm, 75);
});

test('destinationLabelForNetwork nomeia cada tipo com a estrutura certa da NBR 8160/10844', () => {
  assert.equal(destinationLabelForNetwork('kitchen_sewer'), 'Caixa de gordura');
  assert.equal(destinationLabelForNetwork('sanitary_sewer'), 'Caixa de inspeção');
  assert.equal(destinationLabelForNetwork('rainwater'), 'Caixa de saída pluvial');
});

test('buildDestinationNetworkFromFixtures gera um destino único no chão e roteia cada ponto até ele, sem inclinação nenhuma (elevação nunca muda junto com x/y)', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const waste = createPositionedHydraulicFixture('kitchen_sink_waste', 50, 0, wall);
  waste.floorIndex = 0;
  const floors = [makeFloor([wall])];
  const system = buildDestinationNetworkFromFixtures('kitchen_sewer', floors, { nodes: [waste], segments: [] });
  const destination = system.nodes.find((node) => node.kind === 'destination');
  assert.ok(destination);
  assert.equal(destination.networkType, 'kitchen_sewer');
  assert.equal(destination.label, 'Caixa de gordura');
  assert.ok(system.segments.length >= 2);
  // sem inclinação: a elevação nunca muda no mesmo trecho em que x ou y mudam
  // (a queda/subida é sempre um trecho vertical isolado). Mudar x E y juntos
  // no mesmo trecho horizontal É esperado agora — é o corte de 45° (ver teste
  // "corte de 45°" abaixo) — só a cota que precisa continuar exclusiva.
  system.segments.forEach((segment) => {
    const start = system.nodes.find((node) => node.id === segment.startNodeId);
    const end = system.nodes.find((node) => node.id === segment.endNodeId);
    const elevationChanged = start.elevationM !== end.elevationM || (start.floorIndex || 0) !== (end.floorIndex || 0);
    const planeChanged = start.x !== end.x || start.y !== end.y;
    assert.ok(!(elevationChanged && planeChanged), 'trecho não pode misturar queda/subida com deslocamento no plano — isso seria inclinação');
  });
});

test('corte de 45° (NBR 8160 §4.2.5.1): canto horizontal do traçado automático de esgoto/pluvial vira duas curvas de 45° em vez de um cotovelo de 90°, quando a fixture não está alinhada com a caixa', () => {
  // Sala 5x5m (100x100 unidades de grid) — caixa nasce fora, na borda leste,
  // na METADE da altura (y=50) — uma fixture na parede oeste (y=0) força um
  // desvio horizontal real nos dois eixos (dx e dy não-nulos).
  const walls = [
    makeWall('w1', 0, 0, 100, 0), makeWall('w2', 100, 0, 100, 100),
    makeWall('w3', 100, 100, 0, 100), makeWall('w4', 0, 100, 0, 0),
  ];
  const waste = createPositionedHydraulicFixture('bathroom_sink_waste', 30, 0, walls[0]);
  waste.floorIndex = 0;
  const floors = [makeFloor(walls)];
  const system = buildDestinationNetworkFromFixtures('sanitary_sewer', floors, { nodes: [waste], segments: [] });
  const destination = system.nodes.find((node) => node.kind === 'destination');
  assert.ok(destination);
  // duas curvas de 45° no lugar do único cotovelo de 90° antigo
  const cornerNodes = system.nodes.filter((node) => node.ownerFixtureId === waste.id && node.label.startsWith('Curva 45°'));
  assert.equal(cornerNodes.length, 2);
  cornerNodes.forEach((node) => assert.equal(classifyHydraulicJunction(system, node.id), 'elbow45'));
  // exatamente um trecho diagonal (muda x E y, mesma cota) entre as duas curvas
  const diagonalSegments = system.segments.filter((segment) => {
    const start = system.nodes.find((node) => node.id === segment.startNodeId);
    const end = system.nodes.find((node) => node.id === segment.endNodeId);
    return start.x !== end.x && start.y !== end.y && start.elevationM === end.elevationM;
  });
  assert.equal(diagonalSegments.length, 1);
  // a transição horizontal→vertical (entrada na queda) continua 90°, como antes
  const verticalDrop = system.nodes.find((node) => node.ownerFixtureId === waste.id && node.label === 'Chegada na caixa');
  assert.ok(verticalDrop);
  assert.equal(classifyHydraulicJunction(system, verticalDrop.id), 'elbow90');
});

test('água fria (pressurizada) não ganha o corte de 45° — continua com cotovelo de 90°, mesmo quando a fixture não está alinhada com a caixa d\'água', () => {
  const walls = [
    makeWall('w1', 0, 0, 100, 0), makeWall('w2', 100, 0, 100, 100),
    makeWall('w3', 100, 100, 0, 100), makeWall('w4', 0, 100, 0, 0),
  ];
  const point = createPositionedHydraulicFixture('kitchen_faucet', 30, 0, walls[0]);
  point.floorIndex = 0;
  const floors = [makeFloor(walls)];
  const system = buildColdWaterNetworkFromFixtures(floors, { nodes: [point], segments: [] });
  const cornerNodes = system.nodes.filter((node) => node.ownerFixtureId === point.id && node.label.startsWith('Curva 45°'));
  assert.equal(cornerNodes.length, 0, 'água fria não segue a exigência de 45° da NBR 8160 (é rede pressurizada, NBR 5626)');
});

test('buildDestinationNetworkFromFixtures reaproveita o mesmo destino (mesmo id) ao regenerar — trecho guiado nunca fica órfão', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const waste = createPositionedHydraulicFixture('toilet_waste', 50, 0, wall);
  waste.floorIndex = 0;
  const floors = [makeFloor([wall])];
  const first = buildDestinationNetworkFromFixtures('sanitary_sewer', floors, { nodes: [waste], segments: [] });
  const firstDestination = first.nodes.find((node) => node.kind === 'destination');
  const moved = { ...firstDestination, x: firstDestination.x + 500 };
  const second = buildDestinationNetworkFromFixtures('sanitary_sewer', floors, {
    nodes: first.nodes.map((node) => (node.id === moved.id ? moved : node)),
    segments: first.segments,
  });
  const secondDestination = second.nodes.find((node) => node.kind === 'destination');
  assert.equal(secondDestination.id, firstDestination.id);
  assert.equal(secondDestination.x, moved.x);
});

test('buildDestinationNetworkFromFixtures preserva percurso guiado manualmente (H2) em vez de regenerar o traçado ingênuo', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const waste = createPositionedHydraulicFixture('bathroom_sink_waste', 50, 0, wall);
  waste.floorIndex = 0;
  const destination = { id: 'dest', x: 200, y: 0, elevationM: 0.05, floorIndex: 0 };
  const guided = buildGuidedHydraulicRoute('sanitary_sewer', 'destination', destination, waste, [{ x: 80, y: 40 }], waste.id);
  const floors = [makeFloor([wall])];
  const existing = {
    nodes: [waste, { ...destination, kind: 'destination', networkType: 'sanitary_sewer', label: 'Caixa de inspeção' }, ...guided.nodes],
    segments: [...guided.segments],
  };
  const regenerated = buildDestinationNetworkFromFixtures('sanitary_sewer', floors, existing);
  const survivingIds = regenerated.nodes.filter((node) => node.ownerFixtureId === waste.id).map((node) => node.id).sort();
  const guidedIds = guided.nodes.map((node) => node.id).sort();
  assert.deepEqual(survivingIds, guidedIds);
  assert.ok(regenerated.segments.filter((segment) => segment.ownerFixtureId === waste.id).every((segment) => segment.guided === true));
});

test('gerar a rede de um networkType nunca apaga nós/segmentos de outro tipo já existentes (o bug que existiria sem o filtro por networkType)', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const waterFixture = createPositionedHydraulicFixture('kitchen_faucet', 30, 0, wall);
  waterFixture.floorIndex = 0;
  const sewerFixture = createPositionedHydraulicFixture('toilet_waste', 70, 0, wall);
  sewerFixture.floorIndex = 0;
  const floors = [makeFloor([wall])];
  // gera água fria primeiro
  const afterWater = buildColdWaterNetworkFromFixtures(floors, { nodes: [waterFixture, sewerFixture], segments: [] });
  assert.ok(afterWater.nodes.some((node) => node.kind === 'source' && node.networkType === 'cold_water'));
  // gera esgoto sanitário depois — a rede de água fria (fonte, junções, segmentos) deve continuar intacta
  const afterSewer = buildDestinationNetworkFromFixtures('sanitary_sewer', floors, afterWater);
  const waterSource = afterSewer.nodes.find((node) => node.kind === 'source' && node.networkType === 'cold_water');
  assert.ok(waterSource, 'a origem de água fria não pode desaparecer ao gerar a rede de esgoto');
  const waterSegments = afterSewer.segments.filter((segment) => segment.networkType === 'cold_water');
  assert.ok(waterSegments.length >= 2, 'os canos de água fria não podem ser apagados ao gerar a rede de esgoto');
  const sewerDestination = afterSewer.nodes.find((node) => node.kind === 'destination' && node.networkType === 'sanitary_sewer');
  assert.ok(sewerDestination, 'o destino de esgoto sanitário devia ter sido criado');
});

test('regenerar água fria depois de já ter esgoto/pluvial gerado também preserva as outras redes (mesmo bug, direção oposta)', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const rainFixture = createPositionedHydraulicFixture('rainwater_intake', 20, 0, wall);
  rainFixture.floorIndex = 0;
  const waterFixture = createPositionedHydraulicFixture('shower', 60, 0, wall);
  waterFixture.floorIndex = 0;
  const floors = [makeFloor([wall])];
  const afterRain = buildDestinationNetworkFromFixtures('rainwater', floors, { nodes: [rainFixture, waterFixture], segments: [] });
  const afterWater = buildColdWaterNetworkFromFixtures(floors, afterRain);
  const rainDestination = afterWater.nodes.find((node) => node.kind === 'destination' && node.networkType === 'rainwater');
  assert.ok(rainDestination, 'a caixa de saída pluvial não pode desaparecer ao gerar água fria');
  const rainSegments = afterWater.segments.filter((segment) => segment.networkType === 'rainwater');
  assert.ok(rainSegments.length >= 2);
});

test('buildDestinationNetworkFromFixtures sem nenhum ponto do tipo não cria destino nenhum, e preserva outros tipos intactos', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const waterFixture = createPositionedHydraulicFixture('kitchen_faucet', 30, 0, wall);
  waterFixture.floorIndex = 0;
  const floors = [makeFloor([wall])];
  const afterWater = buildColdWaterNetworkFromFixtures(floors, { nodes: [waterFixture], segments: [] });
  const result = buildDestinationNetworkFromFixtures('rainwater', floors, afterWater);
  assert.ok(!result.nodes.some((node) => node.networkType === 'rainwater'));
  assert.ok(result.nodes.some((node) => node.kind === 'source' && node.networkType === 'cold_water'), 'água fria continua intacta');
});

test('removeGuidedRouteForFixture funciona igual pra esgoto/pluvial (já era genérico, sem mudança precisa)', () => {
  const wall = makeWall('w', 0, 0, 100, 0);
  const waste = createPositionedHydraulicFixture('shower_drain', 50, 0, wall);
  const destination = { id: 'dest', x: 200, y: 0, elevationM: 0.05, floorIndex: 0 };
  const guided = buildGuidedHydraulicRoute('sanitary_sewer', 'destination', destination, waste, [{ x: 80, y: 40 }], waste.id);
  const system = { nodes: [waste, ...guided.nodes], segments: guided.segments };
  const cleared = removeGuidedRouteForFixture(system, waste.id);
  assert.equal(cleared.nodes.length, 1);
  assert.equal(cleared.segments.length, 0);
});

test('Store: generateSewerAndRainwaterNetwork gera as 3 redes de ponto fixo no chão, botão separado do de água fria', () => {
  const body = storeSource.slice(storeSource.indexOf('generateSewerAndRainwaterNetwork(): boolean {'), storeSource.indexOf('setGuidedHydraulicRoute('));
  assert.match(body, /'kitchen_sewer', 'sanitary_sewer', 'rainwater'/);
  assert.match(body, /buildDestinationNetworkFromFixtures\(type, project\.floors, project\.hydraulics\)/);
});

test('Store: setGuidedHydraulicRoute detecta o networkType do próprio fixture (source pra água fria, destination pros demais)', () => {
  const start = storeSource.indexOf('setGuidedHydraulicRoute(fixtureId: string');
  assert.notEqual(start, -1);
  const body = storeSource.slice(start, storeSource.indexOf('moveHydraulicJunction('));
  assert.match(body, /networkType === 'cold_water' \? 'source' : 'destination'/);
});

test('Store: updateHydraulicDestinationBodyLive existe e só regenera a rede DAQUELE networkType', () => {
  const start = storeSource.indexOf('updateHydraulicDestinationBodyLive(nodeId: string');
  assert.notEqual(start, -1);
  const body = storeSource.slice(start, storeSource.indexOf('flipHydraulicFixtureFace('));
  assert.match(body, /if \(!node \|\| node\.kind !== 'destination'\) return null;/);
  assert.match(body, /buildDestinationNetworkFromFixtures\(node\.networkType, project\.floors, project\.hydraulics\)/);
});

test('Scene3DRenderer: destino de esgoto/pluvial ganha malha de caixa própria (arrastável), cor por networkType inclui pluvial', () => {
  assert.match(sceneSource, /if \(networkType === 'rainwater'\) return 0x0d9488;/);
  const body = sceneSource.slice(sceneSource.indexOf("if (node.kind === 'destination') {"), sceneSource.indexOf("    });\n  }\n\n  // Retângulo"));
  assert.match(body, /BoxGeometry/);
  assert.match(body, /hydraulicEditable = true;/);
});

test('index.html: botão de captação pluvial existe nos dois painéis de Hidráulica (categoria e legado)', () => {
  const matches = indexHtml.match(/data-tool="hydraulic:rainwater_intake"/g) || [];
  assert.equal(matches.length, 2, 'esperava o botão nos dois blocos, mesmo padrão dos outros 10 já existentes');
});

test('quantitativo: esgoto/pluvial vira item por item em MaterialsPanel.ts (tubo por diâmetro em barra, conexão por diâmetro+tipo) — pedido explícito do Product Owner pra lista dar pra levar na loja', () => {
  assert.match(materialsSource, /HYDRAULIC_PIPE_BAR_PRICE/);
  assert.match(materialsSource, /HYDRAULIC_FITTING_PRICE/);
  assert.match(materialsSource, /HYDRAULIC_PIPE_BAR_LENGTH_M/);
  assert.match(materialsSource, /hydraulicDestinationBoxUnit/);
  // cada grupo de tubo vira uma linha "Tubo PVC <linha> <diâmetro>mm (barra Xm)"
  assert.match(materialsSource, /'Tubo PVC ' \+ HYDRAULIC_PRODUCT_LINE_LABEL\[group\.productLine\]/);
  // cada grupo de conexão vira uma linha "Joelho/Tê/Cruzeta PVC <linha> <diâmetro>mm"
  assert.match(materialsSource, /HYDRAULIC_FITTING_KIND_LABEL\[group\.kind\]/);
});

test('quantitativo: barra de tubo é 6m e arredonda pra cima (mesma lógica de sacos de cimento/latas de tinta — não dá pra comprar fração)', () => {
  const wall = makeWall('w', 0, 0, 200, 0);
  const pia = createPositionedHydraulicFixture('kitchen_sink_waste', 100, 0, wall);
  pia.floorIndex = 0;
  const floors = [makeFloor([wall])];
  const system = buildDestinationNetworkFromFixtures('kitchen_sewer', floors, { nodes: [pia], segments: [] });
  const totalM = system.segments.filter((s) => s.networkType === 'kitchen_sewer').reduce((sum, segment) => {
    const start = system.nodes.find((n) => n.id === segment.startNodeId);
    const end = system.nodes.find((n) => n.id === segment.endNodeId);
    const dx = (end.x - start.x) / 20, dy = (end.y - start.y) / 20;
    const dz = (end.elevationM - start.elevationM);
    return sum + Math.hypot(dx, dy, dz);
  }, 0);
  const expectedBars = Math.ceil(totalM / 6);
  assert.ok(expectedBars >= 1);
});
