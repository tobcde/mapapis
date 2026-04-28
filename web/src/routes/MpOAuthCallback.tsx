import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/Shell';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { buildMpRedirectUri, popStoredState } from '@/lib/mp/oauth';
import { mpLinkedQueryKey } from '@/lib/queries/useMpLinked';

type Phase = 'verifying' | 'exchanging' | 'success' | 'error';

/**
 * Pantalla a la que MP redirige después del OAuth marketplace.
 * Recibe `?code=XXX&state=YYY`, valida el state contra el guardado en
 * sessionStorage, llama a la Edge Function `mp_oauth_callback` y muestra
 * resultado. Después navega de vuelta a /perfil.
 */
export function MpOAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const sessionLoading = useSessionStore((s) => s.loading);
  const userId = useSessionStore((s) => s.user?.id);
  const [phase, setPhase] = useState<Phase>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Este effect es un handler de un solo disparo (OAuth callback); el patron
    // de setState sincrono dentro del body es intencional aqui.
    if (sessionLoading) return;
    if (!session) return; // el guard externo se encarga de mandar a login
    if (phase !== 'verifying') return;

    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');
    const errorDesc = params.get('error_description');

    if (errorParam) {
      setErrorMsg(`Mercado Pago rechazó la vinculación: ${errorDesc ?? errorParam}`);
      setPhase('error');
      return;
    }

    const storedState = popStoredState();

    if (!code) {
      setErrorMsg('No vino el code de Mercado Pago.');
      setPhase('error');
      return;
    }

    if (!state || state !== storedState) {
      setErrorMsg('State inválido. Intentá vincular de nuevo desde tu perfil.');
      setPhase('error');
      return;
    }

    setPhase('exchanging');
    /* eslint-enable react-hooks/set-state-in-effect */

    void (async () => {
      try {
        // functions-js types `error` as `any` in FunctionsResponseFailure;
        // avoid destructuring it to prevent no-unsafe-assignment/member-access.
        const invokeResp = await supabase.functions.invoke<{
          ok?: boolean;
          error?: string;
        }>('mp_oauth_callback', {
          body: { code, redirect_uri: buildMpRedirectUri() },
        });
        const { data } = invokeResp;
        const fnError = invokeResp.error instanceof Error ? invokeResp.error : null;
        if (fnError || !data?.ok) {
          throw new Error(fnError?.message ?? data?.error ?? 'Error desconocido');
        }
        setPhase('success');
        void queryClient.invalidateQueries({ queryKey: mpLinkedQueryKey(userId) });
        // Pequeña pausa visual antes de redirigir
        setTimeout(() => { void navigate('/perfil', { replace: true }); }, 1200);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Error al guardar la vinculación');
        setPhase('error');
      }
    })();
  }, [
    params,
    sessionLoading,
    session,
    phase,
    queryClient,
    userId,
    navigate,
  ]);

  if (sessionLoading) {
    return (
      <Shell>
        <div className="text-sm text-ink/60">Verificando sesión…</div>
      </Shell>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Shell>
      <div className="grid gap-4 max-w-md mx-auto">
        <h1 className="font-display font-extrabold text-2xl">Vinculando Mercado Pago</h1>

        {(phase === 'verifying' || phase === 'exchanging') && (
          <div
            className="bg-white rounded-2xl border-[1.5px] border-ink p-4"
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            <div className="flex items-center gap-2 text-sm text-ink/70">
              <span className="inline-block w-3 h-3 border-2 border-ink/40 border-t-ink rounded-full animate-spin" />
              {phase === 'verifying' ? 'Verificando datos…' : 'Guardando tu vinculación…'}
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div className="bg-sage/15 border-[1.5px] border-sage rounded-2xl p-4 text-sm">
            ✓ Listo. Tu cuenta de Mercado Pago quedó vinculada. Te llevamos a tu perfil…
          </div>
        )}

        {phase === 'error' && errorMsg && (
          <>
            <div className="bg-coral/10 text-coral text-sm rounded-2xl border-[1.5px] border-coral px-4 py-3">
              {errorMsg}
            </div>
            <button
              type="button"
              onClick={() => { void navigate('/perfil', { replace: true }); }}
              className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs"
            >
              Volver a mi perfil
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}
