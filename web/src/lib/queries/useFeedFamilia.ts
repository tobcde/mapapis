import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadRow } from '@/lib/database.types';

/** Necesidad enriquecida con joins necesarios para las cards del feed. */
export interface NecesidadFeed extends NecesidadRow {
  categorias: { nombre: string; slug: string } | null;
  grupos: { nombre: string; rango_familias: string | null } | null;
  necesidad_inscripciones: [{ count: number }] | [];
}

export const feedFamiliaQueryKey = () => ['feed-familia'] as const;

/**
 * Devuelve todas las necesidades visibles para el usuario (familia/admin)
 * con datos de categoría, grupo y contador de inscripciones.
 *
 * La RLS de Supabase ya filtra por grupos del usuario — no es necesario
 * filtrarlo acá en el cliente.
 */
export function useFeedFamilia() {
  return useQuery<NecesidadFeed[]>({
    queryKey: feedFamiliaQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('necesidades')
        .select(
          '*, categorias(nombre, slug), grupos(nombre, rango_familias), necesidad_inscripciones(count)',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NecesidadFeed[];
    },
  });
}
