import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION } from '../src/core/ProjectPersistence.ts';
import { buildColdWaterNetworkFromFixtures, buildGuidedColdWaterHeaderRoute, createPositionedHydraulicFixture } from '../src/core/Hydraulics.ts';

// Scene3DRenderer.ts / ViewportController.ts / Store.ts não são todos
// importáveis direto (Scene3DRenderer depende de Three.js/DOM em tempo de
// carga) — testados por busca de texto, mesma técnica já usada em outros
// testes deste módulo (ver hydraulics.test.mjs, linhas 115-127).
const sceneSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `marcador de início não encontrado: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `marcador de fim não encontrado: ${endMarker}`);
  return source.slice(start, end);
}

// Pedido do Product Owner: "quero a opção de arrastar a caixa de água sem
// que ela se desconecte dos canos." Antes desta mudança a caixa (nó
// kind:'source') não era arrastável — nem clicável — porque era desenhada
// como um THREE.Group (corpo+tampa aninhados), e pickMesh (abaixo) só
// enxerga filhos DIRETOS de scene com `.isMesh === true`: um Group nunca
// seria encontrado, mesmo marcado hydraulicEditable. A correção troca o
// Group por duas malhas soltas (mesma técnica já usada pelo marcador +
// etiqueta de uma fixture selecionada).
test('a caixa d\'água é renderizada como duas malhas soltas (corpo+tampa), cada uma marcada hydraulicEditable — não um THREE.Group', () => {
  const body = slice(sceneSource, "function renderHydraulics(", "\n  function renderDrawPreview(");
  assert.doesNotMatch(body, /new THREE\.Group\(\)/);
  assert.match(body, /node\.kind === 'source' && node\.networkType === 'cold_water'/);
  const pieceCount = (body.match(/piece\.userData\.hydraulicEditable = true;/g) || []).length;
  assert.equal(pieceCount, 1, 'esperava UM laço aplicando hydraulicEditable=true às peças da caixa (corpo+tampa, via forEach)');
  assert.match(body, /\[body, lid\]\.forEach/);
});

test('a esfera-marcador genérica é pulada para a origem de água fria — ela duplicaria o mesmo ponto sem hydraulicEditable e podia "roubar" o raycast do clique', () => {
  const body = slice(sceneSource, "function renderHydraulics(", "\n  function renderDrawPreview(");
  assert.match(body, /if \(!\(node\.kind === 'source' && node\.networkType === 'cold_water'\)\) \{/);
});

test('pickMesh só enxerga filhos diretos de scene com .isMesh — documentado no próprio código como a razão de não usar THREE.Group', () => {
  assert.match(vpSource, /function pickMesh\(clientX: any, clientY: any\) \{/);
  assert.match(vpSource, /o\.isMesh && o\.userData && o\.userData\.category/);
});

// ViewportController: clique na caixa arma um arraste livre no plano
// (dragMode 'hydraulicSourceBody'), igual ponto de piso — sem grid, sem
// parede — e move só os objetos visuais durante o gesto (a posição só é
// gravada no Store ao soltar, mesmo padrão de performance já usado por
// hydraulicJunctionBody/glazingPanelBody/volumeBoxBody).
test('clicar na caixa d\'água arma dragMode hydraulicSourceBody', () => {
  assert.match(vpSource, /if \(hydraulicEntity\.kind === 'source'\) \{/);
  assert.match(vpSource, /dragMode = 'hydraulicSourceBody';/);
});

test('arraste da caixa d\'água move só os objetos visuais a cada pointermove (sem tocar o Store)', () => {
  const body = slice(vpSource, "if (dragMode === 'hydraulicSourceBody') {", "if (dragMode && dragMode.indexOf('glazingWidth') === 0) {");
  assert.match(body, /hydraulicFixtureDragObjects\.forEach/);
  assert.doesNotMatch(body, /Store\.commands\./);
});

test('soltar o mouse commita a nova posição via updateHydraulicSourceBodyLive e força um render completo (a rede foi inteiramente regenerada)', () => {
  const body = slice(vpSource, "if (dragMode === 'hydraulicSourceBody') {", "if (dragMode === 'columnBody') {");
  assert.match(body, /Store\.commands\.updateHydraulicSourceBodyLive\(selectedHydraulicNodeId, dragElementStart\.lastX, dragElementStart\.lastY\);/);
  assert.match(body, /render\(\);/);
});

// Store: mover a caixa regenera o traçado ingênuo (não-guiado) da rede —
// sem isso os canos já traçados ficariam presos na posição antiga da
// caixa. Percursos guiados manualmente (H2) são preservados por
// buildColdWaterNetworkFromFixtures, não por este comando.
test('updateHydraulicSourceBodyLive só mexe em nós kind:source e sempre regenera a rede', () => {
  const body = slice(storeSource, 'updateHydraulicSourceBodyLive(nodeId: string, x: number, y: number) {', 'flipHydraulicFixtureFace(nodeId: string): void {');
  assert.match(body, /if \(!node \|\| node\.kind !== 'source'\) return null;/);
  assert.match(body, /project\.hydraulics = buildColdWaterNetworkFromFixtures\(project\.floors, project\.hydraulics\);/);
  assert.doesNotMatch(body, /pushUndoSnapshot\(\)/, 'não deve empilhar undo aqui — beginTransaction() já fez isso no pointerdown (mesmo padrão de updateHydraulicFixtureBodyLive)');
});

// O bug de fundo que motivou tudo isso: antes desta sessão,
// buildColdWaterNetworkFromFixtures tratava QUALQUER nó com
// ownerFixtureId como "já roteado, nunca sobrescrever" — sem distinguir
// um percurso desenhado à mão (H2) de um traçado ingênuo de uma geração
// automática ANTERIOR. Resultado: mover a caixa (ou até arrastar a
// própria fixture) não re-roteava nada depois da primeira geração — os
// canos ficavam presos na posição antiga. A flag `guided` resolve isso.
test('rota guiada manualmente (H2) nasce marcada guided:true em nós e segmentos', () => {
  const source = { id: 'src', x: 0, y: 0, elevationM: 3.2, floorIndex: 0 };
  const fixture = { id: 'fix', kind: 'fixture', networkType: 'cold_water', label: 'Chuveiro', x: 100, y: 60, elevationM: 2.1, floorIndex: 0 };
  const route = buildGuidedColdWaterHeaderRoute(source, fixture, [{ x: 100, y: 0 }], 'fix');
  assert.ok(route.nodes.length > 0);
  assert.ok(route.nodes.every((node) => node.guided === true));
  assert.ok(route.segments.length > 0);
  assert.ok(route.segments.every((segment) => segment.guided === true));
});

test('mover a origem regenera o traçado ingênuo de uma fixture já roteada — não fica preso na posição da primeira geração (o bug corrigido nesta sessão)', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0 };
  const fixture = createPositionedHydraulicFixture('kitchen_faucet', 50, 0, wall);
  fixture.floorIndex = 0;
  const floors = [{ id: 'f0', name: 'Térreo', walls: [wall], openings: [], columns: [], roofs: [], varandas: [], lajes: [], furniture: [] }];

  // primeira geração, origem em (0,0)
  const first = buildColdWaterNetworkFromFixtures(floors, { nodes: [fixture], segments: [] });
  const firstSource = first.nodes.find((node) => node.kind === 'source');
  assert.equal(firstSource.y, 0);
  const firstJunctionY = first.nodes.find((node) => node.ownerFixtureId === fixture.id && node.label === 'Distribuição superior').y;
  assert.equal(firstJunctionY, firstSource.y);

  // move só a origem, chama de novo — como updateHydraulicSourceBodyLive faz
  const movedSource = { ...firstSource, y: 300 };
  const second = buildColdWaterNetworkFromFixtures(floors, { nodes: first.nodes.map((node) => (node.id === movedSource.id ? movedSource : node)), segments: first.segments });
  const secondJunctionY = second.nodes.find((node) => node.ownerFixtureId === fixture.id && node.label === 'Distribuição superior').y;
  assert.equal(secondJunctionY, 300, 'o trecho ingênuo devia ter acompanhado a nova posição da origem, não ficado em 0');
});

test('mover a origem NUNCA regenera um percurso guiado manualmente — o trecho H2 sobrevive intacto', () => {
  const wall = { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0 };
  const fixture = createPositionedHydraulicFixture('shower', 50, 0, wall);
  fixture.floorIndex = 0;
  const source = { id: 'tank', kind: 'source', networkType: 'cold_water', label: "Caixa d'água", x: 0, y: 0, elevationM: 3.35, floorIndex: 0 };
  const guided = buildGuidedColdWaterHeaderRoute(source, fixture, [{ x: 40, y: 20 }], fixture.id);
  const floors = [{ id: 'f0', name: 'Térreo', walls: [wall], openings: [], columns: [], roofs: [], varandas: [], lajes: [], furniture: [] }];
  const existing = { nodes: [fixture, source, ...guided.nodes], segments: [...guided.segments] };

  const movedSource = { ...source, y: 500 };
  const regenerated = buildColdWaterNetworkFromFixtures(floors, { nodes: existing.nodes.map((node) => (node.id === movedSource.id ? movedSource : node)), segments: existing.segments });

  const survivingIds = regenerated.nodes.filter((node) => node.ownerFixtureId === fixture.id).map((node) => node.id).sort();
  const guidedIds = guided.nodes.map((node) => node.id).sort();
  assert.deepEqual(survivingIds, guidedIds, 'os mesmos nós guiados (mesmos ids) devem sobreviver, sem regenerar');
  const waypoint = regenerated.nodes.find((node) => node.id === guided.nodes[0].id);
  assert.deepEqual({ x: waypoint.x, y: waypoint.y }, { x: 40, y: 20 }, 'a posição desenhada à mão não muda quando a origem se move');
});

test('persistência: schemaVersion 9 grava e lê guided:true em nó e segmento hidráulico, e documentos antigos (sem o campo) continuam abrindo', () => {
  assert.equal(CURRENT_PROJECT_SCHEMA_VERSION, 9);
  const project = createProject();
  project.hydraulics.nodes.push(
    { id: 'src', kind: 'source', networkType: 'cold_water', label: "Caixa d'água", x: 0, y: 0, elevationM: 3.35 },
    { id: 'fix', kind: 'fixture', networkType: 'cold_water', label: 'Chuveiro', x: 100, y: 60, elevationM: 2.1, fixtureType: 'shower' },
    { id: 'wp', kind: 'junction', networkType: 'cold_water', label: 'Ponto-guia', x: 40, y: 0, elevationM: 3.35, ownerFixtureId: 'fix', guided: true },
  );
  project.hydraulics.segments.push({ id: 'seg', networkType: 'cold_water', startNodeId: 'src', endNodeId: 'wp', diameterMm: 20, ownerFixtureId: 'fix', guided: true });
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  const waypoint = decoded.project.hydraulics.nodes.find((node) => node.id === 'wp');
  const segment = decoded.project.hydraulics.segments.find((item) => item.id === 'seg');
  assert.equal(waypoint.guided, true);
  assert.equal(segment.guided, true);

  // documento v8 (schemaVersion anterior), sem o campo `guided` — abre normal, sem quebrar.
  const legacyDoc = { schemaVersion: 8, project: { ...structuredClone(project) } };
  delete legacyDoc.project.hydraulics.nodes.find((node) => node.id === 'wp').guided;
  delete legacyDoc.project.hydraulics.segments.find((segment) => segment.id === 'seg').guided;
  const decodedLegacy = decodeProjectDocument(legacyDoc);
  assert.equal(decodedLegacy.project.hydraulics.nodes.find((node) => node.id === 'wp').guided, undefined);
});
