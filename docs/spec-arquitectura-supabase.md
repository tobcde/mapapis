# Especificación técnica — Arquitectura MaPaPis sobre Supabase

> Define el stack completo, modelo de datos, seguridad (RLS), flujos de comunicación y mecanismos anti-bypass para la plataforma MaPaPis.
> Complementa [spec-pymes-ratings.md](spec-pymes-ratings.md), que cubre validación de pymes y sistema de ratings en detalle.

---

## 1. Stack final

| Capa | Tecnología | Por qué |
|------|------------|---------|
| **Frontend** | HTML + React 18 UMD + Tailwind CDN + Babel standalone (un solo `index.html`) | Patrón establecido. Cero build step. Fácil de iterar. |
| **Hosting front** | GitHub Pages | Gratis, ya configurado, suficiente para PWA estática. Migrable a Vercel si crece. |
| **Auth** | Supabase Auth | Google OAuth + Email Magic Link. JWT compartido con Postgres para RLS. |
| **Base de datos** | Supabase Postgres | SQL real con joins, ideal para marketplace. Free tier holgado. |
| **Seguridad de datos** | Postgres Row Level Security (RLS) | El corazón de la separación familia/pyme/admin. Reglas declarativas en SQL. |
| **Realtime (chat, ofertas)** | Supabase Realtime | Subscriptions sobre tablas. Sin servidor propio. |
| **Storage** | Supabase Storage | Fotos de DNI, comprobantes, evidencia de cumplimiento. |
| **Lógica server-side** | Supabase Edge Functions (Deno) | Sanitización, validación AFIP, recompute de ratings, webhooks Mercado Pago. |
| **Pagos** | Mercado Pago Checkout (split payment / marketplace) | Flujo de escrow: familias pagan a MaPaPis, MaPaPis libera a pyme menos comisión. |

---

## 2. Modelo de actores y roles

Tres roles principales, todos sentados sobre `auth.users` de Supabase:

```
auth.users (Supabase nativo)
    │
    ├── public.profiles (1:1 con auth.users)
    │       └── role: 'familia' | 'pyme' | 'admin'
    │
    ├── public.familias (perfil específico de familia, FK a profiles)
    │       └── pertenece a uno o más grupos
    │
    └── public.pymes (perfil específico de pyme, FK a profiles)
            └── tiene tier de validación
```

Una persona física puede tener cuentas separadas como familia y como pyme (distintos emails), pero NO ambos roles en la misma cuenta. Esto simplifica RLS.

---

## 3. Schema SQL completo

### 3.1 Tablas core

