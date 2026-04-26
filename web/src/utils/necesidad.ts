import type { ModoEntrega, NecesidadEstado } from '@/lib/database.types';

const labels: Record<NecesidadEstado, string> = {
  recibiendo_ofertas: 'Recibiendo ofertas',
  en_votacion: 'En votación',
  adjudicada: 'Adjudicada',
  en_produccion: 'En producción',
  en_entrega: 'En entrega',
  pendiente_confirmacion_grupo: 'Esperando confirmación',
  completada: 'Completada',
  cancelada: 'Cancelada',
  disputada: 'En disputa',
};

const palette: Record<NecesidadEstado, string> = {
  recibiendo_ofertas: 'bg-sun text-ink',
  en_votacion: 'bg-violet/20 text-ink',
  adjudicada: 'bg-sage/20 text-ink',
  en_produccion: 'bg-mist/30 text-ink',
  en_entrega: 'bg-mist/30 text-ink',
  pendiente_confirmacion_grupo: 'bg-coral/15 text-ink',
  completada: 'bg-sage text-ink',
  cancelada: 'bg-ink/10 text-ink/60',
  disputada: 'bg-coral/30 text-ink',
};

export function estadoLabel(e: NecesidadEstado): string {
  return labels[e];
}

export function estadoBadgeClass(e: NecesidadEstado): string {
  return palette[e];
}

const modoEntregaLabels: Record<ModoEntrega, string> = {
  retiro: 'Solo retiro',
  envio: 'Solo envío',
  ambos: 'Retiro o envío',
};

export function modoEntregaLabel(m: ModoEntrega | null): string {
  return m ? modoEntregaLabels[m] : 'Entrega no especificada';
}

export function pymeAlias(index: number): string {
  return `Pyme ${String.fromCharCode(65 + (index % 26))}`;
}
