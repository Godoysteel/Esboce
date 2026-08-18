import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Scene3DRenderer.ts não é importável direto (depende de Three.js/DOM em
// tempo de carga) — testado por busca de texto, mesma técnica já usada
// em outros testes deste módulo (ver materials-real-price.test.mjs).
const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

// Pedido do Product Owner, com print: telhado uma-água ficava aberto —
// sem fechamento lateral (ao contrário do duas-águas, que já fecha os
// dois oitões). buildRoofUmaAgua ganhou o mesmo tratamento de
// buildRoofDuasAguas: dois addGable(), reaproveitando buildGableMesh e
// as cores gableColors.a/b já existentes (Roof.gableFinishA/B).
test('buildRoofUmaAgua recebe gableColors e constrói os dois fechamentos laterais (addGable a/b)', () => {
  const start = source.indexOf('function buildRoofUmaAgua(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofUmaAgua\(topBounds: any, topY: any, roofColor: any, gableColors: any/);
  assert.match(body, /function addGable\(mesh: any, side: string\)/);
  assert.match(body, /addGable\(buildGableMesh\(\[[\s\S]*?\], gableColors\.a\), 'a'\);/);
  assert.match(body, /addGable\(buildGableMesh\(\[[\s\S]*?\], gableColors\.b\), 'b'\);/);
  // Dois branches (slopeAlongZ e o else) — cada um com seu par de
  // fechamentos, não só um dos dois casos.
  const gableCallCount = (body.match(/addGable\(buildGableMesh\(/g) || []).length;
  assert.equal(gableCallCount, 4, 'esperava 4 chamadas addGable (2 fechamentos × 2 branches de ridgeAxis)');
});

test('a chamada de buildRoofUmaAgua passa gableColors (antes não passava nada)', () => {
  assert.match(source, /buildRoofUmaAgua\(bounds, floorTopY, roofColor, gableColors, pitchDeg, ridgeAxis, tabeiraColor\)/);
});

test('wallSupportsRoofGable também reconhece uma-água (suprime contorno duplicado igual já fazia pro duas-águas)', () => {
  assert.match(source, /if \(roof\.type !== 'duasAguas' && roof\.type !== 'umaAgua'\) return false;/);
});

test('orçamento soma o fechamento lateral do uma-água como parede (mesmo tratamento do oitão de duas-águas)', () => {
  assert.match(
    materialsSource,
    /if \(\(roof\.type === 'duasAguas' \|\| roof\.type === 'umaAgua'\) && roof\.atticMode !== 'generated'\) \{/,
  );
});
