-- =========================================================================
-- MaPaPis — RESET total de datos
-- =========================================================================
-- ⚠️  CUIDADO: Borra TODO. Pensado para arrancar de cero.
--
-- Por defecto borra:
--   - Marketplace (necesidades, ofertas, votos, inscripciones, pagos, reviews)
--   - Alumnos / tutores
--   - Grupos y membresías
--   - Pymes
--   - Profiles
--   - auth.users (logins)
--
-- Si solo querés limpiar contenido pero mantener tus logins, comentá la
-- sección AUTH al final.
--
-- Orden importa: hijos antes que padres por las FK.
-- =========================================================================

begin;

-- =========================================================================
-- 1) Marketplace — pagos, reviews, ofertas, necesidades
-- =========================================================================
delete from public.pago_mp;
delete from public.necesidad_pagos;
delete from public.reviews_pyme;
delete from public.votos_oferta;
delete from public.necesidad_inscripciones;
delete from public.ofertas;
delete from public.necesidades;

-- =========================================================================
-- 2) Alumnos / tutores
-- =========================================================================
delete from public.alumno_tutores;
delete from public.alumnos;

-- =========================================================================
-- 3) Grupos y membresías
-- =========================================================================
delete from public.grupo_miembros;
delete from public.grupos;

-- =========================================================================
-- 4) Pymes (perfiles de negocio)
-- =========================================================================
delete from public.pymes;

-- =========================================================================
-- 5) Tablas opcionales — silencioso si no existen
-- =========================================================================
do $$
begin
  if to_regclass('public.mensajes_grupo') is not null then
    execute 'delete from public.mensajes_grupo';
  end if;
  if to_regclass('public.disputas') is not null then
    execute 'delete from public.disputas';
  end if;
end $$;

-- =========================================================================
-- 6) Profiles — borrar primero los profiles antes de auth.users
-- =========================================================================
delete from public.profiles;

-- =========================================================================
-- 7) AUTH — borra los logins (mails, sesiones, identidades OAuth)
-- =========================================================================
-- Comentá este bloque si querés mantener tus usuarios y solo limpiar datos.
delete from auth.users;

commit;

-- =========================================================================
-- Verificación rápida
-- =========================================================================
select 'profiles' as tabla, count(*) from public.profiles
union all select 'auth.users', count(*) from auth.users
union all select 'pymes', count(*) from public.pymes
union all select 'grupos', count(*) from public.grupos
union all select 'grupo_miembros', count(*) from public.grupo_miembros
union all select 'alumnos', count(*) from public.alumnos
union all select 'alumno_tutores', count(*) from public.alumno_tutores
union all select 'necesidades', count(*) from public.necesidades
union all select 'necesidad_inscripciones', count(*) from public.necesidad_inscripciones
union all select 'ofertas', count(*) from public.ofertas
union all select 'votos_oferta', count(*) from public.votos_oferta
union all select 'necesidad_pagos', count(*) from public.necesidad_pagos
union all select 'pago_mp', count(*) from public.pago_mp
union all select 'reviews_pyme', count(*) from public.reviews_pyme;
