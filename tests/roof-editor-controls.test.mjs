import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('inclinação não tem mais campo numérico — só a alça da cumeeira, com cota ao vivo durante o arraste', () => {
  assert.doesNotMatch(html, /id="roofPitchInput"/);
  assert.doesNotMatch(controller, /Store\.commands\.setRoofPitch\(selectedRoofId, pitch\)/);
  assert.match(html, /id="roofPitchDragCota" class="dim-cota roof-pitch-drag-cota"/);
  assert.match(controller, /Store\.commands\.updateRoofPitchLive\(selectedRoofId, finalPitch\)/);
  const start = controller.indexOf("if (dragMode === 'roofRidge') {");
  const end = controller.indexOf('\n    }', start);
  const body = controller.slice(start, end);
  assert.match(body, /roofPitchDragCotaEl\.textContent = Math\.round\(finalPitch\) \+ '°'/);
});

test('tipo de telhado é escolhido só no menu Cobertura — o painel do telhado não duplica mais os botões de água/platibanda nem a cor da telha', () => {
  assert.doesNotMatch(html, /class="rt" data-rooftype=/);
  assert.doesNotMatch(controller, /Store\.commands\.setRoofPieceType/);
  assert.doesNotMatch(html, /id="finishPanel"/);
  assert.match(html, /class="roof-axis"/);
  assert.match(controller, /Store\.commands\.rotateRoofAxis\(selectedRoofId\)/);
});

test('controles sem significado ficam ocultos na platibanda', () => {
  assert.match(controller, /axisBtn\.style\.display = r\.type === 'platibanda' \? 'none' : ''/);
});

test('painel informa se a direção representa cumeeira ou caimento', () => {
  assert.match(controller, /r\.type === 'umaAgua' \? '↔ Caimento: eixo ' : '↔ Cumeeira: eixo '/);
});
