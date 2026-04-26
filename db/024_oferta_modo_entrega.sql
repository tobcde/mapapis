-- =========================================================================
-- 024_oferta_modo_entrega.sql — Modo de entrega en oferta
-- =========================================================================
-- La pyme debe declarar al ofertar si entrega:
--   - retiro: solo retiro en su local/dirección
--   - envio:  solo envío al domicilio del comprador
--   - ambos:  cualquiera de las dos
--
-- Esto le sirve a la familia para decidir antes de adjudicar.
-- =========================================================================

alter table public.ofertas
  add column if not exists modo_entrega text
    check (modo_entrega in ('retiro','envio','ambos'))
    default 'retiro';

-- Backfill: ofertas existentes quedan con default 'retiro'.

-- =========================================================================
-- Re-creamos crear_oferta con el nuevo parámetro
-- =========================================================================
drop function if exists public.crear_oferta(uuid, bigint, int, text);

create or replace function public.crear_oferta(
  p_necesidad uuid,
  p_precio_centavos bigint,
  p_tiempo_dias int,
  p_descripcion text,
  p_modo_entrega text default 'retiro'
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
    raise exception 'modo_entrega inválido (use retiro/envio/ambos)';
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
    necesidad_id, pyme_id, precio_total_centavos, tiempo_entrega_dias, descripcion, modo_entrega
  )
  values (p_necesidad, auth.uid(), p_precio_centavos, p_tiempo_dias, p_descripcion, p_modo_entrega)
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.crear_oferta(uuid, bigint, int, text, text) to authenticated;

notify pgrst, 'reload schema';
