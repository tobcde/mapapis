import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GrupoRow } from '@/lib/database.types';

export const grupoQueryKey = (id: string | undefined) => ['grupo', id] as const;

export function useGrupo(id: string | undefined) {
  return useQuery<GrupoRow | null>({
    queryKey: grupoQueryKey(id),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('grupos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