```sql
-- =========================================================================
-- 1. PROFILES — extiende auth.users
-- =========================================================================
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('familia', 'pyme', 'admin')),
    nombre text not null,
    email text not null,
    telefono text,
    telefono_verificado boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- =========================================================================
-- 2. GRUPOS — el grupo de padres del jardín/colegio
-- =========================================================================
create table public.grupos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,                      -- visible solo a miembros
    institucion text not null,                 -- jardín/colegio (privado)
    sala text,                                 -- ej: "Sala Verde 2024" (privado)
    zona text not null,                        -- barrio amplio (público anonimizado)
    descripcion text,
    delegado_id uuid references public.profiles(id),
    created_at timestamptz default now()
);

-- Membresía familia <-> grupo (N:M)
create table public.grupo_miembros (
    grupo_id uuid references public.grupos(id) on delete cascade,
    familia_id uuid references public.profiles(id) on delete cascade,
    rol_en_grupo text default 'miembro' check (rol_en_grupo in ('miembro', 'delegado', 'tesorero')),
    activo boolean default true,
    invitado_por uuid references public.profiles(id),
    joined_at timestamptz default now(),
    primary key (grupo_id, familia_id)
);

-- =========================================================================
-- 3. PYMES — perfil específico
-- =========================================================================
create table public.pymes (
    id uuid primary key references public.profiles(id) on delete cascade,
    cuit text unique not null,
    razon_social text not null,
    nombre_fantasia text,

    -- responsable
    responsable_nombre text not null,
    responsable_dni text not null,

    -- bancarios
    cbu text,
    alias_mp text,
    titular_cuenta text,

    -- categorización
    zonas text[] not null default '{}',        -- en qué zonas opera
    categorias text[] not null default '{}',   -- qué tipo de necesidades cubre

    -- estado
    tier int not null default 0 check (tier between 0 and 3),
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'activa', 'suspendida', 'rechazada')),
    suspension_motivo text,

    -- ratings denormalizados (recalculados por trigger)
    rating_promedio numeric(3,2) default 0,
    rating_total int default 0,
    rating_calidad numeric(3,2) default 0,
    rating_puntualidad numeric(3,2) default 0,
    rating_comunicacion numeric(3,2) default 0,
    rating_precio numeric(3,2) default 0,

    transacciones_cumplidas int default 0,
    disputas_abiertas int default 0,
    disputas_resueltas int default 0,

    created_at timestamptz default now(),
    verified_at timestamptz,
    suspended_at timestamptz
);

-- Verificaciones de la pyme (audit trail)
create table public.pyme_verificaciones (
    id uuid primary key default gen_random_uuid(),
    pyme_id uuid references public.pymes(id) on delete cascade,
    tipo text not null check (tipo in ('afip', 'renaper', 'manual', 'cbu_titular')),
    resultado text not null check (resultado in ('ok', 'rechazada')),
    payload jsonb,                             -- respuesta cruda de la API
    revisor_id uuid references public.profiles(id),
    created_at timestamptz default now()
);

-- =========================================================================
-- 4. NECESIDADES — lo que el grupo necesita
-- =========================================================================
create table public.necesidades (
    id uuid primary key default gen_random_uuid(),
    grupo_id uuid not null references public.grupos(id) on delete cascade,
    creada_por uuid not null references public.profiles(id),

    titulo text not null,                      -- ya sanitizado al insert
    descripcion text not null,                 -- ya sanitizado
    categoria text not null,
    tipo text not null check (tipo in ('compra', 'servicio', 'votacion', 'tarea')),

    -- presupuesto orientativo
    presupuesto_min numeric(12,2),
    presupuesto_max numeric(12,2),

    -- visibilidad anonimizada
    zona text not null,                        -- barrio amplio
    rango_familias text not null,              -- ej: "15-30 familias" (no número exacto)

    fecha_limite_ofertas timestamptz,
    fecha_limite_entrega timestamptz,

    estado text not null default 'borrador'
        check (estado in (
            'borrador', 'recibiendo_ofertas', 'en_votacion',
            'adjudicada', 'en_curso', 'cumplida', 'cancelada'
        )),

    pyme_adjudicada_id uuid references public.pymes(id),
    oferta_ganadora_id uuid,                   -- FK declarada después

    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index idx_necesidades_zona on public.necesidades(zona) where estado = 'recibiendo_ofertas';
create index idx_necesidades_grupo on public.necesidades(grupo_id);

-- =========================================================================
-- 5. OFERTAS — sealed bid de pymes
-- =========================================================================
create table public.ofertas (
    id uuid primary key default gen_random_uuid(),
    necesidad_id uuid not null references public.necesidades(id) on delete cascade,
    pyme_id uuid not null references public.pymes(id) on delete cascade,

    monto numeric(12,2) not null,
    descripcion_oferta text not null,          -- sanitizada
    tiempo_entrega_dias int,

    estado text not null default 'presentada'
        check (estado in ('presentada', 'retirada', 'ganadora', 'perdedora')),

    created_at timestamptz default now(),
    unique (necesidad_id, pyme_id)             -- una oferta por pyme por necesidad
);

alter table public.necesidades
    add constraint necesidades_oferta_ganadora_fk
    foreign key (oferta_ganadora_id) references public.ofertas(id);

-- =========================================================================
-- 6. VOTACIONES — el grupo elige oferta ganadora
-- =========================================================================
create table public.votos_oferta (
    necesidad_id uuid references public.necesidades(id) on delete cascade,
    familia_id uuid references public.profiles(id) on delete cascade,
    oferta_id uuid not null references public.ofertas(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (necesidad_id, familia_id)     -- un voto por familia por necesidad
);

-- =========================================================================
-- 7. TRANSACCIONES — necesidad adjudicada con flujo de pago
-- =========================================================================
create table public.transacciones (
    id uuid primary key default gen_random_uuid(),
    necesidad_id uuid not null unique references public.necesidades(id),
    pyme_id uuid not null references public.pymes(id),
    grupo_id uuid not null references public.grupos(id),

    monto_total numeric(12,2) not null,
    comision_plataforma numeric(12,2) not null,
    monto_a_pyme numeric(12,2) not null,

    estado text not null default 'pendiente_pago'
        check (estado in (
            'pendiente_pago', 'pagada_en_escrow', 'en_curso',
            'cumplida', 'liberada', 'disputada', 'cancelada', 'reembolsada'
        )),

    -- Mercado Pago
    mp_payment_id text,
    mp_status text,

    cumplida_at timestamptz,
    review_window_expira timestamptz,          -- cumplida_at + 30 días
    liberada_at timestamptz,                   -- cuando MaPaPis libera plata a pyme

    created_at timestamptz default now()
);

-- Aporte de cada familia a la transacción
create table public.aportes_familia (
    id uuid primary key default gen_random_uuid(),
    transaccion_id uuid not null references public.transacciones(id) on delete cascade,
    familia_id uuid not null references public.profiles(id),

    monto numeric(12,2) not null,
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'pagado', 'reembolsado')),

    mp_payment_id text,
    pagado_at timestamptz,
    created_at timestamptz default now(),
    unique (transaccion_id, familia_id)
);

-- =========================================================================
-- 8. REVIEWS — sistema bidireccional
-- =========================================================================
create table public.reviews (
    id uuid primary key default gen_random_uuid(),
    transaccion_id uuid not null references public.transacciones(id) on delete cascade,
    autor_id uuid not null references public.profiles(id),
    autor_tipo text not null check (autor_tipo in ('familia', 'pyme')),
    target_id uuid not null references public.profiles(id),

    -- ratings
    rating_calidad int check (rating_calidad between 1 and 5),
    rating_puntualidad int check (rating_puntualidad between 1 and 5),
    rating_comunicacion int check (rating_comunicacion between 1 and 5),
    rating_precio int check (rating_precio between 1 and 5),
    score_agregado numeric(3,2),               -- calculado por trigger

    texto text check (length(texto) <= 500),

    estado text not null default 'publicada'
        check (estado in ('publicada', 'oculta_por_disputa', 'eliminada_por_admin')),
    editable_hasta timestamptz not null,       -- created_at + 7 días

    respuesta_pyme_texto text,
    respuesta_pyme_at timestamptz,

    created_at timestamptz default now(),
    unique (transaccion_id, autor_id)          -- una review por autor por transacción
);

-- =========================================================================
-- 9. CHAT — comunicación in-app
-- =========================================================================
create table public.conversaciones (
    id uuid primary key default gen_random_uuid(),
    necesidad_id uuid not null references public.necesidades(id) on delete cascade,
    pyme_id uuid not null references public.pymes(id),
    grupo_id uuid not null references public.grupos(id),
    estado text not null default 'pre_adjudicacion'
        check (estado in ('pre_adjudicacion', 'post_adjudicacion', 'cerrada')),
    created_at timestamptz default now(),
    unique (necesidad_id, pyme_id)
);

create table public.mensajes (
    id uuid primary key default gen_random_uuid(),
    conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
    autor_id uuid not null references public.profiles(id),
    contenido text not null,
    contenido_sanitizado text not null,        -- lo que se muestra (puede tener bloques)
    flags_anti_bypass text[] default '{}',     -- ej: ['telefono_detectado', 'email_detectado']
    bloqueado boolean default false,           -- si se bloqueó el mensaje completo
    created_at timestamptz default now()
);

create index idx_mensajes_conversacion on public.mensajes(conversacion_id, created_at);

-- =========================================================================
-- 10. DISPUTAS
-- =========================================================================
create table public.disputas (
    id uuid primary key default gen_random_uuid(),
    transaccion_id uuid references public.transacciones(id),
    review_id uuid references public.reviews(id),
    abierta_por uuid not null references public.profiles(id),
    motivo text not null,
    estado text not null default 'abierta'
        check (estado in ('abierta', 'resuelta_a_favor_pyme', 'resuelta_a_favor_familia', 'rechazada')),
    resolucion text,
    resuelta_por uuid references public.profiles(id),
    created_at timestamptz default now(),
    resuelta_at timestamptz
);

-- =========================================================================
-- 11. AUDIT — intentos de bypass detectados
-- =========================================================================
create table public.intentos_bypass (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id),
    contexto text not null,                    -- 'mensaje', 'descripcion_necesidad', 'oferta'
    contenido_original text not null,
    flags text[] not null,
    severidad text not null check (severidad in ('low', 'medium', 'high')),
    created_at timestamptz default now()
);

create index idx_intentos_bypass_profile on public.intentos_bypass(profile_id, created_at);
```

