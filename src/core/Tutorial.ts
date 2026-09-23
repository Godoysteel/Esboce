// Tutorial guiado interativo — 7 passos que ensinam o fluxo básico do
// Esboce (criar cômodos, aberturas, forro, telhado, orçamento). Trava o
// resto da interface com um overlay "spotlight" (4 tiras que cobrem tudo
// exceto o alvo do passo atual) em vez de desabilitar botão por botão —
// a superfície de botões do app é grande e heterogênea (.tool-btn,
// .ts-btn, .cat-rail-btn, [data-room-preset] etc.), então um overlay
// único é mais robusto que teria que lembrar de cada um deles.
//
// Detecção de conclusão de cada passo é feita ouvindo os eventos que o
// Store já emite (Store.onChange) sempre que possível — só a etapa de
// orçamento (exportação de PDF) não passa pelo Store, e usa um listener
// de clique extra no botão já existente.

import { Store } from './Store.js';
import type { StoreEvent } from './types.js';

interface TutorialPhase {
  // Seletor CSS do elemento a destacar, ou 'viewport' pra liberar toda a
  // área de trabalho (usado quando a ação acontece dentro da cena 3D,
  // sem um botão específico pra apontar).
  target: string | 'viewport';
  // Categoria do rail a abrir antes de destacar (o Tutorial troca o
  // painel sozinho, clicando no botão real do rail — não duplica a
  // lógica de EsboceApplication.showCategory).
  category?: 'ambientes' | 'aberturas' | 'cobertura';
  text: string;
  // Depois de clicar no alvo, o passo continua dentro da cena 3D (ex.:
  // armar a ferramenta de porta/janela/telhado e depois clicar sobre uma
  // parede/o topo da casa pra posicionar). Nesses casos o buraco do
  // spotlight se expande pra viewport inteira assim que o alvo é
  // clicado, senão o clique de posicionamento ficaria bloqueado.
  armsViewportOnClick?: boolean;
}

interface TutorialStep {
  id: string;
  phases: TutorialPhase[];
}

const TUTORIAL_SEEN_KEY = 'esboce_tutorial_seen_v1';

const STEPS: TutorialStep[] = [
  {
    id: 'room-create',
    phases: [
      {
        target: '#panelAmbientes .cp-group-grid',
        category: 'ambientes',
        text: "Vamos começar! Clique em um dos ambientes prontos — que tal um Quarto? — para criar seu primeiro cômodo.",
      },
      {
        target: 'viewport',
        text: "Ótimo, o cômodo foi criado! Agora arraste uma das paredes dele para ajustar a posição ou o tamanho.",
      },
    ],
  },
  {
    id: 'room-second',
    phases: [
      {
        target: '#panelAmbientes .cp-group-grid',
        category: 'ambientes',
        text: "Agora crie um segundo cômodo — pode ser outro tipo, como Sala ou Cozinha.",
      },
      {
        target: 'viewport',
        text: "Arraste o novo cômodo até encostar no primeiro — e depois arraste uma das paredes já conectadas para ajustar o tamanho.",
      },
    ],
  },
  {
    id: 'door',
    phases: [
      {
        target: '#toolPorta',
        category: 'aberturas',
        text: "Toda casa precisa de uma entrada! Clique em 'Abrir' (porta) e depois sobre uma das paredes para posicioná-la.",
        armsViewportOnClick: true,
      },
    ],
  },
  {
    id: 'window',
    phases: [
      {
        target: '#toolJanela',
        category: 'aberturas',
        text: "Agora uma janela — clique em 'Janela' e depois sobre uma parede para posicioná-la.",
        armsViewportOnClick: true,
      },
    ],
  },
  {
    id: 'forro',
    phases: [
      {
        target: '#generateForroDrywallBtn',
        category: 'cobertura',
        text: "Vamos fechar o teto! Clique em 'Forro de Drywall' para gerar o forro dos cômodos fechados.",
      },
    ],
  },
  {
    id: 'roof',
    phases: [
      {
        target: '#toolTelhado',
        category: 'cobertura',
        text: "Falta o telhado. Clique em '2 Águas', escolha 'Telhado normal' na caixa que aparecer, e clique sobre o topo da casa para posicioná-lo.",
        armsViewportOnClick: true,
      },
    ],
  },
  {
    id: 'budget',
    phases: [
      { target: '#materialsToggleBtn', text: "Última etapa! Clique em 'Quantitativo' para abrir o orçamento." },
      { target: '#materialsCategoryMenu', text: "Clique em 'Geral' para abrir o painel completo de materiais." },
      { target: '#materialsPanel', text: "Por fim, clique no ícone de PDF (📄) para gerar o orçamento. Parabéns, você concluiu o tutorial!" },
    ],
  },
];

