import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadRow, NecesidadInsert, Json } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';
import { feedFamiliaQueryKey } from '@/lib/queries/useFeedFamilia';
import { necesidadesByGrupoKey } from '@/lib/queries/useNecesidadesByGrupo';

export interface PublicarNecesidadInput {
  grupoId: string;
  categoriaId: string;
  titulo: string;
  descripcion: string;
  campos: Json;
  zona: string;
  presupuestoMinCentavos?: number | null;
  presupuestoMaxCentavos?: number | null;
  fechaLimite?: string | null;
  capOfertas?: number;
  /** Si se provee, se sube a storage y se guarda la URL en foto_url. */
  fotoFile?: File | null;
}

export function usePublicarNecesidad() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation<NecesidadRow, Error, PublicarNecesidadInput>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('No hay sesión activa');

      let fotoUrl: string | null = null;

      if (input.fotoFile) {
        const ext = input.fotoFile.name.split('.').pop() ?? 'jpg';
        const path = `necesidades/${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('fotos')
          .upload(path, input.fotoFile, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(path);
        fotoUrl = urlData.publicUrl;
      }

      const insert: NecesidadInsert = {
        grupo_id: input.grupoId,
        creador_id: userId,
        creador_tipo: 'familia',
        categoria_id: input.categoriaId,
        titulo: input.titulo,
        descripcion: input.descripcion,
        campos: input.campos,
        zona: input.zona,
        presupuesto_min_centavos: input.presupuestoMinCentavos ?? null,
        presupuesto_max_centavos: input.presupuestoMaxCentavos ?? null,
        fecha_limite: input.fechaLimite ?? null,
        cap_ofertas: input.capOfertas ?? 3,
        foto_url: fotoUrl,
      };

      const { data, error } = await supabase
        .from('necesidades')
        .insert(insert)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: feedFamiliaQueryKey() });
      void queryClient.invalidateQueries({ queryKey: necesidadesByGrupoKey(data.grupo_id) });
    },
  });
}
