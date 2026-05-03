-- =========================================================================
-- 043_cobranzas_rpcs.sql — RPCs del flujo de cobranza P2P
-- =========================================================================
-- Esta migracion expone las 5 acciones del flujo, todas como RPC security
-- definer porque la tabla cobranzas no tiene policies de write directas.
--
-- 1. asignar_cobrador(necesidad, cobrador, alias_opcional)
--    - Solo el creador del grupo (es_admin_grupo).
--    - Solo si la necesidad esta 'adjudicada' (ya hay oferta ganadora).
--    - Solo si todavia no hay cobrador asignado (no se puede reasignar
--      en MVP — para evitar movidas raras a mitad de cobranza).
--    - Calcula monto/alumno = round(precio_ganadora / N elegibles, centavos).
--      El ultimo absorbe el redondeo para que la suma cierre exacta.
--    - Si el cobrador es tutor de algun alumno elegible, esas cobranzas
--      arrancan ya en 'confirmado' (autoconfirmado).
--    - Si el cobrador no paso un alias, usa el alias_mp del perfil.
--    - Snapshot del alias en necesidades.cobrador_alias_snapshot.
--
-- 2. marcar_transferido(necesidad, alumno, comprobante_path?)
--    - Solo un tutor del alumno.
--    - Solo si la cobranza esta en 'pendiente' o ya 'transferido'
--      (idempotente: re-marcar actualiza fecha y comprobante).
--    - Setea estado 'transferido' + marcado_transferido_at/por.
--    - El comprobante_path es opcional (el bucket maneja la subida real).
--
-- 3. confirmar_pago(necesidad, alumno)
--    - Solo el cobrador asignado a la necesidad.
--    - Cualquier estado (pendiente o transferido) puede pasar a confirmado:
--      el cobrador ya vio la plata en su cuenta, no espera "ya transferi".
--    - Setea estado 'confirmado' + confirmado_at/por.
--
-- 4. revertir_confirmacion(necesidad, alumno)
--    - Solo el cobrador. Para el caso "lo confirme por error".
--    - Vuelve a 'pendiente' (decision: limpiar todo y arrancar de nuevo).
--    - Limpia confirmado_at/por + marcado_transferido_at/por.
--
-- 5. cerrar_cobranza_pyme(necesidad)
--    - Solo el cobrador.
--    - Solo si todas las cobranzas estan en 'confirmado'.
--    - Marca necesidades.pago_pyme_completado_at = now().
--    - En el futuro este RPC puede disparar el flujo MP marketplace.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. asignar_cobrador
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.asignar_cobrador(
  p_necesidad uuid,
  p_cobrador uuid,
  p_alias text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid;
  v_estado text;
  v_modalidad text;
  v_cobrador_actual uuid;
  v_es_miembro boolean;
  v_alias_final text;
  v_precio bigint;
  v_n_alumnos int;
  v_monto_base bigint;
  v_resto bigint;
  v_alumno_record record;
  v_idx int := 0;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  -- Validar necesidad y permisos
  select grupo_id, estado, modalidad, cobrador_id
    into v_grupo, v_estado, v_modalidad, v_cobrador_actual
    from public.necesidades
   where id = p_necesidad;

  if v_grupo is null then raise exception 'Necesidad no encontrada'; end if;

  if not public.es_admin_grupo(v_grupo, auth.uid()) then
    raise exception 'Solo el creador o admin del grupo puede asignar cobrador';
  end if;

  if v_estado <> 'adjudicada' then
    raise exception 'La necesidad debe estar adjudicada para asignar cobrador (actual: %)', v_estado;
  end if;

  if v_cobrador_actual is not null then
    raise exception 'Ya hay un cobrador asignado para esta necesidad';
  end if;

  -- Validar que el cobrador propuesto sea miembro del grupo
  select exists (
    select 1 from public.grupo_miembros
     where grupo_id = v_grupo and profile_id = p_cobrador
  ) into v_es_miembro;

  if not v_es_miembro then
    raise exception 'El cobrador debe ser miembro del grupo';
  end if;

  -- Resolver alias: parametro explicito > alias_mp del perfil
  v_alias_final := nullif(trim(coalesce(p_alias, '')), '');
  if v_alias_final is null then
    select alias_mp into v_alias_final from public.profiles where id = p_cobrador;
  end if;

  if v_alias_final is null then
    raise exception 'Falta el alias del cobrador (cargalo en su perfil o pasalo como parametro)';
  end if;

  -- Persistir alias en perfil del cobrador si todavia no tenia
  -- (asi la proxima vez ya esta precargado)
  update public.profiles
     set alias_mp = v_alias_final
   where id = p_cobrador and (alias_mp is null or alias_mp = '');

  -- Precio total de la oferta ganadora
  select precio_total_centavos into v_precio
    from public.ofertas
   where necesidad_id = p_necesidad and estado = 'ganadora'
   limit 1;

  if v_precio is null then
    raise exception 'No hay oferta ganadora para esta necesidad';
  end if;

  -- Calcular N alumnos elegibles segun modalidad
  if v_modalidad = 'individual' then
    select count(*) into v_n_alumnos
      from public.necesidad_inscripciones
     where necesidad_id = p_necesidad;
  else
    -- grupal: todos los alumnos del grupo
    select count(*) into v_n_alumnos
      from public.alumnos
     where grupo_id = v_grupo;
  end if;

  if v_n_alumnos = 0 then
    raise exception 'No hay alumnos elegibles para repartir el cobro';
  end if;

  -- Reparto: division entera + el ultimo absorbe el resto
  v_monto_base := v_precio / v_n_alumnos;
  v_resto := v_precio - (v_monto_base * v_n_alumnos);

  -- Snapshot en necesidades
  update public.necesidades
     set cobrador_id = p_cobrador,
         cobrador_alias_snapshot = v_alias_final,
         cobrador_asignado_at = now(),
         updated_at = now()
   where id = p_necesidad;

  -- Crear filas de cobranza por cada alumno elegible (orden estable por nombre)
  for v_alumno_record in
    select a.id, a.nombre,
           exists (
             select 1 from public.alumno_tutores t
              where t.alumno_id = a.id and t.profile_id = p_cobrador
           ) as cobrador_es_tutor
      from public.alumnos a
     where a.grupo_id = v_grupo
       and (
         v_modalidad <> 'individual'
         or exists (
           select 1 from public.necesidad_inscripciones ni
            where ni.necesidad_id = p_necesidad and ni.alumno_id = a.id
         )
       )
     order by a.nombre, a.id
  loop
    v_idx := v_idx + 1;

    insert into public.cobranzas (
      necesidad_id, alumno_id, monto_centavos,
      estado, confirmado_por, confirmado_at
    ) values (
      p_necesidad,
      v_alumno_record.id,
      -- El ultimo alumno absorbe el resto del redondeo
      case when v_idx = v_n_alumnos then v_monto_base + v_resto else v_monto_base end,
      case when v_alumno_record.cobrador_es_tutor then 'confirmado' else 'pendiente' end,
      case when v_alumno_record.cobrador_es_tutor then p_cobrador else null end,
      case when v_alumno_record.cobrador_es_tutor then now() else null end
    )
    on conflict (necesidad_id, alumno_id) do nothing;
  end loop;
end;
$$;

grant execute on function public.asignar_cobrador(uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. marcar_transferido (con comprobante opcional)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marcar_transferido(
  p_necesidad uuid,
  p_alumno uuid,
  p_comprobante_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_es_tutor boolean;
  v_estado_actual text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  -- Solo tutores del alumno pueden marcar
  select exists (
    select 1 from public.alumno_tutores
     where alumno_id = p_alumno and profile_id = auth.uid()
  ) into v_es_tutor;

  if not v_es_tutor then
    raise exception 'Solo un tutor del alumno puede marcar la transferencia';
  end if;

  select estado into v_estado_actual
    from public.cobranzas
   where necesidad_id = p_necesidad and alumno_id = p_alumno;

  if v_estado_actual is null then
    raise exception 'No hay cobranza para esta necesidad y alumno';
  end if;

  if v_estado_actual = 'confirmado' then
    raise exception 'Esta cobranza ya esta confirmada por el cobrador';
  end if;

  update public.cobranzas
     set estado = 'transferido',
         marcado_transferido_por = auth.uid(),
         marcado_transferido_at = now(),
         comprobante_path = coalesce(nullif(trim(p_comprobante_path), ''), comprobante_path),
         updated_at = now()
   where necesidad_id = p_necesidad and alumno_id = p_alumno;
end;
$$;

grant execute on function public.marcar_transferido(uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. confirmar_pago
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.confirmar_pago(
  p_necesidad uuid,
  p_alumno uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobrador_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select cobrador_id into v_cobrador_id
    from public.necesidades
   where id = p_necesidad;

  if v_cobrador_id is null then
    raise exception 'Esta necesidad no tiene cobrador asignado';
  end if;

  if v_cobrador_id <> auth.uid() then
    raise exception 'Solo el cobrador asignado puede confirmar pagos';
  end if;

  if not exists (
    select 1 from public.cobranzas
     where necesidad_id = p_necesidad and alumno_id = p_alumno
  ) then
    raise exception 'No hay cobranza para esta necesidad y alumno';
  end if;

  update public.cobranzas
     set estado = 'confirmado',
         confirmado_por = auth.uid(),
         confirmado_at = now(),
         updated_at = now()
   where necesidad_id = p_necesidad and alumno_id = p_alumno;
end;
$$;

grant execute on function public.confirmar_pago(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. revertir_confirmacion (undo, solo cobrador)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.revertir_confirmacion(
  p_necesidad uuid,
  p_alumno uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobrador_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select cobrador_id into v_cobrador_id
    from public.necesidades
   where id = p_necesidad;

  if v_cobrador_id is null or v_cobrador_id <> auth.uid() then
    raise exception 'Solo el cobrador asignado puede revertir confirmaciones';
  end if;

  update public.cobranzas
     set estado = 'pendiente',
         confirmado_por = null,
         confirmado_at = null,
         marcado_transferido_por = null,
         marcado_transferido_at = null,
         updated_at = now()
   where necesidad_id = p_necesidad and alumno_id = p_alumno;
end;
$$;

grant execute on function public.revertir_confirmacion(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. cerrar_cobranza_pyme: el cobrador marca "ya pague a la pyme"
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cerrar_cobranza_pyme(p_necesidad uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobrador_id uuid;
  v_pendientes int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select cobrador_id into v_cobrador_id
    from public.necesidades
   where id = p_necesidad;

  if v_cobrador_id is null then
    raise exception 'Esta necesidad no tiene cobrador asignado';
  end if;

  if v_cobrador_id <> auth.uid() then
    raise exception 'Solo el cobrador asignado puede cerrar la cobranza';
  end if;

  select count(*) into v_pendientes
    from public.cobranzas
   where necesidad_id = p_necesidad and estado <> 'confirmado';

  if v_pendientes > 0 then
    raise exception 'Quedan % cobranzas sin confirmar', v_pendientes;
  end if;

  update public.necesidades
     set pago_pyme_completado_at = now(),
         updated_at = now()
   where id = p_necesidad;
end;
$$;

grant execute on function public.cerrar_cobranza_pyme(uuid) to authenticated;

notify pgrst, 'reload schema';
