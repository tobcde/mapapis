import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ofertasByNecesidadKey } from '@/lib/queries/useOfertasByNecesidad';
import { necesidadesByGrupoKey } from '@/lib/queries/useNecesidadesByGrupo';

interface AdjudicarArgs {
  ofertaId: string;
  necesidadId: string;
  grupoId: string;
}

/**
 * Adjudica una oferta como ganadora.
 * Llama al RPC `adjudicar_oferta` que actualiza el estado de la oferta
 * y de la necesidad en la DB.
 */
export function useAdjudicarOferta() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, AdjudicarArgs>({
    mutationFn: async ({ ofertaId }) => {
      const { error } = await supabase.rpc('adjudicar_oferta', { p_oferta: ofertaId });
      if (error) throw error;
    },
    onSuccess: (_data, { necesidadId, grupoId }) => {
      void queryClient.invalidateQueries({ queryKey: ofertasByNecesidadKey(necesidadId) });
      void queryClient.invalidateQueries({ queryKey: necesidadesByGrupoKey(grupoId) });
    },
  });
}
