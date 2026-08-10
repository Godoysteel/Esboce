const TURNSTILE_SITE_KEY = "0x4AAAAAAEMLuO062rDllQlZ";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    theme: "auto";
    size: "flexible";
    language: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const widgetIds = new Map<string, string>();
const tokens = new Map<string, string>();
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => window.turnstile
      ? resolve(window.turnstile)
      : reject(new Error("O verificador de segurança não ficou disponível."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Não foi possível carregar o verificador de segurança.")), { once: true });
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export async function renderCaptcha(containerId: string): Promise<void> {
  if (widgetIds.has(containerId)) return;
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`Área de segurança ausente: ${containerId}`);
  const api = await loadTurnstile();
  if (widgetIds.has(containerId)) return;
  const clearToken = () => tokens.delete(containerId);
  const widgetId = api.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: "auto",
    size: "flexible",
    language: "pt-BR",
    callback: (token) => tokens.set(containerId, token),
    "expired-callback": clearToken,
    "error-callback": clearToken,
  });
  widgetIds.set(containerId, widgetId);
}

export function requireCaptchaToken(containerId: string): string {
  const token = tokens.get(containerId);
  if (!token) throw new Error("Conclua a verificação de segurança para continuar.");
  return token;
}

export function resetCaptcha(containerId: string): void {
  tokens.delete(containerId);
  const widgetId = widgetIds.get(containerId);
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
}
