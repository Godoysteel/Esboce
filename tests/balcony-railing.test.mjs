import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  createBalconyRailingEntity, computeBalconyRailingJoints, createFloorEntity,
  BALCONY_DEFAULT_WIDTH_M, BALCONY_DEFAULT_HEIGHT_M, BALCONY_DEFAULT_MODULE_TARGET_M,
  BALCONY_MIN_HEIGHT_M, BALCONY_MAX_HEIGHT_M, BALCONY_MAX_SILL_HEIGHT_M,
  RAILING_JOIN_TOL_MODEL, GRID,
} from '../src/core/Core.ts';
// BalconyRailing.ts reexporta estas três de Glazing.ts (não duplica a
// matemática) — importamos direto de Glazing.ts aqui porque
// BalconyRailing.ts também importa `from './Glazing.js'` (convenção do
// projeto pra todo import interno, resolvido pelo Vite/bundler) e esse
// caminho não existe como arquivo .js literal no disco — só funciona
// through do bundler, não do test runner (mesma limitação de Store.ts,
// ver comentário no topo de outros arquivos de teste). A reexportação
// em si é conferida via regex mais abaixo.
import { computeGlazingLayout, netGlassSizeM, MIN_MODULE_M } from '../src/core/Glazing.ts';
import { decodeProjectDocument, encodeProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION } from '../src/core/ProjectPersistence.ts';

// --- createBalconyRailingEntity: nasce solta, com os padrões certos ----

test('createBalconyRailingEntity nasce com os valores padrão calibrados no modelo de referência, no piso (sillHeightM = 0)', () => {
  const r = createBalconyRailingEntity(100, 200);
  assert.equal(r.x, 100);
  assert.equal(r.y, 200);
  assert.equal(r.rotationDeg, 0);
  assert.equal(r.widthM, BALCONY_DEFAULT_WIDTH_M);
  assert.equal(r.heightM, BALCONY_DEFAULT_HEIGHT_M);
  assert.equal(r.moduleTargetM, BALCONY_DEFAULT_MODULE_TARGET_M);
  assert.equal(r.sillHeightM, 0);
  assert.ok(r.id);
});

test('createBalconyRailingEntity aceita rotação, tamanho e elevação customizados', () => {
  const r = createBalconyRailingEntity(0, 0, 90, 3.5, 1.2, 0.8, undefined, 0.9);
  assert.equal(r.rotationDeg, 90);
  assert.equal(r.widthM, 3.5);
  assert.equal(r.heightM, 1.2);
  assert.equal(r.moduleTargetM, 0.8);
  assert.equal(r.sillHeightM, 0.9);
});

// --- BalconyRailing.ts: reexporta o layout puro de Glazing.ts ----------

test('computeGlazingLayout/netGlassSizeM/MIN_MODULE_M (usados por BalconyRailing.ts) se comportam como esperado', () => {
  const layout = computeGlazingLayout(3.0, 1.1, 1.0);
  assert.equal(layout.columns.count, 3);
  assert.ok(Math.abs(netGlassSizeM(1.0) - (1.0 - 0.02)) < 1e-9);
  assert.equal(MIN_MODULE_M, 0.6);
});

test('BalconyRailing.ts reexporta o layout puro de Glazing.ts em vez de duplicar a matemática', () => {
  const source = readFileSync(new URL('../src/core/BalconyRailing.ts', import.meta.url), 'utf8');
  assert.match(source, /export \{ computeGlazingLayout, netGlassSizeM, MIN_MODULE_M \} from '\.\/Glazing\.js';/);
});

// --- computeBalconyRailingJoints: o "canto perfeito" --------------------
// Product Owner: "ela deve se unir nos cantos formando uma quina
// perfeita entre duas sacadas que se encontram." MVP: só cantos de 2
// vias, ângulo de junção precisa ser >30° (mesmo limite de mitre de
// computeWallFootprints) pra formar quina; a sacada de menor id "possui"
// o montante compartilhado.

test('duas sacadas perpendiculares com pontas coincidentes formam um único ponto de canto, dono determinístico por id', () => {
  // "a" corre ao longo de X terminando em (100, 0); "b" corre ao longo
  // de Y começando em (100, 0) — mesmo canto de 90° das fotos de
  // referência do Product Owner (parede de esquina).
  const a = createBalconyRailingEntity(50, 0, 0, 5, undefined, undefined, 'a-railing');
  const b = createBalconyRailingEntity(100, 50, 90, 5, undefined, undefined, 'b-railing');
  const joints = computeBalconyRailingJoints([a, b]);
  assert.ok(joints['a-railing'].end);
  assert.ok(joints['b-railing'].start);
  assert.ok(!joints['a-railing'].start);
  assert.ok(!joints['b-railing'].end);
  assert.ok(Math.abs(joints['a-railing'].end.point.x - 100) < 1e-6);
  assert.ok(Math.abs(joints['a-railing'].end.point.y - 0) < 1e-6);
  assert.deepEqual(joints['a-railing'].end.point, joints['b-railing'].start.point);
  // "a-railing" < "b-railing" -> dona do montante compartilhado.
  assert.equal(joints['a-railing'].end.ownsPost, true);
  assert.equal(joints['b-railing'].start.ownsPost, false);
});

