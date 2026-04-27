import { env } from '@/lib/env';

/**
 * Helpers para el flow OAuth marketplace de Mercado Pago.
 *
 * Doc: https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation
 *
 * Flow:
 *  1. FE genera state random, lo guarda en sessionStorage, redirige a MP.
 *  2. MP autentica al usuario y muestra pantalla de consentimiento.
 *  3. MP redirige a /oauth/mp/callback?code=XXX&state=YYY.
 *  4. FE valida state, llama Edge Function `mp_oauth_callback` con `code`.
 *  5. Edge Function intercambia code por tokens y los guarda en DB.
 */

const MP_AUTH_URL = 'https://auth.mercadopago.com.ar/authorization';
const STATE_KEY = 'mapapis_mp_oauth_state';

export const MP_REDIRECT_PATH = 'oauth/mp/callback';

/** Construye la redirect_uri absoluta para el callback (incluye base path). */
export function buildMpRedirectUri(): string {
  const base = import.meta.env.BASE_URL || '/';
  // Asegurar slash final en base, sin duplicar
  const baseClean = base.endsWith('/') ? base : base + '/';
  return `${window.location.origin}${baseClean}${MP_REDIRECT_PATH}`;
}

/** Genera state random + lo guarda en sessionStorage para el round-trip. */
function generateAndStoreState(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  return state;
}

/** Lee y consume (borra) el state guardado para validar el callback. */
export function popStoredState(): string | null {
  const state = sessionStorage.getItem(STATE_KEY);
  if (state) sessionStorage.removeItem(STATE_KEY);
  return state;
}

/** Construye la URL completa para iniciar el OAuth. Redirigir el browser ahí. */
export function buildMpAuthorizeUrl(): string {
  if (!env.MP_CLIENT_ID) {
    throw new Error('VITE_MP_CLIENT_ID no configurado en el .env');
  }
  const params = new URLSearchParams({
    client_id: env.MP_CLIENT_ID,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: buildMpRedirectUri(),
    state: generateAndStoreState(),
  });
  return `${MP_AUTH_URL}?${params.toString()}`;
}
