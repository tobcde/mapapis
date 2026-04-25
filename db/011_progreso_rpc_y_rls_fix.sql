-- =========================================================================
-- MaPaPis — fix RLS + RPC progreso de inscripcion
-- =========================================================================
-- Sintoma: en una necesidad individual donde dos familias se anotaron, el
-- admin/creador veia "0/2 alumnos anotados · cantidad final: 0" aunque la
-- otra familia veia 2/2. Causa: la policy SELECT de necesidad_inscripciones
-- quedo restringida (probablemente a inscripto_por = auth.uid()) en vez del
-- using (true) que declara 009.
--
-- Fix:
--   1. Drop TODAS las policies de SELECT en necesidad_inscripciones y volver
--      a crear una sola, abierta a authenticated/anon.
--   2. RPC necesidad_progreso(p_necesidad) SECURITY DEFINER que devuelve
--      inscriptos / total_alumnos / inscripcion_cerrada_at firmes.
-- =========================================================================

-- 1. Re-aplicar policy SELECT abierta (idempotente)
do $$
declare r record;
begin
  for r in
    select polname from pg_policy
     where polrelid = 'public.necesidad_inscripciones'::regclass
       and polcmd = 'r'  -- SELECT
  loop
    execute format('drop policy %I on public.necesidad_inscripciones', r.polname);
  end loop;
end $$;

create policy "inscripciones_select_open" on public.necesidad_inscripciones
  for select to authenticated, anon
  using (true);

-- 2. RPC progreso (security definer)
create or replace function public.necesidad_progreso(p_necesidad uuid)
returns table (
  inscriptos int,
  total_alumnos int,
  inscripcion_cerrada_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*)::int from public.necesidad_inscripciones i where i.necesidad_id = p_necesidad),
    (select count(*)::int from public.alumnos a where a.grupo_id = n.grupo_id),
    n.inscripcion_cerrada_at
  from public.necesidades n
  where n.id = p_necesidad;
$$;

grant execute on function public.necesidad_progreso(uuid) to authenticated, anon;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select polname, polcmd from pg_policy where polrelid = 'public.necesidad_inscripciones'::regclass;
-- select * from public.necesidad_progreso('<uuid>');
