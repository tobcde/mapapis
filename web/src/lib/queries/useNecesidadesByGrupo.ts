import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadRow } from '@/lib/database.types';

export const necesidadesByGrupoKey = (grupoId: string | undefined) =>
  ['necesidades-by-grupo', grupoId] as const;

export function useNecesidadesByGrupo(grupoId: string | undefined) {
  return useQuery<NecesidadRow[]>({
    queryKey: necesidadesByGrupoKey(grupoId),
    enabled: Boolean(grupoId),
    queryFn: async () => {
      if (!grupoId) return [];
      const { data, error } = await supabase
        .from('necesidades')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
