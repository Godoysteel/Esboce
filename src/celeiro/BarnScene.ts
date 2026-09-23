// BarnScene.ts — viewer 3D realista (Three.js, procedural) do configurador
// de celeiro/galpão metálico (DEC-230). Autocontido: não depende do editor.
// Realismo: chapa trapezoidal com nervuras REAIS na geometria (paredes com
// vãos cortados de verdade, telhado nervurado), materiais PBR, reflexos por
// ambiente (PMREM), sombras suaves, tone mapping ACES, estrutura metálica
// visível no galpão aberto, calhas, rufos, portões/portas/janelas com
// caixilho e vidro, silo, fardos de feno, gramado, cascalho e árvores.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { normalizeBarnConfig, findBarnColor, type BarnConfig } from './BarnPricing.js';

type Opening = { x0: number; x1: number; y0: number; y1: number };
type ProfileKind = 'trap' | 'fine';

const BASE_Y = 0.15; // topo da laje de concreto
const RIB = 0.032;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Perfil da chapa: lista de [posição, profundidade] ao longo de `length`.
function makeProfile(length: number, pitch: number, depth: number, kind: ProfileKind): [number, number][] {
  const pattern: [number, number][] =
    kind === 'trap' ? [[0, 0], [0.35, 0], [0.5, 1], [0.85, 1], [1, 0]]
    : [[0, 0], [0.25, 1], [0.5, 1], [0.75, 0], [1, 0]];
  const pts: [number, number][] = [];
  const n = Math.ceil(length / pitch);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < pattern.length; j++) {
      const x = (i + pattern[j]![0]) * pitch;
      if (j === 0 && i > 0) continue;
      if (x >= length) { pts.push([length, pattern[j]![1] * depth]); return pts; }
      pts.push([x, pattern[j]![1] * depth]);
    }
  }
  const last = pts[pts.length - 1]!;
  if (last[0] < length) pts.push([length, last[1]]);
  return pts;
}

