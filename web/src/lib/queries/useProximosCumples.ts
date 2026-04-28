import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProximoCumple } from '@/lib/database.types';

export const proximosCumplesByGrupoKey = (grupoId: string | undefined) =>
  ['proximos-cumples', grupoId] as const;

/**
 * Trae los próximos cumpleaños del grupo dentro de la ventana
 * "mes en curso + primeros 10 días del mes siguiente".
 * La vista `proximos_cumples` ya filtra por ventana en SQL.
 */
export function useProximosCumples(grupoId: string | undefined) {
  return useQuery<ProximoCumple[]>({
    queryKey: proximosCumplesByGrupoKey(grupoId),
    enabled: Boolean(grupoId),
    queryFn: async () => {
      if (!grupoId) return [];
      const { data, error } = await supabase
        .from('proximos_cumples')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('proximo_cumple', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
