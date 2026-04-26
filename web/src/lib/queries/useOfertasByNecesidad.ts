import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { OfertaRow } from '@/lib/database.types';

export const ofertasByNecesidadKey = (necesidadId: string | undefined) =>
  ['ofertas-by-necesidad', necesidadId] as const;

export function useOfertasByNecesidad(necesidadId: string | undefined) {
  return useQuery<OfertaRow[]>({
    queryKey: ofertasByNecesidadKey(necesidadId),
    enabled: Boolean(necesidadId),
    queryFn: async () => {
      if (!necesidadId) return [];
      const { data, error } = await supabase
        .from('ofertas')
        .select('*')
        .eq('necesidad_id', necesidadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
