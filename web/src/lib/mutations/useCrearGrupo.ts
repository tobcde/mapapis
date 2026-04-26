import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GrupoRow, GrupoTipo } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';
import { misGruposQueryKey } from '@/lib/queries/useMisGrupos';

export interface CrearGrupoInput {
  nombre: string;
  zona: string;
  tipo: GrupoTipo;
  rango_familias?: string;
  institucion_nombre?: string;
  institucion_direccion?: string;
}

export function useCrearGrupo() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation<GrupoRow, Error, CrearGrupoInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.rpc('crear_grupo', {
        p_nombre: input.nombre,
        p_zona: input.zona,
        p_tipo: input.tipo,
        p_rango: input.rango_familias ?? '',
        p_inst_nombre: input.institucion_nombre ?? '',
        p_inst_direccion: input.institucion_direccion ?? '',
      });
      if (error) throw error;
      const grupo = data?.[0];
      if (!grupo) throw new Error('crear_grupo no devolvio fila');
      return grupo;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: misGruposQueryKey(userId) });
    },
  });
}
