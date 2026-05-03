-- =========================================================================
-- 040_leave_grupo_safe.sql — Salida segura del grupo con limpieza de alumnos
-- =========================================================================
-- Antes:
--   leave_grupo solo borraba grupo_miembros. El alumno y el vinculo en
--   alumno_tutores quedaban "huerfanos": el alumno seguia en el grupo y vos
--   seguias listado como tutor de un grupo del que ya no sos miembro.
--
-- Ahora:
--   leave_grupo, dentro de la misma transaccion:
--     1. Borra TUS vinculos en alumno_tutores para alumnos del grupo.
--     2. Borra los alumnos que queden con 0 tutores (eras el unico tutor).
--        Si el alumno tiene otros tutores, NO se borra: solo perdes vos
--        el vinculo. El cascade de FK arrastra votos/inscripciones del
--        alumno solo cuando el alumno se elimina.
--     3. Borra grupo_miembros.
--
--   preview_leave_grupo(p_grupo): devuelve por adelantado que va a pasar
--   con cada alumno del usuario, para que el FE arme un confirm contextual.
--
-- Decision deliberada:
--   - Si sos creador, NO podes salir (regla previa preservada).
--   - Si tenes un alumno con otro tutor, el otro tutor mantiene el alumno
--     en el grupo (criterio del usuario).
--   - Si sos unico tutor, borrar el alumno arrastra (cascade) sus votos,
--     inscripciones y pagos. Es destructivo pero coherente: nadie puede
--     decidir por ese alumno.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. preview_leave_grupo: explica el impacto sin ejecutar nada
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.preview_leave_grupo(p_grupo uuid)
returns table (
  alumno_id uuid,
  alumno_nombre text,
  otros_tutores_count int,
  se_elimina boolean,
  otros_tutores_nombres text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  return query
  select
    a.id,
    a.nombre,
    (select count(*)::int
       from public.alumno_tutores t2
      where t2.alumno_id = a.id
        and t2.profile_id <> auth.uid()) as otros_tutores_count,
    not exists (
      select 1
        from public.alumno_tutores t3
       where t3.alumno_id = a.id
         and t3.profile_id <> auth.uid()
    ) as se_elimina,
    coalesce(
      (select array_agg(coalesce(p.nombre, split_part(p.email, '@', 1)))
         from public.alumno_tutores t4
         join public.profiles p on p.id = t4.profile_id
        where t4.alumno_id = a.id
          and t4.profile_id <> auth.uid()),
      '{}'::text[]
    ) as otros_tutores_nombres
  from public.alumnos a
  join public.alumno_tutores t on t.alumno_id = a.id
 where a.grupo_id = p_grupo
   and t.profile_id = auth.uid()
 order by a.nombre;
end;
$$;

grant execute on function public.preview_leave_grupo(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. leave_grupo reescrita con limpieza atomica
-- ─────────────────────────────────────────────────────────────────────────
-- Mantenemos firma (uuid) -> void para no romper el FE actual.
create or replace function public.leave_grupo(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select rol_en_grupo into v_rol
    from public.grupo_miembros
   where grupo_id = p_grupo and profile_id = auth.uid();

  if v_rol is null then
    -- Idempotente: si ya no estas en el grupo, no hacemos nada
    return;
  end if;

  if v_rol = 'creador' then
    raise exception 'El creador no puede salir del grupo (transferi la titularidad o eliminalo)';
  end if;

  -- 1. Borrar vinculos del usuario con alumnos de este grupo
  delete from public.alumno_tutores t
   using public.alumnos a
   where a.id = t.alumno_id
     and a.grupo_id = p_grupo
     and t.profile_id = auth.uid();

  -- 2. Borrar alumnos del grupo que quedaron sin ningun tutor
  --    (cascade arrastra inscripciones, votos y pagos del alumno)
  delete from public.alumnos a
   where a.grupo_id = p_grupo
     and not exists (
       select 1 from public.alumno_tutores t
        where t.alumno_id = a.id
     );

  -- 3. Salir del grupo
  delete from public.grupo_miembros
   where grupo_id = p_grupo
     and profile_id = auth.uid();
end;
$$;

grant execute on function public.leave_grupo(uuid) to authenticated;

notify pgrst, 'reload schema';
