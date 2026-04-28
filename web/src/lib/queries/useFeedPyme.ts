import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadPublicaRow } from '@/lib/database.types';

export const feedPymeQueryKey = () => ['feed-pyme'] as const;

/**
 * Devuelve necesidades en estado `recibiendo_ofertas` desde la view
 * `necesidades_publicas`. La view anonimiza datos sensibles del grupo y
 * aplica sus propios filtros de RLS.
 */
export function useFeedPyme() {
  return useQuery<NecesidadPublicaRow[]>({
    queryKey: feedPymeQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('necesidades_publicas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
