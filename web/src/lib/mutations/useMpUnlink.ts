import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { mpLinkedQueryKey } from '@/lib/queries/useMpLinked';

/**
 * Desvincula la cuenta MP del usuario actual. Borra el access_token guardado.
 * Volver a vincular requiere pasar de nuevo por el OAuth de MP.
 */
export function useMpUnlink() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mi_mp_unlink');
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mpLinkedQueryKey(userId) });
    },
  });
}
