// MaterialsSheet — abre uma janela separada do navegador com a lista de
// materiais em formato de planilha (agregada ou detalhada por
// elemento), que se atualiza sozinha enquanto o editor estiver aberto.
// Migrado de `var MaterialsSheet = (function(){...})()` no index.html
// monolítico original (ver legacy/index-monolito-original.html, linhas
// 6896-6978).

import { MaterialsPanel } from './MaterialsPanel.js';

let win: Window | null = null;
let detailMode = false;

const PAGE_STYLE = '' +
  'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:24px;background:#F4F1EA;color:#2C2C2A;}' +
  'h1{font-size:20px;margin:0 0 2px;}' +
  'p.sub{color:#5F5E5A;margin:0 0 12px;font-size:13px;}' +
  'label.toggle{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#5F5E5A;margin-bottom:12px;cursor:pointer;}' +
  'table{border-collapse:collapse;width:100%;background:#FFFFFF;border:1px solid #D3D1C7;border-radius:8px;overflow:hidden;}' +
  'thead th{position:sticky;top:0;background:#534AB7;color:#FFFFFF;text-align:left;padding:9px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;}' +
  'tbody td{padding:8px 12px;font-size:13.5px;border-top:1px solid #EDEAE1;}' +
  'tbody tr:nth-child(even){background:#FAF9F5;}' +
  'tbody tr.cat-first td:first-child{font-weight:600;color:#534AB7;}' +
  'tbody tr.total-row td{font-weight:700;border-top:2px solid #534AB7;}' +
  'td.qty{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}' +
  '.empty{padding:24px;color:#9C9A92;font-size:13.5px;}' +
  '.updated{color:#9C9A92;font-size:11.5px;margin-top:10px;}';

function escapeHtml(s: unknown): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Colunas variam por modo (agregado tem preço/custo, detalhado não) —
// renderiza quantas o header pedir, em vez de fixar 4.
function tableHtml(rows: (string | number)[][], headers: string[]): string {
  if (!rows.length) return '<div class="empty">Comece a desenhar pra ver os materiais aqui.</div>';
  let html = '<table><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
  let lastCat: string | number | null = null;
  rows.forEach(function (r) {
    const isTotal = r[0] === 'TOTAL';
    const isFirstOfCat = r[0] !== lastCat;
    lastCat = r[0]!;
    html += '<tr class="' + (isTotal ? 'total-row' : (isFirstOfCat ? 'cat-first' : '')) + '">';
    r.forEach(function (cell, i) {
      const isQty = i === 2 || i === 4 || i === 5; // quantidade, preço médio, custo — alinhados à direita
      const text = (i === 0 && !isFirstOfCat && !isTotal) ? '' : escapeHtml(cell);
      html += '<td' + (isQty ? ' class="qty"' : '') + '>' + text + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

export function refresh(): void {
  if (!win || win.closed) return;
  const body = win.document.getElementById('sheetBody');
  const stamp = win.document.getElementById('sheetUpdated');
  const checkbox = win.document.getElementById('sheetDetailToggle') as HTMLInputElement | null;
  if (checkbox) detailMode = checkbox.checked;
  if (!body) return;
  const rows = detailMode ? MaterialsPanel.buildDetailRows() : MaterialsPanel.buildRows();
  const headers = detailMode
    ? ['Pavimento', 'Elemento', 'Medida', 'Unidade']
    : ['Categoria', 'Item', 'Quantidade', 'Unidade', 'Preço médio', 'Custo estimado'];
  body.innerHTML = tableHtml(rows, headers);
  if (stamp) stamp.textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-BR');
}

export function open(): void {
  if (win && !win.closed) {
    win.focus();
    refresh();
    return;
  }
  win = window.open('', 'esboce-materiais-planilha', 'width=760,height=680');
  if (!win) return; // pop-up bloqueado pelo navegador
  win.document.title = 'Esboce — Lista de materiais';
  win.document.head.innerHTML = '<meta charset="UTF-8"><style>' + PAGE_STYLE + '</style>';
  win.document.body.innerHTML =
    '<h1>Lista de materiais</h1>' +
    '<p class="sub">Atualiza sozinha enquanto a aba do editor estiver aberta.</p>' +
    '<label class="toggle"><input type="checkbox" id="sheetDetailToggle"> Detalhar por elemento (conferir cada parede/cômodo contra o desenho)</label>' +
    '<div id="sheetBody"></div>' +
    '<p class="sub" style="margin-top:10px;">Preços: média nacional de referência (Calculobra/SINAPI/Lar Pontual, 2026) para insumos genéricos, e preço do produto do Catálogo quando aplicável. Varia por região/fornecedor — não é cotação.</p>' +
    '<div class="updated" id="sheetUpdated"></div>';
  win.document.getElementById('sheetDetailToggle')?.addEventListener('change', refresh);
  refresh();
}

// Namespace de compatibilidade — mesma razão dos demais módulos.
export const MaterialsSheet = { open, refresh };