### 3.2 Triggers clave

```sql
-- Recalcular agregado de rating en pyme cuando se crea/edita/oculta una review
create or replace function recompute_pyme_rating() returns trigger as $$
begin
    update public.pymes
    set
        rating_promedio = (
            select coalesce(avg(score_agregado), 0)
            from public.reviews
            where target_id = new.target_id and estado = 'publicada'
        ),
        rating_total = (
            select count(*) from public.reviews
            where target_id = new.target_id and estado = 'publicada'
        )
        -- ... mismo para las 4 dimensiones, con decay temporal aplicado en Edge Function
    where id = new.target_id;
    return new;
end; $$ language plpgsql;

create trigger trg_recompute_pyme_rating
    after insert or update on public.reviews
    for each row execute function recompute_pyme_rating();

-- Bloquear creación de review si la transacción no está cumplida
-- y si el autor no es participante
create or replace function validar_review() returns trigger as $$
begin
    if not exists (
        select 1 from public.transacciones t
        where t.id = new.transaccion_id
          and t.estado in ('cumplida', 'liberada')
    ) then
        raise exception 'No se puede ratear una transacción no cumplida';
    end if;
    -- ... más checks
    return new;
end; $$ language plpgsql;

create trigger trg_validar_review
    before insert on public.reviews
    for each row execute function validar_review();
```

---

## 4. Row Level Security (RLS) — el corazón del modelo

