import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui';
import { useDialog } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { useMisGrupos } from '@/lib/queries/useMisGrupos';
import { useAlumnosByGrupo } from '@/lib/queries/useAlumnosByGrupo';
import { useAlumnoActions } from '@/lib/mutations/useAlumnoActions';
import type { AlumnoConTutores } from '@/lib/queries/useAlumnosByGrupo';

const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border-[1.5px] border-ink bg-white text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-coral/30';

// ─── Formulario para agregar alumno ───────────────────────────────────────────

function AgregarAlumnoForm({
  grupoId,
  onDone,
}: {
  grupoId: string;
  onDone: () => void;
}) {
  const { crear } = useAlumnoActions();
  const { showAlert } = useDialog();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const nombreTrim = nombre.trim();
    if (!nombreTrim) { setErr('El nombre es obligatorio.'); return; }
    try {
      await crear.mutateAsync({ grupoId, nombre: nombreTrim, dni: dni.trim() || null });
      onDone();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Error al crear alumno');
      await showAlert(err ?? 'Error');
    }
  };

  return (
    <form onSubmit={(e) => { void onSubmit(e); }} className="bg-white rounded-2xl border-[1.5px] border-ink p-4 shadow-pop space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink/60">Agregar hijo/a</h3>

      {err && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {err}
        </div>
      )}

      <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
          Nombre *
        </span>
        <input
          type="text"
          required
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); }}
          placeholder="Ej: Valentina"
          className={INPUT_CLS}
          autoFocus
        />
      </label>

      <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
          DNI (opcional)
        </span>
        <input
          type="text"
          value={dni}
          onChange={(e) => { setDni(e.target.value); }}
          placeholder="12345678"
          className={INPUT_CLS + ' font-mono'}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={crear.isPending}>
          Agregar
        </Button>
      </div>
    </form>
  );
}

// ─── AlumnoItem ───────────────────────────────────────────────────────────────

