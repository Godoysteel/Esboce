import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProject, createTerrenoEntity, createTerrenoMuroEntity, terrenoMuroSegment, terrenoMuroId,
  TERRENO_MURO_HEIGHT_M, WALL_HEIGHT, GRID, wallLengthMeters,
} from '../src/core/Core.ts';
import {
  CURRENT_PROJECT_SCHEMA_VERSION, ProjectFormatError, decodeProjectDocument, encodeProjectDocument,
} from '../src/core/ProjectPersistence.ts';

// Nota: Store.setTerreno/toggleTerrenoMuroSide não são chamados
// diretamente aqui — Store.ts tem import de VALOR de Core ('./Core.js',
// sem arquivo .js correspondente no disco), o que já impedia testar
// Store.ts sob `node --experimental-strip-types` antes desta mudança
// (nenhum teste do projeto importa Store.ts, ViewportController.ts ou
// Scene3DRenderer.ts hoje, pelo mesmo motivo). Os testes abaixo cobrem a
// mesma lógica através das funções puras do Core que Store.setTerreno e
// Store.toggleTerrenoMuroSide de fato chamam por baixo — a orquestração
// de undo/evento do Store em si segue sem cobertura automatizada, igual
// ao resto do Store/ViewportController.

test('createTerrenoEntity: nasce sem muros', () => {
  const terreno = createTerrenoEntity(25, 10);
  assert.equal(terreno.larguraM, 25);
  assert.equal(terreno.comprimentoM, 10);
  assert.deepEqual(terreno.muros, []);
});

test('terrenoMuroSegment: cada lado do retângulo 25×10 bate com a aresta correspondente, em unidades de grade (metros × GRID)', () => {
  const terreno = createTerrenoEntity(25, 10);
  const w = 25 * GRID, c = 10 * GRID;
  assert.deepEqual(terrenoMuroSegment(terreno, 'minZ'), { x1: 0, y1: 0, x2: w, y2: 0 });
  assert.deepEqual(terrenoMuroSegment(terreno, 'maxZ'), { x1: 0, y1: c, x2: w, y2: c });
  assert.deepEqual(terrenoMuroSegment(terreno, 'minX'), { x1: 0, y1: 0, x2: 0, y2: c });
  assert.deepEqual(terrenoMuroSegment(terreno, 'maxX'), { x1: w, y1: 0, x2: w, y2: c });
});

test('terrenoMuroSegment: comprimento real do muro (Core.wallLengthMeters) bate com o metro digitado — não é 1/GRID do valor', () => {
  const terreno = createTerrenoEntity(25, 10);
  const minZ = createTerrenoMuroEntity(terreno, 'minZ'); // lado "largura", 25m
  const minX = createTerrenoMuroEntity(terreno, 'minX'); // lado "comprimento", 10m
  assert.equal(wallLengthMeters(minZ), 25);
  assert.equal(wallLengthMeters(minX), 10);
});

test('createTerrenoMuroEntity: gera parede com id determinístico por lado e altura própria (menor que a da casa)', () => {
  const terreno = createTerrenoEntity(25, 10);
  const muro = createTerrenoMuroEntity(terreno, 'minZ');
  assert.equal(muro.id, terrenoMuroId('minZ'));
  assert.equal(muro.heightM, TERRENO_MURO_HEIGHT_M);
  assert.ok(TERRENO_MURO_HEIGHT_M < WALL_HEIGHT, 'muro deve ser mais baixo que parede da casa por padrão');
});

test('setTerreno (lógica): opcional — projeto novo não tem terreno até ser definido', () => {
  const project = createProject();
  assert.equal(project.terreno, undefined);
  project.terreno = createTerrenoEntity(25, 10);
  assert.equal(project.terreno.larguraM, 25);
  assert.equal(project.terreno.comprimentoM, 10);
  assert.deepEqual(project.terreno.muros, []);
});

test('toggleTerrenoMuroSide (lógica): primeiro clique cria muro completo (aceita Opening depois), segundo clique remove', () => {
  const project = createProject();
  project.terreno = createTerrenoEntity(25, 10);

  // 1º clique: cria.
  let index = project.terreno.muros.findIndex((m) => m.id === terrenoMuroId('minZ'));
  assert.equal(index, -1);
  project.terreno.muros.push(createTerrenoMuroEntity(project.terreno, 'minZ'));
  assert.equal(project.terreno.muros.length, 1);
  assert.equal(project.terreno.muros[0].id, terrenoMuroId('minZ'));

  // 2º clique: remove.
  index = project.terreno.muros.findIndex((m) => m.id === terrenoMuroId('minZ'));
  project.terreno.muros.splice(index, 1);
  assert.equal(project.terreno.muros.length, 0);
});

