-- =========================================================================
-- 034_profiles_visibles_co_miembros.sql — perfiles visibles entre co-miembros
-- =========================================================================
-- Problema: la policy actual `select_propio_perfil` solo deja ver tu propia
-- fila. Como los joins en Supabase respetan RLS, queries como:
--   alumnos(*, alumno_tutores(profile_id, profiles(id, nombre, email)))
-- devuelven `profiles: null` para tutores que no sos vos. En la UI quedaba
-- "— · Papá" en vez de "Pablo · Papá".
--
-- Fix: agregar una policy permisiva adicional que deja leer el perfil de
-- cualquier usuario que comparta al menos un grupo con vos. Las policies
-- permissive en PG se combinan con OR — la `select_propio_perfil` sigue ok.
--
-- Datos expuestos (todo lo que ya hay en profiles): id, nombre, role,
-- email, telefono, alias_mp, etc. Si alguno se considera demasiado sensible
-- para mostrar entre co-miembros (ej. telefono), conviene moverlo a tablas
-- aparte o filtrar por columnas via una view publica. Por ahora, los
-- co-miembros del mismo grupo confian entre si en este nivel basico.
-- =========================================================================

drop policy if exists "ver_perfil_co_miembros" on public.profiles;
create policy "ver_perfil_co_miembros" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.grupo_miembros gm1
      join public.grupo_miembros gm2
        on gm1.grupo_id = gm2.grupo_id
      where gm1.profile_id = auth.uid()
        and gm2.profile_id = profiles.id
    )
  );

notify pgrst, 'reload schema';
