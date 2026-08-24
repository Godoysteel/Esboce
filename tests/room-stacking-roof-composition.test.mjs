import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('pavimentos saem da experiência e cômodo ganha ação de subir', () => {
  assert.match(html, /class="tb-overflow floor-menu tb-pill" hidden aria-hidden="true"/);
  assert.match(html, /data-action="raiseRoom"/);
  assert.match(store, /raiseRoom\(wallIds: string\[\]\): Wall\[\] \| null/);
});

test('subir move as mesmas paredes, sem criar cópia, e gera a laje de base', () => {
  assert.match(store, /source\.walls = source\.walls\.filter\(\(wall\) => !selectedIds\.has\(wall\.id\)\)/);
  assert.match(store, /target\.walls\.push\(\.\.\.selected\)/);
  assert.doesNotMatch(store.slice(store.indexOf('raiseRoom('), store.indexOf('moveWallEndpoint', store.indexOf('raiseRoom('))), /Core\.nextId\('wall'\)/);
  assert.match(store, /target\.roomBaseLajeGenerated\[roomKey\] = true/);
  assert.match(viewport, /Store\.commands\.setCurrentFloor\(mesh\.userData\.floorIndex\)/);
});

test('cômodo desenhado diretamente em nível superior nasce com laje de base', () => {
  const command = store.slice(store.indexOf('createRoom('), store.indexOf('raiseRoom('));
  assert.match(command, /if \(project\.currentFloorIndex > 0\)/);
  assert.match(command, /floor\.roomBaseLajeGenerated\[roomKey\] = true/);
});

test('gerar ático preserva o tipo de cobertura escolhido', () => {
  const createRoof = store.slice(store.indexOf('createRoof('), store.indexOf('fuseRoofs('));
  const generateAttic = store.slice(store.indexOf('generateAttic('), store.indexOf('configureCurrentFloor('));
  assert.doesNotMatch(createRoof, /attic \? 'duasAguas'/);
  assert.doesNotMatch(generateAttic, /r\.type = 'duasAguas'/);
});

test('a laje automática do cômodo elevado é desenhada na base', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /hasBaseLaje = !!\(floorData\.roomBaseLajeGenerated \|\| \{\}\)\[roomKey\]/);
  assert.match(renderer, /hasBaseLaje[\s\S]*?buildAutoLajePiece\(lajeShape, lajeSizeX, lajeSizeZ, yOffset - LAJE_THICKNESS,/);
  assert.match(renderer, /var FLOOR_STACK_HEIGHT = WALL_HEIGHT \+ LAJE_THICKNESS/);
});

test('selecionar um cômodo inferior mantém todos os níveis superiores visíveis', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const floorsLoop = renderer.slice(renderer.indexOf('project.floors.forEach(function (floorData, floorIdx)'), renderer.indexOf('var yOffset = floorIdx * FLOOR_STACK_HEIGHT'));
  assert.doesNotMatch(floorsLoop, /if \(floorIdx > editingIdx\)/);
  assert.match(renderer, /var topFloorIdx = project\.floors\.length - 1/);
});

test('caixa de visualização permite esconder níveis superiores sob demanda', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const layersPanel = readFileSync(new URL('../src/core/LayersPanel.ts', import.meta.url), 'utf8');
  assert.match(html, /id="niveisSuperioresToggle" checked> Mostrar níveis superiores/);
  assert.match(layersPanel, /bind\('niveisSuperioresToggle', 'niveisSuperiores'\)/);
  assert.match(renderer, /if \(!layers\.niveisSuperiores && floorIdx > editingIdx\) return/);
});

test('Gerar laje ignora cômodos que já têm laje automática de base', () => {
  assert.match(html, /id="generateLajeBtn" title="Gera laje somente nos cômodos que ainda não possuem laje"/);
  const command = store.slice(store.indexOf('generateLajeForCurrentFloor(): void'), store.indexOf('generateForroDrywallForCurrentFloor'));
  assert.match(command, /f\.roomLajeGenerated!\[roomKey\] \|\| \(f\.roomBaseLajeGenerated \|\| \{\}\)\[roomKey\]/);
  assert.match(command, /if \(!roomKeys\.length\)[\s\S]*?skippedExisting: true/);
});

test('encontros transversais de coberturas são compostos sem botão manual', () => {
  assert.doesNotMatch(html, /button class="roof-commit"/);
  assert.match(html, /Encontro automático/);
  assert.match(store, /function autoComposeCurrentRoofs\(\): string\[\]\[\]/);
  assert.match(store, /candidate\.ridgeAxis === roof\.ridgeAxis/);
  assert.match(store, /Core\.rectsNearby\(roof, candidate, Core\.SNAP_UNIT\)/);
  assert.match(store, /autoComposeCurrentRoofs\(\);\s*emit\(\{ type: 'RoofCreated'/);
});
