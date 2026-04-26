import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, ProfileUpdate } from '@/lib/database.types';
import { useSessionStore } from '@/stores/session';
import { profileQueryKey } from '@/lib/queries/useProfile';

type UpdatableFields = Pick<ProfileUpdate, 'nombre' | 'role' | 'telefono'>;

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation<ProfileRow, Error, UpdatableFields>({
    mutationFn: async (patch) => {
      if (!userId) throw new Error('No hay sesion');
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ProfileRow>(profileQueryKey(userId), data);
    },
  });
}
