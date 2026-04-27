-- =========================================================================
-- 037_oferta_variantes.sql — variantes de producto dentro de la oferta
-- =========================================================================
-- La pyme puede ofrecer mas de una variante del mismo producto en una
-- sola oferta. Ej: "cuaderno tapa dura $800" + "cuaderno tapa flexible $500"
-- + "cuaderno con dibujo $1200" — la familia ve las tres opciones con
-- su precio individual.
--
-- Cada variante puede tener: nombre, precio_centavos (unitario), cantidad
-- (default 1), descripcion opcional, foto_url, link_url.
--
-- precio_total_centavos sigue siendo lo que la pyme efectivamente cobra
-- por toda la oferta (suma de variantes × cantidad). El FE lo calcula y
-- la DB confia en el numero (no podemos validar dinamicamente sin
-- duplicar logica).
-- =========================================================================

alter table public.ofertas
  add column if not exists variantes jsonb not null default '[]'::jsonb;

alter table public.ofertas
  drop constraint if exists ofertas_variantes_array_chk;

alter table public.ofertas
  add constraint ofertas_variantes_array_chk
  check (
    jsonb_typeof(variantes) = 'array'
    and jsonb_array_length(variantes) <= 10
  );

-- Trigger: validacion por-variante (nombre no vacio, precio_centavos > 0).
-- Las URL son opcionales pero si vienen tienen que ser http(s).
create or replace function public.tg_ofertas_variantes_validate()
returns trigger language plpgsql as $$
declare
  v_bad_count int;
begin
  if NEW.variantes is null or jsonb_array_length(NEW.variantes) = 0 then
    return NEW;
  end if;

  select count(*)
    into v_bad_count
    from jsonb_array_elements(NEW.variantes) as v
   where jsonb_typeof(v) <> 'object'
      or jsonb_typeof(v->'nombre') <> 'string'
      or coalesce(length(trim(v->>'nombre')), 0) = 0
      or jsonb_typeof(v->'precio_centavos') <> 'number'
      or coalesce((v->>'precio_centavos')::numeric, 0) <= 0
      or (v->>'precio_centavos')::numeric <> floor((v->>'precio_centavos')::numeric)
      or (jsonb_typeof(coalesce(v->'cantidad', '1'::jsonb)) = 'number'
          and coalesce((v->>'cantidad')::numeric, 1) <= 0)
      or (v ? 'foto_url'  and v->>'foto_url'  is not null and (v->>'foto_url')  !~ '^https?://')
      or (v ? 'link_url'  and v->>'link_url'  is not null and (v->>'link_url')  !~ '^https?://');

  if v_bad_count > 0 then
    raise exception
      'variantes invalido: cada item debe tener {nombre: string no vacio, precio_centavos: entero > 0, cantidad?: > 0, foto_url?, link_url? http(s)}';
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_ofertas_variantes_validate on public.ofertas;
create trigger trg_ofertas_variantes_validate
  before insert or update of variantes on public.ofertas
  for each row execute function public.tg_ofertas_variantes_validate();

-- Recrear crear_oferta con p_variantes (default '[]')
drop function if exists public.crear_oferta(uuid, bigint, int, text, text, bigint, boolean);

create or replace function public.crear_oferta(
  p_necesidad uuid,
  p_precio_centavos bigint,
  p_tiempo_dias int,
  p_descripcion text,
  p_modo_entrega text default 'retiro',
  p_precio_envio_centavos bigint default 0,
  p_retiro_inmediato boolean default false,
  p_variantes jsonb default '[]'::jsonb
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

  select estado into v_estado from public.necesidades where id = p_necesidad;
  if v_estado is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'recibiendo_ofertas' then
    raise exception 'La necesidad ya no acepta ofertas (estado: %)', v_estado;
  end if;

  insert into public.ofertas (
    necesidad_id, pyme_id, precio_total_centavos, tiempo_entrega_dias,
    descripcion, modo_entrega, precio_envio_centavos, retiro_inmediato,
    variantes
  )
  values (
    p_necesidad, auth.uid(), p_precio_centavos, p_tiempo_dias,
    p_descripcion, p_modo_entrega, p_precio_envio_centavos,
    coalesce(p_retiro_inmediato, false),
    coalesce(p_variantes, '[]'::jsonb)
  )
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.crear_oferta(uuid, bigint, int, text, text, bigint, boolean, jsonb) to authenticated;

notify pgrst, 'reload schema';
