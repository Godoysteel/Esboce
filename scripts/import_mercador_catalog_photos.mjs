import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MERCADOR_PUBLIC = 'C:/Users/godoy/O_Mercador/public';
const MERCADOR_PRODUCTS = join(MERCADOR_PUBLIC, 'produtos');
const ESBOCE_PUBLIC = new URL('../public/', import.meta.url);
const MIGRATION = new URL('../supabase/migrations/20260823003000_import_mercador_catalog_photos.sql', import.meta.url);
const MANIFEST = new URL('../public/catalogo/produtos/mercador-images.json', import.meta.url);
const SUPABASE_URL = 'https://dugcwndtflcjajffxjko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32BTfCDesA9WyH9Ltm0-zw_MKttNAfO';

const bySku = new Map();
for (const manufacturer of readdirSync(MERCADOR_PRODUCTS)) {
  const productsFile = join(MERCADOR_PRODUCTS, manufacturer, 'products.json');
  if (!existsSync(productsFile)) continue;
  for (const product of JSON.parse(readFileSync(productsFile, 'utf8'))) {
    if (!product.sku || !product.imageFile) continue;
    const sku = String(product.sku).padStart(6, '0');
    const sourceFile = join(MERCADOR_PUBLIC, product.imageFile);
    if (!existsSync(sourceFile)) continue;
    bySku.set(sku, {
      sku,
      manufacturer,
      manufacturerName: manufacturer === 'rcm' ? 'RCM' : manufacturer[0].toUpperCase() + manufacturer.slice(1),
      catalogName: product.name ?? product.title ?? null,
      imageFile: product.imageFile.replaceAll('\\', '/'),
      source: product.source ?? null,
      sourceFile,
    });
  }
}

const catalog = [];
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=sku,nome,categoria,foto_url&order=sku&offset=${offset}&limit=1000`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!response.ok) throw new Error(await response.text());
  const batch = await response.json();
  catalog.push(...batch);
  if (batch.length < 1000) break;
}

const matches = catalog
  .filter((product) => !product.foto_url && bySku.has(String(product.sku).padStart(6, '0')))
  .map((product) => ({ ...bySku.get(String(product.sku).padStart(6, '0')), esboceName: product.nome, category: product.categoria }))
  .sort((a, b) => a.sku.localeCompare(b.sku));

for (const item of matches) {
  const destination = new URL(`.${item.imageFile}`, ESBOCE_PUBLIC);
  mkdirSync(dirname(fileURLToPath(destination)), { recursive: true });
  if (!existsSync(destination)) copyFileSync(item.sourceFile, destination);
}

mkdirSync(dirname(fileURLToPath(MANIFEST)), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(matches.map(({ sourceFile, ...item }) => item), null, 2)}\n`);

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const manufacturers = [...new Set(matches.map((item) => item.manufacturerName))].sort();
const values = matches.map((item) => `  (${quote(item.sku)}, ${quote(item.manufacturerName)}, ${quote(item.imageFile)})`).join(',\n');
const sql = `-- Importa fotos comerciais já rastreadas no catálogo do O Mercador.\n-- Os produtos continuam sem representação visual no editor; esta migration\n-- altera somente foto e fabricante. Ofertas e projetos existentes são preservados.\n\ninsert into public.manufacturers (id, nome, logo_url, is_demo)\nselect gen_random_uuid(), source.nome, null, false\nfrom (values ${manufacturers.map((name) => `(${quote(name)})`).join(', ')}) as source(nome)\nwhere not exists (\n  select 1 from public.manufacturers where lower(manufacturers.nome) = lower(source.nome)\n);\n\nwith imported(sku, manufacturer_name, foto_url) as (\nvalues\n${values}\n)\nupdate public.products as product\nset foto_url = imported.foto_url,\n    manufacturer_id = manufacturer.id\nfrom imported\njoin public.manufacturers as manufacturer\n  on lower(manufacturer.nome) = lower(imported.manufacturer_name)\nwhere product.sku = imported.sku\n  and product.foto_url is null;\n`;
writeFileSync(MIGRATION, sql);

console.log(JSON.stringify({ matchedSkus: matches.length, uniqueImages: new Set(matches.map((item) => item.imageFile)).size, manufacturers }, null, 2));
