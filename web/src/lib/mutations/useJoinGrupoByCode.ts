import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { misGruposQueryKey } from '@/lib/queries/useMisGrupos';

export interface JoinGrupoResult {
  grupo_id: string;
  nombre: string;
  ya_era_miembro: boolean;
}

export function useJoinGrupoByCode() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation<JoinGrupoResult, Error, string>({
    mutationFn: async (code) => {
      const { data, error } = await supabase.rpc('join_grupo_by_code', {
        p_code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw new Error('No se pudo unir al grupo');
      return row;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: misGruposQueryKey(userId) });
    },
  });
}
