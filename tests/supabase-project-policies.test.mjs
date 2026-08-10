import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260810121500_allow_authenticated_users_to_list_own_projects.sql",
  import.meta.url,
);

test("RLS permite que usuários autenticados listem somente os próprios projetos", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /for\s+select/i);
  assert.match(sql, /to\s+authenticated/i);
  assert.match(sql, /auth\.uid\(\)\)\s*=\s*user_id/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});
