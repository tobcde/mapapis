-- =========================================================================
-- MaPaPis — Sprint 1 #2: pago externo + tracking de pagos por tutor
-- =========================================================================
-- Mientras no enchufemos Mercado Pago (Slice 4), el flujo de pago entre
-- la pyme adjudicada y las familias se coordina off-platform (transferencia,
-- efectivo, etc.). Esta migracion:
--   1. Tabla necesidad_pagos (1 fila por (familia, alumno)) para trackear
--      quien ya pago, sin manejar plata real.
--   2. RPCs registrar_pago / eliminar_pago.
--   3. View necesidad_pagos_resumen para dashboards rapidos.
-- =========================================================================

-- 1. Tabla
create table if not exists public.necesidad_pagos (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,  -- quien paga (tutor)
  alumno_id uuid references public.alumnos(id) on delete cascade,             -- en individual; null en grupal
  monto_centavos bigint,
  notas text,
  pagado_at timestamptz default now(),
  marcado_por uuid not null references public.profiles(id) on delete cascade  -- self o admin
);

-- Unicidad: en individual, una fila por (necesidad, alumno).
-- En grupal (alumno_id null), una fila por (necesidad, familia).
create unique index if not exists necesidad_pagos_individual_uq
  on public.necesidad_pagos (necesidad_id, alumno_id)
  where alumno_id is not null;

create unique index if not exists necesidad_pagos_grupal_uq
  on public.necesidad_pagos (necesidad_id, profile_id)
  where alumno_id is null;

create index if not exists necesidad_pagos_necesidad
  on public.necesidad_pagos (necesidad_id);

alter table public.necesidad_pagos enable row level security;

-- Lectura: cualquier autenticado del grupo puede ver los pagos de necesidades del grupo
drop policy if exists "pagos_select_grupo" on public.necesidad_pagos;
create policy "pagos_select_grupo" on public.necesidad_pagos
  for select to authenticated
  using (exists (
    select 1 from public.necesidades n
    join public.grupo_miembros gm on gm.grupo_id = n.grupo_id
   where n.id = necesidad_pagos.necesidad_id
     and gm.profile_id = auth.uid()
  )
  -- O la pyme ganadora puede ver
  or exists (
    select 1 from public.ofertas o
    where o.necesidad_id = necesidad_pagos.necesidad_id
      and o.estado = 'ganadora'
      and o.pyme_id = auth.uid()
  ));

grant select, insert, delete on public.necesidad_pagos to authenticated;

