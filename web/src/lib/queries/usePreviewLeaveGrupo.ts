import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface AlumnoLeavePreview {
  alumno_id: string;
  alumno_nombre: string;
  otros_tutores_count: number;
  se_elimina: boolean;
  otros_tutores_nombres: string[];
}

/**
 * Pide al backend qué pasaría con cada uno de mis alumnos si saliera del
 * grupo. No ejecuta nada, solo informa para que el frontend arme un
 * confirm contextual antes de llamar a `leave_grupo`.
 *
 * El cast a unknown intermedio es porque `preview_leave_grupo` se agregó
 * en la migración 040 y `database.types.ts` aún no fue regenerado
 * (`npm run types:gen`). Una vez regenerado, el cast deja de ser necesario.
 */
export function usePreviewLeaveGrupo() {
  return useMutation<AlumnoLeavePreview[], Error, string>({
    mutationFn: async (grupoId) => {
      const client = supabase as unknown as {
        rpc: (
          name: 'preview_leave_grupo',
          args: { p_grupo: string },
        ) => Promise<{ data: AlumnoLeavePreview[] | null; error: Error | null }>;
      };
      const { data, error } = await client.rpc('preview_leave_grupo', {
        p_grupo: grupoId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
