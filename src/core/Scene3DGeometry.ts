import type { Opening } from './types.js';

// Largura visual do marco/batente. O valor coincide com a folga de 3 cm
// que já era deixada em cada lado da folha e do vidro; agora essa folga
// passa a ser ocupada por geometria real, em vez de mostrar o fundo.
export const OPENING_FRAME_FACE_WIDTH = 0.03;
// Pequena sobreposicao visual entre batente e alvenaria. Um encontro
// matematicamente coplanar pode revelar o fundo por antialiasing; 2 mm
// cobrem a junta sem alterar a largura livre nominal do vao.
export const OPENING_FRAME_SEAL_OVERLAP = 0.002;

export interface OpeningFrameBar {
  width: number;
  height: number;
  depth: number;
  centerX: number;
  centerY: number;
}

export interface OpeningAssemblyLayout {
  infillWidth: number;
  infillHeight: number;
  infillCenterY: number;
  frameBars: OpeningFrameBar[];
}

// Calcula a montagem 2D da esquadria no plano local da parede. O marco
// ocupa todo o contorno do vão e atravessa a espessura completa da parede;
// a folha/vidro ocupa exatamente a área interna restante.
export function computeOpeningAssemblyLayout(
  opening: Pick<Opening, 'kind' | 'width' | 'height' | 'sillHeight'>,
  wallThickness: number,
): OpeningAssemblyLayout {
  const frame = Math.min(
    OPENING_FRAME_FACE_WIDTH,
    Math.max(0.005, opening.width / 4),
    Math.max(0.005, opening.height / 4),
  );
  const infillWidth = Math.max(0.01, opening.width - frame * 2);
  const isDoor = opening.kind === 'door';
  const infillHeight = Math.max(0.01, opening.height - frame * (isDoor ? 1 : 2));
  const baseY = isDoor ? 0 : opening.sillHeight + frame;
  const frameBars: OpeningFrameBar[] = [
    {
      width: frame + OPENING_FRAME_SEAL_OVERLAP,
      height: opening.height,
      depth: wallThickness + OPENING_FRAME_SEAL_OVERLAP * 2,
      centerX: -opening.width / 2 + (frame - OPENING_FRAME_SEAL_OVERLAP) / 2,
      centerY: opening.sillHeight + opening.height / 2,
    },
    {
      width: frame + OPENING_FRAME_SEAL_OVERLAP,
      height: opening.height,
      depth: wallThickness + OPENING_FRAME_SEAL_OVERLAP * 2,
      centerX: opening.width / 2 - (frame - OPENING_FRAME_SEAL_OVERLAP) / 2,
      centerY: opening.sillHeight + opening.height / 2,
    },
    {
      width: infillWidth,
      height: frame + OPENING_FRAME_SEAL_OVERLAP,
      depth: wallThickness + OPENING_FRAME_SEAL_OVERLAP * 2,
      centerX: 0,
      centerY: opening.sillHeight + opening.height - (frame - OPENING_FRAME_SEAL_OVERLAP) / 2,
    },
  ];

  // Porta permanece sem soleira. A janela recebe também o marco inferior,
  // encostado no peitoril, fechando os quatro lados do vão.
  if (!isDoor) {
    frameBars.push({
      width: infillWidth,
      height: frame + OPENING_FRAME_SEAL_OVERLAP,
      depth: wallThickness + OPENING_FRAME_SEAL_OVERLAP * 2,
      centerX: 0,
      centerY: opening.sillHeight + (frame - OPENING_FRAME_SEAL_OVERLAP) / 2,
    });
  }

  return {
    infillWidth,
    infillHeight,
    infillCenterY: baseY + infillHeight / 2,
    frameBars,
  };
}

// Dois triângulos coplanares formam apenas a face superior do footprint.
// Nenhuma margem ou espessura extra é criada: quinas e junções continuam
// obedecendo exatamente à topologia calculada pelo Core.
export function wallTopTriangleVertices(
  footprint: {
    p1a: { x: number; y?: number; z?: number };
    p2a: { x: number; y?: number; z?: number };
    p2b: { x: number; y?: number; z?: number };
    p1b: { x: number; y?: number; z?: number };
  },
  y: number,
): number[] {
  const points = [footprint.p1a, footprint.p2a, footprint.p2b, footprint.p1b];
  const order = [0, 1, 2, 0, 2, 3];
  const vertices: number[] = [];
  order.forEach((index) => {
    const point = points[index]!;
    const z = point.z ?? point.y;
    if (z == null) throw new Error('Ponto do footprint sem coordenada y/z');
    vertices.push(point.x, y, z);
  });
  return vertices;
}

export interface WallBandSideParameters {
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

// Converte distancias medidas no eixo ORIGINAL da parede em parametros
// independentes das duas faces do footprint. As pontas do footprint podem
// ter sido prolongadas/mitradas para fechar quinas; usar diretamente
// distancia/comprimento nesse contorno deslocava o recorte do vao, embora a
// porta continuasse posicionada pelo eixo original.
export function wallBandSideParameters(
  footprint: {
    p1a: { x: number; z: number };
    p2a: { x: number; z: number };
    p2b: { x: number; z: number };
    p1b: { x: number; z: number };
  },
  axisStart: { x: number; z: number },
  axisEnd: { x: number; z: number },
  startDistance: number,
  endDistance: number,
): WallBandSideParameters {
  const dx = axisEnd.x - axisStart.x;
  const dz = axisEnd.z - axisStart.z;
  const length = Math.hypot(dx, dz) || 1e-9;
  const ux = dx / length;
  const uz = dz / length;
  const parameterAtDistance = (
    sideStart: { x: number; z: number },
    sideEnd: { x: number; z: number },
    distance: number,
    boundary: 'start' | 'end' | null,
  ) => {
    // As extremidades externas da primeira e da ultima banda precisam
    // conservar o footprint inteiro, inclusive os prolongamentos/mitras que
    // fecham os cantos. Somente as bordas internas do vao sao projetadas no
    // eixo original da parede.
    if (boundary === 'start') return 0;
    if (boundary === 'end') return 1;
    const projectedStart = (sideStart.x - axisStart.x) * ux + (sideStart.z - axisStart.z) * uz;
    const projectedEnd = (sideEnd.x - axisStart.x) * ux + (sideEnd.z - axisStart.z) * uz;
    const span = projectedEnd - projectedStart;
    return Math.abs(span) < 1e-9 ? 0 : (distance - projectedStart) / span;
  };

  const startBoundary = startDistance <= 1e-9 ? 'start' : null;
  const endBoundary = endDistance >= length - 1e-9 ? 'end' : null;

  return {
    aStart: parameterAtDistance(footprint.p1a, footprint.p2a, startDistance, startBoundary),
    aEnd: parameterAtDistance(footprint.p1a, footprint.p2a, endDistance, endBoundary),
    bStart: parameterAtDistance(footprint.p1b, footprint.p2b, startDistance, startBoundary),
    bEnd: parameterAtDistance(footprint.p1b, footprint.p2b, endDistance, endBoundary),
  };
}