RLS es la pieza crítica: **cada tabla decide quién puede leer/escribir cada fila** según el JWT del usuario logueado. Postgres lo aplica automáticamente — no hay forma de saltearlo desde el cliente.

### 4.1 Helpers

```sql
-- ¿Qué rol tiene el usuario actual?
create or replace function auth.user_role() returns text as $$
    select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ¿El usuario actual es miembro de este grupo?
create or replace function auth.is_grupo_miembro(grupo_id uuid) returns boolean as $$
    select exists (
        select 1 from public.grupo_miembros
        where grupo_id = $1 and familia_id = auth.uid() and activo = true
    );
$$ language sql stable security definer;

-- ¿El usuario actual es pyme con tier >= 1 (puede ofertar)?
create or replace function auth.is_pyme_activa() returns boolean as $$
    select exists (
        select 1 from public.pymes
        where id = auth.uid() and estado = 'activa' and tier >= 1
    );
$$ language sql stable security definer;
```

### 4.2 Políticas por tabla

```sql
alter table public.necesidades enable row level security;

-- Los miembros del grupo ven todo de su necesidad
create policy "miembros_grupo_ven_su_necesidad"
on public.necesidades for select
using (auth.is_grupo_miembro(grupo_id));

-- Las pymes activas ven necesidades en estado público, pero SOLO columnas anonimizadas
-- (esto se logra con una vista — ver 4.3)
create policy "pymes_ven_necesidades_publicas_via_vista"
on public.necesidades for select
using (
    auth.user_role() = 'pyme'
    and auth.is_pyme_activa()
    and estado in ('recibiendo_ofertas', 'en_votacion')
);

-- Solo delegado del grupo crea necesidades
create policy "delegado_crea_necesidad"
on public.necesidades for insert
with check (
    auth.is_grupo_miembro(grupo_id)
    and exists (
        select 1 from public.grupo_miembros
        where grupo_id = necesidades.grupo_id
          and familia_id = auth.uid()
          and rol_en_grupo in ('delegado', 'tesorero')
    )
);

-- Admin todo
create policy "admin_total_necesidades"
on public.necesidades for all
using (auth.user_role() = 'admin');
```

### 4.3 Vista anonimizada para pymes

La pyme **no debería ni siquiera leer** las columnas que la identifican. Solución: una vista que oculta los campos sensibles, y políticas que dirigen a la pyme a la vista.

```sql
create view public.necesidades_publicas as
select
    id,
    categoria,
    tipo,
    titulo,
    descripcion,                               -- ya sanitizada al insert
    presupuesto_min,
    presupuesto_max,
    zona,
    rango_familias,                            -- "15-30 familias" no número
    fecha_limite_ofertas,
    fecha_limite_entrega,
    estado,
    created_at
    -- NOTA: NO se exponen grupo_id, creada_por, institucion, sala
from public.necesidades
where estado in ('recibiendo_ofertas', 'en_votacion');

-- En el frontend, las pymes hacen `from('necesidades_publicas')` no `from('necesidades')`.
-- RLS sobre la tabla base impide acceso directo.
```

### 4.4 Mensajes — pre-adjudicación

```sql
alter table public.mensajes enable row level security;

create policy "lectura_mensajes_conversacion"
on public.mensajes for select
using (
    exists (
        select 1 from public.conversaciones c
        where c.id = mensajes.conversacion_id
          and (
              -- la pyme involucrada
              c.pyme_id = auth.uid()
              or
              -- algún miembro del grupo involucrado
              auth.is_grupo_miembro(c.grupo_id)
          )
    )
);

create policy "escritura_mensajes_solo_participantes"
on public.mensajes for insert
with check (
    autor_id = auth.uid()
    and exists (
        select 1 from public.conversaciones c
        where c.id = conversacion_id
          and (c.pyme_id = auth.uid() or auth.is_grupo_miembro(c.grupo_id))
    )
);
```

---

## 5. Anti-bypass — el laburo fino

El objetivo es que **sea muchísimo más fácil quedarse en la app que saltearse**. Cuatro líneas de defensa:

### 5.1 Defensa 1: la plata pasa por nosotros (incentivo económico)

- **Escrow en MaPaPis**: las familias pagan a la cuenta de MaPaPis (Mercado Pago Marketplace o split payment). La plata **no llega a la pyme hasta que se confirma cumplimiento**.
- Si una pyme acepta arreglo off-platform, pierde:
  - La garantía de cobro (la familia podría no pagarle).
  - El rating positivo (no se registra).
  - El acceso a la plataforma si se denuncia.
- Esto es por lejos el mecanismo más fuerte. Sin esto, los otros tres no alcanzan.

### 5.2 Defensa 2: sanitización automática de contenido

Edge Function `sanitize-content` que se ejecuta **antes de cualquier insert** en `necesidades.descripcion`, `ofertas.descripcion_oferta`, `mensajes.contenido` (pre-adjudicación):

