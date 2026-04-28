import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { inscripcionesQueryKey } from '@/lib/queries/useInscripciones';
import { necesidadProgresoKey } from '@/lib/queries/useNecesidadProgreso';

interface InscribirArgs {
  necesidadId: string;
  alumnoId: string;
}

/**
 * Inscribe o desinscribe a un alumno de una necesidad.
 * Invalida inscripciones y progreso al completar.
 */
export function useInscribirAlumno() {
  const queryClient = useQueryClient();

  const invalidar = (necesidadId: string) => {
    void queryClient.invalidateQueries({ queryKey: inscripcionesQueryKey(necesidadId) });
    void queryClient.invalidateQueries({ queryKey: necesidadProgresoKey(necesidadId) });
  };

  const inscribir = useMutation<void, Error, InscribirArgs>({
    mutationFn: async ({ necesidadId, alumnoId }) => {
      const { error } = await supabase.rpc('inscribir_alumno', {
        p_necesidad: necesidadId,
        p_alumno: alumnoId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => { invalidar(necesidadId); },
  });

  const desinscribir = useMutation<void, Error, InscribirArgs>({
    mutationFn: async ({ necesidadId, alumnoId }) => {
      const { error } = await supabase.rpc('desinscribir_alumno', {
        p_necesidad: necesidadId,
        p_alumno: alumnoId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => { invalidar(necesidadId); },
  });

  return { inscribir, desinscribir };
}