-- 2. RPC registrar_pago (upsert manual para soportar indices parciales)
create or replace function public.registrar_pago(
  p_necesidad uuid,
  p_alumno uuid default null,
  p_monto_centavos bigint default null,
  p_notas text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_modalidad text;
  v_estado text;
  v_es_admin boolean;
  v_es_tutor_alumno boolean;
  v_profile_pagante uuid := auth.uid();
  v_alumno_grupo uuid;
  v_existing_id uuid;
  v_id uuid;
  v_notas_clean text := nullif(trim(coalesce(p_notas,'')),'');
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, modalidad, estado
    into v_grupo, v_modalidad, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado not in ('adjudicada','en_curso') then
    raise exception 'Solo se puede registrar pago en necesidades adjudicadas (actual: %)', v_estado;
  end if;

  v_es_admin := public.es_admin_grupo(v_grupo, auth.uid());

  if v_modalidad = 'individual' then
    if p_alumno is null then raise exception 'En modalidad individual hay que indicar alumno'; end if;
    select grupo_id into v_alumno_grupo from public.alumnos where id = p_alumno;
    if v_alumno_grupo is null then raise exception 'Alumno no encontrado'; end if;
    if v_alumno_grupo <> v_grupo then raise exception 'Alumno no pertenece al grupo de la necesidad'; end if;
    select exists(select 1 from public.alumno_tutores at
                   where at.alumno_id = p_alumno and at.profile_id = auth.uid())
      into v_es_tutor_alumno;
    if not (v_es_tutor_alumno or v_es_admin) then
      raise exception 'Solo un tutor del alumno o admin del grupo pueden registrar el pago';
    end if;
    if not v_es_tutor_alumno then
      select profile_id into v_profile_pagante
        from public.alumno_tutores
       where alumno_id = p_alumno
       order by created_at asc nulls last
       limit 1;
    end if;

    -- buscar fila existente (por alumno_id en individual)
    select id into v_existing_id from public.necesidad_pagos
     where necesidad_id = p_necesidad and alumno_id = p_alumno;
  else
    -- grupal: ignoramos p_alumno
    p_alumno := null;
    if not (exists(select 1 from public.grupo_miembros gm
                    where gm.grupo_id = v_grupo and gm.profile_id = auth.uid())
            or v_es_admin) then
      raise exception 'No sos miembro del grupo';
    end if;
    select id into v_existing_id from public.necesidad_pagos
     where necesidad_id = p_necesidad
       and profile_id = v_profile_pagante
       and alumno_id is null;
  end if;

  if v_existing_id is not null then
    update public.necesidad_pagos
       set monto_centavos = coalesce(p_monto_centavos, monto_centavos),
           notas = coalesce(v_notas_clean, notas),
           pagado_at = now(),
           marcado_por = auth.uid()
     where id = v_existing_id;
    return v_existing_id;
  end if;

  insert into public.necesidad_pagos (
    necesidad_id, profile_id, alumno_id, monto_centavos, notas, marcado_por
  ) values (
    p_necesidad, v_profile_pagante, p_alumno, p_monto_centavos, v_notas_clean, auth.uid()
  ) returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.registrar_pago(uuid, uuid, bigint, text) to authenticated;

-- 3. RPC eliminar_pago (undo)
create or replace function public.eliminar_pago(
  p_necesidad uuid,
  p_alumno uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_es_admin boolean;
  v_pago record;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select grupo_id into v_grupo from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;

  v_es_admin := public.es_admin_grupo(v_grupo, auth.uid());

  if p_alumno is null then
    select * into v_pago from public.necesidad_pagos
     where necesidad_id = p_necesidad
       and profile_id = auth.uid()
       and alumno_id is null;
  else
    select * into v_pago from public.necesidad_pagos
     where necesidad_id = p_necesidad
       and alumno_id = p_alumno;
  end if;

  if v_pago.id is null then return; end if;

  if not (v_pago.marcado_por = auth.uid() or v_es_admin) then
    raise exception 'Solo quien marco el pago o admin del grupo pueden eliminarlo';
  end if;

  delete from public.necesidad_pagos where id = v_pago.id;
end; $$;

grant execute on function public.eliminar_pago(uuid, uuid) to authenticated;

-- 4. View resumen
drop view if exists public.necesidad_pagos_resumen;
create view public.necesidad_pagos_resumen as
select
  n.id as necesidad_id,
  n.modalidad,
  case
    when n.modalidad = 'individual' then (select count(*)::int from public.necesidad_pagos p where p.necesidad_id = n.id and p.alumno_id is not null)
    else (select count(*)::int from public.necesidad_pagos p where p.necesidad_id = n.id and p.alumno_id is null)
  end as pagos_count,
  case
    when n.modalidad = 'individual' then (select count(*)::int from public.necesidad_inscripciones i where i.necesidad_id = n.id)
    else (select count(distinct gm.profile_id)::int from public.grupo_miembros gm where gm.grupo_id = n.grupo_id)
  end as total_esperados,
  coalesce((select sum(monto_centavos) from public.necesidad_pagos p where p.necesidad_id = n.id), 0) as total_pagado_centavos
from public.necesidades n;

grant select on public.necesidad_pagos_resumen to authenticated;

-- 5. RPC contacto_pyme_ganadora: expone CBU/alias/telefono/web/IG solo a miembros del grupo
--    una vez la necesidad esta adjudicada/en_curso/cumplida.
create or replace function public.contacto_pyme_ganadora(p_necesidad uuid)
returns table(
  pyme_id uuid,
  nombre_comercial text,
  telefono text,
  cbu text,
  alias_cbu text,
  web_url text,
  instagram text,
  facebook text
)
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_pyme uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, estado into v_grupo, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado not in ('adjudicada','en_curso','cumplida') then
    return; -- antes de adjudicar nadie ve datos sensibles
  end if;

  if not exists (
    select 1 from public.grupo_miembros gm
     where gm.grupo_id = v_grupo and gm.profile_id = auth.uid()
  ) then
    raise exception 'Solo miembros del grupo pueden ver el contacto';
  end if;

  select o.pyme_id into v_pyme
    from public.ofertas o
   where o.necesidad_id = p_necesidad and o.estado = 'ganadora'
   limit 1;
  if v_pyme is null then return; end if;

  return query
  select p.profile_id, p.nombre_comercial, p.telefono, p.cbu, p.alias_cbu,
         p.web_url, p.instagram, p.facebook
    from public.pymes p where p.profile_id = v_pyme;
end; $$;

grant execute on function public.contacto_pyme_ganadora(uuid) to authenticated;

-- 6. RPC contacto_admin_grupo: expone email/telefono del admin/creador a la pyme ganadora
create or replace function public.contacto_admin_grupo(p_necesidad uuid)
returns table(
  profile_id uuid,
  nombre text,
  email text,
  telefono text
)
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_pyme_ganadora uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, estado into v_grupo, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado not in ('adjudicada','en_curso','cumplida') then return; end if;

  select pyme_id into v_pyme_ganadora
    from public.ofertas
   where necesidad_id = p_necesidad and estado = 'ganadora'
   limit 1;
  if v_pyme_ganadora is null then return; end if;
  if v_pyme_ganadora <> auth.uid() then
    raise exception 'Solo la pyme ganadora puede ver el contacto del admin';
  end if;

  return query
  select pr.id, pr.nombre, pr.email, pr.telefono
    from public.grupo_miembros gm
    join public.profiles pr on pr.id = gm.profile_id
   where gm.grupo_id = v_grupo
     and gm.rol_en_grupo in ('creador','admin')
   order by case gm.rol_en_grupo when 'creador' then 0 else 1 end
   limit 3;
end; $$;

grant execute on function public.contacto_admin_grupo(uuid) to authenticated;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select proname from pg_proc where proname in ('registrar_pago','eliminar_pago','contacto_pyme_ganadora','contacto_admin_grupo');
-- select * from public.necesidad_pagos_resumen where necesidad_id = '<uuid>';
