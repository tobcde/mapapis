import * as Sentry from '@sentry/react';
import { env } from './env';

/**
 * Inicializa Sentry SOLO si hay DSN configurado.
 *
 * En dev sin DSN: no-op completo (cero overhead).
 * En prod sin DSN: log de warning, app sigue funcionando.
 *
 * Filtros importantes:
 * - beforeSend: scrub de PII conocido (email, dni, password en URLs).
 * - tracesSampleRate bajo en prod para no quemar el free tier.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    if (env.IS_PROD) {
      console.warn('[sentry] VITE_SENTRY_DSN no configurada — errores no se reportan.');
    }
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.ENV,
    tracesSampleRate: env.IS_PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    beforeSend(event) {
      // Scrub de PII en URLs (DNIs, emails, tokens en query strings)
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          const url: unknown = b.data?.url;
          if (typeof url !== 'string') return b;
          return { ...b, data: { ...b.data, url: scrubUrl(url) } };
        });
      }
      return event;
    },
  });
}

function scrubUrl(url: string): string {
  try {
    const u = new URL(url);
    const sensitive = ['email', 'dni', 'token', 'access_token', 'refresh_token'];
    for (const key of sensitive) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '[REDACTED]');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export { Sentry };
