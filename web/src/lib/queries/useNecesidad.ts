import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadRow } from '@/lib/database.types';

export const necesidadQueryKey = (id: string | undefined) =>
  ['necesidad', id] as const;

export function useNecesidad(id: string | undefined) {
  return useQuery<NecesidadRow | null>({
    queryKey: necesidadQueryKey(id),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('necesidades')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
