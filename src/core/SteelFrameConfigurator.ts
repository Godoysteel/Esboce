import { Store } from './Store.js';
import { ViewportController } from './ViewportController.js';
import { STEEL_FRAME_FACE_ASSEMBLIES, steelFrameSpecificationIssues } from './SteelFrameAssemblies.js';
import type { SteelFrameSpecificationIssue } from './SteelFrameAssemblies.js';
import type { Roof, Wall, WallCavityAssembly } from './types.js';

type SurfaceTarget = { kind: 'wall-face' | 'gable-face' | 'roof'; entityId: string; side?: 'a' | 'b' };
const faceSystems = STEEL_FRAME_FACE_ASSEMBLIES.filter((item) => item.use === 'external' || item.use === 'internal' || item.use === 'both');
const soffitSystems = STEEL_FRAME_FACE_ASSEMBLIES.filter((item) => item.use === 'soffit');
const insulationOptions = [
  { id: 'none', label: 'Sem isolamento', thickness: 0 },
  { id: 'placlux.la-de-rocha', label: 'Lã de rocha PlacLux', thickness: 50 },
  { id: 'glass-wool', label: 'Lã de vidro', thickness: 50 },
  { id: 'pet-wool', label: 'Lã de PET', thickness: 50 },
] as const;

let completion: (() => void) | null = null;
let selectedTarget: SurfaceTarget | null = null;

function allWalls(): Wall[] { return Store.getProject().floors.flatMap((floor) => floor.walls); }
function allRoofs(): Roof[] { return Store.getProject().floors.flatMap((floor) => floor.roofs || []); }
function selectedWall(): Wall | undefined { return selectedTarget ? allWalls().find((wall) => wall.id === selectedTarget!.entityId) : undefined; }
function selectedRoof(): Roof | undefined { return selectedTarget ? allRoofs().find((roof) => roof.id === selectedTarget!.entityId) : undefined; }

function issueLabel(issue: SteelFrameSpecificationIssue): string {
  const walls = allWalls();
  const roofs = allRoofs();
  const wallNumber = walls.findIndex((item) => item.id === issue.entityId) + 1;
  const roofNumber = roofs.findIndex((item) => item.id === issue.entityId) + 1;
  if (issue.kind === 'wall-face') return `Parede ${wallNumber} · face ${issue.side?.toUpperCase()}`;
  if (issue.kind === 'wall-cavity') return `Parede ${wallNumber} · isolamento térmico e acústico`;
  if (issue.kind === 'gable-face') return `Telhado ${roofNumber} · oitão ${issue.side?.toUpperCase()}`;
  if (issue.kind === 'soffit') return `Telhado ${roofNumber} · beiral`;
  if (issue.kind === 'fascia') return `Telhado ${roofNumber} · tabeira`;
  return `Telhado ${roofNumber} · platibanda ${issue.side === 'outer' ? 'externa' : 'interna'}`;
}

function pendingGuide(issues: SteelFrameSpecificationIssue[]): string {
  if (!issues.length) return '<div class="sf-completion-card"><strong>✓ Tudo configurado</strong><span>O quantitativo está liberado.</span></div>';
  const visible = issues.slice(0, 6);
  return `<div class="sf-next-step"><small>PRÓXIMO PASSO</small><strong>${issueLabel(issues[0]!)}</strong><span>Clique nessa face na construção e escolha o sistema.</span></div>
    <div class="sf-pending-list"><h4>Ainda falta configurar</h4>${visible.map((issue) => `<div><span>○</span>${issueLabel(issue)}</div>`).join('')}${issues.length > visible.length ? `<small>e mais ${issues.length - visible.length} itens…</small>` : ''}</div>
    <div class="sf-color-legend"><i></i><span>As faces concluídas ficam verdes e não precisam ser clicadas novamente.</span></div>`;
}

function targetIsConfigured(target: SurfaceTarget): boolean {
  if (target.kind === 'wall-face') {
    const wall = allWalls().find((item) => item.id === target.entityId);
    return !!wall && !!wall.cavityAssembly && !!(target.side === 'a' ? wall.faceAAssemblyId : wall.faceBAssemblyId);
  }
  const roof = allRoofs().find((item) => item.id === target.entityId);
  if (!roof) return false;
  if (target.kind === 'gable-face') return !!(target.side === 'a' ? roof.gableFaceAAssemblyId : roof.gableFaceBAssemblyId);
  return !!roof.soffitAssemblyId && !!roof.fasciaAssemblyId
    && (roof.type !== 'platibanda' || (!!roof.parapetOuterAssemblyId && !!roof.parapetInnerAssemblyId));
}

function finishSelectionWhenComplete(): void {
  if (!selectedTarget || !targetIsConfigured(selectedTarget)) return;
  if (selectedTarget.kind === 'wall-face' && !selectedWall()?.cavityAssembly) return;
  selectedTarget = null;
}