let active = false;
let stepIndex = 0;
let phaseIndex = 0;
let viewportWidened = false;
let pulsedEl: HTMLElement | null = null;

function currentStep(): TutorialStep | undefined {
  return STEPS[stepIndex];
}
function currentPhase(): TutorialPhase | undefined {
  return currentStep()?.phases[phaseIndex];
}

function markSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch (err) {
    console.warn('Não deu pra gravar localStorage — tutorial vai reaparecer na próxima carga:', err);
  }
}

export function maybeAutoStart(): void {
  let seen = false;
  try {
    seen = localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
  } catch (err) {
    console.warn('Não deu pra ler localStorage — tutorial pode aparecer de novo:', err);
  }
  if (seen) return;
  // Projeto não-vazio (ex.: link compartilhado de uma casa pronta) não
  // dispara o tutorial sozinho — "crie um cômodo" não faz sentido em
  // cima de uma construção que já existe. Fica marcado como visto, mas
  // continua acessível pelo botão de ajuda.
  if (Store.currentWalls().length > 0) {
    markSeen();
    return;
  }
  start();
}

export function start(): void {
  active = true;
  stepIndex = 0;
  phaseIndex = 0;
  viewportWidened = false;
  enterPhase();
}

function deactivate(): void {
  active = false;
  clearPulse();
  hideOverlay();
  markSeen();
}

export function skip(): void {
  deactivate();
}

function finish(): void {
  deactivate();
}

function advance(): void {
  if (!active) return;
  const step = currentStep();
  if (!step) {
    finish();
    return;
  }
  viewportWidened = false;
  if (phaseIndex < step.phases.length - 1) {
    phaseIndex += 1;
  } else {
    stepIndex += 1;
    phaseIndex = 0;
  }
  if (!currentStep()) {
    finish();
    return;
  }
  enterPhase();
}

function enterPhase(): void {
  const phase = currentPhase();
  if (!phase) {
    finish();
    return;
  }
  if (phase.category) {
    document.querySelector<HTMLElement>('.cat-rail-btn[data-category="' + phase.category + '"]')?.click();
  }
  updateBoxText(phase.text);
  bindArmsViewportOnClick(phase);
  positionSpotlight();
}

function bindArmsViewportOnClick(phase: TutorialPhase): void {
  if (!phase.armsViewportOnClick || phase.target === 'viewport') return;
  const el = document.querySelector<HTMLElement>(phase.target);
  if (!el) return;
  el.addEventListener(
    'click',
    function () {
      if (!active || currentPhase() !== phase) return;
      viewportWidened = true;
      positionSpotlight();
    },
    { once: true },
  );
}

function effectiveTargetRect(): DOMRect | null {
  const phase = currentPhase();
  if (!phase) return null;
  if (phase.target === 'viewport' || viewportWidened) {
    return document.getElementById('viewport')?.getBoundingClientRect() ?? null;
  }
  return document.querySelector<HTMLElement>(phase.target)?.getBoundingClientRect() ?? null;
}

function applyPulse(): void {
  const phase = currentPhase();
  if (!phase || phase.target === 'viewport' || viewportWidened) return;
  const el = document.querySelector<HTMLElement>(phase.target);
  if (!el) return;
  el.classList.add('tutorial-target-pulse');
  pulsedEl = el;
}

function clearPulse(): void {
  if (pulsedEl) {
    pulsedEl.classList.remove('tutorial-target-pulse');
    pulsedEl = null;
  }
}

function showOverlay(): void {
  document.getElementById('tutorialSpotlight')?.classList.add('visible');
  document.getElementById('tutorialBox')?.classList.add('visible');
}

function hideOverlay(): void {
  document.getElementById('tutorialSpotlight')?.classList.remove('visible');
  document.getElementById('tutorialBox')?.classList.remove('visible');
}

function setStripRect(el: HTMLElement | null, x: number, y: number, w: number, h: number): void {
  if (!el) return;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = Math.max(0, w) + 'px';
  el.style.height = Math.max(0, h) + 'px';
}

function positionSpotlight(): void {
  clearPulse();
  const rect = effectiveTargetRect();
  if (!rect) {
    hideOverlay();
    return;
  }
  showOverlay();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const x0 = Math.max(0, rect.left - pad);
  const y0 = Math.max(0, rect.top - pad);
  const x1 = Math.min(vw, rect.right + pad);
  const y1 = Math.min(vh, rect.bottom + pad);
  setStripRect(document.querySelector('[data-strip="top"]'), 0, 0, vw, y0);
  setStripRect(document.querySelector('[data-strip="bottom"]'), 0, y1, vw, vh - y1);
  setStripRect(document.querySelector('[data-strip="left"]'), 0, y0, x0, y1 - y0);
  setStripRect(document.querySelector('[data-strip="right"]'), x1, y0, vw - x1, y1 - y0);
  applyPulse();
  positionBox(rect);
}

