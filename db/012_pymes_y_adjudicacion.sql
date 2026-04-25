-- =========================================================================
-- MaPaPis — Slice 3.4: pymes onboarding + adjudicacion de oferta ganadora
-- =========================================================================
-- Cambios:
--   1. Tabla pymes (profile_id PK con FK a profiles, nombre_comercial, etc.)
--   2. RPC actualizar_pyme (upsert)
--   3. RPC crear_oferta (security definer; valida perfil pyme + estado)
--   4. RPC adjudicar_oferta (admin del grupo elige ganadora)
-- =========================================================================

-- 1. Tabla pymes
create table if not exists public.pymes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  nombre_comercial text not null check (char_length(nombre_comercial) between 2 and 80),
  descripcion text check (descripcion is null or char_length(descripcion) between 10 and 600),
  telefono text,
  zonas text[] not null default '{}'::text[],
  tier int not null default 0,    -- 0=nueva, 1=verificada, 2=confiable, 3=premium
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pymes enable row level security;

drop policy if exists "pymes_select_all_auth" on public.pymes;
create policy "pymes_select_all_auth" on public.pymes
  for select to authenticated, anon using (true);

drop policy if exists "pymes_insert_self" on public.pymes;
create policy "pymes_insert_self" on public.pymes
  for insert to authenticated
  with check (profile_id = auth.uid() and public.user_role() = 'pyme');

drop policy if exists "pymes_update_self" on public.pymes;
create policy "pymes_update_self" on public.pymes
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select on public.pymes to authenticated, anon;
grant insert, update on public.pymes to authenticated;

drop trigger if exists trg_pymes_updated on public.pymes;
create trigger trg_pymes_updated
  before update on public.pymes
  for each row execute function public.set_updated_at();

-- 2. RPC actualizar_pyme (upsert)
create or replace function public.actualizar_pyme(
  p_nombre text,
  p_descripcion text default null,
  p_telefono text default null,
  p_zonas text[] default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'pyme' then raise exception 'Solo pymes'; end if;
  if p_nombre is null or char_length(trim(p_nombre)) < 2 then
    raise exception 'Nombre comercial requerido';
  end if;
  insert into public.pymes (profile_id, nombre_comercial, descripcion, telefono, zonas)
  values (auth.uid(), trim(p_nombre), nullif(trim(coalesce(p_descripcion,'')), ''),
          nullif(trim(coalesce(p_telefono,'')), ''),
          coalesce(p_zonas, '{}'::text[]))
  on conflict (profile_id) do update
    set nombre_comercial = excluded.nombre_comercial,
        descripcion = excluded.descripcion,
        telefono = excluded.telefono,
        zonas = excluded.zonas,
        updated_at = now();
end; $$;

grant execute on function public.actualizar_pyme(text, text, text, text[]) to authenticated;

-- 3. RPC crear_oferta (valida perfil pyme + estado)
create or replace function public.crear_oferta(
  p_necesidad uuid,
  p_precio_centavos bigint,
  p_tiempo_dias int,
  p_descripcion text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_estado text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'pyme' then raise exception 'Solo pymes pueden ofertar'; end if;
  if not exists (select 1 from public.pymes where profile_id = auth.uid()) then
    raise exception 'Completa tu perfil de pyme antes de ofertar';
  end if;
  select estado into v_estado from public.necesidades where id = p_necesidad;
  if v_estado is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'recibiendo_ofertas' then
    raise exception 'La necesidad ya no acepta ofertas (estado: %)', v_estado;
  end if;

  insert into public.ofertas (necesidad_id, pyme_id, precio_total_centavos, tiempo_entrega_dias, descripcion)
  values (p_necesidad, auth.uid(), p_precio_centavos, p_tiempo_dias, p_descripcion)
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.crear_oferta(uuid, bigint, int, text) to authenticated;

-- 4. RPC adjudicar_oferta (admin/creador del grupo elige ganadora)
create or replace function public.adjudicar_oferta(p_oferta uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_necesidad uuid; v_grupo uuid; v_estado text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select o.necesidad_id, n.grupo_id, n.estado
    into v_necesidad, v_grupo, v_estado
    from public.ofertas o
    join public.necesidades n on n.id = o.necesidad_id
   where o.id = p_oferta;
  if v_necesidad is null then raise exception 'Oferta no encontrada'; end if;
  if not public.es_admin_grupo(v_grupo, auth.uid()) then
    raise exception 'Solo admin/creador del grupo puede adjudicar';
  end if;
  if v_estado not in ('recibiendo_ofertas','en_votacion') then
    raise exception 'La necesidad ya esta en estado % y no se puede adjudicar', v_estado;
  end if;

  update public.ofertas
     set estado = case when id = p_oferta then 'ganadora' else 'descartada' end
   where necesidad_id = v_necesidad
     and estado in ('presentada','ganadora');

  update public.necesidades
     set estado = 'adjudicada', updated_at = now()
   where id = v_necesidad;
end; $$;

grant execute on function public.adjudicar_oferta(uuid) to authenticated;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select * from public.pymes;
-- select proname from pg_proc where proname in ('actualizar_pyme','crear_oferta','adjudicar_oferta');
