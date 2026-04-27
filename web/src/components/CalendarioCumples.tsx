import { useProximosCumples } from '@/lib/queries/useProximosCumples';
import type { ProximoCumple } from '@/lib/database.types';

interface Props {
  grupoId: string | undefined;
}

/**
 * Calendario de cumpleaños del grupo: próximos 3 meses.
 * La ventana la filtra la vista `proximos_cumples` en la DB.
 */
export function CalendarioCumples({ grupoId }: Props) {
  const { data, isLoading, error } = useProximosCumples(grupoId);

  if (!grupoId) return null;

  if (isLoading) {
    return (
      <div className="bg-white/60 rounded-2xl border-[1.5px] border-ink/10 p-4 h-[80px] animate-pulse" />
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

  return (
    <div
      className="bg-white rounded-2xl border-[1.5px] border-ink p-4"
      style={{ boxShadow: 'var(--shadow-pop)' }}
    >
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🎂</span>
          <h3 className="font-display font-extrabold text-base">Próximos cumples</h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">
          próx. 3 meses
        </span>
      </div>
      <ul className="grid gap-2">
        {data.map((c) => (
          <CumpleRow key={c.alumno_id} cumple={c} />
        ))}
      </ul>
    </div>
  );
}

function CumpleRow({ cumple }: { cumple: ProximoCumple }) {
  const dias = cumple.dias_para_cumple;
  const cuando =
    dias === 0 ? '¡hoy!'
    : dias === 1 ? 'mañana'
    : `en ${dias} día${dias === 1 ? '' : 's'}`;

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
          cumple {cumple.edad_que_cumple} · {cuando}
        </div>
      </div>
    </li>
  );
}

function formatDay(iso: string): { dia: string; mesCorto: string } {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { dia: '?', mesCorto: '?' };
  return {
    dia: d.getDate().toString(),
    mesCorto: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}
