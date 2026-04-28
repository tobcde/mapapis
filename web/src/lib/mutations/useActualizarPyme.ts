import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { pymeProfileQueryKey } from '@/lib/queries/usePymeProfile';
import type { HorariosSemana } from '@/lib/database.types';

export interface ActualizarPymeInput {
  nombre: string;
  descripcion?: string | null;
  telefono?: string | null;
  zonas?: string[] | null;
  cuit?: string | null;
  razonSocial?: string | null;
  categoriasIds?: string[] | null;
  webUrl?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  logoUrl?: string | null;
  aniosRubro?: number | null;
  cbu?: string | null;
  aliasCbu?: string | null;
  direccion?: string | null;
  localALaCalle?: boolean | null;
  haceEnvios?: boolean | null;
  horarios?: HorariosSemana | null;
}

/**
 * Actualiza el perfil comercial de la pyme del usuario logueado.
 * El RPC crea el row si aún no existe.
 */
export function useActualizarPyme() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation<void, Error, ActualizarPymeInput>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('actualizar_pyme', {
        p_nombre: input.nombre,
        p_descripcion: input.descripcion ?? null,
        p_telefono: input.telefono ?? null,
        p_zonas: Array.isArray(input.zonas) ? input.zonas : null,
        p_cuit: input.cuit ?? null,
        p_razon_social: input.razonSocial ?? null,
        p_categorias_ids: Array.isArray(input.categoriasIds) ? input.categoriasIds : null,
        p_web_url: input.webUrl ?? null,
        p_instagram: input.instagram ?? null,
        p_facebook: input.facebook ?? null,
        p_logo_url: input.logoUrl ?? null,
        p_anios_rubro: Number.isFinite(input.aniosRubro) ? (input.aniosRubro ?? null) : null,
        p_cbu: input.cbu ?? null,
        p_alias_cbu: input.aliasCbu ?? null,
        p_direccion: input.direccion ?? null,
        p_local_a_la_calle: input.localALaCalle ?? null,
        p_hace_envios: input.haceEnvios ?? null,
        p_horarios: input.horarios ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pymeProfileQueryKey(userId) });
    },
  });
}
