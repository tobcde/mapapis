import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CategoriaRow } from '@/lib/database.types';

export const categoriasQueryKey = () => ['categorias'] as const;

/**
 * Devuelve las categorías activas ordenadas para el selector del formulario.
 * Se cachea 10 minutos — las categorías cambian raramente.
 */
export function useCategorias() {
  return useQuery<CategoriaRow[]>({
    queryKey: categoriasQueryKey(),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('id, slug, nombre, campos_obligatorios, orden, activa, created_at, descripcion')
        .eq('activa', true)
        .order('orden');
      if (error) throw error;
      return data ?? [];
    },
  });
}