function systemButtons(selectedId?: string): string {
  const groups = [
    ['Revestimentos externos', faceSystems.filter((item) => item.use === 'external' || item.use === 'both')],
    ['Revestimentos internos', faceSystems.filter((item) => item.use === 'internal')],
  ] as const;
  return groups.map(([label, systems]) => `<div class="sf-side-group"><h4>${label}</h4>${systems.map((system) =>
    `<button type="button" class="sf-system-option ${system.id === selectedId ? 'selected' : ''}" data-sf-system="${system.id}"><strong>${system.label}</strong><small>${system.layers.length} camadas</small></button>`
  ).join('')}</div>`).join('');
}

function ensurePanel(): HTMLElement {
  let panel = document.getElementById('steelFrameConfigurator');
  if (panel) return panel;
  panel = document.createElement('aside');
  panel.id = 'steelFrameConfigurator';
  panel.innerHTML = `<header><div><strong>Fechamentos Steel Frame</strong><p data-sf-guidance>Clique em uma face da construção.</p></div><button type="button" data-sf-close>×</button></header><div data-sf-body></div><footer><span data-sf-progress></span><button type="button" data-sf-quantity>Ver quantitativo</button></footer>`;
  document.body.appendChild(panel);
  panel.querySelector('[data-sf-close]')!.addEventListener('click', close);
  panel.querySelector('[data-sf-quantity]')!.addEventListener('click', () => {
    const issues = steelFrameSpecificationIssues(Store.getProject());
    if (issues.length) {
      panel!.querySelector<HTMLElement>('[data-sf-progress]')!.textContent = `Faltam ${issues.length} seleções.`;
      return;
    }
    const done = completion;
    close();
    done?.();
  });
  return panel;
}

function saveWallFace(systemId: string): void {
  const wall = selectedWall();
  if (!wall || !selectedTarget?.side) return;
  Store.commands.setSteelFrameWallSpecification(wall.id, {
    faceAAssemblyId: selectedTarget.side === 'a' ? systemId : wall.faceAAssemblyId,
    faceBAssemblyId: selectedTarget.side === 'b' ? systemId : wall.faceBAssemblyId,
    cavityAssembly: wall.cavityAssembly,
  });
}

function saveGableFace(systemId: string): void {
  const roof = selectedRoof();
  if (!roof || !selectedTarget?.side) return;
  Store.commands.setSteelFrameRoofSpecification(roof.id, {
    gableFaceAAssemblyId: selectedTarget.side === 'a' ? systemId : roof.gableFaceAAssemblyId,
    gableFaceBAssemblyId: selectedTarget.side === 'b' ? systemId : roof.gableFaceBAssemblyId,
    soffitAssemblyId: roof.soffitAssemblyId, fasciaAssemblyId: roof.fasciaAssemblyId,
    parapetOuterAssemblyId: roof.parapetOuterAssemblyId, parapetInnerAssemblyId: roof.parapetInnerAssemblyId,
  });
}

function renderWall(panel: HTMLElement, wall: Wall): void {
  const side = selectedTarget!.side!;
  const selectedId = side === 'a' ? wall.faceAAssemblyId : wall.faceBAssemblyId;
  panel.querySelector<HTMLElement>('[data-sf-body]')!.innerHTML = `<div class="sf-selected-label">Parede · face ${side.toUpperCase()}</div>${systemButtons(selectedId)}
    <div class="sf-side-group"><h4>Isolamento térmico e acústico</h4>${insulationOptions.map((item) => `<button type="button" class="sf-system-option ${wall.cavityAssembly?.insulationSystemId === item.id ? 'selected' : ''}" data-sf-insulation="${item.id}"><strong>${item.label}</strong><small>${item.thickness ? item.thickness + ' mm' : 'Escolha explícita'}</small></button>`).join('')}</div>`;
  panel.querySelectorAll<HTMLButtonElement>('[data-sf-system]').forEach((button) => button.addEventListener('click', () => { saveWallFace(button.dataset.sfSystem!); finishSelectionWhenComplete(); render(); }));
  panel.querySelectorAll<HTMLButtonElement>('[data-sf-insulation]').forEach((button) => button.addEventListener('click', () => {
    const preset = insulationOptions.find((item) => item.id === button.dataset.sfInsulation)!;
    const cavityAssembly: WallCavityAssembly = { insulationSystemId: preset.id, thicknessMm: preset.thickness, purpose: 'thermal_acoustic' };
    Store.commands.setSteelFrameWallSpecification(wall.id, { faceAAssemblyId: wall.faceAAssemblyId, faceBAssemblyId: wall.faceBAssemblyId, cavityAssembly });
    finishSelectionWhenComplete();
    render();
  }));
}

