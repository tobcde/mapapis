-- =========================================================================
-- 030_relacion_tutor.sql — Tipo de relacion del tutor con el alumno
-- =========================================================================
-- Cada vinculo (alumno, tutor) ahora declara que clase de tutor es:
--   - padre, madre, tutor (genericamente), encargado
-- Esto permite mostrar en la lista de miembros del grupo:
--   "Pablo Magalotti · Papa de Juana, Tutor de Mateo"
--
-- Las filas existentes quedan como 'tutor' (default), y cada tutor puede
-- editar su propia relacion despues con la RPC alumno_set_mi_relacion.
--
-- Notas:
--   - Mantiene el parametro p_dni de la migracion 017 (deduplicacion por DNI).
--   - p_relacion va al final con default 'tutor' para no romper callers viejos.
-- =========================================================================

-- 1. Columna nueva con check + default
alter table public.alumno_tutores
  add column if not exists relacion text not null default 'tutor'
    check (relacion in ('padre','madre','tutor','encargado'));

-- 2. Re-crear alumno_create_with_tutor preservando DNI + agregando relacion
drop function if exists public.alumno_create_with_tutor(uuid, text);
drop function if exists public.alumno_create_with_tutor(uuid, text, text);

create or replace function public.alumno_create_with_tutor(
  p_grupo uuid,
  p_nombre text,
  p_dni text default null,
  p_relacion text default 'tutor'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_alumno_id uuid;
  v_dni text := public.normalizar_dni(p_dni);
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not public.is_grupo_miembro(p_grupo) then
    raise exception 'No sos miembro de este grupo';
  end if;
  if char_length(trim(coalesce(p_nombre,''))) < 2 then
    raise exception 'Nombre del alumno demasiado corto';
  end if;
  if p_dni is not null and v_dni is null then
    raise exception 'DNI invalido';
  end if;
  if v_dni is not null and not public.validar_dni(v_dni) then
    raise exception 'DNI invalido (debe tener 7 u 8 digitos)';
  end if;
  if p_relacion is null or p_relacion not in ('padre','madre','tutor','encargado') then
    raise exception 'relacion invalida (use padre/madre/tutor/encargado)';
  end if;

  -- Si hay DNI y ya existe en el grupo, vincular en vez de duplicar.
  if v_dni is not null then
    select id into v_alumno_id
      from public.alumnos
     where grupo_id = p_grupo and dni = v_dni
     limit 1;
    if v_alumno_id is not null then
      insert into public.alumno_tutores (alumno_id, profile_id, relacion)
           values (v_alumno_id, auth.uid(), p_relacion)
      on conflict (alumno_id, profile_id) do update
        set relacion = excluded.relacion;
      return v_alumno_id;
    end if;
  end if;

  insert into public.alumnos (grupo_id, nombre, dni)
       values (p_grupo, trim(p_nombre), v_dni)
    returning id into v_alumno_id;

  insert into public.alumno_tutores (alumno_id, profile_id, relacion)
       values (v_alumno_id, auth.uid(), p_relacion);

  return v_alumno_id;
end; $$;

grant execute on function public.alumno_create_with_tutor(uuid, text, text, text) to authenticated;

-- 3. Re-crear alumno_join_as_tutor con parametro p_relacion
drop function if exists public.alumno_join_as_tutor(uuid);

create or replace function public.alumno_join_as_tutor(
  p_alumno uuid,
  p_relacion text default 'tutor'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_tutores_count int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_relacion is null or p_relacion not in ('padre','madre','tutor','encargado') then
    raise exception 'relacion invalida (use padre/madre/tutor/encargado)';
  end if;

  select grupo_id into v_grupo_id from public.alumnos where id = p_alumno;
  if v_grupo_id is null then raise exception 'Alumno inexistente'; end if;

  if not public.is_grupo_miembro(v_grupo_id) then
    raise exception 'No sos miembro del grupo del alumno';
  end if;

  -- Cap: 4 tutores por alumno (papa, mama, padrastro, abuela...)
  select count(*) into v_tutores_count from public.alumno_tutores where alumno_id = p_alumno;
  if v_tutores_count >= 4 then
    raise exception 'Este alumno ya tiene el maximo de tutores (4)';
  end if;

  insert into public.alumno_tutores (alumno_id, profile_id, relacion)
       values (p_alumno, auth.uid(), p_relacion)
    on conflict (alumno_id, profile_id) do update
      set relacion = excluded.relacion;
end; $$;

grant execute on function public.alumno_join_as_tutor(uuid, text) to authenticated;

-- 4. Nueva RPC: editar la propia relacion (no podes editar la de otro tutor)
create or replace function public.alumno_set_mi_relacion(
  p_alumno uuid,
  p_relacion text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_relacion is null or p_relacion not in ('padre','madre','tutor','encargado') then
    raise exception 'relacion invalida (use padre/madre/tutor/encargado)';
  end if;

  update public.alumno_tutores
     set relacion = p_relacion
   where alumno_id = p_alumno
     and profile_id = auth.uid();

  if not found then
    raise exception 'No estas vinculado como tutor de este alumno';
  end if;
end;
$$;

grant execute on function public.alumno_set_mi_relacion(uuid, text) to authenticated;

notify pgrst, 'reload schema';
