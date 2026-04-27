import type { RelacionTutor } from '@/lib/database.types';

/** "Papá", "Mamá", "Tutor/a", "Encargado/a" — para badges/etiquetas. */
const labelsCortos: Record<RelacionTutor, string> = {
  padre: 'Papá',
  madre: 'Mamá',
  tutor: 'Tutor/a',
  encargado: 'Encargado/a',
};

/** "Papá de Juana", "Mamá de Mateo"… — para frases en líneas de miembros. */
const prefijos: Record<RelacionTutor, string> = {
  padre: 'Papá de',
  madre: 'Mamá de',
  tutor: 'Tutor/a de',
  encargado: 'Encargado/a de',
};

export function relacionLabel(r: RelacionTutor): string {
  return labelsCortos[r];
}

export function relacionPrefijo(r: RelacionTutor): string {
  return prefijos[r];
}

export const RELACIONES: { value: RelacionTutor; label: string }[] = [
  { value: 'padre', label: 'Papá' },
  { value: 'madre', label: 'Mamá' },
  { value: 'tutor', label: 'Tutor/a' },
  { value: 'encargado', label: 'Encargado/a' },
];