function geometryFromTriangles(v: number[], uvOf?: (x: number, y: number, z: number) => [number, number]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  if (uvOf) {
    const uv: number[] = [];
    for (let i = 0; i < v.length; i += 3) uv.push(...uvOf(v[i]!, v[i + 1]!, v[i + 2]!));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  g.computeVertexNormals();
  return g;
}

// Parede nervurada com topo variável (empena) e vãos cortados de verdade.
// Local: x ao longo da parede, y pra cima, z pra fora.
function corrugatedWall(length: number, topAt: (x: number) => number, openings: Opening[], pitch: number, depth: number, kind: ProfileKind, bottom = BASE_Y): THREE.BufferGeometry {
  const prof = makeProfile(length, pitch, depth, kind);
  const v: number[] = [];
  const quad = (xa: number, da: number, ya0: number, ya1: number, xb: number, db: number, yb0: number, yb1: number) => {
    v.push(xa, ya0, da, xb, yb0, db, xb, yb1, db, xa, ya0, da, xb, yb1, db, xa, ya1, da);
  };
  for (let i = 0; i < prof.length - 1; i++) {
    const [xa, da] = prof[i]!; const [xb, db] = prof[i + 1]!;
    if (xb - xa < 1e-6) continue;
    const mid = (xa + xb) / 2;
    const cuts = openings.filter((o) => mid > o.x0 && mid < o.x1).sort((a, b) => a.y0 - b.y0);
    let lo = bottom;
    for (const c of cuts) {
      if (c.y0 > lo) quad(xa, da, lo, c.y0, xb, db, lo, c.y0);
      lo = Math.max(lo, c.y1);
    }
    const ta = topAt(xa), tb = topAt(xb);
    if (Math.max(ta, tb) > lo) quad(xa, da, lo, ta, xb, db, lo, tb);
  }
  return geometryFromTriangles(v, (x, y) => [x, y]);
}

// Chapa de telhado nervurada entre dois pontos do perfil (x,y), ao longo de z.
function corrugatedRoofSheet(p0: [number, number], p1: [number, number], z0: number, z1: number, pitch: number, depth: number, kind: ProfileKind): THREE.BufferGeometry {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const prof = makeProfile(z1 - z0, pitch, depth, kind);
  const v: number[] = [];
  const P = (p: [number, number], d: number, z: number) => [p[0] + nx * d, p[1] + ny * d, z];
  for (let i = 0; i < prof.length - 1; i++) {
    const za = z0 + prof[i]![0], zb = z0 + prof[i + 1]![0];
    const da = prof[i]![1], db = prof[i + 1]![1];
    v.push(...P(p0, da, za), ...P(p1, da, za), ...P(p1, db, zb), ...P(p0, da, za), ...P(p1, db, zb), ...P(p0, db, zb));
  }
  const ux = dx / len, uy = dy / len;
  return geometryFromTriangles(v, (x, y, z) => [z, (x - p0[0]) * ux + (y - p0[1]) * uy]);
}

function noiseTexture(base: string, spread: number, size = 256, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(7);
  for (let i = 0; i < size * size * 0.35; i++) {
    const g = Math.floor((rnd() - 0.5) * spread);
    ctx.fillStyle = g > 0 ? `rgba(255,255,255,${g / 255})` : `rgba(0,0,0,${-g / 255})`;
    ctx.fillRect(rnd() * size, rnd() * size, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5f8fc4'); g.addColorStop(0.55, '#a9c8e6'); g.addColorStop(1, '#dbe6ee');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface BarnViewer {
  update(config: BarnConfig): void;
  dispose(): void;
}

export function createBarnViewer(container: HTMLElement): BarnViewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xcfe0ee, 90, 420);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.enablePan = false;

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x6b7a4a, 0.55));

  const grassTex = noiseTexture('#5b7a3a', 70, 256, 90);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 64), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  scene.add(ground);

  let dirty = true;
  let group = new THREE.Group();
  scene.add(group);
  let framed = '';

  function disposeGroup(g: THREE.Group) {
    g.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x: any) => x.dispose());
    });
    scene.remove(g);
  }

  function build(config: BarnConfig) {
    const c = normalizeBarnConfig(config);
    const W = c.widthM, L = c.lengthM, E = c.eaveHeightM, half = W / 2;
    const color = findBarnColor(c.colorId);
    const isBarn = c.model === 'celeiro', open = c.model === 'aberto';
    const g = new THREE.Group();

    // ---------- materiais ----------
    const wallColor = new THREE.Color(color.hex);
    const trimColor = isBarn ? new THREE.Color('#f2f1ec') : wallColor.clone().multiplyScalar(0.72);
    const roofColor = c.roof === 'fibrocimento' ? new THREE.Color('#9b9d9a') : isBarn ? new THREE.Color('#2f6b57') : wallColor.clone().multiplyScalar(0.9);
    const metal = (col: THREE.Color, rough = 0.48, met = 0.55) => new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: met, side: THREE.DoubleSide, envMapIntensity: 1 });
    const wallMat = metal(wallColor);
    const trimMat = metal(trimColor, 0.5, 0.35);
    const roofMat = c.roof === 'fibrocimento' ? new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.92, metalness: 0, side: THREE.DoubleSide })
      : metal(roofColor, c.roof === 'termoacustica' ? 0.38 : 0.5, 0.6);
    const steelMat = new THREE.MeshStandardMaterial({ color: '#5d6166', roughness: 0.55, metalness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.7, metalness: 0.3 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#9db8c9', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.42, envMapIntensity: 1.8, side: THREE.DoubleSide });
    const alumMat = new THREE.MeshStandardMaterial({ color: '#e9eaea', roughness: 0.4, metalness: 0.6 });
    const concreteMat = new THREE.MeshStandardMaterial({ map: noiseTexture('#a5a49f', 40, 256, Math.max(2, Math.round(L / 6))), roughness: 0.92 });
    const gravelMat = new THREE.MeshStandardMaterial({ map: noiseTexture('#8a867d', 90, 256, 6), roughness: 1 });
    const strawMat = new THREE.MeshStandardMaterial({ color: '#c9a95a', roughness: 1 });

    const add = (o: THREE.Object3D, parent: THREE.Object3D = g) => { parent.add(o); return o; };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
    };

    // ---------- perfil do telhado ----------
    // Galpões: duas águas. Celeiro: "monitor barn" americano — nave central
    // elevada (parede com janelas + telhado de duas águas) e duas abas
    // laterais de uma água, como na referência do cliente.
    type Seg = { a: [number, number]; b: [number, number]; extA: boolean; extB: boolean };
    const roofSegs: Seg[] = [];
    let gableTopWorld: (x: number) => number;
    let ridgeY: number;
    const core = half * 0.5;
    const tanShed = Math.tan((16 * Math.PI) / 180), tanGable = Math.tan((20 * Math.PI) / 180);
    const Ew = E + (half - core) * tanShed;
    const clerH = 2.2 + W * 0.03;
    const Ecl = Ew + clerH;
    if (isBarn) {
      ridgeY = Ecl + core * tanGable;
      roofSegs.push(
        { a: [-half, E], b: [-core, Ew], extA: true, extB: false },
        { a: [-core, Ecl], b: [0, ridgeY], extA: true, extB: false },
        { a: [0, ridgeY], b: [core, Ecl], extA: false, extB: true },
        { a: [core, Ew], b: [half, E], extA: false, extB: true },
      );
      gableTopWorld = (x: number) => { const ax = Math.abs(x); return ax > core ? E + (half - ax) * tanShed : Ecl + (core - ax) * tanGable; };
    } else {
      ridgeY = E + half * Math.tan((11 * Math.PI) / 180);
      roofSegs.push(
        { a: [-half, E], b: [0, ridgeY], extA: true, extB: false },
        { a: [0, ridgeY], b: [half, E], extA: false, extB: true },
      );
      gableTopWorld = (x: number) => E + (half - Math.abs(x)) * Math.tan((11 * Math.PI) / 180);
    }

    // ---------- laje, cascalho ----------
    box(W + 1.2, BASE_Y, L + 1.2, concreteMat, 0, BASE_Y / 2 - 0.0, 0, g, false).receiveShadow = true;
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 10, 12), gravelMat);
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.005, L / 2 + 7.2); apron.receiveShadow = true; add(apron);

    // ---------- aberturas nas paredes ----------
    const sideCount = (n: number): [number, number] => [Math.ceil(n / 2), Math.floor(n / 2)];
    const [doorsL, doorsR] = sideCount(c.doors), [winR, winL] = sideCount(c.windows);
    const layout = (doors: number, wins: number) => {
      const n = doors + wins; const items: { kind: 'door' | 'window'; x: number }[] = [];
      for (let i = 0; i < n; i++) {
        const isDoor = Math.floor(((i + 1) * doors) / n) > Math.floor((i * doors) / n);
        items.push({ kind: isDoor ? 'door' : 'window', x: (L * (i + 0.5)) / n });
      }
      return items;
    };
    const sideOpenings = (items: { kind: string; x: number }[]): Opening[] => items.map((it) =>
      it.kind === 'door' ? (isBarn ? { x0: it.x - 0.9, x1: it.x + 0.9, y0: BASE_Y, y1: BASE_Y + 2.35 } : { x0: it.x - 0.5, x1: it.x + 0.5, y0: BASE_Y, y1: BASE_Y + 2.15 }) : { x0: it.x - 0.8, x1: it.x + 0.8, y0: 1.55, y1: 2.6 });

    const gateOpen = (i: number): Opening => {
      const cx = (W * (i + 0.5)) / c.gates;
      return { x0: cx - c.gateWidthM / 2, x1: cx + c.gateWidthM / 2, y0: BASE_Y, y1: BASE_Y + c.gateHeightM };
    };
    const frontOpenings: Opening[] = open ? [] : Array.from({ length: c.gates }, (_, i) => gateOpen(i));

    // ---------- moldura de abertura, porta, janela ----------
    const frame = (o: Opening, mat: THREE.Material, parent: THREE.Object3D, t = 0.07, depth = RIB + 0.08) => {
      const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
      box(w + 2 * t, t, depth, mat, cx, o.y1 + t / 2, depth / 2 - 0.02, parent);
      box(t, h + t, depth, mat, o.x0 - t / 2, cy + t / 2, depth / 2 - 0.02, parent);
      box(t, h + t, depth, mat, o.x1 + t / 2, cy + t / 2, depth / 2 - 0.02, parent);
      if (o.y0 > BASE_Y + 0.01) box(w + 2 * t, t, depth, mat, cx, o.y0 - t / 2, depth / 2 - 0.02, parent);
    };
    const windowAt = (o: Opening, parent: THREE.Object3D) => {
      frame(o, isBarn ? trimMat : alumMat, parent, 0.06);
      const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); gp.position.set(cx, cy, 0.0); parent.add(gp);
      if (isBarn) {
        for (const fx of [-1 / 6, 1 / 6]) box(0.025, h, 0.04, trimMat, cx + w * fx, cy, 0.02, parent);
        for (const fy of [-1 / 4, 0, 1 / 4]) box(w, 0.025, 0.04, trimMat, cx, cy + h * fy, 0.02, parent);
        // venezianas brancas dos dois lados (referência do cliente)
        for (const sx of [-1, 1]) {
          const sw = Math.max(0.3, w * 0.32);
          const scx = cx + sx * (w / 2 + 0.06 + sw / 2);
          box(sw, h + 0.06, 0.05, trimMat, scx, cy, 0.05, parent);
          for (let k = 1; k < 6; k++) box(sw - 0.06, 0.012, 0.055, darkMat, scx, cy - h / 2 + (k * (h + 0.06)) / 6, 0.06, parent, false);
        }
      } else {
        box(0.04, h, 0.05, alumMat, cx, cy, 0.02, parent);
        box(w, 0.04, 0.05, alumMat, cx, cy, 0.02, parent);
      }
    };
    // Folha de porta/portão do celeiro: moldura branca, vidro com caixilhos em cima
    // e painel vermelho com X branco embaixo (referência do cliente).
    const barnLeaf = (w: number, h: number, cx: number, cy: number, parent: THREE.Object3D, z: number) => {
      const lf = new THREE.Group(); lf.position.set(cx - w / 2, cy - h / 2, z);
      const t = 0.09, rail = h * 0.52;
      box(w, t, 0.07, trimMat, w / 2, t / 2, 0.035, lf); box(w, t, 0.07, trimMat, w / 2, h - t / 2, 0.035, lf);
      box(t, h, 0.07, trimMat, t / 2, h / 2, 0.035, lf); box(t, h, 0.07, trimMat, w - t / 2, h / 2, 0.035, lf);
      box(w, t, 0.07, trimMat, w / 2, rail, 0.035, lf);
      const gh = h - rail - t;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * t, gh), glassMat); gl.position.set(w / 2, rail + t / 2 + gh / 2, 0.03); lf.add(gl);
      for (let k = 1; k < 3; k++) box(0.03, gh, 0.05, trimMat, t + (k * (w - 2 * t)) / 3, rail + t / 2 + gh / 2, 0.04, lf);
      for (let k = 1; k < 4; k++) box(w - 2 * t, 0.03, 0.05, trimMat, w / 2, rail + t / 2 + (k * gh) / 4, 0.04, lf);
      const ph = rail - t;
      box(w - 2 * t, ph, 0.04, wallMat, w / 2, t + ph / 2, 0.02, lf);
      const len = Math.hypot(w - 2 * t, ph), ang = Math.atan2(ph, w - 2 * t);
      for (const sg of [1, -1]) { const d = box(len, 0.07, 0.05, trimMat, w / 2, t + ph / 2, 0.05, lf); d.rotation.z = sg * ang; }
      parent.add(lf);
    };
    const doorAt = (o: Opening, parent: THREE.Object3D) => {
      if (isBarn) {
        frame(o, trimMat, parent, 0.09);
        const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
        barnLeaf(w / 2 - 0.01, h - 0.02, cx - w / 4, cy, parent, 0.0);
        barnLeaf(w / 2 - 0.01, h - 0.02, cx + w / 4, cy, parent, 0.0);
        const gold = new THREE.MeshStandardMaterial({ color: '#c9a95a', metalness: 0.9, roughness: 0.3 });
        for (const sx of [-1, 1]) box(0.03, 0.22, 0.05, gold, cx + sx * 0.06, cy, 0.09, parent, false);
        return;
      }
      frame(o, alumMat, parent, 0.07);
      const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
      box(w - 0.04, h - 0.03, 0.05, trimMat, cx, cy, 0.0, parent);
      box(0.12, 0.04, 0.09, steelMat, cx + w / 2 - 0.15, cy - 0.05, 0.07, parent);
      box(w - 0.3, h * 0.5, 0.02, alumMat, cx, cy + h * 0.12, 0.035, parent).scale.set(1, 1, 0.6);
    };

    // ---------- portões ----------
    const drawLeaf = (w: number, h: number, cx: number, cy: number, parent: THREE.Object3D, z: number, xBrace: boolean) => {
      if (isBarn) { barnLeaf(w, h, cx, cy, parent, z); return; }
      const leaf = new THREE.Group(); leaf.position.set(cx - w / 2, cy - h / 2, z);
      const panel = new THREE.Mesh(corrugatedWall(w, () => h, [], 0.16, 0.02, 'fine', 0), isBarn ? wallMat : trimMat);
      panel.castShadow = true; panel.receiveShadow = true; leaf.add(panel);
      const t = 0.11;
      const fm = isBarn ? trimMat : steelMat;
      box(w, t, 0.06, fm, w / 2, t / 2, 0.03, leaf); box(w, t, 0.06, fm, w / 2, h - t / 2, 0.03, leaf);
      box(t, h, 0.06, fm, t / 2, h / 2, 0.03, leaf); box(t, h, 0.06, fm, w - t / 2, h / 2, 0.03, leaf);
      box(w, t * 0.8, 0.06, fm, w / 2, h / 2, 0.03, leaf);
      if (xBrace) {
        const len = Math.hypot(w - 2 * t, h - 2 * t), ang = Math.atan2(h - 2 * t, w - 2 * t);
        for (const s of [1, -1]) {
          const d = box(len, t * 0.9, 0.05, fm, w / 2, h / 2, 0.035, leaf); d.rotation.z = s * ang;
        }
      }
      parent.add(leaf);
    };
    const gateAt = (o: Opening, parent: THREE.Object3D) => {
      const w = o.x1 - o.x0, h = o.y1 - o.y0, cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
      frame(o, isBarn ? trimMat : steelMat, parent, 0.12, RIB + 0.1);
      if (c.gateType === 'correr') {
        if (isBarn) {
          // Portão deslizante de duas folhas (X + vidro) correndo num trilho aparente.
          drawLeaf(w / 2 + 0.15, h + 0.08, cx - w / 4 - 0.05, cy + 0.04, parent, RIB + 0.14, true);
          drawLeaf(w / 2 + 0.15, h + 0.08, cx + w / 4 + 0.05, cy + 0.04, parent, RIB + 0.2, true);
          box(w + 1.2, 0.12, 0.12, trimMat, cx, o.y1 + 0.34, RIB + 0.2, parent);
          for (const sx of [-1, 1]) for (const k of [0.15, 0.85]) box(0.1, 0.16, 0.1, darkMat, cx + sx * (w / 2) * (k * 2 - 1) * 0.5 + sx * w * 0.25, o.y1 + 0.24, RIB + 0.2, parent);
          for (const sx of [-1, 1]) box(0.16, 0.2, 0.16, steelMat, cx + sx * (w / 2 + 0.55), o.y1 + 0.34, RIB + 0.2, parent);
          return;
        }
        drawLeaf(w + 0.3, h + 0.08, cx + 0.15, cy + 0.04, parent, RIB + 0.14, isBarn);
        box(w * 2 + 0.6, 0.1, 0.1, steelMat, cx + w / 2, o.y1 + 0.32, RIB + 0.22, parent);
        for (let k = 0; k < 3; k++) box(0.12, 0.14, 0.1, darkMat, cx - w / 2 + 0.3 + k * (w / 3), o.y1 + 0.24, RIB + 0.22, parent);
      } else if (c.gateType === 'duas-folhas') {
        drawLeaf(w / 2 - 0.01, h - 0.02, cx - w / 4, cy, parent, RIB + 0.06, isBarn);
        drawLeaf(w / 2 - 0.01, h - 0.02, cx + w / 4, cy, parent, RIB + 0.06, isBarn);
        for (const s of [-1, 1]) for (const yy of [0.25, h - 0.25]) box(0.06, 0.16, 0.06, darkMat, cx + s * (w / 2 - 0.04), o.y0 + yy, RIB + 0.1, parent);
      } else if (c.gateType === 'enrolar') {
        const slats = Math.floor(h / 0.085);
        for (let k = 0; k < slats; k++) box(w - 0.06, 0.075, 0.03, steelMat, cx, o.y0 + 0.045 + k * (h / slats), RIB + 0.03, parent, false);
        box(w + 0.3, 0.42, 0.34, steelMat, cx, o.y1 + 0.24, RIB + 0.16, parent);
      } else {
        const acc = new THREE.Mesh(corrugatedWall(w, () => h, [], 0.34, 0.11, 'trap', 0), steelMat);
        acc.position.set(o.x0, o.y0, RIB + 0.02); acc.castShadow = true; parent.add(acc);
        box(w, 0.08, 0.14, darkMat, cx, o.y1 - 0.04, RIB + 0.08, parent);
      }
    };

    // ---------- paredes ----------
    const makeWall = (length: number, topAt: (x: number) => number, openings: Opening[], pos: [number, number, number], rotY: number, kind: ProfileKind, mat: THREE.Material, pitch = 0.2, depth = RIB, bottom = BASE_Y) => {
      const wg = new THREE.Group(); wg.position.set(...pos); wg.rotation.y = rotY;
      const mesh = new THREE.Mesh(corrugatedWall(length, topAt, openings, pitch, depth, kind, bottom), mat);
      mesh.castShadow = true; mesh.receiveShadow = true; wg.add(mesh); g.add(wg); return wg;
    };
    const gableTop = (x: number) => gableTopWorld(x - half);
    const wKind: ProfileKind = 'trap';
    const wPitch = 0.2, wDepth = RIB;

    // Galpão aberto: SEM paredes em nenhum lado (só colunas e cobertura).
    if (!open) {
    {
      const fw = makeWall(W, gableTop, frontOpenings, [-half, 0, L / 2], 0, wKind, wallMat, wPitch, wDepth);
      frontOpenings.forEach((o) => gateAt(o, fw));
    }
    const bw = makeWall(W, gableTop, [], [half, 0, -L / 2], Math.PI, wKind, wallMat, wPitch, wDepth);
    void bw;
    const rOpen = sideOpenings(layout(doorsR, winR)), lOpen = sideOpenings(layout(doorsL, winL));
    const rw = makeWall(L, () => E, rOpen, [half, 0, L / 2], Math.PI / 2, wKind, wallMat, wPitch, wDepth);
    const lw = makeWall(L, () => E, lOpen, [-half, 0, -L / 2], -Math.PI / 2, wKind, wallMat, wPitch, wDepth);
    const fillSide = (wg: THREE.Object3D, items: { kind: string; x: number }[]) => {
      const ops = sideOpenings(items);
      items.forEach((it, i) => (it.kind === 'door' ? doorAt(ops[i]!, wg) : windowAt(ops[i]!, wg)));
    };
    fillSide(rw, layout(doorsR, winR)); fillSide(lw, layout(doorsL, winL));

    // cantoneiras e rodapé
    const cornerT = 0.14;
    const corners: [number, number][] = [[-half, -L / 2], [half, -L / 2], [-half, L / 2], [half, L / 2]];
    corners.forEach(([x, z]) => box(cornerT, E - BASE_Y, cornerT, trimMat, x, BASE_Y + (E - BASE_Y) / 2, z, g));

    }

    // ---------- celeiro: nave elevada (lanternim), cúpula, respiro ----------
    if (isBarn) {
      const clerN = Math.max(2, Math.floor(L / 4));
      const clerOpen = (): Opening[] => Array.from({ length: clerN }, (_, i) => {
        const x = (L * (i + 0.5)) / clerN;
        return { x0: x - 0.65, x1: x + 0.65, y0: Ew + 0.7, y1: Ew + 1.6 };
      });
      for (const sx of [-1, 1]) {
        const ops = clerOpen();
        const cw = makeWall(L, () => Ecl, ops, sx > 0 ? [core, 0, L / 2] : [-core, 0, -L / 2], sx > 0 ? Math.PI / 2 : -Math.PI / 2, wKind, wallMat, wPitch, wDepth, Ew - 0.02);
        ops.forEach((o) => windowAt(o, cw));
      }
      const count = Math.max(1, Math.floor(L / 14));
      for (let i = 0; i < count; i++) {
        const z = -L / 2 + (L * (i + 0.5)) / count;
        const cup = new THREE.Group(); cup.position.set(0, ridgeY, z);
        box(1.0, 0.9, 1.0, trimMat, 0, 0.35, 0, cup);
        const faces: [number, number, number][] = [[0, 0.51, 0], [0, -0.51, 0], [0.51, 0, Math.PI / 2], [-0.51, 0, Math.PI / 2]];
        for (const [dx, dz, ry] of faces) {
          for (let k = 0; k < 5; k++) { const lv = box(0.5, 0.025, 0.03, darkMat, dx, 0.12 + k * 0.1, dz, cup, false); lv.rotation.y = ry; }
        }
        const roofC = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.6, 4), wallMat);
        roofC.rotation.y = Math.PI / 4; roofC.position.y = 1.1; roofC.castShadow = true; cup.add(roofC);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8), darkMat); rod.position.y = 1.75; cup.add(rod);
        box(0.5, 0.04, 0.02, darkMat, 0, 1.95, 0, cup, false); box(0.12, 0.12, 0.02, darkMat, 0.3, 1.95, 0, cup, false);
        g.add(cup);
      }
      for (const sz of [-1, 1]) {
        const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 28), trimMat);
        vent.rotation.x = Math.PI / 2; vent.position.set(0, ridgeY - 1.0, sz * (L / 2 + 0.04)); g.add(vent);
        const vin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 28), darkMat);
        vin.rotation.x = Math.PI / 2; vin.position.set(0, ridgeY - 1.0, sz * (L / 2 + 0.05)); g.add(vin);
      }
    }

    // ---------- estrutura aparente (galpão aberto) ----------
    if (open) {
      const n = Math.max(1, Math.round(L / 6));
      for (let k = 0; k <= n; k++) {
        const z = -L / 2 + (k * L) / n;
        for (const sx of [-1, 1]) box(0.26, E, 0.16, steelMat, sx * (half - 0.2), BASE_Y + E / 2, z, g);
        for (const sg of roofSegs) {
          const a = sg.a, b = sg.b;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const r = box(len, 0.28, 0.14, steelMat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.22, z, g); r.rotation.z = ang;
        }
      }
    }
    // terças
    for (const sg of roofSegs) {
      const a = sg.a, b = sg.b;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const cnt = Math.max(2, Math.round(len / 1.5));
      for (let k = 0; k <= cnt; k++) {
        const t = k / cnt;
        const p = box(0.06, 0.14, L + 0.6, steelMat, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 0.09, 0, g, false);
        p.rotation.z = ang;
      }
    }

    // ---------- cobertura ----------
    const OV = 0.45, OVZ = 0.35;
    const extend = (from: [number, number], toward: [number, number]): [number, number] => {
      const len = Math.hypot(toward[0] - from[0], toward[1] - from[1]);
      const ux = (toward[0] - from[0]) / len, uy = (toward[1] - from[1]) / len;
      const s = OV / Math.abs(ux);
      return [from[0] - ux * s, from[1] - uy * s];
    };
    const ext = roofSegs.map((sg) => ({ a: sg.extA ? extend(sg.a, sg.b) : sg.a, b: sg.extB ? extend(sg.b, sg.a) : sg.b }));
    const roofKind: ProfileKind = c.roof === 'termoacustica' ? 'fine' : 'trap';
    const roofPitch = c.roof === 'fibrocimento' ? 0.177 : c.roof === 'termoacustica' ? 0.1 : 0.2;
    const roofDepth = c.roof === 'fibrocimento' ? 0.05 : c.roof === 'termoacustica' ? 0.02 : 0.04;
    for (const sg of ext) {
      const sheet = new THREE.Mesh(corrugatedRoofSheet(sg.a, sg.b, -L / 2 - OVZ, L / 2 + OVZ, roofPitch, roofDepth, roofKind), roofMat);
      sheet.castShadow = true; sheet.receiveShadow = true; add(sheet);
    }
    // cumeeira
    {
      const cap = box(0.5, 0.08, L + 2 * OVZ + 0.04, roofMat, 0, ridgeY + 0.06, 0, g); cap.rotation.z = 0;
      const capL = box(0.34, 0.05, L + 2 * OVZ, roofMat, -0.18, ridgeY + 0.02, 0, g); capL.rotation.z = 0.32;
      const capR = box(0.34, 0.05, L + 2 * OVZ, roofMat, 0.18, ridgeY + 0.02, 0, g); capR.rotation.z = -0.32;
    }
    // beiral: calhas, rufos e platibanda de empena
    for (const sx of [-1, 1]) {
      box(0.14, 0.16, L + 0.4, alumMat, sx * (half + 0.28), E - 0.18, 0, g);
      for (const sz of [-1, 1]) {
        const dp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, E - BASE_Y - 0.15, 12), isBarn ? wallMat : alumMat);
        dp.position.set(sx * (half + 0.12), BASE_Y + (E - BASE_Y) / 2 - 0.05, sz * (L / 2 - 0.4)); dp.castShadow = true; add(dp);
      }
    }
    if (isBarn) {
      for (const sx of [-1, 1]) box(0.14, 0.16, L + 0.4, alumMat, sx * (core + 0.45), Ecl - 0.2, 0, g);
      for (const sg of ext) {
        for (const sz of [-1, 1]) {
          const a = sg.a, b = sg.b;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const f = box(len, 0.3, 0.06, trimMat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.1, sz * (L / 2 + OVZ), g); f.rotation.z = ang;
        }
      }
    }

    // ---------- silo (celeiro) ----------
    if (c.silo) {
      const R = Math.min(2.2, 1.2 + W / 14), H = ridgeY + 2.5;
      const silo = new THREE.Group(); silo.position.set(half + R + 1.2, 0, -L / 2 + R + 1);
      const rings = Math.floor(H / 0.35);
      for (let k = 0; k < rings; k++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + (k % 2 ? 0.02 : 0), R + (k % 2 ? 0.02 : 0), H / rings, 48, 1, true), metal(new THREE.Color('#b9bcbe'), 0.35, 0.85));
        ring.position.y = BASE_Y + (k + 0.5) * (H / rings); ring.castShadow = true; ring.receiveShadow = true; silo.add(ring);
      }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal(new THREE.Color('#a9acae'), 0.35, 0.85));
      dome.position.y = BASE_Y + H; dome.castShadow = true; silo.add(dome);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.15, R + 0.15, 0.25, 48), concreteMat); base.position.y = 0.125; silo.add(base);
      g.add(silo);
    }

    // ---------- fardos de feno (galpão aberto) ----------
    if (open) {
      const rnd = mulberry32(11);
      const cols = Math.min(4, Math.floor((W - 2) / 1.5));
      for (let r = 0; r < 2; r++) for (let k = 0; k < Math.max(0, cols - r); k++) {
        const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 28), strawMat);
        bale.rotation.z = Math.PI / 2; bale.rotation.y = (rnd() - 0.5) * 0.2;
        bale.position.set(-((cols - 1) * 1.5) / 2 + k * 1.5 + r * 0.75, BASE_Y + 0.62 + r * 1.05, -L / 2 + 1.5);
        bale.castShadow = true; bale.receiveShadow = true; add(bale);
      }
    }

    // ---------- árvores ao fundo ----------
    const rnd = mulberry32(3);
    const R0 = Math.max(W, L) * 1.1 + 22;
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, r = R0 + rnd() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < half + 14 && z > 0 && z < L / 2 + 30) continue;
      const s = 0.8 + rnd() * 0.9;
      const tree = new THREE.Group(); tree.position.set(x, 0, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 3 * s, 8), new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 }));
      trunk.position.y = 1.5 * s; trunk.castShadow = true; tree.add(trunk);
      const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.27 + rnd() * 0.05, 0.42, 0.26 + rnd() * 0.08), roughness: 1, flatShading: true });
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry((2.4 - k * 0.5) * s, 1), leaf);
        b.position.set((rnd() - 0.5) * s, (4 + k * 1.6) * s, (rnd() - 0.5) * s); b.castShadow = true; tree.add(b);
      }
      g.add(tree);
    }

    // ---------- luz / câmera ----------
    const span = Math.max(W, L);
    sun.position.set(span * 0.7, span * 0.9 + 12, span * 0.6);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    const ext2 = span * 0.85 + 10;
    sc.left = -ext2; sc.right = ext2; sc.top = ext2; sc.bottom = -ext2; sc.near = 1; sc.far = span * 4 + 60;
    sc.updateProjectionMatrix();
    controls.target.set(0, ridgeY * 0.42, 0);
    controls.minDistance = span * 0.5 + 6; controls.maxDistance = span * 3.2 + 40;
    const sig = `${c.model}|${W}|${L}|${E}`;
    if (sig !== framed) {
      framed = sig;
      const dist = span * 1.25 + ridgeY * 2.6 + 8;
      camera.position.set(dist * 0.7, ridgeY * 0.9 + dist * 0.34, dist * 0.8);
      controls.update();
    }

    scene.remove(group); disposeGroup(group);
    group = g; scene.add(group);
  }

  function resize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 500;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  let raf = 0;
  const tick = () => { if (controls.update() || dirty) { renderer.render(scene, camera); dirty = false; } raf = requestAnimationFrame(tick); };
  tick();

  return {
    update(config: BarnConfig) { build(config); dirty = true; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); disposeGroup(group);
      envRT.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
