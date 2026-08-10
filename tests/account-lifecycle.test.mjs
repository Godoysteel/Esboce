import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexUrl = new URL("../index.html", import.meta.url);
const clientUrl = new URL("../src/core/SupabaseClient.ts", import.meta.url);
const appUrl = new URL("../src/app/EsboceApplication.ts", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/20260810183000_account_self_deletion.sql", import.meta.url);

test("recuperação de senha usa o fluxo nativo do Supabase e retorno controlado", async () => {
  const [client, app, html] = await Promise.all([
    readFile(clientUrl, "utf8"),
    readFile(appUrl, "utf8"),
    readFile(indexUrl, "utf8"),
  ]);
  assert.match(client, /resetPasswordForEmail\(email, \{ redirectTo:/);
  assert.match(client, /updateUser\(\{ password \}\)/);
  assert.match(client, /event !== 'PASSWORD_RECOVERY'/);
  assert.match(client, /passwordRecoveryReady = true/);
  assert.match(app, /recuperar-senha/);
  assert.match(app, /if \(!this\.passwordRecoveryReady\)/);
  assert.match(html, /id="forgotPasswordBtn"/);
  assert.match(html, /id="passwordUpdatePane"/);
  assert.match(html, /id="passwordUpdateSubmit" disabled/);
  assert.match(html, /id="showNewPasswords"/);
});

test("nova senha só pode ser enviada após validação e quando os campos coincidem", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /btn\.disabled = !this\.passwordRecoveryReady \|\| !longEnough \|\| !matches/);
  assert.match(app, /As senhas ainda não coincidem/);
  assert.match(app, /As senhas coincidem/);
  assert.match(app, /friendlyPasswordUpdateError/);
  assert.match(app, /nova senha precisa ser diferente/i);
});

test("exclusão exige senha, confirmação textual e confirmação final", async () => {
  const [app, html] = await Promise.all([readFile(appUrl, "utf8"), readFile(indexUrl, "utf8")]);
  assert.match(app, /confirmation !== "EXCLUIR"/);
  assert.match(app, /await reauthenticate\(this\.currentUserEmail, password\)/);
  assert.match(app, /confirm\("Esta ação é permanente/);
  assert.match(html, /id="deleteAccountPassword"/);
  assert.match(html, /id="deleteAccountConfirmation"/);
});

test("RPC de exclusão deriva o alvo somente de auth.uid e não aceita id externo", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /function public\.delete_my_account\(\)/i);
  assert.match(sql, /target_user_id uuid := auth\.uid\(\)/i);
  assert.doesNotMatch(sql, /delete_my_account\s*\([^)]*uuid/i);
  assert.match(sql, /delete from public\.projects where user_id = target_user_id/i);
  assert.match(sql, /delete from public\.profiles where id = target_user_id/i);
  assert.match(sql, /delete from public\.legal_acceptances where user_id = target_user_id/i);
  assert.match(sql, /delete from auth\.users where id = target_user_id/i);
  assert.match(sql, /revoke all[\s\S]*from anon/i);
  assert.match(sql, /grant execute[\s\S]*to authenticated/i);
});