test('sacadas com pontas distantes (fora da tolerância) não formam junção nenhuma', () => {
  const a = createBalconyRailingEntity(50, 0, 0, 5, undefined, undefined, 'a');
  const b = createBalconyRailingEntity(300, 50, 90, 5, undefined, undefined, 'b');
  const joints = computeBalconyRailingJoints([a, b]);
  assert.deepEqual(joints['a'], {});
  assert.deepEqual(joints['b'], {});
});

test('a tolerância de junção é mais generosa que COINCIDENCE_TOL de paredes (arraste à mão, não encaixe por construção)', () => {
  assert.ok(RAILING_JOIN_TOL_MODEL > 0);
  assert.equal(RAILING_JOIN_TOL_MODEL, 0.3 * GRID);
});

test('sacadas colineares (continuação reta) não formam quina — ângulo raso demais, mesmo limite de mitre de computeWallFootprints', () => {
  const a = createBalconyRailingEntity(50, 0, 0, 5, undefined, undefined, 'a');
  const b = createBalconyRailingEntity(150, 0, 0, 5, undefined, undefined, 'b');
  const joints = computeBalconyRailingJoints([a, b]);
  assert.deepEqual(joints['a'], {});
  assert.deepEqual(joints['b'], {});
});

test('uma única sacada isolada não gera junção nenhuma', () => {
  const a = createBalconyRailingEntity(0, 0, 0, 5, undefined, undefined, 'a');
  const joints = computeBalconyRailingJoints([a]);
  assert.deepEqual(joints['a'], {});
});

// --- Persistência: ida e volta preserva a sacada ------------------------

