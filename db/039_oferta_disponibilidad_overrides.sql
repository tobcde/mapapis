-- =========================================================================
-- 039_oferta_disponibilidad_overrides.sql — overrides de disponibilidad
-- =========================================================================
-- Extiende crear_oferta con los 3 overrides de disponibilidad introducidos
-- en 038 + un campo nuevo `notas_disponibilidad` (texto libre, opcional)
-- para que la pyme aclare cierres puntuales (feriados, etc.) sin tener que
-- meterlo en la descripcion del producto.
-- =========================================================================

alter table public.ofertas
  add column if not exists notas_disponibilidad text;

drop function if exists public.crear_oferta(uuid, bigint, int, text, text, bigint, boolean, jsonb);

create or replace function public.crear_oferta(
  p_necesidad uuid,
  p_precio_centavos bigint,
  p_tiempo_dias int,
  p_descripcion text,
  p_modo_entrega text default 'retiro',
  p_precio_envio_centavos bigint default 0,
  p_retiro_inmediato boolean default false,
  p_variantes jsonb default '[]'::jsonb,
  p_local_a_la_calle_override boolean default null,
  p_hace_envio_override boolean default null,
  p_horarios_dia_entrega_override jsonb default null,
  p_notas_disponibilidad text default null
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
  if jsonb_typeof(coalesce(p_variantes, '[]'::jsonb)) <> 'array' then
    raise exception 'variantes debe ser un array';
  end if;
  if jsonb_array_length(coalesce(p_variantes, '[]'::jsonb)) > 10 then
    raise exception 'Maximo 10 variantes por oferta';
  end if;

  v_leak := public.detectar_contacto_en_texto(p_descripcion);
  if v_leak is not null then
    raise exception '%', public.mensaje_leak(v_leak);
  end if;

  -- La nota de disponibilidad tambien pasa por el sanitizador (no datos de contacto)
  if p_notas_disponibilidad is not null then
    v_leak := public.detectar_contacto_en_texto(p_notas_disponibilidad);
    if v_leak is not null then
      raise exception '%', public.mensaje_leak(v_leak);
    end if;
  end if;

  select estado into v_estado from public.necesidades where id = p_necesidad;
  if v_estado is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'recibiendo_ofertas' then
    raise exception 'La necesidad ya no acepta ofertas (estado: %)', v_estado;
  end if;

  insert into public.ofertas (
    necesidad_id, pyme_id, precio_total_centavos, tiempo_entrega_dias,
    descripcion, modo_entrega, precio_envio_centavos, retiro_inmediato,
    variantes,
    local_a_la_calle_override, hace_envio_override,
    horarios_dia_entrega_override, notas_disponibilidad
  )
  values (
    p_necesidad, auth.uid(), p_precio_centavos, p_tiempo_dias,
    p_descripcion, p_modo_entrega, p_precio_envio_centavos,
    coalesce(p_retiro_inmediato, false),
    coalesce(p_variantes, '[]'::jsonb),
    p_local_a_la_calle_override,
    p_hace_envio_override,
    p_horarios_dia_entrega_override,
    nullif(trim(coalesce(p_notas_disponibilidad,'')),'')
  )
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.crear_oferta(
  uuid, bigint, int, text, text, bigint, boolean, jsonb,
  boolean, boolean, jsonb, text
) to authenticated;

notify pgrst, 'reload schema';
