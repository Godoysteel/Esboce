import { Core } from './Core.js';
import { Scene2DRenderer } from './Scene2DRenderer.js';
import { Store } from './Store.js';

type ViewBox = { x: number; y: number; width: number; height: number };

export class Viewport2DController {
  private readonly renderer: Scene2DRenderer;
  private viewBox: ViewBox = { x: -100, y: -100, width: 600, height: 450 };
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  public constructor(private readonly container: HTMLElement, private readonly svg: SVGSVGElement) {
    this.renderer = new Scene2DRenderer(svg);
    this.bindNavigation();
  }

  public render(): void { this.renderer.render(); this.applyViewBox(); this.updateScaleLabel(); }
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
    this.svg.addEventListener('wheel', (event) => { event.preventDefault(); this.zoomBy(event.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
    this.svg.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.button !== 1) return;
      this.dragging = true; this.lastPointer = { x: event.clientX, y: event.clientY };
      this.svg.setPointerCapture(event.pointerId); this.svg.classList.add('is-panning');
    });
    this.svg.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.viewBox.x -= dx * this.viewBox.width / Math.max(this.svg.clientWidth, 1);
      this.viewBox.y -= dy * this.viewBox.height / Math.max(this.svg.clientHeight, 1);
      this.applyViewBox();
    });
    const finish = () => { this.dragging = false; this.svg.classList.remove('is-panning'); };
    this.svg.addEventListener('pointerup', finish);
    this.svg.addEventListener('pointercancel', finish);
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
