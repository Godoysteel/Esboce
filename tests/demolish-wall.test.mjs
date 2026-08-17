import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Core, createWallEntity, createFloorEntity } from '../src/core/Core.ts';

const storeSource = readFileSync(new URL('../src/core/Store.ts', import.meta.url), 'utf8');
const viewportSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const renderer3DSource = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const renderer2DSource = readFileSync(new URL('../src/core/Scene2DRenderer.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

test('demolishWall marca a parede como demolida, NÃO remove ela do pavimento (createWallEntity ainda existe)', () => {
  const floor = createFloorEntity('Térreo');
  const wall = createWallEntity(0, 0, 400, 0);
  floor.walls.push(wall);
  // demolishWall é um comando do Store (não uma função pura de Core) —
  // aqui só confirmamos, no nível de dado, que "demolida" é um campo
  // (não uma remoção do array): o mesmo objeto `wall` recebe a flag.
  wall.demolished = true;
  assert.equal(floor.walls.length, 1);
  assert.equal(floor.walls[0].id, wall.id);
  assert.equal(floor.walls[0].demolished, true);
});

test('Store.commands.demolishWall existe, marca a flag (não splice) e é idempotente', () => {
  assert.match(storeSource, /demolishWall\(wallId: string\): void/);
  assert.match(storeSource, /w\.demolished = true/);
  assert.match(storeSource, /if \(!w \|\| w\.demolished\) return;/);
  // A demolição não deve usar o mesmo caminho de deleteWall (splice do
  // array) — senão volta o bug original (cômodo/piso quebra).
  const demolishBlock = storeSource.slice(storeSource.indexOf('demolishWall(wallId'), storeSource.indexOf('demolishWall(wallId') + 400);
  assert.doesNotMatch(demolishBlock, /\.splice\(/);
});

test('a ferramenta Quebrar Parede chama demolishWall, não deleteWall/pruneDegenerateWalls', () => {
  const toolBlock = viewportSource.slice(
    viewportSource.indexOf("currentTool === 'demolish' && mesh"),
    viewportSource.indexOf("currentTool === 'demolish' && mesh") + 600,
  );
  assert.match(toolBlock, /Store\.commands\.demolishWall\(/);
  assert.doesNotMatch(toolBlock, /Store\.commands\.deleteWall\(/);
  assert.doesNotMatch(toolBlock, /pruneDegenerateWalls/);
});

test('Scene3DRenderer pula a parede demolida ao desenhar (paredes e as aberturas dela); ela continua em detectRooms (fecha o cômodo) mas NÃO entra mais em computeWallFootprints (senão a parede vizinha ficava com um entalhe/fresta esperando uma parceira que não existe mais — bug reportado pelo Product Owner, corrigido)', () => {
  assert.match(renderer3DSource, /if \(w\.demolished\) return;/);
  assert.match(renderer3DSource, /if \(!w \|\| w\.demolished\) return;/);
  // detectRooms precisa da lista INTEIRA (com parede demolida incluída)
  // — é isso que mantém o cômodo/piso fechado.
  assert.match(renderer3DSource, /Core\.detectRooms\(floorData\.walls\)/);
  // computeWallFootprints, ao contrário, precisa de uma lista SEM
  // parede demolida — é só geometria visual de canto/mitre entre
  // paredes vizinhas; incluir a demolida fazia a parede que sobrou (a
  // que ainda é desenhada) calcular o canto dela esperando uma
  // parceira invisível, deixando a ponta com um entalhe em vez de uma
  // tampa reta.
  // A checagem é ESPECÍFICA pra variável `wallFootprints` (a que
  // desenha a parede em si) — `wallFootprintsFull` (variável
  // DIFERENTE, só pra soleira de parede demolida, ver mais abaixo)
  // legitimamente usa a lista sem filtro, por um motivo oposto: a
  // soleira precisa do contorno ORIGINAL da própria parede demolida.
  assert.doesNotMatch(renderer3DSource, /var wallFootprints = Core\.computeWallFootprints\(floorData\.walls\)/);
  assert.match(renderer3DSource, /var activeWallsForFootprint = floorData\.walls\.filter\(function \(w\) \{ return !w\.demolished; \}\);/);
  assert.match(renderer3DSource, /Core\.computeWallFootprints\(activeWallsForFootprint\)/);
});

test('a matemática de canto de verdade: excluir a parede demolida da lista passada a computeWallFootprints faz a parede vizinha ganhar uma ponta LIVRE (tampa reta), em vez de um canto em L esperando uma parceira que não existe mais', () => {
  // Duas paredes formando um "L" — uma vertical de (0,0) a (0,400), uma
  // horizontal encostada na ponta dela, de (0,400) a (400,400). Sem
  // filtro nenhum, a vertical calcularia um canto em L na ponta comum.
  const vertical = createWallEntity(0, 0, 0, 400);
  const horizontal = createWallEntity(0, 400, 400, 400);

  const withBoth = Core.computeWallFootprints([vertical, horizontal]);
  assert.equal(withBoth[vertical.id].p2Free, false, 'com as duas paredes, a ponta é um canto (não livre)');

  // Simula o que o renderer faz agora: a horizontal foi "demolida" —
  // sai da lista passada a computeWallFootprints (mas continuaria
  // entrando em detectRooms, separadamente, sem filtro nenhum).
  const onlyVertical = Core.computeWallFootprints([vertical]);
  assert.equal(onlyVertical[vertical.id].p2Free, true, 'sem a parede demolida na lista, a ponta vira livre — ganha a tampa reta de uma extremidade solta');
});

test('a mesma correção de canto vale pra PAREDE EXTERNA — um retângulo fechado (4 paredes de perímetro), demolindo uma delas, as DUAS vizinhas (nas duas pontas) ganham tampa reta nos dois cantos', () => {
  // Retângulo 4x4m: norte, leste, sul, oeste — cada uma toca as outras
  // duas nas pontas, formando os 4 cantos do perímetro externo.
  const norte = createWallEntity(0, 0, 400, 0);
  const leste = createWallEntity(400, 0, 400, 400);
  const sul = createWallEntity(400, 400, 0, 400);
  const oeste = createWallEntity(0, 400, 0, 0);
  const todas = [norte, leste, sul, oeste];

  const comTodas = Core.computeWallFootprints(todas);
  assert.equal(comTodas[leste.id].p1Free, false, 'antes de demolir, o canto nordeste (norte↔leste) é um canto de verdade');
  assert.equal(comTodas[oeste.id].p2Free, false, 'antes de demolir, o canto noroeste (oeste↔norte) é um canto de verdade');

  // "Norte" foi demolida — some da lista passada a computeWallFootprints
  // (mas continuaria em detectRooms, sem filtro, pra não abrir o
  // retângulo pro cálculo de cômodo/piso).
  const semNorte = Core.computeWallFootprints(todas.filter((w) => w.id !== norte.id));
  assert.equal(semNorte[leste.id].p1Free, true, 'nordeste: Leste ganha ponta livre (tampa reta) depois de Norte demolida');
  assert.equal(semNorte[oeste.id].p2Free, true, 'noroeste: Oeste ganha ponta livre (tampa reta) depois de Norte demolida');
  // As duas pontas que NÃO tocavam a parede demolida (sudeste/sudoeste)
  // continuam intactas — a correção não pode "vazar" pro resto do
  // retângulo.
  assert.equal(semNorte[leste.id].p2Free, false, 'sudeste continua um canto de verdade (não foi tocado)');
  assert.equal(semNorte[oeste.id].p1Free, false, 'sudoeste continua um canto de verdade (não foi tocado)');
});

test('Scene2DRenderer também pula parede demolida (linha e símbolo de abertura)', () => {
  assert.match(renderer2DSource, /if \(!wall\.demolished\) wallLine/);
  assert.match(renderer2DSource, /if \(wall && !wall\.demolished\) openingSymbol/);
});

test('MaterialsPanel não conta parede demolida em nenhum quantitativo (comprimento, área, fundação, pilaretes, portas/janelas/verga, soleira, listagem detalhada)', () => {
  assert.match(materialsSource, /groundFloor\.walls\.forEach\(function \(w\) \{ if \(!w\.demolished\) groundWallLength/);
  assert.match(materialsSource, /floor\.walls\.forEach\(function \(w\) \{\s*\n\s*if \(w\.demolished\) return;/);
  assert.match(materialsSource, /const hostWall = floor\.walls\.filter\(function \(w\) \{ return w\.id === op\.wallId; \}\)\[0\];\s*\n\s*if \(hostWall && hostWall\.demolished\) return;/);
  assert.match(materialsSource, /if \(!wall \|\| wall\.demolished\) return;/);
  assert.match(materialsSource, /const activeWalls = floor\.walls\.filter\(function \(w\) \{ return !w\.demolished; \}\);/);
  assert.match(materialsSource, /floor\.walls\.forEach\(function \(w, i\) \{\s*\n\s*if \(w\.demolished\) return;/);
});

test('rodapé (e o contorno preto do piso, que reaproveita o mesmo cálculo) somem por inteiro no trecho de uma parede demolida — mesmo tratamento de "vão aberto" que porta/arco já tinham, só cobrindo 100% do comprimento', () => {
  assert.match(renderer3DSource, /if \(wall\.demolished\) return \[\[0, 1\]\];/);
  // Essa checagem precisa vir ANTES de tentar achar interseção de
  // aberturas — senão calcularia offset/span à toa pra uma parede que
  // nem existe mais visualmente.
  const fnBlock = renderer3DSource.slice(
    renderer3DSource.indexOf('function computeBaseboardSkipIntervals'),
    renderer3DSource.indexOf('function computeBaseboardSkipIntervals') + 900,
  );
  const demolishedCheckIdx = fnBlock.indexOf('if (wall.demolished) return [[0, 1]];');
  const offsetCheckIdx = fnBlock.indexOf('wallOffsetAtPoint');
  assert.ok(demolishedCheckIdx > -1 && offsetCheckIdx > -1);
  assert.ok(demolishedCheckIdx < offsetCheckIdx, 'a checagem de demolida precisa vir antes do cálculo de offset/span');
});

test('a tampa VISÍVEL de ponta livre existe de verdade — antes só a caixa de referência (invisível, opacity 0) fechava a ponta; sem uma malha própria com material visível, a ponta ficava "vazada" mesmo com o canto matematicamente certo', () => {
  assert.match(renderer3DSource, /function buildWallEndCapMesh/);
  // Mesma condição já usada na caixa de referência (buildWallMeshFromFootprint)
  // pra decidir se desenha a tampa — reaproveitada aqui pro material visível.
  assert.match(renderer3DSource, /if \(fp\.p1Free !== false \|\| fp\.p1Extended\) \{\s*\n\s*var endCap1 = tagCategory\(buildWallEndCapMesh\(fp, renderedWallHeight, yOffset, topMat, 1\), wallCategory\);/);
  assert.match(renderer3DSource, /if \(fp\.p2Free !== false \|\| fp\.p2Extended\) \{\s*\n\s*var endCap2 = tagCategory\(buildWallEndCapMesh\(fp, renderedWallHeight, yOffset, topMat, 2\), wallCategory\);/);
});

test('parede demolida ganha o mesmo tratamento de "buraco no piso" que arco/porta já tinham — soleira interna (entre dois cômodos) ou externa (um lado só), cobrindo o comprimento INTEIRO da parede como um vão sintético', () => {
  // wallFootprintsFull (sem filtro) precisa existir separado de
  // wallFootprints (filtrado) — a soleira de uma parede demolida
  // precisa do contorno ORIGINAL dela (como se os vizinhos ainda
  // estivessem lá), não da ponta livre que ela mesma ganharia se ainda
  // fosse desenhada.
  assert.match(renderer3DSource, /var wallFootprintsFull = Core\.computeWallFootprints\(floorData\.walls\);/);

  const demolishedSlabBlock = renderer3DSource.slice(
    renderer3DSource.indexOf('floorData.walls.forEach(function (w) {\r\n          if (!w.demolished) return;\r\n          var wallLenM'),
  );
  assert.ok(demolishedSlabBlock.length > 0, 'bloco de soleira pra parede demolida não encontrado');
  // Vão sintético cobrindo o comprimento INTEIRO (não um trecho) —
  // offset no meio, largura = comprimento todo da parede.
  assert.match(demolishedSlabBlock, /offset: wallLenM \/ 2, width: wallLenM/);
  // Soleira interna (dois cômodos) usa o mapa SEM FILTRO
  assert.match(demolishedSlabBlock, /buildThresholdSlab\(w, wallFootprintsFull, yOffset, offsetX, offsetY, scale\)/);
  // Soleira externa (um lado só) reaproveita a MESMA função já usada
  // pro arco/porta pra fora, sem duplicar lógica de geometria.
  assert.match(demolishedSlabBlock, /buildExteriorSoleira\(w, fullSpanOpening, yOffset, offsetX, offsetY, scale\)/);
});

test('BUG DE CORE (não específico de Quebrar Parede, mas exposto por ele): duas paredes COLINEARES (uma continuação reta da outra) ligadas por 1 único ponto de contato ganhavam "ponta livre" por engano — riscos/tampa aparecendo no meio de uma parede que devia continuar lisa. Corrigido sem quebrar o caso original que essa lógica protegia (dobra rasa de verdade, não reta)', () => {
  // Cenário clássico do bug: uma parede longa nascida dividida em 2
  // pedaços colineares por causa de uma junção em T (3ª parede
  // encostando no meio) — a junção em T é bem resolvida (reconhece a
  // colinearidade, junta sem emenda) ENQUANTO a 3ª parede existe. Uma
  // vez que ela é demolida (DEC-83), sobra só 1 vizinho pros dois
  // pedaços — e caía no tratamento genérico de "ângulo raso", que
  // assume ponta livre pra evitar espinho.
  const a = createWallEntity(0, 0, 400, 0);
  const b = createWallEntity(400, 0, 800, 0); // colinear, continuação reta
  const fp = Core.computeWallFootprints([a, b]);
  assert.equal(fp[a.id].p2Free, false, 'duas paredes exatamente retas uma com a outra não podem ganhar ponta livre');
  assert.equal(fp[b.id].p1Free, false, 'idem, do lado da outra parede');
  assert.equal(fp[a.id].p2Extended, false, 'extended TEM que ser false — só zerar free não bastava (bug achado testando esta mesma correção: extended:true sozinho já disparava a linha de novo)');
  assert.equal(fp[b.id].p1Extended, false, 'idem, do lado da outra parede');
  // A condição de VERDADE que o renderer usa pra decidir se desenha a
  // linha/tampa é `p1Free !== false || p1Extended` (ver
  // buildWallFootprintEdgeLines/buildWallEndCapMesh) — testa a
  // expressão inteira, não só os campos separados, porque foi
  // exatamente aí que a correção quebrou na primeira tentativa (free
  // certo, extended errado, condição ainda dava true).
  assert.equal(fp[a.id].p2Free !== false || fp[a.id].p2Extended, false, 'a condição real de desenho da linha/tampa tem que dar false pros dois lados');
  assert.equal(fp[b.id].p1Free !== false || fp[b.id].p1Extended, false, 'idem, do lado da outra parede');

  // Trava contra regressão: uma dobra RASA DE VERDADE (não reta, só um
  // ângulo bem fechado) precisa CONTINUAR ganhando ponta livre — é
  // exatamente o caso que essa lógica sempre existiu pra proteger
  // (evitar um "espinho" longe no canto). Só a reta perfeita (0,02 de
  // seno, ~1°) ganha o desvio novo.
  const c = createWallEntity(0, 0, 400, 0);
  const d = createWallEntity(400, 0, 760, 60); // quase colinear, mas não reto
  const fp2 = Core.computeWallFootprints([c, d]);
  assert.equal(fp2[c.id].p2Free, true, 'dobra rasa de verdade (não reta) continua ganhando ponta livre, sem regressão');
});
