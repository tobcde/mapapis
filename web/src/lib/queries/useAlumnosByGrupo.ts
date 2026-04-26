import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AlumnoRow } from '@/lib/database.types';

export interface TutorBrief {
  profile_id: string;
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
export function useAlumnosByGrupo(grupoId: string | undefined) {
  return useQuery<AlumnoConTutores[]>({
    queryKey: alumnosByGrupoKey(grupoId),
    enabled: Boolean(grupoId),
    queryFn: async () => {
      if (!grupoId) return [];
      const { data, error } = await supabase
        .from('alumnos')
        .select('*, alumno_tutores(profile_id, profiles(id, nombre, email))')
        .eq('grupo_id', grupoId)
        .order('nombre');
      if (error) throw error;
      return (data ?? []) as unknown as AlumnoConTutores[];
    },
  });
}
