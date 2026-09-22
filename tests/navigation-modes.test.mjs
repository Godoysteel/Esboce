import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  NAVIGATION_MODES,
  NAVIGATION_MODE_LABELS,
  isNavigationMode,
  resolveDragAction,
} from '../src/core/NavigationSchemes.ts';

const viewportControllerSource = await readFile(
  new URL('../src/core/ViewportController.ts', import.meta.url),
  'utf8',
);
const navGizmoSource = await readFile(
  new URL('../src/core/NavGizmo.ts', import.meta.url),
  'utf8',
);
const esboceApplicationSource = await readFile(
  new URL('../src/app/EsboceApplication.ts', import.meta.url),
  'utf8',
);
const indexHtmlSource = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

// --- resolveDragAction (função pura — roda de verdade, sem regex) ---

test('resolveDragAction: Blender — botão 1 ou 2 arrasta, Shift alterna orbit/pan (comportamento de sempre do Esboce)', () => {
  assert.equal(resolveDragAction('blender', 1, false), 'orbit');
  assert.equal(resolveDragAction('blender', 2, false), 'orbit');
  assert.equal(resolveDragAction('blender', 1, true), 'pan');
  assert.equal(resolveDragAction('blender', 2, true), 'pan');
  assert.equal(resolveDragAction('blender', 0, false), null, 'botão esquerdo nunca é câmera, em nenhum modo');
});

test('resolveDragAction: Revit — só o botão do meio é câmera (o direito fica livre pro menu de contexto); Shift alterna pan/orbit', () => {
  assert.equal(resolveDragAction('revit', 1, false), 'pan');
  assert.equal(resolveDragAction('revit', 1, true), 'orbit');
  assert.equal(resolveDragAction('revit', 2, false), null, 'botão direito não é câmera no Revit — precisa continuar livre pro menu de contexto');
  assert.equal(resolveDragAction('revit', 2, true), null);
  assert.equal(resolveDragAction('revit', 0, false), null);
});

test('resolveDragAction: Fácil — só o botão direito pana; nunca orbita por arraste (orbit é só pela bússola/NavGizmo); Shift não muda nada', () => {
  assert.equal(resolveDragAction('facil', 2, false), 'pan');
  assert.equal(resolveDragAction('facil', 2, true), 'pan');
  assert.equal(resolveDragAction('facil', 1, false), null, 'botão do meio não é câmera no Fácil');
  assert.equal(resolveDragAction('facil', 0, false), null);
});

test('isNavigationMode/NAVIGATION_MODES/NAVIGATION_MODE_LABELS: os três modos existem e têm rótulo em português', () => {
  assert.deepEqual(NAVIGATION_MODES, ['facil', 'blender', 'revit']);
  NAVIGATION_MODES.forEach((mode) => {
    assert.ok(isNavigationMode(mode));
    assert.ok(NAVIGATION_MODE_LABELS[mode]);
  });
  assert.equal(isNavigationMode('algo-invalido'), false);
  assert.equal(isNavigationMode(null), false);
});

// --- ViewportController: zoom sempre no cursor, dispatch de orbit/pan por resolveDragAction ---

test('ViewportController: onWheel usa zoomAtCursor (zoom no cursor) em vez de escalar camDist direto em direção ao alvo fixo', () => {
  const wheelStart = viewportControllerSource.indexOf('function onWheel(');
  assert.notEqual(wheelStart, -1, 'onWheel não encontrada');
  const wheelBlock = viewportControllerSource.slice(wheelStart, wheelStart + 900);
  assert.match(wheelBlock, /zoomAtCursor\(e\.clientX, e\.clientY, e\.deltaY\);/);
});

