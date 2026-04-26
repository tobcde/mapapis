-- =========================================================================
-- 027_fix_categorias_encoding.sql — Repara mojibake de categorias
-- =========================================================================
-- Cuando el seed original (003 + 009) se cargó en Supabase, las strings con
-- tildes/ñ quedaron mal encoded ("didÃ¡cticos" en vez de "didácticos",
-- "tamaÃ±o" en vez de "tamaño"). Este script reemplaza nombre y
-- campos_obligatorios por los valores correctos.
--
-- Idempotente: se puede correr varias veces.
-- =========================================================================

begin;

-- Materiales didácticos
update public.categorias
   set nombre = 'Materiales didácticos',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"formato","label":"Formato/tamaño","type":"text","required":true},
         {"key":"destino","label":"Sala/aula destino","type":"text","required":false}
       ]'::jsonb
 where slug = 'materiales_didacticos';

-- Indumentaria
update public.categorias
   set nombre = 'Indumentaria',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"talles","label":"Detalle de talles","type":"text","required":true}
       ]'::jsonb
 where slug = 'indumentaria';

-- Servicios
update public.categorias
   set nombre = 'Servicios',
       campos_obligatorios = '[
         {"key":"fecha_servicio","label":"Fecha del servicio","type":"date","required":true},
         {"key":"horas_estimadas","label":"Duración estimada (horas)","type":"int","required":false}
       ]'::jsonb
 where slug = 'servicios';

-- Alimentación / catering
update public.categorias
   set nombre = 'Alimentación / catering',
       campos_obligatorios = '[
         {"key":"cantidad_personas","label":"Cantidad de personas","type":"int","required":true,"min":1},
         {"key":"fecha_evento","label":"Fecha del evento","type":"date","required":true},
         {"key":"dietarios","label":"Requisitos dietarios","type":"text","required":false}
       ]'::jsonb
 where slug = 'alimentacion';

-- Salidas / eventos
update public.categorias
   set nombre = 'Salidas / eventos',
       campos_obligatorios = '[
         {"key":"cantidad_personas","label":"Cantidad de personas","type":"int","required":true},
         {"key":"fecha_evento","label":"Fecha","type":"date","required":true},
         {"key":"lugar","label":"Lugar destino","type":"text","required":true}
       ]'::jsonb
 where slug = 'salidas_eventos';

-- Tecnología
update public.categorias
   set nombre = 'Tecnología',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true},
         {"key":"especificaciones","label":"Especificaciones técnicas","type":"text","required":true}
       ]'::jsonb
 where slug = 'tecnologia';

-- Útiles escolares
update public.categorias
   set nombre = 'Útiles escolares / kits',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad de kits","type":"int","required":true,"min":1},
         {"key":"detalle_kit","label":"Detalle del kit","type":"text","required":true,"placeholder":"ej: 2 cuadernos, 1 cartuchera, 12 lápices"}
       ]'::jsonb
 where slug = 'utiles_escolares';

-- Libros
update public.categorias
   set nombre = 'Libros / textos',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"titulos","label":"Títulos / autores / editorial","type":"text","required":true}
       ]'::jsonb
 where slug = 'libros';

-- Transporte
update public.categorias
   set nombre = 'Transporte',
       campos_obligatorios = '[
         {"key":"pasajeros","label":"Cantidad de pasajeros","type":"int","required":true,"min":1},
         {"key":"origen","label":"Origen","type":"text","required":true},
         {"key":"destino","label":"Destino","type":"text","required":true}
       ]'::jsonb
 where slug = 'transporte';

-- Salud / botiquín
update public.categorias
   set nombre = 'Salud / botiquín',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Detalle de productos","type":"text","required":true}
       ]'::jsonb
 where slug = 'salud';

-- Fotografía / video
update public.categorias
   set nombre = 'Fotografía / video',
       campos_obligatorios = '[
         {"key":"asistentes","label":"Cantidad estimada de asistentes","type":"int","required":false},
         {"key":"duracion_horas","label":"Duración en horas","type":"int","required":false}
       ]'::jsonb
 where slug = 'fotografia';

-- Deportes / educación física
update public.categorias
   set nombre = 'Deportes / educación física',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Detalle (talles, colores, marca)","type":"text","required":true}
       ]'::jsonb
 where slug = 'deportes';

-- Decoración / fiestas
update public.categorias
   set nombre = 'Decoración / fiestas',
       campos_obligatorios = '[
         {"key":"asistentes","label":"Cantidad de asistentes","type":"int","required":false},
         {"key":"detalle","label":"Detalle / temática","type":"text","required":true}
       ]'::jsonb
 where slug = 'decoracion_fiestas';

-- Limpieza / higiene
update public.categorias
   set nombre = 'Limpieza / higiene',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Productos / marcas / tamaño","type":"text","required":true}
       ]'::jsonb
 where slug = 'limpieza';

-- Regalos / souvenirs
update public.categorias
   set nombre = 'Regalos / souvenirs',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Detalle / personalización","type":"text","required":true}
       ]'::jsonb
 where slug = 'regalos';

-- Otros
update public.categorias
   set nombre = 'Otros',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":false,"min":1},
         {"key":"detalle","label":"Detalle","type":"text","required":true}
       ]'::jsonb
 where slug = 'otros';

commit;

-- Verificación
select slug, nombre, campos_obligatorios from public.categorias order by orden;
