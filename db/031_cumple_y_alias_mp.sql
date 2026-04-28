-- =========================================================================
-- 031_cumple_y_alias_mp.sql — fecha de nacimiento del alumno + alias MP del tutor
-- =========================================================================
-- Dos campos nuevos opcionales:
--
-- 1) alumnos.fecha_nacimiento (date) — para mostrar el calendario de cumples
--    del grupo (mes en curso + primeros 10 dias del mes siguiente).
-- 2) profiles.alias_mp (text) — alias de Mercado Pago del tutor, para que el
--    grupo pueda mandarle la plata del "sobre digital" del cumple sin que
--    MaPaPis sea custodio (ver memoria project_sobre_digital_cumple).
--
-- Ninguno es obligatorio. Existing rows quedan en NULL.
-- =========================================================================

-- 1. Columnas nuevas
alter table public.alumnos
  add column if not exists fecha_nacimiento date;

alter table public.profiles
  add column if not exists alias_mp text;

-- 2. alumno_create_with_tutor extendido con fecha_nacimiento opcional
drop function if exists public.alumno_create_with_tutor(uuid, text, text, text);

create or replace function public.alumno_create_with_tutor(
  p_grupo uuid,
  p_nombre text,
  p_dni text default null,
  p_relacion text default 'tutor',
  p_fecha_nacimiento date default null
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
  -- DNI ahora es obligatorio en alta nueva (privado, solo se usa para deduplicar).
  if v_dni is null then
    raise exception 'El DNI es obligatorio para dar de alta al alumno';
  end if;
  if not public.validar_dni(v_dni) then
    raise exception 'DNI invalido (debe tener 7 u 8 digitos)';
  end if;
  if p_relacion is null or p_relacion not in ('padre','madre','tutor','encargado') then
    raise exception 'relacion invalida (use padre/madre/tutor/encargado)';
  end if;
  -- Fecha de nacimiento obligatoria en alta nueva (calendario de cumples
  -- necesita data completa). Filas existentes con null no se afectan.
  if p_fecha_nacimiento is null then
    raise exception 'La fecha de nacimiento es obligatoria';
  end if;
  if p_fecha_nacimiento < '1990-01-01' or p_fecha_nacimiento > current_date then
    raise exception 'Fecha de nacimiento fuera de rango';
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
      -- Si la fila existente no tiene fecha y nos pasaron una, completar
      if p_fecha_nacimiento is not null then
        update public.alumnos
           set fecha_nacimiento = p_fecha_nacimiento
         where id = v_alumno_id and fecha_nacimiento is null;
      end if;
      return v_alumno_id;
    end if;
  end if;

  insert into public.alumnos (grupo_id, nombre, dni, fecha_nacimiento)
       values (p_grupo, trim(p_nombre), v_dni, p_fecha_nacimiento)
    returning id into v_alumno_id;

  insert into public.alumno_tutores (alumno_id, profile_id, relacion)
       values (v_alumno_id, auth.uid(), p_relacion);

  return v_alumno_id;
end; $$;

grant execute on function public.alumno_create_with_tutor(uuid, text, text, text, date) to authenticated;

-- 3. RPC: setear/cambiar fecha de nacimiento. Cualquier tutor del alumno puede.
create or replace function public.alumno_set_fecha_nacimiento(
  p_alumno uuid,
  p_fecha date
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_fecha is not null
     and (p_fecha < '1990-01-01' or p_fecha > current_date) then
    raise exception 'Fecha de nacimiento fuera de rango';
  end if;

  if not exists (
    select 1 from public.alumno_tutores
     where alumno_id = p_alumno and profile_id = auth.uid()
  ) then
    raise exception 'Solo los tutores pueden editar la fecha del alumno';
  end if;

  update public.alumnos set fecha_nacimiento = p_fecha where id = p_alumno;
end; $$;

grant execute on function public.alumno_set_fecha_nacimiento(uuid, date) to authenticated;

-- 4. Vista: proximos cumpleaños (mes en curso + primeros 10 del mes siguiente)
-- Calcula edad que cumple en este cumple anual y dias restantes.
create or replace view public.proximos_cumples as
with base as (
  select
    a.id as alumno_id,
    a.grupo_id,
    a.nombre,
    a.fecha_nacimiento,
    -- Cumple de este año
    make_date(
      extract(year from current_date)::int,
      extract(month from a.fecha_nacimiento)::int,
      extract(day from a.fecha_nacimiento)::int
    ) as cumple_este_anio
  from public.alumnos a
  where a.fecha_nacimiento is not null
)
select
  alumno_id,
  grupo_id,
  nombre,
  fecha_nacimiento,
  cumple_este_anio as proximo_cumple,
  (cumple_este_anio - current_date) as dias_para_cumple,
  (extract(year from age(cumple_este_anio, fecha_nacimiento))::int) as edad_que_cumple
from base
where
  -- Dentro del mes en curso
  (extract(month from cumple_este_anio) = extract(month from current_date)
   and cumple_este_anio >= current_date)
  -- O en los primeros 10 dias del mes siguiente
  or (extract(month from cumple_este_anio) = extract(month from (current_date + interval '1 month'))
      and extract(day from cumple_este_anio) <= 10);

grant select on public.proximos_cumples to authenticated;

notify pgrst, 'reload schema';
