import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const viewport = await readFile(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

// O Estúdio de Fachadas (botão "Fach.", overlay de entrada, workspace,
// formulário de letreiro e seletor de paredes) saiu da interface — decisão
// de produto, não bug. O motor por trás (ViewportController.focusFacade,
// isolamento de paredes, letreiro, dia/noite) continua no código pra não
// quebrar projetos salvos que já tinham fachada composta.
test('Estúdio de Fachadas saiu da interface por completo', () => {
  for (const id of ['viewModeFacadeBtn', 'facadeStartOverlay', 'facadeWorkspace', 'facadeUseProjectBtn', 'facadeBlankBtn', 'facadeSignForm', 'facadeWallPicker']) {
    assert.doesNotMatch(index, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(app, /facadeBlankBtn|facadeUseProjectBtn|facadeExitBtn|enterFacadeStudio/);
});

test('motor de fachada continua disponível em ViewportController (compatibilidade com projetos salvos)', () => {
  assert.match(viewport, /export function focusFacade\(wallId\?: string\): string \| null/);
  assert.match(viewport, /Store\.currentWalls\(\)/);
  assert.match(viewport, /Core\.wallLengthMeters/);
});
