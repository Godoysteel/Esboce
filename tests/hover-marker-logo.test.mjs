import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// ViewportController.ts não é importável direto pelo test runner
// nativo do Node (mesma limitação documentada nos demais testes deste
// projeto: redirecionamento '.js' -> '.ts' que só o Vite resolve) —
// testado por busca de texto.
const viewportControllerSource = await readFile(
  new URL('../src/core/ViewportController.ts', import.meta.url),
  'utf8',
);
const indexHtmlSource = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

// Pedido do Product Owner: trocar o cubo verde do topo do marcador de
// hover (o "indicador do Sims" que mostra onde o desenho vai começar)
// pela logo do Esboce.
test('buildLogoSprite() reaproveita o MESMO desenho da .brand-logo do index.html (mesmos atributos "d"), não um redesenho à mão', () => {
  const start = viewportControllerSource.indexOf('function buildLogoSprite() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  // Cada caminho do SVG original (index.html) precisa aparecer
  // literalmente aqui — garante que não desalinhou/redesenhou torto.
  const svgStart = indexHtmlSource.indexOf('<svg class="brand-logo"');
  const svgEnd = indexHtmlSource.indexOf('</svg>', svgStart);
  const svgBody = indexHtmlSource.slice(svgStart, svgEnd);
  const pathAttrs = [...svgBody.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(pathAttrs.length >= 8, 'esperava pelo menos 8 caminhos no SVG original (7 do contorno + 1 da porta)');
  pathAttrs.forEach((d) => {
    assert.ok(body.includes(d), `caminho do SVG original ausente no sprite: ${d}`);
  });
});

test('logo vira Sprite (sempre de frente pra câmera), não um plano fixo — legível em qualquer ângulo', () => {
  const start = viewportControllerSource.indexOf('function buildLogoSprite() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /new THREE\.Sprite\(new THREE\.SpriteMaterial\(\{ map: texture, depthTest: false, transparent: true \}\)\)/);
});

test('cor da porta (terracota) preservada — mesma cor exata do SVG original', () => {
  const start = viewportControllerSource.indexOf('function buildLogoSprite() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /#C1673F/);
});

// Correção pós-lançamento: primeira versão ficava "apagada" (traço
// fino e claro direto sobre a grama verde, baixo contraste) — ganhou
// um fundo branco arredondado atrás (mesma técnica de hydraulicLabelSprite)
// e traço mais grosso/escuro.
test('logo tem fundo branco arredondado atrás (contraste contra a grama) — correção do "ficou apagado"', () => {
  const start = viewportControllerSource.indexOf('function buildLogoSprite() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /ctx\.fillStyle = 'rgba\(255,255,255,\.96\)';/);
  assert.match(body, /ctx\.roundRect\(/);
  assert.match(body, /ctx\.lineWidth = 8;/); // mais grosso que a v1 (era 6)
  assert.match(body, /#1B1C1E/); // mais escuro que a v1 (era #2C2C2A)
});

test('buildHoverMarker() usa buildLogoSprite() no lugar do cubo verde antigo — pole/tip/ring (haste, ponta, anel no chão) continuam do mesmo jeito', () => {
  const start = viewportControllerSource.indexOf('function buildHoverMarker() {');
  const end = viewportControllerSource.indexOf('\n  }', start);
  const body = viewportControllerSource.slice(start, end);
  assert.match(body, /var cap = buildLogoSprite\(\);/);
  assert.doesNotMatch(body, /new THREE\.BoxGeometry\(0\.13, 0\.13, 0\.13\)/);
  // Continua no mesmo ponto (topo da haste) e a haste/ponta/anel não
  // foram tocados nesta mudança.
  assert.match(body, /cap\.position\.y = poleHeight \+ 0\.1;/);
  assert.match(body, /new THREE\.CylinderGeometry\(0\.018, 0\.018, poleHeight, 8\)/);
  assert.match(body, /new THREE\.ConeGeometry\(0\.045, 0\.11, 10\)/);
  assert.match(body, /new THREE\.RingGeometry\(0\.07, 0\.11, 20\)/);
});
