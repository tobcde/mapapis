-- =========================================================================
-- 038_pyme_local_horarios_envios.sql — datos del local de la pyme
-- =========================================================================
-- Suma a la pyme los datos operativos que la familia necesita ver al
-- evaluar una oferta:
--   - direccion (privada hasta adjudicacion)
--   - local_a_la_calle (S/N)
--   - hace_envios (S/N)
--   - horarios (jsonb por dia con rangos multiples)
--
-- Las ofertas pueden sobreescribir local_a_la_calle, hace_envio y los
-- horarios del dia de entrega especificamente para ese pedido (NULL =
-- usar config actual de la pyme).
-- =========================================================================

-- 1. Pymes — campos nuevos
alter table public.pymes
  add column if not exists direccion text,
  add column if not exists local_a_la_calle boolean not null default false,
  add column if not exists hace_envios boolean not null default false,
  add column if not exists horarios jsonb not null default '{}'::jsonb;

-- 2. Ofertas — overrides nullable
alter table public.ofertas
  add column if not exists local_a_la_calle_override boolean,
  add column if not exists hace_envio_override boolean,
  add column if not exists horarios_dia_entrega_override jsonb;

-- 3. Trigger de validacion del jsonb de horarios (pyme)
-- Estructura esperada:
-- { "lun": {"abierto": bool, "rangos": [{"desde":"HH:MM","hasta":"HH:MM"}, ...]}, ...7 dias }
create or replace function public.tg_pymes_horarios_validate()
returns trigger language plpgsql as $$
declare
  v_dias text[] := array['lun','mar','mie','jue','vie','sab','dom'];
  v_dia text;
  v_obj jsonb;
  v_rangos jsonb;
  v_bad_count int;
begin
  if NEW.horarios is null or NEW.horarios = '{}'::jsonb then
    return NEW;
  end if;
  if jsonb_typeof(NEW.horarios) <> 'object' then
    raise exception 'horarios debe ser un objeto JSON';
  end if;

  foreach v_dia in array v_dias loop
    if not (NEW.horarios ? v_dia) then continue; end if;
    v_obj := NEW.horarios -> v_dia;
    if jsonb_typeof(v_obj) <> 'object' then
      raise exception 'horarios.% debe ser objeto', v_dia;
    end if;
    if not (v_obj ? 'abierto') or jsonb_typeof(v_obj -> 'abierto') <> 'boolean' then
      raise exception 'horarios.%.abierto debe ser boolean', v_dia;
    end if;
    v_rangos := v_obj -> 'rangos';
    if v_rangos is null or jsonb_typeof(v_rangos) <> 'array' then
      raise exception 'horarios.%.rangos debe ser array', v_dia;
    end if;
    if jsonb_array_length(v_rangos) > 4 then
      raise exception 'horarios.%.rangos: maximo 4 rangos por dia', v_dia;
    end if;
    select count(*) into v_bad_count
      from jsonb_array_elements(v_rangos) as r
     where jsonb_typeof(r) <> 'object'
        or (r ->> 'desde') !~ '^[0-2][0-9]:[0-5][0-9]$'
        or (r ->> 'hasta') !~ '^[0-2][0-9]:[0-5][0-9]$'
        or (r ->> 'desde') >= (r ->> 'hasta');
    if v_bad_count > 0 then
      raise exception 'horarios.%.rangos: cada rango debe ser {desde:"HH:MM", hasta:"HH:MM"} con desde < hasta', v_dia;
    end if;
  end loop;
  return NEW;
end; $$;

drop trigger if exists trg_pymes_horarios_validate on public.pymes;
create trigger trg_pymes_horarios_validate
  before insert or update of horarios on public.pymes
  for each row execute function public.tg_pymes_horarios_validate();

-- 4. Trigger de validacion del override de horarios en oferta (solo array de rangos)
create or replace function public.tg_ofertas_horarios_override_validate()
returns trigger language plpgsql as $$
declare
  v_bad_count int;
begin
  if NEW.horarios_dia_entrega_override is null then
    return NEW;
  end if;
  if jsonb_typeof(NEW.horarios_dia_entrega_override) <> 'array' then
    raise exception 'horarios_dia_entrega_override debe ser array';
  end if;
  if jsonb_array_length(NEW.horarios_dia_entrega_override) > 4 then
    raise exception 'horarios_dia_entrega_override: maximo 4 rangos';
  end if;
  select count(*) into v_bad_count
    from jsonb_array_elements(NEW.horarios_dia_entrega_override) as r
   where jsonb_typeof(r) <> 'object'
      or (r ->> 'desde') !~ '^[0-2][0-9]:[0-5][0-9]$'
      or (r ->> 'hasta') !~ '^[0-2][0-9]:[0-5][0-9]$'
      or (r ->> 'desde') >= (r ->> 'hasta');
  if v_bad_count > 0 then
    raise exception 'horarios_dia_entrega_override: cada rango {desde:"HH:MM", hasta:"HH:MM"} con desde < hasta';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_ofertas_horarios_override_validate on public.ofertas;
