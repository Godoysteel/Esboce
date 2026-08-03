// FloorTabsController — abas de pavimento (térreo, 1º andar...). Migrado
// de `var FloorTabsController = (function(){...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 6042-6060).

import { Store } from './Store.js';
import { ViewportController } from './ViewportController.js';

let container: HTMLElement | null;

export function init(): void {
  container = document.getElementById('floorTabs');
  refresh();
}

export function refresh(): void {
  if (!container) return;
  const project = Store.getProject();
  container.innerHTML = '';
  project.floors.forEach(function (floor, idx) {
    const btn = document.createElement('button');
    btn.className = 'floor-tab' + (idx === project.currentFloorIndex ? ' active' : '');
    btn.textContent = floor.name;
    btn.addEventListener('click', function () {
      Store.commands.setCurrentFloor(idx);
      ViewportController.deselect();
    });
    container!.appendChild(btn);
  });
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const FloorTabsController = { init, refresh };
