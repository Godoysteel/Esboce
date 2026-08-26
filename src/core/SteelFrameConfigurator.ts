import { Store } from './Store.js';
import { STEEL_FRAME_FACE_ASSEMBLIES, steelFrameSpecificationIssues } from './SteelFrameAssemblies.js';
import type { Roof, Wall, WallCavityAssembly } from './types.js';

const external = STEEL_FRAME_FACE_ASSEMBLIES.filter((item) => item.use === 'external' || item.use === 'both');
const internal = STEEL_FRAME_FACE_ASSEMBLIES.filter((item) => item.use === 'internal' || item.use === 'both');
const soffit = STEEL_FRAME_FACE_ASSEMBLIES.filter((item) => item.use === 'soffit');
const insulationOptions = [
  { id: 'none', label: 'Sem isolamento', thickness: 0, purpose: 'thermal_acoustic' },
  { id: 'placlux.la-de-rocha', label: 'Lã de rocha PlacLux — térmico e acústico', thickness: 50, purpose: 'thermal_acoustic' },
  { id: 'glass-wool', label: 'Lã de vidro — térmico e acústico', thickness: 50, purpose: 'thermal_acoustic' },
  { id: 'pet-wool', label: 'Lã de PET — térmico e acústico', thickness: 50, purpose: 'thermal_acoustic' },
] as const;

function optionHtml(items: readonly { id: string; label: string }[], selected?: string): string {
  return '<option value="">Selecione…</option>' + items.map((item) =>
    `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${item.label}</option>`
  ).join('');
}

function wallCard(wall: Wall, index: number): string {
  const cavity = wall.cavityAssembly?.insulationSystemId;
  return `<section class="sf-config-card" data-wall-id="${wall.id}">
    <h3>Parede ${index + 1}</h3>
    <label>Face A <select data-field="faceAAssemblyId">${optionHtml(external, wall.faceAAssemblyId)}</select></label>
    <label>Face B / drywall interno <select data-field="faceBAssemblyId">${optionHtml(internal, wall.faceBAssemblyId)}</select></label>
    <label>Isolamento térmico e acústico <select data-field="cavityAssembly">${optionHtml(insulationOptions, cavity)}</select></label>
  </section>`;
}

function roofCard(roof: Roof, index: number): string {
  const hasGable = roof.type === 'duasAguas' || roof.type === 'umaAgua' || !!roof.steppedWallVolume;
  return `<section class="sf-config-card" data-roof-id="${roof.id}">
    <h3>Cobertura ${index + 1} — ${roof.type === 'platibanda' ? 'platibanda' : 'telhado'}</h3>
    ${hasGable ? `<label>Oitão face A <select data-field="gableFaceAAssemblyId">${optionHtml(external, roof.gableFaceAAssemblyId)}</select></label>
    <label>Oitão face B <select data-field="gableFaceBAssemblyId">${optionHtml(internal, roof.gableFaceBAssemblyId)}</select></label>` : ''}
    <label>Revestimento do beiral <select data-field="soffitAssemblyId">${optionHtml(soffit, roof.soffitAssemblyId)}</select></label>
    <label>Revestimento da tabeira <select data-field="fasciaAssemblyId">${optionHtml(external, roof.fasciaAssemblyId)}</select></label>
    ${roof.type === 'platibanda' ? `<label>Platibanda — face externa <select data-field="parapetOuterAssemblyId">${optionHtml(external, roof.parapetOuterAssemblyId)}</select></label>
    <label>Platibanda — face interna <select data-field="parapetInnerAssemblyId">${optionHtml(external, roof.parapetInnerAssemblyId)}</select></label>` : ''}
  </section>`;
}

function ensureDialog(): HTMLDivElement {
  let overlay = document.getElementById('steelFrameConfigurator') as HTMLDivElement | null;
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'steelFrameConfigurator';
  overlay.innerHTML = `<div class="sf-config-dialog"><header><div><strong>Configurar fechamento Steel Frame</strong><p>Selecione os sistemas de revestimento e isolamento térmico e acústico de cada face.</p></div><button type="button" data-sf-close>×</button></header><div data-sf-body></div><footer><span data-sf-status></span><button type="button" data-sf-save>Salvar e gerar quantitativo</button></footer></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-sf-close]')!.addEventListener('click', () => overlay!.classList.remove('visible'));
  return overlay;
}

export function open(onComplete: () => void): void {
  const project = Store.getProject();
  const overlay = ensureDialog();
  const walls = project.floors.flatMap((floor) => floor.walls).filter((wall) => !wall.demolished);
  const roofs = project.floors.flatMap((floor) => floor.roofs || []);
  overlay.querySelector<HTMLElement>('[data-sf-body]')!.innerHTML = walls.map(wallCard).join('') + roofs.map(roofCard).join('');
  overlay.classList.add('visible');
  const save = overlay.querySelector<HTMLButtonElement>('[data-sf-save]')!;
  save.onclick = () => {
    overlay.querySelectorAll<HTMLElement>('[data-wall-id]').forEach((card) => {
      const value = (field: string) => card.querySelector<HTMLSelectElement>(`[data-field="${field}"]`)!.value || undefined;
      const insulation = value('cavityAssembly');
      const preset = insulationOptions.find((item) => item.id === insulation);
      const cavityAssembly: WallCavityAssembly | undefined = preset ? {
        insulationSystemId: preset.id,
        thicknessMm: preset.thickness,
        purpose: preset.purpose,
      } : undefined;
      Store.commands.setSteelFrameWallSpecification(card.dataset.wallId!, {
        faceAAssemblyId: value('faceAAssemblyId'), faceBAssemblyId: value('faceBAssemblyId'), cavityAssembly,
      });
    });
    overlay.querySelectorAll<HTMLElement>('[data-roof-id]').forEach((card) => {
      const value = (field: string) => card.querySelector<HTMLSelectElement>(`[data-field="${field}"]`)?.value || undefined;
      Store.commands.setSteelFrameRoofSpecification(card.dataset.roofId!, {
        gableFaceAAssemblyId: value('gableFaceAAssemblyId'), gableFaceBAssemblyId: value('gableFaceBAssemblyId'),
        soffitAssemblyId: value('soffitAssemblyId'), fasciaAssemblyId: value('fasciaAssemblyId'),
        parapetOuterAssemblyId: value('parapetOuterAssemblyId'), parapetInnerAssemblyId: value('parapetInnerAssemblyId'),
      });
    });
    const remaining = steelFrameSpecificationIssues(project);
    const status = overlay.querySelector<HTMLElement>('[data-sf-status]')!;
    if (remaining.length) {
      status.textContent = `Faltam ${remaining.length} escolhas obrigatórias.`;
      return;
    }
    overlay.classList.remove('visible');
    onComplete();
  };
}

export function needsConfiguration(): boolean {
  const project = Store.getProject();
  return project.constructionSystem === 'light_steel_frame' && steelFrameSpecificationIssues(project).length > 0;
}
