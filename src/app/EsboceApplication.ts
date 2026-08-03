import * as THREE from "three";
import { Core } from "../core/Core.js";
import { FloorTabsController } from "../core/FloorTabsController.js";
import { GizmoController } from "../core/GizmoController.js";
import { LayersPanel } from "../core/LayersPanel.js";
import { MaterialsPanel } from "../core/MaterialsPanel.js";
import { MaterialsSheet } from "../core/MaterialsSheet.js";
import { NavGizmo } from "../core/NavGizmo.js";
import { Store } from "../core/Store.js";
import { ViewportController } from "../core/ViewportController.js";
import { ViewportStats } from "../core/ViewportStats.js";

export class EsboceApplication {
  private readonly scene = new THREE.Scene();
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private viewport?: HTMLElement;
  private storeUpdateScheduled = false;

  public start(): void {
    this.viewport = this.requireElement("viewport");
    this.scene.background = new THREE.Color(0xa9dff2);

    this.camera = new THREE.PerspectiveCamera(
      50,
      this.viewport.clientWidth / this.viewport.clientHeight,
      0.1,
      100,
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resizeRenderer();
    this.viewport.insertBefore(this.renderer.domElement, this.viewport.firstChild);

    this.buildEnvironment();
    this.initializeControllers();
    this.bindApplicationEvents();
    this.createInitialRoom();

    ViewportController.render();
    FloorTabsController.refresh();
    ViewportStats.refresh();
    this.animate();

    console.info(
      `Esboce inicializado com ${Store.getProject().floors.length} pavimento(s), GRID=${Core.GRID}.`,
    );
  }

  private requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Elemento obrigatório #${id} não foi encontrado.`);
    return element;
  }

  private buildEnvironment(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 10, 5);
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xbfe3ff, 0.3);
    fillLight.position.set(-6, 4, -4);
    this.scene.add(fillLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({
        color: 0x6fa84a,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -0.01;
    this.scene.add(ground);

    const majorGrid = new THREE.GridHelper(30, 60, 0xffffff, 0xffffff);
    const majorMaterial = majorGrid.material as THREE.LineBasicMaterial;
    majorMaterial.transparent = true;
    majorMaterial.opacity = 0.55;
    majorGrid.position.y = 0.003;
    this.scene.add(majorGrid);

    const minorGrid = new THREE.GridHelper(30, 240, 0xffffff, 0xffffff);
    minorGrid.material = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.06,
      gapSize: 0.08,
      opacity: 0.22,
      transparent: true,
    });
    minorGrid.computeLineDistances();
    minorGrid.position.y = 0.0015;
    this.scene.add(minorGrid);
  }

  private initializeControllers(): void {
    NavGizmo.init();
    ViewportController.init({
      container: this.viewport!,
      camera: this.camera!,
      scene: this.scene,
      renderer: this.renderer!,
    });
    FloorTabsController.init();
    LayersPanel.init();
    GizmoController.init();
    MaterialsPanel.init();
  }

  private bindApplicationEvents(): void {
    Store.onChange(() => this.scheduleStoreRefresh());

    this.requireElement("clearBtn").addEventListener("click", () => {
      Store.commands.clearCurrentFloor();
      ViewportController.deselect();
    });
    this.requireElement("addFloorBtn").addEventListener("click", () => {
      Store.commands.addFloor();
      ViewportController.deselect();
    });
    this.requireElement("undoBtn").addEventListener("click", () => Store.commands.undo());
    this.requireElement("dimensionsToggleBtn").addEventListener("click", (event) => {
      const isVisible = ViewportController.toggleDimensions();
      (event.currentTarget as HTMLElement).classList.toggle("active", isVisible);
    });
    this.requireElement("wallDiagnosticsToggleBtn").addEventListener("click", (event) => {
      const isVisible = ViewportController.toggleWallDiagnostics();
      (event.currentTarget as HTMLElement).classList.toggle("active", isVisible);
    });

    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        Store.commands.undo();
      }
    });
    window.addEventListener("resize", () => this.resizeRenderer());
  }

  private scheduleStoreRefresh(): void {
    if (this.storeUpdateScheduled) return;
    this.storeUpdateScheduled = true;
    requestAnimationFrame(() => {
      this.storeUpdateScheduled = false;
      FloorTabsController.refresh();
      ViewportController.onModelChanged();
      MaterialsPanel.refresh();
      MaterialsSheet.refresh();
      ViewportStats.refresh();
    });
  }

  private createInitialRoom(): void {
    if (Store.currentWalls().length > 0) return;
    const halfWidth = 2 * Core.GRID;
    const halfDepth = 1.5 * Core.GRID;
    Store.commands.createRoom(-halfWidth, -halfDepth, halfWidth, halfDepth);
  }

  private resizeRenderer(): void {
    if (!this.viewport || !this.camera || !this.renderer) return;
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    ViewportController.repositionDimensions();
    this.renderer!.render(this.scene, this.camera!);
  };
}