function renderRoof(panel: HTMLElement, roof: Roof): void {
  if (selectedTarget!.kind === 'gable-face') {
    const side = selectedTarget!.side!;
    const selectedId = side === 'a' ? roof.gableFaceAAssemblyId : roof.gableFaceBAssemblyId;
    panel.querySelector<HTMLElement>('[data-sf-body]')!.innerHTML = `<div class="sf-selected-label">Oitão · face ${side.toUpperCase()}</div>${systemButtons(selectedId)}`;
    panel.querySelectorAll<HTMLButtonElement>('[data-sf-system]').forEach((button) => button.addEventListener('click', () => { saveGableFace(button.dataset.sfSystem!); finishSelectionWhenComplete(); render(); }));
    return;
  }
  panel.querySelector<HTMLElement>('[data-sf-body]')!.innerHTML = `<div class="sf-selected-label">Cobertura selecionada</div>
    <div class="sf-side-group"><h4>Beiral</h4>${soffitSystems.map((item) => `<button type="button" class="sf-system-option ${roof.soffitAssemblyId === item.id ? 'selected' : ''}" data-roof-field="soffitAssemblyId" data-sf-system="${item.id}"><strong>${item.label}</strong></button>`).join('')}</div>
    <div class="sf-side-group"><h4>Tabeira</h4>${systemButtons(roof.fasciaAssemblyId)}</div>
    ${roof.type === 'platibanda' ? `<div class="sf-side-group"><h4>Platibanda externa</h4>${systemButtons(roof.parapetOuterAssemblyId)}</div><div class="sf-side-group"><h4>Platibanda interna</h4>${systemButtons(roof.parapetInnerAssemblyId)}</div>` : ''}`;
  Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-sf-system]')).forEach((button) => button.addEventListener('click', () => {
    const title = button.closest('.sf-side-group')?.querySelector('h4')?.textContent || '';
    const field = button.dataset.roofField || (title === 'Tabeira' ? 'fasciaAssemblyId' : title.includes('externa') ? 'parapetOuterAssemblyId' : 'parapetInnerAssemblyId');
    Store.commands.setSteelFrameRoofSpecification(roof.id, {
      gableFaceAAssemblyId: roof.gableFaceAAssemblyId, gableFaceBAssemblyId: roof.gableFaceBAssemblyId,
      soffitAssemblyId: field === 'soffitAssemblyId' ? button.dataset.sfSystem : roof.soffitAssemblyId,
      fasciaAssemblyId: field === 'fasciaAssemblyId' ? button.dataset.sfSystem : roof.fasciaAssemblyId,
      parapetOuterAssemblyId: field === 'parapetOuterAssemblyId' ? button.dataset.sfSystem : roof.parapetOuterAssemblyId,
      parapetInnerAssemblyId: field === 'parapetInnerAssemblyId' ? button.dataset.sfSystem : roof.parapetInnerAssemblyId,
    });
    finishSelectionWhenComplete();
    render();
  }));
}

function render(): void {
  const panel = ensurePanel();
  const issues = steelFrameSpecificationIssues(Store.getProject());
  panel.querySelector<HTMLElement>('[data-sf-progress]')!.textContent = issues.length ? `${issues.length} seleções pendentes` : 'Configuração completa';
  panel.querySelector<HTMLElement>('[data-sf-guidance]')!.textContent = issues.length ? `Conclua ${issueLabel(issues[0]!).toLocaleLowerCase('pt-BR')}.` : 'Todas as superfícies foram configuradas.';
  const quantityButton = panel.querySelector<HTMLButtonElement>('[data-sf-quantity]')!;
  quantityButton.disabled = issues.length > 0;
  quantityButton.title = issues.length ? 'Conclua todas as faces para liberar o quantitativo.' : 'Abrir quantitativo';
  const wall = selectedWall();
  const roof = selectedRoof();
  if (selectedTarget?.kind === 'wall-face' && wall) renderWall(panel, wall);
  else if (selectedTarget && roof) renderRoof(panel, roof);
  else panel.querySelector<HTMLElement>('[data-sf-body]')!.innerHTML = pendingGuide(issues);
}

export function open(onComplete: () => void): void {
  completion = onComplete;
  selectedTarget = null;
  ensurePanel().classList.add('visible');
  ViewportController.setSteelFrameSurfaceSelectionHandler((target) => {
    if (targetIsConfigured(target)) {
      ensurePanel().querySelector<HTMLElement>('[data-sf-body]')!.innerHTML = '<div class="sf-click-instruction sf-complete-notice">Esta face já está configurada e marcada em verde. Escolha uma face que ainda não foi concluída.</div>';
      return false;
    }
    selectedTarget = target;
    render();
    return true;
  });
  render();
}

export function close(): void {
  document.getElementById('steelFrameConfigurator')?.classList.remove('visible');
  ViewportController.setSteelFrameSurfaceSelectionHandler(null);
  selectedTarget = null;
}

export function needsConfiguration(): boolean {
  const project = Store.getProject();
  return project.constructionSystem === 'light_steel_frame' && steelFrameSpecificationIssues(project).length > 0;
}
