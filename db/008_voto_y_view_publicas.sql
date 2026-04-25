-- =========================================================================
-- MaPaPis — Slice 3.2b/c: voto por alumno + view publica con foto
-- =========================================================================
-- Cambios:
--   1. Drop unique (oferta_id, votante_id) en votos_oferta (era demasiado
--      restrictivo: bloquea que un tutor vote por oferta X "en nombre" de
--      cada uno de sus hijos por separado).
--   2. Nuevo unique (oferta_id, votante_id, alumno_id).
--   3. Permiso DELETE para que el frontend pueda revocar voto, + policy.
--   4. RPC vote_oferta(p_alumno, p_oferta): elige una oferta de la necesidad
--      en nombre de un alumno. Reemplaza voto previo del mismo tutor para el
--      mismo alumno+necesidad. Peso = 1.0/n_tutores del alumno.
--   5. RPC unvote_oferta(p_alumno, p_oferta): revoca el voto.
--   6. Recrear view necesidades_publicas con foto_url + campos.
--
-- Ejecutar después de 007.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. votos_oferta: nuevo unique
-- ─────────────────────────────────────────────────────────────────────────

alter table public.votos_oferta
  drop constraint if exists votos_oferta_oferta_id_votante_id_key;

-- En caso de re-correr y quedar el constraint con otro nombre:
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.votos_oferta'::regclass
       and contype = 'u'
       and conname not in ('votos_oferta_unique_tuv')
  loop
    execute format('alter table public.votos_oferta drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.votos_oferta
  add constraint votos_oferta_unique_tuv
  unique (oferta_id, votante_id, alumno_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Permiso DELETE + policy
-- ─────────────────────────────────────────────────────────────────────────

grant delete on public.votos_oferta to authenticated;

drop policy if exists "votos_delete_propio" on public.votos_oferta;
create policy "votos_delete_propio" on public.votos_oferta
  for delete to authenticated
  using (votante_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RPC vote_oferta
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.vote_oferta(p_alumno uuid, p_oferta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_necesidad_id uuid;
  v_grupo_id uuid;
  v_estado text;
  v_es_tutor boolean;
  v_alumno_grupo uuid;
  v_n_tutores int;
  v_peso numeric(3,2);
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select o.necesidad_id, n.grupo_id, n.estado
    into v_necesidad_id, v_grupo_id, v_estado
    from public.ofertas o
    join public.necesidades n on n.id = o.necesidad_id
   where o.id = p_oferta;

  if v_necesidad_id is null then
    raise exception 'Oferta no encontrada';
  end if;

  if v_estado not in ('recibiendo_ofertas', 'en_votacion') then
    raise exception 'La necesidad no está en período de votación (estado: %)', v_estado;
  end if;

  select exists (
    select 1 from public.alumno_tutores
    where alumno_id = p_alumno and profile_id = auth.uid()
  ) into v_es_tutor;
  if not v_es_tutor then
    raise exception 'No sos tutor de este alumno';
  end if;

  select grupo_id into v_alumno_grupo
    from public.alumnos where id = p_alumno;
  if v_alumno_grupo is null or v_alumno_grupo <> v_grupo_id then
    raise exception 'El alumno no pertenece al grupo de esta necesidad';
  end if;

  select count(*) into v_n_tutores
    from public.alumno_tutores where alumno_id = p_alumno;
  v_peso := round(1.0 / greatest(v_n_tutores, 1), 2);

  -- Reemplazar voto previo del mismo tutor para el mismo alumno+necesidad
  delete from public.votos_oferta vo
   using public.ofertas o
   where vo.oferta_id = o.id
     and o.necesidad_id = v_necesidad_id
     and vo.votante_id = auth.uid()
     and vo.alumno_id = p_alumno;

  insert into public.votos_oferta (oferta_id, votante_id, alumno_id, peso)
  values (p_oferta, auth.uid(), p_alumno, v_peso);
end;
$$;

grant execute on function public.vote_oferta(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC unvote_oferta
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.unvote_oferta(p_alumno uuid, p_oferta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from public.votos_oferta
   where oferta_id = p_oferta
     and alumno_id = p_alumno
     and votante_id = auth.uid();
end;
$$;

grant execute on function public.unvote_oferta(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. View necesidades_publicas con foto_url + campos
-- ─────────────────────────────────────────────────────────────────────────

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
  n.zona,
  n.presupuesto_min_centavos,
  n.presupuesto_max_centavos,
  n.fecha_limite,
  n.estado,
  n.cap_ofertas,
  n.ofertas_count,
  n.creador_tipo,
  n.created_at
from public.necesidades n
join public.categorias c on c.id = n.categoria_id
where n.estado = 'recibiendo_ofertas';

grant select on public.necesidades_publicas to authenticated, anon;

-- =========================================================================
-- Verificación
-- =========================================================================
-- select conname from pg_constraint where conrelid = 'public.votos_oferta'::regclass;
-- select * from public.necesidades_publicas limit 1;
