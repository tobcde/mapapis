-- =========================================================================
-- MaPaPis — Slice 3.6b: RPC crear_grupo (security definer)
-- =========================================================================
-- Motivo:
--   sb.from("grupos").insert(...).select().single() devuelve [] porque
--   la policy SELECT depende de is_grupo_miembro(), y el trigger
--   add_creador_as_miembro corre AFTER INSERT pero el SELECT implícito
--   de PostgREST no siempre ve la fila recién insertada para el caller.
--   Lo resolvemos con un RPC security definer que devuelve la fila.
--
-- Ejecutar después de 005_alumnos_tutores_institucion.sql
-- =========================================================================

drop function if exists public.crear_grupo(text, text, text, text, text, text);

create or replace function public.crear_grupo(
  p_nombre text,
  p_zona text,
  p_tipo text,
  p_rango text,
  p_inst_nombre text default null,
  p_inst_direccion text default null
)
returns setof public.grupos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role not in ('familia', 'institucion') then
    raise exception 'Solo familias o instituciones pueden crear grupos';
  end if;

  if length(coalesce(p_nombre, '')) < 3 then
    raise exception 'Nombre demasiado corto';
  end if;

  insert into public.grupos (
    nombre, zona, tipo, rango_familias,
    institucion_nombre, institucion_direccion, creado_por
  ) values (
    p_nombre, p_zona, p_tipo, p_rango,
    nullif(p_inst_nombre, ''), nullif(p_inst_direccion, ''), v_uid
  )
  returning grupos.id into v_id;

  return query
    select g.* from public.grupos g where g.id = v_id;
end;
$$;

grant execute on function public.crear_grupo(text, text, text, text, text, text) to authenticated;