```typescript
// Patrones detectados y bloqueados pre-adjudicación
const PATTERNS = [
    { name: 'telefono_ar', regex: /(\+?54\s?9?\s?)?(\d{2,4}[-\s]?){2,3}\d{4}/g },
    { name: 'email', regex: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
    { name: 'whatsapp_link', regex: /(wa\.me|api\.whatsapp\.com)\/\S+/gi },
    { name: 'instagram', regex: /(instagram\.com\/|@[a-z0-9_.]{3,})/gi },
    { name: 'cbu', regex: /\b\d{22}\b/g },
    { name: 'alias_mp', regex: /\b[a-z]{3,}\.[a-z]{3,}\.[a-z]{3,}\b/gi },
    { name: 'url_externa', regex: /https?:\/\/(?!mapapis\.com)\S+/gi },
];

// Resultado:
// - Pre-adjudicación: bloquear el mensaje completo + loguear en intentos_bypass
// - Post-adjudicación: permitir (ya están adjudicados, contacto necesario)
```

Detalles importantes:
- **Bloqueo absoluto pre-adjudicación**: el mensaje ni se guarda en DB, error visible al usuario.
- **Logueo siempre**: aunque el mensaje pase, los flags se guardan en `intentos_bypass`.
- **Detección de evasión**: gente escribe "quince once dos tres..." para evadir regex de teléfono. Detectar palabras-número agrupadas también.
- **Imágenes**: si la pyme manda una foto en el chat, OCR server-side detecta texto con teléfonos/CBUs.

### 5.3 Defensa 3: contactos gated por estado

| Estado | Qué se ve de la otra parte |
|--------|----------------------------|
| Pre-adjudicación | Solo nombre comercial de la pyme + zona del grupo. **Cero datos de contacto**. |
| Adjudicada | Se desbloquean teléfono y email para coordinar entrega. |
| Cumplida | Se mantienen los contactos. |

La RLS sobre `pymes` y `grupos` filtra los campos según el contexto. Hay vistas separadas: `pymes_publicas` (sin contacto), `pymes_adjudicadas` (con contacto si tu grupo adjudicó).

### 5.4 Defensa 4: penalización contractual + denuncias

- **TOS explícito**: bypass = baneo permanente + penalidad económica configurable (ej: pyme paga el monto de la comisión perdida + multa).
- **Botón "denunciar bypass"** en el chat post-adjudicación. La denuncia abre disputa, se revisa con logs.
- **Detección automática**: si una pyme cierra muchas conversaciones sin que se cree transacción → flag (puede estar derivando off-platform).
- **Mystery shopping** ocasional: cuentas-trampa de MaPaPis ofreciendo arreglo off-platform; la pyme que acepta queda baneada.

---

## 6. Edge Functions necesarias

| Función | Trigger | Qué hace |
|---------|---------|----------|
| `sanitize-content` | RPC desde frontend | Aplica regex y devuelve `{contenido_sanitizado, flags, bloqueado}`. |
| `validar-cuit-afip` | RPC | Llama endpoint AFIP, devuelve datos del padrón. Cachea 30 días. |
| `recompute-rating-decay` | Scheduled (cada 6h) | Recalcula `rating_promedio` aplicando decay temporal. |
| `expirar-review-edit` | Scheduled (cada 1h) | Congela reviews que pasaron 7 días. |
| `detectar-outlier-reviews` | Scheduled (cada 6h) | Busca patrones sospechosos, flagea. |
| `webhook-mp` | HTTP (de Mercado Pago) | Recibe eventos de pago, actualiza `transacciones` y `aportes_familia`. |
| `liberar-pago-pyme` | Scheduled (diaria) | Para transacciones cumplidas hace +X días sin disputa, ejecuta payout. |
| `update-tier-pyme` | DB trigger via webhook | Recalcula tier cuando cambian transacciones cumplidas o rating. |

---

## 7. Realtime — qué se sincroniza en vivo

Subscriptions del frontend usando `supabase.channel()`:

| Tabla | Canal | Lo usa |
|-------|-------|--------|
| `mensajes` filtrados por `conversacion_id` | Por conversación abierta | UI de chat |
| `ofertas` filtradas por `necesidad_id` | Delegado del grupo viendo ofertas | Listado en vivo de ofertas que llegan |
| `votos_oferta` filtradas por `necesidad_id` | Vista de votación | Contador en vivo |
| `aportes_familia` filtradas por `transaccion_id` | Vista de colecta | Barra de progreso en vivo |
| `transacciones.estado` | Por transacción | Actualizar UI cuando cambia de estado |

---

## 8. Storage — buckets

| Bucket | Contenido | Acceso |
|--------|-----------|--------|
| `pyme-verificacion` | Foto DNI frente/dorso, selfie, constancia AFIP | Solo dueño + admin (RLS) |
| `evidencias-cumplimiento` | Fotos/comprobantes que sube la pyme al cumplir | Pyme dueña + grupo adjudicado + admin |
| `comprobantes-pago` | Comprobantes MP | Sistema solo (uso interno) |
| `avatars` | Foto de perfil familia/pyme | Público read, dueño write |

