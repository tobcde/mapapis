-- =========================================================================
-- MaPaPis — Sprint 1 #3: DNI como clave de match de alumno (oculto en UI)
-- =========================================================================
-- Decision de producto: cuando un tutor carga un alumno, ingresa nombre+DNI.
-- El DNI nunca se muestra en la app. Lo usamos solo como clave para matchear
-- al mismo chico cuando otro tutor (papa separado, abuela, etc) lo registra
-- desde su cuenta — aunque escriba el nombre con typos. Asi se evita
-- duplicar y los tutores comparten el peso del voto sobre ese alumno.
--
-- Cambios:
--   1. Columna alumnos.dni (text, normalizado a digitos).
--   2. Helpers validar_dni() y normalizar_dni().
--   3. Indice unico parcial (grupo_id, dni) WHERE dni IS NOT NULL.
--   4. RPC alumno_match_by_dni — primary match para nuevos tutores.
--   5. Reemplazo de alumno_create_with_tutor: acepta dni opcional;
--      si ya existe en el grupo, vincula al caller como co-tutor en vez de
--      crear duplicado (atomico, 1 round trip).
-- =========================================================================

-- 1. Columna
alter table public.alumnos
  add column if not exists dni text;

-- 2. Helpers
create or replace function public.normalizar_dni(p_dni text)
returns text
language sql immutable as $$
  select nullif(regexp_replace(coalesce(p_dni,''), '[^0-9]', '', 'g'), '');
$$;

create or replace function public.validar_dni(p_dni text)
returns boolean
language sql immutable as $$
  -- 7 u 8 digitos. Normalizamos primero.
  select coalesce(length(public.normalizar_dni(p_dni)) between 7 and 8, false);
$$;

-- 3. Indice unico parcial: un mismo DNI no puede estar 2 veces en el mismo grupo.
create unique index if not exists alumnos_grupo_dni_uq
  on public.alumnos (grupo_id, dni)
  where dni is not null;

-- 4. RPC alumno_match_by_dni
-- Devuelve el alumno_id (si lo hay) + nombre y cuantos tutores tiene.
-- NUNCA devuelve el DNI mismo. El FE lo usa para preguntar "encontramos a
-- Mateo Perez, sos co-tutor?".
create or replace function public.alumno_match_by_dni(p_grupo uuid, p_dni text)
returns table (
  alumno_id uuid,
  nombre text,
  tutores_count int,
  tutores_nombres text[],
  ya_soy_tutor boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_dni text := public.normalizar_dni(p_dni);
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not public.is_grupo_miembro(p_grupo) then
    raise exception 'No sos miembro de este grupo';
  end if;
  if v_dni is null then return; end if;

  return query
  select a.id, a.nombre,
         (select count(*)::int from public.alumno_tutores t where t.alumno_id = a.id),
         (select array_agg(coalesce(p.nombre, split_part(p.email, '@', 1)))
            from public.alumno_tutores t
            join public.profiles p on p.id = t.profile_id
           where t.alumno_id = a.id),
         exists(select 1 from public.alumno_tutores t
                 where t.alumno_id = a.id and t.profile_id = auth.uid())
    from public.alumnos a
   where a.grupo_id = p_grupo
     and a.dni = v_dni;
end; $$;

grant execute on function public.alumno_match_by_dni(uuid, text) to authenticated;

-- 5. alumno_create_with_tutor extendido con DNI opcional
-- Si dni esta cargado y ya existe en el grupo, en vez de crear duplicado
-- vincula al caller como co-tutor (atomico). Si no, crea normal.
drop function if exists public.alumno_create_with_tutor(uuid, text);
create or replace function public.alumno_create_with_tutor(
  p_grupo uuid,
  p_nombre text,
  p_dni text default null
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

  -- Si hay DNI y ya existe en el grupo, vincular en vez de duplicar.
  if v_dni is not null then
    select id into v_alumno_id
      from public.alumnos
     where grupo_id = p_grupo and dni = v_dni
     limit 1;
    if v_alumno_id is not null then
      insert into public.alumno_tutores (alumno_id, profile_id)
           values (v_alumno_id, auth.uid())
      on conflict do nothing;
      return v_alumno_id;
    end if;
  end if;

  insert into public.alumnos (grupo_id, nombre, dni)
       values (p_grupo, trim(p_nombre), v_dni)
    returning id into v_alumno_id;

  insert into public.alumno_tutores (alumno_id, profile_id)
       values (v_alumno_id, auth.uid());

  return v_alumno_id;
end; $$;

grant execute on function public.alumno_create_with_tutor(uuid, text, text) to authenticated;

-- =========================================================================
-- IMPORTANTE: el DNI no se expone en ninguna view ni RPC publica.
-- Si en el futuro hace falta exponerlo (ej. integraciones oficiales),
-- evaluar caso por caso (datos sensibles de menor — Ley 25.326).
-- =========================================================================
-- Verificacion:
-- select public.validar_dni('45.123.456');  -- true
-- select public.validar_dni('123');         -- false
-- select public.normalizar_dni('45.123.456'); -- '45123456'
