// NavGizmo — mini-casa no canto da tela que mostra a orientação atual da
// câmera (bússola visual). Migrado de `var NavGizmo =
// (function(){...})()` no index.html monolítico original (ver
// legacy/index-monolito-original.html, linhas 6112-6225).

import * as THREE from 'three';

let navRenderer: THREE.WebGLRenderer | undefined;
let navScene: THREE.Scene | undefined;
let navCamera: THREE.PerspectiveCamera | undefined;

function makeFaceMaterial(label: string | null, bgHex: string, fontSize?: number): THREE.MeshBasicMaterial {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, size, size);
  if (label) {
    ctx.fillStyle = '#2C2C2A';
    ctx.font = 'bold ' + (fontSize || 20) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.MeshBasicMaterial({ map: tex });
}

// Telhado duas-águas de verdade (não é mais o cone de 4 lados que dava
// um quatro-águas por acidente) — cumeeira corre no eixo Z (frente↔
// fundos), as duas águas ficam viradas pra ESQUERDA/DIREITA (onde as
// letras E/D estão), e a empena triangular fica na FRENTE (onde a
// portinha está) e nos FUNDOS. Geometria construída à mão (6 triângulos,
// vértices explícitos) — mesma técnica das bandas de parede das
// esquadrias, só que pra um prisma simples.
function buildGableRoofGeometry(width: number, depth: number, ridgeHeight: number): THREE.BufferGeometry {
  const w2 = width / 2, d2 = depth / 2;
  const FL = [-w2, 0, d2], FR = [w2, 0, d2], FA = [0, ridgeHeight, d2];
  const BL = [-w2, 0, -d2], BR = [w2, 0, -d2], BA = [0, ridgeHeight, -d2];
  const verts: number[] = [];
  function tri(a: number[], b: number[], c: number[]) { verts.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!); }
  tri(FL, FR, FA);       // empena da frente
  tri(BR, BL, BA);       // empena dos fundos
  tri(BL, FL, FA); tri(BL, FA, BA); // água da esquerda
  tri(FR, BR, BA); tri(FR, BA, FA); // água da direita
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

export function init(): void {
  const canvasEl = document.getElementById('navGizmoCanvas') as HTMLCanvasElement | null;
  if (!canvasEl) return;
  navRenderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  // Renderiza em 2x o tamanho exibido (CSS 58px) — canvas menor na tela,
  // mas nítido, não borrado.
  navRenderer.setSize(116, 116, false);

  navScene = new THREE.Scene();
  navCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);

  navScene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const navLight = new THREE.DirectionalLight(0xffffff, 0.55);
  navLight.position.set(3, 5, 2);
  navScene.add(navLight);

  // Corpo: BoxGeometry — ordem de materiais do three.js é [+x,-x,+y,-y,+z,-z].
  // Frente/fundos ficam sem rótulo de texto — a portinha (abaixo) já
  // marca a frente, e não faz sentido rotular os fundos sozinhos.
  const sideBg = '#D9D5C7';
  const bodyH = 0.7;
  const bodyMats = [
    makeFaceMaterial('D', sideBg, 52),
    makeFaceMaterial('E', sideBg, 52),
    makeFaceMaterial(null, sideBg),
    makeFaceMaterial(null, '#B9B6AA'),
    makeFaceMaterial(null, sideBg),
    makeFaceMaterial(null, sideBg)
  ];
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, bodyH, 1), bodyMats);
  navScene.add(body);

  // Portinha na face da frente (+Z), só pra simbolizar "essa é a frente"
  // de um jeito que não depende de ler texto nenhum.
  const doorW = 0.22, doorH = 0.42;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8B4A2B, flatShading: true })
  );
  door.position.set(0, -bodyH / 2 + doorH / 2, 0.5 + 0.02);
  navScene.add(door);

  // Telhado duas-águas, cumeeira no eixo Z, com um pequeno beiral além
  // do corpo (1x1) pra ficar reconhecível como telhado de verdade, não
  // só uma tampa.
  const roof = new THREE.Mesh(
    buildGableRoofGeometry(1.18, 1.18, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xB5573A, flatShading: true, side: THREE.DoubleSide })
  );
  roof.position.y = bodyH / 2;
  navScene.add(roof);
}

// Chamado toda vez que a câmera principal gira (ver
// ViewportController.updateCam) — nunca precisa saber de projeto,
// paredes ou seleção, só do ângulo atual.
export function update(camAngle: number, camElev: number): void {
  if (!navRenderer || !navScene || !navCamera) return;
  const dist = 3.2;
  navCamera.position.set(
    dist * Math.cos(camAngle) * Math.cos(camElev),
    dist * Math.sin(camElev),
    dist * Math.sin(camAngle) * Math.cos(camElev)
  );
  navCamera.lookAt(0, 0, 0);
  navRenderer.render(navScene, navCamera);
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const NavGizmo = { init, update };
