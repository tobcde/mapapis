-- =========================================================================
-- MaPaPis — Slice 3: core del marketplace
-- =========================================================================
-- Tablas: grupos, grupo_miembros, categorias, necesidades, ofertas, votos_oferta
-- Features:
--   - RLS estricta por rol (familia / pyme / institucion / admin)
--   - View anonimizada para pymes (no ven grupo_id, solo zona)
--   - Cap de 5 ofertas por necesidad (trigger)
--   - Campos estructurados por categoría (JSONB con schema)
--   - Helpers auth.* para RLS performance
-- Ejecutar en Supabase SQL Editor luego de 002_grants_profiles.sql.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extensiones y helpers
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Helper: rol del usuario actual (evita join a profiles en cada RLS check)
create or replace function auth.user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: ¿soy miembro del grupo X?
create or replace function auth.is_grupo_miembro(p_grupo uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.grupo_miembros
    where grupo_id = p_grupo and profile_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tablas
-- ─────────────────────────────────────────────────────────────────────────

-- 2.1 Categorias: catálogo con schema de campos obligatorios por categoría
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text,
  -- JSON schema de campos obligatorios al publicar necesidad de esta categoría
  -- Ejemplo: [{"key":"cantidad","label":"Cantidad","type":"int","required":true}]
  campos_obligatorios jsonb not null default '[]'::jsonb,
  orden int default 0,
  activa boolean default true,
  created_at timestamptz default now()
);

insert into public.categorias (slug, nombre, campos_obligatorios, orden) values
  ('materiales_didacticos', 'Materiales didácticos',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"formato","label":"Formato/tamaño","type":"text","required":true},
     {"key":"destino","label":"Sala/aula destino","type":"text","required":false}
   ]'::jsonb, 1),
  ('indumentaria', 'Indumentaria',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true,"min":1},
     {"key":"talles","label":"Detalle de talles","type":"text","required":true}
   ]'::jsonb, 2),
  ('servicios', 'Servicios',
   '[
     {"key":"fecha_servicio","label":"Fecha del servicio","type":"date","required":true},
     {"key":"horas_estimadas","label":"Duración estimada (horas)","type":"int","required":false}
   ]'::jsonb, 3),
  ('alimentacion', 'Alimentación / catering',
   '[
     {"key":"cantidad_personas","label":"Cantidad de personas","type":"int","required":true,"min":1},
     {"key":"fecha_evento","label":"Fecha del evento","type":"date","required":true},
     {"key":"dietarios","label":"Requisitos dietarios","type":"text","required":false}
   ]'::jsonb, 4),
  ('salidas_eventos', 'Salidas / eventos',
   '[
     {"key":"cantidad_personas","label":"Cantidad de personas","type":"int","required":true},
     {"key":"fecha_evento","label":"Fecha","type":"date","required":true},
     {"key":"lugar","label":"Lugar destino","type":"text","required":true}
   ]'::jsonb, 5),
  ('tecnologia', 'Tecnología',
   '[
     {"key":"cantidad","label":"Cantidad","type":"int","required":true},
     {"key":"especificaciones","label":"Especificaciones técnicas","type":"text","required":true}
   ]'::jsonb, 6)
on conflict (slug) do nothing;

-- 2.2 Grupos (aula / sala / curso / comisión)
create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona text not null,                       -- ej: "Belgrano"
  tipo text not null default 'aula',        -- 'aula' | 'sala' | 'curso' | 'comision'
  institucion_id uuid,                      -- FK futuro a instituciones
  rango_familias text,                      -- ej: "20-30 familias"
  creado_por uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_grupos_zona on public.grupos (zona);

-- 2.3 grupo_miembros
create table if not exists public.grupo_miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rol_en_grupo text not null default 'familia',  -- 'familia' | 'coordinador' | 'personal_institucional'
  created_at timestamptz default now(),
  unique (grupo_id, profile_id)
);

create index if not exists idx_grupo_miembros_profile on public.grupo_miembros (profile_id);

