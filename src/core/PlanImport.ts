// Leitura de arquivo pra virar Planta Baixa de referência (ver
// Core.createPlanUnderlayEntity) — aceita imagem direto, ou a
// PRIMEIRA página de um PDF, rasterizada num canvas via pdfjs-dist.
//
// Escopo desta etapa: só a primeira página do PDF (a maioria das
// plantas exportadas em PDF tem uma página por pavimento; múltiplas
// páginas/pavimentos por PDF fica pra quando for pedido). Nenhuma
// extração de linha/parede — é só virar imagem, a extração automática
// de geometria é um projeto bem maior à parte (ver conversa com o
// Product Owner: visão computacional pra detectar parede tem
// confiabilidade parcial mesmo no estado da arte).

export interface PlanImportResult {
  dataUrl: string;
  /** largura / altura, em pixels da imagem/página renderizada. */
  aspect: number;
}

const PDF_RENDER_SCALE = 2; // resolução razoável sem pesar demais o dataURL final

async function renderPdfFirstPageToDataUrl(file: File): Promise<PlanImportResult> {
  // Import tardio (só quando o usuário realmente importa um PDF) —
  // pdfjs-dist é uma dependência relativamente pesada, não faz sentido
  // no bundle inicial só pra quem nunca vai importar PDF nenhum.
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar o canvas de renderização do PDF.');
  // Fundo branco explícito — PDFs costumam ter fundo transparente, e
  // sem isso o canvas nasceria com alpha=0 (texto preto sobre nada,
  // ilegível quando a opacidade do underlay reduzir o contraste).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height };
}

function readImageFileToDataUrl(file: File): Promise<PlanImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível decodificar a imagem.'));
      img.onload = () => resolve({ dataUrl, aspect: img.naturalWidth / (img.naturalHeight || 1) });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function readPlanFile(file: File): Promise<PlanImportResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) return renderPdfFirstPageToDataUrl(file);
  if (!file.type.startsWith('image/')) {
    throw new Error('Formato não suportado — importe uma imagem (PNG/JPG) ou um PDF.');
  }
  return readImageFileToDataUrl(file);
}