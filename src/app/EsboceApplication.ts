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
import { createSharedProject, loadSharedProject, updateSharedProject, signUpWithProfile, signIn, signOut, getCurrentUser, listMyProjects, type ProfileFields } from "../core/SupabaseClient.js";

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
    this.requireElement("myProjectsBtn").addEventListener("click", () => this.openMyProjects());
    this.requireElement("accountBtn").addEventListener("click", () => this.handleAccountButtonClick());

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

  private refreshAccountButton(): void {
    const btn = this.requireElement("accountBtn");
    btn.textContent = this.currentUserEmail ? `👤 ${this.currentUserEmail}` : "👤 Entrar";
  }

  private async handleAccountButtonClick(): Promise<void> {
    if (this.currentUserId) {
      if (!confirm("Sair da conta?")) return;
      try {
        await signOut();
      } catch (err) {
        console.error("Falha ao sair:", err);
      }
      this.currentUserId = null;
      this.currentUserEmail = null;
      this.refreshAccountButton();
    } else {
      this.openAuthModal();
    }
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
      this.onAuthSuccess(user.id, user.email ?? email);
    } catch (err) {
      errorEl.textContent = this.friendlyAuthError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
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
        row.style.cssText = "padding:10px;border:1px solid #D3D1C7;border-radius:8px;margin-bottom:8px;cursor:pointer;";
        const updated = new Date(p.updated_at).toLocaleString("pt-BR");
        row.innerHTML = `<strong>${p.nome}</strong><br><span style="font-size:12px;color:#5F5E5A;">Atualizado em ${updated}</span>`;
        row.addEventListener("click", () => this.openProjectById(p.id));
        listEl.appendChild(row);
      });
    } catch (err) {
      listEl.innerHTML = '<p style="color:#D7263D;font-size:13px;">Falha ao carregar projetos.</p>';
      console.error("Falha ao listar projetos:", err);
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