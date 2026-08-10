// FloorTabsController — abas de pavimento (térreo, 1º andar...). Migrado
// de `var FloorTabsController = (function(){...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 6042-6060).

import { Store } from './Store.js';
import { ViewportController } from './ViewportController.js';

let container: HTMLElement | null;
let labelEl: HTMLElement | null;

export function init(): void {
  container = document.getElementById('floorTabs');
  labelEl = document.getElementById('floorMenuLabel');
  refresh();
}

export function refresh(): void {
  if (!container) return;
  const project = Store.getProject();
  container.innerHTML = '';
  project.floors.forEach(function (floor, idx) {
    const btn = document.createElement('button');
    btn.className = 'floor-tab' + (idx === project.currentFloorIndex ? ' active' : '');
    btn.textContent = floor.name + (floor.kind === 'attic' ? ' · Ático/Chalé' : '');
    btn.addEventListener('click', function () {
      Store.commands.setCurrentFloor(idx);
      ViewportController.deselect();
    });
    container!.appendChild(btn);
  });
  // Label do botão-gatilho (ex.: "Térreo ▾") — a lista de andares
  // inteira só aparece dentro do menu suspenso agora, não mais como
  // pills sempre visíveis na barra (ver DEC-38, revisão 3).
  if (labelEl) {
    const current = project.floors[project.currentFloorIndex];
    labelEl.textContent = current ? current.name + (current.kind === 'attic' ? ' · Ático/Chalé' : '') : 'Pavimento';
  }
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const FloorTabsController = { init, refresh };
