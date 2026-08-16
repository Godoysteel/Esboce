// Scene3DRenderer — constrói a geometria 3D (Three.js) a partir do
// Project do Store: paredes, telhados, fundação, varanda, laje etc.
// Migrado de `var Scene3DRenderer = (function(){...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 2307-3809).
//
// NOTA DE ENGENHARIA: essa é a parte mais densa em matemática de
// geometria/Three.js do sistema. A conversão preserva a lógica
// original linha a linha, mas usa tipagem pragmática (`any`) nos
// parâmetros das funções internas de construção de malha — tipar cada
// estrutura de vértice/footprint/material com precisão exigiria
// modelar tipos auxiliares extensos sem ganho de segurança
// proporcional (é matemática vetorial pura, não lógica de domínio).
// As APIs de FRONTEIRA (o que entra: Wall/Roof/Column/Project do
// domínio; o que sai: THREE.Scene populada) são o que importa manter
// tipado — e estão. Refinar tipos internos é um TODO de baixo risco.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Core } from './Core.js';
import { Catalog } from './Catalog.js';
import { computeOpeningAssemblyLayout, wallBandSideParameters, wallTopTriangleVertices } from './Scene3DGeometry.js';
import { computeGlazingLayout, netGlassSizeM, MULLION_VERTICAL_WIDTH_M, MULLION_HORIZONTAL_WIDTH_M, FRAME_WIDTH_M, PROFILE_DEPTH_M, DEFAULT_GLAZING_GLASS_MATERIAL } from './Glazing.js';
import type { Project, Wall, Column, Roof, Varanda, Laje, Opening } from './types.js';
import { floorWallHeight } from './Attic.js';
import { hydraulicFixtureVisualPosition } from './Hydraulics.js';

export interface ViewState {
  drawPreview?: any;
  editingFloorIndex?: number | null;
  editingYOffset?: number;
  highlightedCategory?: string | null;
  resizeWallId?: string | null;
  roomGroupWallIds?: string[] | null;
  selectedColumn?: Column | null;
  selectedOpening?: Opening | null;
  selectedRoof?: Roof | null;
  selectedVaranda?: Varanda | null;
  selectedLaje?: Laje | null;
  selectedWall?: Wall | null;
  // Ferramenta Terreno ativa — só enquanto ativa, o retângulo-guia e as
  // 4 faixas clicáveis de lado são desenhados (ver ADR-008). Muros já
  // confirmados (Terreno.muros) aparecem sempre, independente disso.
  terrenoToolActive?: boolean;
  [key: string]: any;
}

