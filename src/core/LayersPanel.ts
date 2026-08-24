// LayersPanel — checkboxes de visibilidade por camada (fundação,
// calçada, paredes, laje, telhado etc.). Migrado de `var LayersPanel =
// (function(){...})()` no index.html monolítico original (ver
// legacy/index-monolito-original.html, linhas 6065-6095).

import { Store } from './Store.js';
import type { ProjectLayers } from './types.js';

function bind(elId: string, key: keyof ProjectLayers): void {
  document.getElementById(elId)?.addEventListener('change', function (e: any) {
    Store.commands.setLayerVisible(key, e.target.checked);
  });
}

export function init(): void {
  bind('radierToggle', 'fundacao');
  bind('calcadaToggle', 'calcada');
  bind('paredesTerreoToggle', 'paredesTerreo');
  bind('colunasToggle', 'colunas');
  bind('lajeToggle', 'laje');
  bind('forroDrywallToggle', 'forroDrywall');
  bind('paredesSuperioresToggle', 'paredesSuperiores');
  bind('aberturasToggle', 'aberturas');
  bind('marquiseToggle', 'marquise');
  bind('telhadoToggle', 'telhado');
  bind('varandaToggle', 'varanda');
  bind('paredesTransparentesToggle', 'paredesTransparentes');
  bind('niveisSuperioresToggle', 'niveisSuperiores');
  const layers = Store.getProject().layers;
  (document.getElementById('radierToggle') as HTMLInputElement).checked = layers.fundacao;
  (document.getElementById('calcadaToggle') as HTMLInputElement).checked = layers.calcada;
  (document.getElementById('paredesTerreoToggle') as HTMLInputElement).checked = layers.paredesTerreo;
  (document.getElementById('colunasToggle') as HTMLInputElement).checked = layers.colunas;
  (document.getElementById('lajeToggle') as HTMLInputElement).checked = layers.laje;
  (document.getElementById('forroDrywallToggle') as HTMLInputElement).checked = layers.forroDrywall;
  (document.getElementById('paredesSuperioresToggle') as HTMLInputElement).checked = layers.paredesSuperiores;
  (document.getElementById('aberturasToggle') as HTMLInputElement).checked = layers.aberturas;
  (document.getElementById('marquiseToggle') as HTMLInputElement).checked = layers.marquise;
  (document.getElementById('telhadoToggle') as HTMLInputElement).checked = layers.telhado;
  (document.getElementById('varandaToggle') as HTMLInputElement).checked = layers.varanda;
  (document.getElementById('paredesTransparentesToggle') as HTMLInputElement).checked = layers.paredesTransparentes;
  (document.getElementById('niveisSuperioresToggle') as HTMLInputElement).checked = layers.niveisSuperiores;
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const LayersPanel = { init };
