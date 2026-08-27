import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('public/produtos/placo');
const images = {
  'placa-glasroc-x-12-5mm.webp': 'https://www.placo.com.br/sites/mac3.placo.com.br/files/styles/product_gallery/public/2024-02/PLACA%20GLASROC%20X.png.webp?itok=zzwntJpZ',
  'placoplast-basecoat-20kg.webp': 'https://www.placo.com.br/sites/mac3.placo.com.br/files/styles/product_gallery/public/2024-02/PLACOPLAST%20BASECOAT.png.webp?itok=CrB7OyUK',
  'malha-grx-superficie-1x50m.webp': 'https://www.placo.com.br/sites/mac3.placo.com.br/files/styles/product_gallery/public/2023-07/malha_grx_para_superficie.jpg.webp?itok=lj8rg0dn',
  'membrana-tyvek-homewrap.webp': 'https://www.placo.com.br/sites/mac3.placo.com.br/files/styles/card_small/public/2023-07/tyvek_tyv_hw_roll_01.jpg.webp?itok=4AHtfoNi',
  'parafuso-glasroc-pb.webp': 'https://www.placo.com.br/sites/mac3.placo.com.br/files/styles/card_small/public/2024-01/PARAFUSO%20GRX%20PB.png.webp?itok=ihEgeXH9',
};

await mkdir(outputDir, { recursive: true });
for (const [filename, url] of Object.entries(images)) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`${response.status} ao baixar ${url}`);
  await writeFile(path.join(outputDir, filename), Buffer.from(await response.arrayBuffer()));
  console.log(filename);
}
