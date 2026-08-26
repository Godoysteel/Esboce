import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createProject } from '../src/core/Core.ts';
import {
  CONSTRUCTION_SYSTEMS,
  hasCeramicMasonryEstimate,
} from '../src/core/ConstructionSystem.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/app/EsboceApplication.ts', import.meta.url), 'utf8');

test('novo projeto aceita os três sistemas construtivos oficiais', () => {
  assert.deepEqual(CONSTRUCTION_SYSTEMS.map((system) => system.id), [
    'ceramic_masonry',
    'structural_block',
    'light_steel_frame',
  ]);
  for (const system of CONSTRUCTION_SYSTEMS) {
    assert.equal(createProject(system.id).constructionSystem, system.id);
    assert.match(html, new RegExp(`data-construction-system="${system.id}"`));
  }
});

test('somente tijolos habilita a composição cerâmica', () => {
  assert.equal(hasCeramicMasonryEstimate('ceramic_masonry'), true);
  assert.equal(hasCeramicMasonryEstimate('structural_block'), false);
  assert.equal(hasCeramicMasonryEstimate('light_steel_frame'), false);
  assert.match(materialsSource, /hasCeramicMasonryEstimate\(q\.constructionSystem\).*q\.totals\.wallAreaNet/);
});

test('Tijolos e Steel Frame ficam selecionáveis; somente Bloco estrutural permanece travado', () => {
  const selector = html.match(/<div id="constructionSystemOverlay"[\s\S]*?<canvas id="navGizmoCanvas"/)?.[0] ?? '';
  const tijolosBlock = selector.match(/data-construction-system="ceramic_masonry"[^>]*>/)?.[0] ?? '';
  const blocoBlock = selector.match(/<button[^>]*data-construction-system="structural_block"[^>]*>/)?.[0] ?? '';
  const steelBlock = selector.match(/<button[^>]*data-construction-system="light_steel_frame"[^>]*>/)?.[0] ?? '';
  assert.doesNotMatch(tijolosBlock, /ts-disabled/, 'Tijolos precisa continuar selecionável');
  assert.match(blocoBlock, /ts-disabled/);
  assert.match(blocoBlock, /data-disabled-label="Bloco estrutural"/);
  assert.doesNotMatch(steelBlock, /ts-disabled/);
  assert.doesNotMatch(steelBlock, /data-disabled-label/);
  assert.match(steelBlock, /title="Criar projeto em Steel Frame"/);
});

test('clique em sistema travado não seleciona nada — só o hint global de "em breve" cuida do clique', () => {
  const start = appSource.indexOf('private setupConstructionSystemSelector(): void {');
  const end = appSource.indexOf('\n  }', start);
  const body = appSource.slice(start, end);
  assert.match(body, /if \(option\.classList\.contains\("ts-disabled"\)\) return;/);
});

test('seletor inicial é obrigatório e não oferece fechamento sem escolha', () => {
  const selector = html.match(/<div id="constructionSystemOverlay"[\s\S]*?<canvas id="navGizmoCanvas"/)?.[0] ?? '';
  assert.match(selector, /aria-modal="true"/);
  assert.doesNotMatch(selector, /constructionSystemClose|Fechar/);
});

test('barra superior mantém o sistema atual visível durante a edição', () => {
  assert.match(html, /id="constructionSystemIndicator"[^>]*aria-live="polite"/);
  assert.match(html, /id="constructionSystemIndicatorLabel"/);
});