test('BalconyRailing: ida e volta preserva todos os campos', () => {
  const floor = createFloorEntity('Térreo');
  floor.balconyRailings.push({
    id: 'br1', x: 100, y: 200, rotationDeg: 90, widthM: 3.5, heightM: 1.1, moduleTargetM: 1.0,
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const doc = encodeProjectDocument(project);
  assert.equal(doc.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  const decoded = decodeProjectDocument(doc);
  const r = decoded.project.floors[0].balconyRailings[0];
  assert.equal(r.id, 'br1');
  assert.equal(r.x, 100);
  assert.equal(r.y, 200);
  assert.equal(r.rotationDeg, 90);
  assert.equal(r.widthM, 3.5);
  assert.equal(r.heightM, 1.1);
});

test('BalconyRailing: sillHeightM (alça de baixo) sobrevive ao salvamento, e documento antigo (v11, sem o campo) continua abrindo com sillHeightM ausente', () => {
  const floor = createFloorEntity('Térreo');
  floor.balconyRailings.push({
    id: 'br-sill', x: 0, y: 0, rotationDeg: 0, widthM: 2, heightM: 1.1, moduleTargetM: 1.0, sillHeightM: 0.9,
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  assert.equal(decoded.project.floors[0].balconyRailings[0].sillHeightM, 0.9);

  const legacyDoc = { schemaVersion: 11, project: structuredClone(project) };
  delete legacyDoc.project.floors[0].balconyRailings[0].sillHeightM;
  const decodedLegacy = decodeProjectDocument(legacyDoc);
  assert.equal(decodedLegacy.project.floors[0].balconyRailings[0].sillHeightM, undefined);
});

test('BalconyRailing: ajuste visual do vidro sobrevive ao salvamento', () => {
  const floor = createFloorEntity('Térreo');
  floor.balconyRailings.push({
    id: 'br-material', x: 0, y: 0, rotationDeg: 0, widthM: 2, heightM: 1.1, moduleTargetM: 1.0,
    glassMaterial: { color: '#789abc', opacity: 0.2, roughness: 0.15, metalness: 0, reflectionIntensity: 1.2 },
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  assert.deepEqual(decoded.project.floors[0].balconyRailings[0].glassMaterial, {
    color: '#789abc', opacity: 0.2, roughness: 0.15, metalness: 0, reflectionIntensity: 1.2,
  });
});

test('documento salvo antes desta versão (v10, sem balconyRailings) continua abrindo normalmente', () => {
  const floor = createFloorEntity('Térreo');
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const legacyDoc = { schemaVersion: 10, project: structuredClone(project) };
  delete legacyDoc.project.floors[0].balconyRailings;
  const decoded = decodeProjectDocument(legacyDoc);
  assert.deepEqual(decoded.project.floors[0].balconyRailings, []);
});

// --- Wiring: UI/Store/GizmoController (regex sobre a fonte) -------------

test('index.html: botão "Sacada de vidro" existe na categoria Aberturas, mesmo data-room-preset genérico', () => {
  const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(source, /id="addBalconyRailingBtn" data-room-preset="sacada-vidro"/);
});

test('Store.createBalconyRailing/rotateBalconyRailing existem com a assinatura esperada', () => {
  const source = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  assert.match(source, /createBalconyRailing\(x: number, y: number\): BalconyRailing \| null \{/);
  const start = source.indexOf('rotateBalconyRailing(balconyRailingId: string, stepDeg?: number): void {');
  assert.ok(start !== -1);
  const end = source.indexOf('\n  },', start);
  const body = source.slice(start, end);
  // Cópia exata do padrão de rotateFurniture ("igual aos móveis").
  assert.match(body, /r\.rotationDeg = \(r\.rotationDeg \+ step \+ 360\) % 360;/);
});

// Product Owner, depois de ver a v1 só com largura: "a sacada deve ser
// livre e ter a possibilidade de movimentar para cima com o arraste do
// mouse, coloque uma alça na parte de cima e na parte de baixo."
test('Store.updateBalconyRailingVerticalLive existe e trava heightM/sillHeightM nos limites certos', () => {
  const source = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  const start = source.indexOf('updateBalconyRailingVerticalLive(balconyRailingId: string, heightM: number, sillHeightM: number): void {');
  assert.ok(start !== -1);
  const end = source.indexOf('\n  },', start);
  const body = source.slice(start, end);
  assert.match(body, /r\.heightM = Math\.max\(Core\.BALCONY_MIN_HEIGHT_M, Math\.min\(Core\.BALCONY_MAX_HEIGHT_M, heightM\)\);/);
  assert.match(body, /r\.sillHeightM = Math\.max\(0, Math\.min\(Core\.BALCONY_MAX_SILL_HEIGHT_M, sillHeightM\)\);/);
});

test('ViewportController: alça balconyHeightTop estica a altura mantendo sillHeightM fixo, mesma sensibilidade 0,02m/px da Pele de vidro', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (dragMode === 'balconyHeightTop') {");
  assert.ok(start !== -1);
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end);
  assert.match(body, /\(dragElementStart\.startScreenY - e\.clientY\) \* 0\.02/);
  assert.match(body, /balconyResizePreview\.scale\.y = candidateBrH \/ brTopEnt\.heightM;/);
});

test('ViewportController: alça balconyHeightBottom translada sillHeightM (sobe/desce a peça inteira), heightM fica fixo', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (dragMode === 'balconyHeightBottom') {");
  assert.ok(start !== -1);
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end);
  assert.match(body, /var candidateSillM = Math\.max\(0, dragElementStart\.sillHeightM \+ deltaSillM\);/);
  assert.doesNotMatch(body, /\.scale\.y/);
});

test('ViewportController: pointerup das duas alças verticais confirma via Store.commands.updateBalconyRailingVerticalLive', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (dragMode === 'balconyHeightTop' || dragMode === 'balconyHeightBottom') {");
  assert.ok(start !== -1);
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end);
  assert.match(body, /Store\.commands\.updateBalconyRailingVerticalLive\(selectedBalconyRailingId, finalBalconyHeight, finalBalconySill\);/);
});

test('Scene3DRenderer: sacada selecionada ganha alças balconyHeightTop/balconyHeightBottom, e as alças de largura sobem com sillHeightM', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('if (viewState.selectedBalconyRailing) {');
  assert.ok(start !== -1);
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end);
  assert.match(body, /var brHandleY = brYOffset \+ brSill \+ brSel\.heightM \/ 2;/);
  assert.match(body, /topHandle\.userData\.handle = 'balconyHeightTop';/);
  assert.match(body, /bottomHandle\.userData\.handle = 'balconyHeightBottom';/);
});

test('GizmoController.handleBalconyRailingAction gira em passos de 90°, igual ao móvel', () => {
  const source = readFileSync(new URL('../src/core/GizmoController.ts', import.meta.url), 'utf8');
  const start = source.indexOf('function handleBalconyRailingAction(');
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end);
  assert.match(body, /Store\.commands\.rotateBalconyRailing\(balconyRailingId, action === 'rotateCw' \? 90 : -90\);/);
  const dispatchStart = source.indexOf("const balconyRailingId = ViewportController.getSelectedBalconyRailingId();");
  assert.ok(dispatchStart !== -1);
});

test('ViewportController.isEditableMesh reconhece a categoria "balconyRailing" — senão a sacada nunca é selecionável/arrastável (bug real encontrado na verificação ao vivo)', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf('function isEditableMesh(mesh: any) {');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /mesh\.userData\.category === 'balconyRailing'/);
});

test('ViewportController: clique direito na sacada já selecionada abre o menu do gizmo (hitsSelected) — sem isso o gizmo nunca abre (bug real encontrado na verificação ao vivo)', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf('var hitsSelected = mesh && ((mesh.userData.wallId');
  const end = source.indexOf('\n', start);
  const body = source.slice(start, end);
  assert.match(body, /mesh\.userData\.balconyRailingId && mesh\.userData\.balconyRailingId === selectedBalconyRailingId/);
});

test('ViewportController.placeRoomPreset trata a chave "sacada-vidro" criando uma sacada solta', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (key === 'sacada-vidro') {");
  assert.ok(start !== -1);
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end);
  assert.match(body, /Store\.commands\.createBalconyRailing\(gxBr, gyBr\)/);
});
