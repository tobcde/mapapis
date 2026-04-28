import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { necesidadProgresoKey } from '@/lib/queries/useNecesidadProgreso';
import { inscripcionesQueryKey } from '@/lib/queries/useInscripciones';

interface InscripcionArgs {
  necesidadId: string;
}

/**
 * Cierra o reabre las inscripciones de una necesidad.
 * Solo admins y creadores del grupo pueden ejecutar estas acciones.
 */
export function useCerrarInscripcion() {
  const queryClient = useQueryClient();

  const invalidar = (necesidadId: string) => {
    void queryClient.invalidateQueries({ queryKey: necesidadProgresoKey(necesidadId) });
    void queryClient.invalidateQueries({ queryKey: inscripcionesQueryKey(necesidadId) });
  };

  const cerrar = useMutation<void, Error, InscripcionArgs>({
    mutationFn: async ({ necesidadId }) => {
      const { error } = await supabase.rpc('cerrar_inscripcion', { p_necesidad: necesidadId });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => { invalidar(necesidadId); },
  });

  const reabrir = useMutation<void, Error, InscripcionArgs>({
    mutationFn: async ({ necesidadId }) => {
      const { error } = await supabase.rpc('reabrir_inscripcion', { p_necesidad: necesidadId });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => { invalidar(necesidadId); },
  });

  return { cerrar, reabrir };
}
