import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadInscripcionRow } from '@/lib/database.types';

export const inscripcionesQueryKey = (necesidadId: string | undefined) =>
  ['inscripciones', necesidadId] as const;

/**
 * Devuelve las inscripciones de alumnos a una necesidad.
 * Incluye `alumno_id` e `inscripto_por` (profile que realizó la inscripción).
 */
export function useInscripciones(necesidadId: string | undefined) {
  return useQuery<NecesidadInscripcionRow[]>({
    queryKey: inscripcionesQueryKey(necesidadId),
    enabled: Boolean(necesidadId),
    queryFn: async () => {
      if (!necesidadId) return [];
      const { data, error } = await supabase
        .from('necesidad_inscripciones')
        .select('alumno_id, inscripto_por, necesidad_id, id, created_at')
        .eq('necesidad_id', necesidadId);
      if (error) throw error;
      return (data ?? []) as NecesidadInscripcionRow[];
    },
  });
}
