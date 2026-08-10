import * as Sentry from "@sentry/browser";

const SENTRY_DSN = "https://c6b5e100e5345f4862ca2d369a039654@o4511887414067200.ingest.de.sentry.io/4511887436349520";

function redactText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail removido]")
    .replace(/([?&](?:p|token|code|access_token|refresh_token)=)[^&#\s]+/gi, "$1[removido]");
}

function sanitizedPageUrl(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function initializeMonitoring(): void {
  const production = window.location.hostname === "esboce.com.br";
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: production,
    environment: "production",
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    integrations: (defaults) => defaults.filter((integration) => integration.name !== "Breadcrumbs"),
    beforeSend(event) {
      delete event.user;
      delete event.extra;
      delete event.contexts;
      delete event.breadcrumbs;
      if (event.message) event.message = redactText(event.message);
      for (const value of event.exception?.values ?? []) {
        if (value.value) value.value = redactText(value.value);
      }
      const cleanUrl = event.request?.url ? sanitizedPageUrl(event.request.url) : undefined;
      event.request = cleanUrl ? { url: cleanUrl } : {};
      return event;
    },
  });
}
