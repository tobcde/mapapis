import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PymeRow } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';

export const pymeProfileQueryKey = (userId: string | undefined) =>
  ['pyme-profile', userId] as const;

/**
 * Devuelve el perfil pyme del usuario logueado, o `null` si aún no lo tiene.
 * Solo se activa cuando hay sesión activa.
 */
export function usePymeProfile() {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery<PymeRow | null>({
    queryKey: pymeProfileQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('pymes')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
