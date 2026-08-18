import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Scene3DRenderer.ts / ViewportController.ts / GizmoController.ts não são
// importáveis direto (dependem de Three.js/DOM em tempo de carga) —
// testados por busca de texto, mesma técnica já usada em outros testes
// deste módulo (ver roof-uma-agua-gable.test.mjs, materials-real-price.test.mjs).
const sceneSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const gizmoSource = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Pedido do Product Owner: "as pessoas arrastam [a alça de altura] para
// cima sem querer... tem que ser um comando separado das setas para
// arrastar as paredes." Causa raiz: pegavam a alça roxa de altura por
// engano. Fix (DEC-116): a alça só existe na cena se a parede tiver sido
// "armada" explicitamente por um clique num botão dedicado do gizmo.
test('ViewState ganha heightAdjustArmedWallId', () => {
  assert.match(sceneSource, /heightAdjustArmedWallId\?: string \| null;/);
});

test('a alça de altura do cômodo só é criada quando a parede está armada (heightAdjustArmedWallId === w.id)', () => {
  assert.match(
    sceneSource,
    /if \(owningRoomsForHeight\.length && viewState\.heightAdjustArmedWallId === w\.id\) \{/,
  );
});

test('ViewportController expõe armHeightAdjust(wallId) e passa o estado pro render', () => {
  assert.match(vpSource, /var heightAdjustArmedWallId: any = null;/);
  assert.match(
    vpSource,
    /export function armHeightAdjust\(wallId: string\) \{ heightAdjustArmedWallId = wallId; render\(\); \}/,
  );
  assert.match(vpSource, /heightAdjustArmedWallId: heightAdjustArmedWallId,/);
  const exportsBlockMatch = vpSource.match(/export const ViewportController = \{[\s\S]*?\};/);
  assert.ok(exportsBlockMatch, 'esperava achar o objeto de exports ViewportController');
  assert.match(exportsBlockMatch[0], /armHeightAdjust/);
});

test('selecionar ou deselecionar uma parede desarma a alça de altura (evita "vazar" pra outra parede)', () => {
  const selectStart = vpSource.indexOf('function select(wallId: any) {');
  const selectEnd = vpSource.indexOf('\n  }', selectStart);
  assert.match(vpSource.slice(selectStart, selectEnd), /heightAdjustArmedWallId = null;/);

  const deselectStart = vpSource.indexOf('function deselect() {');
  const deselectEnd = vpSource.indexOf('\n  }', deselectStart);
  assert.match(vpSource.slice(deselectStart, deselectEnd), /heightAdjustArmedWallId = null;/);
});

test('depois de um ajuste de altura concluído (pointerup), a alça se desarma sozinha — precisa clicar de novo pro próximo ajuste', () => {
  const idx = vpSource.indexOf('Store.commands.updateRoomWallsHeightLive(heightUpdates);');
  assert.notEqual(idx, -1);
  const after = vpSource.slice(idx, idx + 400);
  assert.match(after, /heightAdjustArmedWallId = null;/);
});

test('gizmo da parede ganha um botão dedicado "Ajustar altura" (⇕), separado das setas de arrastar', () => {
  assert.match(
    indexHtml,
    /<button class="gz" data-action="heightMode" title="Ajustar altura do cômodo">⇕<\/button>/,
  );
});

test('GizmoController arma a alça de altura só quando o botão heightMode é clicado', () => {
  const idx = gizmoSource.indexOf("if (action === 'heightMode') {");
  assert.notEqual(idx, -1);
  const body = gizmoSource.slice(idx, idx + 400);
  assert.match(body, /ViewportController\.armHeightAdjust\(wallId\);/);
});
