-- =========================================================================
-- MaPaPis — Slice 3.6: cierre de inscripcion (manual admin + auto si todos)
-- =========================================================================
-- Cambios:
--   1. necesidades.inscripcion_cerrada_at timestamptz (null = abierta)
--   2. RPC cerrar_inscripcion / reabrir_inscripcion (solo admin/creador del grupo)
--   3. inscribir_alumno: rechaza si cerrada; auto-cierra si todos los alumnos
--      del grupo quedan anotados (modalidad individual)
--   4. desinscribir_alumno: rechaza si cerrada
--   5. Recrear view necesidades_publicas con inscripcion_cerrada_at + total_alumnos
-- =========================================================================

-- 1. Columna de cierre
alter table public.necesidades
  add column if not exists inscripcion_cerrada_at timestamptz;

-- 2. Helper: es admin/creador del grupo
create or replace function public.es_admin_grupo(p_grupo uuid, p_profile uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros
     where grupo_id = p_grupo
       and profile_id = p_profile
       and rol_en_grupo in ('creador','admin')
  );
$$;

grant execute on function public.es_admin_grupo(uuid, uuid) to authenticated;

-- 3. RPC cerrar_inscripcion (manual)
create or replace function public.cerrar_inscripcion(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_grupo uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select grupo_id into v_grupo from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if not public.es_admin_grupo(v_grupo, auth.uid()) then
    raise exception 'Solo admin/creador del grupo puede cerrar inscripciones';
  end if;
  update public.necesidades
     set inscripcion_cerrada_at = coalesce(inscripcion_cerrada_at, now())
   where id = p_necesidad;
end; $$;

grant execute on function public.cerrar_inscripcion(uuid) to authenticated;

-- 4. RPC reabrir_inscripcion
create or replace function public.reabrir_inscripcion(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_grupo uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select grupo_id into v_grupo from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if not public.es_admin_grupo(v_grupo, auth.uid()) then
    raise exception 'Solo admin/creador del grupo puede reabrir inscripciones';
  end if;
  update public.necesidades
     set inscripcion_cerrada_at = null
   where id = p_necesidad;
end; $$;

grant execute on function public.reabrir_inscripcion(uuid) to authenticated;

-- 5. inscribir_alumno: agrega validacion de cierre + auto-close
create or replace function public.inscribir_alumno(p_necesidad uuid, p_alumno uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_modalidad text; v_grupo_id uuid; v_estado text;
  v_alumno_grupo uuid; v_es_tutor boolean;
  v_cerrada timestamptz;
  v_total_alumnos int; v_inscriptos int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select modalidad, grupo_id, estado, inscripcion_cerrada_at
    into v_modalidad, v_grupo_id, v_estado, v_cerrada
    from public.necesidades where id = p_necesidad;
  if v_grupo_id is null then raise exception 'Necesidad no encontrada'; end if;
  if v_modalidad <> 'individual' then
    raise exception 'Solo necesidades individuales aceptan inscripciones';
  end if;
  if v_cerrada is not null then
    raise exception 'Las inscripciones ya estan cerradas';
  end if;
  if v_estado not in ('recibiendo_ofertas','en_votacion') then
    raise exception 'La necesidad ya no acepta inscripciones (estado: %)', v_estado;
  end if;

  select grupo_id into v_alumno_grupo from public.alumnos where id = p_alumno;
  if v_alumno_grupo <> v_grupo_id then
    raise exception 'El alumno no pertenece al grupo de esta necesidad';
  end if;

  select exists (select 1 from public.alumno_tutores
                 where alumno_id = p_alumno and profile_id = auth.uid())
    into v_es_tutor;
  if not v_es_tutor then raise exception 'No sos tutor de este alumno'; end if;

  insert into public.necesidad_inscripciones (necesidad_id, alumno_id, inscripto_por)
  values (p_necesidad, p_alumno, auth.uid())
  on conflict (necesidad_id, alumno_id) do nothing;

  -- Auto-close si quedan todos los alumnos del grupo anotados
  select count(*) into v_total_alumnos
    from public.alumnos where grupo_id = v_grupo_id;
  select count(*) into v_inscriptos
    from public.necesidad_inscripciones where necesidad_id = p_necesidad;

  if v_total_alumnos > 0 and v_inscriptos >= v_total_alumnos then
    update public.necesidades
       set inscripcion_cerrada_at = now()
     where id = p_necesidad and inscripcion_cerrada_at is null;
  end if;
end; $$;

grant execute on function public.inscribir_alumno(uuid, uuid) to authenticated;

-- 6. desinscribir_alumno: rechaza si cerrada
create or replace function public.desinscribir_alumno(p_necesidad uuid, p_alumno uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_cerrada timestamptz;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select inscripcion_cerrada_at into v_cerrada
    from public.necesidades where id = p_necesidad;
  if v_cerrada is not null then
    raise exception 'Las inscripciones ya estan cerradas';
  end if;
  delete from public.necesidad_inscripciones
   where necesidad_id = p_necesidad
     and alumno_id = p_alumno
     and inscripto_por = auth.uid();
end; $$;

grant execute on function public.desinscribir_alumno(uuid, uuid) to authenticated;

-- 7. Recrear view publica
drop view if exists public.necesidades_publicas;
create view public.necesidades_publicas as
select
  n.id,
  n.categoria_id,
  c.slug as categoria_slug,
  c.nombre as categoria_nombre,
  n.titulo,
  n.descripcion,
  n.campos,
  n.foto_url,
  n.link_referencia,
  n.zona,
  n.presupuesto_min_centavos,
  n.presupuesto_max_centavos,
  n.fecha_limite,
  n.fecha_limite_inscripcion,
  n.fecha_limite_entrega,
  n.modalidad,
  n.cantidad_por_alumno,
  n.inscripcion_cerrada_at,
  n.estado,
  n.cap_ofertas,
  n.ofertas_count,
  n.creador_tipo,
  n.created_at,
  (select count(*)::int from public.necesidad_inscripciones i where i.necesidad_id = n.id) as inscriptos_count,
  (select count(*)::int from public.alumnos a where a.grupo_id = n.grupo_id) as total_alumnos
from public.necesidades n
join public.categorias c on c.id = n.categoria_id
where n.estado = 'recibiendo_ofertas';

grant select on public.necesidades_publicas to authenticated, anon;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select column_name from information_schema.columns
--  where table_name = 'necesidades' and column_name = 'inscripcion_cerrada_at';
-- select proname from pg_proc where proname in ('cerrar_inscripcion','reabrir_inscripcion','es_admin_grupo');
