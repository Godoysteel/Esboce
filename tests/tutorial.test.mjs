import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Tutorial.ts importa Store.js (que por sua vez importa Core.js,
// Hydraulics.js, types.js...) — mesma limitação documentada em
// navigation-modes.test.mjs/materials-pdf-export.test.mjs: o
// redirecionamento ".js" -> ".ts" nos imports relativos só o Vite
// resolve, não o test runner nativo do Node. Testado por busca de
// texto/regex no código-fonte.
const tutorialSource = await readFile(
  new URL('../src/core/Tutorial.ts', import.meta.url),
  'utf8',
);
const indexHtmlSource = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);
const esboceApplicationSource = await readFile(
  new URL('../src/app/EsboceApplication.ts', import.meta.url),
  'utf8',
);

function stepBlock(source, stepId) {
  const marker = "id: '" + stepId + "'";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'passo "' + stepId + '" não encontrado em STEPS');
  const end = source.indexOf("\n  {", start + marker.length);
  return source.slice(start, end === -1 ? source.length : end);
}

test('as 7 etapas existem, na ordem certa', () => {
  const start = tutorialSource.indexOf('const STEPS: TutorialStep[] = [');
  const end = tutorialSource.indexOf('\n];', start);
  const body = tutorialSource.slice(start, end);
  const order = ['room-create', 'room-second', 'door', 'window', 'forro', 'roof', 'budget'];
  let cursor = -1;
  order.forEach((id) => {
    const idx = body.indexOf("id: '" + id + "'");
    assert.notEqual(idx, -1, 'etapa "' + id + '" não encontrada');
    assert.ok(idx > cursor, 'etapa "' + id + '" fora de ordem');
    cursor = idx;
  });
});

test('etapas "room-create" e "room-second" têm 2 fases internas cada (criar, depois manipular)', () => {
  ['room-create', 'room-second'].forEach((id) => {
    const block = stepBlock(tutorialSource, id);
    const phaseCount = (block.match(/target:/g) || []).length;
    assert.equal(phaseCount, 2, 'etapa "' + id + '" deveria ter 2 fases');
  });
});

test('etapas de porta/janela/telhado usam armsViewportOnClick (o clique no botão arma a ferramenta; o clique de posicionamento acontece na cena 3D, não pode ficar bloqueado pelo spotlight)', () => {
  ['door', 'window', 'roof'].forEach((id) => {
    const block = stepBlock(tutorialSource, id);
    assert.match(block, /armsViewportOnClick: true/, 'etapa "' + id + '" deveria ter armsViewportOnClick');
  });
});

test('etapas de criar cômodo (fase A) e forro NÃO usam armsViewportOnClick — são ações de um clique só, sem posicionamento na cena 3D depois', () => {
  ['forro'].forEach((id) => {
    const block = stepBlock(tutorialSource, id);
    assert.doesNotMatch(block, /armsViewportOnClick/);
  });
});

