import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadProgresoResult } from '@/lib/database.types';

export const necesidadProgresoKey = (necesidadId: string | undefined) =>
  ['necesidad-progreso', necesidadId] as const;

/**
 * Llama al RPC `necesidad_progreso` que devuelve contadores en tiempo real:
 * inscriptos actuales, total de alumnos del grupo y estado de cierre.
 */
export function useNecesidadProgreso(necesidadId: string | undefined) {
  return useQuery<NecesidadProgresoResult | null>({
    queryKey: necesidadProgresoKey(necesidadId),
    enabled: Boolean(necesidadId),
    queryFn: async () => {
      if (!necesidadId) return null;
      const { data, error } = await supabase.rpc('necesidad_progreso', {
        p_necesidad: necesidadId,
      });
      if (error) throw error;
      return (data as NecesidadProgresoResult[] | null)?.[0] ?? null;
    },
  });
}
