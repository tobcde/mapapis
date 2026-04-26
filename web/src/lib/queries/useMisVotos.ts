import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';

/** Mapa de alumnoId → ofertaId por la que votó ese alumno. */
export type MisVotosMap = Record<string, string>;

export const misVotosQueryKey = (
  necesidadId: string | undefined,
  userId: string | undefined,
) => ['mis-votos', necesidadId, userId] as const;

/**
 * Devuelve los votos emitidos por el usuario actual para los alumnos de
 * una necesidad específica.
 *
 * @param necesidadId - Necesidad a consultar.
 * @param alumnoIds   - IDs de los alumnos del usuario en esa necesidad.
 * @param ofertaIds   - IDs de las ofertas de la necesidad (para acotarel scope).
 */
export function useMisVotos(
  necesidadId: string | undefined,
  alumnoIds: string[],
  ofertaIds: string[],
) {
  const userId = useSessionStore((s) => s.user?.id);
  const enabled = Boolean(necesidadId) && alumnoIds.length > 0 && ofertaIds.length > 0;

  return useQuery<MisVotosMap>({
    queryKey: misVotosQueryKey(necesidadId, userId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votos_oferta')
        .select('oferta_id, alumno_id')
        .in('oferta_id', ofertaIds)
        .in('alumno_id', alumnoIds)
        .eq('votante_id', userId ?? '');
      if (error) throw error;
      const map: MisVotosMap = {};
      (data ?? []).forEach((v) => {
        map[v.alumno_id] = v.oferta_id;
      });
      return map;
    },
  });
}
