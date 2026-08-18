import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { computeWallFootprints } from '../src/core/Core.ts';

// ViewportController.ts não é importável direto (depende de Three.js/DOM em
// tempo de carga) — testado por busca de texto, mesma técnica já usada em
// outros testes deste módulo (ver hydraulic-source-drag.test.mjs).
const vpSource = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');

// Product Owner, com prints da laje: "estou tendo problemas com a laje,
// parece que ela fica confusa ao gerar com paredes compartilhadas."
//
// Causa raiz: Store.commands.createRoom sempre cria 4 paredes NOVAS, nunca
// reaproveita uma parede que já exista ali — então desenhar um 2º cômodo
// encostado num já existente (Ferramenta Cômodo, dois cliques) nasce com
// uma parede DUPLICADA, sobreposta exatamente em cima da parede já
// existente na fronteira (mesmo eixo, sentido oposto). finalizeDraw()
// (ViewportController.ts) só chamava splitWallsAtTJunctions() depois de
// createRoom — nunca fuseAllOverlaps(), o mecanismo que já existe
// especificamente pra resolver esse tipo de sobreposição (usado, por
// exemplo, ao arrastar um cômodo isolado até encostar em outro).
//
// Consequência geométrica confirmada (ver DEC no registro de decisões):
// com a parede duplicada, Core.computeWallFootprints — que resolve o
// mitre/canto de uma junção em T — via de alguma forma nas 4 vias (T real
// + parede duplicada) e devolve um canto DEGENERADO: a face da parede do
// meio da junção colapsa exatamente no EIXO da parede (nenhum deslocamento
// pela espessura), em vez do deslocamento correto. Isso distorce o
// contorno usado pela laje (Scene3DRenderer.ts, outsetPoints) bem na
// fronteira compartilhada — exatamente o "confuso" relatado.
test('sem fundir, a parede duplicada de um cômodo encostado corrompe o canto da junção em T (colapsa no eixo, sem espessura nenhuma)', () => {
  const wallsWithDuplicate = [
    { id: 'wall_1', x1: 0, y1: 0, x2: 90, y2: 0 },
    { id: 'wall_2', x1: 90, y1: 0, x2: 90, y2: 90 },
    { id: 'wall_3', x1: 90, y1: 90, x2: 0, y2: 90 },
    { id: 'wall_4', x1: 0, y1: 90, x2: 0, y2: 0 },
    { id: 'wall_5', x1: 90, y1: 0, x2: 170, y2: 0 },
    { id: 'wall_6', x1: 170, y1: 0, x2: 170, y2: 90 },
    { id: 'wall_7', x1: 170, y1: 90, x2: 90, y2: 90 },
    { id: 'wall_8', x1: 90, y1: 90, x2: 90, y2: 0 }, // duplicata da wall_2, sentido oposto
  ];
  const footprint = computeWallFootprints(wallsWithDuplicate).wall_2;
  // canto da wall_2 na ponta (90,0): devia ter Y deslocado pela metade da
  // espessura da parede (±1.2), igual toda junção em T bem resolvida —
  // em vez disso colapsa em Y=0, exatamente no eixo.
  assert.equal(footprint.p1a.y, 0);
  assert.equal(footprint.p1b.y, 0);
});

test('depois de fundida (mesma parede, sem duplicata), o canto da junção em T fica correto e consistente com a parede vizinha', () => {
  const wallsFused = [
    { id: 'wall_1', x1: 0, y1: 0, x2: 90, y2: 0 },
    { id: 'wall_2', x1: 90, y1: 90, x2: 90, y2: 0 }, // fundida — mesma direção que fuseOverlappingWalls produz
    { id: 'wall_3', x1: 90, y1: 90, x2: 0, y2: 90 },
    { id: 'wall_4', x1: 0, y1: 90, x2: 0, y2: 0 },
    { id: 'wall_5', x1: 90, y1: 0, x2: 170, y2: 0 },
    { id: 'wall_6', x1: 170, y1: 0, x2: 170, y2: 90 },
    { id: 'wall_7', x1: 170, y1: 90, x2: 90, y2: 90 },
  ];
  const footprints = computeWallFootprints(wallsFused);
  // canto da wall_2 na ponta (90,0) — agora p2 (direção invertida) —
  // devidamente deslocado em Y (±1.2), não mais colapsado no eixo.
  assert.equal(footprints.wall_2.p2a.y, 1.2);
  assert.equal(footprints.wall_2.p2b.y, 1.2);
  // e bate exatamente com o canto que a própria wall_1 calcula pro MESMO
  // ponto físico (90, 1.2) — as duas paredes concordam sobre onde fica a
  // face interna da junção, sem gap nem sobreposição.
  assert.equal(footprints.wall_1.p2a.x, 90);
  assert.equal(footprints.wall_1.p2a.y, 1.2);
});

test('finalizeDraw funde as paredes do cômodo recém-criado (fuseAllOverlaps) antes de dividir junções em T', () => {
  const start = vpSource.indexOf('function finalizeDraw() {');
  const end = vpSource.indexOf('\n  }', start);
  const body = vpSource.slice(start, end);
  const createIdx = body.indexOf('Store.commands.createRoom(p.x1, p.y1, p.x2, p.y2);');
  const fuseIdx = body.indexOf('fuseAllOverlaps(newRoomWalls.map(');
  const splitIdx = body.indexOf("Store.commands.splitWallsAtTJunctions();");
  assert.notEqual(createIdx, -1);
  assert.notEqual(fuseIdx, -1);
  assert.notEqual(splitIdx, -1);
  assert.ok(createIdx < fuseIdx, 'createRoom precisa rodar antes de tentar fundir os ids que ele retornou');
  assert.ok(fuseIdx < splitIdx, 'fundir antes de dividir em T — mesma ordem já usada no fim do arraste de ponta de parede');
});
