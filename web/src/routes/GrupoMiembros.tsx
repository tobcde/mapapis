import { useParams, Link } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { useDialog } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { useMisGrupos } from '@/lib/queries/useMisGrupos';
import { useMiembros } from '@/lib/queries/useMiembros';
import { useAlumnosByGrupo } from '@/lib/queries/useAlumnosByGrupo';
import { useGrupoAdmin } from '@/lib/mutations/useGrupoAdmin';
import type { RolEnGrupo } from '@/lib/database.types';
import type { MiembroConProfile } from '@/lib/queries/useMiembros';

// ─── RolBadge ─────────────────────────────────────────────────────────────────

function RolBadge({ rol }: { rol: RolEnGrupo }) {
  const cfg: Record<RolEnGrupo, string> = {
    creador: 'bg-sun text-ink',
    admin: 'bg-violet text-white',
    miembro: 'bg-mist text-ink',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cfg[rol]}`}>
      {rol}
    </span>
  );
}

// ─── MiembroItem ──────────────────────────────────────────────────────────────

function MiembroItem({
  miembro,
  esYo,
  soyCreador,
  soyAdmin,
  grupoId,
}: {
  miembro: MiembroConProfile;
  esYo: boolean;
  soyCreador: boolean;
  soyAdmin: boolean;
  grupoId: string;
}) {
  const { promote, demote, kick } = useGrupoAdmin();
  const { showConfirm, showAlert } = useDialog();

  const { profile_id, rol_en_grupo, profiles } = miembro;
  const nombre = profiles?.nombre ?? profiles?.email?.split('@')[0] ?? '—';
  const inicial = nombre[0]?.toUpperCase() ?? '?';
  const targetEsCreador = rol_en_grupo === 'creador';
  const targetEsAdmin = rol_en_grupo === 'admin';

  const puedoPromote = soyCreador && !esYo && !targetEsCreador && !targetEsAdmin;
  const puedoDemote = soyCreador && !esYo && targetEsAdmin;
  const puedoKick = soyAdmin && !esYo && !targetEsCreador && !(targetEsAdmin && !soyCreador);

  const handlePromote = async () => {
    const ok = await showConfirm(
      `¿Promover a ${nombre} como admin? Podrá gestionar el grupo y publicar necesidades.`,
    );
    if (!ok) return;
    try {
      await promote.mutateAsync({ grupoId, targetId: profile_id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al promover');
    }
  };

  const handleDemote = async () => {
    try {
      await demote.mutateAsync({ grupoId, targetId: profile_id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al degradar');
    }
  };

  const handleKick = async () => {
    const ok = await showConfirm(`¿Eliminar a ${nombre} del grupo?`);
    if (!ok) return;
    try {
      await kick.mutateAsync({ grupoId, targetId: profile_id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al expulsar');
    }
  };

  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-ink px-4 py-3 shadow-pop">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-violet/15 flex items-center justify-center font-display font-black text-violet shrink-0">
          {inicial}
        </div>

        {/* Nombre + rol */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm truncate">{nombre}</span>
            {esYo && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink/50">(yo)</span>
            )}
            <RolBadge rol={rol_en_grupo} />
          </div>
          {profiles?.email && (
            <div className="text-[10px] text-ink/50 mt-0.5 truncate">{profiles.email}</div>
          )}
        </div>

        {/* Acciones admin */}
        <div className="flex items-center gap-1.5 shrink-0">
          {puedoPromote && (
            <button
              type="button"
              onClick={() => { void handlePromote(); }}
              disabled={promote.isPending}
              className="text-[9px] font-bold uppercase tracking-wider text-violet px-1.5 py-1 rounded-md bg-violet/10 hover:bg-violet/20 transition-colors disabled:opacity-50"
            >
              +admin
            </button>
          )}
          {puedoDemote && (
            <button
              type="button"
              onClick={() => { void handleDemote(); }}
              disabled={demote.isPending}
              className="text-[9px] font-bold uppercase tracking-wider text-ink/60 px-1.5 py-1 rounded-md bg-mist hover:bg-ink/10 transition-colors disabled:opacity-50"
            >
              −admin
            </button>
          )}
          {puedoKick && (
            <button
              type="button"
              onClick={() => { void handleKick(); }}
              disabled={kick.isPending}
              className="p-1.5 rounded-md text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
              title="Eliminar del grupo"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── GrupoMiembros ────────────────────────────────────────────────────────────

export function GrupoMiembros() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useProfile();
  const { data: misGrupos = [] } = useMisGrupos();
  const miembrosQ = useMiembros(id);
  const alumnosQ = useAlumnosByGrupo(id);

  const userId = profile?.id ?? '';
  const miGrupo = misGrupos.find((g) => g.id === id);
  const miRol = miGrupo?.rol_en_grupo ?? 'miembro';
  const soyCreador = miRol === 'creador';
  const soyAdmin = miRol === 'admin' || soyCreador;

  const miembros = miembrosQ.data ?? [];
  const alumnos = alumnosQ.data ?? [];

  // Miembros que no tienen ningún alumno registrado como tutor
  const profilesConHijo = new Set<string>();
  alumnos.forEach((a) => {
    a.alumno_tutores.forEach((t) => { profilesConHijo.add(t.profile_id); });
  });
  const sinHijo = miembros.filter((m) => !profilesConHijo.has(m.profile_id));

  if (miembrosQ.isLoading) {
    return (
      <Shell>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/60 rounded-2xl border-[1.5px] border-ink/10 animate-pulse" />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-5 anim-in">
        <Link
          to={`/grupos/${id ?? ''}`}
          className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
        >
          ← Volver al grupo
        </Link>

        <div>
          <h1 className="font-display font-extrabold text-2xl">Miembros</h1>
          <p className="text-xs text-ink/60 mt-1">
            {miembros.length} familia{miembros.length !== 1 ? 's' : ''} en el grupo
          </p>
        </div>

        {/* Lista de miembros */}
        <section className="space-y-2">
          {miembros.length === 0 ? (
            <div className="bg-mist/50 rounded-2xl p-4 text-sm text-ink/60 text-center">
              No hay miembros registrados.
            </div>
          ) : (
            miembros.map((m) => (
              <MiembroItem
                key={m.profile_id}
                miembro={m}
                esYo={m.profile_id === userId}
                soyCreador={soyCreador}
                soyAdmin={soyAdmin}
                grupoId={id ?? ''}
              />
            ))
          )}
        </section>

        {/* Familias sin hijo cargado (solo admin lo ve) */}
        {soyAdmin && sinHijo.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
              Sin hijo/a cargado
            </h2>
            {sinHijo.map((m) => {
              const nombre =
                m.profiles?.nombre ?? m.profiles?.email?.split('@')[0] ?? '—';
              return (
                <div
                  key={m.profile_id}
                  className="bg-mist rounded-xl px-3 py-2 text-xs flex items-center gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-white border border-ink/10 flex items-center justify-center font-bold text-[11px]">
                    {nombre[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{nombre}</span>
                  <span className="text-ink/50">aún no cargó</span>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </Shell>
  );
}
