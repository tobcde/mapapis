-- =========================================================================
-- 044_cobranzas_storage.sql — Bucket privado 'comprobantes' + policies
-- =========================================================================
-- Comprobantes de transferencia: PII sensible (CBU, nombre, monto, banco).
-- Bucket PRIVADO con policies que limitan lectura/escritura a:
--   - El tutor del alumno (sube y ve su propio comprobante).
--   - El cobrador asignado a esa necesidad (ve para confirmar).
--
-- Estructura del path:
--   {necesidad_id}/{alumno_id}/{timestamp}-{filename}
--
--   - storage.foldername(name) -> { necesidad_id, alumno_id }
--   - Esto permite policies que matcheen contra cobranzas y necesidades.
--
-- Acceso desde el FE: signed URLs cortas (60-300s) generadas por el cliente
--   con auth, NO URL publica.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Bucket privado
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do update set public = false;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Helpers de lectura: paths del tipo {necesidad}/{alumno}/{filename}
--    se parsean asi:
--      (storage.foldername(name))[1] -> necesidad_id (string)
--      (storage.foldername(name))[2] -> alumno_id    (string)
--
--    Policy de SELECT: tutor del alumno O cobrador de la necesidad.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "comprobantes_select_tutor_o_cobrador" on storage.objects;
create policy "comprobantes_select_tutor_o_cobrador" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
        from public.cobranzas c
        join public.necesidades n on n.id = c.necesidad_id
       where c.necesidad_id::text = (storage.foldername(name))[1]
         and c.alumno_id::text = (storage.foldername(name))[2]
         and (
           -- Cobrador de la necesidad
           n.cobrador_id = auth.uid()
           -- O tutor del alumno
           or exists (
             select 1 from public.alumno_tutores t
              where t.alumno_id = c.alumno_id and t.profile_id = auth.uid()
           )
         )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Policy INSERT: solo tutor del alumno + estructura del path valida +
--    cobranza existe + cobranza no esta confirmada (no rehacer historico).
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "comprobantes_insert_tutor" on storage.objects;
create policy "comprobantes_insert_tutor" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
        from public.cobranzas c
        join public.alumno_tutores t on t.alumno_id = c.alumno_id
       where c.necesidad_id::text = (storage.foldername(name))[1]
         and c.alumno_id::text = (storage.foldername(name))[2]
         and t.profile_id = auth.uid()
         and c.estado <> 'confirmado'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Policy UPDATE: misma logica que INSERT (sobrescribir comprobante).
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "comprobantes_update_tutor" on storage.objects;
create policy "comprobantes_update_tutor" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
        from public.cobranzas c
        join public.alumno_tutores t on t.alumno_id = c.alumno_id
       where c.necesidad_id::text = (storage.foldername(name))[1]
         and c.alumno_id::text = (storage.foldername(name))[2]
         and t.profile_id = auth.uid()
         and c.estado <> 'confirmado'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Policy DELETE: tutor del alumno (para borrar comprobante propio).
--    Cobrador NO puede borrar (solo ve). Si quiere rechazar, revierte
--    confirmacion + el tutor sube nuevo.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "comprobantes_delete_tutor" on storage.objects;
create policy "comprobantes_delete_tutor" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
        from public.cobranzas c
        join public.alumno_tutores t on t.alumno_id = c.alumno_id
       where c.necesidad_id::text = (storage.foldername(name))[1]
         and c.alumno_id::text = (storage.foldername(name))[2]
         and t.profile_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