---

## 9. Frontend — integración

### 9.1 Cliente Supabase

```html
<!-- Agregar a index.html -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...';   // anon key, segura para el browser
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
```

### 9.2 Auth flows

```javascript
// Google
await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://tobcde.github.io/mapapis/' }
});

// Magic link
await sb.auth.signInWithOtp({
    email: 'pablo@example.com',
    options: { emailRedirectTo: 'https://tobcde.github.io/mapapis/' }
});

// Estado de sesión
sb.auth.onAuthStateChange((event, session) => {
    // event: 'SIGNED_IN', 'SIGNED_OUT', etc
    // session: { user, access_token, ... }
});
```

### 9.3 Queries con RLS automático

```javascript
// Familia ve sus necesidades
const { data, error } = await sb
    .from('necesidades')
    .select('*, grupos(nombre), ofertas(*)')
    .eq('grupo_id', miGrupoId);

// Pyme ve necesidades públicas (vista anonimizada)
const { data } = await sb
    .from('necesidades_publicas')
    .select('*')
    .in('zona', misZonas)
    .eq('estado', 'recibiendo_ofertas');
```

### 9.4 Realtime

```javascript
const canal = sb.channel('mensajes-conversacion-' + conversacionId);
canal.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'mensajes',
    filter: `conversacion_id=eq.${conversacionId}`
}, (payload) => {
    appendMessage(payload.new);
}).subscribe();
```

---

## 10. Roadmap de implementación

| Fase | Duración estimada | Entregable |
|------|-------------------|-----------|
| **0. Setup** | 1 día | Cuenta Supabase, proyecto creado, repo GitHub conectado, variables de entorno. |
| **1. Schema base + RLS** | 3-4 días | Todas las tablas y políticas RLS aplicadas. Tests con cuentas mock. |
| **2. Auth y onboarding** | 3 días | Google + email-link. Flujo de elección rol al primer login. Crear grupo / crear pyme. |
| **3. Necesidades + ofertas + votación** | 1 semana | CRUD + vista anonimizada para pymes + sealed bid + votación. |
| **4. Sanitización anti-bypass** | 3 días | Edge Function + integración en inserts. Audit trail. |
| **5. Chat in-app** | 4 días | Conversaciones + mensajes + Realtime + sanitización. |
| **6. Mercado Pago + escrow** | 1-2 semanas | Marketplace API o split. Webhook. Estados de transacción. |
| **7. Sistema de reviews** | 4 días | Creación post-cumplida + agregados + respuesta + decay. |
| **8. Validación de pymes (AFIP + KYC)** | 1 semana | AFIP automático + queue de revisión manual o integración Renaper. |
| **9. Disputas y panel admin** | 4 días | Vista admin + flujo de resolución. |
| **10. Hardening anti-bypass** | continuo | Detección de evasión, OCR de imágenes, mystery shopping. |

**Total a primera versión funcional: ~6-8 semanas** trabajando part-time.

---

## 11. Hardening de seguridad e IDs

Esta sección consolida y endurece todo lo relativo a identificadores y permisos. Reglas no negociables.

### 11.1 IDs — todo opaco, nada autoincremental

- **Toda PK es `uuid` con `gen_random_uuid()`.** Nunca enteros autoincrementales. Razón: un `id=1234` filtrado da pistas de volumen y permite enumeración (`/necesidad/1235`, `/necesidad/1236`...). UUID no.
- **Toda FK es uuid también** y referencia a `profiles.id` (no directo a `auth.users.id`) para tener una capa propia.
- **Nada de IDs naturales como PK** (CUIT, DNI, email). Esos van como columnas `unique` indexadas, pero la PK siempre es UUID.
- **No exponer `auth.users.id` directo al cliente.** Todo se mueve por `profiles.id` (que es el mismo UUID, pero la abstracción nos permite cambiar el provider de auth en el futuro).
- **URLs y rutas usan UUID.** Nunca slugs derivados de datos sensibles. Si querés URLs lindas, usá un campo `slug` separado y aleatorio (`mapapis.com/n/k7f3z9p`).

### 11.2 Datos sensibles — segregación por columna

No todos los campos de una pyme son iguales. CUIT, DNI, CBU, fotos de identidad son **PII regulada**. Tres niveles:

| Sensibilidad | Ejemplos | Quién lee |
|--------------|----------|-----------|
| Pública | Razón social, nombre fantasía, zonas, categorías, rating agregado | Cualquiera vía vista pública |
| Privada | Email, teléfono, dirección | Dueño + admin + grupo adjudicado (post-adjudicación) |
| PII regulada | DNI, CUIT completo, CBU, fotos de identidad | Solo dueño + admin con MFA |

Implementación:

