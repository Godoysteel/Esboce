import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/core/Core.ts';
import { decodeProjectDocument, encodeProjectDocument } from '../src/core/ProjectPersistence.ts';

test('projeto novo nasce com rede hidráulica vazia e camada visível', () => {
  const project = createProject();
  assert.deepEqual(project.hydraulics, { nodes: [], segments: [] });
  assert.equal(project.layers.instalacoes, true);
});

test('rede hidráulica procedural sobrevive ao salvamento', () => {
  const project = createProject();
  project.hydraulics.nodes.push(
    { id: 'n1', kind: 'source', networkType: 'cold_water', label: "Caixa d'água", x: 0, y: 0, elevationM: 3 },
    { id: 'n2', kind: 'fixture', networkType: 'cold_water', label: 'Chuveiro', x: 40, y: 0, elevationM: 2.1 },
  );
  project.hydraulics.segments.push({ id: 's1', networkType: 'cold_water', startNodeId: 'n1', endNodeId: 'n2', diameterMm: 25 });
  const decoded = decodeProjectDocument(encodeProjectDocument(project));
  assert.deepEqual(decoded.project.hydraulics, project.hydraulics);
});

test('segmento hidráulico órfão é recusado', () => {
  const project = createProject();
  project.hydraulics.segments.push({ id: 's1', networkType: 'cold_water', startNodeId: 'ausente', endNodeId: 'tambem-ausente', diameterMm: 25 });
  assert.throws(() => encodeProjectDocument(project), /segmento referencia ponto inexistente/);
});