function positionBox(rect: DOMRect): void {
  const box = document.getElementById('tutorialBox');
  if (!box) return;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const boxWidth = Math.min(320, vw - 32);
  const boxHeight = box.offsetHeight || 140;
  let left = rect.right + margin;
  let top = rect.top;
  if (left + boxWidth > vw - 12) {
    left = rect.left - margin - boxWidth;
  }
  if (left < 12) {
    left = Math.min(Math.max(12, rect.left), Math.max(12, vw - boxWidth - 12));
    top = rect.bottom + margin;
    if (top + boxHeight > vh - 12) top = Math.max(12, rect.top - margin - boxHeight);
  }
  top = Math.min(Math.max(12, top), Math.max(12, vh - boxHeight - 12));
  box.style.left = left + 'px';
  box.style.top = top + 'px';
}

function updateBoxText(text: string): void {
  const label = document.getElementById('tutorialStepLabel');
  const body = document.getElementById('tutorialStepText');
  if (label) label.textContent = 'Passo ' + (stepIndex + 1) + ' de ' + STEPS.length;
  if (body) body.textContent = text;
}

function handleStoreEvent(event: StoreEvent): void {
  const stepId = currentStep()?.id;
  switch (event.type) {
    case 'RoomCreated':
      if (stepId === 'room-create' || stepId === 'room-second') advance();
      break;
    // A primeira interação de arraste de um cômodo recém-criado (ainda
    // isolado) sempre move o módulo inteiro (WallsGroupDragged) — só vira
    // um resize de parede de verdade depois que ele já fundiu com outra
    // estrutura. Por decisão do Product Owner, a etapa 2 exige
    // especificamente o resize de uma parede já conectada — o arraste
    // de aproximação (WallsGroupDragged) não conta como conclusão dela.
    case 'WallsGroupDragged':
      if (stepId === 'room-create') advance();
      break;
    case 'WallResizeDragged':
    case 'WallEndpointMoved':
    case 'WallMoved':
      if (stepId === 'room-second') advance();
      break;
    case 'OpeningCreated': {
      if (stepId !== 'door' && stepId !== 'window') break;
      const opening = Store.findOpening(event.openingId as string);
      if (stepId === 'door' && opening?.kind === 'door') advance();
      if (stepId === 'window' && opening?.kind === 'window') advance();
      break;
    }
    case 'ForroDrywallGenerated':
      if (stepId === 'forro') advance();
      break;
    case 'RoofCreated':
    case 'RoofsAutoGenerated':
      if (stepId === 'roof') advance();
      break;
  }
}

export function init(): void {
  Store.onChange(function (event) {
    if (active) handleStoreEvent(event);
  });

  // Etapa de orçamento: exportPdf()/exportSteelFramePdf() não passam
  // pelo Store (não emitem StoreEvent), então a conclusão dos 3
  // cliques (abrir popup → "Geral" → PDF) é detectada por listeners de
  // clique extras — somam-se aos listeners de sempre do MaterialsPanel,
  // sem modificá-lo.
  document.getElementById('materialsToggleBtn')?.addEventListener('click', function () {
    if (active && currentStep()?.id === 'budget' && phaseIndex === 0) advance();
  });
  document.getElementById('materialsCategoryMenu')?.addEventListener('click', function (e: MouseEvent) {
    if (!active || currentStep()?.id !== 'budget' || phaseIndex !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-materials-category="geral"]')) advance();
  });
  document.getElementById('materialsPdfBtn')?.addEventListener('click', function () {
    if (active && currentStep()?.id === 'budget' && phaseIndex === 2) advance();
  });

  document.getElementById('tutorialSkipBtn')?.addEventListener('click', skip);
  document.getElementById('tutorialHelpBtn')?.addEventListener('click', start);

  document.querySelectorAll<HTMLElement>('.tutorial-spotlight-strip').forEach(function (strip) {
    strip.addEventListener('click', function () {
      const hint = document.getElementById('viewportHint');
      if (hint) hint.textContent = "Complete a etapa atual do tutorial primeiro, ou clique em 'Pular tutorial'.";
    });
  });

  window.addEventListener('resize', function () {
    if (active) positionSpotlight();
  });
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const Tutorial = { init, start, skip, maybeAutoStart };
