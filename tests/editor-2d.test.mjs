import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../src/core/Scene2DRenderer.ts', import.meta.url), 'utf8');
const controller = fs.readFileSync(new URL('../src/core/Viewport2DController.ts', import.meta.url), 'utf8');

test('botão 2D está disponível e alterna a área central sem abrir outra janela', () => {
  assert.match(index, /id="viewMode2DBtn"(?![^>]*disabled)/);
  assert.match(index, /id="viewport2D"[^>]*hidden/);
  assert.match(app, /view2DBtn\.addEventListener\('click', \(\) => setViewMode\('2d'\)\)/);
  assert.doesNotMatch(app, /window\.open\([^)]*2D/i);
});

test('renderizador 2D deriva paredes e aberturas do mesmo Store do 3D', () => {
  assert.match(renderer, /Store\.getProject\(\)/);
  assert.match(renderer, /floor\.walls\.forEach/);
  assert.match(renderer, /floor\.openings\.forEach/);
  assert.doesNotMatch(renderer, /Store\.commands\./);
});

test('primeira fase representa pilares, lajes (automáticas por cômodo), terreno, muros e telhados', () => {
  for (const token of ['floor.columns', 'project.terreno', 'terreno.muros', 'floor.roofs']) {
    assert.ok(renderer.includes(token), `representação ausente: ${token}`);
  }
  // Laje deixou de ser floor.lajes (objeto independente) — passou a
  // nascer automática por cômodo fechado, mesmo Core.detectRooms usado
  // pro piso no 3D (ver DEC-35 revista, correção pós-lançamento).
  assert.match(renderer, /Core\.detectRooms\(floor\.walls\)\.forEach/);
  assert.doesNotMatch(renderer, /floor\.lajes\?\.forEach/);
});

test('viewport 2D oferece zoom e pan sem alterar coordenadas durante a navegação', () => {
  assert.match(controller, /addEventListener\('wheel'/);
  assert.match(controller, /addEventListener\('pointermove'/);
  assert.match(controller, /setAttribute\('viewBox'/);
  assert.match(renderer, /Store\.getProject\(\)/);
  assert.doesNotMatch(renderer, /Store\.commands\./);
});

test('fase 2 inicia seleção e criação pelo mesmo domínio geométrico', () => {
  assert.match(renderer, /data-wall-id/);
  assert.match(renderer, /scene2d-selected/);
  assert.match(controller, /Core\.findIsolatedRoomWallIds\(Store\.currentWalls\(\), wallId\)/);
  assert.match(controller, /Store\.commands\.createRoom\(/);
  assert.match(controller, /Store\.commands\.splitWallsAtTJunctions\(\)/);
});

test('criação 2D usa snap, prévia local e confirmação somente no segundo clique', () => {
  assert.match(controller, /Core\.snap\(model\.x\)/);
  assert.match(controller, /drawPreview/);
  assert.match(renderer, /scene2d-room-preview/);
  assert.match(controller, /if \(!this\.drawStart\)/);
});

test('cômodo isolado arrasta individualmente com prévia local e confirmação única', () => {
  assert.match(controller, /private roomDrag:/);
  assert.match(controller, /snapshots: WallSnapshot\[\]/);
  assert.match(controller, /this\.roomDrag\.dx = Core\.snap/);
  assert.match(renderer, /scene2d-drag-preview/);
  assert.match(controller, /Store\.commands\.beginTransaction\(\)/);
  assert.match(controller, /Store\.commands\.updateWallsGroupBodyLive\(drag\.snapshots, drag\.dx, drag\.dy\)/);
});

test('parede selecionada arrasta pela alça sem atualizar o Store durante a prévia', () => {
  assert.match(renderer, /data-wall-resize-id/);
  assert.match(controller, /private wallDrag:/);
  assert.match(controller, /Core\.wallResizeTopology/);
  assert.match(controller, /Core\.resolveWallResizeOffset/);
  assert.match(controller, /this\.wallDrag\.preview = this\.wallResizePreview/);
  assert.match(controller, /Store\.commands\.updateWallResizeLive/);
});
