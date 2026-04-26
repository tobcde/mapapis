import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ModoEntrega } from '@/lib/database.types';
import { ofertasByNecesidadKey } from '@/lib/queries/useOfertasByNecesidad';

export interface CrearOfertaInput {
  necesidadId: string;
  precioCentavos: number;
  tiempoDias: number | null;
  descripcion: string;
  modoEntrega?: ModoEntrega;
}

/**
 * Presenta una oferta para una necesidad.
 * Solo disponible para usuarios con rol `pyme`.
 */
export function useCrearOferta() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CrearOfertaInput>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('crear_oferta', {
        p_necesidad: input.necesidadId,
        p_precio_centavos: input.precioCentavos,
        p_tiempo_dias: input.tiempoDias,
        p_descripcion: input.descripcion,
        p_modo_entrega: input.modoEntrega ?? 'retiro',
      });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => {
      void queryClient.invalidateQueries({ queryKey: ofertasByNecesidadKey(necesidadId) });
    },
  });
}
