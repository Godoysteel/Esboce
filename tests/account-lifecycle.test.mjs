import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexUrl = new URL("../index.html", import.meta.url);
const clientUrl = new URL("../src/core/SupabaseClient.ts", import.meta.url);
const appUrl = new URL("../src/app/EsboceApplication.ts", import.meta.url);
const turnstileUrl = new URL("../src/core/Turnstile.ts", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/20260810183000_account_self_deletion.sql", import.meta.url);
const profileMigrationUrl = new URL("../supabase/migrations/20260811123000_create_profile_on_signup.sql", import.meta.url);

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

test("cadastro e recuperação exigem o mesmo mínimo de oito caracteres", async () => {
  const [app, html] = await Promise.all([readFile(appUrl, "utf8"), readFile(indexUrl, "utf8")]);
  assert.match(app, /senha\.length < 8/);
  assert.match(app, /senha precisa de pelo menos 8 caracteres/);
  assert.match(app, /password\.length < 8/);
  assert.match(html, /id="authSignupSenha"[^>]*minlength="8"/);
});

test("recuperação explica quando o limite temporário de e-mails foi atingido", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /friendlyPasswordRecoveryRequestError/);
  assert.match(app, /status === 429/);
  assert.match(app, /over_email_send_rate_limit\|over_request_rate_limit/);
  assert.match(app, /Aguarde cerca de 1 hora e tente uma única vez/);
});

test("exclusão exige senha, confirmação textual e confirmação final", async () => {
  const [app, html] = await Promise.all([readFile(appUrl, "utf8"), readFile(indexUrl, "utf8")]);
  assert.match(app, /confirmation !== "EXCLUIR"/);
  assert.match(app, /await reauthenticate\(this\.currentUserEmail, password, captchaToken\)/);
  assert.match(app, /confirm\("Esta ação é permanente/);
  assert.match(html, /id="deleteAccountPassword"/);
  assert.match(html, /id="deleteAccountConfirmation"/);
});

test("Turnstile protege cadastro, login, recuperação e reautenticação", async () => {
  const [client, app, html, turnstile] = await Promise.all([
    readFile(clientUrl, "utf8"),
    readFile(appUrl, "utf8"),
    readFile(indexUrl, "utf8"),
    readFile(turnstileUrl, "utf8"),
  ]);
  assert.match(turnstile, /0x4AAAAAAEMLuO062rDllQlZ/);
  assert.match(turnstile, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(turnstile, /expired-callback/);
  assert.match(client, /signUp\(\{[\s\S]*captchaToken,[\s\S]*data: \{[\s\S]*\.\.\.profile/);
  assert.match(client, /signInWithPassword\(\{ email, password, options: \{ captchaToken \} \}\)/);
  assert.match(client, /resetPasswordForEmail\(email, \{ redirectTo: redirectTo\.toString\(\), captchaToken \}\)/);
  for (const id of ["signupCaptcha", "loginCaptcha", "recoveryCaptcha", "deleteAccountCaptcha"]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(app, new RegExp(`requireCaptchaToken\\("${id}"\\)`));
    assert.match(app, new RegExp(`resetCaptcha\\("${id}"\\)`));
  }
});

test("cadastro cria o perfil comercial no banco sem depender do primeiro login", async () => {
  const [client, sql] = await Promise.all([
    readFile(clientUrl, "utf8"),
    readFile(profileMigrationUrl, "utf8"),
  ]);

  assert.match(client, /data: \{[\s\S]*\.\.\.profile/);
  assert.match(sql, /function public\.handle_new_user_profile\(\)/i);
  assert.match(sql, /after insert on auth\.users/i);
  assert.match(sql, /insert into public\.profiles/i);
  assert.match(sql, /raw_user_meta_data\s*->>\s*'telefone'/i);
  assert.match(sql, /on conflict \(id\) do nothing/i);
  assert.match(sql, /from auth\.users as users/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to (anon|authenticated)/i);
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
