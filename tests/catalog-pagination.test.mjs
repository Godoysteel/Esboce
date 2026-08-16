import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Mesma limitação documentada em opening-catalog.test.mjs/hydraulics.test.mjs:
// o test runner nativo do Node (--experimental-strip-types) não resolve o
// redirecionamento '.js' -> '.ts' que o Vite faz em tempo de build, então
// SupabaseClient.ts é lido como texto em vez de importado.
const clientUrl = new URL("../src/core/SupabaseClient.ts", import.meta.url);

test("listCatalogProducts busca produtos em páginas, não numa única chamada sem limite", async () => {
  const client = await readFile(clientUrl, "utf8");
  // Regressão: uma única chamada sem .range() fica sujeita ao "Max Rows"
  // do projeto Supabase (1000 por padrão) — com o catálogo passando desse
  // total (ver DEC-85, carga do fornecedor "O Mercador"), produtos de
  // departamentos inteiros somem da vitrine sem nenhum erro, silenciosamente.
  assert.match(client, /CATALOG_PAGE_SIZE\s*=\s*1000/);
  assert.match(client, /async function fetchAllProductRows/);
  assert.match(client, /\.range\(from, from \+ CATALOG_PAGE_SIZE - 1\)/);
  // A função para de paginar quando a página volta menor que o tamanho
  // pedido (sinal de que era a última) — não por um total fixo assumido.
  assert.match(client, /data\.length < CATALOG_PAGE_SIZE/);
});

test("listCatalogProducts ainda resolve department_id via category_departments, agora sobre o resultado paginado", async () => {
  const client = await readFile(clientUrl, "utf8");
  assert.match(client, /export async function listCatalogProducts\(\)/);
  assert.match(
    client,
    /const \[products, \{ data: mappings, error: mappingsError \}\] = await Promise\.all\(\[\s*fetchAllProductRows\(\),\s*supabase\.from\('category_departments'\)\.select\('categoria, department_id'\),\s*\]\);/
  );
  assert.match(client, /categoryToDept\.get\(p\.categoria\)/);
});
