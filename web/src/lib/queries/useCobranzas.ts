import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CobranzaResumenRow, CobranzaRow } from '@/lib/types/cobranza';

export const cobranzasQueryKey = (necesidadId: string | undefined) =>
  ['cobranzas', necesidadId] as const;

export const cobranzasResumenQueryKey = (necesidadId: string | undefined) =>
  ['cobranzas-resumen', necesidadId] as const;

/**
 * Devuelve la lista detallada de cobranzas (1 fila por alumno) de una
 * necesidad. Se usa en la vista del cobrador (lista de quien transfirio /
 * por confirmar) y en la vista del pagador (su cuota especifica).
 *
 * RLS solo deja ver a miembros del grupo, asi que la query es segura aun
 * sin filtros adicionales del FE.
 */
export function useCobranzas(necesidadId: string | undefined) {
  return useQuery<CobranzaRow[]>({
    queryKey: cobranzasQueryKey(necesidadId),
    enabled: Boolean(necesidadId),
    queryFn: async () => {
      if (!necesidadId) return [];
      const client = supabase as unknown as {
        from: (table: 'cobranzas') => {
          select: (cols: string) => {
            eq: (col: string, val: string) => Promise<{
              data: CobranzaRow[] | null;
              error: Error | null;
            }>;
          };
        };
      };
      const { data, error } = await client
        .from('cobranzas')
        .select(
          'necesidad_id, alumno_id, monto_centavos, estado, comprobante_path, marcado_transferido_por, marcado_transferido_at, confirmado_por, confirmado_at, created_at, updated_at',
        )
        .eq('necesidad_id', necesidadId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Resumen agregado de la cobranza de una necesidad: cobrador asignado,
 * conteos por estado, total recolectado vs esperado. Devuelve null si la
 * necesidad todavia no tiene cobrador.
 *
 * Esta info alimenta el header del PanelCobranzas (barra de progreso +
 * datos del cobrador con alias copiable).
 */
export function useCobranzasResumen(necesidadId: string | undefined) {
  return useQuery<CobranzaResumenRow | null>({
    queryKey: cobranzasResumenQueryKey(necesidadId),
    enabled: Boolean(necesidadId),
    queryFn: async () => {
      if (!necesidadId) return null;
      const client = supabase as unknown as {
        from: (table: 'cobranzas_resumen') => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: CobranzaResumenRow | null;
                error: Error | null;
              }>;
            };
          };
        };
      };
      const { data, error } = await client
        .from('cobranzas_resumen')
        .select(
          'necesidad_id, cobrador_id, cobrador_alias_snapshot, cobrador_asignado_at, pago_pyme_completado_at, cobrador_nombre, total, confirmadas, transferidas, pendientes, total_esperado_centavos, total_recolectado_centavos',
        )
        .eq('necesidad_id', necesidadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
