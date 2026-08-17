import fs from 'fs';

const catalogPath = 'C:/Users/godoy/Desktop/esboce-drag/src/core/Catalog.ts';
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
