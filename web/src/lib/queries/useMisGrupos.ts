import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GrupoRow, RolEnGrupo } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';

export interface MiGrupo extends GrupoRow {
  rol_en_grupo: RolEnGrupo;
}

export const misGruposQueryKey = (userId: string | undefined) =>
  ['mis-grupos', userId] as const;

/**
 * Devuelve los grupos del usuario con su rol dentro de cada uno.
 * Usamos el join inverso desde grupo_miembros porque la RLS deja ver miembros
 * solo si sos miembro del grupo, asi que el resultado ya queda filtrado.
 */
export function useMisGrupos() {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery<MiGrupo[]>({
    queryKey: misGruposQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('grupo_miembros')
        .select('rol_en_grupo, grupo:grupos(*)')
        .eq('profile_id', userId);
      if (error) throw error;
      interface Joined { rol_en_grupo: RolEnGrupo; grupo: GrupoRow | null }
      return (data as unknown as Joined[])
        .filter((row): row is Joined & { grupo: GrupoRow } => row.grupo !== null)
        .map((row) => ({ ...row.grupo, rol_en_grupo: row.rol_en_grupo }));
    },
  });
}
