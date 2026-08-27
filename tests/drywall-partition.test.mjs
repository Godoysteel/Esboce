import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { detectRooms, wallIsInteriorPartition } from '../src/core/Core.ts';

// Mesma limitação/técnica do resto da suíte (ver materials-coverage.test.mjs):
// MaterialsPanel.ts não é importável direto pelo test runner nativo do Node
// (arrasta Scene3DRenderer -> THREE, que não roda fora do navegador) —
// testado por busca de texto. Core.ts (wallIsInteriorPartition, testado
// acima) não tem essa limitação e é chamado de verdade.
const materialsSource = await readFile(
  new URL('../src/core/MaterialsPanel.ts', import.meta.url),
  'utf8',
);
const storeSource = await readFile(
  new URL('../src/core/Store.ts', import.meta.url),
  'utf8',
);
const typesSource = await readFile(
  new URL('../src/core/types.ts', import.meta.url),
  'utf8',
);
const steelFrameAssembliesSource = await readFile(
  new URL('../src/core/SteelFrameAssemblies.ts', import.meta.url),
  'utf8',
);

function rectangleWithDivider(width = 80, height = 60, dividerX = 40) {
  return [
    { id: 'bottom', x1: 0, y1: 0, x2: width, y2: 0 },
    { id: 'right', x1: width, y1: 0, x2: width, y2: height },
    { id: 'top', x1: width, y1: height, x2: 0, y2: height },
    { id: 'left', x1: 0, y1: height, x2: 0, y2: 0 },
    { id: 'divider', x1: dividerX, y1: 0, x2: dividerX, y2: height },
  ];
}

test('wallIsInteriorPartition: parede divisória (cômodo fechado dos dois lados) é interna', () => {
  const walls = rectangleWithDivider();
  const rooms = detectRooms(walls);
  assert.equal(rooms.length, 2, 'sanity check — mesmo layout já coberto em wall-geometry.test.mjs');
  const divider = walls.find((w) => w.id === 'divider');
  assert.equal(wallIsInteriorPartition(divider, rooms), true);
});

test('wallIsInteriorPartition: parede de perímetro (um lado é fora da casa) NÃO é interna', () => {
  const walls = rectangleWithDivider();
  const rooms = detectRooms(walls);
  ['bottom', 'right', 'top', 'left'].forEach((id) => {
    const wall = walls.find((w) => w.id === id);
    assert.equal(wallIsInteriorPartition(wall, rooms), false, id + ' tem lado de fora, não devia ser classificada como interna');
  });
});

test('wallIsInteriorPartition: parede solta sem cômodo nenhum dos dois lados NÃO é interna', () => {
  const isolated = { id: 'solta', x1: 0, y1: 0, x2: 40, y2: 0 };
  assert.equal(wallIsInteriorPartition(isolated, []), false);
});

// Do lado do orçamento (MaterialsPanel.ts), não importável direto — mesma
// técnica de busca de texto do resto da suíte.

test('compute() exclui parede com Wall.partitionSystem === "drywall" da alvenaria/estrutura/verga, ANTES de qualquer acúmulo de wallLength/wallAreaNet/pintura', () => {
  const start = materialsSource.indexOf('floor.walls.forEach(function (w) {');
  const end = materialsSource.indexOf('\n    });', start);
  const body = materialsSource.slice(start, end);
  assert.match(body, /if \(w\.demolished\) return;/);
  assert.match(body, /if \(w\.partitionSystem === 'drywall'\) return;/);
  // A ordem importa: o early-return de drywall precisa vir ANTES de
  // totals.wallLength/wallAreaNet serem incrementados, senão a parede
  // ainda contaria parcialmente.
  const demolishedIdx = body.indexOf("if (w.demolished) return;");
  const drywallIdx = body.indexOf("if (w.partitionSystem === 'drywall') return;");
  const wallLengthIdx = body.indexOf('totals.wallLength +=');
  assert.ok(demolishedIdx < drywallIdx && drywallIdx < wallLengthIdx, 'early-returns precisam vir antes do acúmulo em totals');
});

