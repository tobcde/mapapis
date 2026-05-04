-- =========================================================================
-- 042_cobranzas_schema.sql — Esquema base del flujo de cobranza P2P
-- =========================================================================
-- Contexto:
--   La pyme ganadora cobra fuera de la app (transferencia, efectivo, MP).
--   Hoy la app no rastrea quien pago. Esto crea una capa paralela:
--
--     - Un miembro del grupo (el "cobrador") junta la plata.
--     - Cada familia transfiere al cobrador (off-app, alias bancario).
--     - La app rastrea estados: pendiente -> transferido -> confirmado.
--     - Doble confirmacion: el pagador marca "ya transferi", el cobrador
--       confirma "lo recibi". Solo confirmados cuentan en la barra.
--
-- Decisiones clave (charladas con producto):
--   - Cobrador asignado por el creador del grupo, por necesidad (rota).
--   - Cobranza por ALUMNO (no por profile): si un nene tiene 2 tutores,
--     ambos ven el mismo boton "ya transferi", arreglan offline quien apreta.
--   - Cobrador queda autoconfirmado al ser asignado (no se transfiere a si mismo).
--   - Monto = total_oferta_ganadora / N alumnos elegibles, snapshot al asignar.
--     Para individual: N = inscriptos. Para grupal: N = todos los alumnos del grupo.
--   - Reusamos profiles.alias_mp (existe desde mig 031, mismo concepto).
--
-- Lo que NO incluye esta migracion:
--   - RPCs (van en 043).
--   - Comprobante: la columna existe; el bucket Storage va aparte.
--   - Estados nuevos en necesidades: no toco ese ciclo. La cobranza es
--     una capa paralela; la necesidad puede seguir su flujo en paralelo.
--
-- Compatibilidad con `necesidad_pagos` (mig 016):
--   `necesidad_pagos` queda como tabla legacy (auto-reporte sin doble
--   confirmacion). No se usa en el FE actual. La dejamos viva por ahora
--   para no romper nada; se puede deprecar despues.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columnas en necesidades para identificar al cobrador
-- ─────────────────────────────────────────────────────────────────────────
-- cobrador_alias_snapshot:
--   tomamos snapshot al asignar para que si el cobrador edita su alias_mp
--   despues, las cobranzas en curso sigan mostrando el alias original
--   con el que arranco la operacion (auditoria).

alter table public.necesidades
  add column if not exists cobrador_id uuid references public.profiles(id),
  add column if not exists cobrador_alias_snapshot text,
  add column if not exists cobrador_asignado_at timestamptz,
  add column if not exists pago_pyme_completado_at timestamptz;

create index if not exists idx_necesidades_cobrador
  on public.necesidades (cobrador_id)
  where cobrador_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tabla cobranzas (1 fila por necesidad x alumno elegible)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.cobranzas (
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,

  monto_centavos bigint not null check (monto_centavos > 0),

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'transferido', 'confirmado')),

  -- Path en bucket Storage 'comprobantes'. Null si no se adjunto comprobante.
  comprobante_path text,

  -- Quien apreto "ya transferi" (cualquier tutor del alumno)
  marcado_transferido_por uuid references public.profiles(id),
  marcado_transferido_at timestamptz,

  -- Quien confirmo (siempre el cobrador asignado a la necesidad)
  confirmado_por uuid references public.profiles(id),
  confirmado_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (necesidad_id, alumno_id)
);

create index if not exists idx_cobranzas_necesidad on public.cobranzas (necesidad_id);
create index if not exists idx_cobranzas_alumno on public.cobranzas (alumno_id);
create index if not exists idx_cobranzas_estado on public.cobranzas (necesidad_id, estado);

drop trigger if exists trg_cobranzas_updated on public.cobranzas;
create trigger trg_cobranzas_updated
  before update on public.cobranzas
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS: solo miembros del grupo pueden ver las cobranzas
--    Inserts/updates SOLO via RPCs (security definer). No exponemos
--    INSERT/UPDATE/DELETE directos para evitar bypass de la logica.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.cobranzas enable row level security;

drop policy if exists "cobranzas_select_miembros" on public.cobranzas;
create policy "cobranzas_select_miembros" on public.cobranzas
  for select to authenticated
  using (
    exists (
      select 1 from public.necesidades n
      where n.id = cobranzas.necesidad_id
        and (
          public.is_grupo_miembro(n.grupo_id)
          or public.user_role() = 'admin'
        )
    )
  );

-- Sin policies de INSERT/UPDATE/DELETE: solo se modifica via RPCs definer.
-- Esto es deliberado: que un miembro pueda leer no implica que pueda
-- modificar arbitrariamente; las transiciones de estado son sensibles.

-- Grants minimos: select para autenticados (RLS filtra). El resto entra via RPC.
grant select on public.cobranzas to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. View resumen para el FE: barra de progreso + total recolectado
--    Devuelve un row por necesidad con cobrador + agregados.
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.cobranzas_resumen as
select
  n.id as necesidad_id,
  n.cobrador_id,
  n.cobrador_alias_snapshot,
  n.cobrador_asignado_at,
  n.pago_pyme_completado_at,
  coalesce(p.nombre, split_part(p.email, '@', 1)) as cobrador_nombre,
  count(c.*)::int as total,
  count(*) filter (where c.estado = 'confirmado')::int as confirmadas,
  count(*) filter (where c.estado = 'transferido')::int as transferidas,
  count(*) filter (where c.estado = 'pendiente')::int as pendientes,
  coalesce(sum(c.monto_centavos), 0)::bigint as total_esperado_centavos,
  coalesce(sum(c.monto_centavos) filter (where c.estado = 'confirmado'), 0)::bigint
    as total_recolectado_centavos
from public.necesidades n
left join public.profiles p on p.id = n.cobrador_id
left join public.cobranzas c on c.necesidad_id = n.id
where n.cobrador_id is not null
group by n.id, p.nombre, p.email;

grant select on public.cobranzas_resumen to authenticated;

notify pgrst, 'reload schema';
