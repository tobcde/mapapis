-- =========================================================================
-- 029_fix_pago_mp_grant.sql
-- =========================================================================
-- La 022 creó pago_mp con RLS y policy, pero olvidó el GRANT SELECT a
-- authenticated. Postgres aplica los grants ANTES de evaluar RLS, así que
-- los usuarios autenticados reciben "42501 permission denied for table
-- pago_mp" y el cliente nunca ve sus propios pagos (la app sigue mostrando
-- "Pagar con Mercado Pago" aunque el pago esté approved).
--
-- Idempotente.
-- =========================================================================

grant select on public.pago_mp to authenticated;
