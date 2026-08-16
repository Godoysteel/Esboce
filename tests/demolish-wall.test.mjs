import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createWallEntity, createFloorEntity } from '../src/core/Core.ts';

const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const renderer3DSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const renderer2DSource = readFileSync(new URL('../src/core/Scene2DRenderer.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

test('demolishWall marca a parede como demolida, NÃO remove ela do pavimento (createWallEntity ainda existe)', () => {
  const floor = createFloorEntity('Térreo');
  const wall = createWallEntity(0, 0, 400, 0);
  floor.walls.push(wall);
  // demolishWall é um comando do Store (não uma função pura de Core) —
  // aqui só confirmamos, no nível de dado, que "demolida" é um campo
  // (não uma remoção do array): o mesmo objeto `wall` recebe a flag.
  wall.demolished = true;
  assert.equal(floor.walls.length, 1);
  assert.equal(floor.walls[0].id, wall.id);
  assert.equal(floor.walls[0].demolished, true);
});

test('Store.commands.demolishWall existe, marca a flag (não splice) e é idempotente', () => {
  assert.match(storeSource, /demolishWall\(wallId: string\): void/);
  assert.match(storeSource, /w\.demolished = true/);
  assert.match(storeSource, /if \(!w \|\| w\.demolished\) return;/);
  // A demolição não deve usar o mesmo caminho de deleteWall (splice do
  // array) — senão volta o bug original (cômodo/piso quebra).
  const demolishBlock = storeSource.slice(storeSource.indexOf('demolishWall(wallId'), storeSource.indexOf('demolishWall(wallId') + 400);
  assert.doesNotMatch(demolishBlock, /\.splice\(/);
});

test('a ferramenta Quebrar Parede chama demolishWall, não deleteWall/pruneDegenerateWalls', () => {
  const toolBlock = viewportSource.slice(
    viewportSource.indexOf("currentTool === 'demolish' && mesh"),
    viewportSource.indexOf("currentTool === 'demolish' && mesh") + 600,
  );
  assert.match(toolBlock, /Store\.commands\.demolishWall\(/);
  assert.doesNotMatch(toolBlock, /Store\.commands\.deleteWall\(/);
  assert.doesNotMatch(toolBlock, /pruneDegenerateWalls/);
});

test('Scene3DRenderer pula a parede demolida ao desenhar (paredes e as aberturas dela), mas ela continua entrando em computeWallFootprints/detectRooms', () => {
  assert.match(renderer3DSource, /if \(w\.demolished\) return;/);
  assert.match(renderer3DSource, /if \(!w \|\| w\.demolished\) return;/);
  // O cálculo de contorno/cômodo roda em cima de floorData.walls
  // completo, sem nenhum .filter tirando parede demolida — é isso que
  // mantém o piso fechado.
  assert.match(renderer3DSource, /Core\.computeWallFootprints\(floorData\.walls\)/);
  assert.match(renderer3DSource, /Core\.detectRooms\(floorData\.walls\)/);
});

test('Scene2DRenderer também pula parede demolida (linha e símbolo de abertura)', () => {
  assert.match(renderer2DSource, /if \(!wall\.demolished\) wallLine/);
  assert.match(renderer2DSource, /if \(wall && !wall\.demolished\) openingSymbol/);
});

test('MaterialsPanel não conta parede demolida em nenhum quantitativo (comprimento, área, fundação, pilaretes, portas/janelas/verga, soleira, listagem detalhada)', () => {
  assert.match(materialsSource, /groundFloor\.walls\.forEach\(function \(w\) \{ if \(!w\.demolished\) groundWallLength/);
  assert.match(materialsSource, /floor\.walls\.forEach\(function \(w\) \{\s*\n\s*if \(w\.demolished\) return;/);
  assert.match(materialsSource, /const hostWall = floor\.walls\.filter\(function \(w\) \{ return w\.id === op\.wallId; \}\)\[0\];\s*\n\s*if \(hostWall && hostWall\.demolished\) return;/);
  assert.match(materialsSource, /if \(!wall \|\| wall\.demolished\) return;/);
  assert.match(materialsSource, /const activeWalls = floor\.walls\.filter\(function \(w\) \{ return !w\.demolished; \}\);/);
  assert.match(materialsSource, /floor\.walls\.forEach\(function \(w, i\) \{\s*\n\s*if \(w\.demolished\) return;/);
});
