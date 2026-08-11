import { Core } from './Core.js';
import { Store } from './Store.js';
import type { Opening, Wall } from './types.js';

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

  public render(selectedWallIds: ReadonlySet<string> = new Set(), preview?: { x1: number; y1: number; x2: number; y2: number }): void {
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
    floor.lajes?.forEach((laje) => {
      if (laje.points.length >= 3) scene.append(svgElement('polygon', {
        points: laje.points.map((point) => `${point.x},${point.y}`).join(' '), class: 'scene2d-laje',
      }));
    });
    floor.roofs?.forEach((roof) => scene.append(svgElement('rect', {
      x: Math.min(roof.x1, roof.x2), y: Math.min(roof.y1, roof.y2),
      width: Math.abs(roof.x2 - roof.x1), height: Math.abs(roof.y2 - roof.y1), class: 'scene2d-roof',
    })));
    floor.walls.forEach((wall) => wallLine(scene, wall, 'scene2d-wall', selectedWallIds.has(wall.id)));
    floor.openings.forEach((opening) => {
      const wall = floor.walls.find((candidate) => candidate.id === opening.wallId)
        ?? project.terreno?.muros.find((candidate) => candidate.id === opening.wallId);
      if (wall) openingSymbol(scene, opening, wall);
    });
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
