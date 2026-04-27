-- =========================================================================
-- 036_ofertas_retiro_envio.sql — retiro inmediato + split retiro/envio
-- =========================================================================
-- Cambios al modelo de oferta:
--   1. retiro_inmediato (boolean): la pyme dice "tengo stock, retiro hoy".
--   2. precio_envio_centavos (bigint, >= 0): si la oferta incluye envio,
--      este es el costo adicional. precio_total_centavos = precio_retiro +
--      precio_envio (la familia paga el total).
--
-- Backwards compat: ofertas viejas quedan con retiro_inmediato=false y
-- precio_envio_centavos=0 (todo el total fue precio de retiro).
-- =========================================================================

alter table public.ofertas
  add column if not exists retiro_inmediato boolean not null default false;

alter table public.ofertas
  add column if not exists precio_envio_centavos bigint not null default 0;

alter table public.ofertas
  drop constraint if exists ofertas_precio_envio_chk;

alter table public.ofertas
  add constraint ofertas_precio_envio_chk
  check (precio_envio_centavos >= 0 and precio_envio_centavos <= precio_total_centavos);

-- Recrear crear_oferta con los nuevos parametros opcionales
drop function if exists public.crear_oferta(uuid, bigint, int, text, text);

create or replace function public.crear_oferta(
  p_necesidad uuid,
  p_precio_centavos bigint,         -- TOTAL (retiro + envio)
  p_tiempo_dias int,
  p_descripcion text,
  p_modo_entrega text default 'retiro',
  p_precio_envio_centavos bigint default 0,
  p_retiro_inmediato boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_estado text; v_id uuid; v_leak text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'pyme' then raise exception 'Solo pymes pueden ofertar'; end if;
  if not exists (select 1 from public.pymes where profile_id = auth.uid()) then
    raise exception 'Completa tu perfil de pyme antes de ofertar';
  end if;

  if p_modo_entrega is null or p_modo_entrega not in ('retiro','envio','ambos') then
    raise exception 'modo_entrega invalido (use retiro/envio/ambos)';
  end if;
  if p_precio_envio_centavos is null or p_precio_envio_centavos < 0 then
    raise exception 'precio_envio invalido';
  end if;
  if p_precio_envio_centavos > p_precio_centavos then
    raise exception 'precio_envio no puede ser mayor que el precio total';
  end if;

  v_leak := public.detectar_contacto_en_texto(p_descripcion);
  if v_leak is not null then
    raise exception '%', public.mensaje_leak(v_leak);
  end if;

  select estado into v_estado from public.necesidades where id = p_necesidad;
  if v_estado is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'recibiendo_ofertas' then
    raise exception 'La necesidad ya no acepta ofertas (estado: %)', v_estado;
  end if;

  insert into public.ofertas (
    necesidad_id, pyme_id, precio_total_centavos, tiempo_entrega_dias,
    descripcion, modo_entrega, precio_envio_centavos, retiro_inmediato
  )
  values (
    p_necesidad, auth.uid(), p_precio_centavos, p_tiempo_dias,
    p_descripcion, p_modo_entrega, p_precio_envio_centavos, coalesce(p_retiro_inmediato, false)
  )
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.crear_oferta(uuid, bigint, int, text, text, bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
