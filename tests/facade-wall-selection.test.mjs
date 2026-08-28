import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const viewport = await readFile(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');

test('construção existente abre seleção múltipla de paredes antes do Estúdio', () => {
  assert.match(index, /id="facadeWallPicker"/);
  assert.match(index, /id="facadeWallPickerConfirm" disabled/);
  assert.match(app, /selectedFacadeWallIds = new Set<string>\(\)/);
  assert.match(app, /beginFacadeWallSelection\(\(wallId\)/);
  assert.match(app, /Array\.from\(selectedFacadeWallIds\)/);
});

test('confirmação isola somente as paredes escolhidas', () => {
  assert.match(app, /ViewportController\.isolateFacadeWalls\(isolatedWallIds\)/);
  assert.match(viewport, /facadeIsolatedWallIds = wallIds\.slice\(\)/);
  assert.match(viewport, /facadeIsolatedWallIds: facadeIsolatedWallIds/);
});

test('renderizador deriva vista paralela sem alterar o Store', () => {
  assert.match(renderer, /facadeIsolatedWallIds\?\.length/);
  assert.match(renderer, /x1: cursorM \* Core\.GRID/);
  assert.match(renderer, /x2: \(cursorM \+ lengthM\) \* Core\.GRID/);
  assert.match(renderer, /openings: sourceFloor\.openings\.filter/);
  assert.match(renderer, /facadeSigns: \(sourceFloor\.facadeSigns \|\| \[\]\)\.filter/);
  assert.doesNotMatch(renderer, /Store\.setProject/);
});

test('sair do Estúdio restaura a cena completa', () => {
  assert.match(app, /ViewportController\.clearFacadeIsolation\(\)/);
  assert.match(viewport, /facadeIsolatedWallIds = null; render\(\)/);
});