function AlumnoItem({
  alumno,
  grupoId,
  userId,
  soyAdmin,
}: {
  alumno: AlumnoConTutores;
  grupoId: string;
  userId: string;
  soyAdmin: boolean;
}) {
  const { joinAsTutor, leaveAsTutor } = useAlumnoActions();
  const { showConfirm, showAlert } = useDialog();

  const tutores = alumno.alumno_tutores;
  const yoSoyTutor = tutores.some((t) => t.profile_id === userId);
  const inicial = alumno.nombre[0]?.toUpperCase() ?? '?';

  const handleJoin = async () => {
    try {
      await joinAsTutor.mutateAsync({ grupoId, alumnoId: alumno.id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al unirse como tutor');
    }
  };

  const handleLeave = async () => {
    const ok = await showConfirm(`¿Desregistrarte como tutor de ${alumno.nombre}?`);
    if (!ok) return;
    try {
      await leaveAsTutor.mutateAsync({ grupoId, alumnoId: alumno.id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al salir como tutor');
    }
  };

  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-ink p-3 shadow-pop">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-coral/15 flex items-center justify-center font-display font-black text-coral shrink-0">
          {inicial}
        </div>

        {/* Nombre */}
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-base truncate">{alumno.nombre}</div>
          <div className="text-[10px] text-ink/50 uppercase tracking-wider font-semibold">
            {tutores.length} tutor{tutores.length !== 1 ? 'es' : ''}
            {yoSoyTutor ? ' · sos uno' : ''}
          </div>
        </div>

        {/* Acción tutor */}
        {!yoSoyTutor ? (
          <button
            type="button"
            onClick={() => { void handleJoin(); }}
            disabled={joinAsTutor.isPending}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg bg-mist hover:bg-ink/10 transition-colors disabled:opacity-50"
          >
            Soy tutor
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { void handleLeave(); }}
            disabled={leaveAsTutor.isPending}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg bg-sage/15 text-sage hover:bg-sage/25 transition-colors disabled:opacity-50"
          >
            ✓ Tutor
          </button>
        )}
      </div>

      {/* Tutores list */}
      {tutores.length > 0 && (
        <div className="mt-2 pl-12 space-y-1">
          {tutores.map((t) => {
            const tNombre =
              t.profiles?.nombre ?? t.profiles?.email?.split('@')[0] ?? '—';
            const esYo = t.profile_id === userId;
            return (
              <div key={t.profile_id} className="flex items-center gap-2 text-xs text-ink/70">
                <div className="w-5 h-5 rounded-full bg-mist flex items-center justify-center font-bold text-[10px] shrink-0">
                  {tNombre[0]?.toUpperCase()}
                </div>
                <span className="truncate">
                  {tNombre}
                  {esYo && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-ink/40 ml-1">
                      (yo)
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── GrupoAlumnos ─────────────────────────────────────────────────────────────

export function GrupoAlumnos() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useProfile();
  const { data: misGrupos = [] } = useMisGrupos();
  const alumnosQ = useAlumnosByGrupo(id);
  const { merge } = useAlumnoActions();
  const { showConfirm, showAlert } = useDialog();

  const [showForm, setShowForm] = useState(false);

  const userId = profile?.id ?? '';
  const miGrupo = misGrupos.find((g) => g.id === id);
  const miRol = miGrupo?.rol_en_grupo ?? 'miembro';
  const soyAdmin = miRol === 'admin' || miRol === 'creador';

  const alumnos = alumnosQ.data ?? [];

  // Detectar duplicados: mismo nombre normalizado
  const dupGroups = (() => {
    const map: Record<string, AlumnoConTutores[]> = {};
    alumnos.forEach((a) => {
      const key = a.nombre.trim().toLowerCase();
      if (!key) return;
      (map[key] ??= []).push(a);
    });
    return Object.values(map).filter((arr) => arr.length > 1);
  })();

  const handleMerge = async (keepId: string, mergeId: string, nombre: string) => {
    const ok = await showConfirm(
      `¿Fusionar ambos "${nombre}" en uno solo? Los tutores se combinan, no se pierde nada.`,
    );
    if (!ok) return;
    try {
      await merge.mutateAsync({ grupoId: id ?? '', keepId, mergeId });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al fusionar');
    }
  };

  if (alumnosQ.isLoading) {
    return (
      <Shell>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/60 rounded-2xl border-[1.5px] border-ink/10 animate-pulse" />
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-extrabold text-2xl">Alumnos</h1>
            <p className="text-xs text-ink/60 mt-1">
              {alumnos.length} chico{alumnos.length !== 1 ? 's' : ''} en el grupo
            </p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true); }}
              className="text-[10px] font-bold uppercase tracking-wider text-coral flex items-center gap-1 hover:text-coral/80"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Agregar
            </button>
          )}
        </div>

        {/* Formulario */}
        {showForm && id && (
          <AgregarAlumnoForm
            grupoId={id}
            onDone={() => { setShowForm(false); }}
          />
        )}

        {/* Posibles duplicados (admin) */}
        {soyAdmin && dupGroups.length > 0 && (
          <div className="bg-sun/30 border-[1.5px] border-ink rounded-2xl p-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
              ✦ Posibles duplicados
            </div>
            {dupGroups.map((grp) => (
              <div key={grp[0].id} className="text-sm space-y-1">
                <div className="font-bold">
                  {grp.length} alumnos llamados &ldquo;{grp[0].nombre}&rdquo;
                </div>
                <div className="text-[11px] text-ink/70">
                  Si son la misma persona (típico: padres separados), fusionalos.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleMerge(grp[0].id, grp[1].id, grp[0].nombre);
                  }}
                  disabled={merge.isPending}
                  className="text-[11px] font-bold uppercase tracking-wider bg-ink text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Fusionar → 1 solo
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Lista de alumnos */}
        {alumnos.length === 0 ? (
          <div className="bg-mist/50 rounded-3xl p-6 text-center space-y-3">
            <div className="text-4xl">🎒</div>
            <div className="font-display font-bold text-lg">Todavía no hay chicos cargados</div>
            <p className="text-sm text-ink/60">
              Sumá a tu hijo/a para empezar a votar y dividir los gastos del grupo.
            </p>
            <button
              type="button"
              onClick={() => { setShowForm(true); }}
              className="mt-2 text-xs font-bold uppercase tracking-wider text-coral"
            >
              Agregar mi hijo/a →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {alumnos.map((a) => (
              <AlumnoItem
                key={a.id}
                alumno={a}
                grupoId={id ?? ''}
                userId={userId}
                soyAdmin={soyAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
