import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { useDialog } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { useMisGrupos } from '@/lib/queries/useMisGrupos';
import { useGrupo } from '@/lib/queries/useGrupo';
import { useNecesidadesByGrupo } from '@/lib/queries/useNecesidadesByGrupo';
import { useMiembros } from '@/lib/queries/useMiembros';
import { useAlumnosByGrupo } from '@/lib/queries/useAlumnosByGrupo';
import { useGrupoAdmin } from '@/lib/mutations/useGrupoAdmin';
import { fmtMoney } from '@/utils/fmt';
import { estadoBadgeClass, estadoLabel } from '@/utils/necesidad';
import type { NecesidadRow, RolEnGrupo, GrupoRow } from '@/lib/database.types';

// ─── InviteCard ───────────────────────────────────────────────────────────────

function InviteCard({
  grupo,
  soyCreador,
}: {
  grupo: GrupoRow;
  soyCreador: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { regenerarCodigo } = useGrupoAdmin();
  const { showConfirm, showAlert } = useDialog();

  const inviteUrl = `${window.location.origin}/unirse?c=${grupo.invite_code}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      await showAlert('No se pudo copiar al portapapeles');
    }
  };

  const onWhatsApp = () => {
    const msg = `Te invito a sumarte a "${grupo.nombre}" en MaPaPis. Coordinamos compras del grupo: ${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const onRegenerate = async () => {
    const ok = await showConfirm(
      '¿Generar un código nuevo? El link anterior dejará de funcionar.',
    );
    if (!ok) return;
    try {
      await regenerarCodigo.mutateAsync({ grupoId: grupo.id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al regenerar');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); }}
        className="w-full bg-ink text-white rounded-2xl px-5 py-3 flex items-center justify-between"
        style={{ boxShadow: '4px 4px 0 var(--coral)' }}
      >
        <div className="flex items-center gap-2 text-left">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-sun shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sun">
              Invitá al grupo
            </div>
            <div className="font-mono font-bold text-sm tracking-[0.18em]">
              {grupo.invite_code}
            </div>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
          Abrir ↓
        </span>
      </button>
    );
  }

  return (
    <div
      className="bg-ink text-white rounded-3xl p-5"
      style={{ boxShadow: '4px 4px 0 var(--coral)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sun mb-2 flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          Invitá al grupo
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); }}
          className="text-[10px] font-bold uppercase tracking-wider text-white/60"
        >
          Cerrar ↑
        </button>
      </div>
      <div className="font-mono font-black text-2xl tracking-[0.2em]">{grupo.invite_code}</div>
      <div className="text-[11px] text-white/60 mt-1 break-all">{inviteUrl}</div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          type="button"
          onClick={() => { void onCopy(); }}
          className="py-2.5 bg-white text-ink font-extrabold rounded-xl uppercase tracking-wider text-xs flex items-center justify-center gap-1.5"
        >
          {copied ? '✓ Copiado' : 'Copiar link'}
        </button>
        <button
          type="button"
          onClick={onWhatsApp}
          className="py-2.5 bg-sage text-white font-extrabold rounded-xl uppercase tracking-wider text-xs flex items-center justify-center gap-1.5"
        >
          WhatsApp
        </button>
      </div>
      {soyCreador && (
        <button
          type="button"
          onClick={() => { void onRegenerate(); }}
          disabled={regenerarCodigo.isPending}
          className="mt-3 text-[10px] font-bold uppercase tracking-wider text-sun flex items-center gap-1 disabled:opacity-50"
        >
          ↺ Regenerar código
        </button>
      )}
    </div>
  );
}

// ─── NecesidadRow card ────────────────────────────────────────────────────────

function NecesidadItem({ n, grupoId }: { n: NecesidadRow; grupoId: string }) {
  const presu =
    n.presupuesto_min_centavos != null && n.presupuesto_max_centavos != null
      ? `${fmtMoney(n.presupuesto_min_centavos)} – ${fmtMoney(n.presupuesto_max_centavos)}`
      : null;

  return (
    <Link
      to={`/grupos/${grupoId}/necesidades/${n.id}`}
      className="block bg-white rounded-2xl border-[1.5px] border-ink px-4 py-3 shadow-pop hover:scale-[1.01] transition-transform"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{n.titulo}</div>
          <div className="text-[11px] text-ink/60 mt-0.5">
            {n.ofertas_count}/{n.cap_ofertas} ofertas
            {presu ? ` · ${presu}` : ''}
          </div>
        </div>
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${estadoBadgeClass(n.estado)}`}
        >
          {estadoLabel(n.estado)}
        </span>
      </div>
    </Link>
  );
}

// ─── RolBadge ─────────────────────────────────────────────────────────────────

function RolBadge({ rol }: { rol: RolEnGrupo }) {
  const cfg: Record<RolEnGrupo, string> = {
    creador: 'bg-sun text-ink',
    admin: 'bg-violet text-white',
    miembro: 'bg-mist text-ink',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg[rol]}`}>
      {rol}
    </span>
  );
}

// ─── GrupoDetail ──────────────────────────────────────────────────────────────

export function GrupoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: misGrupos = [] } = useMisGrupos();
  const grupoQ = useGrupo(id);
  const necesidadesQ = useNecesidadesByGrupo(id);
  const miembrosQ = useMiembros(id);
  const alumnosQ = useAlumnosByGrupo(id);
  const { leave } = useGrupoAdmin();
  const { showConfirm, showAlert } = useDialog();

  const userId = profile?.id ?? '';

  // Mi rol en este grupo
  const miGrupo = misGrupos.find((g) => g.id === id);
  const miRol: RolEnGrupo = miGrupo?.rol_en_grupo ?? 'miembro';
  const soyAdmin = miRol === 'admin' || miRol === 'creador';
  const soyCreador = miRol === 'creador';

  const handleLeave = async () => {
    if (!id) return;
    const ok = await showConfirm(`¿Salir de "${grupoQ.data?.nombre ?? 'este grupo'}"?`);
    if (!ok) return;
    try {
      await leave.mutateAsync({ grupoId: id });
      void navigate('/grupos');
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al salir del grupo');
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (grupoQ.isLoading) {
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

  if (grupoQ.error || !grupoQ.data) {
    return (
      <Shell>
        <div className="space-y-4">
          <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
            No encontramos este grupo. {grupoQ.error?.message ?? 'Quizá no sos miembro.'}
          </div>
          <Link to="/grupos" className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink">
            ← Mis grupos
          </Link>
        </div>
      </Shell>
    );
  }

  const grupo = grupoQ.data;
  const necesidades = necesidadesQ.data ?? [];
  const miembros = miembrosQ.data ?? [];
  const alumnos = alumnosQ.data ?? [];

  const totalAlumnos = alumnos.length;
  const totalMiembros = miembros.length;

  // Alumnos del usuario en este grupo
  const misAlumnos = alumnos.filter((a) =>
    a.alumno_tutores.some((t) => t.profile_id === userId),
  );
  const yoTengoAlumnos = misAlumnos.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="space-y-5 anim-in">
        {/* Back */}
        <Link to="/grupos" className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink">
          ← Mis grupos
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-extrabold text-2xl leading-tight">{grupo.nombre}</h1>
            <p className="text-[11px] text-ink/60 mt-0.5">
              {grupo.tipo} · 📍{grupo.zona}
              {grupo.rango_familias ? ` · ${grupo.rango_familias}` : ''}
            </p>
            <p className="text-[11px] text-ink/50 mt-0.5">
              {totalAlumnos} chico{totalAlumnos !== 1 ? 's' : ''} · {totalMiembros} familia
              {totalMiembros !== 1 ? 's' : ''}
            </p>
          </div>
          <RolBadge rol={miRol} />
        </div>

        {/* Invite card */}
        <InviteCard grupo={grupo} soyCreador={soyCreador} />

        {/* Acceso rápido: Miembros y Alumnos */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to={`/grupos/${id}/miembros`}
            className="flex flex-col items-center gap-1 py-4 bg-white rounded-2xl border-[1.5px] border-ink shadow-pop hover:scale-[1.02] transition-transform"
          >
            <span className="text-2xl">👥</span>
            <span className="text-[11px] font-bold uppercase tracking-wider">Miembros</span>
            <span className="text-xs text-ink/50">{totalMiembros}</span>
          </Link>
          <Link
            to={`/grupos/${id}/alumnos`}
            className="flex flex-col items-center gap-1 py-4 bg-white rounded-2xl border-[1.5px] border-ink shadow-pop hover:scale-[1.02] transition-transform"
          >
            <span className="text-2xl">🎒</span>
            <span className="text-[11px] font-bold uppercase tracking-wider">Alumnos</span>
            <span className="text-xs text-ink/50">{totalAlumnos}</span>
          </Link>
        </div>

        {/* Banner: agregar hijo si soy familia y no tengo alumnos */}
        {!yoTengoAlumnos && profile?.role !== 'pyme' && (
          <Link
            to={`/grupos/${id}/alumnos`}
            className="block bg-coral/10 rounded-2xl border-[1.5px] border-coral px-4 py-3"
          >
            <div className="text-sm font-bold text-coral">Aún no cargaste a tu hijo/a</div>
            <div className="text-xs text-ink/60 mt-0.5">
              Agregalo en la sección Alumnos para poder votar y dividir gastos.
            </div>
          </Link>
        )}

        {/* Necesidades */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-display font-extrabold text-xl">Necesidades</h2>
            {soyAdmin && (
              <Link
                to="/publicar"
                className="text-[10px] font-bold uppercase tracking-wider text-coral flex items-center gap-1"
              >
                + Publicar
              </Link>
            )}
          </div>

          {necesidadesQ.isLoading && (
            <div className="h-16 bg-white/60 rounded-2xl border-[1.5px] border-ink/10 animate-pulse" />
          )}

          {!necesidadesQ.isLoading && necesidades.length === 0 && (
            <div className="bg-sun/30 rounded-2xl border-[1.5px] border-ink p-4 text-sm text-ink/70">
              Aún no hay necesidades publicadas en este grupo.
              {soyAdmin && (
                <Link to="/publicar" className="block mt-2 font-bold text-coral text-xs uppercase tracking-wider">
                  Publicar la primera →
                </Link>
              )}
            </div>
          )}

          {necesidades.length > 0 && (
            <div className="space-y-2">
              {necesidades.map((n) => (
                <NecesidadItem key={n.id} n={n} grupoId={grupo.id} />
              ))}
            </div>
          )}
        </section>

        {/* Acciones bottom */}
        <div className="space-y-2 pt-2">
          {!soyCreador && (
            <button
              type="button"
              onClick={() => { void handleLeave(); }}
              disabled={leave.isPending}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-50"
            >
              {leave.isPending ? '…' : 'Salir del grupo'}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
