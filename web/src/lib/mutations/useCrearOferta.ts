import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ModoEntrega, OfertaVariante, RangoHorario } from '@/lib/database.types';
import { ofertasByNecesidadKey } from '@/lib/queries/useOfertasByNecesidad';

export interface CrearOfertaInput {
  necesidadId: string;
  precioCentavos: number;       // TOTAL (retiro + envio)
  tiempoDias: number | null;
  descripcion: string;
  modoEntrega?: ModoEntrega;
  precioEnvioCentavos?: number; // 0 si no incluye envio
  retiroInmediato?: boolean;    // tengo stock para retiro hoy
  variantes?: OfertaVariante[]; // hasta 10 — opcional
  // Disponibilidad — overrides (NULL = usar config de la pyme)
  localALaCalleOverride?: boolean | null;
  haceEnvioOverride?: boolean | null;
  horariosDiaEntregaOverride?: RangoHorario[] | null;
  notasDisponibilidad?: string | null;
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
        p_precio_envio_centavos: input.precioEnvioCentavos ?? 0,
        p_retiro_inmediato: input.retiroInmediato ?? false,
        p_variantes: input.variantes ?? [],
        p_local_a_la_calle_override: input.localALaCalleOverride ?? null,
        p_hace_envio_override: input.haceEnvioOverride ?? null,
        p_horarios_dia_entrega_override: input.horariosDiaEntregaOverride ?? null,
        p_notas_disponibilidad: input.notasDisponibilidad ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => {
      void queryClient.invalidateQueries({ queryKey: ofertasByNecesidadKey(necesidadId) });
    },
  });
}
