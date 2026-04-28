import { useMemo } from 'react';
import type { DiaSemana, HorarioDia, HorariosSemana, RangoHorario } from '@/lib/database.types';

const DIAS: { key: DiaSemana; label: string }[] = [
  { key: 'lun', label: 'Lun' },
  { key: 'mar', label: 'Mar' },
  { key: 'mie', label: 'Mié' },
  { key: 'jue', label: 'Jue' },
  { key: 'vie', label: 'Vie' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

function diaVacio(): HorarioDia {
  return { abierto: false, rangos: [] };
}

function diaConRango(rango: RangoHorario): HorarioDia {
  return { abierto: true, rangos: [rango] };
}

interface Props {
  value: HorariosSemana;
  onChange: (next: HorariosSemana) => void;
}

/**
 * Editor de horarios por día con rangos múltiples.
 * - ☑/☐ Abierto: alterna entre cerrado y al menos 1 rango.
 * - Por día permite hasta 4 rangos (08:00–12:00 + 14:00–20:00 + ...).
 * - "Igual a Lun" copia los rangos del lunes a ese día.
 */
export function HorariosEditor({ value, onChange }: Props) {
  const lun = value.lun;

  const setDia = (dia: DiaSemana, patch: HorarioDia) => {
    onChange({ ...value, [dia]: patch });
  };

  const toggleAbierto = (dia: DiaSemana) => {
    const cur = value[dia] ?? diaVacio();
    if (cur.abierto) {
      setDia(dia, diaVacio());
    } else {
      setDia(dia, diaConRango({ desde: '09:00', hasta: '13:00' }));
    }
  };

  const updateRango = (dia: DiaSemana, idx: number, patch: Partial<RangoHorario>) => {
    const cur = value[dia] ?? diaVacio();
    const nuevos = cur.rangos.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setDia(dia, { abierto: true, rangos: nuevos });
  };

  const removeRango = (dia: DiaSemana, idx: number) => {
    const cur = value[dia] ?? diaVacio();
    const nuevos = cur.rangos.filter((_, i) => i !== idx);
    setDia(dia, nuevos.length === 0 ? diaVacio() : { abierto: true, rangos: nuevos });
  };

  const addRango = (dia: DiaSemana) => {
    const cur = value[dia] ?? diaVacio();
    if (cur.rangos.length >= 4) return;
    setDia(dia, { abierto: true, rangos: [...cur.rangos, { desde: '14:00', hasta: '20:00' }] });
  };

  const igualALunes = (dia: DiaSemana) => {
    if (!lun || !lun.abierto) return;
    setDia(dia, { abierto: true, rangos: [...lun.rangos] });
  };

  const lunesTieneRangos = useMemo(
    () => Boolean(lun?.abierto && lun.rangos.length > 0),
    [lun],
  );

  return (
    <div className="space-y-2">
      {DIAS.map(({ key, label }) => {
        const dia = value[key] ?? diaVacio();
        const esLunes = key === 'lun';
        return (
          <div
            key={key}
            className="rounded-xl border-[1.5px] border-ink/15 bg-white px-3 py-2 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { toggleAbierto(key); }}
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                  dia.abierto ? 'bg-sage/20 text-sage' : 'bg-ink/10 text-ink/55'
                }`}
              >
                {dia.abierto ? '☑ Abierto' : '☐ Cerrado'}
              </button>
              <span className="font-display font-bold text-sm w-10">{label}</span>
              {dia.abierto && !esLunes && lunesTieneRangos && (
                <button
                  type="button"
                  onClick={() => { igualALunes(key); }}
                  className="ml-auto text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
                >
                  📋 igual a Lun
                </button>
              )}
            </div>
            {dia.abierto && (
              <div className="space-y-1 pl-12">
                {dia.rangos.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={r.desde}
                      onChange={(e) => { updateRango(key, idx, { desde: e.target.value }); }}
                      className="px-2 py-1 rounded-md border border-ink/30 text-xs font-mono"
                    />
                    <span className="text-ink/45 text-xs">–</span>
                    <input
                      type="time"
                      value={r.hasta}
                      onChange={(e) => { updateRango(key, idx, { hasta: e.target.value }); }}
                      className="px-2 py-1 rounded-md border border-ink/30 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => { removeRango(key, idx); }}
                      className="text-ink/40 hover:text-coral text-sm px-1"
                      aria-label="Quitar rango"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {dia.rangos.length < 4 && (
                  <button
                    type="button"
                    onClick={() => { addRango(key); }}
                    className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
                  >
                    + agregar rango
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
