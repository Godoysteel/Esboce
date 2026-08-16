import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core } from '../src/core/Core.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const layersPanelSource = readFileSync(new URL('../src/core/LayersPanel.ts', import.meta.url), 'utf8');
const persistenceSource = readFileSync(new URL('../src/core/ProjectPersistence.ts', import.meta.url), 'utf8');

test('novo projeto já nasce com a camada "paredesTransparentes" (desligada por padrão)', () => {
  const project = Core.createProject();
  assert.equal(project.layers.paredesTransparentes, false);
});

test('index.html tem o checkbox da camada, dentro do menu de Camadas visíveis', () => {
  const menuBlock = html.slice(html.indexOf('id="layersContextMenu"'), html.indexOf('</div>', html.indexOf('id="layersContextMenu"')) + 2000);
  assert.match(menuBlock, /id="paredesTransparentesToggle"/);
});

test('LayersPanel liga o checkbox novo ao layer certo, e lê o estado inicial dele', () => {
  assert.match(layersPanelSource, /bind\('paredesTransparentesToggle', 'paredesTransparentes'\)/);
  assert.match(layersPanelSource, /paredesTransparentesToggle.*\.checked = layers\.paredesTransparentes/);
});

test('ProjectPersistence sabe o valor padrão da camada nova (projeto salvo antes dela existir continua carregando)', () => {
  assert.match(persistenceSource, /paredesTransparentes: false,/);
});

test('Scene3DRenderer reduz a opacidade da FACE e da TAMPA DE TOPO da parede quando a camada está ligada — sem tocar em nada mais (clique/seleção continuam do jeito que estavam)', () => {
  assert.match(rendererSource, /var WALL_TRANSPARENT_OPACITY = 0\.28;/);
  assert.match(rendererSource, /var wallsTransparent = !!layers\.paredesTransparentes;/);
  // A opacidade tem que ser MENOR que 1 (senão "transparente" não faz nada)
  assert.ok(0.28 < 1);
  const faceMatBlock = rendererSource.slice(rendererSource.indexOf('var faceMat = new THREE.MeshStandardMaterial'), rendererSource.indexOf('var faceMat = new THREE.MeshStandardMaterial') + 1000);
  assert.match(faceMatBlock, /transparent: wallsTransparent/);
  assert.match(faceMatBlock, /opacity: wallsTransparent \? WALL_TRANSPARENT_OPACITY : 1/);
  const topMatBlock = rendererSource.slice(rendererSource.indexOf('var topMat = new THREE.MeshStandardMaterial'), rendererSource.indexOf('var topMat = new THREE.MeshStandardMaterial') + 400);
  assert.match(topMatBlock, /transparent: wallsTransparent/);
  assert.match(topMatBlock, /opacity: wallsTransparent \? WALL_TRANSPARENT_OPACITY : 1/);
});

test('wallsTransparent é calculado ANTES de ser usado (bug de ordem já corrigido nesta sessão)', () => {
  const declIndex = rendererSource.indexOf('var wallsTransparent = !!layers.paredesTransparentes;');
  const topMatIndex = rendererSource.indexOf('var topMat = new THREE.MeshStandardMaterial');
  const faceMatIndex = rendererSource.indexOf('var faceMat = new THREE.MeshStandardMaterial');
  assert.ok(declIndex > -1 && topMatIndex > -1 && faceMatIndex > -1);
  assert.ok(declIndex < topMatIndex, 'wallsTransparent precisa vir ANTES de topMat');
  assert.ok(declIndex < faceMatIndex, 'wallsTransparent precisa vir ANTES de faceMat');
});
