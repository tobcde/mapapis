-- =========================================================================
-- MaPaPis — Slice 3.6: alumnos + tutores + datos de institución
-- =========================================================================
-- El "miembro de grupo" deja de ser la unidad de voto/pago: pasa a ser el alumno.
-- Reglas:
--   - 1 alumno = 1 voto (peso entero 1.0)
--   - Si 1 tutor vota → peso 1.0
--   - Si 2 tutores votan → 0.5 / 0.5 (rebalance automático en RPC)
--   - Padres separados pueden ser ambos tutores del mismo alumno
-- Match por nombre + confirmación (opción 1) + admin merge fallback (opción 3).
--
-- Ejecutar después de 004.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Datos de institución a nivel grupo
-- ─────────────────────────────────────────────────────────────────────────
-- (Slice 3.4 normalizará a tabla `instituciones` separada cuando hagamos el
-- onboarding institucional propio. Por ahora, columnas inline.)

alter table public.grupos
  add column if not exists institucion_nombre text,
  add column if not exists institucion_direccion text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tabla alumnos
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.alumnos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_alumnos_grupo on public.alumnos (grupo_id);
-- Para match case-insensitive
create index if not exists idx_alumnos_grupo_nombre_lower
  on public.alumnos (grupo_id, lower(nombre));

drop trigger if exists trg_alumnos_updated on public.alumnos;
create trigger trg_alumnos_updated
  before update on public.alumnos
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Tabla alumno_tutores (N:M alumno ↔ profile)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.alumno_tutores (
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (alumno_id, profile_id)
);

create index if not exists idx_alumno_tutores_profile
  on public.alumno_tutores (profile_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. votos_oferta: agregar alumno_id + peso (sin enforcement aún)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.votos_oferta
  add column if not exists alumno_id uuid references public.alumnos(id) on delete cascade,
  add column if not exists peso numeric(3,2) not null default 1.0
    check (peso > 0 and peso <= 1);

-- Cuando esté poblado, tendremos: una fila por (alumno, votante_que_decide_por_el_alumno)
-- Y se rebalancea peso al votar el segundo tutor (vía RPC vote_oferta del Slice 3.2).

create index if not exists idx_votos_alumno on public.votos_oferta (alumno_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RLS para alumnos / alumno_tutores
-- ─────────────────────────────────────────────────────────────────────────

alter table public.alumnos enable row level security;
alter table public.alumno_tutores enable row level security;

-- 5.1 alumnos: select para miembros del grupo
drop policy if exists "alumnos_select_miembros" on public.alumnos;
create policy "alumnos_select_miembros" on public.alumnos
  for select to authenticated
  using (public.is_grupo_miembro(grupo_id) or public.user_role() = 'admin');

-- 5.2 alumnos: insert solo via RPC (security definer). Igual permitimos insert
-- a miembros del grupo por si se queda sin RPC.
drop policy if exists "alumnos_insert_miembros" on public.alumnos;
create policy "alumnos_insert_miembros" on public.alumnos
  for insert to authenticated
  with check (public.is_grupo_miembro(grupo_id));

-- 5.3 alumnos: update solo tutores del alumno o admin del grupo
drop policy if exists "alumnos_update_tutor_o_admin" on public.alumnos;
create policy "alumnos_update_tutor_o_admin" on public.alumnos
  for update to authenticated
  using (
    public.is_grupo_admin(grupo_id)
    or exists (
      select 1 from public.alumno_tutores
      where alumno_id = alumnos.id and profile_id = auth.uid()
    )
  );

-- 5.4 alumno_tutores: select para miembros del grupo (vía join a alumnos)
drop policy if exists "tutores_select_miembros" on public.alumno_tutores;
create policy "tutores_select_miembros" on public.alumno_tutores
  for select to authenticated
  using (
    exists (
      select 1 from public.alumnos a
      where a.id = alumno_id
        and (public.is_grupo_miembro(a.grupo_id) or public.user_role() = 'admin')
    )
  );

-- 5.5 alumno_tutores: insert solo a sí mismo (te asociás a un alumno) o vía RPC
drop policy if exists "tutores_insert_self" on public.alumno_tutores;
create policy "tutores_insert_self" on public.alumno_tutores
  for insert to authenticated
  with check (profile_id = auth.uid());

-- 5.6 alumno_tutores: delete solo el propio tutor o admin del grupo
drop policy if exists "tutores_delete_self_o_admin" on public.alumno_tutores;
create policy "tutores_delete_self_o_admin" on public.alumno_tutores
  for delete to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.alumnos a
      where a.id = alumno_id and public.is_grupo_admin(a.grupo_id)
    )
  );

-- Grants
grant select, insert, update on public.alumnos to authenticated;
grant select, insert, delete on public.alumno_tutores to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RPCs
-- ─────────────────────────────────────────────────────────────────────────

