-- =========================================================================
-- 025_pymes_stats_publico.sql — Vista de stats anonimizadas por pyme
-- =========================================================================
-- Las familias ven ofertas SIN nombre ni contacto antes de adjudicar.
-- Solo ven: rating (ya existe en pymes_rating_summary), zonas geográficas,
-- cantidad total de ofertas hechas y cantidad de ofertas ganadas.
--
-- El nombre/descripcion/telefono solo se desbloquea via la RPC
-- contacto_pyme_ganadora() y la pantalla ContactoPyme post-pago MP.
-- =========================================================================

create or replace view public.pymes_stats_publico as
select
  p.profile_id              as pyme_id,
  p.zonas                   as zonas,
  p.tier                    as tier,
  coalesce(stats.ofertas_total, 0)   as ofertas_total,
  coalesce(stats.ofertas_ganadas, 0) as ofertas_ganadas
from public.pymes p
left join (
  select
    pyme_id,
    count(*)                                  as ofertas_total,
    count(*) filter (where estado = 'ganadora') as ofertas_ganadas
  from public.ofertas
  group by pyme_id
) stats on stats.pyme_id = p.profile_id;

grant select on public.pymes_stats_publico to authenticated, anon;

notify pgrst, 'reload schema';