// Modo de depuração visual: cada parede/cômodo ganha uma cor derivada só
// do próprio id, em vez da cor de acabamento real — útil pra visualmente
// distinguir elementos vizinhos ao investigar bugs de geometria. Migrado
// do escopo global do index.html original (ficava fora do IIFE do
// Scene3DRenderer lá, mas só era usado por ele).
export let DEBUG_COLOR_MODE = false;
export function hashColorHex(key: string): number {
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = (hash * 31 + str.charCodeAt(i)) | 0; }
  const hue = Math.abs(hash) % 360;
  const sat = 65 + (Math.abs(hash >> 8) % 25); // 65–90%
  const light = 48 + (Math.abs(hash >> 16) % 18); // 48–66%
  const c = new THREE.Color();
  c.setHSL(hue / 360, sat / 100, light / 100);
  return c.getHex();
}

  var WALL_HEIGHT = 2.7, WALL_THICK = Core.WALL_THICK;
  var LAJE_THICKNESS = 0.15;
  // Acabamento de piso que todo cômodo nasce usando, antes de qualquer
  // escolha manual em Materiais — assim já vem com fuga desenhada em
  // vez de um verde liso sem textura. Escolha manual do usuário
  // (roomFinishId) sempre sobrescreve isso.
  var DEFAULT_FLOOR_FINISH_ID = 'vortice.ceramica.bege-amanhecer';
  var FLOOR_STACK_HEIGHT = WALL_HEIGHT + LAJE_THICKNESS;
  var RADIER_THICKNESS = 0.18, RADIER_MARGIN = 0.15;
  var BALDRAME_WIDTH = 0.25, BALDRAME_THICKNESS = 0.2;
  var BALDRAME_OUTSET = 0.05;
  // O piso acabado ocupa de y=0 ate y=0,03 m. A fundacao termina 5 mm
  // abaixo dele: fica integralmente sob as paredes e as faces nunca sao
  // coplanares, eliminando o z-fighting sem criar um vao visual relevante.
  var FOUNDATION_FLOOR_GAP = 0.005;
  var CALCADA_WIDTH = 0.6, CALCADA_THICKNESS = 0.05;
  var MARQUISE_DEPTH = 0.5, MARQUISE_THICKNESS = 0.06;
  var ROOF_PITCH_DEG = 28, ROOF_OVERHANG = 0.4, RAKE_OVERHANG = 0.2, ROOF_THICKNESS = 0.12;
  var ROOF_COLOR = 0xB5573A, GABLE_COLOR = 0xE7E1D2;
  var HIGHLIGHT_ACCENT = 0xE8963C, HIGHLIGHT_MIX = 0.55;
  var SELECTED_ACCENT = 0xE8963C;
  var WALL_TOP_COLOR = GABLE_COLOR;
  var WALL_EDGE_COLOR = 0x6F879C;
  // Camada "Paredes transparentes" (ProjectLayers.paredesTransparentes)
  // — opacidade baixa o bastante pra enxergar a Planta Baixa importada
  // (DEC-82) por baixo, mas alta o bastante pra ainda reconhecer onde
  // cada parede está sem precisar desligar a camada inteira.
  var WALL_TRANSPARENT_OPACITY = 0.28;
  var OPENING_FRAME_COLOR = 0xF4F1E8;
  var WALL_PLASTER_TILE_METERS = 1.25;
  var soleiraMarbleMaps: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture } | null = null;
  // Cache da textura da planta baixa importada — recarregar do zero a
  // cada rebuild() (que roda a cada mudança no modelo, dezenas de
  // vezes por sessão) seria pesado à toa pra uma imagem que só muda
  // quando o Product Owner importa uma nova. Só recria se o dataURL
  // mudou (nova imagem importada).
  var planUnderlayTextureCache: { key: string; texture: THREE.Texture } | null = null;

  // Mármore da soleira externa — textura PBR fornecida pelo usuário
  // (Marble016), reduzida de 1K/16-bit pra 512x512/8-bit em JPG antes de
  // entrar no projeto (os arquivos originais passavam de 3MB cada, o que
  // pesaria bastante pro navegador baixar; a peça é pequena na cena, não
  // precisa de resolução alta). Só usa o NormalGL (não o NormalDX — o
  // Three.js espera a convenção OpenGL) e ignora o Displacement (não há
  // deslocamento de vértice nesse renderer, só normal map de superfície).
  function getSoleiraMarbleMaps() {
    if (soleiraMarbleMaps) return soleiraMarbleMaps;
    var loader = new THREE.TextureLoader();
    function load(path: string, isColor: boolean) {
      var texture = loader.load(path);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }
    var base = import.meta.env.BASE_URL;
    soleiraMarbleMaps = {
      map: load(base + 'textures/soleira-marmore/albedo.jpg', true),
      normalMap: load(base + 'textures/soleira-marmore/normal.jpg', false),
      roughnessMap: load(base + 'textures/soleira-marmore/roughness.jpg', false)
    };
    return soleiraMarbleMaps;
  }

  interface Registry {
    wallMeshes: THREE.Object3D[];
    roomMeshes: THREE.Object3D[];
    structureMeshes: THREE.Object3D[];
    previewMeshes: THREE.Object3D[];
    handleMeshes: THREE.Object3D[];
    furnitureMeshes: THREE.Object3D[];
    openingModelMeshes: THREE.Object3D[];
    [key: string]: THREE.Object3D[];
  }
  var registry: Registry = { wallMeshes: [], roomMeshes: [], structureMeshes: [], previewMeshes: [], handleMeshes: [], furnitureMeshes: [], openingModelMeshes: [] };

  // --- Móveis (glTF) ---------------------------------------------------
  // Cada .glb é carregado uma única vez e cacheado; peças repetidas na
  // cena (ex.: duas camas) reaproveitam o mesmo THREE.Group via clone(),
  // que é barato (não recarrega a malha, só duplica os nós da cena).
  // Carregamento é assíncrono — enquanto não chega, a peça simplesmente
  // não aparece nesse rebuild(); quando o loader termina, chama de volta
  // onFurnitureAssetLoaded (registrado pelo ViewportController) pra
  // disparar um novo render e a peça aparecer sem precisar de ação do
  // usuário.
  var gltfLoader = new GLTFLoader();
  interface FurnitureModelEntry { group: THREE.Group; footprintW: number; footprintD: number; heightM: number; }
  var furnitureModelCache: { [url: string]: FurnitureModelEntry | 'loading' } = {};
  var onFurnitureAssetLoaded: (() => void) | null = null;
  export function setOnFurnitureAssetLoaded(cb: () => void) { onFurnitureAssetLoaded = cb; }

  // Todos os grupos de móvel atualmente na cena — usado pelo
  // ViewportController pra um raycast recursivo à parte (o raycast
  // genérico só testa Mesh direto em scene.children; móvel é um Group
  // com filhos aninhados, ver pickMesh).
  export function getFurnitureMeshes(): THREE.Object3D[] { return registry.furnitureMeshes; }

  // Mesma ideia, pra portas/janelas com modelo glTF (Opening.productId,
  // ver buildOpeningModelPiece) — também um Group com filhos aninhados,
  // também precisa do raycast recursivo à parte em pickMesh.
  export function getOpeningModelMeshes(): THREE.Object3D[] { return registry.openingModelMeshes; }

  // Tamanho real (em metros, no plano do chão) do footprint de um
  // móvel já carregado — null se ainda não carregou. Usado pra travar
  // o arrasto livre contra parede (ViewportController.
  // resolveFurniturePosition); sem isso não dá pra saber quanto espaço
  // a peça realmente ocupa.
  export function getFurnitureFootprint(modelUrl: string): { w: number; d: number } | null {
    var resolvedUrl = (import.meta as any).env.BASE_URL + modelUrl;
    var cached = furnitureModelCache[resolvedUrl];
    if (!cached || cached === 'loading') return null;
    return { w: cached.footprintW, d: cached.footprintD };
  }

  function getFurnitureModel(url: string): FurnitureModelEntry | null {
    var cached = furnitureModelCache[url];
    if (cached && cached !== 'loading') return cached;
    if (cached === 'loading') return null;
    furnitureModelCache[url] = 'loading';
    gltfLoader.load(url, function (gltf) {
      gltf.scene.traverse(function (child: any) {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      var box = new THREE.Box3().setFromObject(gltf.scene);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());
      gltf.scene.position.set(-center.x, -box.min.y, -center.z);
      var anchored = new THREE.Group();
      anchored.add(gltf.scene);
      furnitureModelCache[url] = { group: anchored, footprintW: size.x, footprintD: size.z, heightM: size.y };
      if (onFurnitureAssetLoaded) onFurnitureAssetLoaded();
    }, undefined, function (err) {
      console.error('Falha ao carregar móvel ' + url, err);
      delete furnitureModelCache[url];
    });
    return null;
  }

  function disposeObject3DTree(obj: any) {
    obj.traverse(function (child: any) {
      if (!child.isMesh) return;
      if (child.geometry) child.geometry.dispose();
      var mats = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
      mats.forEach(function (mat: any) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    });
  }

  // x,y do Furniture já estão no espaço de MODELO (mesma unidade das
  // paredes) — convertidos pro mundo com o mesmo scale/offset de tudo
  // mais. rotationDeg gira em torno do eixo Y (vertical).
  function buildFurniturePiece(item: any, scale: any, offsetX: any, offsetY: any, floorTopY: any): THREE.Object3D | null {
    var product = Catalog.getProduct(item.productId);
    var modelUrl = product && product.assets && product.assets.modelUrl;
    if (!modelUrl) return null;
    var resolvedUrl = (import.meta as any).env.BASE_URL + modelUrl;
    var template = getFurnitureModel(resolvedUrl);
    if (!template) return null;
    var instance = template.group.clone(true);
    var worldX = (item.x - offsetX) * scale;
    var worldZ = (item.y - offsetY) * scale;
    instance.position.set(worldX, floorTopY + (item.elevationM || 0), worldZ);
    instance.rotation.y = -(item.rotationDeg || 0) * Math.PI / 180;
    instance.userData.furnitureId = item.id;
    return instance;
  }

  function pickColor(baseHex: any, category: any, viewState: any) {
    if (!viewState || viewState.highlightedCategory !== category) return baseHex;
    return new THREE.Color(baseHex).lerp(new THREE.Color(HIGHLIGHT_ACCENT), HIGHLIGHT_MIX).getHex();
  }

  function tagCategory(mesh: any, category: any) {
    mesh.userData.category = category;
    return mesh;
  }

  function roofWorldFootprint(roof: any, scale: number, offsetX: number, offsetY: number) {
    var ridgeAlongX = roof.ridgeAxis === 'x';
    var marginX = roof.type === 'quatroAguas' ? ROOF_OVERHANG : (ridgeAlongX ? RAKE_OVERHANG : ROOF_OVERHANG);
    var marginZ = roof.type === 'quatroAguas' ? ROOF_OVERHANG : (ridgeAlongX ? ROOF_OVERHANG : RAKE_OVERHANG);
    return {
      minX: (Math.min(roof.x1, roof.x2) - offsetX) * scale - marginX,
      maxX: (Math.max(roof.x1, roof.x2) - offsetX) * scale + marginX,
      minZ: (Math.min(roof.y1, roof.y2) - offsetY) * scale - marginZ,
      maxZ: (Math.max(roof.y1, roof.y2) - offsetY) * scale + marginZ
    };
  }

  function rectsOverlapArea(a: any, b: any) {
    return Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) *
      Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  }

  function roofCutRegions(roof: any, scale: number, offsetX: number, offsetY: number, topY: number) {
    var fp = roofWorldFootprint(roof, scale, offsetX, offsetY);
    if (roof.type !== 'duasAguas') return [fp];
    var slope = Math.tan((roof.pitchDeg || ROOF_PITCH_DEG) * Math.PI / 180);
    if (roof.ridgeAxis === 'x') {
      var ridgeZ = (fp.minZ + fp.maxZ) / 2;
      return [
        { minX: fp.minX, maxX: fp.maxX, minZ: fp.minZ, maxZ: ridgeZ, plane: { ax: 0, az: slope, c: topY - slope * fp.minZ } },
        { minX: fp.minX, maxX: fp.maxX, minZ: ridgeZ, maxZ: fp.maxZ, plane: { ax: 0, az: -slope, c: topY + slope * fp.maxZ } }
      ];
    }
    var ridgeX = (fp.minX + fp.maxX) / 2;
    return [
      { minX: fp.minX, maxX: ridgeX, minZ: fp.minZ, maxZ: fp.maxZ, plane: { ax: slope, az: 0, c: topY - slope * fp.minX } },
      { minX: ridgeX, maxX: fp.maxX, minZ: fp.minZ, maxZ: fp.maxZ, plane: { ax: -slope, az: 0, c: topY + slope * fp.maxX } }
    ];
  }

  // Recorta cada triângulo contra um retângulo em planta e conserva só a
  // parte externa. A interpolação mantém altura e UV, portanto funciona
  // tanto nas águas inclinadas quanto nas tabeiras/cumeeiras.
  function clipMeshOutsideRects(mesh: any, rects: any[]) {
    if (!mesh || !mesh.isMesh || !mesh.geometry || !rects.length) return mesh;
    var source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    var pos = source.getAttribute('position');
    var uvAttr = source.getAttribute('uv');
    type CV = { x: number; y: number; z: number; u: number; v: number };
    var triangles: CV[][] = [];
    for (var i = 0; i < pos.count; i += 3) {
      var tri: CV[] = [];
      for (var j = 0; j < 3; j++) tri.push({
        x: pos.getX(i + j), y: pos.getY(i + j), z: pos.getZ(i + j),
        u: uvAttr ? uvAttr.getX(i + j) : 0, v: uvAttr ? uvAttr.getY(i + j) : 0
      });
      triangles.push(tri);
    }
    function split(poly: CV[], axis: 'x' | 'z', value: number, keepGreater: boolean) {
      var inside: CV[] = [], outside: CV[] = [];
      function isInside(p: CV) { return keepGreater ? p[axis] >= value : p[axis] <= value; }
      function add(list: CV[], p: CV) { list.push({ ...p }); }
      for (var k = 0; k < poly.length; k++) {
        var a = poly[k]!, b = poly[(k + 1) % poly.length]!;
        var ai = isInside(a), bi = isInside(b);
        if (ai) add(inside, a); else add(outside, a);
        if (ai !== bi) {
          var denom = b[axis] - a[axis];
          var t = Math.abs(denom) < 1e-9 ? 0 : (value - a[axis]) / denom;
          var p: CV = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t };
          add(inside, p); add(outside, p);
        }
      }
      return { inside, outside };
    }
    function splitBelowPlane(poly: CV[], plane: any) {
      var inside: CV[] = [], outside: CV[] = [];
      function signed(p: CV) { return p.y - (plane.ax * p.x + plane.az * p.z + plane.c); }
      function add(list: CV[], p: CV) { list.push({ ...p }); }
      for (var k = 0; k < poly.length; k++) {
        var a = poly[k]!, b = poly[(k + 1) % poly.length]!;
        var fa = signed(a), fb = signed(b), ai = fa <= 1e-5, bi = fb <= 1e-5;
        if (ai) add(inside, a); else add(outside, a);
        if (ai !== bi) {
          var denom = fa - fb;
          var t = Math.abs(denom) < 1e-9 ? 0 : fa / denom;
          var p: CV = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t };
          add(inside, p); add(outside, p);
        }
      }
      return { inside, outside };
    }
    rects.forEach(function (rect) {
      var nextTriangles: CV[][] = [];
      triangles.forEach(function (triangle) {
        var remaining: CV[][] = [triangle], kept: CV[][] = [];
        ([['x', rect.minX, true], ['x', rect.maxX, false], ['z', rect.minZ, true], ['z', rect.maxZ, false]] as any[]).forEach(function (edge) {
          var nextRemaining: CV[][] = [];
          remaining.forEach(function (poly) {
            var parts = split(poly, edge[0], edge[1], edge[2]);
            if (parts.outside.length >= 3) kept.push(parts.outside);
            if (parts.inside.length >= 3) nextRemaining.push(parts.inside);
          });
          remaining = nextRemaining;
        });
        if (rect.plane) {
          var aboveRoof: CV[][] = [];
          remaining.forEach(function (poly) {
            var planeParts = splitBelowPlane(poly, rect.plane);
            if (planeParts.outside.length >= 3) kept.push(planeParts.outside);
            if (planeParts.inside.length >= 3) aboveRoof.push(planeParts.inside);
          });
          // `aboveRoof` representa a parcela coberta pela água principal
          // e é descartada. O limite fa=0 forma a linha da água-furtada.
          remaining = aboveRoof;
        }
        nextTriangles.push.apply(nextTriangles, kept);
      });
      triangles = nextTriangles;
    });
    var verts: number[] = [], uvs: number[] = [];
    triangles.forEach(function (poly) {
      for (var k = 1; k < poly.length - 1; k++) [poly[0], poly[k], poly[k + 1]].forEach(function (p) {
        verts.push(p!.x, p!.y, p!.z); uvs.push(p!.u, p!.v);
      });
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    mesh.geometry.dispose(); mesh.geometry = geo;
    return mesh;
  }

  // colorOrMat aceita OU cor OU um THREE.Material pronto (ver
  // extrudeSlopeDown pra explicação completa da UV em metros reais).
  function facePlaneUV(points: any) {
    var n = points.length;
    var origin = points[0];
    var uAxis = points[1].clone().sub(origin).normalize();
    var normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[n - 1].clone().sub(points[0])).normalize();
    var vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
    return function (p: any, tileMeters: any) {
      var rel = p.clone().sub(origin);
      return [rel.dot(uAxis) / tileMeters, rel.dot(vAxis) / tileMeters];
    };
  }

  function resolveFaceMaterial(colorOrMat: any) {
    var isTextured = colorOrMat && colorOrMat.isMaterial;
    var tileMeters = (isTextured && colorOrMat.userData && colorOrMat.userData.tileMeters) || 1;
    var mat = isTextured ? colorOrMat : new THREE.MeshStandardMaterial({ color: colorOrMat, side: THREE.DoubleSide, flatShading: true });
    return { mat: mat, tileMeters: tileMeters };
  }

  function buildQuadMesh(p1: any, p2: any, p3: any, p4: any, colorOrMat: any) {
    var pts = [p1, p2, p3, p4].map(function (p) { return new THREE.Vector3(p.x, p.y, p.z); });
    var r = resolveFaceMaterial(colorOrMat);
    var uvOf = facePlaneUV(pts);
    var v = new Float32Array([
      p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
      p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z
    ]);
    var uvIdx = [0, 1, 2, 0, 2, 3];
    var uvs = new Float32Array(uvIdx.length * 2);
    uvIdx.forEach(function (idx, i) { var uv = uvOf(pts[idx], r.tileMeters); uvs[i * 2] = uv[0]!; uvs[i * 2 + 1] = uv[1]!; });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, r.mat);
  }

  function buildTriMesh(p1: any, p2: any, p3: any, colorOrMat: any) {
    var pts = [p1, p2, p3].map(function (p) { return new THREE.Vector3(p.x, p.y, p.z); });
    var r = resolveFaceMaterial(colorOrMat);
    var uvOf = facePlaneUV(pts);
    var v = new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z]);
    var uvs = new Float32Array(6);
    pts.forEach(function (p, i) { var uv = uvOf(p, r.tileMeters); uvs[i * 2] = uv[0]!; uvs[i * 2 + 1] = uv[1]!; });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, r.mat);
  }

  // Face pentagonal contínua do oitão (faixa baixa + triângulo). Manter
  // tudo na mesma geometria evita a costura horizontal entre duas malhas
  // coplanares que antes aparecia como um risco fino.
  function buildGableMesh(points: any[], colorOrMat: any) {
    var pts = points.map(function (p) { return new THREE.Vector3(p.x, p.y, p.z); });
    var r = resolveFaceMaterial(colorOrMat);
    var uvOf = facePlaneUV(pts);
    var verts: number[] = [], uvs: number[] = [];
    for (var i = 1; i < pts.length - 1; i++) {
      [pts[0], pts[i], pts[i + 1]].forEach(function (p) {
        verts.push(p!.x, p!.y, p!.z);
        var uv = uvOf(p!, r.tileMeters); uvs.push(uv[0]!, uv[1]!);
      });
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, r.mat);
  }

  // Espessura das águas do telhado, descendo reto em Y (não na direção da
  // normal do plano). Isso é o que garante duas coisas de uma vez: a
  // "descida" nunca fica invertida (a normal calculada por produto
  // vetorial pode apontar pra qualquer lado dependendo da ordem dos
  // pontos — descer reto em Y elimina essa ambiguidade), e como as duas
  // águas usam o MESMO caimento, a cumeeira fecha sozinha — as duas
  // bordas inferiores caem exatamente no mesmo ponto, sem vão.
  //
  // colorOrMat aceita OU uma cor (comportamento de sempre) OU um
  // THREE.Material já pronto (pra textura de telha) — nesse segundo
  // caso, a UV é calculada em METROS DE VERDADE (a cena já usa 1
  // unidade = 1 metro — ver scale = 1/Core.GRID), dividida pelo
  // material.userData.tileMeters (o tamanho físico que a textura
  // representa) — assim a textura nunca estica nem encolhe, seja qual
  // for o tamanho real do telhado.
  function extrudeSlopeDown(points: any, verticalDrop: any, colorOrMat: any, edgeColorOrMat: any) {
    var n = points.length;
    var vs = points.map(function (p: any) { return new THREE.Vector3(p.x, p.y, p.z); });
    var bs = vs.map(function (v: any) { return new THREE.Vector3(v.x, v.y - verticalDrop, v.z); });

    // Topo + base (a água em si — telha): UV no plano de cima, em
    // metros reais / tileMeters do produto (ver Catálogo).
    var topRes = resolveFaceMaterial(colorOrMat);
    var uvOfTop = facePlaneUV(vs);
    var verts: any[] = [], uvs: any[] = [];
    function pushTri(a: any, b: any, c: any) {
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      [a, b, c].forEach(function (p) { var uv = uvOfTop(p, topRes.tileMeters); uvs.push(uv[0], uv[1]); });
    }
    for (var i = 1; i < n - 1; i++) pushTri(vs[0], vs[i], vs[i + 1]); // topo
    for (var j = 1; j < n - 1; j++) pushTri(bs[0], bs[j + 1], bs[j]); // base (invertida)
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    var topMesh = new THREE.Mesh(geo, topRes.mat);

    // Laterais (a espessura exposta no perímetro — a TESTEIRA/TABEIRA de
    // verdade, não o oitão). UV própria: U corre ao longo da borda (em
    // metros), V é a espessura — o grão da madeira segue a borda, não
    // fica espichado reaproveitando a UV do plano de cima.
    var edgeRes = resolveFaceMaterial(edgeColorOrMat || colorOrMat);
    var edgeVerts: any[] = [], edgeUvs: any[] = [];
    function pushEdgeTri(p1: any, p2: any, p3: any, uv1: any, uv2: any, uv3: any) {
      edgeVerts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      edgeUvs.push(uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1]);
    }
    for (var k = 0; k < n; k++) {
      var a = vs[k], b = vs[(k + 1) % n], ba = bs[k], bb = bs[(k + 1) % n];
      var segLen = a.distanceTo(b) / edgeRes.tileMeters;
      var vBot = verticalDrop / edgeRes.tileMeters;
      pushEdgeTri(a, b, bb, [0, 0], [segLen, 0], [segLen, vBot]);
      pushEdgeTri(a, bb, ba, [0, 0], [segLen, vBot], [0, vBot]);
    }
    var edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    edgeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(edgeUvs, 2));
    edgeGeo.setAttribute('uv2', new THREE.Float32BufferAttribute(edgeUvs, 2));
    edgeGeo.computeVertexNormals();
    var edgeMesh = new THREE.Mesh(edgeGeo, edgeRes.mat);

    return [topMesh, edgeMesh];
  }

  function ridgeLineMesh(a: any, b: any) {
    var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
  }

  // Telha de cumeeira/espigão — a peça arredondada que fecha o
  // encontro de duas águas por cima (cumeeira: encontro reto; espigão:
  // encontro na diagonal do quatro-águas). Um "capinha" varrida ao
  // longo da linha reta entre dois pontos.
  //
  // O perfil transversal NÃO é mais um semicírculo simples centrado na
  // altura da linha — isso deixava a peça flutuando (as pontas do arco
  // ficavam niveladas, mas a água desce, então sobrava um vão visível
  // até a telha de verdade). Agora as duas "pernas" saem da linha e
  // descem acompanhando o caimento de verdade (pitchRad) por WING
  // metros — aí sim encostam exatas na água, sem vão — e só depois o
  // arco fecha por cima, usando essas duas pontas (já sobre a água)
  // como diâmetro. Fecha também as duas pontas do tubo (antes ficavam
  // abertas, aparecendo como um buraco de perto).
  // Estica uma ponta de segmento "dist" metros PRA ALÉM do ponto de
  // referência (não pra dentro) — usado na ponta do ESPIGÃO que
  // encosta no canto do beiral (onde a tabeira também está). Tentar
  // recuar pra evitar encostar na tabeira não bastou (ainda dava
  // z-fight); passar um pouco por cima dela é mais simples e resolve —
  // igual telha de cumeeira de verdade, que sempre avança um pouco além
  // da última peça.
  var HIP_CORNER_OVERSHOOT = 0.03; // 30mm
  function extendBeyond(corner: any, ridgePoint: any, dist: any) {
    var dx = corner.x - ridgePoint.x, dy = corner.y - ridgePoint.y, dz = corner.z - ridgePoint.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) return corner;
    var t = dist / len;
    return { x: corner.x + dx * t, y: corner.y + dy * t, z: corner.z + dz * t };
  }

  function buildRidgeCapMesh(a: any, b: any, colorOrMat: any, pitchRad: any) {
    var start = new THREE.Vector3(a.x, a.y, a.z);
    var end = new THREE.Vector3(b.x, b.y, b.z);
    var lineLen = start.distanceTo(end);
    if (lineLen < 1e-3) return null;
    var dir = end.clone().sub(start).normalize();
    var right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    var up = new THREE.Vector3().crossVectors(right, dir).normalize();

    var r = resolveFaceMaterial(colorOrMat);
    var WING = 0.12, SEGS = 8; // WING = quanto a perna desce sobre a água, em metros reais
    var pr = isFinite(pitchRad) ? pitchRad : (28 * Math.PI / 180);
    var cosP = Math.cos(pr), sinP = Math.sin(pr);
    var archRadius = WING * cosP;      // as duas pernas (já sobre a água) viram o diâmetro do arco
    var archUpOffset = -WING * sinP;   // o arco fica centrado na altura onde as pernas terminam, não na linha
    var archLen = archRadius * Math.PI; // comprimento real do arco (metros) — pra UV proporcional, não esticado

    function ringPoint(center: any, t: any) {
      var ang = Math.PI * t; // 0 (perna direita, já sobre a água) a PI (perna esquerda)
      return center.clone()
        .add(right.clone().multiplyScalar(Math.cos(ang) * archRadius))
        .add(up.clone().multiplyScalar(archUpOffset + Math.sin(ang) * archRadius));
    }
    var verts: any[] = [], uvs: any[] = [];
    var vLen = lineLen / r.tileMeters;
    var uWidth = archLen / r.tileMeters; // só uma fatia proporcional da textura, não o grão inteiro espremido
    for (var i = 0; i < SEGS; i++) {
      var t0 = i / SEGS, t1 = (i + 1) / SEGS;
      var u0 = t0 * uWidth, u1 = t1 * uWidth;
      var s0 = ringPoint(start, t0), s1 = ringPoint(start, t1);
      var e0 = ringPoint(end, t0), e1 = ringPoint(end, t1);
      [s0, s1, e1, s0, e1, e0].forEach(function (p) { verts.push(p.x, p.y, p.z); });
      [[u0, 0], [u1, 0], [u1, vLen], [u0, 0], [u1, vLen], [u0, vLen]].forEach(function (uv) { uvs.push(uv[0], uv[1]); });
    }
    // Tampa das duas pontas do tubo (leque triangulado a partir do
    // primeiro ponto do próprio arco) — sem isso, de perto dá pra ver
    // através da peça, um buraco.
    function pushCap(center: any, reverse: any) {
      var ring: any[] = [];
      for (var i = 0; i <= SEGS; i++) ring.push(ringPoint(center, i / SEGS));
      for (var i = 1; i < SEGS; i++) {
        var tri = reverse ? [ring[0], ring[i + 1], ring[i]] : [ring[0], ring[i], ring[i + 1]];
        tri.forEach(function (p) { verts.push(p.x, p.y, p.z); uvs.push(0, 0); });
      }
    }
    pushCap(start, true);
    pushCap(end, false);

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, r.mat);
  }

  // Constrói o volume da parede a partir do contorno já calculado (4
  // pontos no plano do chão — ver Core.computeWallFootprints), extrudado
  // até a altura da parede. Os vértices já vêm em coordenadas de cena
  // finais, então não precisa de position/rotation depois — substitui a
  // caixa simples de antes, que não representava um corte em ângulo.
  function buildWallMeshFromFootprint(fp: any, height: any, yOffset: any, mat: any) {
    var y0 = yOffset, y1 = yOffset + height;
    var pts2d = [fp.p1a, fp.p2a, fp.p2b, fp.p1b];
    var base: any[] = [], top: any[] = [];
    pts2d.forEach(function (p) { base.push([p.x, y0, p.z]); top.push([p.x, y1, p.z]); });
    var verts: any[] = [];
    function quad(a: any, b: any, c: any, d: any) {
      [a, b, c, a, c, d].forEach(function (v) { verts.push(v[0], v[1], v[2]); });
    }
    quad(base[3], base[2], base[1], base[0]); // base
    quad(top[0], top[1], top[2], top[3]);     // topo
    quad(base[0], base[1], top[1], top[0]);   // lado p1a-p2a
    // Tampa de cada ponta: só existe se a ponta é livre (fecha um fim de
    // parede solto de verdade) ou se essa parede foi a que esticou pra
    // preencher o canto ali (ver Core.computeWallFootprints). Numa ponta
    // que NEM é livre NEM esticou (perdeu a disputa do canto pra outra
    // parede), a tampa ficaria redundante bem dentro do volume da
    // vizinha — competindo com a face dela pelo mesmo espaço, o que
    // aparecia como uma linha fina clara na costura.
    if (fp.p2Free !== false || fp.p2Extended) quad(base[1], base[2], top[2], top[1]); // tampa da ponta 2
    quad(base[2], base[3], top[3], top[2]);   // lado p2b-p1b
    if (fp.p1Free !== false || fp.p1Extended) quad(base[3], base[0], top[0], top[3]); // tampa da ponta 1
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // Complemento superior de uma parede de ático. Em vez de baixar toda
  // parede até o beiral, cria somente a porção entre o beiral e as águas.
  // O perfil é dividido na cumeeira quando a parede a atravessa, produzindo
  // o recorte triangular/trapezoidal equivalente a uma booleana.
  function atticWallExtensionSlices(wall: any, roof: any, openings: any[]) {
    var base = roof.baseHeightM || 1.2;
    var centerCoord = roof.ridgeAxis === 'x' ? (roof.y1 + roof.y2) / 2 : (roof.x1 + roof.x2) / 2;
    var c1 = roof.ridgeAxis === 'x' ? wall.y1 : wall.x1;
    var c2 = roof.ridgeAxis === 'x' ? wall.y2 : wall.x2;
    var ts = [0, 1];
    if (Math.abs(c2 - c1) > 1e-6) {
      var ridgeT = (centerCoord - c1) / (c2 - c1);
      if (ridgeT > 1e-5 && ridgeT < 1 - 1e-5) ts.push(ridgeT);
    }
    var wallLenM = Core.wallLengthMeters(wall);
    (openings || []).forEach(function (opening) {
      var startT = (opening.offset - opening.width / 2) / wallLenM;
      var endT = (opening.offset + opening.width / 2) / wallLenM;
      if (startT > 1e-5 && startT < 1 - 1e-5) ts.push(startT);
      if (endT > 1e-5 && endT < 1 - 1e-5) ts.push(endT);
    });
    ts.sort(function (a, b) { return a - b; });
    ts = ts.filter(function (t, index) { return index === 0 || Math.abs(t - ts[index - 1]!) > 1e-6; });
    function pointAt(t: number) { return { x: wall.x1 + (wall.x2 - wall.x1) * t, y: wall.y1 + (wall.y2 - wall.y1) * t }; }
    function heightAt(p: any) { return Core.roofHeightAtModelPoint(roof, p.x, p.y); }
    var slices: any[] = [];
    ts.slice(0, -1).forEach(function (t0, index) {
      var t1 = ts[index + 1]!;
      var a = pointAt(t0), b = pointAt(t1);
      var ah = heightAt(a), bh = heightAt(b);
      var midpointM = ((t0 + t1) / 2) * wallLenM;
      var opening = (openings || []).find(function (candidate) {
        return midpointM > candidate.offset - candidate.width / 2 - 1e-5 && midpointM < candidate.offset + candidate.width / 2 + 1e-5;
      });
      if (!opening) {
        slices.push({ t0: t0, t1: t1, lowA: base, lowB: base, highA: ah, highB: bh });
        return;
      }
      if (opening.sillHeight > base + 1e-4) {
        slices.push({ t0: t0, t1: t1, lowA: base, lowB: base, highA: Math.min(opening.sillHeight, ah), highB: Math.min(opening.sillHeight, bh) });
      }
      var openingTop = opening.sillHeight + opening.height;
      if (ah > openingTop + 1e-4 || bh > openingTop + 1e-4) {
        slices.push({ t0: t0, t1: t1, lowA: Math.min(openingTop, ah), lowB: Math.min(openingTop, bh), highA: ah, highB: bh });
      }
    });
    return slices.filter(function (slice) { return slice.highA - slice.lowA > 1e-4 || slice.highB - slice.lowB > 1e-4; });
  }

  function buildAtticWallExtensions(wall: any, roof: any, openings: any[], scale: number, offsetX: number, offsetY: number, yOffset: number, mat: any) {
    var dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy);
    if (len < 1e-6) return [];
    var nx = -dy / len * Core.WALL_THICK / 2 * scale, nz = dx / len * Core.WALL_THICK / 2 * scale;
    return atticWallExtensionSlices(wall, roof, openings).map(function (slice) {
      var t0 = slice.t0, t1 = slice.t1;
      var a = { x: wall.x1 + (wall.x2 - wall.x1) * t0, y: wall.y1 + (wall.y2 - wall.y1) * t0 };
      var b = { x: wall.x1 + (wall.x2 - wall.x1) * t1, y: wall.y1 + (wall.y2 - wall.y1) * t1 };
      var ax = (a.x - offsetX) * scale, az = (a.y - offsetY) * scale;
      var bx = (b.x - offsetX) * scale, bz = (b.y - offsetY) * scale;
      var lowA = yOffset + slice.lowA, lowB = yOffset + slice.lowB;
      var ah = yOffset + slice.highA, bh = yOffset + slice.highB;
      var vertices = new Float32Array([
        ax+nx,lowA,az+nz, ax-nx,lowA,az-nz, bx+nx,lowB,bz+nz, bx-nx,lowB,bz-nz,
        ax+nx,ah,az+nz,  ax-nx,ah,az-nz,  bx+nx,bh,bz+nz, bx-nx,bh,bz-nz
      ]);
      var indices = [0,2,6,0,6,4, 1,5,7,1,7,3, 0,4,5,0,5,1, 2,3,7,2,7,6, 4,6,7,4,7,5, 0,1,3,0,3,2];
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setIndex(indices); geo.computeVertexNormals();
      return new THREE.Mesh(geo, mat);
    });
  }

  function buildAtticWallFaceExtensions(wall: any, roof: any, openings: any[], fp: any, yOffset: number, mat: any, side: 'a' | 'b') {
    var start = side === 'a' ? fp.p1a : fp.p1b;
    var end = side === 'a' ? fp.p2a : fp.p2b;
    function scenePoint(t: number) { return { x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t }; }
    return atticWallExtensionSlices(wall, roof, openings).map(function (slice) {
      var a = scenePoint(slice.t0), b = scenePoint(slice.t1);
      var lowA = yOffset + slice.lowA, lowB = yOffset + slice.lowB;
      var ah = yOffset + slice.highA, bh = yOffset + slice.highB;
      var verts = side === 'a'
        ? [a.x,lowA,a.z, b.x,lowB,b.z, b.x,bh,b.z, a.x,lowA,a.z, b.x,bh,b.z, a.x,ah,a.z]
        : [b.x,lowB,b.z, a.x,lowA,a.z, a.x,ah,a.z, b.x,lowB,b.z, a.x,ah,a.z, b.x,bh,b.z];
      var segmentM = Math.hypot(b.x - a.x, b.z - a.z);
      var maxRise = Math.max(ah - lowA, bh - lowB);
      var u = segmentM / WALL_PLASTER_TILE_METERS, v = maxRise / WALL_PLASTER_TILE_METERS;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,u,0,u,v, 0,0,u,v,0,v], 2));
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, mat);
    });
  }

  // Face superior visível da parede. Ela reutiliza o footprint resolvido
  // pelo Core sem aumentar comprimento, largura ou altura; assim a cinta
  // acompanha quinas, fusões e junções da v14 sem criar outro volume.
  function buildWallTopCapMesh(fp: any, y: any, mat: any) {
    var vertices = wallTopTriangleVertices(fp, y);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // Uma FACE só da parede (lado A = p1a-p2a, lado B = p2b-p1b) — cada
  // lado agora é um objeto pintável independente (acabamento por face,
  // ver Store.commands.setWallFinishFace). Reaproveita o MESMO contorno
  // (fp) que já resolve o canto sem invasão (só uma parede por canto
  // estica — Core.computeWallFootprints), então as duas faces de duas
  // paredes vizinhas se encontram exatas, sem sobrepor.
  function buildFaceStripMesh(fp: any, height: any, yOffset: any, mat: any, side: any) {
    var y0 = yOffset, y1 = yOffset + height;
    var pts2d = [fp.p1a, fp.p2a, fp.p2b, fp.p1b];
    var base: any[] = [], top: any[] = [];
    pts2d.forEach(function (p) { base.push([p.x, y0, p.z]); top.push([p.x, y1, p.z]); });
    var verts: any[] = [];
    function quad(a: any, b: any, c: any, d: any) { [a, b, c, a, c, d].forEach(function (v) { verts.push(v[0], v[1], v[2]); }); }
    if (side === 'a') quad(base[0], base[1], top[1], top[0]);
    else quad(base[2], base[3], top[3], top[2]);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    var sideStart = side === 'a' ? fp.p1a : fp.p2b;
    var sideEnd = side === 'a' ? fp.p2a : fp.p1b;
    var u = Math.hypot(sideEnd.x - sideStart.x, sideEnd.z - sideStart.z) / WALL_PLASTER_TILE_METERS;
    var v = height / WALL_PLASTER_TILE_METERS;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // Tampa VISÍVEL de ponta livre — mesma geometria (quad reto fechando
  // o volume no fim da parede) que a caixa de REFERÊNCIA já calculava
  // (ver buildWallMeshFromFootprint, comentário "Tampa de cada ponta"),
  // só que numa malha própria com material de verdade. A caixa de
  // referência é sempre opacity 0 fora de seleção — então a tampa dela
  // nunca aparecia pra ninguém; era só matemática de clique. Sem essa
  // função, uma ponta livre de verdade (extremidade solta desde sempre,
  // OU nova depois de Quebrar Parede — ver DEC-83) tinha o CANTO certo
  // (sem entalhe, depois da correção anterior) mas nenhuma superfície
  // fechando o buraco: dava pra ver através da parede por ali.
  function buildWallEndCapMesh(fp: any, height: any, yOffset: any, mat: any, end: 1 | 2) {
    var y0 = yOffset, y1 = yOffset + height;
    function pt(p: any, y: any) { return [p.x, y, p.z]; }
    var verts: any[] = [];
    function quad(a: any, b: any, c: any, d: any) { [a, b, c, a, c, d].forEach(function (v) { verts.push(v[0], v[1], v[2]); }); }
    // MESMA ordem de vértices que buildWallMeshFromFootprint usa pras
    // tampas da caixa de referência — cada ponta tem uma ordem PRÓPRIA
    // (não é só trocar p1↔p2), copiada exata daqui, senão a normal
    // calculada por computeVertexNormals aponta pro lado errado (a
    // tampa fica de costas, invisível — cull da face de trás).
    if (end === 2) quad(pt(fp.p2a, y0), pt(fp.p2b, y0), pt(fp.p2b, y1), pt(fp.p2a, y1));
    else quad(pt(fp.p1b, y0), pt(fp.p1a, y0), pt(fp.p1a, y1), pt(fp.p1b, y1));
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // Contorno arquitetônico discreto: somente bordas superiores e quinas
  // verticais. A geometria é explícita para nunca expor a base nem as
  // diagonais internas usadas para triangular as faces da parede.
  function buildWallFootprintEdgeLines(fp: any, height: any, yOffset: any, showTop = true) {
    var y0 = yOffset, y1 = yOffset + height;
    var pts = showTop ? [
      fp.p1a.x, y1, fp.p1a.z, fp.p2a.x, y1, fp.p2a.z,
      fp.p1b.x, y1, fp.p1b.z, fp.p2b.x, y1, fp.p2b.z
    ] : [];
    function vertical(p: any) { pts.push(p.x, y0, p.z, p.x, y1, p.z); }
    // Uma ponta conectada e não estendida fica dentro da continuidade de
    // outra parede. Desenhar sua vertical expõe a emenda interna depois
    // da fusão. Pontas livres e a parede que fecha a quina permanecem.
    if (fp.p1Free !== false || fp.p1Extended) {
      vertical(fp.p1a);
      vertical(fp.p1b);
    }
    if (fp.p2Free !== false || fp.p2Extended) {
      vertical(fp.p2a);
      vertical(fp.p2b);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    var lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: WALL_EDGE_COLOR,
      transparent: true,
      opacity: 0.58,
      depthWrite: false
    }));
    lines.renderOrder = 2;
    return lines;
  }

  function wallSupportsRoofGable(wall: any, roofs: any[]) {
    return (roofs || []).some(function (roof: any) {
      if (roof.type !== 'duasAguas') return false;
      var minX = Math.min(roof.x1, roof.x2), maxX = Math.max(roof.x1, roof.x2);
      var minY = Math.min(roof.y1, roof.y2), maxY = Math.max(roof.y1, roof.y2);
      var wallMinX = Math.min(wall.x1, wall.x2), wallMaxX = Math.max(wall.x1, wall.x2);
      var wallMinY = Math.min(wall.y1, wall.y2), wallMaxY = Math.max(wall.y1, wall.y2);
      if (roof.ridgeAxis === 'x') {
        var onEndX = Math.abs(wall.x1 - wall.x2) <= Core.COINCIDENCE_TOL &&
          (Math.abs(wall.x1 - minX) <= Core.COINCIDENCE_TOL || Math.abs(wall.x1 - maxX) <= Core.COINCIDENCE_TOL);
        return onEndX && Math.min(wallMaxY, maxY) - Math.max(wallMinY, minY) > Core.COINCIDENCE_TOL;
      }
      var onEndY = Math.abs(wall.y1 - wall.y2) <= Core.COINCIDENCE_TOL &&
        (Math.abs(wall.y1 - minY) <= Core.COINCIDENCE_TOL || Math.abs(wall.y1 - maxY) <= Core.COINCIDENCE_TOL);
      return onEndY && Math.min(wallMaxX, maxX) - Math.max(wallMinX, minX) > Core.COINCIDENCE_TOL;
    });
  }

  // =====================================================================
  // ESQUADRIAS (porta/janela) — sem CSG (só temos three.js r128 puro),
  // então uma parede COM aberturas nunca vira um único volume extrudado
  // como buildWallMeshFromFootprint: ela é dividida em "bandas"
  // retangulares (por comprimento t=0..1 ao longo da parede, e por
  // altura), e cada banda vira sua própria caixa/faixa — sólida onde não
  // há vão, e pulada (nenhuma geometria) exatamente onde a abertura
  // existe. Entre p1a-p2a e p1b-p2b (as duas faces já resolvidas pelo
  // canto — ver Core.computeWallFootprints) a aresta é reta, então
  // qualquer ponto intermediário é só uma interpolação linear (lerp) —
  // não precisa recalcular geometria de canto pra cada banda.
  // =====================================================================
  function lerpPt(p1: any, p2: any, t: any) { return { x: p1.x + (p2.x - p1.x) * t, z: p1.z + (p2.z - p1.z) * t }; }

  // Uma banda do VOLUME da parede (equivalente a buildWallMeshFromFootprint,
  // mas só pro trecho [tA,tB] x [y0,y1]). capA/capB controlam se a
  // "tampa" daquela ponta do trecho é desenhada — sempre true pras
  // pontas NOVAS criadas por uma abertura (viram uma face real, a
  // batente/verga/peitoril visível de dentro do vão); só as pontas que
  // coincidem com a ponta DE VERDADE da parede (t=0 ou t=1) seguem a
  // regra condicional original (ponta livre/esticou == tem tampa).
  function buildWallBandMesh(fp: any, axisStart: any, axisEnd: any, y0: any, y1: any, dA: any, dB: any, mat: any, capA: any, capB: any) {
    var sideT = wallBandSideParameters(fp, axisStart, axisEnd, dA, dB);
    var pA0 = lerpPt(fp.p1a, fp.p2a, sideT.aStart), pA1 = lerpPt(fp.p1a, fp.p2a, sideT.aEnd);
    var pB0 = lerpPt(fp.p1b, fp.p2b, sideT.bStart), pB1 = lerpPt(fp.p1b, fp.p2b, sideT.bEnd);
    var base = [[pA0.x, y0, pA0.z], [pA1.x, y0, pA1.z], [pB1.x, y0, pB1.z], [pB0.x, y0, pB0.z]];
    var top = [[pA0.x, y1, pA0.z], [pA1.x, y1, pA1.z], [pB1.x, y1, pB1.z], [pB0.x, y1, pB0.z]];
    var verts: any[] = [];
    function quad(a: any, b: any, c: any, d: any) { [a, b, c, a, c, d].forEach(function (v) { verts.push(v[0], v[1], v[2]); }); }
    quad(base[3], base[2], base[1], base[0]); // base
    quad(top[0], top[1], top[2], top[3]);     // topo
    quad(base[0], base[1], top[1], top[0]);   // lado A
    quad(base[2], base[3], top[3], top[2]);   // lado B
    if (capB) quad(base[1], base[2], top[2], top[1]);
    if (capA) quad(base[3], base[0], top[0], top[3]);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // Equivalente em banda da buildFaceStripMesh (a face pintável de um
  // lado só) — mesmo raciocínio de lerp.
  function buildFaceBandMesh(fp: any, axisStart: any, axisEnd: any, y0: any, y1: any, dA: any, dB: any, mat: any, side: any) {
    var verts: any[] = [];
    function quad(a: any, b: any, c: any, d: any) { [a, b, c, a, c, d].forEach(function (v) { verts.push(v[0], v[1], v[2]); }); }
    var sideT = wallBandSideParameters(fp, axisStart, axisEnd, dA, dB);
    if (side === 'a') {
      var pA0 = lerpPt(fp.p1a, fp.p2a, sideT.aStart), pA1 = lerpPt(fp.p1a, fp.p2a, sideT.aEnd);
      quad([pA0.x, y0, pA0.z], [pA1.x, y0, pA1.z], [pA1.x, y1, pA1.z], [pA0.x, y1, pA0.z]);
    } else {
      var pB0 = lerpPt(fp.p1b, fp.p2b, sideT.bStart), pB1 = lerpPt(fp.p1b, fp.p2b, sideT.bEnd);
      quad([pB1.x, y0, pB1.z], [pB0.x, y0, pB0.z], [pB0.x, y1, pB0.z], [pB1.x, y1, pB1.z]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    var u = Math.abs(dB - dA) / WALL_PLASTER_TILE_METERS;
    var v = Math.abs(y1 - y0) / WALL_PLASTER_TILE_METERS;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // A partir da lista de aberturas de UMA parede (em metros: offset,
  // width, height, sillHeight), devolve as bandas sólidas que sobram —
  // null se a parede não tem nenhuma abertura (caminho antigo, sem
  // mudança nenhuma). tA/tB em fração 0..1 do comprimento da parede.
  function computeWallOpeningBands(wallLenM: any, openings: any, wallHeight: any) {
    if (!openings || !openings.length) return null;
    var list = openings.map(function (o: any) {
      // Clamp defensivo: se a parede foi redimensionada depois que a
      // abertura nasceu (ver limitações conhecidas), o t podia cair fora
      // de 0..1 — trava dentro da parede em vez de gerar geometria
      // invertida ou fora do volume.
      var dStart = Math.max(0, Math.min(wallLenM, o.offset - o.width / 2));
      var dEnd = Math.max(dStart, Math.min(wallLenM, o.offset + o.width / 2));
      return { dStart: dStart, dEnd: dEnd, sill: o.sillHeight, top: o.sillHeight + o.height };
    }).sort(function (a: any, b: any) { return a.dStart - b.dStart; });

    var bands: any[] = [];
    var cursor = 0;
    list.forEach(function (op: any) {
      if (op.dStart > cursor + 1e-4) bands.push({ dA: cursor, dB: op.dStart, y0: 0, y1: wallHeight });
      // Peitoril (só janela — porta tem sill=0, sem banda embaixo).
      if (op.sill > 0.02) bands.push({ dA: op.dStart, dB: op.dEnd, y0: 0, y1: op.sill });
      // Verga (o "lintel" acima do vão).
      if (op.top < wallHeight - 0.02) bands.push({ dA: op.dStart, dB: op.dEnd, y0: op.top, y1: wallHeight });
      cursor = op.dEnd;
    });
    if (cursor < wallLenM - 1e-4) bands.push({ dA: cursor, dB: wallLenM, y0: 0, y1: wallHeight });
    if (!bands.length) return null;
    // Só a primeira/última banda (se realmente tocam a ponta de verdade
    // da parede) herdam a regra condicional de tampa do canto; todas as
    // outras são faces novas criadas pela abertura, sempre tampadas.
    bands[0].edgeA = bands[0].dA <= 1e-4;
    bands[bands.length - 1].edgeB = bands[bands.length - 1].dB >= wallLenM - 1e-4;
    return bands;
  }

  // Geometria "de mobília" da abertura em si (a folha da porta, ou o
  // vidro+caixilho da janela) — MVP: genérica, sem catálogo/fabricante
  // ainda (ver Documento de Domínio, Módulo 11). Devolve uma lista de
  // meshes/linhas já posicionadas no espaço de CENA; o primeiro item da
  // lista é sempre o alvo de clique (Mesh "principal").
  function buildOpeningPieces(op: any, w: any, scale: any, offsetX: any, offsetY: any, yOffset: any, isSelected: any) {
    var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    var lenModel = Math.hypot(dx, dy) || 1e-6;
    var ux = dx / lenModel, uy = dy / lenModel;
    var offsetModel = op.offset * Core.GRID;
    var cxModel = w.x1 + ux * offsetModel, cyModel = w.y1 + uy * offsetModel;
    var sx = (cxModel - offsetX) * scale, sz = (cyModel - offsetY) * scale;
    var angle = -Math.atan2(uy, ux);

    var pieces: any[] = [];
    function addPiece(mesh: any, localY: any, localX?: any) {
      var along = localX || 0;
      mesh.position.set(sx + ux * along, yOffset + localY, sz + uy * along);
      mesh.rotation.y = angle;
      pieces.push(mesh);
    }

    var isDoor = op.kind === 'door';
    var isArco = op.kind === 'arco';
    var layout = computeOpeningAssemblyLayout(op, WALL_THICK);
    var leafWidth = layout.infillWidth;
    var thick = WALL_THICK * 0.7;
    var frameMat = new THREE.MeshStandardMaterial({
      color: isSelected ? SELECTED_ACCENT : OPENING_FRAME_COLOR,
      flatShading: true
    });
    // Reveal do arco usa o MESMO acabamento real da parede (lado A,
    // Catálogo/Materiais) — cor, e cerâmica quando for o caso — mesma
    // lógica de resolução de material usada na face de verdade da
    // parede, reaproveitada aqui. Reboco (textura PBR) foi removido de
    // toda a casa — ver Sessão 27; só sobra cor lisa fora da cerâmica.
    var arcoWallProduct = w.finishA ? Catalog.getProduct(w.finishA) : null;
    var arcoIsCeramic = arcoWallProduct && arcoWallProduct.category === 'floor_tile';
    var arcoCeramicMap = arcoIsCeramic ? buildCeramicTexture(arcoWallProduct!.assets.colorHex, 1, 0) : null;
    var arcoWallColorHex = arcoWallProduct ? parseInt(arcoWallProduct.assets.colorHex.slice(1), 16) : GABLE_COLOR;
    if (arcoIsCeramic) arcoWallColorHex = 0xFFFFFF;
    var arcoRevealMat = new THREE.MeshStandardMaterial({
      color: isSelected ? SELECTED_ACCENT : arcoWallColorHex,
      map: arcoCeramicMap,
      roughness: 0.92,
      flatShading: true
    });

    // Batentes/marcos sólidos (porta/janela) ou reveal do arco — os dois
    // ocupam a folga entre esquadria/corte e a alvenaria, atravessando
    // toda a espessura da parede. A folha/vidro/vão continua sendo o
    // primeiro Mesh e, portanto, o alvo de seleção da abertura.
    function addFrameBars(mat: any) {
      layout.frameBars.forEach(function (bar: any) {
        var frameGeo = new THREE.BoxGeometry(bar.width, bar.height, bar.depth);
        addPiece(new THREE.Mesh(frameGeo, mat), bar.centerY, bar.centerX);
      });
    }

    if (isArco) {
      // Vão estrutural puro — nenhuma folha/vidro, só o reveal fechando
      // o rasgo (addFrameBars com material de parede). Um Mesh INVISÍVEL
      // do tamanho do vão ainda é necessário como alvo de clique/seleção
      // (sem ele não haveria nada pra clicar dentro do buraco).
      var arcoHitGeo = new THREE.BoxGeometry(leafWidth, layout.infillHeight, thick);
      var arcoHitMat = new THREE.MeshBasicMaterial({ visible: false });
      addPiece(new THREE.Mesh(arcoHitGeo, arcoHitMat), layout.infillCenterY);
      addFrameBars(arcoRevealMat);
    } else if (isDoor) {
      var doorColor = isSelected ? SELECTED_ACCENT : 0x8B5E3C;
      var leafGeo = new THREE.BoxGeometry(leafWidth, layout.infillHeight, thick);
      var leafMat = new THREE.MeshStandardMaterial({ color: doorColor, flatShading: true });
      addPiece(new THREE.Mesh(leafGeo, leafMat), layout.infillCenterY);
      addPiece(new THREE.LineSegments(new THREE.EdgesGeometry(leafGeo), new THREE.LineBasicMaterial({ color: 0x1B1C1E })), layout.infillCenterY);
      addFrameBars(frameMat);
    } else {
      var glassColor = isSelected ? SELECTED_ACCENT : 0xBFE3F0;
      var glassHeight = layout.infillHeight;
      var midY = layout.infillCenterY;
      var glassGeo = new THREE.BoxGeometry(leafWidth, glassHeight, thick * 0.5);
      var glassMat = new THREE.MeshStandardMaterial({ color: glassColor, flatShading: true, transparent: true, opacity: isSelected ? 0.75 : 0.45 });
      addPiece(new THREE.Mesh(glassGeo, glassMat), midY);
      addFrameBars(frameMat);
      var mullMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, flatShading: true });
      addPiece(new THREE.Mesh(new THREE.BoxGeometry(0.03, glassHeight, thick * 0.55), mullMat), midY);
      addPiece(new THREE.Mesh(new THREE.BoxGeometry(leafWidth, 0.03, thick * 0.55), mullMat), midY);
    }
    return pieces;
  }

  // Substitui a geometria procedural de buildOpeningPieces por um
  // modelo glTF de verdade, quando a Opening tem um productId (ver
  // types.ts, Store.commands.setOpeningProduct). Reaproveita a MESMA
  // infra de móveis (getFurnitureModel: cache + normalização de pivô —
  // centraliza X/Z, base em Y=0 — funciona pra QUALQUER glTF, não só
  // móvel, então não precisou duplicar nada). Escala X (largura) e Y
  // (altura) pra caber exatamente no vão configurado na Opening; a
  // profundidade (Z, espessura do caixilho) fica como veio do arquivo
  // — esticar a espessura junto distorceria o perfil do caixilho pra
  // vãos muito diferentes do tamanho nominal do modelo. Retorna null
  // enquanto o modelo ainda não carregou (mesmo comportamento de
  // móvel — reaparece sozinho quando o loader termina, ver
  // onFurnitureAssetLoaded) ou se o produto não tiver modelUrl.
  function buildOpeningModelPiece(op: any, product: any, w: any, scale: any, offsetX: any, offsetY: any, yOffset: any) {
    var modelUrl = product && product.assets && product.assets.modelUrl;
    if (!modelUrl) return null;
    var resolvedUrl = (import.meta as any).env.BASE_URL + modelUrl;
    var template = getFurnitureModel(resolvedUrl);
    if (!template) return null;
    var instance = template.group.clone(true);
    // Os arquivos glTF da família de esquadria nomeiam um material
    // "Translucent_Glass_Gray" (ou similar, com "vidro"/"glass" no
    // nome), mas SEM nenhum dado real de transparência gravado (sem
    // alphaMode, sem opacity — confirmado inspecionando o JSON do
    // glTF) — resultado: vidro opaco e escuro na cena (metálico,
    // rugosidade 1, sem reflexo de ambiente). Troca pelo MESMO material
    // de vidro já usado no envidraçamento da casa (buildGlazingGlassMaterial),
    // mas com OPACIDADE BAIXA (transparência real, não só reflexo) —
    // diferente do padrão do envidraçamento (DEFAULT_GLAZING_GLASS_MATERIAL,
    // opacity=1 sempre) que faz sentido pra fachada de vidro grande, mas
    // não pro vidro pequeno de uma folha de porta/janela: aqui a pessoa
    // espera enxergar através, não só o reflexo espelhado.
    var glassMaterial: any = null;
    instance.traverse(function (child: any) {
      if (child.isMesh && child.material && /glass|vidro/i.test(child.material.name || '')) {
        if (!glassMaterial) glassMaterial = buildGlazingGlassMaterial({ ...DEFAULT_GLAZING_GLASS_MATERIAL, opacity: 0.35 });
        child.material = glassMaterial;
      }
    });
    var scaleX = template.footprintW > 1e-6 ? op.width / template.footprintW : 1;
    var scaleY = template.heightM > 1e-6 ? op.height / template.heightM : 1;
    instance.scale.set(scaleX, scaleY, 1);
    // Depois da normalização de pivô (getFurnitureModel) + escala acima,
    // o modelo ocupa exatamente X:[-op.width/2, op.width/2], Y:[0,
    // op.height], Z centrado em 0 — mas a PROFUNDIDADE (Z) do caixilho
    // do arquivo (ex.: ~5cm de janela, ~8cm de porta) quase sempre é
    // menor que a espessura da parede (Core.WALL_THICK, 12cm) — sobra
    // uma folga sem acabamento nenhum dos dois lados (o "buraco" cru do
    // vão, sem tampinha fechando). 4 tiras finas (tampa/requadro),
    // exatamente no contorno do vão, atravessando a espessura TODA da
    // parede — fecham essa folga em qualquer profundidade de caixilho,
    // sem precisar conhecer a profundidade real de cada modelo.
    var revealMat = new THREE.MeshStandardMaterial({ color: OPENING_FRAME_COLOR, flatShading: true });
    var revealTrim = 0.015; // 1,5cm de tira — só o bastante pra cobrir a quina, sem duplicar visualmente o caixilho do modelo
    function addRevealStrip(sizeX: number, sizeY: number, localX: number, localY: number) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, Core.WALL_THICK), revealMat);
      mesh.position.set(localX, localY, 0);
      return mesh;
    }
    var group = new THREE.Group();
    group.add(instance);
    group.add(addRevealStrip(op.width + revealTrim, revealTrim, 0, op.height)); // topo
    group.add(addRevealStrip(op.width + revealTrim, revealTrim, 0, 0)); // base/peitoril
    group.add(addRevealStrip(revealTrim, op.height, -op.width / 2, op.height / 2)); // lateral esquerda
    group.add(addRevealStrip(revealTrim, op.height, op.width / 2, op.height / 2)); // lateral direita

    var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    var lenModel = Math.hypot(dx, dy) || 1e-6;
    var ux = dx / lenModel, uy = dy / lenModel;
    var offsetModel = op.offset * Core.GRID;
    var cxModel = w.x1 + ux * offsetModel, cyModel = w.y1 + uy * offsetModel;
    group.position.set((cxModel - offsetX) * scale, yOffset + op.sillHeight, (cyModel - offsetY) * scale);
    group.rotation.y = -Math.atan2(uy, ux);
    return group;
  }

  // Telhado de duas águas: a cumeeira corre ao longo do lado mais comprido
  // do retângulo, com caimento em pitchDeg (agora um valor PRÓPRIO de
  // cada telhado colocado, ajustável pela alça da cumeeira — não é mais
  // um ângulo fixo pra casa toda). O beiral (avanço) existe nos dois
  // sentidos — o alpendre (perpendicular à cumeeira) E um beiral menor
  // sobre o oitão (RAKE_OVERHANG) — mas o OITÃO em si (a parede
  // triangular) fica sempre encostado exatamente na parede.
  //
  // GABLE_WALL_EXTEND: telhado e parede são objetos independentes — o
  // x1/x2 do telhado representa o CENTRO da parede (mesma linha de
  // grade), não a face dela. Como a parede tem espessura própria
  // (Core.WALL_THICK), a face de verdade fica meia espessura além desse
  // centro — e esse meio-passo nunca é alcançável arrastando (a grade
  // de encaixe é mais grossa que isso, ver Registro de Decisões). Sem
  // esse acréscimo, o oitão para exatamente no centro da parede e sobra
  // uma fresta visível até a face de fora dela.
  var GABLE_WALL_EXTEND = Core.WALL_THICK / 2;

  function buildRoofDuasAguas(topBounds: any, topY: any, roofColor: any, gableColors: any, pitchDeg: any, ridgeAxis: any, tabeiraColor: any) {
    var meshes: any[] = [];
    function addGable(mesh: any, side: string) { mesh.userData.gableSide = side; meshes.push(mesh); }
    var ridgeAlongX = ridgeAxis === 'x';
    var pitchRad = pitchDeg * Math.PI / 180;
    var verticalDrop = ROOF_THICKNESS / Math.cos(pitchRad);
    var gableRoofClearance = verticalDrop + 0.006;
    // Onde a água já subiu até a face do oitão (que fica ENCOSTADA na
    // parede, sem avançar) — o oitão não pode ser um triângulo simples
    // da altura da parede até a cumeeira, porque isso percorre uma
    // distância menor que o alpendre real e sai com um ângulo mais
    // íngreme que o telhado de verdade. A correção: o oitão sobe reto
    // (uma faixa baixa) até essa altura intermediária, e só DAÍ o
    // triângulo começa — assim a inclinação do triângulo bate exatamente
    // com a da água.
    var gableBaseRise = ROOF_OVERHANG * Math.tan(pitchRad);

    if (ridgeAlongX) {
      var eMinZ = topBounds.minZ - ROOF_OVERHANG, eMaxZ = topBounds.maxZ + ROOF_OVERHANG;
      var eMinX = topBounds.minX - RAKE_OVERHANG, eMaxX = topBounds.maxX + RAKE_OVERHANG;
      var ridgeZ = (topBounds.minZ + topBounds.maxZ) / 2;
      var halfSpan = (eMaxZ - eMinZ) / 2;
      var ridgeY = topY + halfSpan * Math.tan(pitchRad);
      var gableBaseY = topY + gableBaseRise;
      var gableBaseUnderY = gableBaseY - gableRoofClearance;
      var gableRidgeUnderY = ridgeY - gableRoofClearance;
      var gMinX = topBounds.minX - GABLE_WALL_EXTEND, gMaxX = topBounds.maxX + GABLE_WALL_EXTEND;
      var gMinZ = topBounds.minZ - GABLE_WALL_EXTEND, gMaxZ = topBounds.maxZ + GABLE_WALL_EXTEND;
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMinX, y: topY, z: eMinZ }, { x: eMaxX, y: topY, z: eMinZ },
        { x: eMaxX, y: ridgeY, z: ridgeZ }, { x: eMinX, y: ridgeY, z: ridgeZ }
      ], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMaxX, y: topY, z: eMaxZ }, { x: eMinX, y: topY, z: eMaxZ },
        { x: eMinX, y: ridgeY, z: ridgeZ }, { x: eMaxX, y: ridgeY, z: ridgeZ }
      ], verticalDrop, roofColor, tabeiraColor));
      addGable(buildGableMesh([
        { x: gMinX, y: topY, z: gMinZ }, { x: gMinX, y: topY, z: gMaxZ },
        { x: gMinX, y: gableBaseUnderY, z: gMaxZ }, { x: gMinX, y: gableRidgeUnderY, z: ridgeZ },
        { x: gMinX, y: gableBaseUnderY, z: gMinZ }
      ], gableColors.a), 'a');
      addGable(buildGableMesh([
        { x: gMaxX, y: topY, z: gMaxZ }, { x: gMaxX, y: topY, z: gMinZ },
        { x: gMaxX, y: gableBaseUnderY, z: gMinZ }, { x: gMaxX, y: gableRidgeUnderY, z: ridgeZ },
        { x: gMaxX, y: gableBaseUnderY, z: gMaxZ }
      ], gableColors.b), 'b');
      meshes.push(buildRidgeCapMesh({ x: eMinX, y: ridgeY, z: ridgeZ }, { x: eMaxX, y: ridgeY, z: ridgeZ }, roofColor, pitchRad));
    } else {
      var eMinX2 = topBounds.minX - ROOF_OVERHANG, eMaxX2 = topBounds.maxX + ROOF_OVERHANG;
      var eMinZ2 = topBounds.minZ - RAKE_OVERHANG, eMaxZ2 = topBounds.maxZ + RAKE_OVERHANG;
      var ridgeX = (topBounds.minX + topBounds.maxX) / 2;
      var halfSpan2 = (eMaxX2 - eMinX2) / 2;
      var ridgeY2 = topY + halfSpan2 * Math.tan(pitchRad);
      var gableBaseY2 = topY + gableBaseRise;
      var gableBaseUnderY2 = gableBaseY2 - gableRoofClearance;
      var gableRidgeUnderY2 = ridgeY2 - gableRoofClearance;
      var gMinZ2 = topBounds.minZ - GABLE_WALL_EXTEND, gMaxZ2 = topBounds.maxZ + GABLE_WALL_EXTEND;
      var gMinX2 = topBounds.minX - GABLE_WALL_EXTEND, gMaxX2 = topBounds.maxX + GABLE_WALL_EXTEND;
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMinX2, y: topY, z: eMinZ2 }, { x: eMinX2, y: topY, z: eMaxZ2 },
        { x: ridgeX, y: ridgeY2, z: eMaxZ2 }, { x: ridgeX, y: ridgeY2, z: eMinZ2 }
      ], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMaxX2, y: topY, z: eMaxZ2 }, { x: eMaxX2, y: topY, z: eMinZ2 },
        { x: ridgeX, y: ridgeY2, z: eMinZ2 }, { x: ridgeX, y: ridgeY2, z: eMaxZ2 }
      ], verticalDrop, roofColor, tabeiraColor));
      addGable(buildGableMesh([
        { x: gMinX2, y: topY, z: gMinZ2 }, { x: gMaxX2, y: topY, z: gMinZ2 },
        { x: gMaxX2, y: gableBaseUnderY2, z: gMinZ2 }, { x: ridgeX, y: gableRidgeUnderY2, z: gMinZ2 },
        { x: gMinX2, y: gableBaseUnderY2, z: gMinZ2 }
      ], gableColors.a), 'a');
      addGable(buildGableMesh([
        { x: gMaxX2, y: topY, z: gMaxZ2 }, { x: gMinX2, y: topY, z: gMaxZ2 },
        { x: gMinX2, y: gableBaseUnderY2, z: gMaxZ2 }, { x: ridgeX, y: gableRidgeUnderY2, z: gMaxZ2 },
        { x: gMaxX2, y: gableBaseUnderY2, z: gMaxZ2 }
      ], gableColors.b), 'b');
      meshes.push(buildRidgeCapMesh({ x: ridgeX, y: ridgeY2, z: eMinZ2 }, { x: ridgeX, y: ridgeY2, z: eMaxZ2 }, roofColor, pitchRad));
    }
    return meshes;
  }

  function buildRoofQuatroAguas(topBounds: any, topY: any, roofColor: any, pitchDeg: any, ridgeAxis: any, tabeiraColor: any) {
    var meshes: any[] = [];
    var ridgeAlongX = ridgeAxis === 'x';
    var pitchRad = pitchDeg * Math.PI / 180;
    var verticalDrop = ROOF_THICKNESS / Math.cos(pitchRad);
    var eMinX = topBounds.minX - ROOF_OVERHANG, eMaxX = topBounds.maxX + ROOF_OVERHANG;
    var eMinZ = topBounds.minZ - ROOF_OVERHANG, eMaxZ = topBounds.maxZ + ROOF_OVERHANG;
    var A = { x: eMinX, y: topY, z: eMinZ }, B = { x: eMaxX, y: topY, z: eMinZ };
    var C = { x: eMaxX, y: topY, z: eMaxZ }, D = { x: eMinX, y: topY, z: eMaxZ };

    if (ridgeAlongX) {
      var ridgeZ = (topBounds.minZ + topBounds.maxZ) / 2;
      var halfWidth = (eMaxZ - eMinZ) / 2;
      var ridgeY = topY + halfWidth * Math.tan(pitchRad);
      var r1x = Math.min(eMinX + halfWidth, eMaxX - halfWidth);
      var r2x = Math.max(eMinX + halfWidth, eMaxX - halfWidth);
      var R1 = { x: r1x, y: ridgeY, z: ridgeZ }, R2 = { x: r2x, y: ridgeY, z: ridgeZ };
      meshes.push.apply(meshes, extrudeSlopeDown([A, B, R2, R1], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([C, D, R1, R2], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([A, D, R1], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([B, C, R2], verticalDrop, roofColor, tabeiraColor));
      // Telha de cumeeira (R1-R2) + telha de espigão nos 4 cantos —
      // fecha por cima o encontro das águas, mesma textura da telha.
      if (r2x - r1x > 1e-3) meshes.push(buildRidgeCapMesh(R1, R2, roofColor, pitchRad));
      [[A, R1], [D, R1], [B, R2], [C, R2]].forEach(function (pair) {
        var cornerStart = extendBeyond(pair[0], pair[1], HIP_CORNER_OVERSHOOT);
        var cap = buildRidgeCapMesh(cornerStart, pair[1], roofColor, pitchRad);
        if (cap) meshes.push(cap);
      });
    } else {
      var ridgeX = (topBounds.minX + topBounds.maxX) / 2;
      var halfWidth2 = (eMaxX - eMinX) / 2;
      var ridgeY2 = topY + halfWidth2 * Math.tan(pitchRad);
      var r1z = Math.min(eMinZ + halfWidth2, eMaxZ - halfWidth2);
      var r2z = Math.max(eMinZ + halfWidth2, eMaxZ - halfWidth2);
      var R1b = { x: ridgeX, y: ridgeY2, z: r1z }, R2b = { x: ridgeX, y: ridgeY2, z: r2z };
      meshes.push.apply(meshes, extrudeSlopeDown([A, D, R2b, R1b], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([C, B, R1b, R2b], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([A, B, R1b], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([D, C, R2b], verticalDrop, roofColor, tabeiraColor));
      if (r2z - r1z > 1e-3) meshes.push(buildRidgeCapMesh(R1b, R2b, roofColor, pitchRad));
      [[A, R1b], [B, R1b], [D, R2b], [C, R2b]].forEach(function (pair) {
        var cornerStart = extendBeyond(pair[0], pair[1], HIP_CORNER_OVERSHOOT);
        var cap = buildRidgeCapMesh(cornerStart, pair[1], roofColor, pitchRad);
        if (cap) meshes.push(cap);
      });
    }
    return meshes;
  }

  // Uma água: um plano só, subindo de um lado baixo (com beiral) até um
  // lado alto (também com um pouco de beiral). Sem cumeeira nem vale —
  // por isso não tem o problema de "duas pontas que precisam se
  // encontrar" que duas/quatro águas têm.
  function buildRoofUmaAgua(topBounds: any, topY: any, roofColor: any, pitchDeg: any, ridgeAxis: any, tabeiraColor: any) {
    var pitchRad = pitchDeg * Math.PI / 180;
    var verticalDrop = ROOF_THICKNESS / Math.cos(pitchRad);
    var slopeAlongZ = ridgeAxis === 'x';
    var meshes: any[] = [];
    if (slopeAlongZ) {
      var eMinX = topBounds.minX - RAKE_OVERHANG, eMaxX = topBounds.maxX + RAKE_OVERHANG;
      var eMinZ = topBounds.minZ - ROOF_OVERHANG, eMaxZ = topBounds.maxZ + ROOF_OVERHANG;
      var highY = topY + (eMaxZ - eMinZ) * Math.tan(pitchRad);
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMinX, y: topY, z: eMinZ }, { x: eMaxX, y: topY, z: eMinZ },
        { x: eMaxX, y: highY, z: eMaxZ }, { x: eMinX, y: highY, z: eMaxZ }
      ], verticalDrop, roofColor, tabeiraColor));
    } else {
      var eMinZ2 = topBounds.minZ - RAKE_OVERHANG, eMaxZ2 = topBounds.maxZ + RAKE_OVERHANG;
      var eMinX2 = topBounds.minX - ROOF_OVERHANG, eMaxX2 = topBounds.maxX + ROOF_OVERHANG;
      var highY2 = topY + (eMaxX2 - eMinX2) * Math.tan(pitchRad);
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMinX2, y: topY, z: eMinZ2 }, { x: eMinX2, y: topY, z: eMaxZ2 },
        { x: eMaxX2, y: highY2, z: eMaxZ2 }, { x: eMaxX2, y: highY2, z: eMinZ2 }
      ], verticalDrop, roofColor, tabeiraColor));
    }
    return meshes;
  }

  // Quatro paredes baixas formando um quadro ao redor do perímetro — o
  // parapeito da platibanda (e, via este mesmo helper, a laje — ver
  // chamada em buildRoofLaje). Material liso, sem textura de reboco
  // (removida de toda a casa — ver Sessão 27); os parâmetros
  // thickness/length continuam recebidos só por compatibilidade de
  // assinatura com o chamador, sem uso aqui agora.
  function buildParapetSegmentMaterial(color: any, thickness: any, height: any, length: any) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.92,
      flatShading: true
    });
  }
  // Terreno — ver ADR-008. Muros já confirmados (Terreno.muros) sempre
  // aparecem, extrudados como caixa simples (sem o sistema de footprint
  // com miter de canto usado por Floor.walls — simplificação desta
  // etapa; os cantos entre dois muros adjacentes não recebem tratamento
  // especial, só se sobrepõem geometricamente na espessura). Enquanto a
  // ferramenta Terreno está ativa, desenha também o retângulo-guia e
  // uma faixa clicável por lado (pickável via a mesma convenção de
  // userData.category que todo o resto da cena usa — ver pickMesh em
  // ViewportController).
  var TERRENO_GUIDE_COLOR = 0x378ADD, TERRENO_MURO_MARKED_COLOR = 0x4CAF50;
  function buildTerrenoMuroBoxMesh(muro: Wall, scale: number, offsetX: number, offsetY: number, mat: THREE.Material) {
    var x1 = (muro.x1 - offsetX) * scale, z1 = (muro.y1 - offsetY) * scale;
    var x2 = (muro.x2 - offsetX) * scale, z2 = (muro.y2 - offsetY) * scale;
    var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    var height = muro.heightM != null ? muro.heightM : Core.TERRENO_MURO_HEIGHT_M;
    var thick = Core.WALL_THICK;
    // Estende a caixa pela espessura em cada ponta (mesmo truque de
    // buildParapetWalls) — sem isso, dois muros adjacentes se
    // encontrando na quina do terreno deixam uma fresta triangular
    // (o corpo de cada caixa termina exatamente na linha do eixo, não
    // cobre a espessura da outra parede que chega perpendicular ali).
    var geo = new THREE.BoxGeometry(len + thick, height, thick);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, height / 2, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    return mesh;
  }

  function buildTerrenoSideStripMesh(seg: { x1: number; y1: number; x2: number; y2: number }, scale: number, offsetX: number, offsetY: number, hasMuro: boolean) {
    var x1 = (seg.x1 - offsetX) * scale, z1 = (seg.y1 - offsetY) * scale;
    var x2 = (seg.x2 - offsetX) * scale, z2 = (seg.y2 - offsetY) * scale;
    var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    var stripWidth = Math.max(0.3, Math.min(1, len * 0.06));
    var geo = new THREE.BoxGeometry(len, 0.03, stripWidth);
    var mat = new THREE.MeshBasicMaterial({
      color: hasMuro ? TERRENO_MURO_MARKED_COLOR : TERRENO_GUIDE_COLOR,
      transparent: true, opacity: hasMuro ? 0.55 : 0.35, depthWrite: false,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    return mesh;
  }

  function buildTerrenoOutlineLines(terreno: { larguraM: number; comprimentoM: number }, scale: number, offsetX: number, offsetY: number) {
    var w = terreno.larguraM * Core.GRID, c = terreno.comprimentoM * Core.GRID;
    function toScene(mx: number, my: number) { return new THREE.Vector3((mx - offsetX) * scale, 0.01, (my - offsetY) * scale); }
    var points = [toScene(0, 0), toScene(w, 0), toScene(w, c), toScene(0, c), toScene(0, 0)];
    var geo = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: TERRENO_GUIDE_COLOR }));
  }

  function buildTerrenoPieces(scene: any, terreno: Project['terreno'], viewState: ViewState, scale: number, offsetX: number, offsetY: number) {
    if (!terreno) return;
    var wallColor = computeWallMatchColor(terreno.muros);
    var mat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85, metalness: 0.02 });
    terreno.muros.forEach(function (muro) {
      var mesh = tagCategory(buildTerrenoMuroBoxMesh(muro, scale, offsetX, offsetY, mat), 'terrenoMuro');
      mesh.userData.terrenoMuroId = muro.id;
      scene.add(mesh);
      registry.structureMeshes.push(mesh);
    });

    if (viewState.terrenoToolActive) {
      var outline = buildTerrenoOutlineLines(terreno, scale, offsetX, offsetY);
      scene.add(outline);
      registry.structureMeshes.push(outline);
      (['minX', 'maxX', 'minZ', 'maxZ'] as const).forEach(function (side) {
        var seg = Core.terrenoMuroSegment(terreno, side);
        var hasMuro = terreno!.muros.some(function (m) { return m.id === Core.terrenoMuroId(side); });
        var strip = tagCategory(buildTerrenoSideStripMesh(seg, scale, offsetX, offsetY, hasMuro), 'terrenoSide');
        strip.userData.terrenoSide = side;
        scene.add(strip);
        registry.structureMeshes.push(strip);
      });
    }
  }

  function buildParapetWalls(bounds: any, topY: any, height: any, thickness: any, color: any) {
    var meshes: any[] = [];
    function seg(x1: any, z1: any, x2: any, z2: any) {
      var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      var geo = new THREE.BoxGeometry(len + thickness, height, thickness);
      var mat = buildParapetSegmentMaterial(color, thickness, height, len + thickness);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((x1 + x2) / 2, topY + height / 2, (z1 + z2) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      return mesh;
    }
    meshes.push(seg(bounds.minX, bounds.minZ, bounds.maxX, bounds.minZ));
    meshes.push(seg(bounds.maxX, bounds.minZ, bounds.maxX, bounds.maxZ));
    meshes.push(seg(bounds.maxX, bounds.maxZ, bounds.minX, bounds.maxZ));
    meshes.push(seg(bounds.minX, bounds.maxZ, bounds.minX, bounds.minZ));
    return meshes;
  }

  // Platibanda: laje com um caimento sutil (pra escoamento de água de
  // verdade, mesmo escondida atrás do parapeito — antes era 100% plana,
  // sem nenhuma queda visível) + parapeito escondendo a borda, na MESMA
  // cor/acabamento das paredes da casa (antes fixo em GABLE_COLOR, um
  // bege que destoava de qualquer parede pintada diferente) e com altura
  // ajustável (arraste a alça, ver handle 'roofParapetHeight'). Sem
  // cumeeira, sem vale — funciona pra qualquer formato de casa.
  var PLATIBANDA_SLOPE_DEG = 2; // caimento discreto, mas perceptível de perto/de cima — 2° é o mínimo usual pra laje impermeabilizada escoar
  var PARAPET_HEIGHT_DEFAULT = 0.5, PARAPET_HEIGHT_MIN = 0.2, PARAPET_HEIGHT_MAX = 1.2, PARAPET_THICK = 0.1;
  function clampParapetHeight(h: any) {
    return Math.max(PARAPET_HEIGHT_MIN, Math.min(PARAPET_HEIGHT_MAX, h != null ? h : PARAPET_HEIGHT_DEFAULT));
  }
  function buildRoofPlatibanda(topBounds: any, topY: any, roofColor: any, ridgeAxis: any, parapetHeight: any, parapetColor: any) {
    var height = clampParapetHeight(parapetHeight);
    var slopeRad = PLATIBANDA_SLOPE_DEG * Math.PI / 180;
    var verticalDrop = ROOF_THICKNESS / Math.cos(slopeRad);
    var baseY = topY + ROOF_THICKNESS; // topo da laje no ponto mais baixo — mesma cota que a laje plana antiga
    var slopeAlongZ = ridgeAxis === 'x'; // mesma convenção de eixo das águas de verdade — "girar" o telhado também troca a direção do caimento
    var meshes: any[] = [], pts: any;
    if (slopeAlongZ) {
      var highY = baseY + (topBounds.maxZ - topBounds.minZ) * Math.tan(slopeRad);
      pts = [
        { x: topBounds.minX, y: baseY, z: topBounds.minZ }, { x: topBounds.maxX, y: baseY, z: topBounds.minZ },
        { x: topBounds.maxX, y: highY, z: topBounds.maxZ }, { x: topBounds.minX, y: highY, z: topBounds.maxZ }
      ];
    } else {
      var highY2 = baseY + (topBounds.maxX - topBounds.minX) * Math.tan(slopeRad);
      pts = [
        { x: topBounds.minX, y: baseY, z: topBounds.minZ }, { x: topBounds.minX, y: baseY, z: topBounds.maxZ },
        { x: topBounds.maxX, y: highY2, z: topBounds.maxZ }, { x: topBounds.maxX, y: highY2, z: topBounds.minZ }
      ];
    }
    meshes.push.apply(meshes, extrudeSlopeDown(pts, verticalDrop, roofColor, roofColor));
    meshes = meshes.concat(buildParapetWalls(topBounds, topY, height, PARAPET_THICK, parapetColor != null ? parapetColor : GABLE_COLOR));
    return meshes;
  }

  // Cache de texturas carregadas — sem isso, cada redesenho do telhado
  // (arrastar a inclinação, girar a câmera com highlight etc.) recriaria
  // e recarregaria as 4 imagens do zero, toda vez.
  var roofTextureCache: Record<string, any> = {};
  function buildRoofTileMaterial(product: any, viewState: any) {
    var tex = product.assets.textures!;
    if (!roofTextureCache[product.id]) {
      var loader = new THREE.TextureLoader();
      function load(dataUri: any, srgb: any) {
        if (!dataUri) return null;
        var t = loader.load(dataUri);
        t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      }
      roofTextureCache[product.id] = {
        map: load(tex.map, true),
        normalMap: load(tex.normalMap, false),
        roughnessMap: load(tex.roughnessMap, false),
        aoMap: load(tex.aoMap, false)
      };
    }
    var maps = roofTextureCache[product.id];
    // Multiplica por branco (sem tingir) — só puxa pro destaque quando a
    // categoria telhado estiver em destaque (mesma regra do pickColor de
    // sempre), assim a textura mantém a cor própria no caso comum.
    var tintColor = pickColor(0xFFFFFF, 'telhado', viewState);
    var mat = new THREE.MeshStandardMaterial({
      map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap, aoMap: maps.aoMap,
      color: tintColor, side: THREE.DoubleSide
    });
    mat.userData.tileMeters = product.assets.tileMeters || 1;
    return mat;
  }

  // Material da tabeira (fechamento de empena) — textura de madeira,
  // igual ao telhado: cache pra não recarregar toda hora. Por enquanto
  // sem seletor na interface (não existe pastilha de acabamento pra
  // tabeira ainda) — usa direto o produto de teste como padrão fixo,
  // no lugar da cor bege lisa de antes.
  var tabeiraTextureCache: any = {};
  function buildTabeiraMaterial(viewState: any) {
    var product = Catalog.getProduct('teste.tabeira.madeira-pbr');
    if (!product) return pickColor(GABLE_COLOR, 'telhado', viewState);
    var tex = product.assets.textures!;
    if (!tabeiraTextureCache.map) {
      var loader = new THREE.TextureLoader();
      function load(dataUri: any, srgb: any) {
        if (!dataUri) return null;
        var t = loader.load(dataUri);
        t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      }
      tabeiraTextureCache = {
        map: load(tex.map, true),
        normalMap: load(tex.normalMap, false),
        roughnessMap: load(tex.roughnessMap, false)
      };
    }
    var tintColor = pickColor(0xFFFFFF, 'telhado', viewState);
    var mat = new THREE.MeshStandardMaterial({
      map: tabeiraTextureCache.map, normalMap: tabeiraTextureCache.normalMap, roughnessMap: tabeiraTextureCache.roughnessMap,
      color: tintColor, side: THREE.DoubleSide
    });
    mat.userData.tileMeters = product.assets.tileMeters || 1;
    return mat;
  }

  function buildGableWallMaterial(productId: any, viewState: any) {
    var product = productId ? Catalog.getProduct(productId) : null;
    if (product && product.category === 'floor_tile') {
      return new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        map: buildCeramicTexture(product.assets.colorHex, 1, 0),
        roughness: 0.78,
        side: THREE.DoubleSide
      });
    }
    var color = product ? parseInt(product.assets.colorHex.slice(1), 16) : GABLE_COLOR;
    return new THREE.MeshStandardMaterial({
      color: pickColor(color, 'paredesTerreo', viewState),
      roughness: 0.92,
      side: THREE.DoubleSide
    });
  }

  // Cor do parapeito da platibanda: em vez de sempre cair no bege padrão
  // (GABLE_COLOR — o mesmo default que as paredes sem acabamento usam),
  // procura primeiro o acabamento (tinta do Catálogo) predominante já
  // escolhido nas paredes do pavimento, pra bater com a cor real da
  // casa quando ela foi pintada. Sem nenhuma parede pintada ainda, cai
  // no mesmo GABLE_COLOR que as próprias paredes usam por padrão — nunca
  // destoa.
  function computeWallMatchColor(walls: any) {
    var counts: { [hex: string]: number } = {};
    (walls || []).forEach(function (w: any) {
      [w.finishA, w.finishB].forEach(function (productId: any) {
        if (!productId) return;
        var product = Catalog.getProduct(productId);
        if (!product || !product.assets || !product.assets.colorHex) return;
        var hex = product.assets.colorHex;
        counts[hex] = (counts[hex] || 0) + 1;
      });
    });
    var bestHex: string | null = null, bestCount = 0;
    Object.keys(counts).forEach(function (hex) {
      if (counts[hex]! > bestCount) { bestCount = counts[hex]!; bestHex = hex; }
    });
    return bestHex ? parseInt((bestHex as string).slice(1), 16) : GABLE_COLOR;
  }

  // Constrói UM telhado colocado (objeto persistente), convertendo do
  // espaço de modelo pro de mundo e despachando pro tipo certo.
  function buildRoofPiece(roof: any, scale: any, offsetX: any, offsetY: any, floorTopY: any, viewState: any, wallMatchColor?: any) {
    var roofFinish = roof.finishProductId && Catalog.getProduct(roof.finishProductId);
    var roofColor;
    if (roofFinish && roofFinish.assets.textures) {
      roofColor = buildRoofTileMaterial(roofFinish, viewState);
    } else {
      var roofBaseColor = roofFinish ? parseInt(roofFinish.assets.colorHex.slice(1), 16) : ROOF_COLOR;
      roofColor = pickColor(roofBaseColor, 'telhado', viewState);
    }
    // Oitão (a parede triangular da empena, encostada na parede de
    // baixo) continua cor lisa — a textura de madeira é da TESTEIRA/
    // TABEIRA (a faixa de borda exposta do telhado, construída dentro
    // de extrudeSlopeDown), não do oitão.
    var gableColors = {
      a: buildGableWallMaterial(roof.gableFinishA, viewState),
      b: buildGableWallMaterial(roof.gableFinishB, viewState)
    };
    var tabeiraColor = buildTabeiraMaterial(viewState);
    var bounds = {
      minX: (roof.x1 - offsetX) * scale, maxX: (roof.x2 - offsetX) * scale,
      minZ: (roof.y1 - offsetY) * scale, maxZ: (roof.y2 - offsetY) * scale
    };
    // Guarda contra geometria degenerada (cômodo detectado errado a meio
    // de um hover, telhado fantasma numa transição de estado, etc.) —
    // nunca deixa passar limites/ângulo inválidos pro Three.js, que
    // travaria o console com erros de NaN repetidos.
    var MIN_SPAN = 0.3;
    var validBounds = isFinite(bounds.minX) && isFinite(bounds.maxX) && isFinite(bounds.minZ) && isFinite(bounds.maxZ)
      && (bounds.maxX - bounds.minX) > MIN_SPAN && (bounds.maxZ - bounds.minZ) > MIN_SPAN;
    var pitchDeg = roof.pitchDeg;
    var validPitch = isFinite(pitchDeg) && pitchDeg > 0 && pitchDeg < 90;
    if (!validBounds || (roof.type !== 'platibanda' && !validPitch)) return [];
    var ridgeAxis = roof.ridgeAxis === 'y' ? 'y' : 'x';

    if (roof.type === 'quatroAguas') return buildRoofQuatroAguas(bounds, floorTopY, roofColor, pitchDeg, ridgeAxis, tabeiraColor);
    if (roof.type === 'umaAgua') return buildRoofUmaAgua(bounds, floorTopY, roofColor, pitchDeg, ridgeAxis, tabeiraColor);
    if (roof.type === 'platibanda') {
      var parapetColor = pickColor(wallMatchColor != null ? wallMatchColor : GABLE_COLOR, 'telhado', viewState);
      return buildRoofPlatibanda(bounds, floorTopY, roofColor, ridgeAxis, roof.parapetHeight, parapetColor);
    }
    return buildRoofDuasAguas(bounds, floorTopY, roofColor, gableColors, pitchDeg, ridgeAxis, tabeiraColor);
  }

  export function createRoofResizePreviewMeshes(roof: any, scale: number, offsetX: number, offsetY: number, floorTopY: number): THREE.Object3D[] {
    return buildRoofPiece(roof, scale, offsetX, offsetY, floorTopY, {}).map(function (piece: any) {
      var materials = Array.isArray(piece.material) ? piece.material : [piece.material];
      var previewMaterials = materials.map(function (material: any) {
        var previewMaterial = material.clone();
        previewMaterial.transparent = true;
        previewMaterial.opacity = 0.38;
        previewMaterial.depthWrite = false;
        return previewMaterial;
      });
      piece.material = Array.isArray(piece.material) ? previewMaterials : previewMaterials[0];
      piece.userData = { roofResizePreview: true };
      return piece;
    });
  }

  // Prévia fantasma do arraste de UMA parede (empurrar/redimensionar) —
  // mesmo princípio de createRoofResizePreviewMeshes acima: recalcula só
  // o footprint (Core.computeWallFootprints) de uma lista CANDIDATA de
  // paredes (a arrastada, já na posição nova, + vizinhas diretamente
  // ligadas nas pontas, também já ajustadas) e desenha um volume
  // translúcido por parede — sem abertura/rodapé/acabamento (é só
  // feedback visual do gesto; a reconstrução completa e correta acontece
  // no commit real, ao soltar). previewWallIds decide quais paredes da
  // lista candidata ganham malha (normalmente a arrastada + suas
  // vizinhas diretas, não a planta inteira).
  export function createWallResizePreviewMeshes(candidateWalls: any[], previewWallIds: string[], scale: number, offsetX: number, offsetY: number, yOffset: number, wallHeight: number): THREE.Object3D[] {
    var footprints = Core.computeWallFootprints(candidateWalls);
    function toScene(p: any) { return { x: (p.x - offsetX) * scale, z: (p.y - offsetY) * scale }; }
    var previewMaterial = new THREE.MeshStandardMaterial({
      color: SELECTED_ACCENT, flatShading: true, side: THREE.DoubleSide,
      transparent: true, opacity: 0.38, depthWrite: false
    });
    var meshes: THREE.Object3D[] = [];
    previewWallIds.forEach(function (id) {
      var fpModel = footprints[id];
      if (!fpModel) return;
      var fp = {
        p1a: toScene(fpModel.p1a), p1b: toScene(fpModel.p1b), p2a: toScene(fpModel.p2a), p2b: toScene(fpModel.p2b),
        p1Free: fpModel.p1Free, p2Free: fpModel.p2Free, p1Extended: fpModel.p1Extended, p2Extended: fpModel.p2Extended
      };
      var mesh = buildWallMeshFromFootprint(fp, wallHeight, yOffset, previewMaterial);
      mesh.userData = { wallResizePreview: true };
      meshes.push(mesh);
    });
    return meshes;
  }

  // Laje colocável de verdade (ver DEC-35) — uma caixa achatada com o
  // MESMO material liso das paredes/parapeito (reaproveita
  // buildParapetSegmentMaterial, já usado no parapeito da platibanda —
  // textura de reboco removida de toda a casa, ver Sessão 27),
  // sem nenhuma relação obrigatória com o contorno de parede: pode ser
  // menor (vão aberto) ou maior (balanço/sacada) que ele — x1..y2 vêm
  // direto do objeto Laje, arrastados livremente pela pessoa.
  // Laje colocável de verdade (ver DEC-35/37) — extrusão de um
  // POLÍGONO real (não mais uma caixa retangular fixa): depois de
  // fundir duas peças que não formam um retângulo perfeito, o
  // contorno pode ter mais de 4 pontos (um "L", por exemplo). Mesma
  // técnica de makeSlabMesh (Shape + ExtrudeGeometry, shape.x/y = 
  // mundo x/z), com o MESMO material liso das paredes/parapeito
  // (buildParapetSegmentMaterial, já usado no parapeito da
  // platibanda) em vez do material liso genérico de makeSlabMesh.
  // Placeholder do painel de Envidraçamento (DEC-56, Etapa 2a) — caixa
  // preta semitransparente na posição/rotação/tamanho do painel ainda
  // solto (state 'preview'). Etapa 2c: grid de verdade (moldura +
  // perfis internos + vidro), com proporções e material extraídos do
  // modelo de referência feito no Blender pelo usuário
  // (Fachada_Glazing.glb — ver DEC-56).

  // Mapa de ambiente procedural pro vidro espelhado — mesmo degradê de
  // céu já usado como fundo da cena (EsboceApplication.
  // createSkyBackground), com mapeamento equirretangular pra servir de
  // reflexo. Sem depender de textura externa. Cacheado uma vez — é um
  // degradê fixo, não muda entre reconstruções da cena.
  var glazingEnvMapCache: any = null;
  function getGlazingEnvMap() {
    if (glazingEnvMapCache) return glazingEnvMapCache;
    var canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      var sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0, '#78bfe0');
      sky.addColorStop(0.48, '#b8dce7');
      sky.addColorStop(0.78, '#dde9e6');
      sky.addColorStop(1, '#f0eee2');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Um espelho só parece espelho quando há contraste e formas para
      // refletir. Nuvens, horizonte e volumes distantes dão referências
      // visuais sem depender de HDRI externo ou de uma fotografia.
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ([[110,105,150,34],[365,75,210,42],[720,125,175,35],[930,82,125,28]] as [number, number, number, number][]).forEach(function (cloud) {
        ctx!.beginPath(); ctx!.ellipse(cloud[0], cloud[1], cloud[2], cloud[3], 0, 0, Math.PI * 2); ctx!.fill();
      });
      var ground = ctx.createLinearGradient(0, 330, 0, 512);
      ground.addColorStop(0, '#718466'); ground.addColorStop(0.48, '#35483b'); ground.addColorStop(1, '#151d20');
      ctx.fillStyle = ground; ctx.fillRect(0, 330, 1024, 182);
      ctx.fillStyle = 'rgba(25,38,42,.82)';
      ([[30,282,150,72],[210,300,120,54],[610,272,190,78],[850,304,130,50]] as [number, number, number, number][]).forEach(function (mass) {
        ctx!.fillRect(mass[0], mass[1], mass[2], mass[3]);
      });
      ctx.fillStyle = 'rgba(244,222,168,.68)'; ctx.fillRect(0, 326, 1024, 5);
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    glazingEnvMapCache = tex;
    return tex;
  }

  function buildGlazingFrameMaterial() {
    // Preto, metalness/roughness exatos do material "Perfis" do
    // modelo Blender de referência.
    return new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.4553571343421936, roughness: 0.5892857313156128 });
  }

  function buildGlazingGlassMaterial(settings: any) {
    // Vidro espelhado da fachada. Mantém metalness e roughness do
    // material "Material.001" do GLB, mas não aplica seu alpha: no
    // ambiente claro do Esboce ele deixava o painel praticamente
    // invisível. A presença de vidro vem do reflexo forte e da
    // rugosidade muito baixa, não da transparência física.
    var resolved = settings || DEFAULT_GLAZING_GLASS_MATERIAL;
    var opacity = Math.max(0.1, Math.min(1, Number(resolved.opacity)));
    return new THREE.MeshPhysicalMaterial({
      // Metalness absoluto fica preto quando a cena não tem um HDRI com
      // energia suficiente. A mistura abaixo conserva o reflexo, mas
      // devolve uma pequena parcela difusa/ambiente para o vidro nunca
      // desaparecer em ângulos escuros.
      color: new THREE.Color(resolved.color),
      metalness: Math.max(0, Math.min(1, Number(resolved.metalness))),
      roughness: Math.max(0, Math.min(1, Number(resolved.roughness))),
      envMap: getGlazingEnvMap(), envMapIntensity: Math.max(0, Math.min(3, Number(resolved.reflectionIntensity))),
      clearcoat: 1, clearcoatRoughness: Math.max(0, Math.min(0.25, Number(resolved.roughness) * 0.5)),
      emissive: new THREE.Color(0.025, 0.045, 0.055), emissiveIntensity: 0.18,
      transparent: opacity < 0.999, opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: opacity >= 0.999,
    });
  }

  // Monta o grid 2D completo (moldura de contorno + perfis internos +
  // vidros) num Group Three.js, em coordenadas LOCAIS do próprio
  // painel: eixo X de -widthM/2 a +widthM/2 (centralizado), eixo Y de
  // 0 (base/soleira) a heightM (topo). Quem chama só precisa
  // posicionar/rotacionar esse Group inteiro (como filho do hitMesh —
  // ver buildGlazingPanelPreviewMesh) — sem repetir a matemática do
  // grid em dois lugares.
  function buildGlazingPanelGroup(widthM: any, heightM: any, moduleTargetM: any, glassMaterial: any) {
    var group = new THREE.Group();
    var layout = computeGlazingLayout(widthM, heightM, moduleTargetM);
    var frameMat = buildGlazingFrameMaterial();
    var glassMat = buildGlazingGlassMaterial(glassMaterial);

    function addBar(cx: any, cyBottom: any, w: any, h: any) {
      var geo = new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), PROFILE_DEPTH_M);
      var m = new THREE.Mesh(geo, frameMat);
      m.position.set(cx, cyBottom + h / 2, 0);
      group.add(m);
    }

    // Moldura de contorno (4 barras). No modelo de referência do
    // usuário, moldura e travessa interna têm a MESMA largura — sem
    // diferenciação vertical/horizontal (ver Glazing.ts). Cantos
    // sobrepõem sem tratamento especial (mesmo material, a
    // sobreposição não aparece).
    addBar(0, 0, widthM, FRAME_WIDTH_M);
    addBar(0, heightM - FRAME_WIDTH_M, widthM, FRAME_WIDTH_M);
    addBar(-widthM / 2 + FRAME_WIDTH_M / 2, 0, FRAME_WIDTH_M, heightM);
    addBar(widthM / 2 - FRAME_WIDTH_M / 2, 0, FRAME_WIDTH_M, heightM);

    // Perfis verticais internos, um por fronteira entre colunas.
    var colX = -widthM / 2;
    for (var c = 0; c < layout.columns.count - 1; c++) {
      colX += layout.columns.moduleSizeM;
      addBar(colX, 0, MULLION_VERTICAL_WIDTH_M, heightM);
    }

    // Perfis horizontais internos, um por fronteira entre linhas.
    var rowY = 0;
    for (var r = 0; r < layout.rows.count - 1; r++) {
      rowY += layout.rows.moduleSizeM;
      addBar(0, rowY - MULLION_HORIZONTAL_WIDTH_M / 2, widthM, MULLION_HORIZONTAL_WIDTH_M);
    }

    // Vidros — um por célula do grid, com a junta de 10mm descontada
    // em todas as bordas (netGlassSizeM).
    var cw = layout.columns.moduleSizeM, rh = layout.rows.moduleSizeM;
    var glassW = netGlassSizeM(cw), glassH = netGlassSizeM(rh);
    // O GLB de referência traz todos os quatro vidros numa única malha.
    // Mantemos a mesma característica com InstancedMesh: um único draw
    // transparente evita que o Three.js reordene cada célula de maneira
    // diferente quando a câmera passa de frente para trás do painel.
    var glassGeo = new THREE.BoxGeometry(Math.max(glassW, 0.001), Math.max(glassH, 0.001), 0.01);
    var glassCount = layout.columns.count * layout.rows.count;
    var glassInstances = new THREE.InstancedMesh(glassGeo, glassMat, glassCount);
    var glassMatrix = new THREE.Matrix4();
    var glassIndex = 0;
    for (var ci = 0; ci < layout.columns.count; ci++) {
      for (var ri = 0; ri < layout.rows.count; ri++) {
        glassMatrix.makeTranslation(-widthM / 2 + cw * ci + cw / 2, rh * ri + rh / 2, 0);
        glassInstances.setMatrixAt(glassIndex++, glassMatrix);
      }
    }
    glassInstances.instanceMatrix.needsUpdate = true;
    glassInstances.renderOrder = 1;
    group.add(glassInstances);

    return group;
  }

  function buildGlazingPanelPreviewMesh(panel: any, scale: any, offsetX: any, offsetY: any, yOffset: any) {
    // hitMesh: box invisível que pickMesh/arraste enxergam e movem
    // (THREE.Mesh direto filho da cena — pickMesh não reconhece Group
    // nem recursa em filhos). O grid de verdade entra como FILHO dele,
    // então acompanha posição/rotação automaticamente pelo grafo de
    // cena do Three.js, sem duplicar a lógica de arraste em dois
    // lugares.
    var hitGeo = new THREE.BoxGeometry(panel.widthM, panel.heightM, PROFILE_DEPTH_M);
    var hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    var hitMesh = new THREE.Mesh(hitGeo, hitMat);
    var group = buildGlazingPanelGroup(panel.widthM, panel.heightM, panel.moduleTargetM, panel.glassMaterial);
    group.position.set(0, -panel.heightM / 2, 0);
    hitMesh.add(group);
    var px = ((panel.x || 0) - offsetX) * scale, pz = ((panel.y || 0) - offsetY) * scale;
    hitMesh.position.set(px, yOffset + panel.heightM / 2, pz);
    hitMesh.rotation.y = -((panel.rotationDeg || 0) * Math.PI / 180);
    return hitMesh;
  }

  // Painel já encostado (state 'attached') — mesma matemática de
  // posicionamento ao longo da parede usada por buildOpeningPieces
  // (offsetM em metros -> unidades de modelo pelo GRID, depois escala
  // pra cena) — mesmo esquema de hitMesh invisível + grid como filho
  // (ver buildGlazingPanelPreviewMesh). yOffset já inclui a altura do
  // pavimento; sillHeightM soma a altura da base do painel acima do
  // piso desse pavimento.
  function buildGlazingPanelAttachedMesh(panel: any, wall: any, scale: any, offsetX: any, offsetY: any, yOffset: any) {
    var dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    var lenModel = Math.hypot(dx, dy) || 1e-6;
    var ux = dx / lenModel, uy = dy / lenModel;
    var offsetModel = (panel.offsetM || 0) * Core.GRID;
    var cxModel = wall.x1 + ux * offsetModel, cyModel = wall.y1 + uy * offsetModel;
    var hitGeo = new THREE.BoxGeometry(panel.widthM, panel.heightM, PROFILE_DEPTH_M);
    var hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    var hitMesh = new THREE.Mesh(hitGeo, hitMat);
    var group = buildGlazingPanelGroup(panel.widthM, panel.heightM, panel.moduleTargetM, panel.glassMaterial);
    group.position.set(0, -panel.heightM / 2, 0);
    hitMesh.add(group);
    var px = (cxModel - offsetX) * scale, pz = (cyModel - offsetY) * scale;
    var sill = panel.sillHeightM || 0;
    hitMesh.position.set(px, yOffset + sill + panel.heightM / 2, pz);
    hitMesh.rotation.y = -Math.atan2(uy, ux);
    return hitMesh;
  }

  // Bloco de Volumetria (fachada procedural) — box sólido simples.
  // Diferente do painel de Envidraçamento, não recorta nenhuma banda
  // da parede: é um volume que só se ENCOSTA e protrai pra fora,
  // igual um caixilho saliente/bay window/ornamento de massa. Mesma
  // técnica de hitMesh invisível + malha de verdade como filho (pick/
  // arraste enxergam o hitMesh, a malha visual acompanha sozinha).
  // Planta baixa importada — um plano texturizado deitado no chão,
  // MESMA técnica do plano de grama fixo (EsboceApplication.ts:
  // PlaneGeometry + rotation.x), só que com a imagem importada como
  // textura em vez de grama, na altura do pavimento sendo editado.
  // Sem tag de categoria (nunca entra em pickMesh/targets) — de
  // propósito: assim o clique da ferramenta de parede/cômodo atravessa
  // a planta normalmente pro plano matemático do chão (mesmo raycasting
  // que já atravessa a grama hoje, ver ViewportController.
  // getGroundModelPoint), sem risco de "roubar" o clique de desenho.
  // Mover/girar/escalar acontece só pelos botões do gizmo dedicado.
  function getPlanUnderlayTexture(imageDataUrl: string) {
    if (planUnderlayTextureCache && planUnderlayTextureCache.key === imageDataUrl) {
      return planUnderlayTextureCache.texture;
    }
    if (planUnderlayTextureCache) planUnderlayTextureCache.texture.dispose();
    var tex = new THREE.TextureLoader().load(imageDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    planUnderlayTextureCache = { key: imageDataUrl, texture: tex };
    return tex;
  }

  function buildPlanUnderlayMesh(underlay: any, scale: any, offsetX: any, offsetY: any, yOffset: any) {
    var geo = new THREE.PlaneGeometry(underlay.widthM, underlay.heightM);
    var mat = new THREE.MeshBasicMaterial({
      map: getPlanUnderlayTexture(underlay.imageDataUrl),
      transparent: true, opacity: underlay.opacity != null ? underlay.opacity : 0.65,
      side: THREE.DoubleSide, depthWrite: false,
    });
    mat.userData.sharedMap = true;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = (underlay.rotationDeg || 0) * Math.PI / 180;
    var px = ((underlay.x || 0) - offsetX) * scale, pz = ((underlay.y || 0) - offsetY) * scale;
    // Um pouco acima do plano de grama (y=-0.01) e da laje/piso (y=0),
    // pra não brigar em z-fighting com nenhum dos dois.
    mesh.position.set(px, yOffset + 0.002, pz);
    mesh.renderOrder = -1;
    return mesh;
  }

  // Bloco de Volumetria (fachada procedural) — box sólido simples.
  // Diferente do painel de Envidraçamento, não recorta nenhuma banda
  // da parede: é um volume que só se ENCOSTA e protrai pra fora,
  // igual um caixilho saliente/bay window/ornamento de massa. Mesma
  // técnica de hitMesh invisível + malha de verdade como filho (pick/
  // arraste enxergam o hitMesh, a malha visual acompanha sozinha).
  function buildVolumeBoxMesh(box: any) {
    var geo = new THREE.BoxGeometry(box.widthM, box.heightM, box.depthM);
    var color = box.colorHex || Core.VOLUME_BOX_DEFAULT_COLOR;
    var mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.85, metalness: 0.05 });
    var mesh = new THREE.Mesh(geo, mat);
    var edges = new THREE.EdgesGeometry(geo);
    var edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
    var group = new THREE.Group();
    group.add(mesh); group.add(edgeLines);
    return group;
  }

  function buildVolumeBoxPreviewMesh(box: any, scale: any, offsetX: any, offsetY: any, yOffset: any) {
    var hitGeo = new THREE.BoxGeometry(box.widthM, box.heightM, box.depthM);
    var hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    var hitMesh = new THREE.Mesh(hitGeo, hitMat);
    var group = buildVolumeBoxMesh(box);
    hitMesh.add(group);
    var px = ((box.x || 0) - offsetX) * scale, pz = ((box.y || 0) - offsetY) * scale;
    hitMesh.position.set(px, yOffset + box.heightM / 2, pz);
    hitMesh.rotation.y = -((box.rotationDeg || 0) * Math.PI / 180);
    return hitMesh;
  }

  // Volume já encostado (state 'attached') — nasce na face da parede
  // (metade da espessura dela a partir do eixo) e protrai depthM pra
  // fora, no lado indicado por normalSign (decidido uma vez no
  // momento do encosto — ver Store.commands.attachVolumeBoxToWall).
  function buildVolumeBoxAttachedMesh(box: any, wall: any, scale: any, offsetX: any, offsetY: any, yOffset: any) {
    var dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    var lenModel = Math.hypot(dx, dy) || 1e-6;
    var ux = dx / lenModel, uy = dy / lenModel;
    var nx = -uy, ny = ux; // normal unitária, perpendicular ao eixo da parede
    var sign = box.normalSign === -1 ? -1 : 1;
    var offsetModel = (box.offsetM || 0) * Core.GRID;
    var alongX = wall.x1 + ux * offsetModel, alongY = wall.y1 + uy * offsetModel;
    var faceDistM = (Core.WALL_THICK / 2) + (box.depthM / 2);
    var cxModel = alongX + nx * sign * faceDistM * Core.GRID;
    var cyModel = alongY + ny * sign * faceDistM * Core.GRID;
    var hitGeo = new THREE.BoxGeometry(box.widthM, box.heightM, box.depthM);
    var hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    var hitMesh = new THREE.Mesh(hitGeo, hitMat);
    var group = buildVolumeBoxMesh(box);
    hitMesh.add(group);
    var px = (cxModel - offsetX) * scale, pz = (cyModel - offsetY) * scale;
    var sill = box.sillHeightM || 0;
    hitMesh.position.set(px, yOffset + sill + box.heightM / 2, pz);
    // A caixa (BoxGeometry) é simétrica no eixo local Z (profundidade)
    // — quem decide pra que lado ela protrai é só a translação acima
    // (cxModel/cyModel já deslocados por normalSign), não a rotação.
    // A rotação só precisa alinhar a largura da caixa com o eixo da
    // parede, mesma fórmula do painel de Envidraçamento.
    hitMesh.rotation.y = -Math.atan2(uy, ux);
    return hitMesh;
  }

  // Laje: nasce automática por cômodo fechado, mesmo contorno inset já
  // calculado pro piso (insetPoints/shape) — só muda a altura (topo da
  // parede, não a base) e a espessura/textura real de laje. Substitui
  // buildLajePiece (objeto independente arrastável, ver DEC-35) — não
  // existe mais objeto Laje solto; a laje é 100% derivada da geometria
  // do cômodo, do mesmo jeito que o piso sempre foi (correção
  // pós-lançamento, ver DEC-85 e a sessão sobre laje de entrepiso).
  function buildAutoLajePiece(shape: any, sizeX: any, sizeZ: any, topY: any, wallColor: any, viewState: any) {
    var color = pickColor(wallColor, 'laje', viewState);
    var mat = buildParapetSegmentMaterial(color, LAJE_THICKNESS, LAJE_THICKNESS, Math.max(sizeX, sizeZ));
    mat.side = THREE.DoubleSide;
    var geo = new THREE.ExtrudeGeometry(shape, { depth: LAJE_THICKNESS, bevelEnabled: false });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    // makeSlabMesh (de onde essa técnica foi copiada) trata "topY" como
    // a SUPERFÍCIE DE CIMA, extrudindo pra BAIXO a partir dali — certo
    // pro piso (que fica embutido no chão). Laje é o oposto: precisa
    // ficar EM CIMA da parede, subindo a partir do topo dela — por
    // isso soma LAJE_THICKNESS aqui, senão a laje nascia enterrada
    // dentro do topo da parede em vez de apoiada em cima dela.
    mesh.position.y = topY + LAJE_THICKNESS;
    var edges = new THREE.EdgesGeometry(geo);
    var edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
    edgeLines.rotation.copy(mesh.rotation);
    edgeLines.position.copy(mesh.position);
    return [mesh, edgeLines];
  }

  var VARANDA_SLAB_THICK = 0.12;
  // Colunas e vigas com a MESMA seção — 20x35cm — em vez do
  // Core.COLUMN_SIZE quadrado de 30cm usado pelas colunas comuns; a
  // varanda pede algo mais fino, coerente entre os dois elementos.
  var VARANDA_STRUCT_W = 0.20, VARANDA_STRUCT_H = 0.35;

  // Os 4 cantos do retângulo do piso, separados em "frente" (onde as
  // colunas vão, na ordem c1/c2) e o par de cantos de trás
  // correspondente (onde cada viga lateral termina — c1 liga com b1,
  // c2 com b2, sempre no mesmo lado, nunca cruzado).
  function varandaCorners(bounds: any, frontSide: any) {
    var minX = bounds.minX, maxX = bounds.maxX, minZ = bounds.minZ, maxZ = bounds.maxZ;
    if (frontSide === 'maxZ') return { c1: { x: minX, z: maxZ }, c2: { x: maxX, z: maxZ }, b1: { x: minX, z: minZ }, b2: { x: maxX, z: minZ } };
    if (frontSide === 'minX') return { c1: { x: minX, z: minZ }, c2: { x: minX, z: maxZ }, b1: { x: maxX, z: minZ }, b2: { x: maxX, z: maxZ } };
    if (frontSide === 'maxX') return { c1: { x: maxX, z: minZ }, c2: { x: maxX, z: maxZ }, b1: { x: minX, z: minZ }, b2: { x: minX, z: maxZ } };
    return { c1: { x: minX, z: minZ }, c2: { x: maxX, z: minZ }, b1: { x: minX, z: maxZ }, b2: { x: maxX, z: maxZ } }; // 'minZ', padrão
  }

  // Varanda: piso (mesma técnica de laje já usada em cômodo/platibanda)
  // + 2 colunas na frente + 3 vigas aéreas formando um U aberto (duas
  // laterais indo até a borda de trás do piso — SEMPRE, mesmo sem
  // parede ali, decisão explícita — e uma frontal ligando as colunas).
  function buildVarandaPiece(varanda: any, scale: any, offsetX: any, offsetY: any, floorTopY: any, viewState: any) {
    var bounds = {
      minX: (varanda.x1 - offsetX) * scale, maxX: (varanda.x2 - offsetX) * scale,
      minZ: (varanda.y1 - offsetY) * scale, maxZ: (varanda.y2 - offsetY) * scale
    };
    var MIN_SPAN = 0.3;
    var validBounds = isFinite(bounds.minX) && isFinite(bounds.maxX) && isFinite(bounds.minZ) && isFinite(bounds.maxZ)
      && (bounds.maxX - bounds.minX) > MIN_SPAN && (bounds.maxZ - bounds.minZ) > MIN_SPAN;
    if (!validBounds) return [];

    var meshes: any[] = [];
    var structColor = pickColor(0xA6A49A, 'varanda', viewState); // mesmo cinza-claro já usado nas colunas comuns
    var slabColor = pickColor(0xC7C2B4, 'varanda', viewState); // tom neutro de piso externo

    meshes.push(makeSlabMesh(rectShape(bounds), VARANDA_SLAB_THICK, floorTopY, slabColor, 1));

    var corners = varandaCorners(bounds, varanda.frontSide);
    var beamY = floorTopY + WALL_HEIGHT;

    function columnMesh(p: any) {
      var geo = new THREE.BoxGeometry(VARANDA_STRUCT_W, WALL_HEIGHT, VARANDA_STRUCT_H);
      var mat = new THREE.MeshStandardMaterial({ color: structColor, flatShading: true });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, floorTopY + WALL_HEIGHT / 2, p.z);
      return mesh;
    }
    function beamMesh(p1: any, p2: any) {
      var dx = p2.x - p1.x, dz = p2.z - p1.z, len = Math.hypot(dx, dz);
      var geo = new THREE.BoxGeometry(len + VARANDA_STRUCT_W, VARANDA_STRUCT_H, VARANDA_STRUCT_W);
      var mat = new THREE.MeshStandardMaterial({ color: structColor, flatShading: true });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((p1.x + p2.x) / 2, beamY, (p1.z + p2.z) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      return mesh;
    }

    meshes.push(columnMesh(corners.c1));
    meshes.push(columnMesh(corners.c2));
    meshes.push(beamMesh(corners.c1, corners.c2)); // viga frontal
    meshes.push(beamMesh(corners.c1, corners.b1)); // viga lateral 1
    meshes.push(beamMesh(corners.c2, corners.b2)); // viga lateral 2
    return meshes;
  }

  function makeSlabMesh(shape: any, thickness: any, topY: any, color: any, opacity: any, polyOffset?: any, texture?: THREE.Texture | null) {
    var geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    var matOpts: any = { color: color, map: texture || null, side: THREE.DoubleSide, transparent: opacity < 1, opacity: opacity };
    // Onde a borda da laje é EXATAMENTE coplanar com a face de uma
    // parede vizinha (ex.: o piso do cômodo, que agora encosta exato na
    // face corrigida da parede — nunca mais no eixo), as duas brigam
    // pelo mesmo pixel de profundidade sem esse viés — o clássico
    // z-fighting, visto como uma fresta/tremulação na costura.
    if (polyOffset) { matOpts.polygonOffset = true; matOpts.polygonOffsetFactor = 4; matOpts.polygonOffsetUnits = 1; }
    var mat = new THREE.MeshStandardMaterial(matOpts);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = topY;
    return mesh;
  }

  // Rodapé — faixa vertical de 10cm de altura, colada na face interna
  // das paredes do cômodo, no MESMO contorno já resolvido pro piso
  // (insetPoints — face real da parede, não o eixo). Um segmento reto
  // por trecho do contorno, igual à filosofia de parede da DEC-12: cada
  // segmento se sobrepõe um pouco no canto, sem juntas matemáticas —
  // suficiente pra um detalhe fino de acabamento. UV em METROS reais
  // (distância acumulada ao longo do perímetro x altura) — mesma
  // convenção do piso (ExtrudeGeometry gera UV em unidade de mundo, não
  // normalizada 0-1), pra a textura cerâmica (buildCeramicTexture) bater
  // no mesmo passo de fuga do piso em vez de esticar/repetir errado.
  //
  // insetWallIds: mesmo índice de insetPoints — qual parede originou
  // cada ponto do contorno (ver rooms.forEach mais abaixo). Usado só
  // pra achar aberturas que chegam ao chão (porta, ou arco sem
  // peitoril) e pular o trecho do rodapé onde elas estão — não faz
  // sentido rodapé atravessando um vão aberto.
  function computeBaseboardSkipIntervals(wallId: any, wallsList: any[], openingsList: any[], p1: any, p2: any) {
    if (!wallId) return [];
    var wall: any = null;
    for (var i = 0; i < wallsList.length; i++) if (wallsList[i].id === wallId) { wall = wallsList[i]; break; }
    if (!wall) return [];
    // Parede quebrada (Wall.demolished) — o trecho inteiro vira vão
    // aberto, mesmo raciocínio de uma porta/arco que chega ao chão
    // (abaixo), só que cobrindo 100% do comprimento em vez de um
    // intervalo. Sem essa checagem, o rodapé (e o contorno preto do
    // piso, que reaproveita os MESMOS intervalos — ver comentário da
    // função) continuavam desenhando ao longo de uma parede que nem
    // aparece mais.
    if (wall.demolished) return [[0, 1]];
    var offset1 = Core.wallOffsetAtPoint(wall, p1.x, p1.y);
    var offset2 = Core.wallOffsetAtPoint(wall, p2.x, p2.y);
    var span = offset2 - offset1;
    if (Math.abs(span) < 1e-6) return [];
    var intervals: any[] = [];
    (openingsList || []).forEach(function (op: any) {
      if (op.wallId !== wallId) return;
      if (op.sillHeight > 0.02) return; // só vãos que chegam ao chão interrompem o rodapé
      var oLo = op.offset - op.width / 2, oHi = op.offset + op.width / 2;
      var tA = (oLo - offset1) / span, tB = (oHi - offset1) / span;
      var tStart = Math.max(0, Math.min(1, Math.min(tA, tB)));
      var tEnd = Math.max(0, Math.min(1, Math.max(tA, tB)));
      if (tEnd > tStart + 1e-6) intervals.push([tStart, tEnd]);
    });
    intervals.sort(function (a: any, b: any) { return a[0] - b[0]; });
    return intervals;
  }

  // A partir dos intervalos BLOQUEADOS (0..1), devolve os intervalos
  // LIVRES complementares — onde o rodapé realmente deve ser desenhado.
  function invertIntervals(skip: any[]) {
    var free: any[] = [];
    var cursor = 0;
    skip.forEach(function (iv: any) {
      if (iv[0] > cursor + 1e-6) free.push([cursor, iv[0]]);
      cursor = Math.max(cursor, iv[1]);
    });
    if (cursor < 1 - 1e-6) free.push([cursor, 1]);
    return free;
  }

  // Contorno preto do piso do cômodo — antes vinha de THREE.EdgesGeometry
  // em cima da malha extrudada inteira, sem noção nenhuma de abertura:
  // desenhava a linha atravessando o vão de qualquer arco/porta no nível
  // do chão. Como o vão fica aberto (sem parede cobrindo), essa linha
  // sobrava visível flutuando no ar — os "riscos" no meio do arco.
  // Reaproveita os MESMOS intervalos de corte do rodapé (mesma regra:
  // peitoril ≤ 2cm interrompe) pra pular o trecho certo.
  function buildRoomFloorOutline(insetPoints: any[], insetWallIds: any[], wallsList: any[], openingsList: any[], offsetX: number, offsetY: number, scale: number, y: number) {
    var n = insetPoints.length;
    var verts: number[] = [];
    for (var i = 0; i < n; i++) {
      var p1 = insetPoints[i], p2 = insetPoints[(i + 1) % n];
      var wx1 = (p1.x - offsetX) * scale, wz1 = (p1.y - offsetY) * scale;
      var wx2 = (p2.x - offsetX) * scale, wz2 = (p2.y - offsetY) * scale;
      var skip = computeBaseboardSkipIntervals(insetWallIds[i], wallsList, openingsList, p1, p2);
      var freeRanges = skip.length ? invertIntervals(skip) : [[0, 1]];
      freeRanges.forEach(function (range: any) {
        var f0 = range[0], f1 = range[1];
        var sx1 = wx1 + (wx2 - wx1) * f0, sz1 = wz1 + (wz2 - wz1) * f0;
        var sx2 = wx1 + (wx2 - wx1) * f1, sz2 = wz1 + (wz2 - wz1) * f1;
        verts.push(sx1, y, sz1, sx2, y, sz2);
      });
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
  }

  // Soleira — fecha o buraco que sobra no piso quando um arco (ou
  // qualquer abertura no nível do chão) corta uma parede ENTRE dois
  // cômodos. O piso de cada cômodo sempre para exatamente na face
  // interna da própria parede (nunca invade a espessura dela — ver
  // comentário logo acima do insetPoints) porque normalmente é a
  // parede que cobre essa faixa. Com um vão aberto ali, sobra uma
  // fresta do tamanho da espessura da parede, à mostra.
  //
  // Tentativa anterior recortava a soleira só na largura do vão,
  // interpolando o canto em linha reta — perto da ponta da parede isso
  // diverge da matemática de canto real (computeWallFootprints leva em
  // conta parede vizinha, corte de esquadro etc.) e abria uma frincha
  // visível. Corrigido: a soleira cobre a parede INTEIRA, usando os
  // MESMOS 4 cantos (p1a/p1b/p2a/p2b) que o piso do cômodo também usa
  // pra fechar contra essa parede — não uma aproximação, é o mesmo
  // ponto de dado. Fora do vão, fica escondida embaixo da parede
  // sólida, sem efeito nenhum; só aparece onde realmente há abertura.
  //
  // Só é chamada quando os DOIS lados têm cômodo (arco/porta ENTRE
  // cômodos) — pro lado que dá pra área externa, uma peça de soleira de
  // verdade (buildExteriorSoleira, logo abaixo) resolve melhor: soleira
  // de verdade é uma peça própria, com relevo e material diferente do
  // piso — não é o piso "esticando" por cima da parede. Tentativa
  // anterior de fazer o piso alcançar a face externa também deu
  // z-fighting com a aba da fundação (que fica bem perto do nível do
  // piso ali); virar peça própria, mais alta, evita esse problema de
  // vez, além de ficar mais fiel à realidade construtiva.
  function buildThresholdSlab(wall: any, wallFootprintsMap: any, yOffset: any, offsetX: any, offsetY: any, scale: any) {
    var fp = wallFootprintsMap[wall.id];
    if (!fp) return null;
    var shape = new THREE.Shape();
    [fp.p1a, fp.p2a, fp.p2b, fp.p1b].forEach(function (p: any, i: any) {
      var wx = (p.x - offsetX) * scale, wz = (p.y - offsetY) * scale;
      if (i === 0) shape.moveTo(wx, wz); else shape.lineTo(wx, wz);
    });
    shape.closePath();
    var thickness = 0.03;
    var product = Catalog.getProduct(DEFAULT_FLOOR_FINISH_ID);
    var colorHex = product ? parseInt(product.assets.colorHex.slice(1), 16) : 0xCFE8CF;
    var texture = product ? buildCeramicTexture(product.assets.colorHex, 1, 0) : null;
    return makeSlabMesh(shape, thickness, yOffset + thickness, colorHex, 1, true, texture);
  }

  // Soleira externa — peça de VERDADE (não o piso esticando por cima da
  // parede): elevada alguns milímetros acima do piso, material de pedra
  // distinto da cerâmica padrão, só na largura do vão (igual soleira
  // real de porta/varanda pra fora). O nível dela fica bem acima de
  // onde a aba da fundação vive (y ≈ -5mm), então não conflita com ela.
  var SOLEIRA_RISE = 0.02; // 2cm acima do piso — típico de soleira externa
  var SOLEIRA_PROTRUSION = 0.03; // avança 3cm além de cada face da parede
  function buildExteriorSoleira(wall: any, opening: any, yOffset: any, offsetX: any, offsetY: any, scale: any) {
    var wdx = wall.x2 - wall.x1, wdy = wall.y2 - wall.y1;
    var wlen = Math.hypot(wdx, wdy) || 1e-6;
    var ux = wdx / wlen, uy = wdy / wlen;
    var nx = -uy, ny = ux;
    var t0M = (opening.offset - opening.width / 2) * Core.GRID;
    var t1M = (opening.offset + opening.width / 2) * Core.GRID;
    var baseX0 = wall.x1 + ux * t0M, baseY0 = wall.y1 + uy * t0M;
    var baseX1 = wall.x1 + ux * t1M, baseY1 = wall.y1 + uy * t1M;
    var halfSpan = (Core.WALL_THICK / 2 + SOLEIRA_PROTRUSION) * Core.GRID;
    var corners = [
      { x: baseX0 + nx * halfSpan, y: baseY0 + ny * halfSpan },
      { x: baseX1 + nx * halfSpan, y: baseY1 + ny * halfSpan },
      { x: baseX1 - nx * halfSpan, y: baseY1 - ny * halfSpan },
      { x: baseX0 - nx * halfSpan, y: baseY0 - ny * halfSpan }
    ];
    var shape = new THREE.Shape();
    corners.forEach(function (p: any, i: any) {
      var wx = (p.x - offsetX) * scale, wz = (p.y - offsetY) * scale;
      if (i === 0) shape.moveTo(wx, wz); else shape.lineTo(wx, wz);
    });
    shape.closePath();
    var pisoTopY = yOffset + 0.03;
    var marbleMaps = getSoleiraMarbleMaps();
    var mat = new THREE.MeshStandardMaterial({
      map: marbleMaps.map,
      normalMap: marbleMaps.normalMap,
      roughnessMap: marbleMaps.roughnessMap,
      roughness: 0.55,
      normalScale: new THREE.Vector2(0.6, 0.6),
      flatShading: false
    });
    var geo = new THREE.ExtrudeGeometry(shape, { depth: SOLEIRA_RISE, bevelEnabled: false });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = pisoTopY + SOLEIRA_RISE;
    return mesh;
  }

  function buildRoomBaseboardMesh(insetPoints: any[], insetWallIds: any[], wallsList: any[], openingsList: any[], centerX: number, centerY: number, offsetX: number, offsetY: number, scale: number, y0: number, color: any, texture: THREE.Texture | null) {
    var HEIGHT_M = 0.10; // altura fixa do rodapé, 10cm
    var DEPTH_M = 0.015; // quanto avança pra dentro do cômodo — não especificado, valor típico de mercado
    var y1 = y0 + HEIGHT_M; // vertical já é metro direto, sem o fator scale (esse só vale pra X/Z)
    var verts: number[] = [];
    var uvs: number[] = [];
    function quad(a: number[], b: number[], c: number[], d: number[], uvA: number[], uvB: number[], uvC: number[], uvD: number[]) {
      [[a, uvA], [b, uvB], [c, uvC], [a, uvA], [c, uvC], [d, uvD]].forEach(function (pair) {
        var v = pair[0]!, uv = pair[1]!;
        verts.push(v[0]!, v[1]!, v[2]!);
        uvs.push(uv[0]!, uv[1]!);
      });
    }
    var n = insetPoints.length;
    var cWx = (centerX - offsetX) * scale, cWz = (centerY - offsetY) * scale;
    var distAccum = 0;
    for (var i = 0; i < n; i++) {
      var p1 = insetPoints[i], p2 = insetPoints[(i + 1) % n];
      var wx1 = (p1.x - offsetX) * scale, wz1 = (p1.y - offsetY) * scale;
      var wx2 = (p2.x - offsetX) * scale, wz2 = (p2.y - offsetY) * scale;
      var dx = wx2 - wx1, dz = wz2 - wz1;
      var len = Math.hypot(dx, dz) || 1e-6;
      var nx = -dz / len, nz = dx / len;
      // Garante que a normal aponta pra DENTRO do cômodo (em direção ao
      // centroide) — sem isso metade dos trechos nasceria virada pro
      // lado errado, atravessando a parede.
      var midX = (wx1 + wx2) / 2, midZ = (wz1 + wz2) / 2;
      if ((cWx - midX) * nx + (cWz - midZ) * nz < 0) { nx = -nx; nz = -nz; }
      var depth = DEPTH_M * scale;

      var skip = computeBaseboardSkipIntervals(insetWallIds[i], wallsList, openingsList, p1, p2);
      var freeRanges = skip.length ? invertIntervals(skip) : [[0, 1]];
      freeRanges.forEach(function (range: any) {
        var f0 = range[0], f1 = range[1];
        var swx1 = wx1 + dx * f0, swz1 = wz1 + dz * f0;
        var swx2 = wx1 + dx * f1, swz2 = wz1 + dz * f1;
        var six1 = swx1 + nx * depth, siz1 = swz1 + nz * depth;
        var six2 = swx2 + nx * depth, siz2 = swz2 + nz * depth;
        var outerBase1 = [swx1, y0, swz1], outerBase2 = [swx2, y0, swz2];
        var innerBase1 = [six1, y0, siz1], innerBase2 = [six2, y0, siz2];
        var outerTop1 = [swx1, y1, swz1], outerTop2 = [swx2, y1, swz2];
        var innerTop1 = [six1, y1, siz1], innerTop2 = [six2, y1, siz2];
        var su0 = distAccum + len * f0, su1 = distAccum + len * f1;
        quad(outerBase1, outerBase2, outerTop2, outerTop1, [su0, 0], [su1, 0], [su1, HEIGHT_M], [su0, HEIGHT_M]); // face colada na parede
        quad(innerBase2, innerBase1, innerTop1, innerTop2, [su1, 0], [su0, 0], [su0, HEIGHT_M], [su1, HEIGHT_M]); // face voltada pro cômodo
        quad(outerTop1, outerTop2, innerTop2, innerTop1, [su0, 0], [su1, 0], [su1, DEPTH_M], [su0, DEPTH_M]);     // topo
      });
      distAccum += len;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ color: color, map: texture || null, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }

  function buildCeramicTexture(colorHex: string, scale: number, rotationDeg: number) {
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d')!;
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(70,70,66,0.42)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 125);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, 120, 120);
    var texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    var safeScale = Math.max(0.25, Math.min(4, scale || 1));
    texture.repeat.set(2 / safeScale, 2 / safeScale);
    texture.center.set(0.5, 0.5);
    texture.rotation = (rotationDeg || 0) * Math.PI / 180;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function rectShape(bounds: any) {
    var shape = new THREE.Shape();
    shape.moveTo(bounds.minX, bounds.minZ);
    shape.lineTo(bounds.maxX, bounds.minZ);
    shape.lineTo(bounds.maxX, bounds.maxZ);
    shape.lineTo(bounds.minX, bounds.maxZ);
    shape.closePath();
    return shape;
  }

  function buildPerimeterFrameShape(bounds: any, outwardWidth: any) {
    var shape = new THREE.Shape();
    shape.moveTo(bounds.minX - outwardWidth, bounds.minZ - outwardWidth);
    shape.lineTo(bounds.maxX + outwardWidth, bounds.minZ - outwardWidth);
    shape.lineTo(bounds.maxX + outwardWidth, bounds.maxZ + outwardWidth);
    shape.lineTo(bounds.minX - outwardWidth, bounds.maxZ + outwardWidth);
    shape.closePath();
    var hole = new THREE.Path();
    hole.moveTo(bounds.minX, bounds.minZ);
    hole.lineTo(bounds.maxX, bounds.minZ);
    hole.lineTo(bounds.maxX, bounds.maxZ);
    hole.lineTo(bounds.minX, bounds.maxZ);
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  }

  function buildInsetFrameShape(bounds: any, beamWidth: any) {
    var shape = new THREE.Shape();
    shape.moveTo(bounds.minX, bounds.minZ);
    shape.lineTo(bounds.maxX, bounds.minZ);
    shape.lineTo(bounds.maxX, bounds.maxZ);
    shape.lineTo(bounds.minX, bounds.maxZ);
    shape.closePath();
    var hole = new THREE.Path();
    hole.moveTo(bounds.minX + beamWidth, bounds.minZ + beamWidth);
    hole.lineTo(bounds.maxX - beamWidth, bounds.minZ + beamWidth);
    hole.lineTo(bounds.maxX - beamWidth, bounds.maxZ - beamWidth);
    hole.lineTo(bounds.minX + beamWidth, bounds.maxZ - beamWidth);
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  }

  function buildFoundationPiece(type: any, bounds: any, color: any) {
    if (type === 'baldrame') {
      // O eixo estrutural continua sob as paredes, mas uma aba externa de
      // 50 mm deixa a fundação identificável na vista 3D. Sem essa aba, a
      // parede ocultava integralmente o baldrame rebaixado sob o piso.
      var visibleBounds = {
        minX: bounds.minX - BALDRAME_OUTSET,
        maxX: bounds.maxX + BALDRAME_OUTSET,
        minZ: bounds.minZ - BALDRAME_OUTSET,
        maxZ: bounds.maxZ + BALDRAME_OUTSET
      };
      var shape = buildInsetFrameShape(visibleBounds, BALDRAME_WIDTH + BALDRAME_OUTSET);
      return makeSlabMesh(shape, BALDRAME_THICKNESS, -FOUNDATION_FLOOR_GAP, color, 1);
    }
    var radierShape = rectShape({
      minX: bounds.minX - RADIER_MARGIN, maxX: bounds.maxX + RADIER_MARGIN,
      minZ: bounds.minZ - RADIER_MARGIN, maxZ: bounds.maxZ + RADIER_MARGIN
    });
    return makeSlabMesh(radierShape, RADIER_THICKNESS, -FOUNDATION_FLOOR_GAP, color, 1);
  }

  // Os pontos de um cômodo (Core.detectRooms) são cruzamentos do EIXO das
  // paredes, não da face externa — por isso soma a meia-espessura aqui
  // também, senão qualquer coisa apoiada nesse contorno (fundação,
  // calçada, oitão do telhado) nasce faceada com o eixo, não com a
  // parede de verdade.
  function computeRoomWorldBounds(room: any, scale: any, offsetX: any, offsetY: any) {
    if (!room.points || !room.points.length) return null;
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    var wallHalf = WALL_THICK / 2;
    room.points.forEach(function (p: any) {
      var wx = (p.x - offsetX) * scale, wz = (p.y - offsetY) * scale;
      if (wx - wallHalf < minX) minX = wx - wallHalf; if (wx + wallHalf > maxX) maxX = wx + wallHalf;
      if (wz - wallHalf < minZ) minZ = wz - wallHalf; if (wz + wallHalf > maxZ) maxZ = wz + wallHalf;
    });
    return { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  }

  function buildFoundation(type: any, rooms: any, groundBounds: any, scale: any, offsetX: any, offsetY: any, viewState: any) {
    var color = pickColor(0x8A8578, 'fundacao', viewState);
    var meshes: any[] = [];
    if (rooms && rooms.length) {
      rooms.forEach(function (room: any) {
        var roomBounds = computeRoomWorldBounds(room, scale, offsetX, offsetY);
        if (roomBounds) meshes.push(buildFoundationPiece(type, roomBounds, color));
      });
    } else if (groundBounds) {
      meshes.push(buildFoundationPiece(type, groundBounds, color));
    }
    return meshes;
  }

  // Mesma lógica da fundação: uma calçada POR CÔMODO, seguindo o contorno
  // real da casa, em vez de um retângulo único que ocuparia o recuo entre
  // cômodos em L. Onde os cômodos são vizinhos, as calçadas se sobrepõem
  // e ficam visualmente contínuas.
  function buildCalcada(rooms: any, groundBounds: any, scale: any, offsetX: any, offsetY: any, viewState: any) {
    var color = pickColor(0x9C9A92, 'calcada', viewState);
    var meshes: any[] = [];
    if (rooms && rooms.length) {
      rooms.forEach(function (room: any) {
        var roomBounds = computeRoomWorldBounds(room, scale, offsetX, offsetY);
        if (!roomBounds) return;
        var shape = buildPerimeterFrameShape(roomBounds, CALCADA_WIDTH);
        meshes.push(makeSlabMesh(shape, CALCADA_THICKNESS, 0.03, color, 1));
      });
    } else if (groundBounds) {
      var shape2 = buildPerimeterFrameShape(groundBounds, CALCADA_WIDTH);
      meshes.push(makeSlabMesh(shape2, CALCADA_THICKNESS, 0.03, color, 1));
    }
    return meshes;
  }

  var EDGE_MARGIN = 0.05;

  function computeWorldBounds(walls: any, columns: any, scale: any, offsetX: any, offsetY: any) {
    if ((!walls || !walls.length) && (!columns || !columns.length)) return null;
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    var wallHalf = WALL_THICK / 2;
    (walls || []).forEach(function (w: any) {
      [[w.x1, w.y1], [w.x2, w.y2]].forEach(function (pt) {
        var wx = (pt[0] - offsetX) * scale, wz = (pt[1] - offsetY) * scale;
        if (wx - wallHalf < minX) minX = wx - wallHalf; if (wx + wallHalf > maxX) maxX = wx + wallHalf;
        if (wz - wallHalf < minZ) minZ = wz - wallHalf; if (wz + wallHalf > maxZ) maxZ = wz + wallHalf;
      });
    });
    var colHalf = (Core.COLUMN_SIZE / 2) * scale;
    (columns || []).forEach(function (c: any) {
      var wx = (c.x - offsetX) * scale, wz = (c.y - offsetY) * scale;
      if (wx - colHalf < minX) minX = wx - colHalf; if (wx + colHalf > maxX) maxX = wx + colHalf;
      if (wz - colHalf < minZ) minZ = wz - colHalf; if (wz + colHalf > maxZ) maxZ = wz + colHalf;
    });
    return { minX: minX - EDGE_MARGIN, maxX: maxX + EDGE_MARGIN, minZ: minZ - EDGE_MARGIN, maxZ: maxZ + EDGE_MARGIN };
  }

  // Libera geometria/material/textura de UM objeto (mesh ou linha) antes
  // de descartá-lo. Sem isso, m.parent.remove(m) só tira o objeto da
  // cena — os buffers continuam ocupando memória da GPU, porque o
  // WebGLRenderer só os libera quando dispose() é chamado explicitamente.
  // Como rebuild() roda a cada pointermove durante um arraste (eventos
  // "live"), sem isso o vazamento cresce muito rápido dentro de uma
  // sessão de edição e a página vai travando progressivamente.
  function disposeObject3D(obj: any) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose();
    var mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    mats.forEach(function (mat: any) {
      // A textura da planta baixa importada é cacheada fora do ciclo de
      // rebuild (ver getPlanUnderlayTexture) — sem essa flag, o
      // dispose() daqui destruiria a MESMA textura que o cache ainda
      // pretende reaproveitar no próximo rebuild, e a planta sumiria ou
      // corromperia na tela na primeira mudança de modelo depois de
      // importar.
      if (mat.map && !mat.userData?.sharedMap) mat.map.dispose();
      mat.dispose();
    });
  }

  function clearRegistry() {
    ['wallMeshes', 'roomMeshes', 'structureMeshes', 'previewMeshes', 'handleMeshes'].forEach(function (key) {
      registry[key]!.forEach(function (m) {
        m.parent && m.parent.remove(m);
        disposeObject3D(m);
      });
      registry[key] = [];
    });
    registry.furnitureMeshes.forEach(function (m) {
      m.parent && m.parent.remove(m);
      disposeObject3DTree(m);
    });
    registry.furnitureMeshes = [];
    registry.openingModelMeshes.forEach(function (m) {
      m.parent && m.parent.remove(m);
      disposeObject3DTree(m);
    });
    registry.openingModelMeshes = [];
  }

  function hydraulicColor(networkType: string) {
    if (networkType === 'cold_water') return 0x2f80ed;
    if (networkType === 'sanitary_sewer') return 0x8b5e3c;
    if (networkType === 'kitchen_sewer') return 0xd97706;
    return 0x7c3aed;
  }

  function hydraulicFixtureColor(networkType: string) {
    if (networkType === 'cold_water') return 0x39c6f4;
    if (networkType === 'sanitary_sewer') return 0xa66b45;
    if (networkType === 'kitchen_sewer') return 0xf59e0b;
    return hydraulicColor(networkType);
  }

  function hydraulicLabelSprite(label: string, color: number) {
    var canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    var ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.strokeStyle = '#d3d1c7'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(4, 4, 504, 88, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.beginPath(); ctx.arc(40, 48, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#302e2b'; ctx.font = '600 27px Arial'; ctx.textBaseline = 'middle';
    var text = label.length > 29 ? label.slice(0, 28) + '…' : label; ctx.fillText(text, 68, 49);
    var texture = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(2.45, 0.46, 1); sprite.renderOrder = 1000;
    return sprite;
  }

  function buildHydraulicSegment(start: any, end: any, segment: any, scale: number, offsetX: number, offsetY: number) {
    var a = new THREE.Vector3((start.x - offsetX) * scale, (start.floorIndex || 0) * FLOOR_STACK_HEIGHT + start.elevationM, (start.y - offsetY) * scale);
    var b = new THREE.Vector3((end.x - offsetX) * scale, (end.floorIndex || 0) * FLOOR_STACK_HEIGHT + end.elevationM, (end.y - offsetY) * scale);
    var direction = new THREE.Vector3().subVectors(b, a);
    var length = direction.length();
    var radiusM = Math.max(0.012, segment.diameterMm / 2000);
    var geometry = new THREE.CylinderGeometry(radiusM, radiusM, length, 14);
    var material = new THREE.MeshStandardMaterial({ color: hydraulicColor(segment.networkType), roughness: 0.38, metalness: 0.08 });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function renderHydraulics(scene: THREE.Scene, project: Project, scale: number, offsetX: number, offsetY: number, viewState: any) {
    if (!project.layers.instalacoes || !project.hydraulics) return;
    var nodes = new Map((project.hydraulics.nodes || []).map(function (node) { return [node.id, node]; }));
    (project.hydraulics.segments || []).forEach(function (segment) {
      var start = nodes.get(segment.startNodeId), end = nodes.get(segment.endNodeId);
      if (!start || !end) return;
      var mesh = buildHydraulicSegment(start, end, segment, scale, offsetX, offsetY);
      tagCategory(mesh, 'instalacoes');
      mesh.userData.hydraulicSegmentId = segment.id;
      scene.add(mesh);
      registry.structureMeshes.push(mesh);
    });
    (project.hydraulics.nodes || []).forEach(function (node) {
      var radius = node.kind === 'junction' ? 0.035 : node.kind === 'fixture' ? 0.07 : 0.055;
      var geometry = new THREE.SphereGeometry(radius, 18, 14);
      var selected = viewState && viewState.selectedHydraulicNode && viewState.selectedHydraulicNode.id === node.id;
      var baseColor = node.kind === 'fixture' ? hydraulicFixtureColor(node.networkType) : hydraulicColor(node.networkType);
      var marker = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: selected ? 0xf4a340 : baseColor, emissive: selected ? 0xf4a340 : baseColor, emissiveIntensity: selected ? 0.5 : 0.22, roughness: 0.32, depthTest: node.kind !== 'fixture' })
      );
      if (node.kind === 'fixture') marker.renderOrder = 900;
      var nodeFloorOffset = (node.floorIndex || 0) * FLOOR_STACK_HEIGHT;
      var hostWall = node.wallId ? project.floors.flatMap(function (floor) { return floor.walls; }).find(function (wall) { return wall.id === node.wallId; }) : undefined;
      var allProjectWalls = project.floors.flatMap(function (floor) { return floor.walls; });
      var visualPoint = node.kind === 'fixture' ? hydraulicFixtureVisualPosition(node, hostWall, allProjectWalls) : { x: node.x, y: node.y };
      marker.position.set((visualPoint.x - offsetX) * scale, nodeFloorOffset + node.elevationM, (visualPoint.y - offsetY) * scale);
      tagCategory(marker, 'instalacoes');
      marker.userData.hydraulicNodeId = node.id;
      marker.userData.floorIndex = node.floorIndex || 0;
      marker.userData.hydraulicEditable = (node.kind === 'fixture' && !!node.fixtureType) || (node.kind === 'junction' && !!node.ownerFixtureId);
      scene.add(marker);
      registry.structureMeshes.push(marker);
      if (node.kind === 'fixture' && node.fixtureType && selected) {
        var labelSprite = hydraulicLabelSprite(node.label, hydraulicFixtureColor(node.networkType));
        labelSprite.position.copy(marker.position); labelSprite.position.y += 0.28;
        labelSprite.userData.hydraulicNodeId = node.id;
        labelSprite.userData.floorIndex = node.floorIndex || 0;
        labelSprite.userData.hydraulicEditable = true;
        labelSprite.userData.hydraulicLabel = true;
        tagCategory(labelSprite, 'instalacoes');
        scene.add(labelSprite); registry.structureMeshes.push(labelSprite);
      }
      if (node.kind === 'source' && node.networkType === 'cold_water') {
        var tank = new THREE.Group();
        var tankMaterial = new THREE.MeshStandardMaterial({ color: 0x4f8fc4, roughness: 0.42, metalness: 0.04 });
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.46, 0.72, 28), tankMaterial);
        var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 28), tankMaterial);
        lid.position.y = 0.4;
        tank.add(body, lid);
        tank.position.set((node.x - offsetX) * scale, nodeFloorOffset + node.elevationM + 0.36, (node.y - offsetY) * scale);
        tank.userData.hydraulicNodeId = node.id;
        tank.userData.category = 'instalacoes';
        scene.add(tank);
        registry.structureMeshes.push(tank);
      }
    });
  }

  // Retângulo/parede em andamento (arrastando o mouse) — feedback visual
  // imediato, nunca escreve no modelo.
  function renderDrawPreview(scene: any, viewState: any, scale: any, offsetX: any, offsetY: any) {
    if (!viewState.drawPreview) return;
    var p = viewState.drawPreview; // { tool, x1,y1,x2,y2, yOffset }
    var color = 0x378ADD;
    if (p.tool === 'room') {
      var minX = Math.min(p.x1, p.x2), maxX = Math.max(p.x1, p.x2);
      var minY = Math.min(p.y1, p.y2), maxY = Math.max(p.y1, p.y2);
      var wMinX = (minX - offsetX) * scale, wMaxX = (maxX - offsetX) * scale;
      var wMinZ = (minY - offsetY) * scale, wMaxZ = (maxY - offsetY) * scale;
      var shape = new THREE.Shape();
      shape.moveTo(wMinX, wMinZ); shape.lineTo(wMaxX, wMinZ); shape.lineTo(wMaxX, wMaxZ); shape.lineTo(wMinX, wMaxZ); shape.closePath();
      var mesh = makeSlabMesh(shape, 0.03, p.yOffset + 0.03, color, 0.35);
      scene.add(mesh);
      registry.previewMeshes.push(mesh);
      var edges = new THREE.EdgesGeometry(mesh.geometry);
      var lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: color }));
      lines.rotation.copy(mesh.rotation); lines.position.copy(mesh.position);
      scene.add(lines);
      registry.previewMeshes.push(lines);
    } else if (p.tool === 'wall') {
      var x1 = (p.x1 - offsetX) * scale, z1 = (p.y1 - offsetY) * scale;
      var x2 = (p.x2 - offsetX) * scale, z2 = (p.y2 - offsetY) * scale;
      var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, p.yOffset + 0.05, z1), new THREE.Vector3(x2, p.yOffset + 0.05, z2)
      ]);
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color, linewidth: 2 }));
      scene.add(line);
      registry.previewMeshes.push(line);
    } else if (p.tool === 'telhado') {
      // grade plana na altura do topo da parede, mostrando exatamente o
      // contorno do cômodo que vai virar telhado — referência de escala
      // antes mesmo da forma inclinada aparecer por cima
      var fMinX = (p.x1 - offsetX) * scale, fMaxX = (p.x2 - offsetX) * scale;
      var fMinZ = (p.y1 - offsetY) * scale, fMaxZ = (p.y2 - offsetY) * scale;
      var gridLines = buildFootprintGridLines(fMinX, fMaxX, fMinZ, fMaxZ, p.yOffset + WALL_HEIGHT + 0.01, color);
      scene.add(gridLines);
      registry.previewMeshes.push(gridLines);

      // prévia de verdade (a mesma geometria que vai nascer), só translúcida.
      // Sem acesso ao projeto inteiro aqui (só o preview em si) — usa o
      // GABLE_COLOR padrão; a cor certa (acabamento real da casa) entra
      // assim que o telhado é efetivamente colocado, em buildRoofPiece
      // via rebuild().
      var ghostRoof = { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, type: p.roofType, pitchDeg: p.pitchDeg, ridgeAxis: p.ridgeAxis, parapetHeight: p.parapetHeight };
      buildRoofPiece(ghostRoof, scale, offsetX, offsetY, p.yOffset + WALL_HEIGHT, viewState).forEach(function (m) {
        m.material = m.material.clone();
        m.material.transparent = true; m.material.opacity = 0.45;
        scene.add(m);
        registry.previewMeshes.push(m);
      });
    }
  }

  // Grade fina (mesmo espaçamento do snap) dentro do contorno do cômodo,
  // na altura do topo da parede — só usada na prévia da ferramenta
  // Telhado, pra dar noção exata de escala/limite antes de clicar.
  function buildFootprintGridLines(minX: any, maxX: any, minZ: any, maxZ: any, y: any, color: any) {
    var pts: any[] = [];
    var step = Core.SNAP_UNIT / Core.GRID;
    for (var x = minX; x <= maxX + 1e-6; x += step) pts.push(x, y, minZ, x, y, maxZ);
    for (var z = minZ; z <= maxZ + 1e-6; z += step) pts.push(minX, y, z, maxX, y, z);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 }));
  }

  // Bolinhas arrastáveis nas pontas da parede selecionada — únicos pontos
  // "clicáveis" que o ViewportController trata como alças de redimensionar.
  // depthTest:false + renderOrder alto: garante que a alça sempre desenha
  // por cima de qualquer coisa (parede, telhado...), nunca fica escondida
  // debaixo da própria superfície que ela ajusta.
  function renderSelectionHandles(scene: any, viewState: any, scale: any, offsetX: any, offsetY: any, walls: any, wallHeight: any) {
    if (viewState.selectedWall) {
      var w = viewState.selectedWall, yOffset = viewState.editingYOffset;
      [[w.x1, w.y1, 1], [w.x2, w.y2, 2]].forEach(function (pt) {
        var wx = (pt[0] - offsetX) * scale, wz = (pt[1] - offsetY) * scale;
        var geo = new THREE.SphereGeometry(0.09, 12, 12);
        var mat = new THREE.MeshBasicMaterial({ color: SELECTED_ACCENT, depthTest: false });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 999;
        mesh.position.set(wx, yOffset + wallHeight / 2, wz);
        mesh.userData.handle = 'endpoint' + pt[2];
        scene.add(mesh);
        registry.handleMeshes.push(mesh);
      });

      // Duas alças no meio da parede, uma de cada lado, perpendiculares —
      // arrastar uma empurra a parede inteira naquela direção (o mesmo
      // redimensionar-com-cantos-seguindo-junto que já existia escondido
      // atrás do duplo clique — Store.commands.updateWallResizeLive).
      // Mesmo visual de bolinha+haste já usado na alça da cumeeira do
      // telhado, só que na horizontal em vez de subindo.
      var midX = (w.x1 + w.x2) / 2, midY = (w.y1 + w.y2) / 2;
      var wdx = w.x2 - w.x1, wdy = w.y2 - w.y1;
      var wlen = Math.hypot(wdx, wdy) || 1;
      var nx = -wdy / wlen, ny = wdx / wlen; // perpendicular unitário, em coordenadas de modelo
      var wallCenterY = yOffset + wallHeight / 2;
      var wallFaceOffset = Core.WALL_THICK * Core.GRID * 0.5; // até a face da parede
      var handleOffset = Core.WALL_THICK * Core.GRID * 2.2; // até onde a bolinha fica, além da face
      [1, -1].forEach(function (side) {
        var faceX = (midX + nx * side * wallFaceOffset - offsetX) * scale;
        var faceZ = (midY + ny * side * wallFaceOffset - offsetY) * scale;
        var handleX = (midX + nx * side * handleOffset - offsetX) * scale;
        var handleZ = (midY + ny * side * handleOffset - offsetY) * scale;
        var geoP = new THREE.SphereGeometry(0.1, 12, 12);
        var matP = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false });
        var meshP = new THREE.Mesh(geoP, matP);
        meshP.renderOrder = 999;
        meshP.position.set(handleX, wallCenterY, handleZ);
        meshP.userData.handle = 'wallPerp';
        scene.add(meshP);
        registry.handleMeshes.push(meshP);
        var poleP = ridgeLineMesh(new THREE.Vector3(faceX, wallCenterY, faceZ), new THREE.Vector3(handleX, wallCenterY, handleZ));
        poleP.material.depthTest = false;
        poleP.renderOrder = 998;
        scene.add(poleP);
        registry.handleMeshes.push(poleP);
      });

      // Alça de altura do CÔMODO (DEC-88) — só aparece se essa parede
      // fecha pelo menos um cômodo de verdade (Core.roomsContainingWall);
      // parede solta sem contorno fechado não tem "cômodo" pra ter altura
      // própria. Posição = altura EFETIVA atual do cômodo
      // (Core.roomHeightM — a maior entre as paredes do contorno, ou o
      // padrão do pavimento), não a altura desta parede isolada, pra já
      // nascer no lugar certo mesmo se o cômodo já tiver sido alterado
      // antes. Parede COMPARTILHADA entre dois cômodos controla sempre o
      // primeiro dos dois (mesma ordem que Core.detectRooms devolve) —
      // simplificação deliberada; pra mirar o outro cômodo, selecione uma
      // parede que só pertença a ele.
      var owningRoomsForHeight = Core.roomsContainingWall(walls, w.id);
      if (owningRoomsForHeight.length) {
        var roomWallIdsForHeight = Core.findRoomWallIds(walls, owningRoomsForHeight[0]!);
        var roomHeightNow = Core.roomHeightM(walls, roomWallIdsForHeight, wallHeight);
        var heightHandleY = yOffset + roomHeightNow;
        var hx = (midX - offsetX) * scale, hz = (midY - offsetY) * scale;
        var geoH = new THREE.SphereGeometry(0.1, 12, 12);
        var matH = new THREE.MeshBasicMaterial({ color: SELECTED_ACCENT, depthTest: false });
        var meshH = new THREE.Mesh(geoH, matH);
        meshH.renderOrder = 999;
        meshH.position.set(hx, heightHandleY, hz);
        meshH.userData.handle = 'roomHeight';
        scene.add(meshH);
        registry.handleMeshes.push(meshH);
        var poleH = ridgeLineMesh(new THREE.Vector3(hx, yOffset, hz), new THREE.Vector3(hx, heightHandleY, hz));
        poleH.material.depthTest = false;
        poleH.renderOrder = 998;
        scene.add(poleH);
        registry.handleMeshes.push(poleH);
      }
    }
    if (viewState.selectedRoof) {
      var r = viewState.selectedRoof, roofYOffset = viewState.editingYOffset;
      var topY = roofYOffset + (r.atticMode ? (r.baseHeightM || 1.2) : wallHeight);
      var midX = (r.x1 + r.x2) / 2, midY = (r.y1 + r.y2) / 2;

      // 4 alças nas bordas — arrastar uma estica/encolhe só aquele lado
      [
        ['MinX', r.x1, midY], ['MaxX', r.x2, midY],
        ['MinY', midX, r.y1], ['MaxY', midX, r.y2]
      ].forEach(function (edge) {
        var ex = (edge[1] - offsetX) * scale, ez = (edge[2] - offsetY) * scale;
        var geoE = new THREE.SphereGeometry(0.11, 12, 12);
        var matE = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false });
        var meshE = new THREE.Mesh(geoE, matE);
        meshE.renderOrder = 999;
        meshE.position.set(ex, topY + 0.15, ez);
        meshE.userData.handle = 'roofEdge' + edge[0];
        meshE.userData.roofHandleForId = r.id;
        scene.add(meshE);
        registry.handleMeshes.push(meshE);
      });

      if (r.type !== 'platibanda') {
        var wx2 = (midX - offsetX) * scale, wz2 = (midY - offsetY) * scale;
        var pitchRad = r.pitchDeg * Math.PI / 180;
        var spanX = (r.x2 - r.x1) * scale, spanZ = (r.y2 - r.y1) * scale;
        var eaveSpan = r.ridgeAxis === 'x' ? spanZ : spanX;
        var run = (r.type === 'umaAgua') ? Math.abs(eaveSpan) : Math.abs(eaveSpan) / 2;
        var ridgeY = topY + run * Math.tan(pitchRad);
        var geo2 = new THREE.SphereGeometry(0.11, 12, 12);
        var mat2 = new THREE.MeshBasicMaterial({ color: SELECTED_ACCENT, depthTest: false });
        var mesh2 = new THREE.Mesh(geo2, mat2);
        mesh2.renderOrder = 999;
        mesh2.position.set(wx2, ridgeY, wz2);
        mesh2.userData.handle = 'roofRidge';
        mesh2.userData.roofHandleForId = r.id;
        scene.add(mesh2);
        registry.handleMeshes.push(mesh2);
        if (r.atticMode) {
          var baseHandle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshBasicMaterial({ color: 0xF4A340, depthTest: false }));
          baseHandle.renderOrder = 999;
          baseHandle.position.set(wx2 + 0.32, topY, wz2 + 0.32);
          baseHandle.userData.handle = 'roofBaseHeight';
          baseHandle.userData.roofHandleForId = r.id;
          scene.add(baseHandle);
          registry.handleMeshes.push(baseHandle);
        }
        var pole = ridgeLineMesh(new THREE.Vector3(wx2, topY, wz2), new THREE.Vector3(wx2, ridgeY, wz2));
        pole.material.depthTest = false;
        pole.renderOrder = 998;
        pole.userData.roofHandleForId = r.id;
        scene.add(pole);
        registry.handleMeshes.push(pole);
      } else {
        // Platibanda: mesma ideia da alça de cumeeira, mas controlando a
        // altura do parapeito em vez da inclinação — arrastar pra
        // cima/baixo estica/encolhe o muro que esconde a borda da laje.
        var wxP = (midX - offsetX) * scale, wzP = (midY - offsetY) * scale;
        var parapetY = topY + (r.parapetHeight != null ? r.parapetHeight : 0.5);
        var geoP2 = new THREE.SphereGeometry(0.11, 12, 12);
        var matP2 = new THREE.MeshBasicMaterial({ color: SELECTED_ACCENT, depthTest: false });
        var meshP2 = new THREE.Mesh(geoP2, matP2);
        meshP2.renderOrder = 999;
        meshP2.position.set(wxP, parapetY, wzP);
        meshP2.userData.handle = 'roofParapetHeight';
        meshP2.userData.roofHandleForId = r.id;
        scene.add(meshP2);
        registry.handleMeshes.push(meshP2);
        var poleP2 = ridgeLineMesh(new THREE.Vector3(wxP, topY, wzP), new THREE.Vector3(wxP, parapetY, wzP));
        poleP2.material.depthTest = false;
        poleP2.renderOrder = 998;
        poleP2.userData.roofHandleForId = r.id;
        scene.add(poleP2);
        registry.handleMeshes.push(poleP2);
      }
    }
    if (viewState.selectedGlazingPanel) {
      var gp = viewState.selectedGlazingPanel;
      var gpYOffset = viewState.editingYOffset;
      var gpCx = gp.x || 0, gpCy = gp.y || 0, gpAngle = (gp.rotationDeg || 0) * Math.PI / 180;
      if (gp.state === 'attached' && gp.wallId) {
        var gpWall = walls.find(function (wall: any) { return wall.id === gp.wallId; });
        if (gpWall) {
          var gpDx = gpWall.x2 - gpWall.x1, gpDy = gpWall.y2 - gpWall.y1;
          var gpLen = Math.hypot(gpDx, gpDy) || 1;
          gpCx = gpWall.x1 + gpDx / gpLen * (gp.offsetM || 0) * Core.GRID;
          gpCy = gpWall.y1 + gpDy / gpLen * (gp.offsetM || 0) * Core.GRID;
          gpAngle = Math.atan2(gpDy, gpDx);
        }
      }
      var gpAxisX = Math.cos(gpAngle), gpAxisY = Math.sin(gpAngle);
      var gpCenterWorldX = (gpCx - offsetX) * scale, gpCenterWorldZ = (gpCy - offsetY) * scale;
      var gpHandleY = gpYOffset + (gp.sillHeightM || 0) + gp.heightM / 2;
      [-1, 1].forEach(function (side) {
        var modelOffset = gp.widthM * Core.GRID / 2 * side;
        var handle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        handle.position.set(gpCenterWorldX + gpAxisX * modelOffset * scale, gpHandleY, gpCenterWorldZ + gpAxisY * modelOffset * scale);
        handle.userData.handle = side < 0 ? 'glazingWidthLeft' : 'glazingWidthRight';
        handle.renderOrder = 999; scene.add(handle); registry.handleMeshes.push(handle);
      });
      var heightHandle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshBasicMaterial({ color: SELECTED_ACCENT, depthTest: false }));
      heightHandle.position.set(gpCenterWorldX, gpYOffset + (gp.sillHeightM || 0) + gp.heightM + 0.15, gpCenterWorldZ);
      heightHandle.userData.handle = 'glazingHeight'; heightHandle.renderOrder = 999;
      scene.add(heightHandle); registry.handleMeshes.push(heightHandle);
    }

    if (viewState.selectedVaranda) {
      var vSel = viewState.selectedVaranda, vYOffset = viewState.editingYOffset;
      var vMidX = (vSel.x1 + vSel.x2) / 2, vMidY = (vSel.y1 + vSel.y2) / 2;
      [
        ['MinX', vSel.x1, vMidY], ['MaxX', vSel.x2, vMidY],
        ['MinY', vMidX, vSel.y1], ['MaxY', vMidX, vSel.y2]
      ].forEach(function (edge) {
        var ex = (edge[1] - offsetX) * scale, ez = (edge[2] - offsetY) * scale;
        var geoE = new THREE.SphereGeometry(0.11, 12, 12);
        var matE = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false });
        var meshE = new THREE.Mesh(geoE, matE);
        meshE.renderOrder = 999;
        meshE.position.set(ex, vYOffset + WALL_HEIGHT + 0.15, ez);
        meshE.userData.handle = 'varandaEdge' + edge[0];
        scene.add(meshE);
        registry.handleMeshes.push(meshE);
      });
    }

    if (viewState.selectedOpening) {
      var opSel = viewState.selectedOpening;
      var wSel = (walls || []).filter(function (x: any) { return x.id === opSel.wallId; })[0];
      if (wSel) {
        var oDx = wSel.x2 - wSel.x1, oDy = wSel.y2 - wSel.y1;
        var oLen = Math.hypot(oDx, oDy) || 1e-6;
        var oUx = oDx / oLen, oUy = oDy / oLen;
        var leftModel = (opSel.offset - opSel.width / 2) * Core.GRID;
        var rightModel = (opSel.offset + opSel.width / 2) * Core.GRID;
        var centerModel = opSel.offset * Core.GRID;
        var opYOffset = viewState.editingYOffset;
        var midHeightY = opYOffset + opSel.sillHeight + opSel.height / 2;
        var topY2 = opYOffset + opSel.sillHeight + opSel.height;
        [
          ['openingEdgeLeft', leftModel, midHeightY],
          ['openingEdgeRight', rightModel, midHeightY],
          ['openingEdgeTop', centerModel, topY2]
        ].forEach(function (h: any) {
          var hx = wSel.x1 + oUx * h[1], hz = wSel.y1 + oUy * h[1];
          var wx = (hx - offsetX) * scale, wz = (hz - offsetY) * scale;
          var geoO = new THREE.SphereGeometry(0.09, 12, 12);
          var matO = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false });
          var meshO = new THREE.Mesh(geoO, matO);
          meshO.renderOrder = 999;
          meshO.position.set(wx, h[2], wz);
          meshO.userData.handle = h[0];
          scene.add(meshO);
          registry.handleMeshes.push(meshO);
        });
      }
    }
  }

  export function rebuild(scene: THREE.Scene, project: Project, canvasSize: any, viewState: ViewState) {
    clearRegistry();

    var scale = 1 / Core.GRID, offsetX = 0, offsetY = 0;
    var layers = project.layers;
    var editingIdx = viewState.editingFloorIndex != null ? viewState.editingFloorIndex : project.currentFloorIndex;

    renderHydraulics(scene, project, scale, offsetX, offsetY, viewState);

    project.floors.forEach(function (floorData, floorIdx) {
      // pavimentos ACIMA do que está sendo editado ficam escondidos, pra
      // manter o foco — igual o editor antigo só mostrava um de cada vez
      if (floorIdx > editingIdx) return;

      var yOffset = floorIdx * FLOOR_STACK_HEIGHT;
      var currentWallHeight = floorWallHeight(floorData, WALL_HEIGHT);
      var isGroundFloor = floorIdx === 0;
      var wallCategory: keyof typeof layers = isGroundFloor ? 'paredesTerreo' : 'paredesSuperiores';
      var wallsVisible = layers[wallCategory];
      var rooms = Core.detectRooms(floorData.walls);
      // computeWallFootprints é só GEOMETRIA VISUAL (junta cantos/mitre
      // entre paredes vizinhas pra desenhar) — bem diferente de
      // detectRooms acima, que precisa da lista INTEIRA (com parede
      // demolida incluída) pra manter o cômodo fechado. Aqui é o
      // oposto: se a parede demolida entrasse nessa lista, a parede
      // VIZINHA a ela (a que sobrou, ainda desenhada) calcularia o
      // canto dela esperando uma parceira que não existe mais
      // visualmente — e a ponta ficava com um entalhe/fresta em vez de
      // uma tampa reta (bug reportado pelo Product Owner: parede
      // "se partiu" na esquina, sem tampinha). Excluir parede demolida
      // SÓ daqui faz essa ponta virar uma extremidade livre de verdade
      // (mesmo tratamento que já existe pra qualquer ponta solta), sem
      // tirar a parede demolida da lista que fecha o cômodo.
      var activeWallsForFootprint = floorData.walls.filter(function (w) { return !w.demolished; });
      var wallFootprints = Core.computeWallFootprints(activeWallsForFootprint);
      // Versão SEM filtro, só pra soleira de parede demolida (ver bloco
      // "Soleira" mais abaixo) — quando a parede some inteira, a soleira
      // que fecha o buraco do piso precisa do contorno ORIGINAL dela
      // (como se ela ainda tivesse os vizinhos), não do contorno já
      // reduzido a ponta livre (esse é o certo pra desenhar a PAREDE em
      // si — wallFootprints acima — mas erraria a soleira, que deve
      // cobrir exatamente onde a espessura da parede estava).
      var wallFootprintsFull = Core.computeWallFootprints(floorData.walls);

      (floorData.glazingPanels || []).forEach(function (panel) {
        // Etapa 2c: grid de verdade (moldura + perfis internos + vidro
        // reflexivo) dentro de um hitMesh invisível (ver
        // buildGlazingPanelPreviewMesh/AttachedMesh). Registra em
        // furnitureMeshes (não structureMeshes) de propósito: esse é o
        // ÚNICO outro registro que usa disposeObject3DTree (limpeza
        // RECURSIVA via .traverse()) — necessário porque o painel tem
        // várias peças filhas dentro do hitMesh, e structureMeshes só
        // descarta um nível (disposeObject3D simples), o que vazaria
        // memória a cada reconstrução da cena (rebuild roda a cada
        // pointermove durante boa parte da interação — ver DEC-57).
        var mesh;
        if (panel.state === 'attached' && panel.wallId) {
          var hostWall = (floorData.walls || []).find(function (w) { return w.id === panel.wallId; });
          if (!hostWall) return;
          mesh = buildGlazingPanelAttachedMesh(panel, hostWall, scale, offsetX, offsetY, yOffset);
        } else if (panel.state === 'preview') {
          mesh = buildGlazingPanelPreviewMesh(panel, scale, offsetX, offsetY, yOffset);
        } else {
          return;
        }
        tagCategory(mesh, 'glazingPanel');
        mesh.userData.glazingPanelId = panel.id; mesh.userData.floorIndex = floorIdx;
        scene.add(mesh);
        registry.furnitureMeshes.push(mesh);
      });

      if (floorData.planUnderlay && floorData.planUnderlay.visible && floorIdx === editingIdx) {
        var underlayMesh = buildPlanUnderlayMesh(floorData.planUnderlay, scale, offsetX, offsetY, yOffset);
        scene.add(underlayMesh);
        registry.structureMeshes.push(underlayMesh);
      }

      (floorData.volumeBoxes || []).forEach(function (box) {
        // Mesmo raciocínio de registro do painel de Envidraçamento
        // acima: furnitureMeshes (não structureMeshes) porque o volume
        // também é um Group com filhos (malha + arestas) dentro do
        // hitMesh — precisa da limpeza recursiva.
        var vmesh;
        if (box.state === 'attached' && box.wallId) {
          var hostWallV = (floorData.walls || []).find(function (w) { return w.id === box.wallId; });
          if (!hostWallV) return;
          vmesh = buildVolumeBoxAttachedMesh(box, hostWallV, scale, offsetX, offsetY, yOffset);
        } else if (box.state === 'preview') {
          vmesh = buildVolumeBoxPreviewMesh(box, scale, offsetX, offsetY, yOffset);
        } else {
          return;
        }
        tagCategory(vmesh, 'volumeBox');
        vmesh.userData.volumeBoxId = box.id; vmesh.userData.floorIndex = floorIdx;
        scene.add(vmesh);
        registry.furnitureMeshes.push(vmesh);
      });

      if (wallsVisible) {
        floorData.walls.forEach(function (w) {
          // "Quebrar parede" (DEC — Wall.demolished) não some do MODELO
          // — continua entrando em computeWallFootprints/detectRooms
          // (senão o cômodo perderia o fechamento e o piso sumiria) —
          // só para de ser CONSTRUÍDA visualmente. Segue existindo pra
          // topologia, só não desenha nada aqui (nem malha, nem
          // hitMesh de clique — pickMesh não vê mais essa parede).
          if (w.demolished) return;
          var generatedAtticRoof = (floorData.roofs || []).find(function (roof) {
            return roof.atticMode === 'generated' && (roof.atticWallIds || []).indexOf(w.id) !== -1;
          });
          // Wall.heightM (altura de cômodo individual, ver DEC-88) tem
          // prioridade sobre a altura padrão do pavimento — mas nunca
          // sobre a extensão de ático, que já é um caso mais específico.
          var renderedWallHeight = generatedAtticRoof ? (generatedAtticRoof.baseHeightM || 1.2) : (w.heightM != null ? w.heightM : currentWallHeight);
          var x1 = (w.x1 - offsetX) * scale, z1 = (w.y1 - offsetY) * scale;
          var x2 = (w.x2 - offsetX) * scale, z2 = (w.y2 - offsetY) * scale;
          var length = Math.hypot(x2 - x1, z2 - z1);
          if (length < 0.05) return;
          // Contorno com extensão só numa parede por canto (ver
          // Core.computeWallFootprints) — nunca duas invadindo o mesmo
          // espaço. Transforma os 4 cantos (em coordenadas de modelo)
          // pro mesmo espaço de tela usado por x1,z1,x2,z2 acima.
          var fpModel = wallFootprints[w.id]!;
          function toScene(p: any) { return { x: (p.x - offsetX) * scale, z: (p.y - offsetY) * scale }; }
          var fp = { p1a: toScene(fpModel.p1a), p1b: toScene(fpModel.p1b), p2a: toScene(fpModel.p2a), p2b: toScene(fpModel.p2b), p1Free: fpModel.p1Free, p2Free: fpModel.p2Free, p1Extended: fpModel.p1Extended, p2Extended: fpModel.p2Extended };

          var isSelected = viewState.selectedWall && viewState.selectedWall.id === w.id;
          var isGroupSelected = viewState.roomGroupWallIds && viewState.roomGroupWallIds.indexOf(w.id) !== -1;
          var isResizeTarget = viewState.resizeWallId === w.id;
          var highlighted = isSelected || isResizeTarget || isGroupSelected;
          // Camada "Paredes transparentes" (ver comentário completo mais
          // abaixo, junto das faces) — declarada aqui em cima porque
          // tanto a tampa de topo (topMat) quanto as faces (faceMat)
          // precisam dela, e a tampa é construída primeiro no fluxo.
          var wallsTransparent = !!layers.paredesTransparentes;

          // Caixa de referência: a espessura real da parede, mas sem
          // preenchimento colorido — quem carrega cor agora são as duas
          // FACES (abaixo), não o volume inteiro. Ela continua existindo
          // geometricamente (arestas visíveis pra identificar, e é o
          // alvo de clique de sempre — pickMesh não muda nada), só o
          // preenchimento fica invisível (opacity 0, sem escrever no
          // depth buffer, pra nunca disputar com as faces por cima).
          // Quando selecionada/em arrasto, ganha um preenchimento
          // translúcido na cor de destaque só como feedback visual.
          var refMat = new THREE.MeshStandardMaterial({
            color: SELECTED_ACCENT,
            flatShading: true,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: highlighted ? (isResizeTarget ? 0.5 : 0.35) : 0,
            depthWrite: false
          });

          // Parede com porta/janela: sem CSG disponível, o volume vira
          // várias "bandas" (ver computeWallOpeningBands) em vez de um
          // único footprint extrudado — cada uma vira seu próprio
          // buildWallBandMesh, todas com o MESMO userData.wallId (clicar
          // em qualquer trecho sólido continua selecionando a parede).
          // Sem abertura nenhuma: caminho de sempre, sem mudança.
          var wallOpenings: any[] = (floorData.openings || []).filter(function (o) { return o.wallId === w.id; });
          // Painéis de Envidraçamento anexados (DEC-56) cortam a mesma
          // banda visual que uma abertura cortaria — mas NÃO são
          // Opening (não entram no quantitativo de aberturas nem no de
          // alvenaria, que continua contando a parede como se estivesse
          // inteira; ver Store.commands.attachGlazingPanelToWall). Só
          // emprestam offset/width/sillHeight/height, o formato que
          // computeWallOpeningBands já espera.
          var wallGlazingBands = (floorData.glazingPanels || [])
            .filter(function (p) { return p.state === 'attached' && p.wallId === w.id; })
            .map(function (p) { return { offset: p.offsetM || 0, width: p.widthM, sillHeight: p.sillHeightM || 0, height: p.heightM }; });
          var wallCuts = wallOpenings.concat(wallGlazingBands);
          var wallLenM = Core.wallLengthMeters(w);
          var bands = wallCuts.length ? computeWallOpeningBands(wallLenM, wallCuts, renderedWallHeight) : null;
          var wallAxisStart = { x: x1, z: z1 };
          var wallAxisEnd = { x: x2, z: z2 };

          if (!bands) {
            var refMesh = tagCategory(buildWallMeshFromFootprint(fp, renderedWallHeight, yOffset, refMat), wallCategory);
            refMesh.userData.wallId = w.id; refMesh.userData.floorIndex = floorIdx;
            scene.add(refMesh);
            registry.wallMeshes.push(refMesh);
          } else {
            bands.forEach(function (band) {
              var capA = band.edgeA ? (fp.p1Free !== false || fp.p1Extended) : true;
              var capB = band.edgeB ? (fp.p2Free !== false || fp.p2Extended) : true;
              var bandMesh = tagCategory(buildWallBandMesh(fp, wallAxisStart, wallAxisEnd, yOffset + band.y0, yOffset + band.y1, band.dA, band.dB, refMat, capA, capB), wallCategory);
              bandMesh.userData.wallId = w.id; bandMesh.userData.floorIndex = floorIdx;
              scene.add(bandMesh);
              registry.wallMeshes.push(bandMesh);
            });
          }

          // O contorno representa somente a silhueta externa da parede.
          // As bandas internas usadas para recortar portas e janelas não
          // são quinas reais e, portanto, nunca recebem linhas próprias.
          var edgeLines = buildWallFootprintEdgeLines(fp, renderedWallHeight, yOffset, !wallSupportsRoofGable(w, floorData.roofs || []));
          scene.add(edgeLines);
          registry.wallMeshes.push(edgeLines);

          // A face superior acompanha o azul-claro padrão da parede. Ela
          // permanece separada apenas para fechar o volume, sem formar a
          // antiga faixa escura no topo.
          var topMat = new THREE.MeshStandardMaterial({
            color: highlighted ? SELECTED_ACCENT : WALL_TOP_COLOR,
            side: THREE.DoubleSide,
            flatShading: true,
            transparent: wallsTransparent,
            opacity: wallsTransparent ? WALL_TRANSPARENT_OPACITY : 1,
            depthWrite: !wallsTransparent
          });
          var topCapMesh = tagCategory(buildWallTopCapMesh(fp, yOffset + renderedWallHeight, topMat), wallCategory);
          topCapMesh.userData.wallId = w.id;
          topCapMesh.userData.floorIndex = floorIdx;
          if (!generatedAtticRoof) {
            scene.add(topCapMesh);
            registry.wallMeshes.push(topCapMesh);
          }

          // Tampa(s) VISÍVEL de ponta livre — mesma condição que a caixa
          // de referência já usava só pra clique (ver
          // buildWallMeshFromFootprint). Reaproveita o topMat (mesmo
          // acabamento/transparência da tampa de topo) — é a mesma
          // "carne" da parede à mostra num corte, faz sentido a mesma
          // cor. Sem isso, uma ponta livre (sempre existiu pra parede
          // solta desde o início; ficou mais comum depois de Quebrar
          // Parede — DEC-83) tinha o canto certo mas nenhuma superfície
          // fechando o vão — dava pra ver através da parede ali.
          if (fp.p1Free !== false || fp.p1Extended) {
            var endCap1 = tagCategory(buildWallEndCapMesh(fp, renderedWallHeight, yOffset, topMat, 1), wallCategory);
            endCap1.userData.wallId = w.id;
            endCap1.userData.floorIndex = floorIdx;
            scene.add(endCap1);
            registry.wallMeshes.push(endCap1);
          }
          if (fp.p2Free !== false || fp.p2Extended) {
            var endCap2 = tagCategory(buildWallEndCapMesh(fp, renderedWallHeight, yOffset, topMat, 2), wallCategory);
            endCap2.userData.wallId = w.id;
            endCap2.userData.floorIndex = floorIdx;
            scene.add(endCap2);
            registry.wallMeshes.push(endCap2);
          }

          if (generatedAtticRoof) {
            var atticExtensionMat = new THREE.MeshStandardMaterial({
              color: highlighted ? SELECTED_ACCENT : GABLE_COLOR,
              side: THREE.DoubleSide,
              flatShading: true,
              roughness: 0.92,
              transparent: true,
              opacity: highlighted ? 0.2 : 0,
              depthWrite: false
            });
            buildAtticWallExtensions(w, generatedAtticRoof, wallOpenings, scale, offsetX, offsetY, yOffset, atticExtensionMat).forEach(function (extension) {
              tagCategory(extension, wallCategory);
              extension.userData.wallId = w.id;
              extension.userData.floorIndex = floorIdx;
              scene.add(extension);
              registry.wallMeshes.push(extension);
              var extensionEdges = new THREE.LineSegments(new THREE.EdgesGeometry(extension.geometry), new THREE.LineBasicMaterial({ color: 0x777873 }));
              scene.add(extensionEdges);
              registry.wallMeshes.push(extensionEdges);
            });
          }

          // As duas faces (lado A / lado B), cada uma com seu próprio
          // acabamento do Catálogo — mesmo contorno fp de cima, então
          // se encontram exatas com a face da parede vizinha no canto,
          // sem sobrepor (a mesma correção que já vale pra caixa toda).
          // Reboco (textura PBR) removido de toda a casa — ver Sessão
          // 27: sem acabamento cerâmico, a face fica em cor lisa.
          var wallDefaultColor = GABLE_COLOR;
          // "Paredes transparentes" (camada, ver ProjectLayers) — pedido
          // do Product Owner depois de importar a Planta Baixa (DEC-82):
          // com a planta deitada no chão, a parede opaca tampava a
          // referência por baixo. Só reduz a OPACIDADE da face (a caixa
          // de referência/clique, a porta/janela e o resto continuam
          // exatamente iguais) — não é a mesma coisa que a camada
          // "Paredes — térreo/superiores" desligada, que some com a
          // parede inteira (inclusive o clique nela); aqui ela continua
          // selecionável, só fica vazada. `wallsTransparent` já foi
          // declarado lá em cima (perto de `highlighted`) — a tampa de
          // topo também usa.
          (['a', 'b'] as const).forEach(function (side) {
            var productId = side === 'a' ? w.finishA : w.finishB;
            var product = productId ? Catalog.getProduct(productId) : null;
            var isCeramic = product && product.category === 'floor_tile';
            var ceramicMap = isCeramic ? buildCeramicTexture(product!.assets.colorHex, 1, 0) : null;
            var faceColorHex = product ? parseInt(product.assets.colorHex.slice(1), 16) : wallDefaultColor;
            if (isCeramic) faceColorHex = 0xFFFFFF;
            var faceColor = highlighted ? SELECTED_ACCENT : (DEBUG_COLOR_MODE ? hashColorHex(w.id + '-' + side) : faceColorHex);
            var faceMat = new THREE.MeshStandardMaterial({
              color: (floorIdx === editingIdx && !DEBUG_COLOR_MODE) ? pickColor(faceColor, wallCategory, viewState) : faceColor,
              map: DEBUG_COLOR_MODE ? null : ceramicMap,
              roughness: 0.92,
              flatShading: true,
              side: THREE.DoubleSide,
              polygonOffset: true,
              // Todas as faces usam o mesmo viés. Variar pelo id da
              // parede fazia trechos colineares ganharem profundidades
              // diferentes e a costura aparecia como uma faixa/rasgo.
              // Sobreposições reais são eliminadas ao concluir o gesto.
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              transparent: wallsTransparent,
              opacity: wallsTransparent ? WALL_TRANSPARENT_OPACITY : 1,
              depthWrite: !wallsTransparent
            });
            // Sem tagCategory/wallId de propósito: a face não é alvo de
            // clique próprio — a caixa de referência (mesma posição)
            // já cobre isso, então o clique passa direto pra ela.
            if (!bands) {
              var faceMesh = buildFaceStripMesh(fp, renderedWallHeight, yOffset, faceMat, side);
              faceMesh.userData.floorIndex = floorIdx;
              faceMesh.userData.debugWallId = w.id;
              faceMesh.userData.debugSide = side;
              scene.add(faceMesh);
              registry.wallMeshes.push(faceMesh);
            } else {
              bands.forEach(function (band) {
                var faceBandMesh = buildFaceBandMesh(fp, wallAxisStart, wallAxisEnd, yOffset + band.y0, yOffset + band.y1, band.dA, band.dB, faceMat, side);
                faceBandMesh.userData.floorIndex = floorIdx;
                faceBandMesh.userData.debugWallId = w.id;
                faceBandMesh.userData.debugSide = side;
                scene.add(faceBandMesh);
                registry.wallMeshes.push(faceBandMesh);
              });
            }
            if (generatedAtticRoof) {
              buildAtticWallFaceExtensions(w, generatedAtticRoof, wallOpenings, fp, yOffset, faceMat, side).forEach(function (atticFace) {
                atticFace.userData.floorIndex = floorIdx;
                atticFace.userData.debugWallId = w.id;
                atticFace.userData.debugSide = side;
                scene.add(atticFace);
                registry.wallMeshes.push(atticFace);
              });
            }
          });

        });
      }

      // Portas e janelas em si (folha/vidro+caixilho) — nascem sempre
      // DEPOIS das paredes, já que dependem da parede existir pra achar
      // a posição/ângulo (Core não sabe nada de Three.js, então essa
      // conversão fica toda aqui no renderer).
      if (layers.aberturas && floorData.openings && floorData.openings.length) {
        floorData.openings.forEach(function (op) {
          var w = floorData.walls.filter(function (x) { return x.id === op.wallId; })[0];
          if (!w || w.demolished) return;
          var isSelected = viewState.selectedOpening && viewState.selectedOpening.id === op.id;
          // Com productId (ver Opening.productId): tenta o modelo glTF
          // real no lugar do batente/folha/vidro gerados na hora. Sem
          // produto — ou enquanto o modelo ainda não terminou de
          // carregar (buildOpeningModelPiece devolve null nesse caso,
          // igual móvel) — cai pro caminho procedural de sempre, sem
          // deixar o vão vazio.
          var product = op.productId ? Catalog.getProduct(op.productId) : null;
          var modelPiece = product ? buildOpeningModelPiece(op, product, w, scale, offsetX, offsetY, yOffset) : null;
          if (modelPiece) {
            tagCategory(modelPiece, 'aberturas');
            modelPiece.userData.openingId = op.id;
            modelPiece.userData.floorIndex = floorIdx;
            scene.add(modelPiece);
            registry.openingModelMeshes.push(modelPiece);
            return;
          }
          var pieces = buildOpeningPieces(op, w, scale, offsetX, offsetY, yOffset, isSelected);
          pieces.forEach(function (m) {
            // Folha/vidro e todos os novos marcos sólidos pertencem à
            // mesma abertura. Assim clicar no batente também seleciona a
            // porta/janela, preservando o comportamento esperado.
            if (m.isMesh) {
              tagCategory(m, 'aberturas');
              m.userData.openingId = op.id;
              m.userData.floorIndex = floorIdx;
            }
            scene.add(m);
            registry.wallMeshes.push(m);
          });
        });
      }

      if (layers.colunas) {
        floorData.columns.forEach(function (c) {
          var cx = (c.x - offsetX) * scale, cz = (c.y - offsetY) * scale;
          var half = Core.COLUMN_SIZE / 2 * scale;
          var isSelected = viewState.selectedColumn && viewState.selectedColumn.id === c.id;
          var baseColor = isSelected ? SELECTED_ACCENT : 0xA6A49A;
          var mat = new THREE.MeshStandardMaterial({ color: floorIdx === editingIdx ? pickColor(baseColor, 'colunas', viewState) : baseColor, flatShading: true });
          var geo = c.shape === 'redonda' ? new THREE.CylinderGeometry(half, half, currentWallHeight, 20) : new THREE.BoxGeometry(half * 2, currentWallHeight, half * 2);
          var mesh = tagCategory(new THREE.Mesh(geo, mat), 'colunas');
          mesh.userData.columnId = c.id; mesh.userData.floorIndex = floorIdx;
          mesh.position.set(cx, currentWallHeight / 2 + yOffset, cz);
          scene.add(mesh);
          registry.wallMeshes.push(mesh);
          var edges = new THREE.EdgesGeometry(geo);
          var edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
          edgeLines.userData.columnId = c.id; edgeLines.userData.floorIndex = floorIdx;
          edgeLines.position.copy(mesh.position);
          scene.add(edgeLines);
          registry.wallMeshes.push(edgeLines);
        });
      }

      if (layers.telhado && floorData.roofs) {
        var roofTopY = yOffset + currentWallHeight;
        var wallMatchColor = computeWallMatchColor(floorData.walls);
        floorData.roofs.forEach(function (roof) {
          var pieceBaseY = yOffset + (roof.atticMode ? (roof.baseHeightM || 1.2) : currentWallHeight);
          var pieces = buildRoofPiece(roof, scale, offsetX, offsetY, pieceBaseY, viewState, wallMatchColor);
          if (roof.atticMode === 'preview') pieces.forEach(function (piece) {
            var materials = Array.isArray(piece.material) ? piece.material : [piece.material];
            materials.forEach(function (material: any) {
              if (!material) return;
              material.transparent = true; material.opacity = 0.32; material.depthWrite = false;
            });
          });
          var ownFootprint = roofWorldFootprint(roof, scale, offsetX, offsetY);
          var trimRects = floorData.roofs.filter(function (other) {
            if (!roof.compoundGroupId || other.compoundGroupId !== roof.compoundGroupId || other.id === roof.id || other.ridgeAxis === roof.ridgeAxis) return false;
            var otherFootprint = roofWorldFootprint(other, scale, offsetX, offsetY);
            return rectsOverlapArea(ownFootprint, otherFootprint) > 1e-6;
          }).reduce(function (regions: any[], other) {
            return regions.concat(roofCutRegions(other, scale, offsetX, offsetY, roofTopY));
          }, []);
          pieces.forEach(function (m) {
            if (roof.atticMode === 'generated' && m.userData.gableSide) return;
            clipMeshOutsideRects(m, trimRects);
            tagCategory(m, m.userData.gableSide ? wallCategory : 'telhado');
            m.userData.roofId = roof.id; m.userData.floorIndex = floorIdx;
            scene.add(m);
            registry.structureMeshes.push(m);
          });
        });
      }

      if (layers.varanda && floorData.varandas) {
        floorData.varandas.forEach(function (varanda) {
          var pieces = buildVarandaPiece(varanda, scale, offsetX, offsetY, yOffset, viewState);
          pieces.forEach(function (m) {
            tagCategory(m, 'varanda');
            m.userData.varandaId = varanda.id; m.userData.floorIndex = floorIdx;
            scene.add(m);
            registry.structureMeshes.push(m);
          });
        });
      }

      if (floorData.furniture) {
        floorData.furniture.forEach(function (item) {
          var piece = buildFurniturePiece(item, scale, offsetX, offsetY, yOffset);
          if (!piece) return;
          tagCategory(piece, 'furniture');
          piece.userData.furnitureId = item.id; piece.userData.floorIndex = floorIdx;
          scene.add(piece);
          registry.furnitureMeshes.push(piece);
        });
      }

      rooms.forEach(function (room) {
        if (!layers.laje) return;
        // O piso usava o EIXO da parede (room.points, cruzamento de
        // centro) — sempre parava meia-espessura curto da face real,
        // um desalinhamento que ficou visível assim que a face da
        // parede passou a ter posição própria (canto por interseção de
        // reta, não mais simétrica ao eixo). Corrigido: pra cada trecho
        // do contorno, acha a parede real correspondente e usa a face
        // dela (a ou b) que fica voltada pra DENTRO deste cômodo — a
        // mesma matemática que computeWallFootprints já resolve pros
        // cantos, reaproveitada aqui.
        var cx = 0, cy = 0;
        room.points.forEach(function (p) { cx += p.x; cy += p.y; });
        cx /= room.points.length; cy /= room.points.length;
        var insetWallIds: any[] = [];
        var insetPoints = room.points.map(function (p1: any, i: any) {
          var p2 = room.points[(i + 1) % room.points.length]!;
          var midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
          var bestWall: any = null, bestDist = Infinity;
          floorData.walls.forEach(function (w: any) {
            var d = Core.distToSegment(midX, midY, w.x1, w.y1, w.x2, w.y2);
            if (d < bestDist) { bestDist = d; bestWall = w; }
          });
          insetWallIds.push(bestWall ? bestWall.id : null);
          var fp = bestWall && wallFootprints[bestWall.id];
          if (!fp) return p1;
          var d1 = Math.hypot(bestWall.x1 - p1.x, bestWall.y1 - p1.y);
          var d2 = Math.hypot(bestWall.x2 - p1.x, bestWall.y2 - p1.y);
          var face = (d1 <= d2) ? { a: fp.p1a, b: fp.p1b } : { a: fp.p2a, b: fp.p2b };
          var distA = Math.hypot(face.a.x - cx, face.a.y - cy);
          var distB = Math.hypot(face.b.x - cx, face.b.y - cy);
          return distA <= distB ? face.a : face.b;
        });
        var shape = new THREE.Shape();
        insetPoints.forEach(function (p, i) {
          var wx = (p.x - offsetX) * scale, wz = (p.y - offsetY) * scale;
          if (i === 0) shape.moveTo(wx, wz); else shape.lineTo(wx, wz);
        });
        shape.closePath();
        // Espessura fina (3cm) e base sempre no mesmo nível da base da
        // parede (yOffset — o mesmo y0 usado em buildWallMeshFromFootprint),
        // em vez de depender do térreo ou empilhar sobre a laje.
        var thickness = 0.03;
        var pisoBase = yOffset;
        var pisoTopY = pisoBase + thickness;
        // Cômodo não é entidade persistida — o acabamento de piso é
        // procurado pela assinatura das paredes que formam ESTE cômodo
        // agora (mesma técnica usada em fuseAllOverlaps pra reconhecer
        // "o mesmo cômodo" depois de uma fusão).
        var roomKey = Core.findRoomWallIds(floorData.walls, room).slice().sort().join(',');
        var roomFinishId = (floorData.roomFinishes || {})[roomKey];
        var roomFinish = roomFinishId && Catalog.getProduct(roomFinishId);
        var roomFinishSettings = (floorData.roomFinishSettings || {})[roomKey] || { scale: 1, rotation: 0 };
        // Cômodo nasce direto com cerâmica (fugas já desenhadas) — antes
        // só aparecia depois do usuário escolher um piso manualmente em
        // Materiais, e até lá ficava um verde liso sem fuga nenhuma.
        // DEFAULT_FLOOR_FINISH_ID é só o ponto de partida; a escolha
        // manual em Materiais (roomFinishId) sempre tem prioridade.
        var effectiveFinish = (roomFinish && roomFinish.category === 'floor_tile')
          ? roomFinish
          : Catalog.getProduct(DEFAULT_FLOOR_FINISH_ID);
        var pisoBaseColor = effectiveFinish ? parseInt(effectiveFinish.assets.colorHex.slice(1), 16) : 0xCFE8CF;
        var pisoColorFinal = DEBUG_COLOR_MODE ? hashColorHex('room:' + roomKey) : pisoBaseColor;
        var color = DEBUG_COLOR_MODE ? pisoColorFinal : pickColor(pisoColorFinal, 'laje', viewState);
        var pisoTexture = effectiveFinish
          ? buildCeramicTexture(effectiveFinish.assets.colorHex, roomFinishSettings.scale, roomFinishSettings.rotation)
          : null;
        var mesh = tagCategory(makeSlabMesh(shape, thickness, pisoTopY, color, 1, true, pisoTexture), 'laje');
        mesh.userData.debugRoomKey = roomKey;
        mesh.userData.roomKey = roomKey;
        scene.add(mesh);
        registry.roomMeshes.push(mesh);
        var roomEdgeLines = buildRoomFloorOutline(insetPoints, insetWallIds, floorData.walls, floorData.openings, offsetX, offsetY, scale, pisoTopY);
        roomEdgeLines.userData.roomKey = roomKey;
        scene.add(roomEdgeLines);
        registry.roomMeshes.push(roomEdgeLines);

        // Rodapé — nasce automático junto com o piso, mesmo contorno
        // (insetPoints, já na face real da parede) e mesmo acabamento
        // (roomFinish), sem depender de nenhuma entidade nova no modelo.
        var baseboardMesh = tagCategory(
          buildRoomBaseboardMesh(insetPoints, insetWallIds, floorData.walls, floorData.openings, cx, cy, offsetX, offsetY, scale, pisoTopY, pisoColorFinal, pisoTexture),
          'rodape'
        );
        baseboardMesh.userData.roomKey = roomKey;
        scene.add(baseboardMesh);
        registry.roomMeshes.push(baseboardMesh);

        // Laje — mesma técnica do piso (mesmo shape/insetPoints,
        // já na face real da parede), só que no TOPO da parede em vez
        // da base, e com a espessura real de laje. Sempre acompanha a
        // parede automaticamente (não guarda nada — recalculada a
        // cada render, exatamente como o piso), incluindo quando a
        // parede é arrastada: não existe "sincronizar" porque nunca
        // existiu um estado separado pra ficar dessincronizado.
        var lajeSizeX = 0, lajeSizeZ = 0;
        insetPoints.forEach(function (p: any, i: any) {
          var p2 = insetPoints[(i + 1) % insetPoints.length];
          lajeSizeX = Math.max(lajeSizeX, Math.abs(p.x - p2.x) * scale);
          lajeSizeZ = Math.max(lajeSizeZ, Math.abs(p.y - p2.y) * scale);
        });
        var lajeWallColor = computeWallMatchColor(floorData.walls);
        // Acompanha a altura EFETIVA deste cômodo (maior Wall.heightM do
        // próprio contorno, ou o padrão do pavimento quando nenhuma
        // parede tem override — ver DEC-88), não mais uma altura única
        // fixa pro pavimento inteiro. Um cômodo mais alto empurra a
        // própria laje pra cima; os vizinhos não-alterados continuam na
        // altura padrão.
        var roomHeight = Core.roomHeightM(floorData.walls, insetWallIds.filter(function (id: any) { return !!id; }), currentWallHeight);
        var lajePieces = buildAutoLajePiece(shape, lajeSizeX, lajeSizeZ, yOffset + roomHeight, lajeWallColor, viewState);
        lajePieces.forEach(function (m: any) {
          tagCategory(m, 'laje');
          m.userData.roomKey = roomKey; m.userData.floorIndex = floorIdx;
          scene.add(m);
          registry.roomMeshes.push(m);
        });
      });

      // Soleira — depois de gerar o piso de TODOS os cômodos do
      // pavimento (precisa da lista completa pra achar quem fica de
      // cada lado da parede). Dois casos, tratados diferente:
      // - Cômodo dos DOIS lados (arco/porta entre cômodos): buildThresholdSlab,
      //   escondida por baixo da parede sólida, só some com a abertura.
      // - Cômodo de UM lado só (arco pra área externa): buildExteriorSoleira,
      //   peça própria elevada, só na largura do vão — soleira de
      //   verdade, não o piso disfarçado de soleira.
      // - Nenhum dos dois lados: nada pra fechar, ignora.
      if (layers.laje) {
        var thresholdWallIds: any = {};
        (floorData.openings || []).forEach(function (op) {
          if (op.sillHeight > 0.02) return;
          var wall = floorData.walls.filter(function (w) { return w.id === op.wallId; })[0];
          if (!wall) return;
          var adj = Core.findRoomsAdjacentToOpening(wall, op, rooms);
          var roomA = adj.roomA, roomB = adj.roomB;
          if (roomA && roomB) {
            if (thresholdWallIds[op.wallId]) return; // essa parede já vai ganhar soleira por outra abertura
            thresholdWallIds[op.wallId] = true;
          } else if (roomA || roomB) {
            var soleira = tagCategory(buildExteriorSoleira(wall, op, yOffset, offsetX, offsetY, scale), 'laje');
            soleira.userData.openingId = op.id;
            scene.add(soleira);
            registry.roomMeshes.push(soleira);
          }
        });
        Object.keys(thresholdWallIds).forEach(function (wallId) {
          var wall = floorData.walls.filter(function (w) { return w.id === wallId; })[0];
          if (!wall) return;
          var slab = buildThresholdSlab(wall, wallFootprints, yOffset, offsetX, offsetY, scale);
          if (!slab) return;
          tagCategory(slab, 'laje');
          scene.add(slab);
          registry.roomMeshes.push(slab);
        });

        // Parede QUEBRADA (Wall.demolished, DEC-83) — mesmo raciocínio
        // do arco/porta acima ("fecha o buraco que sobra no piso quando
        // uma abertura no nível do chão corta uma parede"), só que a
        // "abertura" é a parede INTEIRA, não um trecho dela. Sem
        // Opening nenhum pra disparar o loop acima, essa parede nunca
        // entrava nele — o piso de cada lado sempre parava exatamente
        // na própria face (nunca invadia a espessura da parede, porque
        // normalmente é a PAREDE que cobre essa faixa), e sem a parede
        // (demolida = não desenhada) sobrava uma fresta do tamanho da
        // espessura dela à mostra: o buraco reportado pelo Product
        // Owner. Um vão sintético cobrindo o comprimento INTEIRO da
        // parede (offset = meio, width = comprimento todo) resolve com
        // a MESMA função já usada pro arco — só usa wallFootprintsFull
        // (sem filtro) em vez de wallFootprints (que exclui parede
        // demolida — ver comentário lá em cima): a soleira precisa do
        // contorno ORIGINAL da parede (como se os vizinhos ainda
        // estivessem lá), não da ponta livre que a PRÓPRIA parede
        // demolida ganharia se ela ainda fosse desenhada.
        floorData.walls.forEach(function (w) {
          if (!w.demolished) return;
          var wallLenM = Core.wallLengthMeters(w);
          if (wallLenM < 1e-6) return;
          var fullSpanOpening: any = { id: 'demolida-' + w.id, wallId: w.id, kind: 'arco', offset: wallLenM / 2, width: wallLenM, sillHeight: 0 };
          var adjD = Core.findRoomsAdjacentToOpening(w, fullSpanOpening, rooms);
          if (adjD.roomA && adjD.roomB) {
            var slabD = buildThresholdSlab(w, wallFootprintsFull, yOffset, offsetX, offsetY, scale);
            if (slabD) { tagCategory(slabD, 'laje'); scene.add(slabD); registry.roomMeshes.push(slabD); }
          } else if (adjD.roomA || adjD.roomB) {
            var soleiraD = tagCategory(buildExteriorSoleira(w, fullSpanOpening, yOffset, offsetX, offsetY, scale), 'laje');
            soleiraD.userData.wallId = w.id;
            scene.add(soleiraD);
            registry.roomMeshes.push(soleiraD);
          }
        });
      }
    });

    var groundRooms = Core.detectRooms(project.floors[0]!.walls);
    var groundBounds = computeWorldBounds(project.floors[0]!.walls, layers.colunas ? project.floors[0]!.columns : null, scale, offsetX, offsetY);

    if (layers.fundacao) {
      buildFoundation(project.foundationType, groundRooms, groundBounds, scale, offsetX, offsetY, viewState).forEach(function (m) {
        tagCategory(m, 'fundacao'); scene.add(m); registry.structureMeshes.push(m);
      });
    }
    if (layers.calcada) {
      buildCalcada(groundRooms, groundBounds, scale, offsetX, offsetY, viewState).forEach(function (m) {
        tagCategory(m, 'calcada'); scene.add(m); registry.structureMeshes.push(m);
      });
    }

    var topFloorIdx = Math.min(editingIdx, project.floors.length - 1);
    var topBounds = computeWorldBounds(project.floors[topFloorIdx]!.walls, layers.colunas ? project.floors[topFloorIdx]!.columns : null, scale, offsetX, offsetY);
    var topY = topFloorIdx * FLOOR_STACK_HEIGHT + WALL_HEIGHT;

    if (layers.marquise && topBounds && topFloorIdx === project.floors.length - 1) {
      var marquiseShape = buildPerimeterFrameShape(topBounds, MARQUISE_DEPTH);
      var marquise = tagCategory(makeSlabMesh(marquiseShape, MARQUISE_THICKNESS, topY + MARQUISE_THICKNESS, pickColor(0xB5D4F4, 'marquise', viewState), 0.9), 'marquise');
      scene.add(marquise); registry.structureMeshes.push(marquise);
    }

    if (project.terreno) buildTerrenoPieces(scene, project.terreno, viewState, scale, offsetX, offsetY);

    renderDrawPreview(scene, viewState, scale, offsetX, offsetY);
    renderSelectionHandles(
      scene, viewState, scale, offsetX, offsetY, project.floors[editingIdx]!.walls,
      floorWallHeight(project.floors[editingIdx]!, WALL_HEIGHT)
    );
  }

  export function FLOOR_STACK_HEIGHT_GETTER() { return FLOOR_STACK_HEIGHT; }
  export function WALL_HEIGHT_GETTER() { return WALL_HEIGHT; }
  // Beirais reais do telhado (em metros) — expostos só pra quantitativo
  // de materiais poder somar a mesma área que o 3D realmente desenha,
  // em vez de reimplementar (e arriscar dessincronizar) esses valores.
  export function ROOF_OVERHANG_GETTER() { return ROOF_OVERHANG; }
  export function RAKE_OVERHANG_GETTER() { return RAKE_OVERHANG; }
  // Dimensões reais da fundação (radier/baldrame) — mesma ideia: o
  // quantitativo lê daqui em vez de guardar um segundo valor solto.
  export function RADIER_THICKNESS_GETTER() { return RADIER_THICKNESS; }
  export function RADIER_MARGIN_GETTER() { return RADIER_MARGIN; }
  export function BALDRAME_WIDTH_GETTER() { return BALDRAME_WIDTH; }
  export function BALDRAME_THICKNESS_GETTER() { return BALDRAME_THICKNESS; }
  // Espessura real da Laje (elemento independente, arrastável, ver
  // types.ts) — mesma ideia dos getters acima: o quantitativo de
  // materiais lê daqui em vez de guardar um segundo valor solto que
  // pode dessincronizar do que o 3D realmente desenha.
  export function LAJE_THICKNESS_GETTER() { return LAJE_THICKNESS; }

// Namespace de compatibilidade — mesma razão de Core.ts/Store.ts/Catalog.ts
// (chamadas Scene3DRenderer.xxx no código legado, enquanto
// ViewportController ainda não foi migrado).
export const Scene3DRenderer = {
  rebuild,
  createRoofResizePreviewMeshes,
  createWallResizePreviewMeshes,
  setOnFurnitureAssetLoaded,
  getFurnitureMeshes,
  getOpeningModelMeshes,
  getFurnitureFootprint,
  FLOOR_STACK_HEIGHT_GETTER,
  WALL_HEIGHT_GETTER,
  ROOF_OVERHANG_GETTER,
  RAKE_OVERHANG_GETTER,
  RADIER_THICKNESS_GETTER,
  RADIER_MARGIN_GETTER,
  BALDRAME_WIDTH_GETTER,
  BALDRAME_THICKNESS_GETTER,
  LAJE_THICKNESS_GETTER
};