```sql
-- Tabla aparte para PII
create table public.pyme_pii (
    pyme_id uuid primary key references public.pymes(id) on delete cascade,
    cuit_completo text not null,        -- duplicado del de pymes pero acá con RLS más estricto
    dni_responsable text not null,
    cbu text,
    foto_dni_frente_path text,           -- ruta en Storage bucket privado
    foto_dni_dorso_path text,
    foto_selfie_path text,
    last_accessed_by uuid,               -- audit
    last_accessed_at timestamptz,
    created_at timestamptz default now()
);

alter table public.pyme_pii enable row level security;

-- Solo el dueño y admins MFA-validados acceden
create policy "pii_solo_dueño_o_admin_mfa"
on public.pyme_pii for select
using (
    pyme_id = auth.uid()
    or (
        auth.user_role() = 'admin'
        and (auth.jwt() ->> 'aal') = 'aal2'    -- AAL2 = MFA confirmado
    )
);

-- Toda lectura queda en log
create or replace function log_pii_access() returns trigger as $$
begin
    insert into public.pii_access_log(actor_id, pyme_id, accessed_at)
    values (auth.uid(), new.pyme_id, now());
    return new;
end; $$ language plpgsql security definer;
```

La columna `cuit` que está en `pymes` se queda enmascarada (`20-XXXXX***-3`). El completo solo en `pyme_pii`.

### 11.3 Vistas vs tablas — qué expone el cliente

Regla: el cliente **nunca** hace `from('pymes').select('*')`. Siempre desde una vista que filtra columnas. Tres vistas por entidad:

```sql
-- 1. Pública: lo que cualquiera ve
create view public.pymes_publicas as
select id, nombre_fantasia, zonas, categorias, tier,
       rating_promedio, rating_total
from public.pymes
where estado = 'activa';

-- 2. Para grupo adjudicado (con contacto)
create view public.pymes_para_grupo_adjudicado as
select p.id, p.nombre_fantasia, p.razon_social,
       prof.email, prof.telefono
from public.pymes p
join public.profiles prof on prof.id = p.id
where exists (
    select 1 from public.transacciones t
    where t.pyme_id = p.id
      and t.grupo_id in (
          select grupo_id from public.grupo_miembros
          where familia_id = auth.uid()
      )
);

-- 3. Privada del dueño
create view public.mi_pyme as
select * from public.pymes where id = auth.uid();
```

Cada vista tiene su propia RLS. La tabla base `pymes` tiene RLS que niega lectura directa al rol `anon` y `authenticated` general.

### 11.4 Operaciones prohibidas (immutability donde corresponde)

Algunas tablas son **append-only** o tienen campos no editables. Esto se enforce con triggers, no se confía al cliente:

```sql
-- Reviews: no se borran, no se editan después de la ventana
create or replace function reviews_immutable() returns trigger as $$
begin
    if old.created_at != new.created_at then
        raise exception 'created_at es inmutable';
    end if;
    if now() > old.editable_hasta and old.estado = 'publicada' and new.estado = 'publicada' then
        -- post-window solo puede cambiar estado a oculta_por_disputa, nada más
        if old.rating_calidad != new.rating_calidad
           or old.rating_puntualidad != new.rating_puntualidad
           or old.rating_comunicacion != new.rating_comunicacion
           or old.rating_precio != new.rating_precio
           or old.texto != new.texto then
            raise exception 'review congelada después de 7 días';
        end if;
    end if;
    return new;
end; $$ language plpgsql;

create trigger trg_reviews_immutable before update on public.reviews
for each row execute function reviews_immutable();

-- Transacciones: estado avanza one-way, no retrocede
-- Mensajes: ningún UPDATE permitido, solo INSERT
revoke update on public.mensajes from authenticated;
revoke delete on public.mensajes from authenticated;
revoke delete on public.reviews from authenticated;
revoke delete on public.transacciones from authenticated;
```

### 11.5 Service role key — nunca en el cliente

Supabase emite dos keys:
- **`anon` key**: pública, va en el frontend, sujeta a RLS.
- **`service_role` key**: bypass total de RLS, **solo en Edge Functions y backend**.

Reglas:
- La `service_role` jamás aparece en el HTML, ni en el repo, ni en logs.
- En el `index.html` de GitHub Pages solo va la `anon`.
- Edge Functions leen `service_role` desde variables de entorno seguras de Supabase.
- Si alguna vez se filtra: rotación inmediata desde dashboard.

### 11.6 Custom JWT claims para perf y seguridad

En vez de hacer `select role from profiles where id = auth.uid()` en cada policy (un query extra por chequeo), embebemos `role` y `tier` en el JWT:

```typescript
// Edge Function on auth event
export async function updateUserClaims(userId: string) {
    const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    const { data: pyme } = await admin
        .from('pymes')
        .select('tier, estado')
        .eq('id', userId)
        .maybeSingle();

    await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
            role: profile.role,
            pyme_tier: pyme?.tier ?? null,
            pyme_estado: pyme?.estado ?? null,
        },
    });
}
```

