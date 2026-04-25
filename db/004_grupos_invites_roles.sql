-- =========================================================================
-- MaPaPis — Slice 3.5: invites por link + roles dentro de grupo
-- =========================================================================
-- Cambios:
--   1. Agrega invite_code random a cada grupo (link compartible WhatsApp)
--   2. Roles dentro del grupo: 'creador' | 'admin' | 'miembro' (reemplaza valores viejos)
--   3. RPCs (security definer):
--        - join_grupo_by_code(code)        → auto-join, idempotente
--        - promote_to_admin(grupo, target) → solo creador
--        - demote_admin(grupo, target)     → solo creador
--        - kick_miembro(grupo, target)     → creador o admin (no kick a creador)
--        - leave_grupo(grupo)              → cualquier miembro (creador no puede)
--   4. View grupos_por_invite (acceso público anónimo solo a id+nombre+zona)
--      para que el landing /?join=CODE muestre "te están invitando a Sala Amarilla"
--   5. Trigger: al insertar grupo, agrega al creador como rol='creador' en
--      grupo_miembros automaticamente
--
-- Ejecutar después de 003_marketplace.sql.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Nuevas columnas en grupos
-- ─────────────────────────────────────────────────────────────────────────

-- Generador de código corto (8 chars, base36)
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

alter table public.grupos
  add column if not exists invite_code text;

-- Llenar invite_code para grupos existentes
update public.grupos
   set invite_code = public.gen_invite_code()
 where invite_code is null;

-- Después de llenar, hacerlo NOT NULL + UNIQUE
alter table public.grupos
  alter column invite_code set not null;

create unique index if not exists idx_grupos_invite_code on public.grupos (invite_code);

-- Default para futuros inserts
alter table public.grupos
  alter column invite_code set default public.gen_invite_code();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Renombrar / extender enum de rol_en_grupo
-- ─────────────────────────────────────────────────────────────────────────

-- Migrar valores viejos a la nueva nomenclatura
update public.grupo_miembros set rol_en_grupo = 'miembro'
  where rol_en_grupo not in ('creador', 'admin', 'miembro');

-- Default para nuevos miembros
alter table public.grupo_miembros
  alter column rol_en_grupo set default 'miembro';

-- Constraint
alter table public.grupo_miembros
  drop constraint if exists grupo_miembros_rol_check;

