import { useState } from 'react';
import { useProximosCumples } from '@/lib/queries/useProximosCumples';
import type { ProximoCumple } from '@/lib/database.types';

interface Props {
  grupoId: string | undefined;
}

/**
 * Calendario de cumpleaños del grupo: próximos 3 meses.
 * La ventana la filtra la vista `proximos_cumples` en la DB.
 *
 * Default = colapsado, mostrando solo el primer cumple (siguiente) y un
 * contador "+N más". Al tocar se expande la lista completa.
 */
export function CalendarioCumples({ grupoId }: Props) {
  const { data, isLoading, error } = useProximosCumples(grupoId);
  const [open, setOpen] = useState(false);

  if (!grupoId) return null;

  if (isLoading) {
    return (
      <div className="bg-white/60 rounded-2xl border-[1.5px] border-ink/10 p-4 h-[60px] animate-pulse" />
    );
  }

  if (error) {
    return (
      <div className="bg-coral/10 text-coral text-xs rounded-xl border-[1.5px] border-coral px-3 py-2">
        {error.message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-mist/30 rounded-2xl border-[1.5px] border-ink/15 px-4 py-3 text-xs text-ink/55">
        🎂 No hay cumpleaños próximos cargados.
      </div>
    );
  }

  const [siguiente, ...resto] = data;
  const restoCount = resto.length;

  return (
    <div
      className="bg-white rounded-2xl border-[1.5px] border-ink overflow-hidden"
      style={{ boxShadow: 'var(--shadow-pop)' }}
    >
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); }}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-cream/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none shrink-0">🎂</span>
          <div className="min-w-0 text-left">
            <div className="flex items-baseline gap-2">
              <h3 className="font-display font-extrabold text-base">Próximos cumples</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
                próx. 3 meses
              </span>
            </div>
            {!open && siguiente && (
              <div className="text-[12px] text-ink/65 truncate">
                {siguiente.nombre} · {prettyCuando(siguiente.dias_para_cumple)}
                {restoCount > 0 && (
                  <span className="text-ink/40"> · +{restoCount} más</span>
                )}
              </div>
            )}
          </div>
        </div>
        <span
          className={`text-ink/50 text-xs font-bold shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <ul className="grid gap-2 px-4 pb-4">
          {data.map((c) => (
            <CumpleRow key={c.alumno_id} cumple={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CumpleRow({ cumple }: { cumple: ProximoCumple }) {
  const fecha = formatDay(cumple.proximo_cumple);

  return (
    <li className="flex items-center gap-3 text-sm">
      <div className="w-12 shrink-0 text-center bg-sun/30 rounded-lg border-[1.5px] border-ink py-1.5">
        <div className="text-[9px] font-bold uppercase tracking-wider text-ink/70 leading-none">
          {fecha.mesCorto}
        </div>
        <div className="font-display font-extrabold text-lg leading-none mt-0.5">
          {fecha.dia}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold truncate">{cumple.nombre}</div>
        <div className="text-[11px] text-ink/55">
          cumple {cumple.edad_que_cumple} · {prettyCuando(cumple.dias_para_cumple)}
        </div>
      </div>
    </li>
  );
}

function prettyCuando(dias: number): string {
  if (dias === 0) return '¡hoy!';
  if (dias === 1) return 'mañana';
  return `en ${dias} día${dias === 1 ? '' : 's'}`;
}

function formatDay(iso: string): { dia: string; mesCorto: string } {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { dia: '?', mesCorto: '?' };
  return {
    dia: d.getDate().toString(),
    mesCorto: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}
