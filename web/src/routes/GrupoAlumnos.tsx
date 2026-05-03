import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui';
import { useDialog, useToast } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { useMisGrupos } from '@/lib/queries/useMisGrupos';
import { useAlumnosByGrupo } from '@/lib/queries/useAlumnosByGrupo';
import { useAlumnoActions } from '@/lib/mutations/useAlumnoActions';
import type { AlumnoConTutores } from '@/lib/queries/useAlumnosByGrupo';
import type { RelacionTutor } from '@/lib/database.types';
import { RELACIONES, relacionLabel } from '@/utils/relacion';

function formatCumple(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

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
  const { showToast } = useToast();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [relacion, setRelacion] = useState<RelacionTutor>('tutor');
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const nombreTrim = nombre.trim();
    const dniTrim = dni.replace(/\D/g, '');
    if (!nombreTrim) { setErr('El nombre es obligatorio.'); return; }
    if (dniTrim.length < 7 || dniTrim.length > 8) {
      setErr('El DNI es obligatorio (7 u 8 dígitos).');
      return;
    }
    if (!fechaNacimiento) {
      setErr('La fecha de nacimiento es obligatoria.');
      return;
    }
    try {
      await crear.mutateAsync({
        grupoId,
        nombre: nombreTrim,
        dni: dniTrim,
        relacion,
        fechaNacimiento,
      });
      showToast(`¡${nombreTrim} agregado!`);
      onDone();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al crear alumno';
      setErr(msg);
      await showAlert(msg);
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
          DNI *
        </span>
        <input
          type="text"
          required
          inputMode="numeric"
          value={dni}
          onChange={(e) => { setDni(e.target.value); }}
          placeholder="12345678"
          className={INPUT_CLS + ' font-mono'}
        />
        <span className="block mt-1 text-[10px] text-ink/55">
          Privado — no se muestra a los demás usuarios. Sirve para no duplicar al alumno cuando otro tutor lo cargue.
        </span>
      </label>

      <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
          Fecha de nacimiento *
        </span>
        <input
          type="date"
          required
          value={fechaNacimiento}
          onChange={(e) => { setFechaNacimiento(e.target.value); }}
          max={new Date().toISOString().slice(0, 10)}
          className={INPUT_CLS}
        />
        <span className="block mt-1 text-[10px] text-ink/55">
          Aparece en el calendario de cumpleaños del grupo.
        </span>
      </label>

      <div>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
          Tu relación
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {RELACIONES.map((r) => {
            const active = relacion === r.value;
            return (
              <button
                type="button"
                key={r.value}
                onClick={() => { setRelacion(r.value); }}
                className={`text-[11px] font-bold rounded-lg px-2 py-2 border-[1.5px] transition ${
                  active ? 'border-ink bg-sun/30' : 'border-ink/20 bg-white hover:border-ink/50'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

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
}: {
  alumno: AlumnoConTutores;
  grupoId: string;
  userId: string;
}) {
  const { joinAsTutor, leaveAsTutor, setMiRelacion, setFechaNacimiento } = useAlumnoActions();
  const { showConfirm, showAlert } = useDialog();
  const { showToast } = useToast();
  const [showJoinPicker, setShowJoinPicker] = useState(false);
  const [joinDni, setJoinDni] = useState('');
  const [showEditPicker, setShowEditPicker] = useState(false);
  const [editFecha, setEditFecha] = useState(false);
  const [fechaInput, setFechaInput] = useState(alumno.fecha_nacimiento ?? '');

  const tutores = alumno.alumno_tutores;
  const miTutor = tutores.find((t) => t.profile_id === userId);
  const yoSoyTutor = !!miTutor;
  const inicial = alumno.nombre[0]?.toUpperCase() ?? '?';

  const handleSaveFecha = async () => {
    try {
      await setFechaNacimiento.mutateAsync({
        grupoId,
        alumnoId: alumno.id,
        fecha: fechaInput || null,
      });
      setEditFecha(false);
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al guardar fecha');
    }
  };

  const handleJoin = async (relacion: RelacionTutor) => {
    const dniNorm = joinDni.replace(/\D/g, '');
    if (dniNorm.length < 7 || dniNorm.length > 8) {
      await showAlert('Ingresá el DNI del menor (7 u 8 dígitos) para verificar que sos tutor.');
      return;
    }
    setShowJoinPicker(false);
    setJoinDni('');
    try {
      await joinAsTutor.mutateAsync({
        grupoId,
        alumnoId: alumno.id,
        dni: dniNorm,
        relacion,
      });
      showToast(`¡Ahora sos ${relacionLabel(relacion).toLowerCase()} de ${alumno.nombre}!`);
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al unirse como tutor');
    }
  };

  const handleSetRelacion = async (relacion: RelacionTutor) => {
    setShowEditPicker(false);
    if (relacion === miTutor?.relacion) return;
    try {
      await setMiRelacion.mutateAsync({ grupoId, alumnoId: alumno.id, relacion });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al cambiar relación');
    }
  };

  const handleLeave = async () => {
    setShowEditPicker(false);
    const ok = await showConfirm(`¿Desregistrarte como tutor de ${alumno.nombre}?`);
    if (!ok) return;
    try {
      await leaveAsTutor.mutateAsync({ grupoId, alumnoId: alumno.id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al salir como tutor');
    }
  };

  const tieneDniEnFicha = Boolean(alumno.dni?.replace(/\D/g, '').length);

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
            {yoSoyTutor ? ` · sos ${relacionLabel(miTutor.relacion).toLowerCase()}` : ''}
          </div>
        </div>

        {/* Acción tutor: solo con DNI cargado en la ficha se puede sumar co-tutor */}
        {!yoSoyTutor ? (
          tieneDniEnFicha ? (
            <button
              type="button"
              onClick={() => {
                setShowJoinPicker((v) => !v);
                if (showJoinPicker) setJoinDni('');
              }}
              disabled={joinAsTutor.isPending}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg bg-mist hover:bg-ink/10 transition-colors disabled:opacity-50"
            >
              Soy tutor
            </button>
          ) : (
            <span
              className="text-[9px] font-bold uppercase tracking-wider text-ink/40 text-right max-w-[7rem] leading-tight"
              title="Hace falta que quien dio de alta al menor cargue el DNI en la ficha (o que lo den de alta de nuevo con DNI) para poder sumarte."
            >
              Sin DNI en ficha
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={() => { setShowEditPicker((v) => !v); }}
            disabled={setMiRelacion.isPending || leaveAsTutor.isPending}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg bg-sage/15 text-sage hover:bg-sage/25 transition-colors disabled:opacity-50"
          >
            ✓ {relacionLabel(miTutor.relacion)}
          </button>
        )}
      </div>

      {/* Picker: DNI + relación (el backend exige que el DNI coincida con el del alumno) */}
      {showJoinPicker && !yoSoyTutor && tieneDniEnFicha && (
        <div className="mt-3 pl-12 space-y-3">
          <p className="text-[11px] text-ink/70 leading-snug">
            Ingresá el <span className="font-bold text-ink">DNI del menor</span> (el mismo que cargó quien lo dio de alta).
            No se muestra a nadie: solo sirve para verificar que sos tutor.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={joinDni}
            onChange={(e) => { setJoinDni(e.target.value); }}
            placeholder="DNI del menor"
            className={INPUT_CLS + ' font-mono text-sm py-2.5'}
            autoComplete="off"
          />
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
            ¿Qué relación tenés con {alumno.nombre}?
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {RELACIONES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => { void handleJoin(r.value); }}
                className="text-[11px] font-bold rounded-lg px-2 py-2 border-[1.5px] border-ink/20 hover:border-ink hover:bg-sun/30 transition"
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setShowJoinPicker(false); setJoinDni(''); }}
            className="text-[10px] font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Picker para editar mi relación o salir como tutor */}
      {showEditPicker && yoSoyTutor && (
        <div className="mt-3 pl-12 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
            Cambiar relación
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {RELACIONES.map((r) => {
              const active = miTutor.relacion === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { void handleSetRelacion(r.value); }}
                  className={`text-[11px] font-bold rounded-lg px-2 py-2 border-[1.5px] transition ${
                    active ? 'border-ink bg-sun/30' : 'border-ink/20 hover:border-ink/50'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { void handleLeave(); }}
            className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
          >
            ← Salir como tutor
          </button>
        </div>
      )}

      {/* Cumpleaños */}
      <div className="mt-2 pl-12 text-xs text-ink/70 flex items-center gap-2">
        <span className="text-ink/50">🎂</span>
        {!editFecha ? (
          <>
            <span>
              {alumno.fecha_nacimiento
                ? formatCumple(alumno.fecha_nacimiento)
                : <span className="text-ink/40 italic">sin fecha de nacimiento</span>}
            </span>
            {yoSoyTutor && (
              <button
                type="button"
                onClick={() => {
                  setFechaInput(alumno.fecha_nacimiento ?? '');
                  setEditFecha(true);
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
              >
                {alumno.fecha_nacimiento ? 'editar' : 'cargar'}
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fechaInput}
              onChange={(e) => { setFechaInput(e.target.value); }}
              max={new Date().toISOString().slice(0, 10)}
              className="text-xs px-2 py-1 rounded-lg border-[1.5px] border-ink/30 focus:outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={() => { void handleSaveFecha(); }}
              disabled={setFechaNacimiento.isPending}
              className="text-[10px] font-bold uppercase tracking-wider text-sage hover:underline disabled:opacity-50"
            >
              guardar
            </button>
            <button
              type="button"
              onClick={() => { setEditFecha(false); }}
              className="text-[10px] font-bold uppercase tracking-wider text-ink/50 hover:underline"
            >
              cancelar
            </button>
          </div>
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
                  <span className="text-[10px] text-ink/55 ml-1">
                    · {relacionLabel(t.relacion)}
                  </span>
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
            {dupGroups.map((grp) => {
              const primero = grp[0];
              const segundo = grp[1];
              if (!primero || !segundo) return null;
              return (
              <div key={primero.id} className="text-sm space-y-1">
                <div className="font-bold">
                  {grp.length} alumnos llamados &ldquo;{primero.nombre}&rdquo;
                </div>
                <div className="text-[11px] text-ink/70">
                  Si son la misma persona (típico: padres separados), fusionalos.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleMerge(primero.id, segundo.id, primero.nombre);
                  }}
                  disabled={merge.isPending}
                  className="text-[11px] font-bold uppercase tracking-wider bg-ink text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Fusionar → 1 solo
                </button>
              </div>
              );
            })}
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
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
