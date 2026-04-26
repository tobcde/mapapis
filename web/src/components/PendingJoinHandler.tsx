import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/lib/queries/useProfile';
import { useJoinGrupoByCode } from '@/lib/mutations/useJoinGrupoByCode';
import { getPendingJoinCode, clearPendingJoinCode } from '@/lib/pendingJoin';
import { useDialog } from '@/components/ui';

/**
 * Componente invisible que se monta dentro del Shell (rutas protegidas).
 *
 * Cuando el usuario termina de loguearse (magic link o Google OAuth) y
 * llega a una ruta con perfil completo, verifica si quedó un código de
 * invitación pendiente en localStorage y ejecuta el join automáticamente.
 *
 * Monta `null`; no renderiza nada visible.
 */
export function PendingJoinHandler() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const join = useJoinGrupoByCode();
  const { showAlert } = useDialog();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (!profile?.role) return;

    const code = getPendingJoinCode();
    if (!code) return;

    // Marcar como intentado para no reejecutar en re-renders
    attemptedRef.current = true;
    clearPendingJoinCode();

    // Pymes no pertenecen a grupos
    if (profile.role === 'pyme') return;

    join.mutateAsync(code)
      .then((result) => {
        if (!result.ya_era_miembro) {
          void navigate(`/grupos/${result.grupo_id}`, { replace: true });
        }
      })
      .catch(async (err) => {
        await showAlert(err instanceof Error ? err.message : 'No pudimos unirte al grupo con el código guardado');
      });
  }, [profile?.id, profile?.role]);

  return null;
}
