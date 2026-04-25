-- =========================================================================
-- MaPaPis — Sprint 1 #7: Sanitizacion anti-leak en descripciones publicas
-- =========================================================================
-- Objetivo: bloquear que pymes (o cualquier autor de texto publico) inserten
-- telefono / email / CBU / handles / URLs en la descripcion de la oferta o
-- en el perfil publico, para que no salten la plataforma. Esto es critico
-- ahora que el modelo objetivo es escrow on-platform — si la pyme deja su
-- WhatsApp en la descripcion, la familia puede pagar afuera y no cobramos
-- comision.
--
-- Implementacion:
--   - Funcion detectar_contacto_en_texto() retorna null si OK, o un codigo
--     de leak ('telefono','email','cbu','url','handle') si encuentra algo.
--   - Aplicada en crear_oferta, actualizar_pyme, crear_review_pyme.
--   - El FE replica las mismas reglas para feedback inmediato.
-- =========================================================================

create or replace function public.detectar_contacto_en_texto(p_texto text)
returns text
language plpgsql immutable
as $$
declare
  v text := coalesce(p_texto, '');
  v_norm text;
  v_digits text;
begin
  if length(v) = 0 then return null; end if;

  -- Email: caracteres validos antes y despues de @, dominio con punto
  if v ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    return 'email';
  end if;

  -- URL: http(s)://, www.
  if v ~* '(https?://|www\.)[a-z0-9]' then
    return 'url';
  end if;

  -- Handles tipicos de redes / WhatsApp links
  if v ~* '(wa\.me/|t\.me/|@[a-z0-9._]{3,}|instagram\.com|facebook\.com|tiktok\.com|whatsapp)' then
    return 'handle';
  end if;

  -- Numeros: extraer solo digitos preservando separacion de "palabras"
  -- (lo que importa es: hay una corrida larga de digitos que parece tel/CBU?)
  v_norm := regexp_replace(v, '[\s\-\(\)\.\+]', '', 'g');

  -- CBU: 22 digitos consecutivos
  if v_norm ~ '[0-9]{22}' then
    return 'cbu';
  end if;

  -- Telefono: 8+ digitos consecutivos (cubre celulares argentinos con/sin
  -- 54 9 11). Cuidado con falsos positivos en cantidades, pero descripcion
  -- de oferta no deberia tener "12345678 unidades" — y si pasa, igual mejor
  -- que se rompa que dejar pasar un telefono.
  if v_norm ~ '[0-9]{8,}' then
    return 'telefono';
  end if;

  return null;
end $$;

grant execute on function public.detectar_contacto_en_texto(text) to authenticated;

-- =========================================================================
-- Helper para mensaje al usuario
-- =========================================================================
create or replace function public.mensaje_leak(p_codigo text)
returns text
language sql immutable
as $$
  select case p_codigo
    when 'telefono' then 'No se permiten numeros de telefono en la descripcion (mantenemos el contacto dentro de la plataforma).'
    when 'email' then 'No se permiten emails en la descripcion.'
    when 'cbu' then 'No se permiten CBU/CVU en la descripcion (los datos de pago se intercambian al adjudicar).'
    when 'url' then 'No se permiten links en la descripcion.'
    when 'handle' then 'No se permiten handles de redes ni links de WhatsApp en la descripcion.'
    else 'La descripcion contiene datos de contacto no permitidos.'
  end;
$$;

-- =========================================================================
-- Re-creamos crear_oferta con validacion
-- =========================================================================
create or replace function public.crear_oferta(
  p_necesidad uuid,
  p_precio_centavos bigint,
  p_tiempo_dias int,
  p_descripcion text
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

  -- Sanitizacion anti-leak (no se puede dejar telefono/email/CBU en descripcion)
  v_leak := public.detectar_contacto_en_texto(p_descripcion);
  if v_leak is not null then
    raise exception '%', public.mensaje_leak(v_leak);
  end if;

  select estado into v_estado from public.necesidades where id = p_necesidad;
  if v_estado is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'recibiendo_ofertas' then
    raise exception 'La necesidad ya no acepta ofertas (estado: %)', v_estado;
  end if;

  insert into public.ofertas (necesidad_id, pyme_id, precio_total_centavos, tiempo_entrega_dias, descripcion)
  values (p_necesidad, auth.uid(), p_precio_centavos, p_tiempo_dias, p_descripcion)
  returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.crear_oferta(uuid, bigint, int, text) to authenticated;

-- =========================================================================
-- Re-creamos actualizar_pyme con validacion en descripcion
-- (mantenemos la misma firma de 014 para no romper FE)
-- =========================================================================
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
  p_alias_cbu text default null
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

  -- Sanitizacion: descripcion de pyme NO puede tener telefono/email/CBU/handle/url
  -- (los campos correctos estan separados: p_telefono, p_web_url, p_instagram, etc)
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
    cbu, alias_cbu
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
    nullif(trim(coalesce(p_alias_cbu,'')),'')
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
        updated_at = now();
end; $$;

grant execute on function public.actualizar_pyme(text, text, text, text[], text, text, uuid[], text, text, text, text, int, text, text) to authenticated;

-- =========================================================================
-- Re-creamos crear_review_pyme con validacion en comentario
-- =========================================================================
create or replace function public.crear_review_pyme(
  p_necesidad uuid,
  p_estrellas int,
  p_comentario text default null
)
returns public.reviews_pyme
language plpgsql security definer set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_estado text;
  v_pyme_id uuid;
  v_review public.reviews_pyme;
  v_leak text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then
    raise exception 'estrellas debe estar entre 1 y 5';
  end if;

  -- El comentario tampoco puede tener datos de contacto (las familias podrian
  -- usar reviews para difundir su propio numero, etc)
  v_leak := public.detectar_contacto_en_texto(p_comentario);
  if v_leak is not null then
    raise exception '%', public.mensaje_leak(v_leak);
  end if;

  select grupo_id, estado into v_grupo_id, v_estado
    from public.necesidades where id = p_necesidad;
  if v_grupo_id is null then raise exception 'Necesidad no encontrada'; end if;
  if v_estado <> 'cumplida' then
    raise exception 'Solo se puede calificar cuando la necesidad esta cumplida (estado actual: %)', v_estado;
  end if;

  if not public.is_grupo_miembro(v_grupo_id) then
    raise exception 'Solo los miembros del grupo pueden calificar';
  end if;

  select pyme_id into v_pyme_id from public.ofertas
    where necesidad_id = p_necesidad and estado = 'ganadora' limit 1;
  if v_pyme_id is null then raise exception 'No hay oferta ganadora para esta necesidad'; end if;

  if v_pyme_id = auth.uid() then
    raise exception 'No podes calificarte a vos mismo';
  end if;

  insert into public.reviews_pyme (necesidad_id, pyme_id, autor_id, estrellas, comentario)
  values (p_necesidad, v_pyme_id, auth.uid(), p_estrellas,
          nullif(trim(coalesce(p_comentario,'')), ''))
  on conflict (necesidad_id, autor_id) do update
    set estrellas = excluded.estrellas,
        comentario = excluded.comentario
  returning * into v_review;

  return v_review;
end $$;

grant execute on function public.crear_review_pyme(uuid, int, text) to authenticated;
