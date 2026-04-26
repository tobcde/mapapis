import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import type { Database } from './database.types';

/**
 * Cliente único de Supabase para toda la app.
 *
 * - Storage key custom para no pisar la sesión de la app vieja
 *   (`tobcde.github.io/mapapis/`) cuando vivan en el mismo origin.
 * - `autoRefreshToken: true` + `persistSession: true` mantienen al usuario
 *   logueado entre tabs/recargas. TanStack Query se encarga del resto
 *   (refetch on focus rompe deadlocks).
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      storageKey: 'mapapis-next.auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-mapapis-app': 'web-vite',
      },
    },
  },
);