Y las policies leen `(auth.jwt() -> 'app_metadata' ->> 'role')`. Más rápido, mismo resultado.

### 11.7 Rate limiting

Supabase Edge Functions tienen rate limit nativo, pero sobre tablas hay que armar el nuestro:

```sql
create table public.rate_limit (
    profile_id uuid not null,
    accion text not null,
    bucket_inicio timestamptz not null,
    contador int not null default 1,
    primary key (profile_id, accion, bucket_inicio)
);

-- Función de check
create or replace function check_rate_limit(p_accion text, p_max int, p_ventana interval)
returns boolean as $$
declare
    v_bucket timestamptz := date_trunc('minute', now());
    v_count int;
begin
    insert into public.rate_limit(profile_id, accion, bucket_inicio)
    values (auth.uid(), p_accion, v_bucket)
    on conflict (profile_id, accion, bucket_inicio)
    do update set contador = rate_limit.contador + 1
    returning contador into v_count;

    return v_count <= p_max;
end; $$ language plpgsql security definer;
```

Aplicado en triggers BEFORE INSERT en tablas sensibles (mensajes, ofertas, reviews).

### 11.8 Audit log de acciones admin

```sql
create table public.admin_audit (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles(id),
    accion text not null,                      -- 'suspender_pyme', 'aprobar_verificacion', 'ocultar_review'
    target_tabla text not null,
    target_id uuid not null,
    payload jsonb,
    created_at timestamptz default now()
);

-- Append-only, ni admins pueden borrar
revoke delete on public.admin_audit from authenticated;
```

Toda Edge Function que actúa con `service_role` por pedido de un admin tiene que escribir acá. Trazabilidad completa.

### 11.9 Storage — RLS por bucket

```sql
-- Bucket pyme-verificacion (privado)
create policy "pyme_sube_su_verificacion"
on storage.objects for insert
with check (
    bucket_id = 'pyme-verificacion'
    and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pyme_lee_su_verificacion"
on storage.objects for select
using (
    bucket_id = 'pyme-verificacion'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or auth.user_role() = 'admin'
    )
);
```

Convención: cada usuario sube a `bucket/{userId}/...`. La RLS valida que el primer segmento del path sea su UUID.

### 11.10 Encriptación at-rest de campos críticos

Para CBU y DNI, además de RLS estricto, encriptación con `pgcrypto`:

```sql
create extension if not exists pgcrypto;

-- Insert encriptando
insert into public.pyme_pii (pyme_id, cbu, ...)
values (
    $1,
    pgp_sym_encrypt($2, current_setting('app.encryption_key')),
    ...
);

-- Select desencriptando (solo en Edge Function con key)
select pgp_sym_decrypt(cbu::bytea, current_setting('app.encryption_key'))
from public.pyme_pii where pyme_id = $1;
```

La key de encriptación va en variables de entorno de Supabase, nunca en el repo.

### 11.11 Backups y recuperación

- Free tier de Supabase: backups diarios 7 días retención.
- Pro tier: backups continuos PITR.
- **Antes de salir a producción real con datos de usuarios**: pasar a Pro mínimo.
- Export periódico manual a S3/R2 propio para cumplir con derecho al borrado (GDPR/Argentina ley 25.326).

### 11.12 Checklist de seguridad pre-producción

- [ ] Todas las tablas tienen RLS habilitado (`alter table ... enable row level security`).
- [ ] Ninguna tabla deja policy permisiva sin condición.
- [ ] Rol `anon` solo accede a vistas explícitamente permitidas.
- [ ] Rol `authenticated` no tiene SELECT directo en tablas con PII.
- [ ] Service role key no aparece en ningún `git grep`.
- [ ] Todas las Edge Functions validan input con Zod o similar.
- [ ] Storage buckets tienen RLS y no son públicos por default.
- [ ] Test suite con cuentas mock: familia A no ve nada de familia B; pyme C no ve nada del grupo de familia A.
- [ ] Pen test básico: probar saltarse RLS con queries directas usando `anon` key.
- [ ] Logs de `intentos_bypass` y `admin_audit` están vivos.
- [ ] Política de privacidad y TOS publicados.

---

## 12. Próximo paso accionable

Antes de escribir una línea de código:

1. ✅ Cuenta Supabase creada y proyecto inicializado.
2. ✅ Repo `tobcde/mapapis` en GitHub (cuando termines `gh auth login`).
3. ⬜ Aplicar el schema SQL de la sección 3 al proyecto Supabase.
4. ⬜ Configurar Auth providers (Google + email).
5. ⬜ Generar `anon key` y `service role key` (esta última nunca al frontend).
6. ⬜ Reemplazar mocks del `index.html` actual con queries Supabase, empezando por la tabla `necesidades`.

Cuando termines el `gh auth login` arrancamos por (1) y (2) y voy bajando el resto en orden.
