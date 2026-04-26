import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NecesidadRow, NecesidadInsert, NecesidadModalidad, Json } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';
import { useProfile } from '@/lib/queries/useProfile';
import { feedFamiliaQueryKey } from '@/lib/queries/useFeedFamilia';
import { necesidadesByGrupoKey } from '@/lib/queries/useNecesidadesByGrupo';

export interface PublicarNecesidadInput {
  grupoId: string;
  zona: string;
  categoriaId: string;
  titulo: string;
  descripcion: string;
  campos: Json;
  modalidad: NecesidadModalidad;
  cantidadPorAlumno?: number | null;
  presupuestoMinCentavos?: number | null;
  presupuestoMaxCentavos?: number | null;
  fechaLimiteInscripcion?: string | null;
  fechaLimiteEntrega?: string | null;
  linkReferencia?: string | null;
  capOfertas?: number;
  fotoFile?: File | null;
}

export function usePublicarNecesidad() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);
  const { data: profile } = useProfile();

  return useMutation<NecesidadRow, Error, PublicarNecesidadInput>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('No hay sesión activa');

      let fotoUrl: string | null = null;

      if (input.fotoFile) {
        const ext = input.fotoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${input.grupoId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('necesidad-fotos')
          .upload(path, input.fotoFile, { contentType: input.fotoFile.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('necesidad-fotos').getPublicUrl(path);
        fotoUrl = urlData.publicUrl;
      }

      const creadorTipo = profile?.role === 'institucion' ? 'institucion' : 'familia';

      const insert: NecesidadInsert = {
        grupo_id: input.grupoId,
        creador_id: userId,
        creador_tipo: creadorTipo,
        categoria_id: input.categoriaId,
        titulo: input.titulo,
        descripcion: input.descripcion,
        campos: input.campos,
        zona: input.zona,
        modalidad: input.modalidad,
        cantidad_por_alumno: input.cantidadPorAlumno ?? null,
        presupuesto_min_centavos: input.presupuestoMinCentavos ?? null,
        presupuesto_max_centavos: input.presupuestoMaxCentavos ?? null,
        fecha_limite_inscripcion: input.fechaLimiteInscripcion ?? null,
        fecha_limite_entrega: input.fechaLimiteEntrega ?? null,
        link_referencia: input.linkReferencia ?? null,
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
