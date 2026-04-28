import type { NecesidadEstado, RolEnGrupo } from '@/lib/database.types';

/* ── Badge de estado de necesidad ──────────────────────────────────────── */

const estadoConfig: Record<NecesidadEstado, { label: string; className: string }> = {
  recibiendo_ofertas:            { label: 'Recibiendo ofertas',  className: 'bg-sun text-ink' },
  en_votacion:                   { label: 'En votación',         className: 'bg-violet text-white' },
  adjudicada:                    { label: 'Adjudicada',          className: 'bg-sage text-white' },
  en_produccion:                 { label: 'En producción',       className: 'bg-ink text-sun' },
  en_entrega:                    { label: 'En entrega',          className: 'bg-ink text-cream' },
  pendiente_confirmacion_grupo:  { label: 'Por confirmar',       className: 'bg-mist text-ink' },
  completada:                    { label: 'Completada',          className: 'bg-mist text-ink' },
  cancelada:                     { label: 'Cancelada',           className: 'bg-coral/20 text-coral' },
  disputada:                     { label: 'Disputada',           className: 'bg-coral text-white' },
};

export function EstadoBadge({ estado }: { estado: NecesidadEstado }) {
  const config = estadoConfig[estado] ?? { label: estado, className: 'bg-mist text-ink' };
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

/* ── Badge de rol en grupo ──────────────────────────────────────────────── */

const rolConfig: Record<RolEnGrupo, { label: string; className: string }> = {
  creador: { label: 'Creador', className: 'bg-sun text-ink' },
  admin:   { label: 'Admin',   className: 'bg-violet/20 text-ink' },
  miembro: { label: 'Miembro', className: 'bg-mist/60 text-ink' },
};

export function RolBadge({ rol }: { rol: RolEnGrupo }) {
  const config = rolConfig[rol] ?? { label: rol, className: 'bg-mist text-ink' };
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${config.className}`}>
      {config.label}
    </span>
  );
}

/* ── Badge genérico ─────────────────────────────────────────────────────── */

interface GenericBadgeProps {
  label: string;
  className?: string;
}

export function Badge({ label, className = 'bg-mist text-ink' }: GenericBadgeProps) {
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${className}`}>
      {label}
    </span>
  );
}
