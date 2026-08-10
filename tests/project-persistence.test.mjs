import assert from 'node:assert/strict';
import test from 'node:test';

import { createProject, createWallEntity, createOpeningEntity } from '../src/core/Core.ts';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  ProjectFormatError,
  decodeProjectDocument,
  encodeProjectDocument,
  exportProjectBackup,
  importProjectBackup,
} from '../src/core/ProjectPersistence.ts';

test('salvamento novo usa envelope com versão explícita', () => {
  const project = createProject();
  const document = encodeProjectDocument(project);
  assert.equal(document.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.deepEqual(document.project, project);
});

test('projeto legado sem envelope é migrado e recebe campos atuais ausentes', () => {
  const legacy = {
    floors: [{ id: 'floor-1', name: 'Térreo', walls: [], columns: [], roofs: [], openings: [], varandas: [], roomFinishes: {} }],
    currentFloorIndex: 0,
    layers: { telhado: false },
    foundationType: 'radier',
  };
  const decoded = decodeProjectDocument(legacy);
  assert.equal(decoded.sourceVersion, 0);
  assert.equal(decoded.migrated, true);
  assert.deepEqual(decoded.project.floors[0].lajes, []);
  assert.deepEqual(decoded.project.floors[0].furniture, []);
  assert.equal(decoded.project.layers.telhado, false);
  assert.equal(decoded.project.layers.fundacao, true);
  assert.equal(decoded.project.constructionSystem, 'ceramic_masonry');
});

test('sistema construtivo escolhido faz parte do documento salvo', () => {
  const project = createProject('light_steel_frame');
  const restored = decodeProjectDocument(encodeProjectDocument(project));
  assert.equal(restored.project.constructionSystem, 'light_steel_frame');
});

test('sistema construtivo desconhecido é recusado', () => {
  const project = createProject();
  project.constructionSystem = 'sistema-inventado';
  assert.throws(() => encodeProjectDocument(project), /constructionSystem.*inválido/);
});

test('índice de pavimento fora do intervalo é recuperado com segurança', () => {
  const project = createProject();
  project.currentFloorIndex = 99;
  assert.equal(decodeProjectDocument(project).project.currentFloorIndex, 0);
});

test('abertura órfã faz o documento ser recusado', () => {
  const project = createProject();
  project.floors[0].openings.push(createOpeningEntity('parede-inexistente', 'door', 1, 'opening-1'));
  assert.throws(() => encodeProjectDocument(project), ProjectFormatError);
});

test('identificadores duplicados fazem o documento ser recusado', () => {
  const project = createProject();
  project.floors[0].walls.push(
    createWallEntity(0, 0, 20, 0, 'duplicate'),
    createWallEntity(20, 0, 40, 0, 'duplicate'),
  );
  assert.throws(() => encodeProjectDocument(project), /identificadores.*duplicados/);
});

test('documento de versão futura não é aberto silenciosamente', () => {
  const project = createProject();
  assert.throws(
    () => decodeProjectDocument({ schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION + 1, project }),
    /mais nova que a suportada/,
  );
});

test('backup JSON faz ida e volta sem perder o projeto', () => {
  const project = createProject();
  project.floors[0].walls.push(createWallEntity(0, 0, 80, 0, 'wall-1'));
  const json = exportProjectBackup(project);
  const restored = importProjectBackup(json);
  assert.deepEqual(restored.project, project);
  assert.match(json, new RegExp(`"schemaVersion": ${CURRENT_PROJECT_SCHEMA_VERSION}`));
});

test('backup que não é JSON apresenta erro compreensível', () => {
  assert.throws(() => importProjectBackup('{quebrado'), /não contém JSON válido/);
});