create trigger trg_ofertas_horarios_override_validate
  before insert or update of horarios_dia_entrega_override on public.ofertas
  for each row execute function public.tg_ofertas_horarios_override_validate();

-- 5. Re-crear actualizar_pyme con los 4 campos nuevos
drop function if exists public.actualizar_pyme(text, text, text, text[], text, text, uuid[], text, text, text, text, int, text, text);

create or replace function public.actualizar_pyme(
  p_nombre text,
  p_descripcion text default null,
  p_telefono text default null,
  p_zonas text[] default null,
  p_cuit text default null,
  p_razon_social text default null,
  p_categorias_ids uuid[] default null,
  p_web_url text default null,
  p_instagram text default null,
  p_facebook text default null,
  p_logo_url text default null,
  p_anios_rubro int default null,
  p_cbu text default null,
  p_alias_cbu text default null,
  p_direccion text default null,
  p_local_a_la_calle boolean default null,
  p_hace_envios boolean default null,
  p_horarios jsonb default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cuit_clean text;
  v_link_count int;
  v_leak text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'pyme' then raise exception 'Solo pymes'; end if;

  if p_nombre is null or char_length(trim(p_nombre)) < 2 then
    raise exception 'Nombre comercial requerido';
  end if;

  v_leak := public.detectar_contacto_en_texto(p_descripcion);
  if v_leak is not null then
    raise exception '%', public.mensaje_leak(v_leak);
  end if;

  v_cuit_clean := nullif(regexp_replace(coalesce(p_cuit,''), '[^0-9]', '', 'g'), '');
  if v_cuit_clean is not null and not public.validar_cuit(v_cuit_clean) then
    raise exception 'CUIT invalido';
  end if;

  v_link_count := (case when nullif(trim(coalesce(p_web_url,'')),'') is not null then 1 else 0 end)
                + (case when nullif(trim(coalesce(p_instagram,'')),'') is not null then 1 else 0 end)
                + (case when nullif(trim(coalesce(p_facebook,'')),'') is not null then 1 else 0 end);

  insert into public.pymes (
    profile_id, nombre_comercial, descripcion, telefono, zonas,
    cuit, razon_social, categorias_ids,
    web_url, instagram, facebook, logo_url, anios_rubro,
    cbu, alias_cbu,
    direccion, local_a_la_calle, hace_envios, horarios
  ) values (
    auth.uid(),
    trim(p_nombre),
    nullif(trim(coalesce(p_descripcion,'')),''),
    nullif(trim(coalesce(p_telefono,'')),''),
    coalesce(p_zonas, '{}'::text[]),
    v_cuit_clean,
    nullif(trim(coalesce(p_razon_social,'')),''),
    coalesce(p_categorias_ids, '{}'::uuid[]),
    nullif(trim(coalesce(p_web_url,'')),''),
    nullif(trim(coalesce(p_instagram,'')),''),
    nullif(trim(coalesce(p_facebook,'')),''),
    nullif(trim(coalesce(p_logo_url,'')),''),
    p_anios_rubro,
    nullif(trim(coalesce(p_cbu,'')),''),
    nullif(trim(coalesce(p_alias_cbu,'')),''),
    nullif(trim(coalesce(p_direccion,'')),''),
    coalesce(p_local_a_la_calle, false),
    coalesce(p_hace_envios, false),
    coalesce(p_horarios, '{}'::jsonb)
  )
  on conflict (profile_id) do update
    set nombre_comercial = excluded.nombre_comercial,
        descripcion = excluded.descripcion,
        telefono = excluded.telefono,
        zonas = excluded.zonas,
        cuit = coalesce(excluded.cuit, public.pymes.cuit),
        razon_social = coalesce(excluded.razon_social, public.pymes.razon_social),
        categorias_ids = excluded.categorias_ids,
        web_url = excluded.web_url,
        instagram = excluded.instagram,
        facebook = excluded.facebook,
        logo_url = coalesce(excluded.logo_url, public.pymes.logo_url),
        anios_rubro = coalesce(excluded.anios_rubro, public.pymes.anios_rubro),
        cbu = coalesce(excluded.cbu, public.pymes.cbu),
        alias_cbu = coalesce(excluded.alias_cbu, public.pymes.alias_cbu),
        direccion = coalesce(excluded.direccion, public.pymes.direccion),
        local_a_la_calle = coalesce(p_local_a_la_calle, public.pymes.local_a_la_calle),
        hace_envios = coalesce(p_hace_envios, public.pymes.hace_envios),
        horarios = coalesce(p_horarios, public.pymes.horarios),
        updated_at = now();
end; $$;

grant execute on function public.actualizar_pyme(
  text, text, text, text[], text, text, uuid[], text, text, text, text, int, text, text,
  text, boolean, boolean, jsonb
) to authenticated;

notify pgrst, 'reload schema';
