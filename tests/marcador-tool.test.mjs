import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Ferramenta nativa "Marcador de falha" (pedido explícito do Product
// Owner): depois de uma sessão inteira tentando localizar defeitos
// visuais só por descrição/print, e de o clique de diagnóstico genérico
// da ferramenta "Apagar" ter ocultado peças de espigão por engano (ele
// sempre aciona o toggle de ocultar quando cai numa peça nomeada, não só
// reporta), o Product Owner pediu uma ferramenta separada que NUNCA
// apaga/oculta nada — só marca, com um marcador visível na própria cena
// (pra aparecer no print) nos dois pontos (início/fim) de uma falha.
function viewportSource() {
  return readFileSync(new URL('../src/core/ViewportController.ts', import.meta.url), 'utf8');
}

function indexHtml() {
  return readFileSync(new URL('../index.html', import.meta.url), 'utf8');
}

test('botão "Marcador" existe em index.html como tool-btn comum (data-tool="marcador"), fora de qualquer categoria de desenho', () => {
  const html = indexHtml();
  const panelMaisStart = html.indexOf('id="panelMais"');
  assert.notEqual(panelMaisStart, -1);
  const panelMaisBlock = html.slice(panelMaisStart, panelMaisStart + 3000);
  assert.match(panelMaisBlock, /<button class="ts-btn tool-btn" id="toolMarcador" data-tool="marcador"/);
});

test('ferramenta "marcador" tem hint próprio e nunca aparece nos ramos de apagar/ocultar', () => {
  const source = viewportSource();
  assert.match(source, /marcador: 'Clique no ponto INICIAL da falha/);
  // Não deve existir em nenhum lugar perto de hiddenRidgePieceIds/demolish
  // — é uma ferramenta puramente de leitura, comando (Store.commands)
  // nenhum é chamado a partir dela.
  const toolBlockStart = source.indexOf("if (currentTool === 'marcador') {");
  assert.notEqual(toolBlockStart, -1);
  const toolBlockEnd = source.indexOf('\n\n', toolBlockStart);
  const toolBlock = source.slice(toolBlockStart, toolBlockEnd + 400);
  assert.doesNotMatch(toolBlock, /hiddenRidgePieceIds/);
  assert.doesNotMatch(toolBlock, /Store\.commands\./);
});

test('addMarcadorPoint nunca chama Store.commands (só lê/mostra) e usa pickMeshHit (acerta a malha real, mesmo escondida por pixel) com fallback pro chão', () => {
  const source = viewportSource();
  const start = source.indexOf('function addMarcadorPoint');
  assert.notEqual(start, -1);
  const end = source.indexOf('// ---- painel de piso 2D', start);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /Store\.commands\./, 'a ferramenta de marcar nunca deve mudar o modelo');
  assert.match(body, /var hit = pickMeshHit\(clientX, clientY\);/);
  assert.match(body, /getGroundModelPoint\(clientX, clientY\)/);
});

// Dois cliques = par (início vermelho + fim azul, ligados por uma linha);
// um terceiro clique reinicia o par em vez de acumular sem limite —
// evita que marcadores de falhas antigas, já resolvidas, poluam a cena
// pra sempre.
test('addMarcadorPoint: dois cliques formam um par (cores diferentes + linha conectando), terceiro clique reinicia', () => {
  const source = viewportSource();
  const start = source.indexOf('function addMarcadorPoint');
  const end = source.indexOf('// ---- painel de piso 2D', start);
  const body = source.slice(start, end);
  assert.match(body, /if \(marcadorPoints\.length >= 2\) clearMarcadorMarkers\(\);/);
  assert.match(body, /color: isFirst \? 0xFF3B30 : 0x0A84FF/);
  assert.match(body, /if \(marcadorPoints\.length === 2\) \{/);
  assert.match(body, /new THREE\.Line\(lineGeo, new THREE\.LineBasicMaterial/);
  assert.match(body, /Distância entre os dois: ' \+ dist\.toFixed\(2\) \+ 'm/);
});

// Os marcadores precisam sobreviver a troca de ferramenta (o usuário
// troca pra Orbit e tira um print) — só devem sumir quando a própria
// ferramenta "Marcador" é reaberta (começando um par novo). Marcadores
// soltos na cena (nunca dentro de `registry`) sobrevivem a
// Scene3DRenderer.rebuild() por construção — mesmo mecanismo já usado
// pelos marcadores de percurso hidráulico guiado (hydraulicRouteDrawMarkers).
test('marcadores do "Marcador" só são limpos ao REATIVAR a ferramenta (setTool), nunca automaticamente ao trocar de ferramenta', () => {
  const source = viewportSource();
  assert.match(source, /if \(tool === 'marcador'\) clearMarcadorMarkers\(\);/);
  // A limpeza só existe dentro de setTool (reativação) e da própria
  // addMarcadorPoint (terceiro clique) — não em cancelPlacing/deselect,
  // que rodam em toda troca de ferramenta.
  const cancelPlacingStart = source.indexOf('function cancelPlacing(');
  const cancelPlacingEnd = source.indexOf('\n  }', cancelPlacingStart);
  const deselectStart = source.indexOf('function deselect(');
  const deselectEnd = source.indexOf('\n  }', deselectStart);
  assert.doesNotMatch(source.slice(cancelPlacingStart, cancelPlacingEnd), /clearMarcadorMarkers/);
  assert.doesNotMatch(source.slice(deselectStart, deselectEnd), /clearMarcadorMarkers/);
});

test('clearMarcadorMarkers remove os dois marcadores E a linha da cena, sem deixar sobra', () => {
  const source = viewportSource();
  const start = source.indexOf('function clearMarcadorMarkers');
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  assert.match(body, /marcadorMarkers\.forEach\(function \(m: any\) \{ scene\.remove\(m\); \}\);/);
  assert.match(body, /marcadorMarkers = \[\];/);
  assert.match(body, /if \(marcadorLine\) \{ scene\.remove\(marcadorLine\); marcadorLine = null; \}/);
  assert.match(body, /marcadorPoints = \[\];/);
});
