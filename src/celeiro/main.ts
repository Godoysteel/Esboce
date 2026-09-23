// Configurador de celeiro/galpão metálico (DEC-230): liga o formulário em
// passos, o viewer 3D e a cotação (BarnPricing.ts) — lead via WhatsApp.
import {
  BARN_COLORS, BARN_GATE_TYPES, BARN_ROOFS, buildWhatsappUrl, computeQuote, defaultBarnConfig, formatBRL,
  normalizeBarnConfig, type BarnConfig, type BarnContact, type BarnGateType, type BarnModel, type BarnRoof,
} from './BarnPricing.js';
import { createBarnViewer } from './BarnScene.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let config: BarnConfig = defaultBarnConfig();
let step = 1;
const TOTAL_STEPS = 5;

// Modo embutido (?embed=1): sem cabeçalho/rodapé, pra usar em iframe em outro
// site (ex.: página de galpões de um parceiro). Avisa a página-mãe da altura
// via postMessage ({type:'celeiro-height', height}) pra ela ajustar o iframe.
if (new URLSearchParams(location.search).get('embed') === '1') {
  document.body.classList.add('embed');
  const postHeight = () => window.parent !== window && window.parent.postMessage({ type: 'celeiro-height', height: document.documentElement.scrollHeight }, '*');
  new ResizeObserver(postHeight).observe(document.body);
}

const viewer = createBarnViewer($('viewer'));

function contact(): BarnContact {
  return { name: $<HTMLInputElement>('name').value.trim(), phone: $<HTMLInputElement>('phone').value.trim(), city: $<HTMLInputElement>('city').value.trim(), notes: $<HTMLTextAreaElement>('notes').value.trim() };
}

function fmtM(v: number) { return String(v).replace('.', ',') + ' m'; }

function render() {
  const c = normalizeBarnConfig(config);
  const clamped = c.windows !== config.windows || c.doors !== config.doors || c.gates !== config.gates;
  config = c;
  const q = computeQuote(c);
  viewer.update(c);

  document.querySelectorAll<HTMLElement>('.model').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.model === c.model)));
  document.querySelectorAll<HTMLElement>('.sw').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === c.colorId)));
  $('siloRow').style.display = c.model === 'celeiro' ? '' : 'none';
  $('acmRow').style.display = c.model === 'aberto' ? 'none' : '';
  $('gateBox').style.display = c.model === 'aberto' ? 'none' : '';
  $<HTMLInputElement>('silo').checked = c.silo; $<HTMLInputElement>('acm').checked = c.acm;

  $('area').textContent = String(q.areaM2).replace('.', ',');
  $('wVal').textContent = fmtM(c.widthM); $('lVal').textContent = fmtM(c.lengthM); $('eVal').textContent = fmtM(c.eaveHeightM);
  $('gwVal').textContent = fmtM(c.gateWidthM); $('ghVal').textContent = fmtM(c.gateHeightM);
  $('windows').textContent = String(c.windows); $('doors').textContent = String(c.doors); $('gates').textContent = String(c.gates);
  $<HTMLInputElement>('gateH').value = String(c.gateHeightM);
  const warn = $('limitWarn');
  warn.hidden = !clamped;
  warn.textContent = clamped ? 'Ajustamos a quantidade de aberturas ao espaço disponível nas paredes.' : '';

  $('lines').innerHTML = q.lines.map((l) => `<li><span>${l.label}</span><span>${formatBRL(l.amount)}</span></li>`).join('');
  $('range').textContent = `${formatBRL(q.low)} a ${formatBRL(q.high)}`;

  document.querySelectorAll<HTMLElement>('.step').forEach((s) => s.classList.toggle('active', Number(s.dataset.step) === step));
  document.querySelectorAll('#stepBar i').forEach((i, idx) => i.classList.toggle('on', idx < step));
  $<HTMLButtonElement>('prev').disabled = step === 1;
  $('next').style.display = step === TOTAL_STEPS ? 'none' : '';
  $('waWrap').hidden = step !== TOTAL_STEPS;
  const ct = contact();
  $<HTMLButtonElement>('wa').disabled = !(ct.name && ct.phone.replace(/\D/g, '').length >= 8);
}

function set(patch: Partial<BarnConfig>) { config = { ...config, ...patch }; render(); }

$('swatches').innerHTML = BARN_COLORS.map((c) => `<button class="sw" data-color="${c.id}" title="${c.label}" aria-label="${c.label}" style="background:${c.hex}" aria-pressed="false"></button>`).join('');
$('roof').innerHTML = BARN_ROOFS.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
$('gateType').innerHTML = BARN_GATE_TYPES.map((g) => `<option value="${g.id}">${g.label}</option>`).join('');

document.querySelectorAll<HTMLElement>('.model').forEach((b) => b.addEventListener('click', () => set({ model: b.dataset.model as BarnModel })));
$('swatches').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.sw'); if (b) set({ colorId: b.dataset.color! }); });
$('acm').addEventListener('change', (e) => set({ acm: (e.target as HTMLInputElement).checked }));
$('silo').addEventListener('change', (e) => set({ silo: (e.target as HTMLInputElement).checked }));
$('width').addEventListener('input', (e) => set({ widthM: Number((e.target as HTMLInputElement).value) }));
$('length').addEventListener('input', (e) => set({ lengthM: Number((e.target as HTMLInputElement).value) }));
$('eave').addEventListener('input', (e) => set({ eaveHeightM: Number((e.target as HTMLInputElement).value) }));
$('roof').addEventListener('change', (e) => set({ roof: (e.target as HTMLSelectElement).value as BarnRoof }));
$('gateType').addEventListener('change', (e) => set({ gateType: (e.target as HTMLSelectElement).value as BarnGateType }));
$('gateW').addEventListener('input', (e) => set({ gateWidthM: Number((e.target as HTMLInputElement).value) }));
$('gateH').addEventListener('input', (e) => set({ gateHeightM: Number((e.target as HTMLInputElement).value) }));
document.querySelectorAll<HTMLElement>('[data-count]').forEach((b) => b.addEventListener('click', () => {
  const key = b.dataset.count as 'windows' | 'doors' | 'gates';
  set({ [key]: Math.max(0, config[key] + Number(b.dataset.d)) } as Partial<BarnConfig>);
}));
['name', 'phone', 'city', 'notes'].forEach((id) => $(id).addEventListener('input', render));
$('prev').addEventListener('click', () => { step = Math.max(1, step - 1); render(); });
$('next').addEventListener('click', () => { step = Math.min(TOTAL_STEPS, step + 1); render(); });
$('wa').addEventListener('click', () => {
  const q = computeQuote(config);
  window.open(buildWhatsappUrl(config, q, contact()), '_blank', 'noopener');
});

render();
