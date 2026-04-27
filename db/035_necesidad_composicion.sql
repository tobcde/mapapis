-- =========================================================================
-- 035_necesidad_composicion.sql — desglose estructurado del pedido
-- =========================================================================
-- Antes la "descripcion" era texto libre (ej. "Por cada niño: 1 Lapiz Negro,
-- 1 Lapiz Azul, 1 Lapiz Rojo") y la pyme tenia que hacer la matematica
-- mental: 2 alumnos × 3 items/c-u = 6 lapices, pero sin saber cuantos de
-- cada color.
--
-- Ahora agregamos `composicion` (jsonb): array opcional de items
-- estructurados, cada uno con nombre + cantidad. Semantica:
--
--   - modalidad = 'individual':  cantidad es por alumno → multiplicar por
--     numero de inscriptos. Ej. 1 Lapiz Negro × 2 alumnos = 2 negros.
--   - modalidad = 'grupal':       cantidad es total para todo el grupo.
--
-- Si la composicion esta vacia / null, la UI sigue mostrando la descripcion
-- como antes (backwards compat).
--
-- Validacion: PG no acepta subqueries en CHECK constraints, asi que la
-- validacion por-item se hace en un trigger BEFORE INSERT/UPDATE.
-- =========================================================================

alter table public.necesidades
  add column if not exists composicion jsonb;

-- Check simple: si esta presente, tiene que ser array.
alter table public.necesidades
  drop constraint if exists necesidades_composicion_shape_chk;

alter table public.necesidades
  drop constraint if exists necesidades_composicion_array_chk;

alter table public.necesidades
  add constraint necesidades_composicion_array_chk
  check (composicion is null or jsonb_typeof(composicion) = 'array');

-- Trigger: validacion por-item (nombre no vacio, cantidad entero positivo).
create or replace function public.tg_necesidades_composicion_validate()
returns trigger
language plpgsql
as $$
declare
  v_bad_count int;
begin
  if NEW.composicion is null then
    return NEW;
  end if;

  -- Si llego algo que no es array, el CHECK ya lo rechaza. Aca asumimos array.
  select count(*)
    into v_bad_count
    from jsonb_array_elements(NEW.composicion) as item
   where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'nombre') <> 'string'
      or coalesce(length(trim(item->>'nombre')), 0) = 0
      or jsonb_typeof(item->'cantidad') <> 'number'
      or coalesce((item->>'cantidad')::numeric, 0) <= 0
      or (item->>'cantidad')::numeric <> floor((item->>'cantidad')::numeric);

  if v_bad_count > 0 then
    raise exception
      'composicion invalida: cada item debe tener {nombre: string no vacio, cantidad: entero positivo}';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_necesidades_composicion_validate on public.necesidades;
create trigger trg_necesidades_composicion_validate
  before insert or update of composicion on public.necesidades
  for each row execute function public.tg_necesidades_composicion_validate();

notify pgrst, 'reload schema';
