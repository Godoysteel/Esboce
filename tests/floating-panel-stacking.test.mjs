import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// ViewportController.ts não é importável direto pelo test runner
// nativo do Node (mesma limitação documentada nos demais testes deste
// projeto) — testado por busca de texto.
const viewportControllerSource = await readFile(
  new URL('../src/core/ViewportController.ts', import.meta.url),
  'utf8',
);

// Pedido do Product Owner, com print: o gizmo (mover/girar/duplicar),
// o painel de tipo de telhado e a paleta de cor da telha ficavam
// sobrepostos ao selecionar um telhado — os três eram posicionados no
// MESMO ponto da tela (o meio do telhado), só deslocados por um
// número fixo de pixels (-60/-100) que não considerava a largura real
// de cada painel.
test('stackLeftOf usa a largura RENDERIZADA de cada painel (getBoundingClientRect), não um offset fixo chutado', () => {
  const start = viewportControllerSource.indexOf('function stackLeftOf(el: any, refEl: any, gapPx: any) {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /refEl\.getBoundingClientRect\(\)/);
  assert.match(body, /el\.getBoundingClientRect\(\)/);
  assert.match(body, /el\.style\.left = \(refRect\.left - gapPx - elRect\.width \/ 2\) \+ 'px';/);
});

test('painel de tipo de telhado (roofTypePanel) encosta no gizmo com stackLeftOf — não sobrepõe mais', () => {
  const start = viewportControllerSource.indexOf('if (selectedRoofId) {');
  const end = viewportControllerSource.indexOf('roofTypePanelEl.querySelectorAll', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /positionFloatingPanel\(gizmoEl, mid2\.x, topY2, mid2\.z, 0\);/);
  assert.match(body, /gizmoEl\.classList\.add\('visible'\);/);
  assert.match(body, /stackLeftOf\(roofTypePanelEl, gizmoEl, 8\);/);
});

test('paleta de cor do telhado (finishPanel) encosta no roofTypePanel com stackLeftOf, na mesma sequência de render que já posicionou o roofTypePanel', () => {
  const start = viewportControllerSource.indexOf('function refreshFinishPanel() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /stackLeftOf\(finishPanelEl, roofTypePanelEl, 8\);/);

  // positionGizmoAndShapePanel() (que posiciona gizmo+roofTypePanel)
  // precisa rodar ANTES de refreshFinishPanel() no mesmo ciclo, senão
  // o finishPanel se ancora numa posição desatualizada do
  // roofTypePanel.
  const renderStart = viewportControllerSource.indexOf('positionGizmoAndShapePanel();');
  const finishCallIdx = viewportControllerSource.indexOf('refreshFinishPanel();', renderStart);
  assert.ok(renderStart !== -1 && finishCallIdx !== -1 && finishCallIdx > renderStart,
    'refreshFinishPanel() precisa ser chamada DEPOIS de positionGizmoAndShapePanel() no render()');
});
