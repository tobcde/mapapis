-- =========================================================================
-- MaPaPis — Sprint 2 #6: Confirmación dual de entrega (escrow simulado)
-- =========================================================================
-- Antes: cualquiera de los dos lados (admin grupo o pyme ganadora) podía
-- marcar la necesidad como cumplida unilateralmente. Para simular el
-- patrón escrow (release sólo si ambos están de acuerdo), agregamos:
--
--   entrega_confirmada_familia_at  (cuándo confirmó la familia/admin)
--   entrega_confirmada_familia_por (qué profile)
--   entrega_confirmada_pyme_at     (cuándo confirmó la pyme)
--
-- y dos RPCs nuevos:
--   confirmar_entrega_familia(p_necesidad)
--   confirmar_entrega_pyme(p_necesidad)
--
-- Cuando ambas confirmaciones existen, la RPC marca cumplida en el mismo
-- statement y se considera "pago liberado" en el FE (visualizado como tal).
-- `marcar_cumplida` queda disponible para admins como override.
-- =========================================================================

alter table public.necesidades
  add column if not exists entrega_confirmada_familia_at timestamptz,
  add column if not exists entrega_confirmada_familia_por uuid references public.profiles(id),
  add column if not exists entrega_confirmada_pyme_at timestamptz;

-- =========================================================================
-- RPC familia confirma recepción
-- =========================================================================
create or replace function public.confirmar_entrega_familia(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_pyme_at timestamptz;
  v_es_admin boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, estado, entrega_confirmada_pyme_at
    into v_grupo, v_estado, v_pyme_at
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado not in ('adjudicada','en_curso') then
    raise exception 'No se puede confirmar entrega en estado %', v_estado;
  end if;

  v_es_admin := public.es_admin_grupo(v_grupo, auth.uid());
  if not v_es_admin then
    raise exception 'Sólo el admin/creador del grupo puede confirmar la recepción';
  end if;

  update public.necesidades
     set entrega_confirmada_familia_at = now(),
         entrega_confirmada_familia_por = auth.uid(),
         -- Si la pyme ya había confirmado, pasamos a cumplida automáticamente
         estado = case when v_pyme_at is not null then 'cumplida' else estado end,
         cumplida_at = case when v_pyme_at is not null then now() else cumplida_at end,
         cumplida_por = case when v_pyme_at is not null then auth.uid() else cumplida_por end,
         updated_at = now()
   where id = p_necesidad;
end $$;

grant execute on function public.confirmar_entrega_familia(uuid) to authenticated;

-- =========================================================================
-- RPC pyme confirma entrega
-- =========================================================================
create or replace function public.confirmar_entrega_pyme(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_familia_at timestamptz;
  v_pyme_ganadora uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select grupo_id, estado, entrega_confirmada_familia_at
    into v_grupo, v_estado, v_familia_at
    from public.necesidades where id = p_necesidad;
  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado not in ('adjudicada','en_curso') then
    raise exception 'No se puede confirmar entrega en estado %', v_estado;
  end if;

  select pyme_id into v_pyme_ganadora
    from public.ofertas where necesidad_id = p_necesidad and estado = 'ganadora' limit 1;
  if v_pyme_ganadora is null or v_pyme_ganadora <> auth.uid() then
    raise exception 'Sólo la pyme ganadora puede confirmar la entrega';
  end if;

  update public.necesidades
     set entrega_confirmada_pyme_at = now(),
         estado = case when v_familia_at is not null then 'cumplida' else estado end,
         cumplida_at = case when v_familia_at is not null then now() else cumplida_at end,
         cumplida_por = case when v_familia_at is not null then auth.uid() else cumplida_por end,
         updated_at = now()
   where id = p_necesidad;
end $$;

grant execute on function public.confirmar_entrega_pyme(uuid) to authenticated;
