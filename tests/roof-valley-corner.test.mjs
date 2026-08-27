import assert from 'node:assert/strict';
import test from 'node:test';

import { Core } from '../src/core/Core.ts';

// Cenário do Product Owner: dois 4-águas formando L. A maior cobre
// x:[0,300] z:[0,240], a menor x:[300,500] z:[0,160] — encostadas na
// aresta vertical x=300, começando na mesma z=0, a menor "mais curta".
// O canto reentrante fica em (300,160), com a bissetriz avançando pro
// quadrante vazio (x>300, z>160).
test('roofFootprintValleyCorner encontra o canto reentrante de duas pegadas formando L (aresta vertical, mesmo início)', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 0, maxZ: 160 };
  const corner = Core.roofFootprintValleyCorner(a, b);
  assert.ok(corner);
  assert.equal(corner.cornerX, 300);
  assert.equal(corner.cornerZ, 160);
  assert.equal(corner.dirX, 1);
  assert.equal(corner.dirZ, 1);
  // Ordem dos argumentos não deve importar.
  assert.deepEqual(Core.roofFootprintValleyCorner(b, a), corner);
});

test('roofFootprintValleyCorner inverte dirZ quando o degrau está no outro extremo (mesmo fim, não mesmo início)', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 80, maxZ: 240 };
  const corner = Core.roofFootprintValleyCorner(a, b);
  assert.ok(corner);
  assert.equal(corner.cornerX, 300);
  assert.equal(corner.cornerZ, 80);
  assert.equal(corner.dirX, 1);
  assert.equal(corner.dirZ, -1);
});

test('roofFootprintValleyCorner funciona também pra aresta horizontal (pegadas empilhadas em Z)', () => {
  const bottom = { minX: 0, maxX: 240, minZ: 0, maxZ: 300 };
  const top = { minX: 0, maxX: 160, minZ: 300, maxZ: 500 };
  const corner = Core.roofFootprintValleyCorner(bottom, top);
  assert.ok(corner);
  assert.equal(corner.cornerX, 160);
  assert.equal(corner.cornerZ, 300);
  assert.equal(corner.dirX, 1);
  assert.equal(corner.dirZ, 1);
});

test('roofFootprintValleyCorner devolve null quando as pegadas não encostam em nenhuma aresta', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 400, maxX: 600, minZ: 0, maxZ: 160 };
  assert.equal(Core.roofFootprintValleyCorner(a, b), null);
});

test('roofFootprintValleyCorner devolve null quando as duas têm a MESMA extensão na aresta (união vira retângulo, sem canto reentrante)', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 0, maxZ: 240 };
  assert.equal(Core.roofFootprintValleyCorner(a, b), null);
});

test('roofFootprintValleyCorner devolve null pra um nicho no meio (deslocada nos dois extremos ao mesmo tempo — dois cantos, não suportado)', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 40, maxZ: 200 };
  assert.equal(Core.roofFootprintValleyCorner(a, b), null);
});

// roofValleyOwnSign: cada telhado deve receber o sinal OPOSTO do outro
// — é essa oposição que garante que só um esconde o outro em cada
// ponto, nunca os dois ao mesmo tempo. Derivado da geometria (qual dos
// dois toca o canto reentrante com o PRÓPRIO canto), não de amostrar um
// ponto qualquer — o sinal da reta crua muda dependendo de onde dentro
// do retângulo se mede, só é estável perto do canto reentrante mesmo.
test('roofValleyOwnSign: as duas pegadas recebem sinais opostos, na aresta vertical com o degrau no início...', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 0, maxZ: 160 };
  const corner = Core.roofFootprintValleyCorner(a, b);
  const signA = Core.roofValleyOwnSign(corner, a);
  const signB = Core.roofValleyOwnSign(corner, b);
  assert.notEqual(signA, 0);
  assert.notEqual(signB, 0);
  assert.equal(signA, -signB);
});

test('roofValleyOwnSign: ...e também com o degrau no fim (dirZ invertido)', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 80, maxZ: 240 };
  const corner = Core.roofFootprintValleyCorner(a, b);
  const signA = Core.roofValleyOwnSign(corner, a);
  const signB = Core.roofValleyOwnSign(corner, b);
  assert.notEqual(signA, 0);
  assert.notEqual(signB, 0);
  assert.equal(signA, -signB);
});

