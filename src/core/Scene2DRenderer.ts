import { Core } from './Core.js';
import { Store } from './Store.js';
import type { Opening, Wall, WallSnapshot } from './types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function wallLine(group: SVGGElement, wall: Wall, className = 'scene2d-wall', selected = false): void {
  const line = svgElement('line', {
    x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
    class: `${className}${selected ? ' scene2d-selected' : ''}`,
    'stroke-width': Math.max(Core.WALL_THICK * Core.GRID, 2.4),
    'data-wall-id': wall.id,
  });
  group.append(line);
  if (selected && className === 'scene2d-wall') {
    group.append(svgElement('circle', {
      cx: (wall.x1 + wall.x2) * 0.5,
      cy: (wall.y1 + wall.y2) * 0.5,
      r: 4.5,
      class: 'scene2d-wall-handle',
      'data-wall-resize-id': wall.id,
    }));
  }
}

// Cota temporária de arraste — linha tracejada paralela à parede,
// deslocada um pouco pra fora, com o comprimento no meio. Só é chamada
// enquanto uma parede está sendo redimensionada (wallDragPreview);
// como o render() inteiro é refeito a cada frame de arraste e de novo
// sem esse parâmetro ao soltar, a linha desaparece sozinha — sem
// precisar de nenhum estado/limpeza própria (mesmo raciocínio do
// dragPreview/scene2d-drag-preview já usado pra parede fantasma).
function dimensionLine(group: SVGGElement, x1: number, y1: number, x2: number, y2: number): void {
  const dx = x2 - x1, dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return; // parede degenerada (unidades de grade) — nada pra cotar
  const ux = dx / length, uy = dy / length;
  const nx = -uy, ny = ux;
  const offset = Core.GRID * 0.2; // ~20cm pra fora da parede, não em cima dela
  const lx1 = x1 + nx * offset, ly1 = y1 + ny * offset;
  const lx2 = x2 + nx * offset, ly2 = y2 + ny * offset;
  group.append(svgElement('line', { x1: lx1, y1: ly1, x2: lx2, y2: ly2, class: 'scene2d-dim-line' }));
  const text = svgElement('text', {
    x: (lx1 + lx2) / 2, y: (ly1 + ly2) / 2, class: 'scene2d-dim-text',
  });
  text.textContent = (length / Core.GRID).toFixed(2).replace('.', ',') + ' m';
  group.append(text);
}

function openingSymbol(group: SVGGElement, opening: Opening, wall: Wall): void {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;
  const ux = dx / length;
  const uy = dy / length;
  const centerDistance = opening.offset * Core.GRID;
  const halfWidth = opening.width * Core.GRID * 0.5;
  const cx = wall.x1 + ux * centerDistance;
  const cy = wall.y1 + uy * centerDistance;
  const x1 = cx - ux * halfWidth;
  const y1 = cy - uy * halfWidth;
  const x2 = cx + ux * halfWidth;
  const y2 = cy + uy * halfWidth;
  group.append(svgElement('line', { x1, y1, x2, y2, class: 'scene2d-opening-gap', 'stroke-width': Math.max(Core.WALL_THICK * Core.GRID + 1.5, 4) }));
  if (opening.kind === 'window') {
    group.append(svgElement('line', { x1, y1, x2, y2, class: 'scene2d-window', 'stroke-width': 1.2 }));
    return;
  }
  const nx = -uy;
  const ny = ux;
  group.append(svgElement('line', {
    x1, y1, x2: x1 + nx * opening.width * Core.GRID, y2: y1 + ny * opening.width * Core.GRID,
    class: 'scene2d-door', 'stroke-width': 1.2,
  }));
}

export class Scene2DRenderer {
  public constructor(private readonly svg: SVGSVGElement) {}