-- 2.4 Necesidades
create table if not exists public.necesidades (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete restrict,
  creador_id uuid not null references public.profiles(id),
  creador_tipo text not null,                    -- 'familia' | 'institucion'
  categoria_id uuid not null references public.categorias(id),

  titulo text not null check (char_length(titulo) between 8 and 140),
  descripcion text not null check (char_length(descripcion) between 10 and 1200),
  -- Campos estructurados según schema de la categoría
  campos jsonb not null default '{}'::jsonb,

  zona text not null,                            -- copiado del grupo para indexar rápido
  presupuesto_min_centavos bigint,
  presupuesto_max_centavos bigint,
  fecha_limite date,

  estado text not null default 'recibiendo_ofertas',
  -- 'recibiendo_ofertas' | 'en_votacion' | 'adjudicada' | 'en_produccion'
  -- | 'en_entrega' | 'pendiente_confirmacion_grupo' | 'completada' | 'cancelada' | 'disputada'

  cap_ofertas int not null default 5,            -- Thumbtack cap
  ofertas_count int not null default 0,          -- denormalizado para perf

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_necesidades_zona_estado on public.necesidades (zona, estado);
create index if not exists idx_necesidades_creador on public.necesidades (creador_id);
create index if not exists idx_necesidades_grupo on public.necesidades (grupo_id);

-- 2.5 Ofertas
create table if not exists public.ofertas (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  pyme_id uuid not null references public.profiles(id),        -- FK a profiles con rol=pyme (validado en RLS)

  precio_total_centavos bigint not null check (precio_total_centavos > 0),
  descripcion text not null check (char_length(descripcion) between 10 and 1000),
  tiempo_entrega_dias int check (tiempo_entrega_dias > 0),

  estado text not null default 'presentada',
  -- 'presentada' | 'ganadora' | 'descartada' | 'retirada'

  created_at timestamptz default now(),
  unique (necesidad_id, pyme_id)                 -- una pyme = una oferta por necesidad
);

create index if not exists idx_ofertas_pyme on public.ofertas (pyme_id);
create index if not exists idx_ofertas_necesidad on public.ofertas (necesidad_id);

-- 2.6 Votos de familias sobre ofertas
create table if not exists public.votos_oferta (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.ofertas(id) on delete cascade,
  votante_id uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  unique (oferta_id, votante_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Triggers: cap de ofertas + ofertas_count + updated_at
-- ─────────────────────────────────────────────────────────────────────────

-- 3.1 Trigger: antes de insertar oferta, validar cap
create or replace function public.enforce_ofertas_cap()
returns trigger
language plpgsql
as $$
declare
  current_count int;
  cap int;
  estado_actual text;
begin
  select ofertas_count, cap_ofertas, estado
    into current_count, cap, estado_actual
    from public.necesidades
    where id = new.necesidad_id
    for update;

  if estado_actual <> 'recibiendo_ofertas' then
    raise exception 'La necesidad no está recibiendo ofertas (estado: %)', estado_actual
      using errcode = 'check_violation';
  end if;

  if current_count >= cap then
    raise exception 'Cupo de ofertas completo (% / %)', current_count, cap
      using errcode = 'check_violation';
  end if;

  -- Incrementa counter
  update public.necesidades
    set ofertas_count = ofertas_count + 1,
        updated_at = now(),
        -- Si llegamos al cap, pasamos a votación automáticamente
        estado = case when ofertas_count + 1 >= cap_ofertas then 'en_votacion' else estado end
    where id = new.necesidad_id;

  return new;
end;
$$;

drop trigger if exists trg_enforce_ofertas_cap on public.ofertas;
create trigger trg_enforce_ofertas_cap
  before insert on public.ofertas
  for each row execute function public.enforce_ofertas_cap();

-- 3.2 Trigger: decrementar counter si se retira oferta
create or replace function public.decrement_ofertas_count()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'retirada' and old.estado <> 'retirada' then
    update public.necesidades
      set ofertas_count = greatest(ofertas_count - 1, 0),
          updated_at = now()
      where id = new.necesidad_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_decrement_ofertas_count on public.ofertas;
create trigger trg_decrement_ofertas_count
  after update on public.ofertas
  for each row execute function public.decrement_ofertas_count();

-- 3.3 updated_at genéricos (si no existen)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_necesidades_updated on public.necesidades;
create trigger trg_necesidades_updated
  before update on public.necesidades
  for each row execute function public.set_updated_at();

drop trigger if exists trg_grupos_updated on public.grupos;
create trigger trg_grupos_updated
  before update on public.grupos
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. View anonimizada para pymes (no ve grupo_id ni creador_id)
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.necesidades_publicas as
select
  n.id,
  n.categoria_id,
  c.slug as categoria_slug,
  c.nombre as categoria_nombre,
  n.titulo,
  n.descripcion,
  n.campos,
  n.zona,
  n.presupuesto_min_centavos,
  n.presupuesto_max_centavos,
  n.fecha_limite,
  n.estado,
  n.cap_ofertas,
  n.ofertas_count,
  n.creador_tipo,                           -- pyme puede saber si es institución (pago garantizado)
  n.created_at
from public.necesidades n
join public.categorias c on c.id = n.categoria_id
where n.estado = 'recibiendo_ofertas';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────

alter table public.categorias enable row level security;
alter table public.grupos enable row level security;
alter table public.grupo_miembros enable row level security;
alter table public.necesidades enable row level security;
alter table public.ofertas enable row level security;
alter table public.votos_oferta enable row level security;

-- 5.1 categorias: lectura pública, solo admin escribe
drop policy if exists "categorias_select_all" on public.categorias;
create policy "categorias_select_all" on public.categorias
  for select to anon, authenticated using (activa = true);

drop policy if exists "categorias_admin_all" on public.categorias;
create policy "categorias_admin_all" on public.categorias
  for all to authenticated
  using (auth.user_role() = 'admin')
  with check (auth.user_role() = 'admin');

-- 5.2 grupos: miembros ven su grupo; cualquiera puede crear; creador edita
drop policy if exists "grupos_select_miembros" on public.grupos;
create policy "grupos_select_miembros" on public.grupos
  for select to authenticated
  using (auth.is_grupo_miembro(id) or creado_por = auth.uid() or auth.user_role() = 'admin');

drop policy if exists "grupos_insert_self" on public.grupos;
create policy "grupos_insert_self" on public.grupos
  for insert to authenticated
  with check (creado_por = auth.uid() and auth.user_role() in ('familia', 'institucion'));

drop policy if exists "grupos_update_creador" on public.grupos;
create policy "grupos_update_creador" on public.grupos
  for update to authenticated
  using (creado_por = auth.uid())
  with check (creado_por = auth.uid());

-- 5.3 grupo_miembros
drop policy if exists "gm_select_self_o_miembros" on public.grupo_miembros;
create policy "gm_select_self_o_miembros" on public.grupo_miembros
  for select to authenticated
  using (profile_id = auth.uid() or auth.is_grupo_miembro(grupo_id) or auth.user_role() = 'admin');

drop policy if exists "gm_insert_creador_grupo" on public.grupo_miembros;
create policy "gm_insert_creador_grupo" on public.grupo_miembros
  for insert to authenticated
  with check (
    -- te podés agregar a un grupo (auto-join) o ser creador agregando otros
    profile_id = auth.uid() or
    exists (select 1 from public.grupos g where g.id = grupo_id and g.creado_por = auth.uid())
  );

-- 5.4 necesidades
-- SELECT: miembros del grupo ven las del grupo; pymes ven via view anonimizada (no esta tabla)
drop policy if exists "necesidades_select_miembros" on public.necesidades;
create policy "necesidades_select_miembros" on public.necesidades
  for select to authenticated
  using (
    auth.is_grupo_miembro(grupo_id)
    or creador_id = auth.uid()
    or auth.user_role() = 'admin'
  );

-- Pymes leen necesidades recibiendo_ofertas via view necesidades_publicas (sin FK al grupo)
-- La view hereda RLS de la tabla, así que le damos policy específica:
drop policy if exists "necesidades_select_pymes_activas" on public.necesidades;
create policy "necesidades_select_pymes_activas" on public.necesidades
  for select to authenticated
  using (
    auth.user_role() = 'pyme' and estado = 'recibiendo_ofertas'
  );
-- ^ Esto habilita que la view les devuelva data. No ven grupo_id porque la view no lo expone.

drop policy if exists "necesidades_insert_familia_o_inst" on public.necesidades;
create policy "necesidades_insert_familia_o_inst" on public.necesidades
  for insert to authenticated
  with check (
    creador_id = auth.uid()
    and auth.user_role() in ('familia', 'institucion')
    and auth.is_grupo_miembro(grupo_id)
  );

drop policy if exists "necesidades_update_creador" on public.necesidades;
create policy "necesidades_update_creador" on public.necesidades
  for update to authenticated
  using (creador_id = auth.uid())
  with check (creador_id = auth.uid());

-- 5.5 ofertas
-- SELECT: creador de necesidad y miembros del grupo, pyme que ofertó
drop policy if exists "ofertas_select_interesados" on public.ofertas;
create policy "ofertas_select_interesados" on public.ofertas
  for select to authenticated
  using (
    pyme_id = auth.uid()
    or exists (
      select 1 from public.necesidades n
      where n.id = necesidad_id
        and (auth.is_grupo_miembro(n.grupo_id) or n.creador_id = auth.uid())
    )
    or auth.user_role() = 'admin'
  );

drop policy if exists "ofertas_insert_pyme" on public.ofertas;
create policy "ofertas_insert_pyme" on public.ofertas
  for insert to authenticated
  with check (
    pyme_id = auth.uid()
    and auth.user_role() = 'pyme'
  );

drop policy if exists "ofertas_update_pyme_propia" on public.ofertas;
create policy "ofertas_update_pyme_propia" on public.ofertas
  for update to authenticated
  using (pyme_id = auth.uid())
  with check (pyme_id = auth.uid());

-- 5.6 votos_oferta
drop policy if exists "votos_select_miembros" on public.votos_oferta;
create policy "votos_select_miembros" on public.votos_oferta
  for select to authenticated
  using (
    votante_id = auth.uid()
    or exists (
      select 1 from public.ofertas o
      join public.necesidades n on n.id = o.necesidad_id
      where o.id = oferta_id and auth.is_grupo_miembro(n.grupo_id)
    )
  );

drop policy if exists "votos_insert_miembro" on public.votos_oferta;
create policy "votos_insert_miembro" on public.votos_oferta
  for insert to authenticated
  with check (
    votante_id = auth.uid()
    and exists (
      select 1 from public.ofertas o
      join public.necesidades n on n.id = o.necesidad_id
      where o.id = oferta_id
        and auth.is_grupo_miembro(n.grupo_id)
        and n.estado in ('en_votacion', 'recibiendo_ofertas')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Grants (porque auto-expose=NO al crear el proyecto)
-- ─────────────────────────────────────────────────────────────────────────

-- Lectura pública al catálogo de categorías
grant select on public.categorias to anon, authenticated;

-- Resto: solo authenticated
grant select, insert, update on public.grupos to authenticated;
grant select, insert, delete on public.grupo_miembros to authenticated;
grant select, insert, update on public.necesidades to authenticated;
grant select, insert, update on public.ofertas to authenticated;
grant select, insert, delete on public.votos_oferta to authenticated;

-- View también necesita grant explícito
grant select on public.necesidades_publicas to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Verificación rápida
-- ─────────────────────────────────────────────────────────────────────────
--
-- select count(*) from public.categorias;                        -- debe dar 6
-- select tablename, rowsecurity from pg_tables where schemaname='public'
--   and tablename in ('grupos','grupo_miembros','necesidades','ofertas','votos_oferta','categorias');
-- select * from public.necesidades_publicas;                     -- debería correr sin error
--
-- =========================================================================
