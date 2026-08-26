import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const supabaseUrl = 'https://dugcwndtflcjajffxjko.supabase.co';
const publishableKey = 'sb_publishable_32BTfCDesA9WyH9Ltm0-zw_MKttNAfO';
const outputDir = path.resolve('public/produtos/placlux');
const downloadOnly = process.argv.includes('--download-only');
const verifyOnly = process.argv.includes('--verify-only');

const images = [
  ['chapa-profort-next.png', 'https://placlux.com.br/wp-content/uploads/2023/08/chapa_pf-2.png'],
  ['base-coat.png', 'https://placlux.com.br/wp-content/uploads/2023/08/basecoat.png'],
  ['fita-fiberglass.png', 'https://placlux.com.br/wp-content/uploads/2023/08/fita_fiber.png'],
  ['membrana-hidrofuga.png', 'https://placlux.com.br/wp-content/uploads/2023/08/membrana.png'],
  ['tela-fiberglass.png', 'https://placlux.com.br/wp-content/uploads/2023/08/tela.png'],
  ['pingadeira-pvc.png', 'https://placlux.com.br/wp-content/uploads/2023/08/pingadeira.png'],
  ['parafuso-pa-032.png', 'https://placlux.com.br/wp-content/uploads/2023/08/pa32.png'],
  ['parafuso-pb-032.png', 'https://placlux.com.br/wp-content/uploads/2023/08/pb32.png'],
  ['cantoneira-pvc.png', 'https://placlux.com.br/wp-content/uploads/2023/08/cantoneira.png'],
  ['chapa-drywall.png', 'https://placlux.com.br/wp-content/uploads/2023/08/chapas_dw.png'],
  ['la-de-rocha.png', 'https://placlux.com.br/wp-content/uploads/2023/08/rocha.png'],
  ['massa-drywall.png', 'https://placlux.com.br/wp-content/uploads/2023/08/massa_dw.png'],
  ['protherm.png', 'https://placlux.com.br/wp-content/uploads/2023/08/protheerm.png'],
  ['total-wall.png', 'https://placlux.com.br/wp-content/uploads/2025/02/prod_totalwall.png'],
  ['manta-acrilica.png', 'https://placlux.com.br/wp-content/uploads/2023/08/manta.png'],
  ['primer-protect-wall.png', 'https://placlux.com.br/wp-content/uploads/2025/02/prod_primerprotectwall.png'],
  ['adesivo-chapisco.png', 'https://placlux.com.br/wp-content/uploads/2023/08/adesivo-1.png'],
  ['perfis-drywall.png', 'https://placlux.com.br/wp-content/uploads/2023/08/perfis_drywall.png'],
  ['perfis-steel-frame.png', 'https://placlux.com.br/wp-content/uploads/2023/08/perfis_steel.png'],
  ['forro-mineral-knauf.png', 'https://placlux.com.br/wp-content/uploads/2023/08/knauf.png'],
];

await mkdir(outputDir, { recursive: true });

if (verifyOnly) {
  for (const [filename] of images) {
    const localBytes = await readFile(path.join(outputDir, filename));
    const response = await fetch(`${supabaseUrl}/storage/v1/object/public/catalog-products/placlux/${filename}`);
    if (!response.ok) throw new Error(`Leitura pública falhou (${response.status}): ${filename}`);
    const remoteBytes = Buffer.from(await response.arrayBuffer());
    const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
    if (digest(localBytes) !== digest(remoteBytes)) throw new Error(`Arquivo remoto divergente: ${filename}`);
    process.stdout.write(`${filename}: íntegra\n`);
  }
  process.stdout.write(`Verificadas: ${images.length} imagens idênticas às originais baixadas.\n`);
  process.exit(0);
}

for (const [filename, sourceUrl] of images) {
  const sourceResponse = await fetch(sourceUrl, { headers: { 'user-agent': 'Esboce catalog importer' } });
  if (!sourceResponse.ok) throw new Error(`Download falhou (${sourceResponse.status}): ${sourceUrl}`);
  const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
  if (bytes.length < 1000) throw new Error(`Imagem inválida ou pequena demais: ${filename}`);
  await writeFile(path.join(outputDir, filename), bytes);

  if (downloadOnly) {
    process.stdout.write(`${filename}: ${bytes.length} bytes\n`);
    continue;
  }

  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/catalog-products/placlux/${filename}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': sourceResponse.headers.get('content-type') || 'image/png',
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!uploadResponse.ok && uploadResponse.status !== 409) {
    throw new Error(`Upload falhou (${uploadResponse.status}) para ${filename}: ${await uploadResponse.text()}`);
  }
  process.stdout.write(`${filename}: ${bytes.length} bytes\n`);
}

process.stdout.write(`Concluído: ${images.length} imagens oficiais${downloadOnly ? ' baixadas' : ' enviadas'}.\n`);