  public render(
    selectedWallIds: ReadonlySet<string> = new Set(),
    preview?: { x1: number; y1: number; x2: number; y2: number },
    dragPreview?: { snapshots: WallSnapshot[]; dx: number; dy: number },
    wallDragPreview?: WallSnapshot[],
  ): void {
    this.svg.replaceChildren();
    const project = Store.getProject();
    const floor = project.floors[project.currentFloorIndex];
    if (!floor) return;
    const scene = svgElement('g', { class: 'scene2d-model' });
    if (project.terreno) {
      scene.append(svgElement('rect', {
        x: 0, y: 0, width: project.terreno.larguraM * Core.GRID,
        height: project.terreno.comprimentoM * Core.GRID, class: 'scene2d-terreno',
      }));
      project.terreno.muros.forEach((wall) => wallLine(scene, wall, 'scene2d-muro', selectedWallIds.has(wall.id)));
    }
    // Laje: passou a nascer automática por cômodo fechado (mesmo
    // Core.detectRooms usado pelo 3D pro piso) — não é mais um objeto
    // independente guardado em floor.lajes. No 2D isso vira um
    // preenchimento leve por cômodo, em vez do retângulo único que a
    // laje manual antiga desenhava.
    Core.detectRooms(floor.walls).forEach((room) => {
      if (room.points.length >= 3) scene.append(svgElement('polygon', {
        points: room.points.map((point) => `${point.x},${point.y}`).join(' '), class: 'scene2d-laje',
      }));
    });
    floor.roofs?.forEach((roof) => scene.append(svgElement('rect', {
      x: Math.min(roof.x1, roof.x2), y: Math.min(roof.y1, roof.y2),
      width: Math.abs(roof.x2 - roof.x1), height: Math.abs(roof.y2 - roof.y1), class: 'scene2d-roof',
    })));
    // "Quebrar parede" (Wall.demolished) — mesmo raciocínio do 3D: some
    // do DESENHO, mas continua no modelo (senão o cômodo se abriria e o
    // piso sumiria). No 2D isso é simplesmente pular a linha e o símbolo
    // de abertura correspondente.
    floor.walls.forEach((wall) => { if (!wall.demolished) wallLine(scene, wall, 'scene2d-wall', selectedWallIds.has(wall.id)); });
    floor.openings.forEach((opening) => {
      const wall = floor.walls.find((candidate) => candidate.id === opening.wallId)
        ?? project.terreno?.muros.find((candidate) => candidate.id === opening.wallId);
      if (wall && !wall.demolished) openingSymbol(scene, opening, wall);
    });
    if (dragPreview) {
      const previewGroup = svgElement('g', { class: 'scene2d-drag-preview' });
      dragPreview.snapshots.forEach((snapshot) => {
        const wall: Wall = {
          ...snapshot,
          x1: snapshot.x1 + dragPreview.dx,
          y1: snapshot.y1 + dragPreview.dy,
          x2: snapshot.x2 + dragPreview.dx,
          y2: snapshot.y2 + dragPreview.dy,
        };
        wallLine(previewGroup, wall, 'scene2d-wall');
        floor.openings
          .filter((opening) => opening.wallId === snapshot.id)
          .forEach((opening) => openingSymbol(previewGroup, opening, wall));
      });
      scene.append(previewGroup);
    }
    if (wallDragPreview) {
      const previewGroup = svgElement('g', { class: 'scene2d-drag-preview' });
      // Cota fica num grupo IRMÃO, fora de scene2d-drag-preview — esse
      // grupo tem opacity .52 (visual de "fantasma" pra parede), e
      // opacity de pai não dá pra "desfazer" no filho (composição
      // multiplicativa) — a cota precisa ficar legível, opacidade cheia.
      const dimGroup = svgElement('g', { class: 'scene2d-dim-preview' });
      wallDragPreview.forEach((wall) => {
        wallLine(previewGroup, wall, 'scene2d-wall');
        dimensionLine(dimGroup, wall.x1, wall.y1, wall.x2, wall.y2);
      });
      scene.append(previewGroup);
      scene.append(dimGroup);
    }
    floor.columns?.forEach((column) => {
      const size = Core.COLUMN_SIZE;
      scene.append(column.shape === 'redonda'
        ? svgElement('circle', { cx: column.x, cy: column.y, r: size * 0.5, class: 'scene2d-column' })
        : svgElement('rect', { x: column.x - size * 0.5, y: column.y - size * 0.5, width: size, height: size, class: 'scene2d-column' }));
    });
    if (preview) scene.append(svgElement('rect', {
      x: Math.min(preview.x1, preview.x2), y: Math.min(preview.y1, preview.y2),
      width: Math.abs(preview.x2 - preview.x1), height: Math.abs(preview.y2 - preview.y1),
      class: 'scene2d-room-preview',
    }));
    this.svg.append(scene);
  }
}