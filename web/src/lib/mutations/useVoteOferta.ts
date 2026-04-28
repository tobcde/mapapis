import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { misVotosQueryKey } from '@/lib/queries/useMisVotos';

interface VoteArgs {
  alumnoId: string;
  ofertaId: string;
  necesidadId: string;
}

/**
 * Registra o retira el voto de un alumno para una oferta.
 * Ambas operaciones invalidan el cache de `useMisVotos`.
 */
export function useVoteOferta() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  const vote = useMutation<void, Error, VoteArgs>({
    mutationFn: async ({ alumnoId, ofertaId }) => {
      const { error } = await supabase.rpc('vote_oferta', {
        p_alumno: alumnoId,
        p_oferta: ofertaId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => {
      void queryClient.invalidateQueries({
        queryKey: misVotosQueryKey(necesidadId, userId),
      });
    },
  });

  const unvote = useMutation<void, Error, VoteArgs>({
    mutationFn: async ({ alumnoId, ofertaId }) => {
      const { error } = await supabase.rpc('unvote_oferta', {
        p_alumno: alumnoId,
        p_oferta: ofertaId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId }) => {
      void queryClient.invalidateQueries({
        queryKey: misVotosQueryKey(necesidadId, userId),
      });
    },
  });

  return { vote, unvote };
}
