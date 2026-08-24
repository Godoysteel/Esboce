import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('painel contextual do telhado expõe inclinação numérica e direção', () => {
  assert.match(html, /id="roofPitchInput"[^>]+min="5"[^>]+max="75"/);
  assert.match(html, /class="roof-axis"/);
  assert.match(controller, /Store\.commands\.setRoofPitch\(selectedRoofId, pitch\)/);
  assert.match(controller, /Store\.commands\.rotateRoofAxis\(selectedRoofId\)/);
});

test('controles sem significado ficam ocultos na platibanda', () => {
  assert.match(controller, /roofPitchControlEl\.style\.display = r\.type === 'platibanda' \? 'none' : 'grid'/);
  assert.match(controller, /axisBtn\.style\.display = r\.type === 'platibanda' \? 'none' : ''/);
});

test('painel informa se a direção representa cumeeira ou caimento', () => {
  assert.match(controller, /r\.type === 'umaAgua' \? '↔ Caimento: eixo ' : '↔ Cumeeira: eixo '/);
});
