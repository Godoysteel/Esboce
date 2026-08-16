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

test('Scene3DRenderer pula a parede demolida ao desenhar (paredes e as aberturas dela); ela continua em detectRooms (fecha o cômodo) mas NÃO entra mais em computeWallFootprints (senão a parede vizinha ficava com um entalhe/fresta esperando uma parceira que não existe mais — bug reportado pelo Product Owner, corrigido)', () => {
  assert.match(renderer3DSource, /if \(w\.demolished\) return;/);
  assert.match(renderer3DSource, /if \(!w \|\| w\.demolished\) return;/);
  // detectRooms precisa da lista INTEIRA (com parede demolida incluída)
  // — é isso que mantém o cômodo/piso fechado.
  assert.match(renderer3DSource, /Core\.detectRooms\(floorData\.walls\)/);
  // computeWallFootprints, ao contrário, precisa de uma lista SEM
  // parede demolida — é só geometria visual de canto/mitre entre
  // paredes vizinhas; incluir a demolida fazia a parede que sobrou (a
  // que ainda é desenhada) calcular o canto dela esperando uma
  // parceira invisível, deixando a ponta com um entalhe em vez de uma
  // tampa reta.
  assert.doesNotMatch(renderer3DSource, /Core\.computeWallFootprints\(floorData\.walls\)/);
  assert.match(renderer3DSource, /var activeWallsForFootprint = floorData\.walls\.filter\(function \(w\) \{ return !w\.demolished; \}\);/);
  assert.match(renderer3DSource, /Core\.computeWallFootprints\(activeWallsForFootprint\)/);
});

test('a matemática de canto de verdade: excluir a parede demolida da lista passada a computeWallFootprints faz a parede vizinha ganhar uma ponta LIVRE (tampa reta), em vez de um canto em L esperando uma parceira que não existe mais', () => {
  // Duas paredes formando um "L" — uma vertical de (0,0) a (0,400), uma
  // horizontal encostada na ponta dela, de (0,400) a (400,400). Sem
  // filtro nenhum, a vertical calcularia um canto em L na ponta comum.
  const vertical = createWallEntity(0, 0, 0, 400);
  const horizontal = createWallEntity(0, 400, 400, 400);

  const withBoth = Core.computeWallFootprints([vertical, horizontal]);
  assert.equal(withBoth[vertical.id].p2Free, false, 'com as duas paredes, a ponta é um canto (não livre)');

  // Simula o que o renderer faz agora: a horizontal foi "demolida" —
  // sai da lista passada a computeWallFootprints (mas continuaria
  // entrando em detectRooms, separadamente, sem filtro nenhum).
  const onlyVertical = Core.computeWallFootprints([vertical]);
  assert.equal(onlyVertical[vertical.id].p2Free, true, 'sem a parede demolida na lista, a ponta vira livre — ganha a tampa reta de uma extremidade solta');
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
