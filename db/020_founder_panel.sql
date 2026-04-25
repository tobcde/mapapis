-- =========================================================================
-- MaPaPis — Sprint 2 #5: Founder panel (admin interno)
-- =========================================================================
-- Pantalla solo accesible para profiles.role = 'admin'. Permite:
--   - Ver pymes registradas con datos clave (tier, ofertas, rating)
--   - Promover/degradar tier manualmente (hasta automatizar AFIP)
--   - Suspender / reactivar pymes
--   - Ver necesidades con su estado para detectar trabas
--   - Stats globales (pymes, grupos, alumnos, necesidades activas)
--
-- Modelo de seguridad: todos los RPCs admin son SECURITY DEFINER y empiezan
-- con `if user_role() <> 'admin' then raise`. La tabla pymes ya tiene RLS
-- pero los RPCs no consultan RLS, asi que la unica defensa es el check de rol.
-- =========================================================================

-- 1. Estado operativo de la pyme (separado de tier, que es nivel de confianza)
alter table public.pymes
  add column if not exists estado text not null default 'activa'
    check (estado in ('activa', 'suspendida', 'pendiente_revision')),
  add column if not exists motivo_estado text,
  add column if not exists estado_actualizado_at timestamptz;

-- 2. Trigger: auto-poner estado_actualizado_at cuando cambia estado
create or replace function public.set_pyme_estado_at()
returns trigger language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    new.estado_actualizado_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_pyme_estado_at on public.pymes;
create trigger trg_pyme_estado_at
  before update on public.pymes
  for each row execute function public.set_pyme_estado_at();

-- 3. RPC: cambiar tier
create or replace function public.admin_set_pyme_tier(p_profile uuid, p_tier int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'admin' then raise exception 'Solo admin'; end if;
  if p_tier < 0 or p_tier > 3 then raise exception 'tier debe estar entre 0 y 3'; end if;

  update public.pymes
     set tier = p_tier,
         verificada_at = case when p_tier >= 1 and verificada_at is null then now() else verificada_at end,
         updated_at = now()
   where profile_id = p_profile;

  if not found then raise exception 'Pyme no encontrada'; end if;
end $$;

grant execute on function public.admin_set_pyme_tier(uuid, int) to authenticated;

-- 4. RPC: cambiar estado operativo
create or replace function public.admin_set_pyme_estado(
  p_profile uuid,
  p_estado text,
  p_motivo text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'admin' then raise exception 'Solo admin'; end if;
  if p_estado not in ('activa','suspendida','pendiente_revision') then
    raise exception 'estado invalido';
  end if;

  update public.pymes
     set estado = p_estado,
         motivo_estado = nullif(trim(coalesce(p_motivo,'')), ''),
         updated_at = now()
   where profile_id = p_profile;

  if not found then raise exception 'Pyme no encontrada'; end if;
end $$;

grant execute on function public.admin_set_pyme_estado(uuid, text, text) to authenticated;

-- 5. RPC stats globales
create or replace function public.admin_stats()
returns table (
  total_pymes int,
  pymes_tier_0 int,
  pymes_tier_1plus int,
  pymes_suspendidas int,
  total_grupos int,
  total_alumnos int,
  total_profiles int,
  necesidades_activas int,
  necesidades_recibiendo_ofertas int,
  necesidades_en_votacion int,
  necesidades_cumplidas int,
  total_ofertas int,
  total_reviews int
) language plpgsql security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then raise exception 'Solo admin'; end if;
  return query
  select
    (select count(*)::int from public.pymes),
    (select count(*)::int from public.pymes where tier = 0),
    (select count(*)::int from public.pymes where tier >= 1),
    (select count(*)::int from public.pymes where estado = 'suspendida'),
    (select count(*)::int from public.grupos),
    (select count(*)::int from public.alumnos),
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.necesidades where estado not in ('cumplida','cancelada')),
    (select count(*)::int from public.necesidades where estado = 'recibiendo_ofertas'),
    (select count(*)::int from public.necesidades where estado = 'en_votacion'),
    (select count(*)::int from public.necesidades where estado = 'cumplida'),
    (select count(*)::int from public.ofertas),
    (select count(*)::int from public.reviews_pyme);
end $$;

grant execute on function public.admin_stats() to authenticated;

-- 6. RPC lista de pymes con datos enriquecidos
create or replace function public.admin_pymes_lista()
returns table (
  profile_id uuid,
  email text,
  nombre_titular text,
  nombre_comercial text,
  cuit text,
  tier int,
  estado text,
  motivo_estado text,
  zonas text[],
  web_url text,
  instagram text,
  facebook text,
  telefono text,
  anios_rubro int,
  ofertas_total int,
  ofertas_ganadas int,
  rating_promedio numeric,
  rating_count int,
  created_at timestamptz
) language plpgsql security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then raise exception 'Solo admin'; end if;
  return query
  select
    p.profile_id,
    pr.email,
    pr.nombre,
    p.nombre_comercial,
    p.cuit,
    p.tier,
    p.estado,
    p.motivo_estado,
    p.zonas,
    p.web_url,
    p.instagram,
    p.facebook,
    p.telefono,
    p.anios_rubro,
    coalesce((select count(*)::int from public.ofertas o where o.pyme_id = p.profile_id), 0),
    coalesce((select count(*)::int from public.ofertas o where o.pyme_id = p.profile_id and o.estado = 'ganadora'), 0),
    (select round(avg(estrellas)::numeric, 2) from public.reviews_pyme r where r.pyme_id = p.profile_id),
    coalesce((select count(*)::int from public.reviews_pyme r where r.pyme_id = p.profile_id), 0),
    p.created_at
  from public.pymes p
  join public.profiles pr on pr.id = p.profile_id
  order by p.created_at desc;
end $$;

grant execute on function public.admin_pymes_lista() to authenticated;

-- 7. RPC lista de necesidades para detectar trabas
create or replace function public.admin_necesidades_lista()
returns table (
  id uuid,
  titulo text,
  estado text,
  zona text,
  grupo_nombre text,
  ofertas_count int,
  dias_desde_creacion int,
  fecha_limite date,
  creador_email text,
  modalidad text,
  created_at timestamptz
) language plpgsql security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then raise exception 'Solo admin'; end if;
  return query
  select
    n.id,
    n.titulo,
    n.estado,
    n.zona,
    g.nombre,
    n.ofertas_count,
    extract(day from now() - n.created_at)::int,
    n.fecha_limite,
    pr.email,
    n.modalidad,
    n.created_at
  from public.necesidades n
  left join public.grupos g on g.id = n.grupo_id
  left join public.profiles pr on pr.id = n.creador_id
  order by n.created_at desc
  limit 200;
end $$;

grant execute on function public.admin_necesidades_lista() to authenticated;

-- 8. RPC: cambiar role de un profile (para promover founders a admin)
-- IMPORTANTE: el primer admin se setea a mano via SQL Editor:
--   update profiles set role='admin' where email='vos@example.com';
-- Despues podes promover otros desde el panel.
create or replace function public.admin_set_profile_role(p_profile uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'admin' then raise exception 'Solo admin'; end if;
  if p_role not in ('familia','pyme','admin','institucion','personal_institucion') then
    raise exception 'role invalido';
  end if;
  if p_profile = auth.uid() and p_role <> 'admin' then
    raise exception 'No te puedas degradar a vos mismo';
  end if;

  update public.profiles set role = p_role where id = p_profile;
  if not found then raise exception 'Profile no encontrado'; end if;
end $$;

grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;
