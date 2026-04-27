import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';

export interface MpLinkedStatus {
  linked: boolean;
  mp_user_id: string | null;
  expires_at: string | null;
}

export const mpLinkedQueryKey = (userId: string | undefined) =>
  ['mp-linked', userId] as const;

/**
 * Trae si el usuario actual tiene su MP vinculado vía OAuth marketplace.
 * No expone el token (eso vive solo del lado del backend).
 */
export function useMpLinked() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery<MpLinkedStatus>({
    queryKey: mpLinkedQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mi_mp_linked');
      if (error) throw error;
      const row = data?.[0];
      if (!row) return { linked: false, mp_user_id: null, expires_at: null };
      return row;
    },
  });
}
