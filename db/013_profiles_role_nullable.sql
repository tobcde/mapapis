-- =========================================================================
-- MaPaPis — fix: permitir profiles.role nullable para poder volver al
-- onboarding de rol desde el perfil ("Cambiar de rol").
-- =========================================================================
-- Antes: role text not null check (...). El update({ role: null }) del
-- frontend fallaba silencioso porque el codigo descartaba el error.
-- =========================================================================

alter table public.profiles
  alter column role drop not null;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select column_name, is_nullable from information_schema.columns
--  where table_name = 'profiles' and column_name = 'role';
