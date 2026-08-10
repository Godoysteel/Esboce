import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CURRENT_LEGAL_ACCEPTANCE, PRIVACY_VERSION, TERMS_VERSION } from "../src/core/LegalAcceptance.ts";

const termsUrl = new URL("../public/termos.html", import.meta.url);
const privacyUrl = new URL("../public/privacidade.html", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/20260810170000_create_legal_acceptances.sql", import.meta.url);

test("versões jurídicas atuais são explícitas e consistentes", () => {
  assert.equal(CURRENT_LEGAL_ACCEPTANCE.termsVersion, TERMS_VERSION);
  assert.equal(CURRENT_LEGAL_ACCEPTANCE.privacyVersion, PRIVACY_VERSION);
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(PRIVACY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("cadastro exige confirmações separadas e não inclui marketing", async () => {
  const html = await readFile(indexUrl, "utf8");
  assert.match(html, /id="authAgeConfirmed"/);
  assert.match(html, /id="authTermsAccepted"/);
  assert.match(html, /id="authPrivacyAcknowledged"/);
  assert.doesNotMatch(html, /id="authMarketingConsent"/);
});

test("termos e privacidade ficam públicos e identificam operador e canal", async () => {
  const [terms, privacy] = await Promise.all([readFile(termsUrl, "utf8"), readFile(privacyUrl, "utf8")]);
  for (const document of [terms, privacy]) {
    assert.match(document, /Rogério dos Santos Godoy/);
    assert.match(document, /privacidade@esboce\.com\.br/);
    assert.match(document, /18 anos/);
    assert.match(document, /2026-08-10/);
  }
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /GitHub Pages/);
  assert.match(privacy, /direitos/i);
});

test("RLS dos aceites permite somente leitura e inserção pelo próprio usuário", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select[\s\S]*using \(auth\.uid\(\) = user_id\)/i);
  assert.match(sql, /for insert[\s\S]*with check \(auth\.uid\(\) = user_id\)/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  assert.match(sql, /revoke all[\s\S]*from anon/i);
});
