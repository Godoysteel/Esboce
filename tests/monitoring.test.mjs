import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const monitoringUrl = new URL("../src/core/Monitoring.ts", import.meta.url);
const mainUrl = new URL("../src/main.ts", import.meta.url);

test("monitoramento roda somente no domínio oficial e sem telemetria invasiva", async () => {
  const [monitoring, main] = await Promise.all([
    readFile(monitoringUrl, "utf8"),
    readFile(mainUrl, "utf8"),
  ]);
  assert.match(main, /initializeMonitoring\(\);[\s\S]*Bootstrap\.start\(\)/);
  assert.match(monitoring, /hostname === "esboce\.com\.br"/);
  assert.match(monitoring, /sendDefaultPii: false/);
  assert.match(monitoring, /maxBreadcrumbs: 0/);
  assert.match(monitoring, /tracesSampleRate: 0/);
  assert.doesNotMatch(monitoring, /replayIntegration|browserTracingIntegration/);
});

test("eventos removem identidade, conteúdo adicional e parâmetros sensíveis", async () => {
  const monitoring = await readFile(monitoringUrl, "utf8");
  assert.match(monitoring, /delete event\.user/);
  assert.match(monitoring, /delete event\.extra/);
  assert.match(monitoring, /delete event\.contexts/);
  assert.match(monitoring, /\[e-mail removido\]/);
  assert.match(monitoring, /url\.origin.*url\.pathname/);
});
