-- =========================================================================
-- MaPaPis - Slice 3.3b: link de referencia + fechas + horarios + mas categorias
-- =========================================================================
-- Cambios:
--   1. necesidades.link_referencia text (URL de ejemplo: ML, otro vendedor, foto online)
--   2. necesidades.fecha_limite_inscripcion timestamptz (cierre para que el grupo se anote / decida)
--   3. necesidades.fecha_limite_entrega timestamptz (deadline real de entrega con hora)
--      (la columna vieja fecha_limite date queda como legacy, no se usa mas en frontend)
--   4. Recrear view necesidades_publicas con los nuevos campos
--   5. Mas categorias (utiles, libros, transporte, salud, fotografia, deportes,
--      decoracion, limpieza, regalos, otros)
-- =========================================================================

-- 1. Nuevas columnas en necesidades
alter table public.necesidades
  add column if not exists link_referencia text,
  add column if not exists fecha_limite_inscripcion timestamptz,
  add column if not exists fecha_limite_entrega timestamptz,
  add column if not exists modalidad text not null default 'grupal',
  add column if not exists cantidad_por_alumno int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.necesidades'::regclass
       and conname = 'necesidades_modalidad_chk'
  ) then
    alter table public.necesidades
      add constraint necesidades_modalidad_chk
      check (modalidad in ('grupal','individual'));
  end if;
end $$;

-- Validacion suave del link (acepta http/https, max 500 chars)
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.necesidades'::regclass
       and conname = 'necesidades_link_referencia_chk'
  ) then
    alter table public.necesidades
      add constraint necesidades_link_referencia_chk
      check (link_referencia is null
             or (char_length(link_referencia) <= 500
                 and link_referencia ~* '^https?://'));
  end if;
end $$;

-- 2. Mas categorias
insert into public.categorias (slug, nombre, campos_obligatorios, orden) values
  ('utiles_escolares', 'Utiles escolares / kits',
   '[
     {"key":"cantidad","label":"Cantidad de kits","type":"int","required":true,"min":1},
     {"key":"detalle_kit","label":"Detalle del kit","type":"text","required":true,"placeholder":"ej: 2 cuadernos, 1 cartuchera, 12 lapices"}
   ]'::jsonb, 7),
  ('libros', 'Libros / textos',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"titulos","label":"Titulos / autores / editorial","type":"text","required":true}
   ]'::jsonb, 8),
  ('transporte', 'Transporte',
   '[
     {"key":"pasajeros","label":"Cantidad de pasajeros","type":"int","required":true,"min":1},
     {"key":"origen","label":"Origen","type":"text","required":true},
     {"key":"destino","label":"Destino","type":"text","required":true}
   ]'::jsonb, 9),
  ('salud', 'Salud / botiquin',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"detalle","label":"Detalle de productos","type":"text","required":true}
   ]'::jsonb, 10),
  ('fotografia', 'Fotografia / video',
   '[
     {"key":"asistentes","label":"Cantidad estimada de asistentes","type":"int","required":false},
     {"key":"duracion_horas","label":"Duracion en horas","type":"int","required":false}
   ]'::jsonb, 11),
  ('deportes', 'Deportes / educacion fisica',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"detalle","label":"Detalle (talles, colores, marca)","type":"text","required":true}
   ]'::jsonb, 12),
  ('decoracion_fiestas', 'Decoracion / fiestas',
   '[
     {"key":"asistentes","label":"Cantidad de asistentes","type":"int","required":false},
     {"key":"detalle","label":"Detalle / tematica","type":"text","required":true}
   ]'::jsonb, 13),
  ('limpieza', 'Limpieza / higiene',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"detalle","label":"Productos / marcas / tamano","type":"text","required":true}
   ]'::jsonb, 14),
  ('regalos', 'Regalos / souvenirs',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"detalle","label":"Detalle / personalizacion","type":"text","required":true}
   ]'::jsonb, 15),
  ('otros', 'Otros',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":false,"min":1},
     {"key":"detalle","label":"Detalle","type":"text","required":true}
   ]'::jsonb, 99)
on conflict (slug) do nothing;

-- 3. Tabla de inscripciones (modo individual: cada alumno anotado suma cantidad)
create table if not exists public.necesidad_inscripciones (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  inscripto_por uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  unique (necesidad_id, alumno_id)
);

create index if not exists idx_inscripciones_necesidad on public.necesidad_inscripciones (necesidad_id);

alter table public.necesidad_inscripciones enable row level security;

drop policy if exists "inscripciones_select_grupo" on public.necesidad_inscripciones;
create policy "inscripciones_select_grupo" on public.necesidad_inscripciones
  for select to authenticated, anon
  using (true);  -- publica para todos los autenticados; el alumno_id ya esta asociado a un grupo del que sos miembro

drop policy if exists "inscripciones_delete_propio" on public.necesidad_inscripciones;
create policy "inscripciones_delete_propio" on public.necesidad_inscripciones
  for delete to authenticated
  using (inscripto_por = auth.uid());

grant select, delete on public.necesidad_inscripciones to authenticated;
grant select on public.necesidad_inscripciones to anon;

-- RPC inscribir_alumno: valida que sos tutor + necesidad individual + alumno del grupo
create or replace function public.inscribir_alumno(p_necesidad uuid, p_alumno uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_modalidad text; v_grupo_id uuid; v_estado text; v_alumno_grupo uuid; v_es_tutor boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select modalidad, grupo_id, estado into v_modalidad, v_grupo_id, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo_id is null then raise exception 'Necesidad no encontrada'; end if;
  if v_modalidad <> 'individual' then
    raise exception 'Solo necesidades individuales aceptan inscripciones';
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
end; $$;

grant execute on function public.inscribir_alumno(uuid, uuid) to authenticated;

create or replace function public.desinscribir_alumno(p_necesidad uuid, p_alumno uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from public.necesidad_inscripciones
   where necesidad_id = p_necesidad
     and alumno_id = p_alumno
     and inscripto_por = auth.uid();
end; $$;

grant execute on function public.desinscribir_alumno(uuid, uuid) to authenticated;

-- 4. Recrear view publica con nuevos campos
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
  n.estado,
  n.cap_ofertas,
  n.ofertas_count,
  n.creador_tipo,
  n.created_at,
  (select count(*)::int from public.necesidad_inscripciones i where i.necesidad_id = n.id) as inscriptos_count
from public.necesidades n
join public.categorias c on c.id = n.categoria_id
where n.estado = 'recibiendo_ofertas';

grant select on public.necesidades_publicas to authenticated, anon;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select column_name from information_schema.columns
--  where table_name = 'necesidades'
--    and column_name in ('link_referencia','fecha_limite_inscripcion','fecha_limite_entrega');
-- select slug, nombre, orden from public.categorias order by orden;
