import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AlumnoRow, RelacionTutor } from '@/lib/database.types';
import { alumnosByGrupoKey } from '@/lib/queries/useAlumnosByGrupo';

interface CrearAlumnoArgs {
  grupoId: string;
  nombre: string;
  dni?: string | null;
  relacion?: RelacionTutor;
}

interface MergeAlumnoArgs {
  grupoId: string;
  keepId: string;
  mergeId: string;
}

interface TutorArgs {
  grupoId: string;
  alumnoId: string;
  relacion?: RelacionTutor;
}

interface SetRelacionArgs {
  grupoId: string;
  alumnoId: string;
  relacion: RelacionTutor;
}

/**
 * Acciones de gestión de alumnos: crear, fusionar duplicados y
 * unirse/desunirse como tutor.
 */
export function useAlumnoActions() {
  const queryClient = useQueryClient();

  const invalidar = (grupoId: string) => {
    void queryClient.invalidateQueries({ queryKey: alumnosByGrupoKey(grupoId) });
  };

  /** Crea un alumno en el grupo y registra al usuario actual como tutor. */
  const crear = useMutation<AlumnoRow, Error, CrearAlumnoArgs>({
    mutationFn: async ({ grupoId, nombre, dni, relacion }) => {
      const { data, error } = await supabase.rpc('alumno_create_with_tutor', {
        p_grupo: grupoId,
        p_nombre: nombre,
        p_dni: dni ?? null,
        ...(relacion ? { p_relacion: relacion } : {}),
      });
      if (error) throw error;
      const alumno = (data as AlumnoRow[] | null)?.[0];
      if (!alumno) throw new Error('alumno_create_with_tutor no devolvió fila');
      return alumno;
    },
    onSuccess: (_data, { grupoId }) => { invalidar(grupoId); },
  });

  /** Fusiona un alumno duplicado con otro, conservando el keepId. */
  const merge = useMutation<void, Error, MergeAlumnoArgs>({
    mutationFn: async ({ keepId, mergeId }) => {
      const { error } = await supabase.rpc('alumnos_merge', {
        p_alumno_keep: keepId,
        p_alumno_merge: mergeId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidar(grupoId); },
  });

  /** El usuario actual se registra como tutor del alumno. */
  const joinAsTutor = useMutation<void, Error, TutorArgs>({
    mutationFn: async ({ alumnoId, relacion }) => {
      const { error } = await supabase.rpc('alumno_join_as_tutor', {
        p_alumno: alumnoId,
        ...(relacion ? { p_relacion: relacion } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidar(grupoId); },
  });

  /** El usuario actual se desregistra como tutor del alumno. */
  const leaveAsTutor = useMutation<void, Error, TutorArgs>({
    mutationFn: async ({ alumnoId }) => {
      const { error } = await supabase.rpc('alumno_leave_as_tutor', { p_alumno: alumnoId });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidar(grupoId); },
  });

  /** Editar la propia relacion con un alumno (no podes editar la de otro tutor). */
  const setMiRelacion = useMutation<void, Error, SetRelacionArgs>({
    mutationFn: async ({ alumnoId, relacion }) => {
      const { error } = await supabase.rpc('alumno_set_mi_relacion', {
        p_alumno: alumnoId,
        p_relacion: relacion,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { grupoId }) => { invalidar(grupoId); },
  });

  return { crear, merge, joinAsTutor, leaveAsTutor, setMiRelacion };
}