test('ViewportController.zoomAtCursor: desloca camTarget em direção ao ponto do mundo sob o cursor (raycastGroundWorldPoint), proporcional à fração que a distância mudou', () => {
  const fnStart = viewportControllerSource.indexOf('function zoomAtCursor(');
  assert.notEqual(fnStart, -1, 'zoomAtCursor não encontrada');
  const fnBlock = viewportControllerSource.slice(fnStart, fnStart + 900);
  assert.match(fnBlock, /var appliedFactor = newDist \/ camDist;/);
  assert.match(fnBlock, /var cursorWorld = raycastGroundWorldPoint\(clientX, clientY\);/);
  assert.match(fnBlock, /camTarget\.x \+= \(cursorWorld\.x - camTarget\.x\) \* \(1 - appliedFactor\);/);
});

test('ViewportController.onPointerMove: orbit/pan por arraste (botão 1/2) decidem a ação via resolveDragAction, não mais por Shift fixo', () => {
  const moveStart = viewportControllerSource.indexOf('function onPointerMove(');
  assert.notEqual(moveStart, -1);
  const moveBlock = viewportControllerSource.slice(moveStart, moveStart + 3000);
  assert.match(moveBlock, /var action = downButton === 0 \? 'orbit' : resolveDragAction\(navigationMode, downButton, !!e\.shiftKey\);/);
  assert.match(moveBlock, /if \(action === 'pan'\) \{/);
  assert.match(moveBlock, /if \(action === 'orbit'\) \{/);
});

test('ViewportController: Fácil — botão ESQUERDO em área vazia (sem ferramenta, sem alça/objeto embaixo) também orbita, sem roubar clique de seleção/edição/desenho', () => {
  const downStart = viewportControllerSource.indexOf('function onPointerDown(');
  assert.notEqual(downStart, -1);
  const downBlock = viewportControllerSource.slice(downStart, downStart + 1600);
  assert.match(downBlock, /if \(downButton === 0 && navigationMode === 'facil' && currentTool === null && !pickHandle\(e\.clientX, e\.clientY\) && !pickMesh\(e\.clientX, e\.clientY\)\) \{/);
  assert.match(downBlock, /leftDragOrbitsCamera = true;/);

  const moveStart = viewportControllerSource.indexOf('function onPointerMove(');
  const moveBlock = viewportControllerSource.slice(moveStart, moveStart + 500);
  assert.match(moveBlock, /downButton === 1 \|\| downButton === 2 \|\| \(downButton === 0 && leftDragOrbitsCamera\)/);

  const upStart = viewportControllerSource.indexOf('function onPointerUp(');
  assert.notEqual(upStart, -1);
  const upBlock = viewportControllerSource.slice(upStart, upStart + 500);
  assert.match(upBlock, /if \(downButton === 0 && leftDragOrbitsCamera\) \{/);
  assert.match(upBlock, /leftDragOrbitsCamera = false;/);
});

test('ViewportController: getNavigationMode/setNavigationMode existem e ficam expostos no namespace público', () => {
  assert.match(viewportControllerSource, /export function getNavigationMode\(\): NavigationMode \{/);
  assert.match(viewportControllerSource, /export function setNavigationMode\(mode: NavigationMode\): void \{/);
  const exportsStart = viewportControllerSource.indexOf('export const ViewportController = {');
  assert.notEqual(exportsStart, -1);
  const exportsBlock = viewportControllerSource.slice(exportsStart, exportsStart + 1400);
  assert.match(exportsBlock, /getNavigationMode, setNavigationMode, applyGizmoDrag,/);
});

test('ViewportController.applyGizmoDrag: usa os MESMOS clamps de elevação do orbit por arraste (0.15-1.4) — nunca vira de cabeça pra baixo também por esse caminho', () => {
  const fnStart = viewportControllerSource.indexOf('export function applyGizmoDrag(');
  assert.notEqual(fnStart, -1);
  const fnBlock = viewportControllerSource.slice(fnStart, fnStart + 700);
  assert.match(fnBlock, /camElev = Math\.max\(0\.15, Math\.min\(1\.4, camElev \+ dElev\)\);/);
});

// --- NavGizmo: casinha arrastável ---

test('NavGizmo: casinha responde a pointerdown/pointermove e expõe setOnDrag pro ViewportController registrar', () => {
  assert.match(navGizmoSource, /canvasEl\.addEventListener\('pointerdown',/);
  assert.match(navGizmoSource, /canvasEl\.addEventListener\('pointermove',/);
  assert.match(navGizmoSource, /export function setOnDrag\(cb: \(dAngle: number, dElev: number\) => void\): void \{/);
  assert.match(navGizmoSource, /export const NavGizmo = \{ init, update, setOnDrag \};/);
});

test('index.html: #navGizmoCanvas aceita clique (pointer-events: auto) — precisa ser arrastável pro modo Fácil funcionar', () => {
  const styleStart = indexHtmlSource.indexOf('#navGizmoCanvas {');
  assert.notEqual(styleStart, -1);
  const styleBlock = indexHtmlSource.slice(styleStart, styleStart + 400);
  assert.match(styleBlock, /pointer-events: auto;/);
});

// --- UI: botão "Nav" + menu de 3 opções ---

test('index.html: botão "Nav" e menu com as 3 opções de navegação existem no painel de visualização', () => {
  assert.match(indexHtmlSource, /<button class="tb-viewmode-btn" id="viewModeNavBtn"/);
  const menuStart = indexHtmlSource.indexOf('<div id="navigationModeMenu" class="ctx-menu">');
  assert.notEqual(menuStart, -1);
  const menuBlock = indexHtmlSource.slice(menuStart, menuStart + 400);
  assert.match(menuBlock, /data-navigation-mode="facil"/);
  assert.match(menuBlock, /data-navigation-mode="blender"/);
  assert.match(menuBlock, /data-navigation-mode="revit"/);
});

test('EsboceApplication: preferência de navegação lida/gravada em localStorage (mesmo padrão do DISCLAIMER_DISMISSED_KEY), com try/catch e fallback pro padrão "facil"', () => {
  assert.match(esboceApplicationSource, /private static readonly NAVIGATION_MODE_KEY = "esboce_navigation_mode_v1";/);
  const setupStart = esboceApplicationSource.indexOf('private setupNavigationModePreference(): void {');
  assert.notEqual(setupStart, -1);
  const setupBlock = esboceApplicationSource.slice(setupStart, setupStart + 700);
  assert.match(setupBlock, /localStorage\.getItem\(EsboceApplication\.NAVIGATION_MODE_KEY\)/);
  assert.match(setupBlock, /const mode: NavigationMode = isNavigationMode\(stored\) \? stored : "facil";/);
  assert.match(setupBlock, /ViewportController\.setNavigationMode\(mode\);/);
});

test('EsboceApplication: escolher uma opção no menu "Nav" grava a preferência e atualiza o esquema ativo', () => {
  const clickStart = esboceApplicationSource.indexOf('navModeMenu.addEventListener("click",');
  assert.notEqual(clickStart, -1);
  const clickBlock = esboceApplicationSource.slice(clickStart, clickStart + 700);
  assert.match(clickBlock, /ViewportController\.setNavigationMode\(mode\);/);
  assert.match(clickBlock, /localStorage\.setItem\(EsboceApplication\.NAVIGATION_MODE_KEY, mode\);/);
});

test('EsboceApplication: setupNavigationModePreference roda antes de bindApplicationEvents, depois de initializeControllers (ViewportController já precisa existir)', () => {
  const iControllers = esboceApplicationSource.indexOf('this.initializeControllers();');
  const iNavPref = esboceApplicationSource.indexOf('this.setupNavigationModePreference();');
  const iBind = esboceApplicationSource.indexOf('this.bindApplicationEvents();');
  assert.ok(iControllers !== -1 && iNavPref !== -1 && iBind !== -1);
  assert.ok(iControllers < iNavPref, 'ViewportController precisa estar inicializado antes de setNavigationMode ser chamado');
  assert.ok(iNavPref < iBind);
});
