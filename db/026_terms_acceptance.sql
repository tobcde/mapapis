-- =========================================================================
-- 026_terms_acceptance.sql — Aceptación de Términos y Condiciones
-- =========================================================================
-- Cada usuario debe aceptar los T&C antes de operar. Guardamos la versión
-- aceptada (string libre del lado FE) y el timestamp. Cuando publiquemos
-- una versión nueva con cambios materiales, podemos compararlo contra
-- la versión vigente y forzar re-aceptación.
-- =========================================================================

alter table public.profiles
  add column if not exists terms_version_aceptada text,
  add column if not exists terms_accepted_at      timestamptz;

-- =========================================================================
-- RPC: aceptar_terminos
-- =========================================================================
-- Cliente llama esto cuando el usuario tilda la casilla y sigue.
-- Idempotente: si ya hay una aceptación previa, la pisa con la nueva versión.
-- =========================================================================
create or replace function public.aceptar_terminos(p_version text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_version is null or length(trim(p_version)) = 0 then
    raise exception 'version requerida';
  end if;

  update public.profiles
     set terms_version_aceptada = p_version,
         terms_accepted_at      = now()
   where id = auth.uid();
end; $$;

grant execute on function public.aceptar_terminos(text) to authenticated;

notify pgrst, 'reload schema';