test('TUTORIAL_SEEN_KEY existe e é lido/gravado com try/catch (mesmo padrão de DISCLAIMER_DISMISSED_KEY)', () => {
  assert.match(tutorialSource, /const TUTORIAL_SEEN_KEY = 'esboce_tutorial_seen_v1';/);
  const maybeAutoStart = tutorialSource.slice(
    tutorialSource.indexOf('export function maybeAutoStart'),
    tutorialSource.indexOf('\n}', tutorialSource.indexOf('export function maybeAutoStart')),
  );
  assert.match(maybeAutoStart, /try \{/);
  assert.match(maybeAutoStart, /localStorage\.getItem\(TUTORIAL_SEEN_KEY\)/);
  assert.match(maybeAutoStart, /catch \(err\)/);
});

test('maybeAutoStart não dispara em projeto não-vazio (ex.: link compartilhado de casa pronta) — só marca como visto', () => {
  const start = tutorialSource.indexOf('export function maybeAutoStart');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  assert.match(body, /Store\.currentWalls\(\)\.length > 0/);
  assert.match(body, /markSeen\(\);\s*\n\s*return;/);
});

test('index.html tem o overlay de spotlight, a caixa de instrução, o botão de pular e o botão de ajuda', () => {
  assert.match(indexHtmlSource, /id="tutorialSpotlight"/);
  assert.match(indexHtmlSource, /id="tutorialBox"/);
  assert.match(indexHtmlSource, /id="tutorialStepLabel"/);
  assert.match(indexHtmlSource, /id="tutorialStepText"/);
  assert.match(indexHtmlSource, /id="tutorialSkipBtn"/);
  assert.match(indexHtmlSource, /id="tutorialHelpBtn"/);
});

test('index.html tem as 4 tiras do spotlight (top/bottom/left/right)', () => {
  ['top', 'bottom', 'left', 'right'].forEach((side) => {
    assert.match(indexHtmlSource, new RegExp('data-strip="' + side + '"'));
  });
});

test('CSS do destaque verde piscando (.tutorial-target-pulse + @keyframes) existe', () => {
  assert.match(indexHtmlSource, /@keyframes tutorial-pulse/);
  assert.match(indexHtmlSource, /\.tutorial-target-pulse \{/);
});

test('handleStoreEvent reage a RoomCreated nas duas etapas de criar cômodo', () => {
  const start = tutorialSource.indexOf('function handleStoreEvent');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  assert.match(body, /case 'RoomCreated':\s*\n\s*if \(stepId === 'room-create' \|\| stepId === 'room-second'\) advance\(\);/);
});

test('WallsGroupDragged só conclui a etapa "room-create" (posicionar o 1º cômodo) — NÃO a "room-second"', () => {
  const start = tutorialSource.indexOf('function handleStoreEvent');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  const caseStart = body.indexOf("case 'WallsGroupDragged':");
  assert.notEqual(caseStart, -1);
  const caseEnd = body.indexOf('break;', caseStart);
  const caseBody = body.slice(caseStart, caseEnd);
  assert.match(caseBody, /stepId === 'room-create'/);
  assert.doesNotMatch(caseBody, /room-second/);
});

test('resize de parede já conectada (WallResizeDragged/WallEndpointMoved/WallMoved) conclui especificamente "room-second", por decisão do Product Owner', () => {
  const start = tutorialSource.indexOf('function handleStoreEvent');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  const caseStart = body.indexOf("case 'WallResizeDragged':");
  assert.notEqual(caseStart, -1);
  const caseEnd = body.indexOf('break;', caseStart);
  const caseBody = body.slice(caseStart, caseEnd);
  assert.match(caseBody, /case 'WallEndpointMoved':/);
  assert.match(caseBody, /case 'WallMoved':/);
  assert.match(caseBody, /stepId === 'room-second'/);
});

test('OpeningCreated verifica Store.findOpening(...).kind pra diferenciar porta de janela', () => {
  const start = tutorialSource.indexOf('function handleStoreEvent');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  assert.match(body, /Store\.findOpening\(event\.openingId as string\)/);
  assert.match(body, /stepId === 'door' && opening\?\.kind === 'door'/);
  assert.match(body, /stepId === 'window' && opening\?\.kind === 'window'/);
});

test('ForroDrywallGenerated conclui "forro"; RoofCreated/RoofsAutoGenerated concluem "roof"', () => {
  const start = tutorialSource.indexOf('function handleStoreEvent');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  assert.match(body, /case 'ForroDrywallGenerated':\s*\n\s*if \(stepId === 'forro'\) advance\(\);/);
  assert.match(body, /case 'RoofCreated':\s*\n\s*case 'RoofsAutoGenerated':\s*\n\s*if \(stepId === 'roof'\) advance\(\);/);
});

test('etapa de orçamento (PDF) não depende do Store — usa listeners de clique extras em materialsToggleBtn/materialsCategoryMenu/materialsPdfBtn, sem tocar em MaterialsPanel.ts', () => {
  const start = tutorialSource.indexOf('export function init');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  assert.match(body, /getElementById\('materialsToggleBtn'\)\?\.addEventListener\('click'/);
  assert.match(body, /getElementById\('materialsCategoryMenu'\)\?\.addEventListener\('click'/);
  assert.match(body, /getElementById\('materialsPdfBtn'\)\?\.addEventListener\('click'/);
  assert.match(body, /data-materials-category="geral"/);
});

test('botão "Pular tutorial" e botão "Ajuda" são ligados a skip()/start() dentro de init()', () => {
  const start = tutorialSource.indexOf('export function init');
  const end = tutorialSource.indexOf('\n}', start);
  const body = tutorialSource.slice(start, end);
  assert.match(body, /getElementById\('tutorialSkipBtn'\)\?\.addEventListener\('click', skip\)/);
  assert.match(body, /getElementById\('tutorialHelpBtn'\)\?\.addEventListener\('click', start\)/);
});

test('skip()/finish() marcam como visto (não reaparece sozinho de novo) e escondem o overlay', () => {
  const deactivateStart = tutorialSource.indexOf('function deactivate');
  const deactivateEnd = tutorialSource.indexOf('\n}', deactivateStart);
  const body = tutorialSource.slice(deactivateStart, deactivateEnd);
  assert.match(body, /markSeen\(\);/);
  assert.match(body, /hideOverlay\(\);/);
});

test('namespace de compatibilidade Tutorial existe com init/start/skip/maybeAutoStart', () => {
  assert.match(tutorialSource, /export const Tutorial = \{ init, start, skip, maybeAutoStart \};/);
});

test('EsboceApplication.ts inicializa o Tutorial e encadeia maybeAutoStart() ao fechar o disclaimer', () => {
  assert.match(esboceApplicationSource, /import \{ Tutorial \} from "\.\.\/core\/Tutorial\.js";/);
  assert.match(esboceApplicationSource, /Tutorial\.init\(\);/);
  const start = esboceApplicationSource.indexOf('dismissBtn.addEventListener("click"');
  const end = esboceApplicationSource.indexOf('\n    });', start);
  const body = esboceApplicationSource.slice(start, end);
  assert.match(body, /Tutorial\.maybeAutoStart\(\);/);
});
