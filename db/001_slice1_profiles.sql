-- =========================================================================
-- MaPaPis — Slice 1: tabla profiles + RLS básica + trigger de autocreación
-- =========================================================================
-- Ejecutar en Supabase: SQL Editor → New query → pegar todo → Run.
-- Idempotente: se puede correr múltiples veces sin romper.
-- =========================================================================

-- 1. Tabla profiles
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'familia'
        check (role in ('familia', 'pyme', 'admin', 'institucion', 'personal_institucion')),
    nombre text,
    email text not null,
    telefono text,
    telefono_verificado boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Habilitar RLS
alter table public.profiles enable row level security;

-- 3. Policies: el usuario solo ve y edita su propio perfil
drop policy if exists "leer_propio_perfil" on public.profiles;
create policy "leer_propio_perfil"
    on public.profiles for select
    using (id = auth.uid());

drop policy if exists "actualizar_propio_perfil" on public.profiles;
create policy "actualizar_propio_perfil"
    on public.profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

-- 4. Trigger: cuando alguien se loguea por primera vez (entra a auth.users),
-- crear automáticamente su profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, nombre)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- 5. Updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- =========================================================================
-- LISTO. Probar con:
--   select * from public.profiles;   -- (debería estar vacía hasta que alguien se loguee)
-- =========================================================================
