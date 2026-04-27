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
-- =========================================================================

alter table public.necesidades
  add column if not exists composicion jsonb;

-- Validacion estructural: si esta presente, tiene que ser array de objetos
-- con nombre (string no vacio) y cantidad (entero > 0).
alter table public.necesidades
  drop constraint if exists necesidades_composicion_shape_chk;

alter table public.necesidades
  add constraint necesidades_composicion_shape_chk
  check (
    composicion is null
    or (
      jsonb_typeof(composicion) = 'array'
      and not exists (
        select 1
        from jsonb_array_elements(composicion) as item
        where jsonb_typeof(item) <> 'object'
           or jsonb_typeof(item->'nombre') <> 'string'
           or coalesce(length(trim(item->>'nombre')), 0) = 0
           or jsonb_typeof(item->'cantidad') <> 'number'
           or coalesce((item->>'cantidad')::numeric, 0) <= 0
           or (item->>'cantidad')::numeric <> floor((item->>'cantidad')::numeric)
      )
    )
  );

notify pgrst, 'reload schema';
