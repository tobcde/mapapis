-- =========================================================================
-- MaPaPis — Slice 3.3: foto + campos estructurados en necesidades
-- =========================================================================
-- Cambios:
--   1. Columna foto_url en necesidades (URL pública del bucket)
--   2. Bucket de Storage 'necesidad-fotos' público para lectura
--   3. Policies storage:
--        - cualquier authenticated puede subir a su carpeta /<grupo_id>/<uid>/...
--        - todos pueden leer (es público para que las pymes vean sin auth extra)
--        - solo el dueño (uid = nombre carpeta) puede borrar
--   4. Refuerzo schema 'indumentaria' con campo "talles" mejor tipeado
--      (sigue siendo text pero con hint en placeholder)
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columna foto en necesidades
-- ─────────────────────────────────────────────────────────────────────────

alter table public.necesidades
  add column if not exists foto_url text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Bucket de Storage (idempotente)
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('necesidad-fotos', 'necesidad-fotos', true)
on conflict (id) do update set public = excluded.public;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage policies
-- ─────────────────────────────────────────────────────────────────────────
-- Convención de path: <grupo_id>/<auth.uid()>/<random>.jpg
-- Permite que cada usuario tenga su carpeta y no pise archivos ajenos.

drop policy if exists "necesidad_fotos_read_public" on storage.objects;
create policy "necesidad_fotos_read_public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'necesidad-fotos');

drop policy if exists "necesidad_fotos_insert_own" on storage.objects;
create policy "necesidad_fotos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'necesidad-fotos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "necesidad_fotos_delete_own" on storage.objects;
create policy "necesidad_fotos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'necesidad-fotos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Refuerzo schema 'indumentaria' (placeholders más claros)
-- ─────────────────────────────────────────────────────────────────────────

update public.categorias
   set campos_obligatorios = '[
     {"key":"cantidad","label":"Cantidad total","type":"int","required":true,"min":1},
     {"key":"talles","label":"Detalle por talle","type":"text","required":true,"placeholder":"ej: 5xS, 10xM, 8xL, 2xXL","help":"Un par talle:cantidad por línea o coma."}
   ]'::jsonb
 where slug = 'indumentaria';

-- =========================================================================
-- Verificación
-- =========================================================================
-- select column_name from information_schema.columns
--  where table_name = 'necesidades' and column_name = 'foto_url';
-- select id, public from storage.buckets where id = 'necesidad-fotos';
-- select polname from pg_policy where polrelid = 'storage.objects'::regclass;
