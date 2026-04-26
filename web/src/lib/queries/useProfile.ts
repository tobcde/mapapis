import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

/**
 * Lee el profile del usuario logueado.
 * Devuelve `null` si todavia no hay sesion (no es error — la query queda disabled).
 *
 * El trigger `handle_new_user` deberia haber creado el row al primer login,
 * pero defendemos el caso "row faltante" devolviendo null en lugar de tirar.
 */
export function useProfile() {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery<ProfileRow | null>({
    queryKey: profileQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
