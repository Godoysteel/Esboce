import { Core } from './Core.js';
import { Scene2DRenderer } from './Scene2DRenderer.js';
import { Store } from './Store.js';
import type { WallSnapshot } from './types.js';

type ViewBox = { x: number; y: number; width: number; height: number };
type WallEndpointLink = { id: string; which: 1 | 2 };

export class Viewport2DController {
  private readonly renderer: Scene2DRenderer;
  private viewBox: ViewBox = { x: -100, y: -100, width: 600, height: 450 };
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private selectedWallIds = new Set<string>();
  private drawStart: { x: number; y: number } | null = null;
  private drawPreview: { x1: number; y1: number; x2: number; y2: number } | undefined;
  private roomDrag: {
    pointerId: number;
    start: { x: number; y: number };
    snapshots: WallSnapshot[];
    furnitureSnapshots: { id: string; x: number; y: number }[];
    dx: number;
    dy: number;
  } | null = null;
  private wallDrag: {
    pointerId: number;
    start: { x: number; y: number };
    target: WallSnapshot;
    wallsAtStart: WallSnapshot[];
    linksStart: WallEndpointLink[];
    linksEnd: WallEndpointLink[];
    nx: number;
    ny: number;
    offset: number;
    preview: WallSnapshot[];
  } | null = null;

  public constructor(private readonly container: HTMLElement, private readonly svg: SVGSVGElement) {
    this.renderer = new Scene2DRenderer(svg);
    this.bindNavigation();
  }

  public render(): void {
    this.renderer.render(
      this.selectedWallIds,
      this.drawPreview,
      this.roomDrag ?? undefined,
      this.wallDrag?.preview,
    );
    this.applyViewBox();
    this.updateScaleLabel();
  }
  public show(): void { this.container.hidden = false; this.fitProject(); this.render(); }
  public hide(): void { this.container.hidden = true; }

  public zoomBy(factor: number): void {
    const cx = this.viewBox.x + this.viewBox.width * 0.5;
    const cy = this.viewBox.y + this.viewBox.height * 0.5;
    this.viewBox.width = Math.max(40, Math.min(4000, this.viewBox.width * factor));
    this.viewBox.height = Math.max(30, Math.min(3000, this.viewBox.height * factor));
    this.viewBox.x = cx - this.viewBox.width * 0.5;
    this.viewBox.y = cy - this.viewBox.height * 0.5;
    this.applyViewBox(); this.updateScaleLabel();
  }

  private fitProject(): void {
    const project = Store.getProject();
    const floor = project.floors[project.currentFloorIndex];
    const points: { x: number; y: number }[] = [];
    floor?.walls.forEach((wall) => points.push({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }));
    floor?.lajes?.forEach((laje) => points.push(...laje.points));
    floor?.columns?.forEach((column) => points.push({ x: column.x, y: column.y }));
    if (project.terreno) points.push({ x: 0, y: 0 }, { x: project.terreno.larguraM * Core.GRID, y: project.terreno.comprimentoM * Core.GRID });
    if (!points.length) return;
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const padding = 60;
    const width = Math.max(160, maxX - minX + padding * 2);
    const height = Math.max(120, maxY - minY + padding * 2);
    const aspect = Math.max(0.5, this.container.clientWidth / Math.max(this.container.clientHeight, 1));
    this.viewBox = width / height > aspect
      ? { x: minX - padding, y: (minY + maxY) * 0.5 - width / aspect * 0.5, width, height: width / aspect }
      : { x: (minX + maxX) * 0.5 - height * aspect * 0.5, y: minY - padding, width: height * aspect, height };
  }

