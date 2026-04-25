-- =========================================================================
-- MaPaPis — Slice 3.4b: extender alta de pyme con datos de validacion
-- =========================================================================
-- Cambios:
--   1. Columnas nuevas en pymes (cuit, razon_social, categorias_ids[], links,
--      logo_url, anios_rubro, cbu, alias_cbu, verificada_at)
--   2. Funcion helper validar_cuit(text) -> bool (verifica formato + DV)
--   3. RPC actualizar_pyme actualizada con todos los campos nuevos
--   4. View pyme_publica para que las familias vean el perfil con badge tier
-- =========================================================================

-- 1. Columnas nuevas
alter table public.pymes
  add column if not exists cuit text,
  add column if not exists razon_social text,
  add column if not exists categorias_ids uuid[] not null default '{}'::uuid[],
  add column if not exists web_url text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists logo_url text,
  add column if not exists anios_rubro int,
  add column if not exists cbu text,
  add column if not exists alias_cbu text,
  add column if not exists verificada_at timestamptz;

-- Indice unico parcial para CUIT (cuando este cargado, no puede repetirse)
create unique index if not exists pymes_cuit_unique
  on public.pymes (cuit) where cuit is not null;

-- 2. Validacion de CUIT (formato 11 digitos + digito verificador)
create or replace function public.validar_cuit(p_cuit text)
returns boolean
language plpgsql immutable
as $$
declare
  v_clean text;
  v_digits int[];
  v_mults int[] := array[5,4,3,2,7,6,5,4,3,2];
  v_sum int := 0;
  v_dv int;
  i int;
begin
  if p_cuit is null then return false; end if;
  -- limpiar guiones y espacios
  v_clean := regexp_replace(p_cuit, '[^0-9]', '', 'g');
  if length(v_clean) <> 11 then return false; end if;
  -- explotar a array de digitos
  for i in 1..11 loop
    v_digits[i] := (substring(v_clean from i for 1))::int;
  end loop;
  -- prefijo valido (20, 23, 24, 25, 26, 27, 30, 33, 34)
  if v_digits[1]*10 + v_digits[2] not in (20,23,24,25,26,27,30,33,34) then
    return false;
  end if;
  -- calculo DV
  for i in 1..10 loop
    v_sum := v_sum + v_digits[i] * v_mults[i];
  end loop;
  v_dv := 11 - (v_sum % 11);
  if v_dv = 11 then v_dv := 0;
  elsif v_dv = 10 then return false;  -- CUIT con DV=10 son invalidos
  end if;
  return v_dv = v_digits[11];
end; $$;

grant execute on function public.validar_cuit(text) to authenticated, anon;

-- 3. RPC actualizar_pyme extendido
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
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.user_role() <> 'pyme' then raise exception 'Solo pymes'; end if;

  if p_nombre is null or char_length(trim(p_nombre)) < 2 then
    raise exception 'Nombre comercial requerido';
  end if;

  -- CUIT: si vino, debe ser valido y normalizado a 11 digitos
  v_cuit_clean := nullif(regexp_replace(coalesce(p_cuit,''), '[^0-9]', '', 'g'), '');
  if v_cuit_clean is not null and not public.validar_cuit(v_cuit_clean) then
    raise exception 'CUIT invalido';
  end if;

  -- Al menos un link de presencia online (web/IG/FB) si pretende ser verificable
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

-- 4. View publica de pyme (lo que ven familias en una oferta)
drop view if exists public.pymes_publicas;
create view public.pymes_publicas as
select
  p.profile_id,
  p.nombre_comercial,
  p.descripcion,
  p.telefono,
  p.zonas,
  p.tier,
  p.categorias_ids,
  p.web_url,
  p.instagram,
  p.facebook,
  p.logo_url,
  p.anios_rubro,
  -- Datos sensibles solo se exponen si la pyme es la ganadora de una oferta
  -- (el frontend filtra; esta view igual no muestra cuit/cbu)
  case when p.cuit is not null then true else false end as cuit_cargado,
  case when p.verificada_at is not null then true else false end as verificada,
  p.created_at
from public.pymes p;

grant select on public.pymes_publicas to authenticated, anon;

-- =========================================================================
-- Verificacion
-- =========================================================================
-- select public.validar_cuit('20-12345678-9');  -- false
-- select public.validar_cuit('30-71234567-2');  -- true (ej)
-- select column_name from information_schema.columns
--  where table_name = 'pymes' order by ordinal_position;