test('toggleTerrenoMuroSide (lógica): marcar só um lado gera muro só daquele lado', () => {
  const project = createProject();
  project.terreno = createTerrenoEntity(25, 10);
  project.terreno.muros.push(createTerrenoMuroEntity(project.terreno, 'maxX'));

  assert.equal(project.terreno.muros.length, 1);
  assert.equal(project.terreno.muros[0].id, terrenoMuroId('maxX'));
  assert.deepEqual(
    { x1: project.terreno.muros[0].x1, y1: project.terreno.muros[0].y1, x2: project.terreno.muros[0].x2, y2: project.terreno.muros[0].y2 },
    terrenoMuroSegment(project.terreno, 'maxX'),
  );
});

test('setTerreno (lógica): redefinir tamanho preserva os lados que já tinham muro, recalculados no novo tamanho', () => {
  const project = createProject();
  project.terreno = createTerrenoEntity(25, 10);
  project.terreno.muros.push(createTerrenoMuroEntity(project.terreno, 'minZ'));
  project.terreno.muros.push(createTerrenoMuroEntity(project.terreno, 'maxX'));

  // Mesma lógica de Store.setTerreno: guarda quais lados tinham muro,
  // recria o terreno no novo tamanho, e regenera só esses lados.
  const sidesWithMuro = project.terreno.muros.map((m) => m.id);
  const novoTerreno = createTerrenoEntity(30, 12);
  novoTerreno.muros = ['minX', 'maxX', 'minZ', 'maxZ']
    .filter((side) => sidesWithMuro.includes(terrenoMuroId(side)))
    .map((side) => createTerrenoMuroEntity(novoTerreno, side));
  project.terreno = novoTerreno;

  assert.equal(project.terreno.larguraM, 30);
  assert.equal(project.terreno.comprimentoM, 12);
  const ids = project.terreno.muros.map((m) => m.id).sort();
  assert.deepEqual(ids, [terrenoMuroId('maxX'), terrenoMuroId('minZ')].sort());
  const minZ = project.terreno.muros.find((m) => m.id === terrenoMuroId('minZ'));
  assert.deepEqual(
    { x1: minZ.x1, y1: minZ.y1, x2: minZ.x2, y2: minZ.y2 },
    terrenoMuroSegment(project.terreno, 'minZ'),
  );
});

test('persistência: schemaVersion atual é 7 e projeto v5 sem terreno migra sem quebrar', () => {
  assert.equal(CURRENT_PROJECT_SCHEMA_VERSION, 7);
  const legacy = {
    schemaVersion: 5,
    project: {
      floors: [{ id: 'floor-1', name: 'Térreo', walls: [], columns: [], roofs: [], openings: [], varandas: [], roomFinishes: {} }],
      currentFloorIndex: 0,
      layers: {},
      foundationType: 'baldrame',
      constructionSystem: 'ceramic_masonry',
    },
  };
  const decoded = decodeProjectDocument(legacy);
  assert.equal(decoded.migrated, true);
  assert.equal(decoded.project.terreno, undefined);
  assert.deepEqual(decoded.project.hydraulics, { nodes: [], segments: [] });
});

test('persistência: terreno com muro sobrevive a ida e volta (encode/decode)', () => {
  const project = createProject();
  project.terreno = createTerrenoEntity(25, 10);
  project.terreno.muros.push(createTerrenoMuroEntity(project.terreno, 'minZ'));
  const document = encodeProjectDocument(project);
  const decoded = decodeProjectDocument(document);
  assert.deepEqual(decoded.project.terreno, project.terreno);
});

test('persistência: rejeita terreno com largura/comprimento inválidos', () => {
  const bad = {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    project: {
      ...encodeProjectDocument(createProject()).project,
      terreno: { larguraM: 0, comprimentoM: 10, muros: [] },
    },
  };
  assert.throws(() => decodeProjectDocument(bad), ProjectFormatError);
});

test('persistência: rejeita muro de terreno com id fora do padrão esperado', () => {
  const bad = {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    project: {
      ...encodeProjectDocument(createProject()).project,
      terreno: {
        larguraM: 25, comprimentoM: 10,
        muros: [{ id: 'wall_qualquer', x1: 0, y1: 0, x2: 25, y2: 0 }],
      },
    },
  };
  assert.throws(() => decodeProjectDocument(bad), ProjectFormatError);
});
