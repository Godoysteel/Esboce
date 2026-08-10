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
import { createSharedProject, loadSharedProject, updateSharedProject, deleteProject, signUpWithProfile, signIn, signOut, getCurrentUser, listMyProjects, ensureProfileExists, listDepartments, listManufacturers, listCatalogProducts, type ProfileFields, type CatalogDepartment, type CatalogManufacturer, type CatalogProductWithDepartment } from "../core/SupabaseClient.js";

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
  // Sessão do usuário logado — null enquanto ninguém logou. Salvar e
  // "Meus projetos" exigem isso (ver requireAuth()).
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  // Enquanto o modal de cadastro/login está aberto por causa de um
  // "Salvar" (não por clique direto em "Entrar"), essas duas guardam
  // como avisar quem estava esperando: resolve() quando loga com
  // sucesso, reject() se a pessoa fechar o modal sem logar.
  private pendingAuthResolve: ((userId: string) => void) | null = null;
  private pendingAuthReject: ((err: Error) => void) | null = null;
  // Nome do projeto atual — perguntado uma vez, no primeiro "Salvar"
  // (ver requireProjectName). Depois disso fica em memória, então
  // salvamentos seguintes não perguntam de novo — só ao carregar um
  // projeto salvo é que troca (para o nome que ele já tinha).
  private currentProjectName: string | null = null;
  private pendingNameResolve: ((nome: string) => void) | null = null;
  private pendingNameReject: ((err: Error) => void) | null = null;
  // Cache do catálogo — buscado uma vez na primeira abertura do
  // modal, reaproveitado depois (não recarrega do banco toda vez que
  // o usuário reabre, só a cada sessão/página nova).
  private catalogDepartments: CatalogDepartment[] | null = null;
  private catalogManufacturers: Map<string, CatalogManufacturer> | null = null;
  private catalogProducts: CatalogProductWithDepartment[] | null = null;
  private catalogActiveDeptId: string | null = null;
  private catalogActiveCategoriaFilter: string | null = null;

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
        const loaded = await loadSharedProject(sharedId);
        if (loaded) {
          Store.setProject(loaded.data as ReturnType<typeof Store.getProject>);
          this.sharedProjectId = sharedId;
          this.currentProjectName = loaded.nome;
          document.title = `${loaded.nome} — Esboce`;
        } else {
          console.warn(`Link compartilhado "${sharedId}" não encontrado — abrindo projeto vazio.`);
        }
      } catch (err) {
        console.error("Falha ao carregar projeto compartilhado:", err);
      }
    }

    // Sessão já ativa (voltou depois de já ter logado antes)? Recupera
    // sem pedir login de novo.
    try {
      const user = await getCurrentUser();
      if (user) { this.currentUserId = user.id; this.currentUserEmail = user.email ?? null; }
    } catch (err) {
      console.error("Falha ao checar sessão existente:", err);
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
    this.setupAuthModal();
    this.setupDisclaimerOverlay();
    this.refreshAccountButton();
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
    GizmoController.setOnSwapRequested((productId) => this.handleSwapRequested(productId));
    MaterialsPanel.init();
    // Rótulo de zoom da barra inferior — atualiza sozinho a cada
    // mudança de câmera (botão, roda do mouse, pinch), não só quando
    // clicado; ver ViewportController.setOnZoomChanged.
    ViewportController.setOnZoomChanged((percent) => {
      const label = document.getElementById("zoomPercentLabel");
      if (label) label.textContent = `${percent}%`;
    });
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
    // Painel de visualização (3D/2D/Orbit/Medir, canto direito) — só
    // "Orbit" faz algo de verdade por ora (recentraliza a câmera). "3D"
    // fica sempre marcado ativo (único modo existente); "2D" e "Medir"
    // já nascem com `disabled` no HTML, então nem chegam a disparar
    // clique — ver DEC (fase 2) no Registro de Decisões Técnicas.
    this.requireElement("viewModeOrbitBtn").addEventListener("click", () => ViewportController.resetCamera());

    // Barra inferior: zoom (− / % / +), tela cheia e "Visualização"
    // (mesmo menu de camadas do clique direito em área vazia, ver
    // ViewportController.toggleLayersMenuAtElement). O rótulo de
    // porcentagem também atualiza sozinho durante scroll/pinch — ver
    // setOnZoomChanged, chamado logo abaixo no init.
    this.requireElement("zoomInBtn").addEventListener("click", () => ViewportController.zoomIn());
    this.requireElement("zoomOutBtn").addEventListener("click", () => ViewportController.zoomOut());
    this.requireElement("fullscreenBtn").addEventListener("click", () => this.toggleFullscreen());
    this.requireElement("layersToggleBtn").addEventListener("click", (event) => {
      ViewportController.toggleLayersMenuAtElement(event.currentTarget as HTMLElement);
    });
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
    this.requireElement("newProjectBtn").addEventListener("click", () => this.startNewProject());
    this.requireElement("saveProjectBtn").addEventListener("click", () => this.saveProject());
    this.requireElement("shareProjectBtn").addEventListener("click", () => this.shareProject());
    this.requireElement("myProjectsBtn").addEventListener("click", () => this.openMyProjects());
    this.requireElement("catalogBtn").addEventListener("click", () => this.openCatalog());
    // "+ Adicionar produto" (CTA em destaque) leva pro mesmo painel
    // que "Catálogo" — ver comentário no HTML sobre por que os dois
    // convergem pro mesmo destino por ora.
    this.requireElement("addProductBtn").addEventListener("click", () => this.openCatalog());
    this.requireElement("accountBtn").addEventListener("click", () => this.handleAccountButtonClick());
    this.requireElement("logoutBtn").addEventListener("click", () => this.handleLogoutClick());

    // Menus suspensos da toolbar ("📁 Arquivo" e pavimento) — mesmo
    // padrão pros dois: clique no botão abre/fecha e fecha o outro
    // (nunca os dois abertos ao mesmo tempo); clique num item de
    // dentro fecha; clique fora fecha. O antigo terceiro menu "⋯"
    // (Grid/Cotas/Diagnóstico) saiu na fase 3 — Grid/Cotas viraram
    // toggles simples da barra inferior (sem menu, mesmo padrão do
    // resto dela), Diagnóstico é dev-only e nunca teve botão visível.
    const menuPairs: Array<{ btnId: string; menuId: string }> = [
      { btnId: "fileMenuBtn", menuId: "fileMenu" },
      { btnId: "floorMenuBtn", menuId: "floorMenu" },
    ];
    menuPairs.forEach(({ btnId, menuId }) => {
      this.requireElement(btnId).addEventListener("click", (event) => {
        event.stopPropagation();
        menuPairs.forEach((other) => {
          if (other.menuId !== menuId) this.requireElement(other.menuId).hidden = true;
        });
        const menu = this.requireElement(menuId);
        menu.hidden = !menu.hidden;
      });
      this.requireElement(menuId).addEventListener("click", (event) => {
        if ((event.target as HTMLElement).tagName === "BUTTON") {
          this.requireElement(menuId).hidden = true;
        }
      });
    });
    document.addEventListener("click", (event) => {
      menuPairs.forEach(({ btnId, menuId }) => {
        const menu = document.getElementById(menuId);
        const btn = document.getElementById(btnId);
        if (!menu || menu.hidden) return;
        if (event.target === btn || menu.contains(event.target as Node)) return;
        menu.hidden = true;
      });
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

  // "Novo projeto": zera o modelo (Core.createProject, mesma origem
  // que o app usa ao abrir sem link nenhum) E a sessão de salvamento
  // (sharedProjectId, currentProjectName, URL) — sem isso, clicar em
  // "Salvar" continuaria atualizando o projeto anterior em vez de
  // criar um novo e perguntar o nome de novo.
  // Botão ⤢ da barra inferior — Fullscreen API padrão do navegador.
  // Falha em silêncio (só loga) se o navegador recusar (ex.: iframe
  // sem allow="fullscreen", ou o usuário nunca ter clicado em nada
  // ainda — API exige gesto do usuário, e este listener já É um).
  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Não deu pra entrar em tela cheia:", err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Não deu pra sair da tela cheia:", err);
      });
    }
  }

  private startNewProject(): void {
    const hasContent = Store.currentWalls().length > 0 || Store.currentColumns().length > 0;
    if (hasContent && !confirm("Isso limpa tudo que não foi salvo agora. Quer começar um projeto novo mesmo assim?")) return;
    Store.setProject(Core.createProject());
    this.sharedProjectId = null;
    this.currentProjectName = null;
    document.title = "Esboce — construtor de casas online";
    const url = new URL(window.location.href);
    url.searchParams.delete("p");
    window.history.replaceState(null, "", url.toString());
    ViewportController.deselect();
  }

  private async saveProject(): Promise<void> {
    const btn = this.requireElement("saveProjectBtn");
    let userId: string;
    try {
      userId = await this.requireAuth();
    } catch {
      return; // modal fechado sem logar — não é erro, só desiste em silêncio
    }
    // Nome só é pedido na primeira vez que esse projeto é salvo
    // (currentProjectName ainda null). Pedido ANTES de entrar no
    // flashButtonFeedback: se a pessoa fechar o modal de nome sem
    // confirmar, o certo é desistir em silêncio, não mostrar "falhou".
    let nome = this.currentProjectName;
    if (!nome) {
      try {
        nome = await this.resolveProjectName();
      } catch {
        return;
      }
    }
    await this.flashButtonFeedback(btn, async () => {
      btn.textContent = "Salvando...";
      const project = Store.getProject();
      // Campo de classe (this.sharedProjectId) não fica "estreitado"
      // pelo TypeScript depois de um await dentro do mesmo bloco —
      // guarda numa variável local pra manter o tipo certo (string,
      // não string | null) no resto da função.
      const existingId = this.sharedProjectId;
      if (existingId) {
        const updated = await updateSharedProject(existingId, project);
        if (!updated) {
          // Não é o dono desse projeto (abriu o link de outra pessoa)
          // — a RLS bloqueou a atualização em silêncio. Em vez de
          // fingir que salvou, salva como um projeto NOVO seu, e o
          // link passa a apontar pra essa cópia.
          const forkedId = await createSharedProject(project, userId, nome);
          this.sharedProjectId = forkedId;
          this.currentProjectName = nome;
          this.setUrlProjectId(forkedId);
          document.title = `${nome} — Esboce`;
          btn.textContent = "✅ Salvo como cópia sua";
          return;
        }
      } else {
        const newId = await createSharedProject(project, userId, nome);
        this.sharedProjectId = newId;
        this.currentProjectName = nome;
        this.setUrlProjectId(newId);
        document.title = `${nome} — Esboce`;
      }
      btn.textContent = "✅ Salvo";
    });
  }

  private async shareProject(): Promise<void> {
    const btn = this.requireElement("shareProjectBtn");
    let userId: string;
    try {
      userId = await this.requireAuth();
    } catch {
      return;
    }
    let nome = this.currentProjectName;
    if (!this.sharedProjectId && !nome) {
      try {
        nome = await this.resolveProjectName();
      } catch {
        return;
      }
    }
    await this.flashButtonFeedback(btn, async () => {
      // Compartilhar sem ter salvo ainda: salva primeiro (senão o link
      // apontaria pra um projeto que não existe no banco).
      let id = this.sharedProjectId;
      if (!id) {
        btn.textContent = "Salvando...";
        id = await createSharedProject(Store.getProject(), userId, nome!);
        this.sharedProjectId = id;
        this.currentProjectName = nome;
        this.setUrlProjectId(id);
        document.title = `${nome} — Esboce`;
      }
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set("p", id);
      await navigator.clipboard.writeText(shareUrl.toString());
      btn.textContent = "🔗 Link copiado!";
    });
  }

  // Devolve o id do usuário logado. Se ninguém está logado, abre o
  // modal de cadastro/login e só resolve quando a pessoa completar
  // um dos dois com sucesso — ou rejeita se ela fechar o modal sem
  // logar (quem chamar isso deve tratar esse cancelamento como "o
  // usuário desistiu", não como uma falha real).
  private requireAuth(): Promise<string> {
    if (this.currentUserId) return Promise.resolve(this.currentUserId);
    return new Promise((resolve, reject) => {
      this.pendingAuthResolve = resolve;
      this.pendingAuthReject = reject;
      this.openAuthModal();
    });
  }

  // Aviso de responsabilidade técnica (ADR-006) — aparece na primeira
  // carga do navegador/perfil, some com um clique consciente em
  // "Entendi" e fica lembrado em localStorage (não é sessionStorage de
  // propósito: a intenção é mostrar uma vez só por navegador, não a
  // cada aba/sessão nova). Falha de localStorage bloqueado/indisponível
  // (modo privado restrito, por exemplo) não impede o app de
  // funcionar — só faz o aviso aparecer de novo na próxima carga.
  private static readonly DISCLAIMER_DISMISSED_KEY = "esboce_disclaimer_dismissed_v1";

  private setupDisclaimerOverlay(): void {
    const overlay = this.requireElement("disclaimerOverlay");
    const dismissBtn = this.requireElement("disclaimerDismissBtn");
    let alreadyDismissed = false;
    try {
      alreadyDismissed = localStorage.getItem(EsboceApplication.DISCLAIMER_DISMISSED_KEY) === "1";
    } catch (err) {
      console.warn("Não deu pra ler localStorage — aviso de responsabilidade vai aparecer sempre:", err);
    }
    if (!alreadyDismissed) overlay.classList.add("visible");
    dismissBtn.addEventListener("click", () => {
      overlay.classList.remove("visible");
      try {
        localStorage.setItem(EsboceApplication.DISCLAIMER_DISMISSED_KEY, "1");
      } catch (err) {
        console.warn("Não deu pra gravar localStorage — aviso de responsabilidade vai aparecer de novo na próxima carga:", err);
      }
    });
  }

  private setupAuthModal(): void {
    const tabSignup = this.requireElement("authTabSignup");
    const tabLogin = this.requireElement("authTabLogin");
    const paneSignup = this.requireElement("authSignupPane");
    const paneLogin = this.requireElement("authLoginPane");

    const showTab = (which: "signup" | "login") => {
      tabSignup.classList.toggle("active", which === "signup");
      tabLogin.classList.toggle("active", which === "login");
      paneSignup.style.display = which === "signup" ? "" : "none";
      paneLogin.style.display = which === "login" ? "" : "none";
      this.requireElement("authError").textContent = "";
    };
    tabSignup.addEventListener("click", () => showTab("signup"));
    tabLogin.addEventListener("click", () => showTab("login"));

    this.requireElement("authModalClose").addEventListener("click", () => this.closeAuthModal(true));
    this.requireElement("authSignupSubmit").addEventListener("click", () => this.handleSignupSubmit());
    this.requireElement("authLoginSubmit").addEventListener("click", () => this.handleLoginSubmit());
    this.requireElement("myProjectsClose").addEventListener("click", () => {
      this.requireElement("myProjectsOverlay").style.display = "none";
    });
    this.requireElement("projectNameModalClose").addEventListener("click", () => this.closeProjectNameModal(true));
    this.requireElement("projectNameSubmit").addEventListener("click", () => this.handleProjectNameSubmit());
    this.requireElement("projectNameInput").addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") this.handleProjectNameSubmit();
    });
    this.requireElement("catalogClose").addEventListener("click", () => {
      this.requireElement("catalogOverlay").classList.remove("visible");
      this.setCatalogEntryButtonsActive(false);
    });
    this.requireElement("catalogDetailClose").addEventListener("click", () => {
      this.requireElement("catalogDetailOverlay").style.display = "none";
    });
  }

  private openAuthModal(): void {
    this.requireElement("authModalOverlay").classList.add("visible");
  }

  private closeAuthModal(cancelled: boolean): void {
    this.requireElement("authModalOverlay").classList.remove("visible");
    this.requireElement("authError").textContent = "";
    if (cancelled && this.pendingAuthReject) this.pendingAuthReject(new Error("Cadastro/login cancelado pelo usuário."));
    this.pendingAuthResolve = null;
    this.pendingAuthReject = null;
  }

  private onAuthSuccess(userId: string, email: string): void {
    this.currentUserId = userId;
    this.currentUserEmail = email;
    this.refreshAccountButton();
    this.closeAuthModal(false);
    if (this.pendingAuthResolve) {
      const resolve = this.pendingAuthResolve;
      this.pendingAuthResolve = null;
      this.pendingAuthReject = null;
      resolve(userId);
    }
  }

  // Avatar compacto (bolinha com iniciais) em vez do botão de texto
  // antigo — mesma lógica de estado logado/deslogado, só a
  // apresentação muda. Sem nome de perfil disponível aqui ainda (só
  // e-mail), as "iniciais" são as 2 primeiras letras do e-mail; dá
  // pra trocar por nome real assim que o perfil for carregado no
  // login (ver ProfileFields.nome em SupabaseClient.ts).
  private refreshAccountButton(): void {
    const btn = this.requireElement("accountBtn");
    const logoutBtn = this.requireElement("logoutBtn");
    if (this.currentUserEmail) {
      btn.textContent = this.currentUserEmail.slice(0, 2).toUpperCase();
      btn.title = `Logado como ${this.currentUserEmail}`;
      logoutBtn.style.display = "";
    } else {
      btn.textContent = "👤";
      btn.title = "Entrar";
      logoutBtn.style.display = "none";
    }
  }

  private handleAccountButtonClick(): void {
    // Logado: esse botão vira só um indicador de quem está logado —
    // sair é responsabilidade do botão "🚪 Sair" ao lado, explícito,
    // em vez de um clique "escondido" no mesmo lugar que também serve
    // pra entrar.
    if (!this.currentUserId) this.openAuthModal();
  }

  private async handleLogoutClick(): Promise<void> {
    if (!confirm("Sair da conta?")) return;
    try {
      await signOut();
    } catch (err) {
      console.error("Falha ao sair:", err);
    }
    this.currentUserId = null;
    this.currentUserEmail = null;
    this.refreshAccountButton();
  }

  private friendlyAuthError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already registered|already exists|user already/i.test(msg)) return "Esse e-mail já tem conta — usa a aba \"Já tenho conta\".";
    if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    return msg;
  }

  private async handleSignupSubmit(): Promise<void> {
    const errorEl = this.requireElement("authError");
    const btn = this.requireElement("authSignupSubmit") as HTMLButtonElement;
    const nome = (this.requireElement("authNome") as HTMLInputElement).value.trim();
    const email = (this.requireElement("authSignupEmail") as HTMLInputElement).value.trim();
    const telefone = (this.requireElement("authTelefone") as HTMLInputElement).value.trim();
    const senha = (this.requireElement("authSignupSenha") as HTMLInputElement).value;
    const profile: ProfileFields = {
      nome, telefone,
      cep: (this.requireElement("authCep") as HTMLInputElement).value.trim(),
      estado: (this.requireElement("authEstado") as HTMLSelectElement).value,
      cidade: (this.requireElement("authCidade") as HTMLInputElement).value.trim(),
      rua: (this.requireElement("authRua") as HTMLInputElement).value.trim(),
      numero: (this.requireElement("authNumero") as HTMLInputElement).value.trim(),
      bairro: (this.requireElement("authBairro") as HTMLInputElement).value.trim(),
    };

    if (!nome || !email || !telefone || !senha) {
      errorEl.textContent = "Nome, e-mail, telefone e senha são obrigatórios.";
      return;
    }
    if (senha.length < 6) {
      errorEl.textContent = "A senha precisa de pelo menos 6 caracteres.";
      return;
    }

    errorEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Criando conta...";
    try {
      const result = await signUpWithProfile(email, senha, profile);
      if (result.needsEmailConfirmation) {
        // Sem sessão ainda (confirmação pendente) — o perfil não foi
        // gravado no banco (a RLS exige auth.uid(), que só existe com
        // sessão ativa). Guarda os dados aqui pra completar no
        // primeiro login pós-confirmação (ver handleLoginSubmit), pra
        // não perder o que a pessoa já preencheu.
        try {
          localStorage.setItem("esboce_pending_profile", JSON.stringify({ email, profile }));
        } catch (err) {
          console.error("Falha ao guardar perfil pendente:", err);
        }
        errorEl.textContent = 'Conta criada! Confirme seu e-mail (chegou uma mensagem na sua caixa de entrada) e depois entra pela aba "Já tenho conta".';
        return;
      }
      const user = await getCurrentUser();
      if (!user) throw new Error("Não foi possível confirmar a sessão após o cadastro.");
      this.onAuthSuccess(user.id, user.email ?? email);
    } catch (err) {
      errorEl.textContent = this.friendlyAuthError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Criar conta e salvar projeto";
    }
  }

  // Se essa pessoa cadastrou antes e a confirmação de e-mail impediu
  // o perfil de ser gravado na hora (ver handleSignupSubmit), completa
  // isso agora que ela tem sessão de verdade. Silencioso de propósito
  // — se não achar nada pendente (ou o e-mail não bater), segue o
  // login normal sem incomodar ninguém com isso.
  private async completePendingProfileIfAny(userId: string, loggedInEmail: string): Promise<void> {
    let raw: string | null;
    try {
      raw = localStorage.getItem("esboce_pending_profile");
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as { email: string; profile: ProfileFields };
      if (pending.email.toLowerCase() === loggedInEmail.toLowerCase()) {
        await ensureProfileExists(userId, pending.profile);
      }
      localStorage.removeItem("esboce_pending_profile");
    } catch (err) {
      console.error("Falha ao completar perfil pendente:", err);
      // Não remove do localStorage nesse caso — tenta de novo no
      // próximo login, em vez de perder o dado por causa de um erro
      // pontual (ex.: falha de rede).
    }
  }

  private async handleLoginSubmit(): Promise<void> {
    const errorEl = this.requireElement("authError");
    const btn = this.requireElement("authLoginSubmit") as HTMLButtonElement;
    const email = (this.requireElement("authLoginEmail") as HTMLInputElement).value.trim();
    const senha = (this.requireElement("authLoginSenha") as HTMLInputElement).value;
    if (!email || !senha) { errorEl.textContent = "Preenche e-mail e senha."; return; }

    errorEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Entrando...";
    try {
      const user = await signIn(email, senha);
      if (!user) throw new Error("Login não retornou um usuário.");
      await this.completePendingProfileIfAny(user.id, email);
      this.onAuthSuccess(user.id, user.email ?? email);
    } catch (err) {
      errorEl.textContent = this.friendlyAuthError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  }

  // ---- Catálogo de produtos (vitrine) ----

  // Os dois botões de entrada do catálogo (Catálogo e o CTA "+
  // Adicionar produto") levam pro MESMO painel — então sobem/descem o
  // estado `.active` juntos, não importa qual dos dois foi clicado
  // (ou se foi um terceiro caminho, como o "🔁 Trocar" do móvel
  // selecionado).
  private setCatalogEntryButtonsActive(active: boolean): void {
    this.requireElement("catalogBtn").classList.toggle("active", active);
    this.requireElement("addProductBtn").classList.toggle("active", active);
  }

  private async openCatalog(): Promise<void> {
    const overlay = this.requireElement("catalogOverlay");
    // Vira gaveta: clicar em qualquer um dos botões de entrada com o
    // painel já aberto fecha, em vez de recarregar. Faz sentido agora
    // que não tem mais fundo escuro cobrindo a tela pra clicar fora e
    // fechar (fase 4 — painel ancorado ao lado do sidebar, não modal
    // centralizado).
    if (overlay.classList.contains("visible")) {
      overlay.classList.remove("visible");
      this.setCatalogEntryButtonsActive(false);
      return;
    }
    overlay.classList.add("visible");
    this.setCatalogEntryButtonsActive(true);
    const loaded = await this.ensureCatalogLoaded();
    if (!loaded) return;
    this.catalogActiveCategoriaFilter = null;
    if (!this.catalogActiveDeptId) this.catalogActiveDeptId = this.catalogDepartments?.[0]?.id ?? null;
    this.renderCatalogTabs();
    this.renderCatalogGrid();
  }

  // Busca departamentos/fabricantes/produtos uma vez só (cacheado em
  // this.catalog*) — devolve false e já mostra a mensagem de erro no
  // corpo do modal se a busca falhar, pra quem chamou não precisar
  // tratar isso de novo.
  private async ensureCatalogLoaded(): Promise<boolean> {
    if (this.catalogProducts) return true;
    const body = this.requireElement("catalogBody");
    body.innerHTML = '<p style="color:#9C9A92; font-size:13px;">Carregando...</p>';
    try {
      const [departments, manufacturers, products] = await Promise.all([
        listDepartments(),
        listManufacturers(),
        listCatalogProducts(),
      ]);
      this.catalogDepartments = departments;
      this.catalogManufacturers = new Map(manufacturers.map((m) => [m.id, m]));
      this.catalogProducts = products;
      return true;
    } catch (err) {
      console.error("Falha ao carregar catálogo:", err);
      body.innerHTML = '<p style="color:#D7263D; font-size:13px;">Falha ao carregar o catálogo. Tenta de novo em alguns instantes.</p>';
      return false;
    }
  }

  // Acionado pelo botão "🔁 Trocar" no móvel selecionado (ver
  // GizmoController.setOnSwapRequested). productId é o mesmo id usado
  // em Catalog.ts — como preservei os ids ao espelhar o catálogo pro
  // Supabase, dá pra achar o produto correspondente direto por igualdade.
  private async handleSwapRequested(productId: string): Promise<void> {
    const loaded = await this.ensureCatalogLoaded();
    if (!loaded) {
      this.requireElement("catalogOverlay").classList.add("visible");
      this.setCatalogEntryButtonsActive(true);
      return;
    }
    const match = this.catalogProducts?.find((p) => p.id === productId);
    if (!match) {
      alert("Esse item ainda não tem produtos alternativos cadastrados no catálogo.");
      return;
    }
    this.openCatalogFilteredByCategoria(match.categoria);
  }

  private openCatalogFilteredByCategoria(categoria: string): void {
    this.requireElement("catalogOverlay").classList.add("visible");
    this.setCatalogEntryButtonsActive(true);
    const product = this.catalogProducts?.find((p) => p.categoria === categoria);
    this.catalogActiveDeptId = product?.department_id ?? this.catalogActiveDeptId;
    this.catalogActiveCategoriaFilter = categoria;
    this.renderCatalogTabs();
    this.renderCatalogGrid();
  }

  private renderCatalogTabs(): void {
    const tabsEl = this.requireElement("catalogTabs");
    const departments = this.catalogDepartments ?? [];
    const products = this.catalogProducts ?? [];
    tabsEl.innerHTML = "";
    // Só mostra departamento que tem pelo menos 1 produto — uma aba
    // vazia não ajuda ninguém a navegar.
    departments
      .filter((dept) => products.some((p) => p.department_id === dept.id))
      .forEach((dept) => {
        const tab = document.createElement("div");
        tab.className = "catalog-tab" + (dept.id === this.catalogActiveDeptId ? " active" : "");
        tab.textContent = dept.nome;
        tab.addEventListener("click", () => {
          this.catalogActiveDeptId = dept.id;
          this.catalogActiveCategoriaFilter = null;
          this.renderCatalogTabs();
          this.renderCatalogGrid();
        });
        tabsEl.appendChild(tab);
      });
  }

  private renderCatalogGrid(): void {
    const bodyEl = this.requireElement("catalogBody");
    const filter = this.catalogActiveCategoriaFilter;
    const products = (this.catalogProducts ?? []).filter((p) =>
      filter ? p.categoria === filter : p.department_id === this.catalogActiveDeptId
    );

    bodyEl.innerHTML = "";
    if (filter) {
      const banner = document.createElement("div");
      banner.style.cssText = "margin-bottom:12px; font-size:13px; color:#5F5E5A;";
      const clearBtn = document.createElement("button");
      clearBtn.textContent = "← Ver departamento inteiro";
      clearBtn.style.cssText = "font-size:12px; padding:5px 10px;";
      clearBtn.addEventListener("click", () => {
        this.catalogActiveCategoriaFilter = null;
        this.renderCatalogTabs();
        this.renderCatalogGrid();
      });
      banner.appendChild(clearBtn);
      bodyEl.appendChild(banner);
    }

    if (!products.length) {
      const empty = document.createElement("p");
      empty.style.cssText = "color:#9C9A92; font-size:13px;";
      empty.textContent = "Nenhum produto nessa categoria ainda.";
      bodyEl.appendChild(empty);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "catalog-grid";
    products.forEach((product) => {
      const manufacturer = this.catalogManufacturers?.get(product.manufacturer_id);
      const card = document.createElement("div");
      card.className = "catalog-card";

      const photo = document.createElement("div");
      photo.className = "catalog-card-photo";
      if (product.foto_url) {
        const img = document.createElement("img");
        img.src = product.foto_url;
        img.alt = product.nome;
        photo.appendChild(img);
      } else {
        photo.innerHTML = '<span class="no-photo">Sem foto ainda</span>';
      }
      card.appendChild(photo);

      const info = document.createElement("div");
      info.className = "catalog-card-info";
      const precoHtml = product.preco > 0
        ? `<div class="catalog-card-preco">R$ ${product.preco.toFixed(2).replace(".", ",")} <span style="font-weight:400;font-size:11px;color:#5F5E5A;">/ ${product.unidade}</span></div>`
        : '<div class="catalog-card-preco consulta">Sob consulta</div>';
      info.innerHTML = `
        <p class="catalog-card-nome">${product.nome}</p>
        <p class="catalog-card-fabricante">${manufacturer?.nome ?? product.manufacturer_id}</p>
        ${precoHtml}
        <span class="catalog-badge ${product.origem}">${this.catalogOrigemLabel(product.origem)}</span>
      `;
      card.appendChild(info);

      card.addEventListener("click", () => this.openCatalogDetail(product));
      grid.appendChild(card);
    });
    bodyEl.appendChild(grid);
  }

  private catalogOrigemLabel(origem: string): string {
    if (origem === "generico") return "Genérico";
    if (origem === "oficial") return "Oficial";
    return "Fornecedor";
  }

  private openCatalogDetail(product: CatalogProductWithDepartment): void {
    const manufacturer = this.catalogManufacturers?.get(product.manufacturer_id);
    const specsRows = Object.entries(product.specs ?? {})
      .map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`)
      .join("");
    const precoHtml = product.preco > 0
      ? `R$ ${product.preco.toFixed(2).replace(".", ",")} / ${product.unidade}`
      : "Sob consulta";
    const body = this.requireElement("catalogDetailBody");
    body.innerHTML = `
      ${product.foto_url ? `<img src="${product.foto_url}" alt="${product.nome}" style="width:100%; aspect-ratio:1; object-fit:contain; background:#F1EFE8; border-radius:8px; margin-bottom:12px;">` : ""}
      <h2 style="margin-bottom:2px;">${product.nome}</h2>
      <p class="auth-sub" style="margin-bottom:8px;">${manufacturer?.nome ?? product.manufacturer_id}${product.sku ? ` · SKU ${product.sku}` : ""}</p>
      <p style="font-size:16px; font-weight:700; margin:0 0 10px;">${precoHtml}</p>
      <span class="catalog-badge ${product.origem}">${this.catalogOrigemLabel(product.origem)}</span>
      ${specsRows ? `<div class="catalog-detail-specs"><table>${specsRows}</table></div>` : ""}
    `;
    this.requireElement("catalogDetailOverlay").style.display = "flex";
  }

  private async openMyProjects(): Promise<void> {
    let userId: string;
    try {
      userId = await this.requireAuth();
    } catch {
      return;
    }
    const listEl = this.requireElement("myProjectsList");
    const overlay = this.requireElement("myProjectsOverlay");
    listEl.textContent = "Carregando...";
    overlay.style.display = "flex";
    try {
      const projects = await listMyProjects(userId);
      listEl.innerHTML = "";
      if (!projects.length) {
        listEl.innerHTML = '<p style="font-size:13px;color:#5F5E5A;">Você ainda não salvou nenhum projeto.</p>';
        return;
      }
      projects.forEach((p) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:8px; padding:10px; border:1px solid #D3D1C7; border-radius:8px; margin-bottom:8px;";

        const info = document.createElement("div");
        info.style.cssText = "flex:1; cursor:pointer;";
        const updated = new Date(p.updated_at).toLocaleString("pt-BR");
        info.innerHTML = `<strong>${p.nome}</strong><br><span style="font-size:12px;color:#5F5E5A;">Atualizado em ${updated}</span>`;
        info.addEventListener("click", () => this.openProjectById(p.id));
        row.appendChild(info);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️";
        deleteBtn.title = "Excluir projeto";
        deleteBtn.style.cssText = "flex-shrink:0;";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.deleteMyProject(p.id, p.nome, row);
        });
        row.appendChild(deleteBtn);

        listEl.appendChild(row);
      });
    } catch (err) {
      listEl.innerHTML = '<p style="color:#D7263D;font-size:13px;">Falha ao carregar projetos.</p>';
      console.error("Falha ao listar projetos:", err);
    }
  }

  private async deleteMyProject(id: string, nome: string, rowEl: HTMLElement): Promise<void> {
    if (!confirm(`Excluir "${nome}" pra sempre? Isso não tem volta.`)) return;
    try {
      const deleted = await deleteProject(id);
      if (!deleted) { alert("Não foi possível excluir — só o dono do projeto pode fazer isso."); return; }
      rowEl.remove();
      // Se o projeto excluído era o que está aberto agora, desfaz o
      // vínculo — senão o próximo "Salvar" tentaria atualizar um
      // registro que não existe mais.
      if (this.sharedProjectId === id) {
        this.sharedProjectId = null;
        this.currentProjectName = null;
        const url = new URL(window.location.href);
        url.searchParams.delete("p");
        window.history.replaceState(null, "", url.toString());
      }
    } catch (err) {
      console.error("Falha ao excluir projeto:", err);
      alert("Falha ao excluir o projeto.");
    }
  }

  private async openProjectById(id: string): Promise<void> {
    try {
      const loaded = await loadSharedProject(id);
      if (!loaded) { alert("Projeto não encontrado — pode ter sido apagado."); return; }
      Store.setProject(loaded.data as ReturnType<typeof Store.getProject>);
      this.sharedProjectId = id;
      this.currentProjectName = loaded.nome;
      document.title = `${loaded.nome} — Esboce`;
      this.setUrlProjectId(id);
      this.requireElement("myProjectsOverlay").style.display = "none";
    } catch (err) {
      console.error("Falha ao abrir projeto:", err);
      alert("Falha ao abrir o projeto.");
    }
  }

  // Devolve o nome que o usuário digitar pro projeto atual. Abre o
  // modal e só resolve quando ele confirmar um nome não-vazio — ou
  // rejeita se ele fechar o modal sem confirmar (quem chamar isso deve
  // tratar esse cancelamento como "desistiu de salvar agora", não como
  // uma falha real).
  private resolveProjectName(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pendingNameResolve = resolve;
      this.pendingNameReject = reject;
      this.openProjectNameModal();
    });
  }

  private openProjectNameModal(): void {
    const input = this.requireElement("projectNameInput") as HTMLInputElement;
    input.value = "";
    this.requireElement("projectNameError").textContent = "";
    this.requireElement("projectNameModalOverlay").style.display = "flex";
    input.focus();
  }

  private closeProjectNameModal(cancelled: boolean): void {
    this.requireElement("projectNameModalOverlay").style.display = "none";
    if (cancelled && this.pendingNameReject) this.pendingNameReject(new Error("Nome do projeto cancelado pelo usuário."));
    this.pendingNameResolve = null;
    this.pendingNameReject = null;
  }

  private handleProjectNameSubmit(): void {
    const input = this.requireElement("projectNameInput") as HTMLInputElement;
    const nome = input.value.trim();
    if (!nome) {
      this.requireElement("projectNameError").textContent = "Dá um nome pro projeto pra continuar.";
      return;
    }
    this.requireElement("projectNameModalOverlay").style.display = "none";
    if (this.pendingNameResolve) {
      const resolve = this.pendingNameResolve;
      this.pendingNameResolve = null;
      this.pendingNameReject = null;
      resolve(nome);
    }
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