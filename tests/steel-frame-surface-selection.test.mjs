import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/core/SteelFrameConfigurator.ts', import.meta.url), 'utf8');
const viewport = readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('configuração Steel Frame acontece por clique direto na face A/B', () => {
  assert.match(viewport, /wallFaceAtPoint\(sfHit\.object\.userData\.wallId/);
  assert.match(viewport, /kind: 'wall-face'/);
  assert.match(app, /setSteelFrameSurfaceSelectionHandler/);
});

test('configurador é painel lateral e não cria fundo que cobre a tela', () => {
  assert.match(html, /#steelFrameConfigurator \{ position:fixed;[^}]*right:82px;[^}]*width:min\(330px/);
  assert.doesNotMatch(html, /#steelFrameConfigurator \{[^}]*inset:0/);
  assert.doesNotMatch(html, /#steelFrameConfigurator \{[^}]*background:rgba\(20,24,28/);
});

test('lista contextual oferece sistemas externos e drywall interno', () => {
  assert.match(app, /Revestimentos externos/);
  assert.match(app, /Revestimentos internos/);
  assert.match(app, /data-sf-system/);
});

test('faces concluídas ficam coloridas, não podem ser selecionadas novamente e bloqueiam o quantitativo enquanto houver pendências', () => {
  assert.match(app, /targetIsConfigured/);
  assert.match(app, /return false/);
  assert.match(app, /quantityButton\.disabled = issues\.length > 0/);
  assert.match(viewport, /Face já configurada/);
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /steelFrameFaceConfigured/);
  assert.match(renderer, /steelFrameRoofConfigured/);
  assert.match(renderer, /steelFrameAssemblyColorHex/);
  assert.match(html, /data-sf-quantity\]:disabled/);
});

test('painel orienta o usuário pelo próximo item e lista pendências com nomes compreensíveis', () => {
  assert.match(app, /function issueLabel/);
  assert.match(app, /PRÓXIMO PASSO/);
  assert.match(app, /Ainda falta configurar/);
  assert.match(app, /Parede.*isolamento térmico e acústico/);
  assert.match(app, /oitão/);
  assert.match(app, /beiral/);
  assert.match(app, /tabeira/);
  assert.match(app, /platibanda/);
  assert.match(html, /\.sf-next-step/);
});

test('fluxo oculta o telhado durante paredes e libera pavimentos em sequência', () => {
  assert.match(app, /setSteelFrameRoofHidden\(wallStage\(issues\)\)/);
  assert.match(app, /Conclua primeiro a etapa/);
  assert.match(app, /sistema da laje \(em implantação\)/);
  assert.match(viewport, /hideRoofs: steelFrameRoofHidden/);
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /if \(!viewState\.hideRoofs\)/);
});

test('somente a face definida fica colorida imediatamente, sem seleção laranja da parede inteira', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /steelFrameFaceAssemblyId = side === 'a' \? w\.faceAAssemblyId : w\.faceBAssemblyId/);
  assert.doesNotMatch(renderer, /steelFrameFaceConfigured.*cavityAssembly/);
  assert.match(renderer, /!viewState\.steelFrameConfigMode && \(isSelected/);
  assert.match(viewport, /selectedWall: steelFrameSurfaceSelectionHandler \? null : selectedWall/);
  assert.match(viewport, /highlightedCategory: steelFrameSurfaceSelectionHandler \? null : highlightedCategory/);
});

test('cada sistema usa uma cor própria e a pendência separa faces de isolamentos', () => {
  const assemblies = readFileSync(new URL('../src/core/SteelFrameAssemblies.ts', import.meta.url), 'utf8');
  assert.match(assemblies, /function steelFrameAssemblyColorHex/);
  assert.match(app, /steelFrameAssemblyColorHex\(system\.id\)/);
  assert.match(app, /isolamentos/);
  assert.match(app, /Marcos de portas\/janelas e o topo das paredes não entram/);
  assert.match(html, /--sf-system-color/);
});

test('extensão vertical da cumeeira em níveis é selecionável como parede', () => {
  assert.match(viewport, /kind: 'stepped-wall-face'/);
  assert.match(viewport, /roofWallFace/);
  assert.match(app, /Extensão da cumeeira · face/);
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /steppedWallFaceAAssemblyId/);
  assert.match(renderer, /steppedWallFaceBAssemblyId/);
});

test('paredes com isolamento recebem faixa turquesa persistente sem precisar clicar', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /insulationSystemId !== 'none'/);
  assert.match(renderer, /steelFrameInsulationMarker = true/);
  assert.match(renderer, /color: 0x06B6D4/);
  assert.match(app, /faixa turquesa no topo identificam uma parede com isolamento/);
});

test('hachura de isolamento aparece sobre a cor do sistema e respeita portas e janelas', () => {
  const renderer = readFileSync(new URL('../src/core/Scene3DRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /function buildSteelFrameInsulationHatchMaterial/);
  assert.match(renderer, /steelFrameFaceConfigured && wallHasSteelFrameInsulation/);
  assert.match(renderer, /steelFrameInsulationHatch = true/);
  assert.match(renderer, /buildFaceBandMesh\([^;]+insulationHatchMat/);
  assert.match(renderer, /insulationBandHatchMesh\.raycast = function \(\) \{\}/);
  assert.match(app, /hachura diagonal sobre a cor/);
});

test('pendências de cobertura são nomeadas e clique na telha orienta para a face vertical', () => {
  assert.match(app, /function pendingSummary/);
  assert.match(app, /face da extensão/);
  assert.match(app, /face da platibanda/);
  assert.match(app, /O clique foi na telha/);
  assert.match(app, /Gire a construção e clique diretamente na face vertical indicada/);
  assert.match(html, /\.sf-attention-notice/);
});

test('beiral e tabeira são configurados globalmente sem selecionar telhado por telhado', () => {
  assert.match(app, /Acabamentos globais da cobertura/);
  assert.match(app, /Forro de todos os beirais/);
  assert.match(app, /Todas as tabeiras/);
  assert.match(app, /Aplicar em toda a construção/);
  assert.match(app, /setSteelFrameGlobalRoofFinishes/);
  assert.match(app, /fasciaSystems/);
  assert.doesNotMatch(app, /<h4>Beiral<\/h4>/);
  assert.doesNotMatch(app, /<h4>Tabeira<\/h4>/);
});
