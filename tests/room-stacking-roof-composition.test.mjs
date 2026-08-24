import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('pavimentos saem da experiência e cômodo ganha ação de empilhar', () => {
  assert.match(html, /class="tb-overflow floor-menu tb-pill" hidden aria-hidden="true"/);
  assert.match(html, /data-action="stackRoom"/);
  assert.match(store, /stackRoom\(wallIds: string\[\]\): Wall\[\] \| null/);
});

test('empilhar preserva a projeção e troca automaticamente para o novo nível interno', () => {
  assert.match(store, /const copy = \{ \.\.\.wall, id: Core\.nextId\('wall'\) \}/);
  assert.match(store, /project\.currentFloorIndex = project\.floors\.length - 1/);
  assert.match(viewport, /Store\.commands\.setCurrentFloor\(mesh\.userData\.floorIndex\)/);
});

test('encontros transversais de coberturas são compostos sem botão manual', () => {
  assert.doesNotMatch(html, /button class="roof-commit"/);
  assert.match(html, /Encontro automático/);
  assert.match(store, /function autoComposeCurrentRoofs\(\): string\[\]\[\]/);
  assert.match(store, /candidate\.ridgeAxis === roof\.ridgeAxis/);
  assert.match(store, /Core\.rectsNearby\(roof, candidate, Core\.SNAP_UNIT\)/);
  assert.match(store, /autoComposeCurrentRoofs\(\);\s*emit\(\{ type: 'RoofCreated'/);
});
