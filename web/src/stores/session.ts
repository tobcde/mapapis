import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface SessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Store de sesión global.
 *
 * `init()` se llama una vez en main.tsx — se suscribe a onAuthStateChange
 * y mantiene la sesión actualizada sin que cada componente la pida.
 */
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },

  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false });

    // La suscripción se mantiene viva durante toda la app (se crea una sola vez en main.tsx).
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
