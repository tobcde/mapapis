-- =========================================================================
-- 045_alumno_join_as_tutor_require_dni.sql
-- =========================================================================
-- Bug: cualquier miembro del grupo podia llamar a alumno_join_as_tutor y
-- auto-asignarse tutor de un menor creado por otro, sin verificacion.
--
-- Fix: solo se puede vincular como co-tutor si se demuestra conocimiento del
-- DNI del alumno (misma semantica que alumno_create_with_tutor cuando ya
-- existe el menor en el grupo).
--
-- Reglas:
--   - p_dni obligatorio, normalizado y validado (7-8 digitos).
--   - El alumno debe tener dni NOT NULL en alumnos (si no, no hay contra
--     que comparar — el otro tutor debe cargar el DNI desde alta o edicion).
--   - normalizar_dni(alumnos.dni) debe coincidir con normalizar_dni(p_dni).
--
-- Firma nueva: (p_alumno uuid, p_dni text, p_relacion text default 'tutor')
-- La firma vieja (uuid, text) se elimina explicitamente.
-- =========================================================================

drop function if exists public.alumno_join_as_tutor(uuid, text);
drop function if exists public.alumno_join_as_tutor(uuid);

create or replace function public.alumno_join_as_tutor(
  p_alumno uuid,
  p_dni text,
  p_relacion text default 'tutor'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_tutores_count int;
  v_dni_input text := public.normalizar_dni(p_dni);
  v_dni_alumno text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  if p_relacion is null or p_relacion not in ('padre','madre','tutor','encargado') then
    raise exception 'relacion invalida (use padre/madre/tutor/encargado)';
  end if;

  if v_dni_input is null or not public.validar_dni(p_dni) then
    raise exception 'DNI invalido (debe tener 7 u 8 digitos)';
  end if;

  select grupo_id, public.normalizar_dni(dni)
    into v_grupo_id, v_dni_alumno
    from public.alumnos
   where id = p_alumno;

  if v_grupo_id is null then
    raise exception 'Alumno inexistente';
  end if;

  if not public.is_grupo_miembro(v_grupo_id) then
    raise exception 'No sos miembro del grupo del alumno';
  end if;

  if v_dni_alumno is null then
    raise exception
      'Este alumno no tiene DNI cargado. Pedile a quien lo registro que complete el DNI para poder sumarte como co-tutor.';
  end if;

  if v_dni_alumno <> v_dni_input then
    raise exception 'El DNI no coincide con el del alumno. Si es tu hijo/a, revisa el numero.';
  end if;

  select count(*) into v_tutores_count from public.alumno_tutores where alumno_id = p_alumno;
  if v_tutores_count >= 4 then
    raise exception 'Este alumno ya tiene el maximo de tutores (4)';
  end if;

  insert into public.alumno_tutores (alumno_id, profile_id, relacion)
       values (p_alumno, auth.uid(), p_relacion)
  on conflict (alumno_id, profile_id) do update
    set relacion = excluded.relacion;
end;
$$;

grant execute on function public.alumno_join_as_tutor(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
