-- =========================================================================
-- MaPaPis — Sprint 1 #1: cierre de ciclo "cumplida"
-- =========================================================================
-- Cambios:
--   1. Columnas cumplida_at + cumplida_por en necesidades
--   2. RPC marcar_cumplida(p_necesidad) — admin/creador del grupo o pyme
--      ganadora pueden disparar. Pasa estado adjudicada -> cumplida.
--   3. RPC revertir_cumplida(p_necesidad) — solo admin del grupo, ventana 24hs.
-- =========================================================================

-- 1. Columnas
alter table public.necesidades
  add column if not exists cumplida_at timestamptz,
  add column if not exists cumplida_por uuid references public.profiles(id);

-- 2. RPC marcar_cumplida
create or replace function public.marcar_cumplida(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_pyme_ganadora uuid;
  v_es_admin boolean;
  v_es_pyme_ganadora boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, estado into v_grupo, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'adjudicada' then
    raise exception 'Solo se puede marcar como cumplida una necesidad adjudicada (actual: %)', v_estado;
  end if;

  -- pyme ganadora (puede no existir si nunca se adjudico, pero ya validamos estado=adjudicada)
  select pyme_id into v_pyme_ganadora
    from public.ofertas
   where necesidad_id = p_necesidad and estado = 'ganadora'
   limit 1;

  v_es_admin := public.es_admin_grupo(v_grupo, auth.uid());
  v_es_pyme_ganadora := (v_pyme_ganadora = auth.uid());

  if not (v_es_admin or v_es_pyme_ganadora) then
    raise exception 'Solo admin del grupo o la pyme ganadora pueden marcar como cumplida';
  end if;

  update public.necesidades
     set estado = 'cumplida',
         cumplida_at = now(),
         cumplida_por = auth.uid(),
         updated_at = now()
   where id = p_necesidad;
end; $$;

grant execute on function public.marcar_cumplida(uuid) to authenticated;

-- 3. RPC revertir_cumplida (ventana de 24hs, solo admin del grupo)
create or replace function public.revertir_cumplida(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_cumplida_at timestamptz;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, estado, cumplida_at
    into v_grupo, v_estado, v_cumplida_at
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'cumplida' then
    raise exception 'La necesidad no esta marcada como cumplida (estado: %)', v_estado;
  end if;
  if not public.es_admin_grupo(v_grupo, auth.uid()) then
    raise exception 'Solo admin/creador del grupo puede revertir';
  end if;
  if v_cumplida_at is null or now() - v_cumplida_at > interval '24 hours' then
    raise exception 'La ventana para revertir (24hs) ya paso. Contactanos si fue un error.';
  end if;

  update public.necesidades
     set estado = 'adjudicada',
         cumplida_at = null,
         cumplida_por = null,
         updated_at = now()
   where id = p_necesidad;
end; $$;

grant execute on function public.revertir_cumplida(uuid) to authenticated;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select column_name from information_schema.columns
--  where table_name = 'necesidades' and column_name in ('cumplida_at','cumplida_por');
-- select proname from pg_proc where proname in ('marcar_cumplida','revertir_cumplida');