alter table public.grupo_miembros
  add constraint grupo_miembros_rol_check
  check (rol_en_grupo in ('creador', 'admin', 'miembro'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Trigger: al crear grupo, agregar creador como miembro rol='creador'
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.add_creador_as_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.grupo_miembros (grupo_id, profile_id, rol_en_grupo)
  values (new.id, new.creado_por, 'creador')
  on conflict (grupo_id, profile_id) do update
    set rol_en_grupo = 'creador';
  return new;
end;
$$;

drop trigger if exists trg_add_creador_as_miembro on public.grupos;
create trigger trg_add_creador_as_miembro
  after insert on public.grupos
  for each row execute function public.add_creador_as_miembro();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. View pública para landing del invite link
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.grupos_por_invite as
select
  g.id,
  g.nombre,
  g.zona,
  g.tipo,
  g.invite_code,
  (select count(*) from public.grupo_miembros gm where gm.grupo_id = g.id) as miembros_count
from public.grupos g;

grant select on public.grupos_por_invite to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPCs (security definer, atomicas, controladas)
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 join_grupo_by_code — usuario logueado se une por código
create or replace function public.join_grupo_by_code(p_code text)
returns table (grupo_id uuid, nombre text, ya_era_miembro boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo public.grupos%rowtype;
  v_existe boolean;
begin
  if auth.uid() is null then
    raise exception 'Necesitás estar logueado para sumarte a un grupo';
  end if;

  select * into v_grupo from public.grupos where invite_code = upper(p_code);
  if not found then
    raise exception 'Código de invitación inválido';
  end if;

  select exists (
    select 1 from public.grupo_miembros
    where grupo_miembros.grupo_id = v_grupo.id and profile_id = auth.uid()
  ) into v_existe;

  if not v_existe then
    insert into public.grupo_miembros (grupo_id, profile_id, rol_en_grupo)
    values (v_grupo.id, auth.uid(), 'miembro');
  end if;

  return query select v_grupo.id, v_grupo.nombre, v_existe;
end;
$$;

grant execute on function public.join_grupo_by_code(text) to authenticated;

-- 5.2 promote_to_admin — solo creador
create or replace function public.promote_to_admin(p_grupo uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_rol text;
  v_target_rol text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select rol_en_grupo into v_caller_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();

  if v_caller_rol is null or v_caller_rol <> 'creador' then
    raise exception 'Solo el creador del grupo puede promover admins';
  end if;

  select rol_en_grupo into v_target_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = p_target;

  if v_target_rol is null then
    raise exception 'El usuario no es miembro del grupo';
  end if;

  if v_target_rol = 'creador' then
    raise exception 'No se puede modificar al creador';
  end if;

  update public.grupo_miembros
     set rol_en_grupo = 'admin'
   where grupo_id = p_grupo and profile_id = p_target;
end;
$$;

grant execute on function public.promote_to_admin(uuid, uuid) to authenticated;

-- 5.3 demote_admin — solo creador
create or replace function public.demote_admin(p_grupo uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_rol text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select rol_en_grupo into v_caller_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();

  if v_caller_rol <> 'creador' then
    raise exception 'Solo el creador puede degradar admins';
  end if;

  update public.grupo_miembros
     set rol_en_grupo = 'miembro'
   where grupo_id = p_grupo and profile_id = p_target and rol_en_grupo = 'admin';
end;
$$;

grant execute on function public.demote_admin(uuid, uuid) to authenticated;

-- 5.4 kick_miembro — creador o admin (no se puede kickear al creador)
create or replace function public.kick_miembro(p_grupo uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_rol text;
  v_target_rol text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  if auth.uid() = p_target then
    raise exception 'Para irte del grupo usá leave_grupo()';
  end if;

  select rol_en_grupo into v_caller_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();

  if v_caller_rol not in ('creador', 'admin') then
    raise exception 'Solo creador o admin pueden eliminar miembros';
  end if;

  select rol_en_grupo into v_target_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = p_target;

  if v_target_rol = 'creador' then
    raise exception 'No se puede eliminar al creador';
  end if;

  -- Admin no puede kickear a otro admin (solo creador)
  if v_caller_rol = 'admin' and v_target_rol = 'admin' then
    raise exception 'Solo el creador puede eliminar a otro admin';
  end if;

  delete from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = p_target;
end;
$$;

grant execute on function public.kick_miembro(uuid, uuid) to authenticated;

-- 5.5 leave_grupo — cualquier miembro NO creador
create or replace function public.leave_grupo(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select rol_en_grupo into v_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();

  if v_rol = 'creador' then
    raise exception 'El creador no puede salir del grupo (transferí la titularidad o eliminá el grupo)';
  end if;

  delete from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();
end;
$$;

grant execute on function public.leave_grupo(uuid) to authenticated;

-- 5.6 regenerate_invite_code — solo creador (por si el link se filtró)
create or replace function public.regenerate_invite_code(p_grupo uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_rol text;
  v_new_code text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select rol_en_grupo into v_caller_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();

  if v_caller_rol <> 'creador' then
    raise exception 'Solo el creador puede regenerar el link';
  end if;

  v_new_code := public.gen_invite_code();
  update public.grupos set invite_code = v_new_code where id = p_grupo;
  return v_new_code;
end;
$$;

grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Helper: ¿soy admin (o creador) del grupo?
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.is_grupo_admin(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros
    where grupo_id = p_grupo
      and profile_id = auth.uid()
      and rol_en_grupo in ('creador', 'admin')
  );
$$;

grant execute on function public.is_grupo_admin(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Actualizar RLS de necesidades: solo admins pueden insertar
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "necesidades_insert_familia_o_inst" on public.necesidades;
create policy "necesidades_insert_admins_grupo" on public.necesidades
  for insert to authenticated
  with check (
    creador_id = auth.uid()
    and public.user_role() in ('familia', 'institucion')
    and public.is_grupo_admin(grupo_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Verificación
-- ─────────────────────────────────────────────────────────────────────────
--
-- select id, nombre, invite_code from public.grupos limit 5;
-- select * from public.grupos_por_invite limit 5;
-- select rol_en_grupo, count(*) from public.grupo_miembros group by 1;
-- =========================================================================
