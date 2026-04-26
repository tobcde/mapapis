import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { miembrosQueryKey } from '@/lib/queries/useMiembros';
import { misGruposQueryKey } from '@/lib/queries/useMisGrupos';

interface GrupoTargetArgs {
  grupoId: string;
  targetId: string;
}

interface GrupoArgs {
  grupoId: string;
}

/**
 * Acciones de administración de un grupo: promover, degradar, expulsar,
 * salir y regenerar código de invitación.
 */
export function useGrupoAdmin() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  const invalidarMiembros = (grupoId: string) => {
    void queryClient.invalidateQueries({ queryKey: miembrosQueryKey(grupoId) });
  };

  /** Promueve a un miembro a admin del grupo. */
  const promote = useMutation<void, Error, GrupoTargetArgs>({
    mutationFn: async ({ grupoId, targetId }) => {
      const { error } = await supabase.rpc('promote_to_admin', {
        p_grupo: grupoId,
        p_target: targetId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidarMiembros(grupoId); },
  });

  /** Degrada a un admin a miembro regular. */
  const demote = useMutation<void, Error, GrupoTargetArgs>({
    mutationFn: async ({ grupoId, targetId }) => {
      const { error } = await supabase.rpc('demote_admin', {
        p_grupo: grupoId,
        p_target: targetId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidarMiembros(grupoId); },
  });

  /** Expulsa a un miembro del grupo. */
  const kick = useMutation<void, Error, GrupoTargetArgs>({
    mutationFn: async ({ grupoId, targetId }) => {
      const { error } = await supabase.rpc('kick_miembro', {
        p_grupo: grupoId,
        p_target: targetId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidarMiembros(grupoId); },
  });

  /** El usuario actual sale del grupo. Invalida también mis grupos. */
  const leave = useMutation<void, Error, GrupoArgs>({
    mutationFn: async ({ grupoId }) => {
      const { error } = await supabase.rpc('leave_grupo', { p_grupo: grupoId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: misGruposQueryKey(userId) });
    },
  });

  /** Regenera el código de invitación del grupo y devuelve el nuevo código. */
  const regenerarCodigo = useMutation<string, Error, GrupoArgs>({
    mutationFn: async ({ grupoId }) => {
      const { data, error } = await supabase.rpc('regenerate_invite_code', { p_grupo: grupoId });
      if (error) throw error;
      const result = (data as { invite_code: string }[] | null)?.[0];
      if (!result) throw new Error('regenerate_invite_code no devolvió código');
      return result.invite_code;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: misGruposQueryKey(userId) });
    },
  });

  return { promote, demote, kick, leave, regenerarCodigo };
}