test('compute() não conta verga (reforço de alvenaria) pra abertura cujo hostWall está marcado em drywall', () => {
  const start = materialsSource.indexOf('totals.vergaCount++;');
  const before = materialsSource.slice(Math.max(0, start - 400), start + 100);
  assert.match(before, /if \(!hostWall \|\| hostWall\.partitionSystem !== 'drywall'\) \{/);
});

test('activeWalls (junções/pilaretes embutidos) exclui parede em drywall — não é alvenaria, não leva pilarete embutido', () => {
  assert.match(materialsSource, /const activeWalls = floor\.walls\.filter\(function \(w\) \{ return !w\.demolished && w\.partitionSystem !== 'drywall'; \}\);/);
});

test('drywallPartitionQuantities() não é gated por constructionSystem — roda em qualquer sistema de projeto, ao contrário de steelFrameQuantities()', () => {
  const sfStart = materialsSource.indexOf('function steelFrameQuantities(project: Project)');
  const sfLine = materialsSource.slice(sfStart, materialsSource.indexOf('\n', sfStart + 1) + 80);
  assert.match(sfLine, /if \(project\.constructionSystem !== 'light_steel_frame'\) return \[\];/);

  const dwStart = materialsSource.indexOf('function drywallPartitionQuantities(project: Project)');
  assert.ok(dwStart !== -1, 'drywallPartitionQuantities não encontrada');
  const dwEnd = materialsSource.indexOf('\n}', dwStart);
  const dwBody = materialsSource.slice(dwStart, dwEnd);
  assert.doesNotMatch(dwBody, /if \(project\.constructionSystem/, 'não deveria ter NENHUM gate de constructionSystem');
  assert.match(dwBody, /if \(wall\.demolished \|\| wall\.partitionSystem !== 'drywall'\) return;/);
  assert.match(dwBody, /DRYWALL_PARTITION_STRUCTURE_KG_PER_M2/);
  assert.match(dwBody, /item\.use === 'internal'/, 'restrito às composições internas — nunca uma composição externa (EIFS/Glasroc)');
});

test('render() e buildRows() exibem a seção de drywall SEMPRE (não dentro do bloco condicionado a hasCeramicMasonryEstimate/light_steel_frame)', () => {
  assert.match(materialsSource, /const drywallLines = drywallPartitionQuantities\(Store\.getProject\(\)\);/);
  assert.match(materialsSource, /drywallPartitionQuantities\(Store\.getProject\(\)\)\.forEach\(\(line\) => \{/);
});

test('Wall.partitionSystem é um campo opcional independente de Project.constructionSystem (types.ts)', () => {
  assert.match(typesSource, /partitionSystem\?: 'drywall';/);
});

test('Store.commands.setWallPartitionSystem existe, aceita undefined pra remover, e reaproveita o padrão de undo/emit de setSteelFrameWallSpecification', () => {
  const start = storeSource.indexOf('setWallPartitionSystem(');
  assert.ok(start !== -1);
  const end = storeSource.indexOf('\n  },', start);
  const body = storeSource.slice(start, end);
  assert.match(body, /pushUndoSnapshot\(\);/);
  assert.match(body, /delete wall\.partitionSystem;/);
  assert.match(body, /emit\(\{ type: 'WallPartitionSystemSet', wallId \}\);/);
});

test('drywallPartitionSpecificationIssues roda em QUALQUER sistema de projeto (sem o early-return de light_steel_frame que steelFrameSpecificationIssues tem)', () => {
  const start = steelFrameAssembliesSource.indexOf('export function drywallPartitionSpecificationIssues(project: Project)');
  assert.ok(start !== -1);
  const end = steelFrameAssembliesSource.indexOf('\n}', start);
  const body = steelFrameAssembliesSource.slice(start, end);
  assert.doesNotMatch(body, /if \(project\.constructionSystem/);
  assert.match(body, /wall\.partitionSystem !== 'drywall'/);
});

test('ferramenta de drywall no ViewportController só aplica em parede classificada como interior (Core.wallIsInteriorPartition) e alterna on/off', async () => {
  const vpSource = await readFile(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  assert.match(vpSource, /currentTool === 'drywallPartition'/);
  assert.match(vpSource, /Core\.wallIsInteriorPartition\(drywallWall, drywallRooms\)/);
  assert.match(vpSource, /Store\.commands\.setWallPartitionSystem\(drywallWall\.id, undefined\)/);
  assert.match(vpSource, /partitionSystem: 'drywall', faceAAssemblyId: 'drywall-st', faceBAssemblyId: 'drywall-st'/);
});

test('botão de drywall existe no HTML como tool-btn genérico (data-tool="drywallPartition")', async () => {
  const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /data-tool="drywallPartition"/);
});
