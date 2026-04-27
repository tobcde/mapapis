import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AlumnoRow, RelacionTutor } from '@/lib/database.types';

export interface TutorBrief {
  profile_id: string;
  relacion: RelacionTutor;
  profiles: { id: string; nombre: string | null; email: string } | null;
}

export interface AlumnoConTutores extends AlumnoRow {
  alumno_tutores: TutorBrief[];
}

export const alumnosByGrupoKey = (grupoId: string | undefined) =>
  ['alumnos-by-grupo', grupoId] as const;

/**
 * Devuelve todos los alumnos de un grupo con sus tutores registrados.
 * Ordena por nombre para facilitar la búsqueda.
 */
/** Trata "undefined", "null" y vacío como falsy para evitar fetches con grupo_id basura. */
function isValidGrupoId(id: string | undefined): id is string {
  return Boolean(id) && id !== 'undefined' && id !== 'null';
}

export function useAlumnosByGrupo(grupoId: string | undefined) {
  const valid = isValidGrupoId(grupoId);
  return useQuery<AlumnoConTutores[]>({
    queryKey: alumnosByGrupoKey(grupoId),
    enabled: valid,
    queryFn: async () => {
      if (!valid) return [];
      const { data, error } = await supabase
        .from('alumnos')
        .select('*, alumno_tutores(profile_id, relacion, profiles(id, nombre, email))')
        .eq('grupo_id', grupoId)
        .order('nombre');
      if (error) throw error;
      return (data ?? []) as unknown as AlumnoConTutores[];
    },
  });
}
