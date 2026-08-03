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
import { Core } from './Core.js';
import { Catalog } from './Catalog.js';
import type { Project, Wall, Column, Roof, Varanda, Opening } from './types.js';

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
  selectedWall?: Wall | null;
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
  var FLOOR_STACK_HEIGHT = WALL_HEIGHT + LAJE_THICKNESS;
  var RADIER_THICKNESS = 0.18, RADIER_MARGIN = 0.15;
  var BALDRAME_WIDTH = 0.25, BALDRAME_THICKNESS = 0.2;
  var CALCADA_WIDTH = 0.6, CALCADA_THICKNESS = 0.05;
  var MARQUISE_DEPTH = 0.5, MARQUISE_THICKNESS = 0.06;
  var ROOF_PITCH_DEG = 28, ROOF_OVERHANG = 0.4, RAKE_OVERHANG = 0.2, ROOF_THICKNESS = 0.12;
  var ROOF_COLOR = 0xB5573A, GABLE_COLOR = 0xE7E1D2;
  var HIGHLIGHT_ACCENT = 0xE8963C, HIGHLIGHT_MIX = 0.55;
  var SELECTED_ACCENT = 0xE8963C;

  interface Registry {
    wallMeshes: THREE.Object3D[];
    roomMeshes: THREE.Object3D[];
    structureMeshes: THREE.Object3D[];
    previewMeshes: THREE.Object3D[];
    handleMeshes: THREE.Object3D[];
    [key: string]: THREE.Object3D[];
  }
  var registry: Registry = { wallMeshes: [], roomMeshes: [], structureMeshes: [], previewMeshes: [], handleMeshes: [] };

  function pickColor(baseHex: any, category: any, viewState: any) {
    if (!viewState || viewState.highlightedCategory !== category) return baseHex;
    return new THREE.Color(baseHex).lerp(new THREE.Color(HIGHLIGHT_ACCENT), HIGHLIGHT_MIX).getHex();
  }

  function tagCategory(mesh: any, category: any) {
    mesh.userData.category = category;
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
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // Contorno de uma parede SEM as arestas das pontas — só as 4 arestas
  // que correm ao longo do comprimento (topo/base, lado a/lado b). Se
  // desenhássemos as arestas das pontas também, num canto mitrado elas
  // cairiam bem em cima da parede vizinha, criando uma costura falsa.
  function buildWallFootprintEdgeLines(fp: any, height: any, yOffset: any) {
    var y0 = yOffset, y1 = yOffset + height;
    var pts = [
      fp.p1a.x, y1, fp.p1a.z, fp.p2a.x, y1, fp.p2a.z,
      fp.p1b.x, y1, fp.p1b.z, fp.p2b.x, y1, fp.p2b.z,
      fp.p1a.x, y0, fp.p1a.z, fp.p2a.x, y0, fp.p2a.z,
      fp.p1b.x, y0, fp.p1b.z, fp.p2b.x, y0, fp.p2b.z
    ];
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
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
  function buildWallBandMesh(fp: any, y0: any, y1: any, tA: any, tB: any, mat: any, capA: any, capB: any) {
    var pA0 = lerpPt(fp.p1a, fp.p2a, tA), pA1 = lerpPt(fp.p1a, fp.p2a, tB);
    var pB0 = lerpPt(fp.p1b, fp.p2b, tA), pB1 = lerpPt(fp.p1b, fp.p2b, tB);
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
  function buildFaceBandMesh(fp: any, y0: any, y1: any, tA: any, tB: any, mat: any, side: any) {
    var verts: any[] = [];
    function quad(a: any, b: any, c: any, d: any) { [a, b, c, a, c, d].forEach(function (v) { verts.push(v[0], v[1], v[2]); }); }
    if (side === 'a') {
      var pA0 = lerpPt(fp.p1a, fp.p2a, tA), pA1 = lerpPt(fp.p1a, fp.p2a, tB);
      quad([pA0.x, y0, pA0.z], [pA1.x, y0, pA1.z], [pA1.x, y1, pA1.z], [pA0.x, y1, pA0.z]);
    } else {
      var pB0 = lerpPt(fp.p1b, fp.p2b, tA), pB1 = lerpPt(fp.p1b, fp.p2b, tB);
      quad([pB1.x, y0, pB1.z], [pB0.x, y0, pB0.z], [pB0.x, y1, pB0.z], [pB1.x, y1, pB1.z]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }

  // A partir da lista de aberturas de UMA parede (em metros: offset,
  // width, height, sillHeight), devolve as bandas sólidas que sobram —
  // null se a parede não tem nenhuma abertura (caminho antigo, sem
  // mudança nenhuma). tA/tB em fração 0..1 do comprimento da parede.
  function computeWallOpeningBands(wallLenM: any, openings: any) {
    if (!openings || !openings.length) return null;
    var list = openings.map(function (o: any) {
      // Clamp defensivo: se a parede foi redimensionada depois que a
      // abertura nasceu (ver limitações conhecidas), o t podia cair fora
      // de 0..1 — trava dentro da parede em vez de gerar geometria
      // invertida ou fora do volume.
      var tStart = Math.max(0, Math.min(1, (o.offset - o.width / 2) / wallLenM));
      var tEnd = Math.max(tStart, Math.min(1, (o.offset + o.width / 2) / wallLenM));
      return { tStart: tStart, tEnd: tEnd, sill: o.sillHeight, top: o.sillHeight + o.height };
    }).sort(function (a: any, b: any) { return a.tStart - b.tStart; });

    var bands: any[] = [];
    var cursor = 0;
    list.forEach(function (op: any) {
      if (op.tStart > cursor + 1e-4) bands.push({ tA: cursor, tB: op.tStart, y0: 0, y1: WALL_HEIGHT });
      // Peitoril (só janela — porta tem sill=0, sem banda embaixo).
      if (op.sill > 0.02) bands.push({ tA: op.tStart, tB: op.tEnd, y0: 0, y1: op.sill });
      // Verga (o "lintel" acima do vão).
      if (op.top < WALL_HEIGHT - 0.02) bands.push({ tA: op.tStart, tB: op.tEnd, y0: op.top, y1: WALL_HEIGHT });
      cursor = op.tEnd;
    });
    if (cursor < 1 - 1e-4) bands.push({ tA: cursor, tB: 1, y0: 0, y1: WALL_HEIGHT });
    if (!bands.length) return null;
    // Só a primeira/última banda (se realmente tocam a ponta de verdade
    // da parede) herdam a regra condicional de tampa do canto; todas as
    // outras são faces novas criadas pela abertura, sempre tampadas.
    bands[0].edgeA = bands[0].tA <= 1e-4;
    bands[bands.length - 1].edgeB = bands[bands.length - 1].tB >= 1 - 1e-4;
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
    function addPiece(mesh: any, localY: any) {
      mesh.position.set(sx, yOffset + localY, sz);
      mesh.rotation.y = angle;
      pieces.push(mesh);
    }

    var isDoor = op.kind === 'door';
    var leafWidth = Math.max(0.1, op.width - 0.06);
    var thick = WALL_THICK * 0.7;

    if (isDoor) {
      var doorColor = isSelected ? SELECTED_ACCENT : 0x8B5E3C;
      var leafGeo = new THREE.BoxGeometry(leafWidth, op.height, thick);
      var leafMat = new THREE.MeshStandardMaterial({ color: doorColor, flatShading: true });
      addPiece(new THREE.Mesh(leafGeo, leafMat), op.height / 2);
      addPiece(new THREE.LineSegments(new THREE.EdgesGeometry(leafGeo), new THREE.LineBasicMaterial({ color: 0x1B1C1E })), op.height / 2);
    } else {
      var glassColor = isSelected ? SELECTED_ACCENT : 0xBFE3F0;
      var glassHeight = Math.max(0.1, op.height - 0.06);
      var midY = op.sillHeight + op.height / 2;
      var glassGeo = new THREE.BoxGeometry(leafWidth, glassHeight, thick * 0.5);
      var glassMat = new THREE.MeshStandardMaterial({ color: glassColor, flatShading: true, transparent: true, opacity: isSelected ? 0.75 : 0.45 });
      addPiece(new THREE.Mesh(glassGeo, glassMat), midY);
      var frameGeo = new THREE.BoxGeometry(op.width, op.height, thick);
      addPiece(new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo), new THREE.LineBasicMaterial({ color: isSelected ? SELECTED_ACCENT : 0x5F5E5A })), midY);
      var mullMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, flatShading: true });
      addPiece(new THREE.Mesh(new THREE.BoxGeometry(0.03, glassHeight, thick * 0.55), mullMat), midY);
      addPiece(new THREE.Mesh(new THREE.BoxGeometry(leafWidth, 0.03, thick * 0.55), mullMat), midY);
    }
    return pieces;
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

  function buildRoofDuasAguas(topBounds: any, topY: any, roofColor: any, gableColor: any, pitchDeg: any, ridgeAxis: any, tabeiraColor: any) {
    var meshes: any[] = [];
    var ridgeAlongX = ridgeAxis === 'x';
    var pitchRad = pitchDeg * Math.PI / 180;
    var verticalDrop = ROOF_THICKNESS / Math.cos(pitchRad);
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
      var gMinX = topBounds.minX - GABLE_WALL_EXTEND, gMaxX = topBounds.maxX + GABLE_WALL_EXTEND;
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMinX, y: topY, z: eMinZ }, { x: eMaxX, y: topY, z: eMinZ },
        { x: eMaxX, y: ridgeY, z: ridgeZ }, { x: eMinX, y: ridgeY, z: ridgeZ }
      ], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMaxX, y: topY, z: eMaxZ }, { x: eMinX, y: topY, z: eMaxZ },
        { x: eMinX, y: ridgeY, z: ridgeZ }, { x: eMaxX, y: ridgeY, z: ridgeZ }
      ], verticalDrop, roofColor, tabeiraColor));
      meshes.push(buildQuadMesh(
        { x: gMinX, y: topY, z: topBounds.minZ }, { x: gMinX, y: topY, z: topBounds.maxZ },
        { x: gMinX, y: gableBaseY, z: topBounds.maxZ }, { x: gMinX, y: gableBaseY, z: topBounds.minZ }, gableColor));
      meshes.push(buildTriMesh({ x: gMinX, y: gableBaseY, z: topBounds.minZ }, { x: gMinX, y: gableBaseY, z: topBounds.maxZ }, { x: gMinX, y: ridgeY, z: ridgeZ }, gableColor));
      meshes.push(buildQuadMesh(
        { x: gMaxX, y: topY, z: topBounds.maxZ }, { x: gMaxX, y: topY, z: topBounds.minZ },
        { x: gMaxX, y: gableBaseY, z: topBounds.minZ }, { x: gMaxX, y: gableBaseY, z: topBounds.maxZ }, gableColor));
      meshes.push(buildTriMesh({ x: gMaxX, y: gableBaseY, z: topBounds.maxZ }, { x: gMaxX, y: gableBaseY, z: topBounds.minZ }, { x: gMaxX, y: ridgeY, z: ridgeZ }, gableColor));
      meshes.push(buildRidgeCapMesh({ x: eMinX, y: ridgeY, z: ridgeZ }, { x: eMaxX, y: ridgeY, z: ridgeZ }, roofColor, pitchRad));
    } else {
      var eMinX2 = topBounds.minX - ROOF_OVERHANG, eMaxX2 = topBounds.maxX + ROOF_OVERHANG;
      var eMinZ2 = topBounds.minZ - RAKE_OVERHANG, eMaxZ2 = topBounds.maxZ + RAKE_OVERHANG;
      var ridgeX = (topBounds.minX + topBounds.maxX) / 2;
      var halfSpan2 = (eMaxX2 - eMinX2) / 2;
      var ridgeY2 = topY + halfSpan2 * Math.tan(pitchRad);
      var gableBaseY2 = topY + gableBaseRise;
      var gMinZ2 = topBounds.minZ - GABLE_WALL_EXTEND, gMaxZ2 = topBounds.maxZ + GABLE_WALL_EXTEND;
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMinX2, y: topY, z: eMinZ2 }, { x: eMinX2, y: topY, z: eMaxZ2 },
        { x: ridgeX, y: ridgeY2, z: eMaxZ2 }, { x: ridgeX, y: ridgeY2, z: eMinZ2 }
      ], verticalDrop, roofColor, tabeiraColor));
      meshes.push.apply(meshes, extrudeSlopeDown([
        { x: eMaxX2, y: topY, z: eMaxZ2 }, { x: eMaxX2, y: topY, z: eMinZ2 },
        { x: ridgeX, y: ridgeY2, z: eMinZ2 }, { x: ridgeX, y: ridgeY2, z: eMaxZ2 }
      ], verticalDrop, roofColor, tabeiraColor));
      meshes.push(buildQuadMesh(
        { x: topBounds.minX, y: topY, z: gMinZ2 }, { x: topBounds.maxX, y: topY, z: gMinZ2 },
        { x: topBounds.maxX, y: gableBaseY2, z: gMinZ2 }, { x: topBounds.minX, y: gableBaseY2, z: gMinZ2 }, gableColor));
      meshes.push(buildTriMesh({ x: topBounds.minX, y: gableBaseY2, z: gMinZ2 }, { x: topBounds.maxX, y: gableBaseY2, z: gMinZ2 }, { x: ridgeX, y: ridgeY2, z: gMinZ2 }, gableColor));
      meshes.push(buildQuadMesh(
        { x: topBounds.maxX, y: topY, z: gMaxZ2 }, { x: topBounds.minX, y: topY, z: gMaxZ2 },
        { x: topBounds.minX, y: gableBaseY2, z: gMaxZ2 }, { x: topBounds.maxX, y: gableBaseY2, z: gMaxZ2 }, gableColor));
      meshes.push(buildTriMesh({ x: topBounds.maxX, y: gableBaseY2, z: gMaxZ2 }, { x: topBounds.minX, y: gableBaseY2, z: gMaxZ2 }, { x: ridgeX, y: ridgeY2, z: gMaxZ2 }, gableColor));
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

  // Quatro paredes baixas formando um quadro ao redor do perímetro —
  // o parapeito da platibanda.
  function buildParapetWalls(bounds: any, topY: any, height: any, thickness: any, color: any) {
    var meshes: any[] = [];
    function seg(x1: any, z1: any, x2: any, z2: any) {
      var dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      var geo = new THREE.BoxGeometry(len + thickness, height, thickness);
      var mat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
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

  // Platibanda: laje plana + parapeito baixo escondendo a borda. Sem
  // cumeeira, sem vale — funciona pra qualquer formato de casa.
  function buildRoofPlatibanda(topBounds: any, topY: any, roofColor: any) {
    var PARAPET_HEIGHT = 0.5, PARAPET_THICK = 0.1;
    var meshes: any[] = [];
    var flatShape = rectShape(topBounds);
    meshes.push(makeSlabMesh(flatShape, ROOF_THICKNESS, topY + ROOF_THICKNESS, roofColor, 1));
    meshes = meshes.concat(buildParapetWalls(topBounds, topY, PARAPET_HEIGHT, PARAPET_THICK, GABLE_COLOR));
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

  // Constrói UM telhado colocado (objeto persistente), convertendo do
  // espaço de modelo pro de mundo e despachando pro tipo certo.
  function buildRoofPiece(roof: any, scale: any, offsetX: any, offsetY: any, floorTopY: any, viewState: any) {
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
    var gableColor = pickColor(GABLE_COLOR, 'telhado', viewState);
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
    if (roof.type === 'platibanda') return buildRoofPlatibanda(bounds, floorTopY, roofColor);
    return buildRoofDuasAguas(bounds, floorTopY, roofColor, gableColor, pitchDeg, ridgeAxis, tabeiraColor);
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

  function makeSlabMesh(shape: any, thickness: any, topY: any, color: any, opacity: any, polyOffset?: any) {
    var geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    var matOpts: any = { color: color, side: THREE.DoubleSide, transparent: opacity < 1, opacity: opacity };
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
      var shape = buildInsetFrameShape(bounds, BALDRAME_WIDTH);
      return makeSlabMesh(shape, BALDRAME_THICKNESS, BALDRAME_THICKNESS, color, 1);
    }
    var radierShape = rectShape({
      minX: bounds.minX - RADIER_MARGIN, maxX: bounds.maxX + RADIER_MARGIN,
      minZ: bounds.minZ - RADIER_MARGIN, maxZ: bounds.maxZ + RADIER_MARGIN
    });
    return makeSlabMesh(radierShape, RADIER_THICKNESS, RADIER_THICKNESS, color, 1);
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
      if (mat.map) mat.map.dispose();
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

      // prévia de verdade (a mesma geometria que vai nascer), só translúcida
      var ghostRoof = { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, type: p.roofType, pitchDeg: p.pitchDeg };
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
  function renderSelectionHandles(scene: any, viewState: any, scale: any, offsetX: any, offsetY: any) {
    if (viewState.selectedWall) {
      var w = viewState.selectedWall, yOffset = viewState.editingYOffset;
      [[w.x1, w.y1, 1], [w.x2, w.y2, 2]].forEach(function (pt) {
        var wx = (pt[0] - offsetX) * scale, wz = (pt[1] - offsetY) * scale;
        var geo = new THREE.SphereGeometry(0.09, 12, 12);
        var mat = new THREE.MeshBasicMaterial({ color: SELECTED_ACCENT, depthTest: false });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 999;
        mesh.position.set(wx, yOffset + WALL_HEIGHT / 2, wz);
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
      var wallCenterY = yOffset + WALL_HEIGHT / 2;
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
    }
    if (viewState.selectedRoof) {
      var r = viewState.selectedRoof, roofYOffset = viewState.editingYOffset;
      var topY = roofYOffset + WALL_HEIGHT;
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
        scene.add(mesh2);
        registry.handleMeshes.push(mesh2);
        var pole = ridgeLineMesh(new THREE.Vector3(wx2, topY, wz2), new THREE.Vector3(wx2, ridgeY, wz2));
        pole.material.depthTest = false;
        pole.renderOrder = 998;
        scene.add(pole);
        registry.handleMeshes.push(pole);
      }
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
  }

  export function rebuild(scene: THREE.Scene, project: Project, canvasSize: any, viewState: ViewState) {
    clearRegistry();

    var scale = 1 / Core.GRID, offsetX = 0, offsetY = 0;
    var layers = project.layers;
    var editingIdx = viewState.editingFloorIndex != null ? viewState.editingFloorIndex : project.currentFloorIndex;

    project.floors.forEach(function (floorData, floorIdx) {
      // pavimentos ACIMA do que está sendo editado ficam escondidos, pra
      // manter o foco — igual o editor antigo só mostrava um de cada vez
      if (floorIdx > editingIdx) return;

      var yOffset = floorIdx * FLOOR_STACK_HEIGHT;
      var isGroundFloor = floorIdx === 0;
      var wallCategory: keyof typeof layers = isGroundFloor ? 'paredesTerreo' : 'paredesSuperiores';
      var wallsVisible = layers[wallCategory];
      var rooms = Core.detectRooms(floorData.walls);
      var wallFootprints = Core.computeWallFootprints(floorData.walls);

      if (floorIdx > 0 && layers.laje) {
        var belowFloor = project.floors[floorIdx - 1]!;
        var belowColumns = layers.colunas ? belowFloor.columns : null;
        var lajeBounds = computeWorldBounds(belowFloor.walls, belowColumns, scale, offsetX, offsetY) || { minX: -3, maxX: 3, minZ: -3, maxZ: 3 };
        var lajeShape = rectShape(lajeBounds);
        var lajeSlab = tagCategory(makeSlabMesh(lajeShape, LAJE_THICKNESS, yOffset, pickColor(0x8B8B85, 'laje', viewState), 1), 'laje');
        lajeSlab.userData.floorIndex = floorIdx;
        scene.add(lajeSlab);
        registry.roomMeshes.push(lajeSlab);
        var lajeEdges = new THREE.EdgesGeometry(lajeSlab.geometry);
        var lajeEdgeLines = new THREE.LineSegments(lajeEdges, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
        lajeEdgeLines.rotation.copy(lajeSlab.rotation); lajeEdgeLines.position.copy(lajeSlab.position);
        scene.add(lajeEdgeLines);
        registry.roomMeshes.push(lajeEdgeLines);
      }

      if (wallsVisible) {
        floorData.walls.forEach(function (w) {
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
          var wallOpenings = (floorData.openings || []).filter(function (o) { return o.wallId === w.id; });
          var wallLenM = Core.wallLengthMeters(w);
          var bands = wallOpenings.length ? computeWallOpeningBands(wallLenM, wallOpenings) : null;

          if (!bands) {
            var refMesh = tagCategory(buildWallMeshFromFootprint(fp, WALL_HEIGHT, yOffset, refMat), wallCategory);
            refMesh.userData.wallId = w.id; refMesh.userData.floorIndex = floorIdx;
            scene.add(refMesh);
            registry.wallMeshes.push(refMesh);

            var edgeLines = buildWallFootprintEdgeLines(fp, WALL_HEIGHT, yOffset);
            scene.add(edgeLines);
            registry.wallMeshes.push(edgeLines);
          } else {
            // Sem contorno de aresta único aqui de propósito: uma parede
            // com vão não tem mais um retângulo simples de silhueta —
            // cada banda desenha a própria caixa (com tampa nas pontas
            // novas), o que já basta pra leitura visual do vão. Uma
            // limitação conhecida do MVP: sem a linha fina de contorno
            // que as paredes cegas têm.
            bands.forEach(function (band) {
              var capA = band.edgeA ? (fp.p1Free !== false || fp.p1Extended) : true;
              var capB = band.edgeB ? (fp.p2Free !== false || fp.p2Extended) : true;
              var bandMesh = tagCategory(buildWallBandMesh(fp, yOffset + band.y0, yOffset + band.y1, band.tA, band.tB, refMat, capA, capB), wallCategory);
              bandMesh.userData.wallId = w.id; bandMesh.userData.floorIndex = floorIdx;
              scene.add(bandMesh);
              registry.wallMeshes.push(bandMesh);
            });
          }

          // As duas faces (lado A / lado B), cada uma com seu próprio
          // acabamento do Catálogo — mesmo contorno fp de cima, então
          // se encontram exatas com a face da parede vizinha no canto,
          // sem sobrepor (a mesma correção que já vale pra caixa toda).
          var wallDefaultColor = 0xB5D4F4;
          var idNum = parseInt(String(w.id).split('_').pop()!, 10) || 0;
          ['a', 'b'].forEach(function (side) {
            var productId = side === 'a' ? w.finishA : w.finishB;
            var product = productId && Catalog.getProduct(productId);
            var faceColorHex = product ? parseInt(product.assets.colorHex.slice(1), 16) : wallDefaultColor;
            var faceColor = highlighted ? SELECTED_ACCENT : (DEBUG_COLOR_MODE ? hashColorHex(w.id + '-' + side) : faceColorHex);
            var faceMat = new THREE.MeshStandardMaterial({
              color: (floorIdx === editingIdx && !DEBUG_COLOR_MODE) ? pickColor(faceColor, wallCategory, viewState) : faceColor,
              flatShading: true,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1 + (idNum % 50) * 0.5,
              polygonOffsetUnits: 1
            });
            // Sem tagCategory/wallId de propósito: a face não é alvo de
            // clique próprio — a caixa de referência (mesma posição)
            // já cobre isso, então o clique passa direto pra ela.
            if (!bands) {
              var faceMesh = buildFaceStripMesh(fp, WALL_HEIGHT, yOffset, faceMat, side);
              faceMesh.userData.floorIndex = floorIdx;
              faceMesh.userData.debugWallId = w.id;
              faceMesh.userData.debugSide = side;
              scene.add(faceMesh);
              registry.wallMeshes.push(faceMesh);
            } else {
              bands.forEach(function (band) {
                var faceBandMesh = buildFaceBandMesh(fp, yOffset + band.y0, yOffset + band.y1, band.tA, band.tB, faceMat, side);
                faceBandMesh.userData.floorIndex = floorIdx;
                faceBandMesh.userData.debugWallId = w.id;
                faceBandMesh.userData.debugSide = side;
                scene.add(faceBandMesh);
                registry.wallMeshes.push(faceBandMesh);
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
          if (!w) return;
          var isSelected = viewState.selectedOpening && viewState.selectedOpening.id === op.id;
          var pieces = buildOpeningPieces(op, w, scale, offsetX, offsetY, yOffset, isSelected);
          pieces.forEach(function (m, i) {
            if (i === 0 && m.isMesh) {
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
          var geo = c.shape === 'redonda' ? new THREE.CylinderGeometry(half, half, WALL_HEIGHT, 20) : new THREE.BoxGeometry(half * 2, WALL_HEIGHT, half * 2);
          var mesh = tagCategory(new THREE.Mesh(geo, mat), 'colunas');
          mesh.userData.columnId = c.id; mesh.userData.floorIndex = floorIdx;
          mesh.position.set(cx, WALL_HEIGHT / 2 + yOffset, cz);
          scene.add(mesh);
          registry.wallMeshes.push(mesh);
          var edges = new THREE.EdgesGeometry(geo);
          var edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
          edgeLines.position.copy(mesh.position);
          scene.add(edgeLines);
          registry.wallMeshes.push(edgeLines);
        });
      }

      if (layers.telhado && floorData.roofs) {
        var roofTopY = yOffset + WALL_HEIGHT;
        floorData.roofs.forEach(function (roof) {
          var pieces = buildRoofPiece(roof, scale, offsetX, offsetY, roofTopY, viewState);
          pieces.forEach(function (m) {
            tagCategory(m, 'telhado');
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
        var insetPoints = room.points.map(function (p1: any, i: any) {
          var p2 = room.points[(i + 1) % room.points.length]!;
          var midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
          var bestWall: any = null, bestDist = Infinity;
          floorData.walls.forEach(function (w: any) {
            var d = Core.distToSegment(midX, midY, w.x1, w.y1, w.x2, w.y2);
            if (d < bestDist) { bestDist = d; bestWall = w; }
          });
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
        var pisoBaseColor = roomFinish ? parseInt(roomFinish.assets.colorHex.slice(1), 16) : 0xCFE8CF;
        var pisoColorFinal = DEBUG_COLOR_MODE ? hashColorHex('room:' + roomKey) : pisoBaseColor;
        var color = DEBUG_COLOR_MODE ? pisoColorFinal : pickColor(pisoColorFinal, 'laje', viewState);
        var mesh = tagCategory(makeSlabMesh(shape, thickness, pisoTopY, color, 1, true), 'laje');
        mesh.userData.debugRoomKey = roomKey;
        scene.add(mesh);
        registry.roomMeshes.push(mesh);
        var roomEdges = new THREE.EdgesGeometry(mesh.geometry);
        var roomEdgeLines = new THREE.LineSegments(roomEdges, new THREE.LineBasicMaterial({ color: 0x1B1C1E }));
        roomEdgeLines.rotation.copy(mesh.rotation); roomEdgeLines.position.copy(mesh.position);
        scene.add(roomEdgeLines);
        registry.roomMeshes.push(roomEdgeLines);
      });
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

    renderDrawPreview(scene, viewState, scale, offsetX, offsetY);
    renderSelectionHandles(scene, viewState, scale, offsetX, offsetY);
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

// Namespace de compatibilidade — mesma razão de Core.ts/Store.ts/Catalog.ts
// (chamadas Scene3DRenderer.xxx no código legado, enquanto
// ViewportController ainda não foi migrado).
export const Scene3DRenderer = {
  rebuild,
  FLOOR_STACK_HEIGHT_GETTER,
  WALL_HEIGHT_GETTER,
  ROOF_OVERHANG_GETTER,
  RAKE_OVERHANG_GETTER,
  RADIER_THICKNESS_GETTER,
  RADIER_MARGIN_GETTER,
  BALDRAME_WIDTH_GETTER,
  BALDRAME_THICKNESS_GETTER
};
