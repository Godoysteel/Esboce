import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  computeGlazingLayout, netGlassSizeM, MIN_MODULE_M, JOINT_MM,
  MULLION_VERTICAL_WIDTH_M, MULLION_HORIZONTAL_WIDTH_M, FRAME_WIDTH_M, PROFILE_DEPTH_M,
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

// --- netGlassSizeM: desconto da junta de 20mm -------------------------

test('junta padrão é 20mm', () => {
  assert.equal(JOINT_MM, 20);
});

test('vidro líquido descontando a junta de 20mm', () => {
  assert.ok(Math.abs(netGlassSizeM(1.2) - (1.2 - 0.02)) < 1e-9);
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

test('GlazingPanel: ajuste visual do vidro sobrevive ao salvamento', () => {
  const floor = createFloorEntity('Térreo');
  floor.glazingPanels.push({
    id: 'gp-material', state: 'preview', widthM: 2, heightM: 2, moduleTargetM: 1.2,
    glassMaterial: { color: '#789abc', opacity: 0.8, roughness: 0.22, metalness: 0.65, reflectionIntensity: 1.9 },
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  assert.deepEqual(decoded.project.floors[0].glazingPanels[0].glassMaterial, {
    color: '#789abc', opacity: 0.8, roughness: 0.22, metalness: 0.65, reflectionIntensity: 1.9,
  });
});

// --- Orientação do vidro (DEC-118) --------------------------------------
// Product Owner: "quando aplico a fachada de vidro na parede, o vidro fica
// virado para dentro da casa." Causa raiz: o vidro (buildGlazingPanelGroup)
// fica só na face local +Z do painel — não centralizado —, e a rotação do
// painel encostado (buildGlazingPanelAttachedMesh) usava só o ângulo da
// parede (atan2), que aponta pro lado que a parede por acaso foi desenhada
// (x1→x2), sem relação com o lado real que o usuário arrastou o painel.
// Corrigido com `normalSign` (mesmo campo/técnica de VolumeBox.normalSign,
// já usado pra Bloco de Volumetria) — decidido uma vez no encosto, a partir
// de que lado do eixo da parede o painel estava ao soltar.

test('GlazingPanel: normalSign sobrevive ao salvamento, e documento antigo (sem o campo) continua abrindo', () => {
  const floor = createFloorEntity('Térreo');
  floor.walls.push({ id: 'w1', x1: 0, y1: 0, x2: 5, y2: 0 });
  floor.glazingPanels.push({
    id: 'gp1', state: 'attached', widthM: 3.6, heightM: 2.4, moduleTargetM: 1.2,
    wallId: 'w1', offsetM: 2.5, sillHeightM: 0, normalSign: -1,
  });
  const project = { floors: [floor], currentFloorIndex: 0, layers: {}, foundationType: 'radier', constructionSystem: 'ceramic_masonry' };
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  assert.equal(decoded.project.floors[0].glazingPanels[0].normalSign, -1);

  // documento salvo antes desta versão, sem o campo — abre normal.
  const legacyDoc = { schemaVersion: 9, project: structuredClone(project) };
  delete legacyDoc.project.floors[0].glazingPanels[0].normalSign;
  const decodedLegacy = decodeProjectDocument(legacyDoc);
  assert.equal(decodedLegacy.project.floors[0].glazingPanels[0].normalSign, undefined);
});

test('Store.attachGlazingPanelToWall calcula normalSign a partir do lado que o painel estava ao soltar (mesmo teste de sinal de attachVolumeBoxToWall)', () => {
  const source = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  const start = source.indexOf('attachGlazingPanelToWall(glazingPanelId: string, wallId: string): void {');
  const end = source.indexOf('\n  },', start);
  const body = source.slice(start, end);
  assert.match(body, /const nx = -uy, ny = ux;/);
  assert.match(body, /const side = \(\(p\.x \?\? projX\) - projX\) \* nx \+ \(\(p\.y \?\? projY\) - projY\) \* ny;/);
  assert.match(body, /p\.normalSign = side < 0 \? -1 : 1;/);
});

test('Scene3DRenderer aplica +180° na rotação do painel encostado quando normalSign é -1, espelhando a face do vidro pro lado certo', () => {
  const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  const start = source.indexOf('function buildGlazingPanelAttachedMesh(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /var sign = panel\.normalSign === -1 \? -1 : 1;/);
  assert.match(body, /hitMesh\.rotation\.y = -Math\.atan2\(uy, ux\) \+ \(sign === -1 \? Math\.PI : 0\);/);
});

// DEC-130 — Product Owner: "pele de vidro" (Vitrô renomeado) precisa
// alcançar alturas MAIORES que a parede em que encosta (fachada de
// vidro contínua, não um vão recortado dentro da parede). Antes,
// updateGlazingPanelSizeLive travava a altura máxima em
// `Core.WALL_HEIGHT - sillHeightM` sempre que o painel estava
// encostado — ~2,7-2,8m na prática, o teto de "uns 3 metros" relatado.
test('Store.updateGlazingPanelSizeLive: altura máxima do painel encostado NÃO trava mais em Core.WALL_HEIGHT — mesmo teto generoso (10m) do painel solto (DEC-130)', () => {
  const source = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
  const start = source.indexOf('updateGlazingPanelSizeLive(glazingPanelId: string, widthM: number, heightM: number, centerDeltaM = 0): void {');
  const end = source.indexOf('\n  },', start);
  const body = source.slice(start, end);
  assert.match(body, /const maxHeightM = 10;/);
  assert.doesNotMatch(body, /maxHeightM = Math\.max\(0\.5, Core\.WALL_HEIGHT/);
});

test('ViewportController: arrasto da alça de altura da pele de vidro usa 0,02m\\/px (dobro do padrão de 0,01m\\/px), pra caber num arrasto de tela o novo teto de 10m', () => {
  const source = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
  const start = source.indexOf("if (dragMode === 'glazingHeight') {");
  const end = source.indexOf('\n    }', start);
  const body = source.slice(start, end);
  assert.match(body, /\(dragElementStart\.startScreenY - e\.clientY\) \* 0\.02/);
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

// --- Largura/profundidade dos perfis (Etapa 2c) -------------------------
// Valores extraídos do modelo de referência feito no Blender pelo
// usuário (Fachada_Glazing.glb) — moldura e travessa interna com a
// MESMA largura (perfil retangular simples, sem entalhe).

test('largura da moldura e dos perfis internos batem com o modelo de referência (~4,9cm)', () => {
  assert.ok(Math.abs(FRAME_WIDTH_M - 0.049) < 0.001);
  assert.ok(Math.abs(MULLION_VERTICAL_WIDTH_M - 0.049) < 0.001);
  assert.ok(Math.abs(MULLION_HORIZONTAL_WIDTH_M - 0.049) < 0.001);
});

test('moldura de contorno usa a mesma largura dos perfis internos (modelo de referência não diferencia vertical/horizontal)', () => {
  assert.equal(FRAME_WIDTH_M, MULLION_VERTICAL_WIDTH_M);
  assert.equal(MULLION_VERTICAL_WIDTH_M, MULLION_HORIZONTAL_WIDTH_M);
});

test('profundidade do perfil bate com o modelo de referência (~9,58cm)', () => {
  assert.ok(Math.abs(PROFILE_DEPTH_M - 0.0958) < 0.001);
});

test('largura e profundidade dos perfis são positivas e com piso de segurança razoável', () => {
  assert.ok(MULLION_VERTICAL_WIDTH_M > 0);
  assert.ok(MULLION_HORIZONTAL_WIDTH_M > 0);
  assert.ok(PROFILE_DEPTH_M > 0);
  // Nenhum perfil deve ser mais largo que o próprio módulo mínimo,
  // senão o grid não teria espaço pra abrigar vidro nenhum.
  assert.ok(MULLION_VERTICAL_WIDTH_M < MIN_MODULE_M);
});
