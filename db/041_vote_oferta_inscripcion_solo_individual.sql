-- =========================================================================
-- 041_vote_oferta_inscripcion_solo_individual.sql
-- =========================================================================
-- Bug: la version de vote_oferta corriendo en prod exige que el alumno
-- este en necesidad_inscripciones para poder votar, pero las necesidades
-- modalidad='grupal' NO tienen tabla de inscripcion (la RPC inscribir_alumno
-- expresamente las rechaza). Resultado: era imposible votar en grupales.
--
-- Fix: solo validar inscripcion cuando la necesidad es 'individual'.
-- =========================================================================

create or replace function public.vote_oferta(p_alumno uuid, p_oferta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_necesidad_id uuid;
  v_grupo_id uuid;
  v_estado text;
  v_modalidad text;
  v_es_tutor boolean;
  v_alumno_grupo uuid;
  v_n_tutores int;
  v_peso numeric(3,2);
  v_inscripto boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  -- Datos de la necesidad/oferta en una sola query
  select o.necesidad_id, n.grupo_id, n.estado, n.modalidad
    into v_necesidad_id, v_grupo_id, v_estado, v_modalidad
    from public.ofertas o
    join public.necesidades n on n.id = o.necesidad_id
   where o.id = p_oferta;

  if v_necesidad_id is null then
    raise exception 'Oferta no encontrada';
  end if;

  if v_estado not in ('recibiendo_ofertas', 'en_votacion') then
    raise exception 'La necesidad no esta en periodo de votacion (estado: %)', v_estado;
  end if;

  -- Tutor del alumno
  select exists (
    select 1 from public.alumno_tutores
    where alumno_id = p_alumno and profile_id = auth.uid()
  ) into v_es_tutor;
  if not v_es_tutor then
    raise exception 'No sos tutor de este alumno';
  end if;

  -- Alumno pertenece al grupo de la necesidad
  select grupo_id into v_alumno_grupo
    from public.alumnos where id = p_alumno;
  if v_alumno_grupo is null or v_alumno_grupo <> v_grupo_id then
    raise exception 'El alumno no pertenece al grupo de esta necesidad';
  end if;

  -- Solo en individual exigimos inscripcion previa.
  -- En grupal no hay tabla de inscripciones (todos los miembros participan).
  if v_modalidad = 'individual' then
    select exists (
      select 1 from public.necesidad_inscripciones
      where necesidad_id = v_necesidad_id and alumno_id = p_alumno
    ) into v_inscripto;
    if not v_inscripto then
      raise exception 'El alumno no esta inscripto en este pedido';
    end if;
  end if;

  -- Peso = 1 / cantidad de tutores del alumno (rebalance al sumarse otro tutor)
  select count(*) into v_n_tutores
    from public.alumno_tutores where alumno_id = p_alumno;
  v_peso := round(1.0 / greatest(v_n_tutores, 1), 2);

  -- Reemplazar voto previo del mismo tutor para el mismo alumno+necesidad
  delete from public.votos_oferta vo
   using public.ofertas o
   where vo.oferta_id = o.id
     and o.necesidad_id = v_necesidad_id
     and vo.votante_id = auth.uid()
     and vo.alumno_id = p_alumno;

  insert into public.votos_oferta (oferta_id, votante_id, alumno_id, peso)
  values (p_oferta, auth.uid(), p_alumno, v_peso);
end;
$$;

grant execute on function public.vote_oferta(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
