import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const viewport = await readFile(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');

// A seleção múltipla de paredes que antecedia o Estúdio de Fachadas saiu da
// interface junto com o resto do estúdio — decisão de produto, não bug.
test('seleção de paredes do Estúdio de Fachadas saiu da interface', () => {
  assert.doesNotMatch(index, /id="facadeWallPicker"/);
  assert.doesNotMatch(index, /id="facadeWallPickerConfirm"/);
  assert.doesNotMatch(app, /selectedFacadeWallIds|beginFacadeWallSelection|enterFacadeStudio/);
});

test('isolamento/vista paralela/restauração de fachada continuam no motor (compatibilidade com projetos salvos)', () => {
  assert.match(viewport, /export function isolateFacadeWalls/);
  assert.match(viewport, /facadeIsolatedWallIds = wallIds\.slice\(\)/);
  assert.match(viewport, /facadeIsolatedWallIds: facadeIsolatedWallIds/);
  assert.match(viewport, /export function clearFacadeIsolation/);
  assert.match(viewport, /facadeIsolatedWallIds = null; render\(\)/);
});

test('renderizador deriva vista paralela sem alterar o Store', () => {
  assert.match(renderer, /facadeIsolatedWallIds\?\.length/);
  assert.match(renderer, /x1: cursorM \* Core\.GRID/);
  assert.match(renderer, /x2: \(cursorM \+ lengthM\) \* Core\.GRID/);
  assert.match(renderer, /openings: sourceFloor\.openings\.filter/);
  assert.match(renderer, /facadeSigns: \(sourceFloor\.facadeSigns \|\| \[\]\)\.filter/);
  assert.doesNotMatch(renderer, /Store\.setProject/);
});
