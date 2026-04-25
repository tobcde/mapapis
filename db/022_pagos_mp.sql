-- =========================================================================
-- MaPaPis — Sprint 2 #7: Integración Mercado Pago (sandbox)
-- =========================================================================
-- Modelo MVP: MaPaPis es el único collector. La familia paga en MP, la plata
-- entra a la wallet de MaPaPis. Cuando se confirma la entrega dual
-- (familia + pyme), el pago pasa a estado 'liberado' y se hace la
-- transferencia manual a la pyme (luego programable via Money Out API).
--
-- Esto evita el OAuth de marketplace en el MVP: no necesitamos que cada
-- pyme conecte su MP. Solo guardamos el CBU/alias en pymes (ya existe) y
-- al liberar generamos la transferencia.
--
-- Tabla principal: pago_mp (un row por intento de pago).
-- =========================================================================

create table if not exists public.pago_mp (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  -- Quién paga (familia/admin) y por qué alumno (null = la propia familia
  -- paga por sí, sin asociarlo a un alumno específico).
  profile_id uuid not null references public.profiles(id) on delete cascade,
  alumno_id uuid references public.alumnos(id) on delete set null,
  -- Monto en centavos (ARS). Lo calculamos al iniciar y lo congelamos.
  monto_centavos bigint not null check (monto_centavos > 0),
  -- Estado del lifecycle:
  --   pending      = preference creada, todavía no se pagó
  --   approved     = MP confirmó el pago, plata en wallet MaPaPis
  --   rejected     = pago rechazado por MP
  --   refunded     = devolución
  --   liberado     = entrega dual confirmada, plata "liberada" lógicamente
  --                  (todavía no transferida a pyme)
  --   transferido  = ya se hizo Money Out a pyme
  estado text not null default 'pending'
    check (estado in ('pending','approved','rejected','refunded','liberado','transferido')),
  -- Datos MP
  mp_preference_id text,
  mp_payment_id text,
  mp_status text,            -- raw status de MP (approved, in_process, rejected, ...)
  mp_status_detail text,
  mp_init_point text,        -- URL para redirigir al checkout
  mp_sandbox_init_point text,
  mp_payer_email text,
  -- Timestamps
  created_at timestamptz default now(),
  approved_at timestamptz,
  liberado_at timestamptz,
  transferido_at timestamptz
);

create index if not exists idx_pago_mp_necesidad on public.pago_mp (necesidad_id);
create index if not exists idx_pago_mp_profile on public.pago_mp (profile_id);
create index if not exists idx_pago_mp_alumno on public.pago_mp (alumno_id);
create index if not exists idx_pago_mp_pref on public.pago_mp (mp_preference_id);

alter table public.pago_mp enable row level security;

-- =========================================================================
-- RLS
-- =========================================================================
-- Quien puede SELECT:
--   - El que pagó
--   - Miembros del grupo de la necesidad
--   - La pyme ganadora de la necesidad
drop policy if exists "pago_mp_select" on public.pago_mp;
create policy "pago_mp_select" on public.pago_mp
  for select to authenticated using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.necesidades n
      where n.id = pago_mp.necesidad_id
        and public.is_grupo_miembro(n.grupo_id)
    )
    or exists (
      select 1 from public.ofertas o
      where o.necesidad_id = pago_mp.necesidad_id
        and o.estado = 'ganadora'
        and o.pyme_id = auth.uid()
    )
  );

-- INSERT/UPDATE: solo via Edge Functions (service role bypass RLS).
-- No hay policy de write directo desde authenticated.

-- =========================================================================
-- Vista resumen de pagos MP por necesidad
-- =========================================================================
create or replace view public.necesidad_pagos_mp_resumen as
select
  necesidad_id,
  count(*) filter (where estado in ('approved','liberado','transferido'))::int as pagados_count,
  count(*) filter (where estado = 'pending')::int as pending_count,
  coalesce(sum(monto_centavos) filter (where estado in ('approved','liberado','transferido')), 0)::bigint as total_cobrado_centavos,
  coalesce(sum(monto_centavos) filter (where estado in ('liberado','transferido')), 0)::bigint as total_liberado_centavos,
  count(*) filter (where estado = 'transferido')::int as transferidos_count
from public.pago_mp
group by necesidad_id;

grant select on public.necesidad_pagos_mp_resumen to authenticated;

-- =========================================================================
-- RPC: trigger de "liberar pagos" cuando se confirma la entrega dual
-- =========================================================================
-- Esto lo llama internamente confirmar_entrega_familia/pyme cuando ambas
-- confirmaciones están listas. Marca todos los approved como liberado.
-- =========================================================================
create or replace function public.liberar_pagos_mp(p_necesidad uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  update public.pago_mp
     set estado = 'liberado',
         liberado_at = now()
   where necesidad_id = p_necesidad
     and estado = 'approved';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.liberar_pagos_mp(uuid) to authenticated;

-- =========================================================================
-- Re-creamos confirmar_entrega_familia/pyme para liberar pagos al cumplir
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
  v_ahora_cumplida boolean;
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

  v_ahora_cumplida := v_pyme_at is not null;

  update public.necesidades
     set entrega_confirmada_familia_at = now(),
         entrega_confirmada_familia_por = auth.uid(),
         estado = case when v_ahora_cumplida then 'cumplida' else estado end,
         cumplida_at = case when v_ahora_cumplida then now() else cumplida_at end,
         cumplida_por = case when v_ahora_cumplida then auth.uid() else cumplida_por end,
         updated_at = now()
   where id = p_necesidad;

  if v_ahora_cumplida then
    perform public.liberar_pagos_mp(p_necesidad);
  end if;
end $$;

create or replace function public.confirmar_entrega_pyme(p_necesidad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_familia_at timestamptz;
  v_pyme_ganadora uuid;
  v_ahora_cumplida boolean;
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

  v_ahora_cumplida := v_familia_at is not null;

  update public.necesidades
     set entrega_confirmada_pyme_at = now(),
         estado = case when v_ahora_cumplida then 'cumplida' else estado end,
         cumplida_at = case when v_ahora_cumplida then now() else cumplida_at end,
         cumplida_por = case when v_ahora_cumplida then auth.uid() else cumplida_por end,
         updated_at = now()
   where id = p_necesidad;

  if v_ahora_cumplida then
    perform public.liberar_pagos_mp(p_necesidad);
  end if;
end $$;
