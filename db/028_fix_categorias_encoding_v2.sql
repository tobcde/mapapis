-- =========================================================================
-- 028_fix_categorias_encoding_v2.sql
-- =========================================================================
-- La 027 dejaba el SQL con caracteres UTF-8 multibyte en el archivo. Cuando
-- se pega en algun editor que reinterpreta encoding, los acentos se vuelven
-- a corromper.
--
-- Esta version usa Unicode escapes (U&'...' UESCAPE '\') -> el archivo es
-- 100% ASCII y Postgres construye los caracteres acentuados del lado server.
-- Idempotente.
-- =========================================================================

begin;

-- Materiales didacticos
update public.categorias
   set nombre = U&'Materiales did\00E1cticos' UESCAPE '\',
       campos_obligatorios = U&'[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"formato","label":"Formato/tama\00F1o","type":"text","required":true},
         {"key":"destino","label":"Sala/aula destino","type":"text","required":false}
       ]' UESCAPE '\' ::jsonb
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
       campos_obligatorios = U&'[
         {"key":"fecha_servicio","label":"Fecha del servicio","type":"date","required":true},
         {"key":"horas_estimadas","label":"Duraci\00F3n estimada (horas)","type":"int","required":false}
       ]' UESCAPE '\' ::jsonb
 where slug = 'servicios';

-- Alimentacion / catering
update public.categorias
   set nombre = U&'Alimentaci\00F3n / catering' UESCAPE '\',
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

-- Tecnologia
update public.categorias
   set nombre = U&'Tecnolog\00EDa' UESCAPE '\',
       campos_obligatorios = U&'[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true},
         {"key":"especificaciones","label":"Especificaciones t\00E9cnicas","type":"text","required":true}
       ]' UESCAPE '\' ::jsonb
 where slug = 'tecnologia';

-- Utiles escolares
update public.categorias
   set nombre = U&'\00DAtiles escolares / kits' UESCAPE '\',
       campos_obligatorios = U&'[
         {"key":"cantidad","label":"Cantidad de kits","type":"int","required":true,"min":1},
         {"key":"detalle_kit","label":"Detalle del kit","type":"text","required":true,"placeholder":"ej: 2 cuadernos, 1 cartuchera, 12 l\00E1pices"}
       ]' UESCAPE '\' ::jsonb
 where slug = 'utiles_escolares';

-- Libros / textos
update public.categorias
   set nombre = 'Libros / textos',
       campos_obligatorios = U&'[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"titulos","label":"T\00EDtulos / autores / editorial","type":"text","required":true}
       ]' UESCAPE '\' ::jsonb
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

-- Salud / botiquin
update public.categorias
   set nombre = U&'Salud / botiqu\00EDn' UESCAPE '\',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Detalle de productos","type":"text","required":true}
       ]'::jsonb
 where slug = 'salud';

-- Fotografia / video
update public.categorias
   set nombre = U&'Fotograf\00EDa / video' UESCAPE '\',
       campos_obligatorios = U&'[
         {"key":"asistentes","label":"Cantidad estimada de asistentes","type":"int","required":false},
         {"key":"duracion_horas","label":"Duraci\00F3n en horas","type":"int","required":false}
       ]' UESCAPE '\' ::jsonb
 where slug = 'fotografia';

-- Deportes / educacion fisica
update public.categorias
   set nombre = U&'Deportes / educaci\00F3n f\00EDsica' UESCAPE '\',
       campos_obligatorios = '[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Detalle (talles, colores, marca)","type":"text","required":true}
       ]'::jsonb
 where slug = 'deportes';

-- Decoracion / fiestas
update public.categorias
   set nombre = U&'Decoraci\00F3n / fiestas' UESCAPE '\',
       campos_obligatorios = U&'[
         {"key":"asistentes","label":"Cantidad de asistentes","type":"int","required":false},
         {"key":"detalle","label":"Detalle / tem\00E1tica","type":"text","required":true}
       ]' UESCAPE '\' ::jsonb
 where slug = 'decoracion_fiestas';

-- Limpieza / higiene
update public.categorias
   set nombre = 'Limpieza / higiene',
       campos_obligatorios = U&'[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Productos / marcas / tama\00F1o","type":"text","required":true}
       ]' UESCAPE '\' ::jsonb
 where slug = 'limpieza';

-- Regalos / souvenirs
update public.categorias
   set nombre = 'Regalos / souvenirs',
       campos_obligatorios = U&'[
         {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
         {"key":"detalle","label":"Detalle / personalizaci\00F3n","type":"text","required":true}
       ]' UESCAPE '\' ::jsonb
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

-- Verificacion
select slug, nombre, campos_obligatorios from public.categorias order by orden;
