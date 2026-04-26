-- =========================================================================
-- dev_setup_pyme_oferta_test.sql — Atajo para testear el flow de pago MP
-- =========================================================================
-- DEV ONLY. Crea:
--   - 1 auth.user stub para una pyme fake
--   - profile + pyme record
--   - oferta a la necesidad mas reciente del grupo "Amarilla" (Olivos)
--   - adjudica la oferta (la marca ganadora + necesidad.estado=adjudicada)
--
-- Reusable: si re-ejecutas, usa ON CONFLICT y vuelve a setear lo mismo.
-- =========================================================================

do $$
declare
  v_pyme_uid uuid := '11111111-1111-1111-1111-111111111111';
  v_necesidad uuid;
  v_oferta uuid;
begin
  -- 1) auth.users stub
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_pyme_uid,
    'authenticated','authenticated',
    'pyme.test@mapapis.local',
    crypt('no-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nombre":"Pyme Test"}'::jsonb,
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  -- 2) profile
  insert into public.profiles (id, role, nombre, email)
  values (v_pyme_uid, 'pyme', 'Pyme Test', 'pyme.test@mapapis.local')
  on conflict (id) do update set role = 'pyme', nombre = excluded.nombre;

  -- 3) pyme record
  insert into public.pymes (profile_id, nombre_comercial, descripcion, telefono, zonas, tier)
  values (v_pyme_uid, 'Pyme Test SA', 'Pyme creada para testing del flow MP', '+541100000000', array['Olivos'], 1)
  on conflict (profile_id) do update
    set nombre_comercial = excluded.nombre_comercial,
        zonas = excluded.zonas;

  -- 4) buscar necesidad mas reciente
  select id into v_necesidad
    from public.necesidades
   order by created_at desc
   limit 1;

  if v_necesidad is null then
    raise exception 'No hay necesidades. Publica una desde la app primero.';
  end if;

  -- 5) crear oferta (idempotente por unique necesidad_id+pyme_id)
  insert into public.ofertas (
    necesidad_id, pyme_id, precio_total_centavos, descripcion, tiempo_entrega_dias, modo_entrega, estado
  ) values (
    v_necesidad, v_pyme_uid, 500000, 'Oferta de prueba: 10 mapas A4 plastificados.', 7, 'retiro', 'presentada'
  )
  on conflict (necesidad_id, pyme_id) do update
    set precio_total_centavos = excluded.precio_total_centavos,
        descripcion = excluded.descripcion,
        estado = 'presentada'
  returning id into v_oferta;

  if v_oferta is null then
    select id into v_oferta from public.ofertas
     where necesidad_id = v_necesidad and pyme_id = v_pyme_uid;
  end if;

  -- 6) adjudicar (bypass de la RPC porque corremos como service_role)
  update public.ofertas
     set estado = case when id = v_oferta then 'ganadora' else 'descartada' end
   where necesidad_id = v_necesidad
     and estado in ('presentada','ganadora');

  update public.necesidades
     set estado = 'adjudicada', updated_at = now()
   where id = v_necesidad;

  raise notice 'Listo. necesidad=%, oferta_ganadora=%', v_necesidad, v_oferta;
end $$;

-- Verificacion
select n.id, n.titulo, n.estado as nec_estado,
       o.id as oferta_id, o.estado as of_estado, o.precio_total_centavos
  from public.necesidades n
  left join public.ofertas o on o.necesidad_id = n.id
 order by n.created_at desc, o.created_at desc
 limit 5;
