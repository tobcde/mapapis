import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { useProfile } from '@/lib/queries/useProfile';
import { useJoinGrupoByCode } from '@/lib/mutations/useJoinGrupoByCode';
import { setPendingJoinCode, clearPendingJoinCode } from '@/lib/pendingJoin';
import { useDialog, useToast } from '@/components/ui';

/**
 * Ruta /unirse?c=CODE — punto de entrada de los links de invitación.
 *
 * - Sin sesión: guarda el código y manda al login.
 * - Con sesión pero sin rol: guarda el código y manda al onboarding
 *   (el PendingJoinHandler lo usará al terminar el onboarding).
 * - Con sesión + rol familia/admin: ejecuta el join y va al grupo.
 * - Con sesión + rol pyme: las pymes no pertenecen a grupos → /feed.
 */
export function Unirse() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const sessionLoading = useSessionStore((s) => s.loading);
  const { data: profile, isLoading: profileLoading } = useProfile();
  const join = useJoinGrupoByCode();
  const { showAlert } = useDialog();
  const { showToast } = useToast();

  const code = searchParams.get('c')?.trim().toUpperCase() ?? null;

  useEffect(() => {
    if (sessionLoading) return;
    if (!code) {
      void navigate('/login', { replace: true });
      return;
    }

    // Sin sesión: guardar código y mandar al login
    if (!session) {
      setPendingJoinCode(code);
      void navigate('/login', { replace: true });
      return;
    }

    // Con sesión pero perfil cargando: esperar
    if (profileLoading) return;

    // Con sesión pero sin rol: guardar código y mandar al onboarding
    if (!profile?.role) {
      setPendingJoinCode(code);
      void navigate('/onboarding', { replace: true });
      return;
    }

    // Pyme: no pertenece a grupos
    if (profile.role === 'pyme') {
      clearPendingJoinCode();
      void navigate('/feed', { replace: true });
      return;
    }

    // Familia/admin/institucion: ejecutar join directamente
    join.mutateAsync(code)
      .then((result) => {
        if (result.ya_era_miembro) {
          showToast(`Ya pertenecés a "${result.nombre}"`);
          void navigate(`/grupos/${result.grupo_id}`, { replace: true });
        } else {
          void navigate(`/grupos/${result.grupo_id}`, {
            replace: true,
            state: {
              bienvenida: {
                grupoNombre: result.nombre,
              },
            },
          });
        }
      })
      .catch(async (err) => {
        await showAlert(err instanceof Error ? err.message : 'No pudimos unirte al grupo');
        void navigate('/grupos', { replace: true });
      });
    // Flujo explícito por flags de carga; no añadir join/showAlert (riesgo de doble join)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, profileLoading, session, profile?.role, code]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-ink/60">
      Uniéndote al grupo…
    </div>
  );
}
