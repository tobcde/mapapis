-- =========================================================================
-- 033_mp_oauth_linking.sql — Vinculacion OAuth de cuenta Mercado Pago del tutor
-- =========================================================================
-- Para que las familias del grupo puedan transferir directo al tutor del
-- cumpleañero (sobre digital, modelo "no custodio"), MaPaPis necesita
-- crear preferences en nombre de la cuenta MP del receptor.
--
-- El receptor linkea su cuenta MP via OAuth marketplace una sola vez. A
-- partir de ahi guardamos su access_token + refresh_token y lo usamos para
-- crear preferences con collector_id = receptor y marketplace_fee = 0.
--
-- Decision de seguridad:
--   - El access_token y el refresh_token NO son legibles por el cliente
--     autenticado (solo service role los lee desde Edge Functions).
--   - El cliente solo ve "estas vinculado: si/no" y "tu mp_user_id".
--   - Sin policy de SELECT explicita, RLS bloquea reads desde el FE.
--   - INSERT/UPDATE/DELETE solo via Edge Function (service role bypassea RLS).
-- =========================================================================

-- 1. Tabla
create table if not exists public.mp_linked_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  mp_user_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  public_key text,
  scopes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_mp_linked_mp_user
  on public.mp_linked_accounts (mp_user_id);

alter table public.mp_linked_accounts enable row level security;

-- 2. RLS: el cliente NO ve la fila completa. Sin policies, los reads desde
-- el FE quedan bloqueados. El service role (Edge Functions) bypassea RLS.

-- 3. RPC publica para que el cliente sepa si esta linkeado, sin exponer tokens.
create or replace function public.mi_mp_linked()
returns table (linked boolean, mp_user_id text, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return query select false, null::text, null::timestamptz;
    return;
  end if;

  return query
  select
    true as linked,
    m.mp_user_id,
    m.expires_at
  from public.mp_linked_accounts m
  where m.profile_id = auth.uid();

  if not found then
    return query select false, null::text, null::timestamptz;
  end if;
end; $$;

grant execute on function public.mi_mp_linked() to authenticated;

-- 4. RPC para que el cliente desvincule (no borra los sobres, solo desliga
-- la cuenta MP — futuras preferences fallarian sin fallback).
create or replace function public.mi_mp_unlink()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from public.mp_linked_accounts where profile_id = auth.uid();
end; $$;

grant execute on function public.mi_mp_unlink() to authenticated;

-- 5. Trigger updated_at
create or replace function public.tg_mp_linked_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_mp_linked_updated_at on public.mp_linked_accounts;
create trigger trg_mp_linked_updated_at
  before update on public.mp_linked_accounts
  for each row execute function public.tg_mp_linked_updated_at();

notify pgrst, 'reload schema';
