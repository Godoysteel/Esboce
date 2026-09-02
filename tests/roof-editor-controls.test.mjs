import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

test('inclinação não tem mais campo numérico — só a alça da cumeeira, com cota ao vivo durante o arraste', () => {
  assert.doesNotMatch(html, /id="roofPitchInput"/);
  assert.doesNotMatch(controller, /Store\.commands\.setRoofPitch\(selectedRoofId, pitch\)/);
  assert.match(html, /id="roofPitchDragCota" class="dim-cota roof-pitch-drag-cota"/);
  const start = controller.indexOf("if (dragMode === 'roofRidge') {");
  const end = controller.indexOf('\n    }', start);
  const body = controller.slice(start, end);
  assert.match(body, /roofPitchDragCotaEl\.textContent = Math\.round\(finalPitch\) \+ '°'/);
});

// Product Owner (2026-09-02): "notei que ao gerar e movimentar o
// telhado ele fica travando" — cada pointermove gravava direto no
// Store (updateRoofPitchLive/updateRoofParapetHeightLive), disparando
// um rebuild() COMPLETO da cena (todos os telhados + custo O(telhados²)
// de recorte entre eles) 1×/frame durante TODO o arraste. Reescrito
// pro mesmo padrão já usado em redimensionar borda do telhado
// (previewRoofResize): durante o arraste só um fantasma translúcido é
// mostrado, sem tocar o Store; o valor final é gravado uma única vez,
// no pointerup.
test('cumeeira e parapeito do telhado usam prévia transparente durante o arraste (sem rebuild completo por frame) e confirmam no Store só ao soltar', () => {
  const moveStartRidge = controller.indexOf("if (dragMode === 'roofRidge') {");
  const moveEndRidge = controller.indexOf('\n    }', moveStartRidge);
  const moveBodyRidge = controller.slice(moveStartRidge, moveEndRidge);
  assert.doesNotMatch(moveBodyRidge, /Store\.commands\.updateRoofPitchLive/, 'pointermove não pode mais escrever no Store a cada frame');
  assert.match(moveBodyRidge, /dragElementStart\.lastPitchDeg = finalPitch;/);
  assert.match(moveBodyRidge, /previewRoofResize\(\{ pitchDeg: finalPitch \}\);/);

  const moveStartParapet = controller.indexOf("if (dragMode === 'roofParapetHeight') {");
  const moveEndParapet = controller.indexOf('\n    }', moveStartParapet);
  const moveBodyParapet = controller.slice(moveStartParapet, moveEndParapet);
  assert.doesNotMatch(moveBodyParapet, /Store\.commands\.updateRoofParapetHeightLive/, 'pointermove não pode mais escrever no Store a cada frame');
  assert.match(moveBodyParapet, /dragElementStart\.lastParapetHeight = candidateHeight;/);
  assert.match(moveBodyParapet, /previewRoofResize\(\{ parapetHeight: candidateHeight \}\);/);

  const upStart = controller.indexOf("if (dragMode === 'roofRidge' || dragMode === 'roofParapetHeight') {");
  const upEnd = controller.indexOf('\n    }', upStart);
  const upBody = controller.slice(upStart, upEnd);
  assert.match(upBody, /clearRoofResizePreview\(\);/);
  assert.match(upBody, /Store\.commands\.updateRoofPitchLive\(selectedRoofId, dragElementStart\.lastPitchDeg\);/);
  assert.match(upBody, /Store\.commands\.updateRoofParapetHeightLive\(selectedRoofId, dragElementStart\.lastParapetHeight\);/);
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
