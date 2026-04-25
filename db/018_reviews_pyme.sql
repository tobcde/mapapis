-- =========================================================================
-- MaPaPis — Sprint 1 #4: Reviews basicas de pyme post-cumplida
-- =========================================================================
-- Decision de producto: arrancamos con review minima (1-5 estrellas + comentario
-- corto opcional). Una review por (necesidad, autor). Solo se puede crear
-- cuando la necesidad esta 'cumplida' y el caller es miembro del grupo.
-- Visibilidad: cualquier authenticated puede ver reviews — se usan para que
-- familias/instituciones evaluen reputacion de pymes antes de adjudicar.
-- Spec multi-dim (calidad/puntualidad/comunicacion/precio) queda para mas
-- adelante (spec-pymes-ratings.md).
-- =========================================================================

-- 1. Tabla
create table if not exists public.reviews_pyme (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  pyme_id uuid not null references public.profiles(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  estrellas int not null check (estrellas between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) between 0 and 500),
  created_at timestamptz default now(),
  unique (necesidad_id, autor_id)
);

create index if not exists idx_reviews_pyme on public.reviews_pyme (pyme_id);
create index if not exists idx_reviews_necesidad on public.reviews_pyme (necesidad_id);

alter table public.reviews_pyme enable row level security;

-- 2. RLS
-- SELECT: todos los authenticated ven reviews (info publica para reputacion).
drop policy if exists "reviews_pyme_select_all" on public.reviews_pyme;
create policy "reviews_pyme_select_all" on public.reviews_pyme
  for select to authenticated using (true);

-- INSERT/UPDATE/DELETE: solo via RPC (definer). No hay policy de write directo.
-- Sin policy de INSERT explicita, RLS bloquea inserts directos a la tabla.

-- 3. RPC: crear review
-- Validaciones:
--   - caller es miembro del grupo de la necesidad
--   - necesidad esta cumplida
--   - existe oferta ganadora -> de ahi sacamos el pyme_id
--   - autor no puede ser la misma pyme
create or replace function public.crear_review_pyme(
  p_necesidad uuid,
  p_estrellas int,
  p_comentario text default null
)
returns public.reviews_pyme
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_estado text;
  v_pyme_id uuid;
  v_review public.reviews_pyme;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then
    raise exception 'estrellas debe estar entre 1 y 5';
  end if;

  select grupo_id, estado into v_grupo_id, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo_id is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'cumplida' then
    raise exception 'Solo se puede calificar cuando la necesidad esta cumplida (estado actual: %)', v_estado;
  end if;

  if not public.is_grupo_miembro(v_grupo_id) then
    raise exception 'Solo los miembros del grupo pueden calificar';
  end if;

  select pyme_id into v_pyme_id from public.ofertas
    where necesidad_id = p_necesidad and estado = 'ganadora' limit 1;
  if v_pyme_id is null then raise exception 'No hay oferta ganadora para esta necesidad'; end if;

  if v_pyme_id = auth.uid() then
    raise exception 'No podes calificarte a vos mismo';
  end if;

  insert into public.reviews_pyme (necesidad_id, pyme_id, autor_id, estrellas, comentario)
  values (p_necesidad, v_pyme_id, auth.uid(), p_estrellas,
          nullif(trim(coalesce(p_comentario,'')), ''))
  on conflict (necesidad_id, autor_id) do update
    set estrellas = excluded.estrellas,
        comentario = excluded.comentario
  returning * into v_review;

  return v_review;
end $$;

grant execute on function public.crear_review_pyme(uuid, int, text) to authenticated;

-- 4. Vista agregada por pyme: total + promedio + distribucion
create or replace view public.pymes_rating_summary as
select
  pyme_id,
  count(*)::int as total_reviews,
  round(avg(estrellas)::numeric, 2) as promedio,
  count(*) filter (where estrellas = 5)::int as count_5,
  count(*) filter (where estrellas = 4)::int as count_4,
  count(*) filter (where estrellas = 3)::int as count_3,
  count(*) filter (where estrellas = 2)::int as count_2,
  count(*) filter (where estrellas = 1)::int as count_1
from public.reviews_pyme
group by pyme_id;

grant select on public.pymes_rating_summary to authenticated, anon;

-- 5. Helper: review existente del caller para una necesidad
create or replace function public.mi_review_necesidad(p_necesidad uuid)
returns public.reviews_pyme
language sql security definer set search_path = public
as $$
  select * from public.reviews_pyme
  where necesidad_id = p_necesidad and autor_id = auth.uid()
  limit 1;
$$;

grant execute on function public.mi_review_necesidad(uuid) to authenticated;
