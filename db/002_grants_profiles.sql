-- =========================================================================
-- MaPaPis — Slice 1 (cont.): grants para que la Data API pueda tocar profiles
-- =========================================================================
-- Necesario porque elegimos "Automatically expose new tables = NO" al crear
-- el proyecto, lo que significa que CADA tabla necesita grants explícitos.
-- (Esto es lo correcto: control manual = más seguro.)
--
-- Ejecutar en Supabase: SQL Editor → New query → pegar todo → Run.
-- =========================================================================

-- 1. Permitir usar el schema public a los roles del API
grant usage on schema public to anon, authenticated;

-- 2. authenticated (usuarios logueados): SELECT/INSERT/UPDATE sobre profiles.
--    DELETE no, porque si alguien borra su profile rompemos el modelo.
--    RLS sigue limitando a "tu propia fila".
grant select, insert, update on public.profiles to authenticated;

-- 3. anon (no logueados): ningún acceso a profiles. (No grant.)

-- =========================================================================
-- Verificar:
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'profiles';
-- =========================================================================
