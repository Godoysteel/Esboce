import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Derivado da localização do próprio script, não hardcoded — evita
// gravar sem querer num checkout errado (já existiram pelo menos dois
// clones esquecidos de sessões anteriores em outras pastas).
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(scriptDir, '../../src/core/Catalog.ts');
const snippetPath = process.argv[2];
const productId = process.argv[3];
const productName = process.argv[4];
const sku = process.argv[5];
const colorHex = process.argv[6];
const tileMeters = process.argv[7];
const anchor = process.argv[8]; // texto curto e unico logo apos onde inserir
const category = process.argv[9] || 'floor_tile'; // floor_tile (piso/parede) | roof_tile | trim

const textures = fs.readFileSync(snippetPath, 'utf8').replace(/\r?\n$/, '');
const src = fs.readFileSync(catalogPath, 'utf8');

const idx = src.indexOf(anchor);
if (idx === -1) {
  console.error('ANCORA NAO ENCONTRADA:', JSON.stringify(anchor));
  process.exit(1);
}

const entry = `    { id: '${productId}', name: '${productName}', manufacturer: 'vortice', category: '${category}',
      commercial: { sku: '${sku}', price: 0, unit: 'm2' },
      assets: {
        colorHex: '${colorHex}', textureUrl: null,
        tileMeters: ${tileMeters},
${textures}
      } },
`;

const out = src.slice(0, idx) + entry + src.slice(idx);
fs.writeFileSync(catalogPath, out, 'utf8');
console.log('Inserido com sucesso. Novo tamanho do arquivo:', out.length, 'chars (antes:', src.length, ')');
