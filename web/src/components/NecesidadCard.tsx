import { useNavigate } from 'react-router-dom';
import type { NecesidadRow } from '@/lib/database.types';
import { estadoLabel, estadoBadgeClass } from '@/utils/necesidad';
import { fmtMoney } from '@/utils/fmt';

export type CardMode = 'familia' | 'pyme';

export interface NecesidadCardData extends NecesidadRow {
  categorias?: { nombre: string; slug: string } | null;
  grupos?: { nombre: string; rango_familias: string | null } | null;
  necesidad_inscripciones?: [{ count: number }] | [];
}

interface Props {
  n: NecesidadCardData;
  mode: CardMode;
  /** Ruta a la que navegar al hacer click. Si no se provee, navega a /grupos/:id/necesidades/:nId */
  to?: string;
}

function IconMapPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <circle cx="17" cy="7" r="2" />
      <path d="M21 20c0-2.21-1.343-4-3-4" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function fmtRango(min: number | null, max: number | null, perAlumno: boolean): string {
  if (!min && !max) return 'Sin presupuesto';
  const sufijo = perAlumno ? ' /alumno' : '';
  if (min && max) return `${fmtMoney(min)} – ${fmtMoney(max)}${sufijo}`;
  if (min) return `Desde ${fmtMoney(min)}${sufijo}`;
  return `Hasta ${fmtMoney(max!)}${sufijo}`;
}

export function NecesidadCard({ n, mode, to }: Props) {
  const navigate = useNavigate();
  const isPyme = mode === 'pyme';
  const badgeClass = estadoBadgeClass(n.estado);
  const label = estadoLabel(n.estado);
  const categoria = n.categorias?.nombre ?? '—';
  const grupoNombre = n.grupos?.nombre;
  const rango = n.grupos?.rango_familias;
  const inscriptosCount = n.necesidad_inscripciones?.[0]?.count ?? 0;

  // Si el feed (pyme) no expone grupo_id (necesidades anonimizadas),
  // caemos al route corto que tampoco lo necesita.
  const dest =
    to ?? (n.grupo_id ? `/grupos/${n.grupo_id}/necesidades/${n.id}` : `/necesidades/${n.id}`);

  const handleClick = () => { void navigate(dest); };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="block w-full text-left bg-white rounded-3xl border-[1.5px] border-ink overflow-hidden shadow-pop transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      {/* Strip de estado */}
      <div
        className={`px-4 py-1.5 ${badgeClass} text-[10px] font-bold uppercase tracking-wider flex items-center justify-between`}
      >
        <span>{label}</span>
        <span>
          {n.ofertas_count} {n.ofertas_count === 1 ? 'oferta' : 'ofertas'}
        </span>
      </div>

      {n.foto_url && (
        <img
          src={n.foto_url}
          alt=""
          className="w-full h-36 object-cover border-b-[1.5px] border-ink"
        />
      )}

      <div className="p-4">
        {/* Grupo (solo familia) */}
        {!isPyme && grupoNombre && (
          <div className="text-[10px] font-bold uppercase tracking-wider text-coral mb-1">
            {grupoNombre}
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-mist text-ink">
            {categoria}
          </span>
          {inscriptosCount > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet/20 text-ink">
              {inscriptosCount} anotados
            </span>
          )}
          {isPyme && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ink text-cream">
              {n.creador_tipo === 'institucion' ? 'Institución' : 'Grupo de padres'}
            </span>
          )}
        </div>

        <h3 className="font-display font-bold text-lg leading-tight">{n.titulo}</h3>

        <div className="mt-3 flex items-center gap-3 text-xs text-ink/70 flex-wrap">
          <span className="flex items-center gap-1">
            <IconMapPin /> {n.zona}
          </span>
          {rango && (
            <span className="flex items-center gap-1">
              <IconUsers /> {rango}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-sm font-bold">
            {fmtRango(
              n.presupuesto_min_centavos,
              n.presupuesto_max_centavos,
              n.modalidad === 'individual',
            )}
          </span>
          <span className="text-coral">
            <IconArrow />
          </span>
        </div>
      </div>
    </button>
  );
}
