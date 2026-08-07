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
import { createSharedProject, loadSharedProject, updateSharedProject } from "../core/SupabaseClient.js";

export class EsboceApplication {
  private readonly scene = new THREE.Scene();
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private viewport?: HTMLElement;
  private readonly terrainGrid = new THREE.Group();
  private storeUpdateScheduled = false;
  // Id do projeto no Supabase — null enquanto ainda não foi salvo
  // nesta sessão, ou preenchido de saída se a sessão começou abrindo
  // um link (?p=<id>). "Salvar" de novo depois disso atualiza o mesmo
  // registro em vez de criar um projeto novo a cada clique.
  private sharedProjectId: string | null = null;

  public async start(): Promise<void> {
    this.viewport = this.requireElement("viewport");
    this.scene.background = new THREE.Color(0xa9dff2);

    // Debug: acesso ao Store/Core pelo console do navegador, útil pra
    // testar posição/rotação de móveis ao vivo (Store.currentFurniture(),
    // Store.commands.moveFurnitureBody(id, x, y), etc). Sem risco de
    // segurança real numa fase de protótipo — remover antes de expor a
    // usuários finais reais, se um dia isso importar.
    (window as any).Store = Store;
    (window as any).Core = Core;

    // Link compartilhado (?p=<id>): tenta carregar ANTES do primeiro
    // render, pra a cena já nascer com o projeto certo (evita um
    // flash da casa vazia seguido de troca). Link inválido/projeto
    // apagado cai de volta pro projeto vazio de sempre, com um aviso
    // — não trava a inicialização.
    const sharedId = new URLSearchParams(window.location.search).get("p");
    if (sharedId) {
      try {
        const data = await loadSharedProject(sharedId);
        if (data) {
          Store.setProject(data as ReturnType<typeof Store.getProject>);
          this.sharedProjectId = sharedId;
        } else {
          console.warn(`Link compartilhado "${sharedId}" não encontrado — abrindo projeto vazio.`);
        }
      } catch (err) {
        console.error("Falha ao carregar projeto compartilhado:", err);
      }
    }

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
    // createInitialRoom() removido de propósito — viewport deve começar
    // vazia, sem nenhum cômodo pré-criado; o método continua disponível
    // abaixo caso essa decisão mude no futuro.

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

    const textureLoader = new THREE.TextureLoader();
    const configureTerrainMap = (path: string, isColor = false): THREE.Texture => {
      const texture = textureLoader.load(path);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(15, 15);
      texture.anisotropy = Math.min(8, this.renderer!.capabilities.getMaxAnisotropy());
      if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
         map: configureTerrainMap(import.meta.env.BASE_URL + 'textures/grama/albedo.png', true),
        normalMap: configureTerrainMap(import.meta.env.BASE_URL + 'textures/grama/normal.png'),
        roughnessMap: configureTerrainMap(import.meta.env.BASE_URL + 'textures/grama/roughness.png'),
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
    this.terrainGrid.add(majorGrid);

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
    this.terrainGrid.add(minorGrid);
    this.scene.add(this.terrainGrid);
    // Grid começa escondido — botão "Grid" na barra (index.html) precisa
    // nascer sem a classe "active" pra acompanhar esse estado inicial.
    this.terrainGrid.visible = false;
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
    this.requireElement("gridToggleBtn").addEventListener("click", (event) => {
      this.terrainGrid.visible = !this.terrainGrid.visible;
      (event.currentTarget as HTMLElement).classList.toggle("active", this.terrainGrid.visible);
    });
    this.requireElement("dimensionsToggleBtn").addEventListener("click", (event) => {
      const isVisible = ViewportController.toggleDimensions();
      (event.currentTarget as HTMLElement).classList.toggle("active", isVisible);
    });
    this.requireElement("wallDiagnosticsToggleBtn").addEventListener("click", (event) => {
      const isVisible = ViewportController.toggleWallDiagnostics();
      (event.currentTarget as HTMLElement).classList.toggle("active", isVisible);
    });
    this.requireElement("saveProjectBtn").addEventListener("click", () => this.saveProject());
    this.requireElement("shareProjectBtn").addEventListener("click", () => this.shareProject());

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

  // Atualiza a URL da barra de endereço com o id do projeto salvo, sem
  // recarregar a página nem empilhar entrada nova no histórico — só
  // pra "F5" continuar mostrando o mesmo projeto depois de salvar.
  private setUrlProjectId(id: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set("p", id);
    window.history.replaceState(null, "", url.toString());
  }

  // Feedback rápido no próprio botão (texto muda por ~1,8s e volta) —
  // simples de propósito, sem dependência de toast/notificação nova
  // pra essa primeira versão de testes.
  private async flashButtonFeedback(btn: HTMLElement, action: () => Promise<void>): Promise<void> {
    const original = btn.textContent;
    (btn as HTMLButtonElement).disabled = true;
    try {
      await action();
    } catch (err) {
      console.error("Falha ao salvar/compartilhar projeto:", err);
      btn.textContent = "⚠️ Falhou — tenta de novo";
      (btn as HTMLButtonElement).disabled = false;
      setTimeout(() => { btn.textContent = original; }, 2500);
      return;
    }
    (btn as HTMLButtonElement).disabled = false;
    setTimeout(() => { btn.textContent = original; }, 1800);
  }

  private async saveProject(): Promise<void> {
    const btn = this.requireElement("saveProjectBtn");
    await this.flashButtonFeedback(btn, async () => {
      btn.textContent = "Salvando...";
      const project = Store.getProject();
      // Campo de classe (this.sharedProjectId) não fica "estreitado"
      // pelo TypeScript depois de um await dentro do mesmo bloco —
      // guarda numa variável local pra manter o tipo certo (string,
      // não string | null) no resto da função.
      const existingId = this.sharedProjectId;
      if (existingId) {
        await updateSharedProject(existingId, project);
      } else {
        const newId = await createSharedProject(project);
        this.sharedProjectId = newId;
        this.setUrlProjectId(newId);
      }
      btn.textContent = "✅ Salvo";
    });
  }

  private async shareProject(): Promise<void> {
    const btn = this.requireElement("shareProjectBtn");
    await this.flashButtonFeedback(btn, async () => {
      // Compartilhar sem ter salvo ainda: salva primeiro (senão o link
      // apontaria pra um projeto que não existe no banco).
      let id = this.sharedProjectId;
      if (!id) {
        btn.textContent = "Salvando...";
        id = await createSharedProject(Store.getProject());
        this.sharedProjectId = id;
        this.setUrlProjectId(id);
      }
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set("p", id);
      await navigator.clipboard.writeText(shareUrl.toString());
      btn.textContent = "🔗 Link copiado!";
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