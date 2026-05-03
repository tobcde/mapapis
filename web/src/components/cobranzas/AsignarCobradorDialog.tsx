import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAsignarCobrador } from '@/lib/mutations/useCobranzasActions';
import { useProfile } from '@/lib/queries/useProfile';
import { fmtMoney } from '@/utils/fmt';

interface MiembroParaCobrador {
  profile_id: string;
  rol_en_grupo: string;
  profile: {
    id: string;
    nombre: string | null;
    email: string;
    alias_mp: string | null;
  } | null;
}

interface Props {
  necesidadId: string;
  grupoId: string;
  totalCobranzaCentavos: number;
  alumnosElegibles: number;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

/**
 * Dialog que el creador del grupo abre despues de adjudicar una oferta
 * para nominar al miembro que va a recibir las transferencias del resto.
 *
 * Flow:
 *   1. Mostrar lista de miembros del grupo (excluyendo al propio creador
 *      si quiere, pero deja elegirlo tambien — puede ser su tarea).
 *   2. Al seleccionar un miembro: precargar su `alias_mp` si existe.
 *      Si no, dejar el input vacio (obligatorio antes de confirmar).
 *   3. Confirmar dispara `asignar_cobrador` que ademas guarda el alias en
 *      el perfil del cobrador para futuros usos.
 *
 * El monto que se muestra arriba es informativo: total de la oferta
 * ganadora ya dividido entre N alumnos elegibles. Le da contexto al
 * creador antes de elegir.
 */
export function AsignarCobradorDialog({
  necesidadId,
  grupoId,
  totalCobranzaCentavos,
  alumnosElegibles,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const { data: yo } = useProfile();
  const miembrosQ = useMiembrosConAlias(grupoId);

  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const miembros = useMemo<MiembroParaCobrador[]>(
    () => (miembrosQ.data ?? []).filter((m) => m.profile !== null),
    [miembrosQ.data],
  );

  const elegido = miembros.find((m) => m.profile_id === seleccionado) ?? null;

  const cuotaPorAlumno = alumnosElegibles > 0
    ? Math.round(totalCobranzaCentavos / alumnosElegibles)
    : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-md bg-cream rounded-3xl border-[1.5px] border-ink p-6 dialog-in flex flex-col max-h-[85vh]"
        style={{ boxShadow: '4px 4px 0 var(--ink)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asignar-cobrador-title"
      >
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-sun shrink-0">
          <CashIcon className="w-5 h-5 text-ink" />
        </div>

        <h2
          id="asignar-cobrador-title"
          className="font-display font-extrabold text-xl leading-tight mb-1 shrink-0"
        >
          ¿Quién va a juntar la plata?
        </h2>
        <p className="text-sm text-ink/70 mb-3 shrink-0">
          Esa persona va a recibir las transferencias del grupo. Después le paga
          a la pyme.
        </p>

        {alumnosElegibles > 0 && (
          <div className="bg-mist/50 rounded-xl border-[1.5px] border-ink/20 p-3 mb-4 text-xs shrink-0">
            <p className="font-bold text-ink">
              Total a recolectar: {fmtMoney(totalCobranzaCentavos)}
            </p>
            <p className="text-ink/60">
              ≈ {fmtMoney(cuotaPorAlumno)} por alumno · {alumnosElegibles}{' '}
              {alumnosElegibles === 1 ? 'familia' : 'familias'}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {miembrosQ.isLoading && (
            <div className="text-sm text-ink/60 py-4 text-center">Cargando miembros…</div>
          )}

          {!miembrosQ.isLoading && miembros.length === 0 && (
            <div className="text-sm text-ink/60 py-4 text-center">
              No hay miembros en el grupo.
            </div>
          )}

          <div className="space-y-2">
            {miembros.map((m) => {
              const esYo = m.profile_id === yo?.id;
              const nombre = m.profile?.nombre ?? m.profile?.email.split('@')[0] ?? 'Sin nombre';
              const isSelected = seleccionado === m.profile_id;
              const tieneAlias = Boolean(m.profile?.alias_mp);
              return (
                <button
                  key={m.profile_id}
                  type="button"
                  onClick={() => { setSeleccionado(m.profile_id); }}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border-[1.5px] transition-colors ${
                    isSelected
                      ? 'border-coral bg-coral/10'
                      : 'border-ink/15 bg-white hover:border-ink/40'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-mist flex items-center justify-center shrink-0">
                    <span className="text-sm font-extrabold text-ink">
                      {nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink truncate">
                      {nombre} {esYo && <span className="text-ink/50 font-normal">(vos)</span>}
                    </p>
                    <p className="text-[11px] text-ink/55">
                      {tieneAlias ? `Alias: ${m.profile?.alias_mp ?? ''}` : 'Sin alias cargado'}
                    </p>
                  </div>
                  {isSelected && <CheckIcon className="w-5 h-5 text-coral shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {elegido ? (
          <FormularioConfirmar
            key={elegido.profile_id}
            elegido={elegido}
            necesidadId={necesidadId}
            grupoId={grupoId}
            onClose={onClose}
            onSuccess={onSuccess}
            onError={onError}
          />
        ) : (
          <div className="flex gap-2 mt-5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border-[1.5px] border-ink font-bold text-sm uppercase tracking-wide bg-white text-ink"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled
              className="flex-1 py-3 rounded-xl border-[1.5px] border-ink font-extrabold text-sm uppercase tracking-wide bg-ink text-cream opacity-50"
            >
              Asignar cobrador
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-form: alias + confirmar (re-mounted on member change) ──────────────

interface FormularioProps {
  elegido: MiembroParaCobrador;
  necesidadId: string;
  grupoId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function FormularioConfirmar({
  elegido,
  necesidadId,
  grupoId,
  onClose,
  onSuccess,
  onError,
}: FormularioProps) {
  const asignar = useAsignarCobrador();
  const [alias, setAlias] = useState(elegido.profile?.alias_mp ?? '');
  const [touched, setTouched] = useState(false);

  const aliasLimpio = alias.trim();
  const aliasValido = aliasLimpio.length >= 4 && !aliasLimpio.includes(' ');
  const puedeConfirmar = aliasValido && !asignar.isPending;

  const handleConfirmar = async () => {
    if (!aliasValido) return;
    try {
      await asignar.mutateAsync({
        necesidadId,
        grupoId,
        cobradorId: elegido.profile_id,
        alias: aliasLimpio,
      });
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al asignar el cobrador');
    }
  };

  return (
    <>
      <div className="mt-4 shrink-0">
        <label className="text-[10px] font-bold uppercase tracking-wider text-ink/55 block mb-1">
          Alias o CBU para transferir
        </label>
        <input
          type="text"
          value={alias}
          onChange={(e) => { setAlias(e.target.value); setTouched(true); }}
          onBlur={() => { setTouched(true); }}
          placeholder="ej. mi.alias.banco"
          autoComplete="off"
          spellCheck={false}
          className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-ink bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-coral/30"
        />
        {touched && !aliasValido && (
          <p className="text-[11px] text-coral mt-1">
            El alias no puede tener espacios y debe tener al menos 4 caracteres.
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-5 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={asignar.isPending}
          className="flex-1 py-3 rounded-xl border-[1.5px] border-ink font-bold text-sm uppercase tracking-wide bg-white text-ink disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { void handleConfirmar(); }}
          disabled={!puedeConfirmar}
          className="flex-1 py-3 rounded-xl border-[1.5px] border-ink font-extrabold text-sm uppercase tracking-wide btn-pop bg-ink text-cream disabled:opacity-50"
        >
          {asignar.isPending ? 'Asignando…' : 'Asignar cobrador'}
        </button>
      </div>
    </>
  );
}

// ─── Query helper ────────────────────────────────────────────────────────────

interface MiembroConAliasRaw {
  profile_id: string;
  rol_en_grupo: string;
  profiles: {
    id: string;
    nombre: string | null;
    email: string;
    alias_mp: string | null;
  } | null;
}

/**
 * Trae los miembros del grupo incluyendo el alias_mp del perfil de cada
 * uno (visible entre co-miembros desde la migracion 034).
 */
function useMiembrosConAlias(grupoId: string | undefined) {
  return useQuery<MiembroParaCobrador[]>({
    queryKey: ['miembros-con-alias', grupoId],
    enabled: Boolean(grupoId),
    queryFn: async () => {
      if (!grupoId) return [];
      const { data, error } = await supabase
        .from('grupo_miembros')
        .select('profile_id, rol_en_grupo, profiles(id, nombre, email, alias_mp)')
        .eq('grupo_id', grupoId);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MiembroConAliasRaw[];
      return rows.map((r) => ({
        profile_id: r.profile_id,
        rol_en_grupo: r.rol_en_grupo,
        profile: r.profiles,
      }));
    },
  });
}

// ─── Iconos ──────────────────────────────────────────────────────────────────

function CashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
