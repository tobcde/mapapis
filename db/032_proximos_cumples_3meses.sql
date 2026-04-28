-- =========================================================================
-- 032_proximos_cumples_3meses.sql — ventana del calendario = 3 meses adelante
-- =========================================================================
-- Antes (en 031): mes en curso + primeros 10 dias del mes siguiente.
-- Ahora: cualquier cumple dentro de los proximos 3 meses (cruzando fin de
-- año si hace falta).
--
-- Tambien refactor para evitar make_date() y manejar Feb 29 prolijo:
-- usamos fecha_nacimiento + N años (Postgres normaliza Feb 29 a Feb 28
-- automaticamente en años no bisiestos).
-- =========================================================================

create or replace view public.proximos_cumples as
with base as (
  select
    a.id as alumno_id,
    a.grupo_id,
    a.nombre,
    a.fecha_nacimiento,
    -- Cumple "este año": fecha_nacimiento + (anio_actual - anio_nacimiento) años
    (a.fecha_nacimiento
       + ((extract(year from current_date) - extract(year from a.fecha_nacimiento))
          * interval '1 year'))::date as cumple_este_anio
  from public.alumnos a
  where a.fecha_nacimiento is not null
),
con_proximo as (
  select
    alumno_id,
    grupo_id,
    nombre,
    fecha_nacimiento,
    -- Si el cumple de este año ya paso, usar el del año que viene
    case
      when cumple_este_anio >= current_date then cumple_este_anio
      else (cumple_este_anio + interval '1 year')::date
    end as proximo_cumple
  from base
)
select
  alumno_id,
  grupo_id,
  nombre,
  fecha_nacimiento,
  proximo_cumple,
  (proximo_cumple - current_date) as dias_para_cumple,
  (extract(year from age(proximo_cumple, fecha_nacimiento))::int) as edad_que_cumple
from con_proximo
where proximo_cumple <= (current_date + interval '3 months')::date;

grant select on public.proximos_cumples to authenticated;

notify pgrst, 'reload schema';