  private bindNavigation(): void {
    this.svg.addEventListener('wheel', (event) => { event.preventDefault(); event.stopPropagation(); this.zoomBy(event.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
    this.svg.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      const activeTool = document.querySelector<HTMLElement>('.tool-btn[data-tool].active')?.dataset.tool;
      if (activeTool === 'room') {
        const point = this.modelPoint(event);
        if (!this.drawStart) {
          this.drawStart = point;
          this.drawPreview = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
        } else {
          Store.commands.createRoom(this.drawStart.x, this.drawStart.y, point.x, point.y);
          Store.commands.splitWallsAtTJunctions();
          this.drawStart = null;
          this.drawPreview = undefined;
        }
        this.render();
        return;
      }
      const resizeWallId = (event.target as SVGElement)
        .closest<SVGElement>('[data-wall-resize-id]')?.dataset.wallResizeId;
      if (resizeWallId && event.button === 0) {
        this.startWallDrag(resizeWallId, event);
        return;
      }
      const wallId = (event.target as SVGElement).closest<SVGElement>('[data-wall-id]')?.dataset.wallId;
      if (wallId) {
        const roomIds = Core.findIsolatedRoomWallIds(Store.currentWalls(), wallId);
        this.selectedWallIds = new Set(roomIds ?? [wallId]);
        if (roomIds && event.button === 0) {
          const snapshots = roomIds.map((id) => {
            const wall = Store.findWall(id)!;
            return { id, x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
          });
          const xs = snapshots.flatMap((wall) => [wall.x1, wall.x2]);
          const ys = snapshots.flatMap((wall) => [wall.y1, wall.y2]);
          const minX = Math.min(...xs); const maxX = Math.max(...xs);
          const minY = Math.min(...ys); const maxY = Math.max(...ys);
          this.roomDrag = {
            pointerId: event.pointerId,
            start: this.modelPoint(event),
            snapshots,
            furnitureSnapshots: Store.currentFurniture()
              .filter((item) => item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY)
              .map((item) => ({ id: item.id, x: item.x, y: item.y })),
            dx: 0,
            dy: 0,
          };
          this.svg.setPointerCapture(event.pointerId);
          this.svg.classList.add('is-dragging-room');
        } else if (event.button === 0) {
          this.startWallDrag(wallId, event);
          return;
        }
        this.render();
        return;
      }
      this.selectedWallIds.clear();
      this.render();
      if (event.button !== 0 && event.button !== 1) return;
      this.dragging = true; this.lastPointer = { x: event.clientX, y: event.clientY };
      this.svg.setPointerCapture(event.pointerId); this.svg.classList.add('is-panning');
    });
    this.svg.addEventListener('pointermove', (event) => {
      event.stopPropagation();
      if (this.drawStart) {
        const point = this.modelPoint(event);
        this.drawPreview = { x1: this.drawStart.x, y1: this.drawStart.y, x2: point.x, y2: point.y };
        this.render();
        return;
      }
      if (this.roomDrag && event.pointerId === this.roomDrag.pointerId) {
        const point = this.modelPoint(event);
        this.roomDrag.dx = Core.snap(point.x - this.roomDrag.start.x);
        this.roomDrag.dy = Core.snap(point.y - this.roomDrag.start.y);
        this.render();
        return;
      }
      if (this.wallDrag && event.pointerId === this.wallDrag.pointerId) {
        const point = this.modelPoint(event);
        const rawDx = point.x - this.wallDrag.start.x;
        const rawDy = point.y - this.wallDrag.start.y;
        const requested = Core.snap(rawDx * this.wallDrag.nx + rawDy * this.wallDrag.ny);
        const resolved = Core.resolveWallResizeOffset(
          this.wallDrag.target,
          this.wallDrag.wallsAtStart,
          requested,
          this.wallDrag.nx,
          this.wallDrag.ny,
        );
        this.wallDrag.offset = resolved.offset;
        this.wallDrag.preview = this.wallResizePreview(this.wallDrag, resolved.offset);
        this.render();
        return;
      }
      if (!this.dragging) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.viewBox.x -= dx * this.viewBox.width / Math.max(this.svg.clientWidth, 1);
      this.viewBox.y -= dy * this.viewBox.height / Math.max(this.svg.clientHeight, 1);
      this.applyViewBox();
    });
    const finish = (event: PointerEvent) => {
      event.stopPropagation();
      if (this.roomDrag && event.pointerId === this.roomDrag.pointerId) {
        const drag = this.roomDrag;
        this.roomDrag = null;
        this.svg.classList.remove('is-dragging-room');
        if (drag.dx || drag.dy) {
          Store.commands.beginTransaction();
          Store.commands.updateWallsGroupBodyLive(drag.snapshots, drag.dx, drag.dy);
          drag.furnitureSnapshots.forEach((item) => {
            Store.commands.updateFurnitureBodyLive(item.id, item.x + drag.dx, item.y + drag.dy);
          });
          Store.commands.splitWallsAtTJunctions();
        }
        this.render();
        return;
      }
      if (this.wallDrag && event.pointerId === this.wallDrag.pointerId) {
        const drag = this.wallDrag;
        this.wallDrag = null;
        this.svg.classList.remove('is-dragging-wall');
        if (drag.offset) {
          const x1 = drag.target.x1 + drag.nx * drag.offset;
          const y1 = drag.target.y1 + drag.ny * drag.offset;
          const x2 = drag.target.x2 + drag.nx * drag.offset;
          const y2 = drag.target.y2 + drag.ny * drag.offset;
          const linked = drag.linksStart.map((link) => ({ ...link, x: x1, y: y1 }))
            .concat(drag.linksEnd.map((link) => ({ ...link, x: x2, y: y2 })));
          Store.commands.beginTransaction();
          Store.commands.updateWallResizeLive(drag.target.id, x1, y1, x2, y2, linked);
          Store.commands.splitWallsAtTJunctions();
        }
        this.render();
        return;
      }
      this.dragging = false;
      this.svg.classList.remove('is-panning');
    };
    this.svg.addEventListener('pointerup', finish);
    this.svg.addEventListener('pointercancel', finish);
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.drawStart) return;
      this.drawStart = null; this.drawPreview = undefined; this.render();
    });
  }

  private startWallDrag(wallId: string, event: PointerEvent): void {
    const wall = Store.findWall(wallId);
    if (!wall) return;
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dy) || 1;
    const topology = Core.wallResizeTopology(Store.currentWalls(), wallId);
    const target = { id: wall.id, x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
    this.selectedWallIds = new Set([wallId]);
    this.wallDrag = {
      pointerId: event.pointerId,
      start: this.modelPoint(event),
      target,
      wallsAtStart: Store.currentWalls().map((item) => ({
        id: item.id, x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2,
      })),
      linksStart: topology.start,
      linksEnd: topology.end,
      nx: Math.abs(dy / length) < 1e-6 ? 0 : -dy / length,
      ny: Math.abs(dx / length) < 1e-6 ? 0 : dx / length,
      offset: 0,
      preview: [target],
    };
    this.svg.setPointerCapture(event.pointerId);
    this.svg.classList.add('is-dragging-wall');
    this.render();
  }

  private wallResizePreview(drag: NonNullable<Viewport2DController['wallDrag']>, offset: number): WallSnapshot[] {
    const x1 = drag.target.x1 + drag.nx * offset;
    const y1 = drag.target.y1 + drag.ny * offset;
    const x2 = drag.target.x2 + drag.nx * offset;
    const y2 = drag.target.y2 + drag.ny * offset;
    const affected = new Set([
      drag.target.id,
      ...drag.linksStart.map((link) => link.id),
      ...drag.linksEnd.map((link) => link.id),
    ]);
    return drag.wallsAtStart.filter((wall) => affected.has(wall.id)).map((wall) => {
      if (wall.id === drag.target.id) return { ...wall, x1, y1, x2, y2 };
      const copy = { ...wall };
      drag.linksStart.filter((link) => link.id === wall.id).forEach((link) => {
        if (link.which === 1) { copy.x1 = x1; copy.y1 = y1; } else { copy.x2 = x1; copy.y2 = y1; }
      });
      drag.linksEnd.filter((link) => link.id === wall.id).forEach((link) => {
        if (link.which === 1) { copy.x1 = x2; copy.y1 = y2; } else { copy.x2 = x2; copy.y2 = y2; }
      });
      return copy;
    });
  }

  private modelPoint(event: PointerEvent): { x: number; y: number } {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const matrix = this.svg.getScreenCTM();
    const model = matrix ? point.matrixTransform(matrix.inverse()) : point;
    return { x: Core.snap(model.x), y: Core.snap(model.y) };
  }

  private applyViewBox(): void {
    const { x, y, width, height } = this.viewBox;
    this.svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }

  private updateScaleLabel(): void {
    const label = this.container.querySelector<HTMLElement>('[data-scene2d-scale]');
    if (label) label.textContent = `${(this.viewBox.width / Core.GRID).toFixed(0)} m na largura`;
  }
}
