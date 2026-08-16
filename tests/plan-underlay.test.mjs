import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createPlanUnderlayEntity } from '../src/core/Core.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const gizmoSource = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');
const persistenceSource = readFileSync(new URL('../src/core/ProjectPersistence.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');
const planImportSource = readFileSync(new URL('../src/core/PlanImport.ts', import.meta.url), 'utf8');

test('createPlanUnderlayEntity nasce com 10m de largura, mantendo a proporção da imagem', () => {
  const u = createPlanUnderlayEntity('data:image/png;base64,xyz', 2, 100, 200);
  assert.equal(u.widthM, Core.PLAN_UNDERLAY_DEFAULT_WIDTH_M);
  assert.equal(u.heightM, Core.PLAN_UNDERLAY_DEFAULT_WIDTH_M / 2);
  assert.equal(u.x, 100);
  assert.equal(u.y, 200);
  assert.equal(u.rotationDeg, 0);
  assert.equal(u.visible, true);
});

test('createPlanUnderlayEntity nunca deixa a proporção zerada/negativa quebrar a conta (cai pra 1)', () => {
  const u = createPlanUnderlayEntity('data:image/png;base64,xyz', 0, 0, 0);
  assert.equal(u.naturalAspect, 1);
  assert.equal(u.heightM, Core.PLAN_UNDERLAY_DEFAULT_WIDTH_M);
});

test('index.html tem o botão de importar, o input de arquivo e o gizmo dedicado', () => {
  assert.match(html, /id="importPlanUnderlayBtn"/);
  assert.match(html, /id="planUnderlayFileInput"[^>]*accept="image\/\*,\.pdf"/);
  assert.match(html, /id="planUnderlayGizmo"/);
  assert.match(html, /id="planUnderlayGizmo"[\s\S]*?data-action="scaleUp"/);
  assert.match(html, /id="planUnderlayGizmo"[\s\S]*?data-action="scaleDown"/);
  assert.match(html, /id="planUnderlayGizmo"[\s\S]*?data-action="rotateCw"/);
});

test('Store tem os comandos de mover/girar/escalar/excluir a planta, um por pavimento (não lista)', () => {
  assert.match(storeSource, /setPlanUnderlay\(imageDataUrl: string, naturalAspect: number, x: number, y: number\)/);
  assert.match(storeSource, /movePlanUnderlay\(dxM: number, dyM: number\)/);
  assert.match(storeSource, /rotatePlanUnderlay\(deltaDeg: number\)/);
  assert.match(storeSource, /scalePlanUnderlay\(factor: number\)/);
  assert.match(storeSource, /deletePlanUnderlay\(\)/);
  // escala tem piso e teto (não deixa encolher/crescer sem limite)
  assert.match(storeSource, /Math\.max\(0\.5, Math\.min\(200, u\.widthM \* factor\)\)/);
});

test('Scene3DRenderer não deixa a textura cacheada ser destruída no rebuild seguinte', () => {
  assert.match(rendererSource, /function buildPlanUnderlayMesh/);
  assert.match(rendererSource, /planUnderlayTextureCache/);
  assert.match(rendererSource, /mat\.userData\.sharedMap = true/);
  assert.match(rendererSource, /if \(mat\.map && !mat\.userData\?\.sharedMap\) mat\.map\.dispose\(\)/);
});

test('a planta importada só aparece no pavimento em edição e nunca entra no pick de clique (sem tagCategory)', () => {
  const block = rendererSource.slice(
    rendererSource.indexOf('if (floorData.planUnderlay'),
    rendererSource.indexOf('(floorData.volumeBoxes || []).forEach'),
  );
  assert.match(block, /floorIdx === editingIdx/);
  assert.doesNotMatch(block, /tagCategory/);
});

test('ViewportController sabe selecionar a planta (sem ID, é singular) e mostrar o gizmo dela', () => {
  assert.match(viewportSource, /function selectPlanUnderlay\(\)/);
  assert.match(viewportSource, /getSelectedPlanUnderlay/);
  assert.match(viewportSource, /selectedPlanUnderlay = false/);
});

test('GizmoController liga os botões da planta aos comandos certos, com passo fixo', () => {
  assert.match(gizmoSource, /planUnderlayGizmoEl/);
  assert.match(gizmoSource, /Store\.commands\.movePlanUnderlay\(0, -PLAN_UNDERLAY_MOVE_STEP_M\)/);
  assert.match(gizmoSource, /Store\.commands\.rotatePlanUnderlay\(PLAN_UNDERLAY_ROTATE_STEP_DEG\)/);
  assert.match(gizmoSource, /Store\.commands\.scalePlanUnderlay\(PLAN_UNDERLAY_SCALE_STEP\)/);
  assert.match(gizmoSource, /Store\.commands\.deletePlanUnderlay\(\)/);
});

test('ProjectPersistence só grava planUnderlay quando existe de verdade (não "sempre null")', () => {
  assert.match(persistenceSource, /if \(v\.planUnderlay\) floor\.planUnderlay = parsePlanUnderlay/);
  assert.doesNotMatch(persistenceSource, /planUnderlay: v\.planUnderlay \? parsePlanUnderlay/);
});

test('EsboceApplication centra a planta importada na caixa das paredes já existentes (ou na origem, se vazio)', () => {
  assert.match(appSource, /readPlanFile\(file\)/);
  assert.match(appSource, /Store\.commands\.setPlanUnderlay\(dataUrl, aspect, x, y\)/);
  assert.match(appSource, /ViewportController\.selectPlanUnderlay\(\)/);
});

test('o botão de importar reabre o menu (não reimporta) quando já existe planta no pavimento — senão a seleção não teria como voltar, já que o plano não é clicável', () => {
  const block = appSource.slice(
    appSource.indexOf("importPlanUnderlayBtn.addEventListener('click'"),
    appSource.indexOf("planUnderlayFileInput.addEventListener('change'"),
  );
  assert.match(block, /if \(Store\.currentPlanUnderlay\(\)\)/);
  assert.match(block, /ViewportController\.selectPlanUnderlay\(\)/);
  assert.match(block, /planUnderlayFileInput\.click\(\)/);
});

test('o rótulo do botão muda pra "Editar planta" quando já existe uma, e é atualizado a cada mudança de modelo (inclusive troca de pavimento)', () => {
  assert.match(appSource, /private refreshPlanUnderlayButton\(\): void/);
  assert.match(appSource, /hasUnderlay \? 'Editar planta' : 'Importar planta'/);
  assert.match(appSource, /this\.refreshPlanUnderlayButton\(\);\s*\n\s*\}\);\s*\n\s*\}/);
});

test('PlanImport só usa pdfjs-dist sob demanda (import tardio), não no carregamento inicial', () => {
  assert.match(planImportSource, /await import\('pdfjs-dist'\)/);
  assert.match(planImportSource, /await import\('pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url'\)/);
  assert.doesNotMatch(planImportSource, /^import \* as pdfjsLib from 'pdfjs-dist'/m);
});
