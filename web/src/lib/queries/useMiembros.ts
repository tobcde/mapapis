import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GrupoMiembroRow } from '@/lib/database.types';

export interface ProfileBrief {
  id: string;
  nombre: string | null;
  email: string;
}

export interface MiembroConProfile extends GrupoMiembroRow {
  profiles: ProfileBrief | null;
}

export const miembrosQueryKey = (grupoId: string | undefined) =>
  ['miembros', grupoId] as const;

/**
 * Devuelve los miembros de un grupo con su perfil (nombre, email).
 * La RLS garantiza que solo los miembros del grupo pueden ver la lista.
 */
export function useMiembros(grupoId: string | undefined) {
  return useQuery<MiembroConProfile[]>({
    queryKey: miembrosQueryKey(grupoId),
    enabled: Boolean(grupoId),
    queryFn: async () => {
      if (!grupoId) return [];
      const { data, error } = await supabase
        .from('grupo_miembros')
        .select('*, profiles(id, nombre, email)')
        .eq('grupo_id', grupoId);
      if (error) throw error;
      return (data ?? []) as unknown as MiembroConProfile[];
    },
  });
}
