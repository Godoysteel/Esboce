import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHipSolid,
  buildGableSolid,
  composeRoofPair,
  survivingSegments,
  ensureRoofSolidGeometryReady,
} from '../src/core/roofSolidGeometry.ts';

await ensureRoofSolidGeometryReady();

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

// --- Sanidade: pico e comprimento de cumeeira em casos analiticamente conhecidos ---

test('roofSolidGeometry: telhado quadrado isolado tem pico exato no centro (interseção de 4 semi-espaços)', () => {
  const pitchDeg = radToDeg(Math.atan(3 / 5)); // halfSpan=5, pico esperado=3
  const solid = buildHipSolid({ x1: 0, y1: 0, x2: 10, y2: 10, baseHeightM: 0, pitchDeg });
  const bb = solid.boundingBox();
  assert.ok(Math.abs(bb.max[1] - 3) < 1e-6, `pico esperado 3, obtido ${bb.max[1]}`);
});

test('roofSolidGeometry: telhado retangular isolado tem cumeeira = lado comprido - lado curto', () => {
  const pitchDeg = radToDeg(Math.atan(2 / 5)); // halfSpan=5 (lado curto=10), pico=2
  const solid = buildHipSolid({ x1: 0, y1: 0, x2: 20, y2: 10, baseHeightM: 0, pitchDeg });
  const mesh = solid.getMesh();
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < mesh.vertProperties.length; i += 3) {
    if (Math.abs(mesh.vertProperties[i + 1] - 2) < 1e-3) {
      min = Math.min(min, mesh.vertProperties[i]);
      max = Math.max(max, mesh.vertProperties[i]);
    }
  }
  assert.ok(Math.abs(max - min - 10) < 1e-3, `cumeeira esperada 10 (20-10), obtida ${max - min}`);
});

// --- DEC-167: encontro em L com picos IDENTICOS (roof_26/roof_27) ---
// half-span=4.8m, pitch=28°, cumeeiras documentadas: 4,25m e 4,0m.

test('roofSolidGeometry: DEC-167 — L com picos idênticos reproduz as cumeeiras reais (4,25m e 4,0m) sem regra de posição', () => {
  const halfSpan = 4.8;
  const pitchDeg = 28;
  const peak = halfSpan * Math.tan((pitchDeg * Math.PI) / 180);

  const roof26 = { x1: 0, y1: 0, x2: 2 * halfSpan + 4.25, y2: 2 * halfSpan, baseHeightM: 0, pitchDeg };
  const roof27 = { x1: 0, y1: 0, x2: 2 * halfSpan, y2: 2 * halfSpan + 4.0, baseHeightM: 0, pitchDeg };
  const solid26 = buildHipSolid(roof26);
  const solid27 = buildHipSolid(roof27);

  const ridge26 = { a: { x: halfSpan, y: peak, z: halfSpan }, b: { x: halfSpan + 4.25, y: peak, z: halfSpan } };
  const ridge27 = { a: { x: halfSpan, y: peak, z: halfSpan }, b: { x: halfSpan, y: peak, z: halfSpan + 4.0 } };

  const union = composeRoofPair(solid26, solid27);

  const survives26 = survivingSegments(ridge26.a, ridge26.b, union);
  const survives27 = survivingSegments(ridge27.a, ridge27.b, union);

  const totalLen26 = survives26.reduce((sum, s) => sum + (s.t1 - s.t0), 0) * 4.25;
  const totalLen27 = survives27.reduce((sum, s) => sum + (s.t1 - s.t0), 0) * 4.0;

  assert.ok(Math.abs(totalLen26 - 4.25) < 0.05, `cumeeira roof_26 esperada 4,25m inteira (nenhum trecho engolido), obtida ${totalLen26.toFixed(3)}`);
  assert.ok(Math.abs(totalLen27 - 4.0) < 0.05, `cumeeira roof_27 esperada 4,0m inteira (nenhum trecho engolido), obtida ${totalLen27.toFixed(3)}`);
});

// --- DEC-204/205/206: roof_14/roof_15, coordenadas exatas do texto da decisão ---
// Nota: a decisão só registra o "pico" de cada telhado, não o baseHeightM —
// assumimos baseHeightM=0 pros dois (mesmo piso). Isso é uma aproximação
// documentada, não um dado confirmado; ver DEC nova sobre a reconciliação.

function pitchDegFromPeak(x1, y1, x2, y2, peak) {
  const halfSpan = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
  return radToDeg(Math.atan(peak / halfSpan));
}

test('roofSolidGeometry: DEC-206 — espigão de roof_14 não é engolido por completo por roof_15 (roof_14 domina a maior parte do trajeto)', () => {
  const roof14 = { x1: -105, y1: -40, x2: 40, y2: 105, baseHeightM: 0, pitchDeg: pitchDegFromPeak(-105, -40, 40, 105, 2.14) };
  const roof15 = { x1: -20, y1: -40, x2: 115, y2: 20, baseHeightM: 0, pitchDeg: pitchDegFromPeak(-20, -40, 115, 20, 1.01) };
  const solid14 = buildHipSolid(roof14);
  const solid15 = buildHipSolid(roof15);
  const union = composeRoofPair(solid14, solid15);

  // Canto (40,-40) -> pico único (centro do quadrado, -32.5, 32.5), pico=2.14.
  const corner = { x: 40, y: 0, z: -40 };
  const apex = { x: -32.5, y: 2.14, z: 32.5 };
  const segments = survivingSegments(corner, apex, union);
  const survivingFraction = segments.reduce((sum, s) => sum + (s.t1 - s.t0), 0);

  // Não afirmamos "0% cortado" (DEC-206/209) nem "corte limitado à pegada"
  // (DEC-208, rejeitada) — só que a MAIOR PARTE do trajeto sobrevive, já
  // que roof_14 domina a partir de ~40% do caminho (ver relatório da
  // sessão). Fechar esse número com precisão exige o baseHeightM real do
  // console — ver nota acima.
  assert.ok(survivingFraction > 0.5, `esperado que mais da metade do espigão sobreviva com baseHeightM=0 para os dois; obtido ${(survivingFraction * 100).toFixed(1)}%`);
});

test('roofSolidGeometry: buildGableSolid (duas-águas) — cumeeira constante = comprimento total ao longo do ridgeAxis, sem hip nas pontas', () => {
  const pitchDeg = radToDeg(Math.atan(2 / 4)); // halfSpan=4 (profundidade=8), pico=2
  const solid = buildGableSolid({ x1: 0, y1: 0, x2: 12, y2: 8, baseHeightM: 0, pitchDeg }, 'x');
  const bb = solid.boundingBox();
  assert.ok(Math.abs(bb.max[1] - 2) < 1e-6, `pico esperado 2, obtido ${bb.max[1]}`);
  // Duas-águas: a cumeeira corre o comprimento INTEIRO (12m), sem afunilar nas pontas.
  const mesh = solid.getMesh();
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < mesh.vertProperties.length; i += 3) {
    if (Math.abs(mesh.vertProperties[i + 1] - 2) < 1e-3) {
      min = Math.min(min, mesh.vertProperties[i]);
      max = Math.max(max, mesh.vertProperties[i]);
    }
  }
  assert.ok(Math.abs(max - min - 12) < 1e-3, `cumeeira esperada 12 (comprimento total, sem hip), obtida ${max - min}`);
});
