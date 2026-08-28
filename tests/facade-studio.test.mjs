import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const viewport = await readFile(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('Estúdio de Fachadas oferece construção atual e fachada vazia', () => {
  assert.match(index, /id="viewModeFacadeBtn"/);
  assert.match(index, /id="facadeUseProjectBtn"/);
  assert.match(index, /id="facadeBlankBtn"/);
  assert.match(index, /Usar a construção atual/);
  assert.match(index, /Começar com fachada vazia/);
});

test('fachada vazia cria plano de 10 m sem substituir o projeto', () => {
  const start = app.indexOf("this.requireElement('facadeBlankBtn')");
  const end = app.indexOf("this.requireElement('facadeExitBtn')", start);
  const flow = app.slice(start, end);
  assert.match(flow, /Store\.currentWalls\(\)/);
  assert.match(flow, /Store\.commands\.createWall\(centerX - 5 \* Core\.GRID, 0, centerX \+ 5 \* Core\.GRID, 0\)/);
  assert.doesNotMatch(flow, /createProject|setProject|reset/);
});

test('modo Fachadas enquadra uma parede real e reaproveita Pele de vidro', () => {
  assert.match(app, /ViewportController\.focusFacade\(wallId\)/);
  assert.match(app, /showCategory\('aberturas'\)/);
  assert.match(app, /requireElement\('addGlazingPanelBtn'\)\.click\(\)/);
  assert.match(viewport, /export function focusFacade\(wallId\?: string\): string \| null/);
  assert.match(viewport, /Store\.currentWalls\(\)/);
  assert.match(viewport, /Core\.wallLengthMeters/);
});

test('ferramentas futuras não fingem estar prontas', () => {
  for (const label of ['Marquise', 'Brises', 'Ripados e vazados']) {
    assert.match(index, new RegExp(`<button class="facade-tool" disabled[^>]*>${label.replace('/', '\\/')}</button>`));
  }
});