// Pontos fora do quadrante que a bissetriz separa (além do canto nos
// DOIS eixos de fuga ao mesmo tempo) são NEUTROS (0) — sem isso, a reta
// infinita também "cortaria" pontos longe do canto que só encostam na
// mesma parede compartilhada sem ambiguidade nenhuma (bug real
// encontrado ao raciocinar sobre a fórmula pura, antes de implementar).
test('roofValleySide: fora do quadrante do canto reentrante (só falta um dos dois eixos de fuga) é neutro — não há corte a fazer ali', () => {
  const a = { minX: 0, maxX: 300, minZ: 0, maxZ: 240 };
  const b = { minX: 300, maxX: 500, minZ: 0, maxZ: 160 };
  const corner = Core.roofFootprintValleyCorner(a, b);
  // Beirada de A rente à parede compartilhada, mas na ponta oposta ao
  // canto (z=0, longe de z=160) — falta o eixo Z de fuga.
  assert.equal(Core.roofValleySide(corner, 295, 0), 0);
  // Fundo de B, bem dentro do próprio retângulo, longe do canto em Z —
  // mesma falta do eixo Z de fuga.
  assert.equal(Core.roofValleySide(corner, 305, 0), 0);
  // Já dentro do quadrante (além do canto nos dois eixos) tem que dar
  // um lado de verdade, não neutro.
  assert.notEqual(Core.roofValleySide(corner, 300.3, 170), 0);
});

// Caso real reportado pelo Product Owner (números exatos, via console em
// produção) onde a bissetriz NÃO se aplica: as duas pegadas se
// SOBREPÕEM de verdade numa área grande (não é um degrau simples
// tocando numa aresta) — roofFootprintValleyCorner corretamente
// devolve null aqui. A comparação de quem esconde quem, nesse caso,
// precisa ser PONTO A PONTO (ver Scene3DRenderer): nem "pico mais alto"
// nem "mais área" bastam — dentro dessa mesma sobreposição, roof_17 é
// localmente MAIS alto perto da própria borda do que roof_18 (que tem
// mais que o DOBRO de área) é perto DA PRÓPRIA borda — comparar os dois
// inteiros por um número só (pico ou área) apagava os dois ao mesmo
// tempo em pontos diferentes da mesma sobreposição.
test('duas pegadas que se sobrepõem de verdade (caso real, não um degrau) não formam canto reentrante — a comparação correta é ponto a ponto, nunca os dois escondidos ao mesmo tempo', () => {
  const roof17 = { minX: -40, maxX: 105, minZ: -3, maxZ: 30 };
  const roof18 = { minX: 35, maxX: 105, minZ: -105, maxZ: 30 };
  assert.equal(Core.roofFootprintValleyCorner(roof17, roof18), null);

  const GRID = Core.GRID;
  const tanPitch = Math.tan(28 * Math.PI / 180);
  function hipHeight(rect, x, z) {
    const distX = Math.min(x - rect.minX, rect.maxX - x);
    const distZ = Math.min(z - rect.minZ, rect.maxZ - z);
    return tanPitch * Math.min(distX, distZ) / GRID;
  }
  const ox1 = Math.max(roof17.minX, roof18.minX), ox2 = Math.min(roof17.maxX, roof18.maxX);
  const oz1 = Math.max(roof17.minZ, roof18.minZ), oz2 = Math.min(roof17.maxZ, roof18.maxZ);
  assert.ok(ox2 - ox1 > 0 && oz2 - oz1 > 0, 'as pegadas precisam realmente se sobrepor pra este teste fazer sentido');
  let sawRoof17Higher = false, sawRoof18Higher = false;
  for (let x = ox1; x <= ox2; x += 2) {
    for (let z = oz1; z <= oz2; z += 2) {
      const h17 = hipHeight(roof17, x, z);
      const h18 = hipHeight(roof18, x, z);
      const visible17 = !(h17 < h18);
      const visible18 = !(h18 < h17);
      // Nunca os dois escondidos ao mesmo tempo — a "fresta" real que o
      // Product Owner reportou.
      assert.ok(visible17 || visible18, `ambos escondidos em (${x},${z}): h17=${h17}, h18=${h18}`);
      if (h17 > h18) sawRoof17Higher = true;
      if (h18 > h17) sawRoof18Higher = true;
    }
  }
  // Confirma que a sobreposição É de fato ambígua (os dois se alternam
  // em quem está mais alto) — senão este teste não estaria provando
  // nada sobre o motivo pelo qual "pico único"/"área única" falhavam.
  assert.ok(sawRoof17Higher && sawRoof18Higher, 'esperava que os dois telhados se alternassem em quem está mais alto dentro da sobreposição');
});
