import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Scene3DRenderer.ts não é importável direto (depende de Three.js/DOM em
// tempo de carga) — testado por busca de texto, mesma técnica já usada
// em outros testes deste módulo (ver materials-real-price.test.mjs).
const source = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
const materialsSource = readFileSync(new URL('../src/core/MaterialsPanel.ts', import.meta.url), 'utf8');

// Pedido do Product Owner, com print: telhado uma-água ficava aberto —
// sem fechamento nenhum (ao contrário do duas-águas, que já fecha os
// dois oitões). buildRoofUmaAgua ganhou os DOIS fechamentos laterais
// (triângulo/trapézio reto, reaproveitando gableColors.a/b) igual ao
// duas-águas.
test('buildRoofUmaAgua recebe gableColors e constrói os dois fechamentos laterais (addGable a/b)', () => {
  const start = source.indexOf('function buildRoofUmaAgua(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /function buildRoofUmaAgua\(topBounds: any, topY: any, roofColor: any, gableColors: any, backWallColor: any/);
  assert.match(body, /function addGable\(mesh: any, side: string\)/);
  assert.match(body, /addGable\(buildGableMesh\(\[[\s\S]*?\], gableColors\.a\), 'a'\);/);
  assert.match(body, /addGable\(buildGableMesh\(\[[\s\S]*?\], gableColors\.b\), 'b'\);/);
  // Dois branches (slopeAlongZ e o else) — cada um com seu par de
  // fechamentos laterais, não só um dos dois casos.
  const gableCallCount = (body.match(/addGable\(buildGableMesh\(/g) || []).length;
  assert.equal(gableCallCount, 4, 'esperava 4 chamadas addGable (2 fechamentos laterais × 2 branches de ridgeAxis)');
});

// Segundo relato, depois do primeiro: os fechamentos LATERAIS ficaram
// certos, mas faltava um terceiro painel — retangular, na parede do
// lado ALTO do caimento ("não fechou a parte de trás, a parede deve
// subir"). Painel novo usa a cor da PAREDE de verdade (wallMatchColor,
// mesma técnica do parapeito da platibanda), não a cor de fechamento
// lateral — e vai como DoubleSide de propósito, já que não há como
// verificar visualmente o sentido de enrolamento dos vértices neste
// ambiente.
test('buildRoofUmaAgua também fecha o painel de trás (lado alto), com a cor da parede de verdade, DoubleSide', () => {
  const start = source.indexOf('function buildRoofUmaAgua(');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /function addBackWall\(mesh: any\) \{/);
  assert.match(body, /m\.side = THREE\.DoubleSide/);
  const backWallCallCount = (body.match(/addBackWall\(buildGableMesh\(/g) || []).length;
  assert.equal(backWallCallCount, 2, 'esperava 2 chamadas addBackWall (1 painel de trás × 2 branches de ridgeAxis)');
  assert.match(body, /addBackWall\(buildGableMesh\(\[[\s\S]*?\], backWallColor\)\);/);
});

test('a chamada de buildRoofUmaAgua passa gableColors e backWallColor (cor da parede real, mesma técnica do parapeito)', () => {
  assert.match(source, /var backWallColor = pickColor\(wallMatchColor != null \? wallMatchColor : GABLE_COLOR, 'telhado', viewState\);/);
  assert.match(source, /buildRoofUmaAgua\(bounds, floorTopY, roofColor, gableColors, backWallColor, pitchDeg, ridgeAxis, tabeiraColor, soffitColor\)/);
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

test('orçamento também soma o painel de trás do uma-água (área própria, umaAguaBackWallAreaMeters)', () => {
  assert.match(materialsSource, /function umaAguaBackWallAreaMeters\(roof: Roof\): number \{/);
  assert.match(materialsSource, /if \(roof\.type === 'umaAgua' && roof\.atticMode !== 'generated'\) \{/);
  assert.match(materialsSource, /const backWallArea = umaAguaBackWallAreaMeters\(roof\);/);
  assert.match(materialsSource, /totals\.wallAreaNet \+= backWallArea;/);
});
