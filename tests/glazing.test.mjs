import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeGlazingLayout, netGlassSizeM, MIN_MODULE_M, JOINT_MM,
} from '../src/core/Glazing.ts';
import { decodeProjectDocument, encodeProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION } from '../src/core/ProjectPersistence.ts';
import { createFloorEntity } from '../src/core/Core.ts';

// --- computeGlazingLayout: encaixe exato nos dois eixos ---------------

test('painel exatamente múltiplo do alvo: encaixe exato, sem sobra', () => {
  const layout = computeGlazingLayout(3.6, 2.4, 1.2);
  assert.equal(layout.columns.count, 3);
  assert.equal(layout.columns.moduleSizeM, 1.2);
  assert.equal(layout.rows.count, 2);
  assert.equal(layout.rows.moduleSizeM, 1.2);
});

test('painel com resto: módulo recalculado, nunca sobra pedaço cortado', () => {
  const layout = computeGlazingLayout(4.0, 2.5, 1.2);
  // 4.0 / 1.2 = 3.33 -> arredonda pra 3 módulos de ~1.333m cada
  assert.equal(layout.columns.count, 3);
  assert.ok(Math.abs(layout.columns.count * layout.columns.moduleSizeM - 4.0) < 1e-9);
  // 2.5 / 1.2 = 2.08 -> arredonda pra 2 módulos de 1.25m cada
  assert.equal(layout.rows.count, 2);
  assert.ok(Math.abs(layout.rows.count * layout.rows.moduleSizeM - 2.5) < 1e-9);
});

test('largura e altura calculadas de forma independente (painel não-quadrado)', () => {
  const layout = computeGlazingLayout(6.0, 1.2, 1.2);
  assert.equal(layout.columns.count, 5);
  assert.equal(layout.rows.count, 1);
  assert.equal(layout.rows.moduleSizeM, 1.2);
});

test('painel menor que o alvo: pelo menos 1 módulo, nunca zero', () => {
  const layout = computeGlazingLayout(0.9, 0.9, 1.2);
  assert.equal(layout.columns.count, 1);
  assert.equal(layout.rows.count, 1);
  assert.equal(layout.columns.moduleSizeM, 0.9);
});

test('piso de segurança: nunca gera módulo mais estreito que MIN_MODULE_M', () => {
  const layout = computeGlazingLayout(1.0, 1.0, 0.3);
  // 1.0 / 0.3 arredondaria pra 3 módulos de 0.333m — abaixo do piso;
  // reduz até respeitar MIN_MODULE_M.
  assert.ok(layout.columns.moduleSizeM >= MIN_MODULE_M - 1e-9);
  assert.ok(layout.rows.moduleSizeM >= MIN_MODULE_M - 1e-9);
});

test('alvo abaixo do piso de segurança é elevado ao piso antes do cálculo', () => {
  const layout = computeGlazingLayout(2.4, 2.4, 0.1);
  assert.ok(layout.columns.moduleSizeM >= MIN_MODULE_M - 1e-9);
});

// --- netGlassSizeM: desconto da junta de 10mm -------------------------

test('junta padrão é 10mm', () => {
  assert.equal(JOINT_MM, 10);
});

test('vidro líquido descontando a junta de 10mm', () => {
  assert.ok(Math.abs(netGlassSizeM(1.2) - (1.2 - 0.01)) < 1e-9);
});

test('vidro líquido nunca fica negativo em módulo menor que a junta', () => {
  assert.equal(netGlassSizeM(0.005), 0);
});

// --- Persistência: ida e volta preserva o painel -----------------------

test('GlazingPanel: ida e volta preserva estado attached com todos os campos', () => {
  const floor = createFloorEntity('Térreo');
  floor.walls.push({ id: 'w1', x1: 0, y1: 0, x2: 5, y2: 0 });
  floor.glazingPanels.push({
    id: 'gp1', state: 'attached', widthM: 3.6, heightM: 2.4, moduleTargetM: 1.2,
    wallId: 'w1', offsetM: 2.5, sillHeightM: 0,
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const doc = encodeProjectDocument(project);
  assert.equal(doc.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  const decoded = decodeProjectDocument(doc);
  const panel = decoded.project.floors[0].glazingPanels[0];
  assert.equal(panel.id, 'gp1');
  assert.equal(panel.state, 'attached');
  assert.equal(panel.widthM, 3.6);
  assert.equal(panel.wallId, 'w1');
  assert.equal(panel.offsetM, 2.5);
});

test('GlazingPanel: painel em preview não exige wallId', () => {
  const floor = createFloorEntity('Térreo');
  floor.glazingPanels.push({ id: 'gp1', state: 'preview', widthM: 2.0, heightM: 2.0, moduleTargetM: 1.2 });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const doc = encodeProjectDocument(project);
  const decoded = decodeProjectDocument(doc);
  assert.equal(decoded.project.floors[0].glazingPanels[0].state, 'preview');
  assert.equal(decoded.project.floors[0].glazingPanels[0].wallId, undefined);
});

test('GlazingPanel: attached sem wallId é rejeitado', () => {
  const floor = createFloorEntity('Térreo');
  floor.glazingPanels.push({ id: 'gp1', state: 'attached', widthM: 2.0, heightM: 2.0, moduleTargetM: 1.2 });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  assert.throws(() => encodeProjectDocument(project));
});

test('GlazingPanel: wallId apontando pra parede inexistente é rejeitado', () => {
  const floor = createFloorEntity('Térreo');
  floor.glazingPanels.push({
    id: 'gp1', state: 'attached', widthM: 2.0, heightM: 2.0, moduleTargetM: 1.2, wallId: 'nao-existe',
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  assert.throws(() => encodeProjectDocument(project));
});

test('projeto sem nenhum GlazingPanel continua decodificando normalmente (pavimento legado)', () => {
  const floor = createFloorEntity('Térreo');
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const doc = encodeProjectDocument(project);
  delete doc.project.floors[0].glazingPanels;
  const decoded = decodeProjectDocument(doc);
  assert.deepEqual(decoded.project.floors[0].glazingPanels, []);
});
