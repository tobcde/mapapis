/**
 * Acceso tipado a las variables de entorno de Vite.
 * Validamos en module-eval; si falta algo crítico, fallamos rápido y claro.
 */

const required = (name: string, value: string | undefined): string => {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Copia .env.example a .env.local y completá los valores.`,
    );
  }
  return value;
};

export const env = {
  SUPABASE_URL: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  SUPABASE_ANON_KEY: required('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  MP_PUBLIC_KEY: import.meta.env.VITE_MP_PUBLIC_KEY ?? '',
  /** Client ID público de la app MaPaPis Marketplace en MP — usado para iniciar el OAuth del receptor. */
  MP_CLIENT_ID: import.meta.env.VITE_MP_CLIENT_ID ?? '',
  ENV: import.meta.env.VITE_ENV ?? 'dev',
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN ?? '',
  IS_PROD: import.meta.env.PROD,
} as const;

export type AppEnv = typeof env;