-- 6.1 alumno_match_by_name — busca posibles coincidencias en el grupo (case-insensitive)
-- Devuelve los alumnos que comparten nombre (lower) y los profiles_count actuales
-- de tutores. El frontend muestra "Joaquín ya existe (1 tutor: Pedro). ¿Es el mismo?"
create or replace function public.alumno_match_by_name(p_grupo uuid, p_nombre text)
returns table (
  alumno_id uuid,
  nombre text,
  tutores_count int,
  tutores_nombres text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not public.is_grupo_miembro(p_grupo) then
    raise exception 'No sos miembro de este grupo';
  end if;

  return query
  select a.id, a.nombre,
         (select count(*)::int from public.alumno_tutores t where t.alumno_id = a.id),
         (select array_agg(coalesce(p.nombre, split_part(p.email, '@', 1)))
            from public.alumno_tutores t
            join public.profiles p on p.id = t.profile_id
            where t.alumno_id = a.id)
    from public.alumnos a
   where a.grupo_id = p_grupo
     and lower(a.nombre) = lower(trim(p_nombre));
end;
$$;

grant execute on function public.alumno_match_by_name(uuid, text) to authenticated;

-- 6.2 alumno_create_with_tutor — crea alumno y agrega caller como tutor
create or replace function public.alumno_create_with_tutor(p_grupo uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alumno_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not public.is_grupo_miembro(p_grupo) then
    raise exception 'No sos miembro de este grupo';
  end if;
  if char_length(trim(p_nombre)) < 2 then
    raise exception 'Nombre del alumno demasiado corto';
  end if;

  insert into public.alumnos (grupo_id, nombre)
       values (p_grupo, trim(p_nombre))
    returning id into v_alumno_id;

  insert into public.alumno_tutores (alumno_id, profile_id)
       values (v_alumno_id, auth.uid());

  return v_alumno_id;
end;
$$;

grant execute on function public.alumno_create_with_tutor(uuid, text) to authenticated;

-- 6.3 alumno_join_as_tutor — caller se vincula como tutor de un alumno existente
create or replace function public.alumno_join_as_tutor(p_alumno uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_tutores_count int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id into v_grupo_id from public.alumnos where id = p_alumno;
  if v_grupo_id is null then raise exception 'Alumno inexistente'; end if;

  if not public.is_grupo_miembro(v_grupo_id) then
    raise exception 'No sos miembro del grupo del alumno';
  end if;

  -- Cap razonable: 4 tutores por alumno (papá, mamá, padrastro, abuela…)
  select count(*) into v_tutores_count from public.alumno_tutores where alumno_id = p_alumno;
  if v_tutores_count >= 4 then
    raise exception 'Este alumno ya tiene el máximo de tutores (4)';
  end if;

  insert into public.alumno_tutores (alumno_id, profile_id)
       values (p_alumno, auth.uid())
    on conflict do nothing;
end;
$$;

grant execute on function public.alumno_join_as_tutor(uuid) to authenticated;

-- 6.4 alumno_leave_as_tutor — me desvinculo de un alumno (no afecta a otros tutores)
create or replace function public.alumno_leave_as_tutor(p_alumno uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutores_count int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  delete from public.alumno_tutores
   where alumno_id = p_alumno and profile_id = auth.uid();

  -- Si fue el último tutor, borramos el alumno (no quedan huérfanos visibles)
  select count(*) into v_tutores_count from public.alumno_tutores where alumno_id = p_alumno;
  if v_tutores_count = 0 then
    delete from public.alumnos where id = p_alumno;
  end if;
end;
$$;

grant execute on function public.alumno_leave_as_tutor(uuid) to authenticated;

-- 6.5 alumnos_merge — admin/creador fusiona dos alumnos en uno
-- (caso típico: Pedro creó "Joaquín" y María — separados — también creó "Joaquín".
--  El admin del grupo los fusiona y ambos quedan como co-tutores del mismo alumno)
create or replace function public.alumnos_merge(p_alumno_keep uuid, p_alumno_merge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_keep uuid;
  v_grupo_merge uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_alumno_keep = p_alumno_merge then
    raise exception 'No se puede fusionar un alumno consigo mismo';
  end if;

  select grupo_id into v_grupo_keep from public.alumnos where id = p_alumno_keep;
  select grupo_id into v_grupo_merge from public.alumnos where id = p_alumno_merge;

  if v_grupo_keep is null or v_grupo_merge is null then
    raise exception 'Alguno de los alumnos no existe';
  end if;
  if v_grupo_keep <> v_grupo_merge then
    raise exception 'Los alumnos pertenecen a grupos distintos';
  end if;
  if not public.is_grupo_admin(v_grupo_keep) then
    raise exception 'Solo creador o admin puede fusionar alumnos';
  end if;

  -- Mover tutores del alumno_merge al alumno_keep (sin duplicar)
  insert into public.alumno_tutores (alumno_id, profile_id)
       select p_alumno_keep, t.profile_id
         from public.alumno_tutores t
        where t.alumno_id = p_alumno_merge
   on conflict do nothing;

  -- Mover votos (si los hay)
  update public.votos_oferta
     set alumno_id = p_alumno_keep
   where alumno_id = p_alumno_merge;

  -- Eliminar el alumno fusionado (cascade limpia tutores viejos)
  delete from public.alumnos where id = p_alumno_merge;
end;
$$;

grant execute on function public.alumnos_merge(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. View helper: mis_alumnos_en_grupo (frontend lo usa para saber por quién voto)
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.mis_alumnos as
select
  a.id          as alumno_id,
  a.nombre      as alumno_nombre,
  a.grupo_id,
  g.nombre      as grupo_nombre
from public.alumnos a
join public.alumno_tutores t on t.alumno_id = a.id
join public.grupos g on g.id = a.grupo_id
where t.profile_id = auth.uid();

grant select on public.mis_alumnos to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Verificación
-- ─────────────────────────────────────────────────────────────────────────
--
-- select * from public.alumnos;
-- select * from public.alumno_tutores;
-- select * from public.mis_alumnos;
-- =========================================================================
