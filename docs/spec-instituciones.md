# Especificación técnica — Instituciones como tercer actor

> Extiende el modelo de [spec-arquitectura-supabase.md](spec-arquitectura-supabase.md) para incorporar **instituciones** (jardines, colegios) como actor de primer orden, con capacidad de **publicar necesidades** y **pagar desde presupuesto propio**.
>
> Caso de uso disparador: una maestra publica "necesito 25 mapas políticos de Argentina para mi sala". Esa necesidad puede ser:
> - **A)** Cubierta por las familias (cada familia aporta lo de su nene).
> - **B)** Cubierta por el colegio desde su presupuesto institucional.
> - **C)** Mixta (ej: 60% colegio, 40% familias).

---

## 1. Nuevo actor — Institución

### 1.1 Concepto

Una **institución** es una entidad jurídica (jardín, colegio, club) registrada en MaPaPis con:
- Su propia cuenta organizacional.
- Personal autorizado (directora, maestras, secretaría, tesorería).
- Saldo propio en escrow (el "presupuesto" del que habla el caso).
- Vinculación con grupos de familias existentes (ej: "Sala Verde 2026" como grupo cuyo colegio es "Jardín XYZ").

### 1.2 Roles

Se agregan dos `role` valores en `profiles`:

| `role` | Quién es | Qué puede hacer |
|--------|----------|------------------|
| `familia` (existente) | Madre/padre | Pertenecer a grupos, votar, pagar aportes |
| `pyme` (existente) | Empresa/comerciante | Ofertar, cumplir |
| `admin` (existente) | Equipo MaPaPis | Todo |
| **`institucion`** (nuevo) | Cuenta organizacional del colegio/jardín | Aprobar necesidades, autorizar pagos, ver reportes |
| **`personal_institucion`** (nuevo) | Maestra, directora, secretaria | Crear necesidades a nombre de la institución, según permisos asignados |

La distinción `institucion` vs `personal_institucion`:
- `institucion` es la **cuenta paraguas** (similar a una cuenta corporativa). Tiene saldo, pertenece a la entidad jurídica.
- `personal_institucion` son **usuarios humanos** que actúan en nombre de una institución. Tienen permisos granulares.

### 1.3 Permisos de personal

Dentro de una institución, no toda maestra puede aprobar gastos. Necesitamos granularidad:

| Permiso | Quién típicamente lo tiene |
|---------|----------------------------|
| `crear_necesidad` | Cualquier maestra del staff |
| `aprobar_necesidad` | Coordinador/a, Directora |
| `autorizar_pago_institucional` | Tesorería, Directora |
| `gestionar_personal` | Directora |
| `ver_reportes_financieros` | Directora, Tesorería |
| `adjudicar_oferta` | Coordinador/a, Directora |
| `dar_review` | Quien recibió la entrega |

Implementación: tabla `institucion_permisos(persona_id, institucion_id, permisos text[])`.

---

## 2. Cambios al schema

### 2.1 Tablas nuevas

```sql
-- =========================================================================
-- INSTITUCIONES — colegio/jardín como entidad
-- =========================================================================
create table public.instituciones (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid unique references public.profiles(id),  -- la cuenta paraguas
    razon_social text not null,
    nombre_fantasia text not null,
    cuit text unique not null,
    tipo text not null check (tipo in ('jardin', 'colegio_primario', 'colegio_secundario', 'club', 'otro')),
    zona text not null,
    direccion_completa text,                   -- privada, no se expone a pymes
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'activa', 'suspendida')),

    -- saldo en escrow (presupuesto disponible)
    saldo_disponible numeric(14,2) default 0,
    saldo_reservado numeric(14,2) default 0,   -- comprometido en transacciones en curso

    -- ratings denormalizados (también las instituciones tienen rating como pagador)
    rating_pagador numeric(3,2) default 0,
    rating_total int default 0,

    created_at timestamptz default now(),
    verified_at timestamptz
);

-- =========================================================================
-- PERSONAL DE LA INSTITUCIÓN
-- =========================================================================
create table public.institucion_personal (
    institucion_id uuid references public.instituciones(id) on delete cascade,
    persona_id uuid references public.profiles(id) on delete cascade,
    cargo text not null,                       -- 'maestra', 'directora', 'secretaria', 'tesorera'
    permisos text[] not null default '{crear_necesidad}',
    activo boolean default true,
    invitado_por uuid references public.profiles(id),
    joined_at timestamptz default now(),
    primary key (institucion_id, persona_id)
);

-- =========================================================================
-- VINCULACIÓN GRUPO ↔ INSTITUCIÓN
-- =========================================================================
-- Un grupo de padres pertenece a una institución (sala/curso de tal colegio)
alter table public.grupos
    add column institucion_id uuid references public.instituciones(id);

-- =========================================================================
-- MOVIMIENTOS DE SALDO INSTITUCIONAL
-- =========================================================================
create table public.institucion_movimientos (
    id uuid primary key default gen_random_uuid(),
    institucion_id uuid not null references public.instituciones(id),
    tipo text not null check (tipo in (
        'carga_saldo',          -- el colegio carga plata vía MP
        'reserva',              -- adjudicación de necesidad: se reserva plata
        'liberacion_reserva',   -- transacción cumplida: la reserva pasa a egreso real
        'reverso_reserva',      -- transacción cancelada: vuelve a saldo disponible
        'reembolso',            -- caso disputa
        'comision_plataforma'
    )),
    monto numeric(14,2) not null,
    transaccion_id uuid references public.transacciones(id),
    autorizado_por uuid references public.profiles(id),
    descripcion text,
    created_at timestamptz default now()
);
```

### 2.2 Cambios en `necesidades`

```sql
alter table public.necesidades
    -- quién la creó (puede ser personal de institución o miembro de grupo)
    add column creador_tipo text not null default 'familia'
        check (creador_tipo in ('familia', 'institucion')),

    -- la institución asociada (siempre que aplique)
    add column institucion_id uuid references public.instituciones(id),

    -- modalidad de pago
    add column modalidad_pago text not null default 'familias'
        check (modalidad_pago in ('familias', 'institucion', 'mixto')),

    -- si es mixto, qué parte paga la institución (0 a 1)
    add column institucion_aporte_pct numeric(3,2) default 0
        check (institucion_aporte_pct between 0 and 1),

    -- si la creó personal de institución, ¿está aprobada por jerarquía?
    add column aprobacion_institucional_estado text
        check (aprobacion_institucional_estado in ('pendiente', 'aprobada', 'rechazada')),
    add column aprobada_por uuid references public.profiles(id),
    add column aprobada_at timestamptz;
```

### 2.3 Cambios en `transacciones`

```sql
alter table public.transacciones
    add column monto_pagado_institucion numeric(14,2) default 0,
    add column monto_pagado_familias numeric(14,2) default 0,
    add column institucion_id uuid references public.instituciones(id);
```

---

## 3. Flujos de necesidad — los tres casos

### 3.1 Caso A: pagan las familias (modelo original, sin cambio)

```
Delegado del grupo crea necesidad
    ↓
recibiendo_ofertas (pymes ofertan)
    ↓
en_votacion (familias votan oferta)
    ↓
adjudicada
    ↓
familias pagan aportes vía MP
    ↓
pagada_en_escrow
    ↓
en_curso → cumplida → liberada
```

### 3.2 Caso B: paga la institución (nuevo)

```
Maestra crea necesidad (creador_tipo='institucion', modalidad_pago='institucion')
    ↓
aprobacion_institucional_estado='pendiente'
    ↓
Directora/Coordinador con permiso 'aprobar_necesidad' la aprueba
    ↓
recibiendo_ofertas (pymes ofertan)
    ↓
adjudicada (la decide alguien con permiso 'adjudicar_oferta', NO votación de familias)
    ↓
Tesorería con permiso 'autorizar_pago_institucional' confirma
    ↓
Se descuenta del saldo institucional → pagada_en_escrow
    ↓
en_curso → cumplida → liberada
```

Detalles:
- **Sin votación**: la institución decide internamente quién oferta gana. Esto es decisión de gobernanza institucional, no nuestra.
- **Doble approval**: aprobar la necesidad + autorizar el pago suelen ser personas distintas (segregación de funciones).
- **Saldo insuficiente**: si la institución no tiene saldo cargado, la transacción queda en `pendiente_pago` y se les manda notificación para cargar saldo.

### 3.3 Caso C: mixto (institución + familias)

```
Maestra crea necesidad con modalidad_pago='mixto', institucion_aporte_pct=0.60
    ↓
aprobacion_institucional_estado='pendiente' → aprobada
    ↓
recibiendo_ofertas
    ↓
en_votacion (familias votan, porque ponen plata)
    ↓
adjudicada (consenso: gana lo que vota el grupo Y la institución acepta cubrir su parte)
    ↓
Se reserva 60% del saldo institucional + cada familia paga su parte (40% / N familias)
    ↓
pagada_en_escrow (cuando llegan ambos pagos)
    ↓
en_curso → cumplida → liberada
```

Detalles:
- **Veto institucional**: si la oferta más votada por familias no le cierra a la institución (ej: superó el presupuesto autorizado), la institución puede vetar y forzar re-votación entre las restantes. Definir reglas claras en TOS.
- **Si las familias no juntan su parte**: la transacción se cancela, la reserva institucional se libera, las familias que ya pagaron son reembolsadas.

---

## 4. Vista anonimizada — qué ven las pymes

La pyme ve necesidades de los tres orígenes con esta info:

| Campo | Familia paga | Institución paga | Mixto |
|-------|--------------|------------------|-------|
| Tipo de comprador | "Grupo de padres" | "Institución educativa" | "Institución + familias" |
| Zona | barrio amplio | barrio amplio | barrio amplio |
| Tamaño del pedido | rango de familias | cantidad orientativa (ej: "20-30 unidades") | rango de familias |
| Presupuesto | min-max | min-max | min-max |
| Garantía de cobro | familias colectan | **escrow institucional confirmado** | parcial |

**Garantía de cobro institucional** es interesante para la pyme: si la institución ya tiene el saldo reservado en escrow, la oferta es más confiable que una donde dependés de que 25 familias paguen. Mostrar **badge** "Pago garantizado" diferencia.

**Lo que sigue oculto** (igual que en el caso familia): nombre del colegio/jardín, dirección, sala/curso, identidad del personal que creó la necesidad.

---

## 5. Carga y gestión del saldo institucional

### 5.1 Carga de saldo

La institución carga saldo a su cuenta de MaPaPis vía Mercado Pago:

```
Personal con permiso 'autorizar_pago_institucional' inicia carga
    ↓
Genera link de pago en MP (transferencia desde cuenta institucional)
    ↓
Webhook MP → Edge Function → suma a saldo_disponible + log en institucion_movimientos
```

### 5.2 Modelo "presupuesto anual"

Las instituciones suelen pensar en presupuestos anuales asignados por rubro. Sin reinventar contabilidad:

```sql
create table public.institucion_partidas (
    id uuid primary key default gen_random_uuid(),
    institucion_id uuid not null references public.instituciones(id),
    nombre text not null,                -- ej: "Materiales didácticos 2026"
    monto_total numeric(14,2) not null,
    monto_usado numeric(14,2) default 0,
    año int not null,
    activa boolean default true,
    created_at timestamptz default now()
);
```

Cuando se crea una necesidad institucional, se asigna a una partida. Esto da reportería fina al colegio (cuánto gastó en materiales, en eventos, etc).

### 5.3 Reportes para la institución

Vista que les damos en su panel:

- Saldo disponible / reservado.
- Histórico de necesidades cubiertas.
- Pymes top con las que trabajan + ratings que dieron y recibieron.
- Gastos por partida.
- Export a Excel/CSV (para llevar a su contabilidad).

---

## 6. Cambios en RLS

### 6.1 Profiles role check ampliado

```sql
-- Helper actualizado
create or replace function auth.es_personal_institucion(institucion_id uuid, permiso text default null)
returns boolean as $$
    select exists (
        select 1 from public.institucion_personal ip
        where ip.institucion_id = $1
          and ip.persona_id = auth.uid()
          and ip.activo = true
          and (
              $2 is null
              or $2 = any(ip.permisos)
          )
    );
$$ language sql stable security definer;
```

### 6.2 Necesidades — quién puede crear/aprobar/adjudicar

```sql
-- Crear necesidad institucional: requiere permiso 'crear_necesidad'
create policy "personal_inst_crea_necesidad"
on public.necesidades for insert
with check (
    creador_tipo = 'institucion'
    and institucion_id is not null
    and auth.es_personal_institucion(institucion_id, 'crear_necesidad')
);

-- Aprobar: requiere 'aprobar_necesidad'
-- (esto ya como UPDATE de aprobacion_institucional_estado)
create policy "personal_inst_aprueba_necesidad"
on public.necesidades for update
using (
    creador_tipo = 'institucion'
    and auth.es_personal_institucion(institucion_id, 'aprobar_necesidad')
)
with check (
    creador_tipo = 'institucion'
    and auth.es_personal_institucion(institucion_id, 'aprobar_necesidad')
);
```

### 6.3 Saldo — solo personal autorizado

```sql
alter table public.instituciones enable row level security;

create policy "personal_lee_su_institucion"
on public.instituciones for select
using (
    auth.es_personal_institucion(id)
    or auth.user_role() = 'admin'
);

-- Saldo solo lo modifican Edge Functions con service_role, nunca el cliente
revoke update on public.instituciones from authenticated;
```

### 6.4 Movimientos — append-only y por rol

```sql
alter table public.institucion_movimientos enable row level security;

create policy "personal_lee_movimientos"
on public.institucion_movimientos for select
using (
    auth.es_personal_institucion(institucion_id, 'ver_reportes_financieros')
    or auth.user_role() = 'admin'
);

revoke insert, update, delete on public.institucion_movimientos from authenticated;
-- Solo Edge Functions con service_role insertan acá
```

---

## 7. Anti-bypass — extensiones para institución

### 7.1 Riesgo nuevo: "pyme amiga" de la directora

Una directora podría dirigir adjudicaciones a una pyme con la que tiene relación previa. No podemos impedir totalmente la autonomía institucional, pero sí transparentar:

- **Histórico visible internamente**: el panel del colegio muestra "esta pyme ganó N de las últimas M adjudicaciones". Si una pyme gana siempre, salta al ojo.
- **Doble aprobación obligatoria**: necesidad la aprueba Persona X, adjudicación la aprueba Persona Y, pago Persona Z. Si está todo concentrado en uno, hay flag.
- **Transparencia con familias**: si la institución cubre algo que beneficia a un grupo, el grupo VE qué pyme se eligió y qué monto (sin ver otras ofertas, para no comprometer sealed bid). El grupo puede dar feedback.

### 7.2 Sanitización igual

Los mensajes y descripciones de necesidades institucionales pasan por la misma sanitización (sección 5 del spec principal). Las maestras también podrían intentar dar contacto a pyme amiga.

### 7.3 KYB de la institución

Validación al alta de institución similar a pyme:
- CUIT contra AFIP.
- DNI de la directora/representante legal.
- Certificado de inscripción ante el ministerio correspondiente (subido como documento, revisión manual).
- Tier de validación equivalente: Tier 0 sin operar, Tier 1 con CUIT verificado, Tier 2 con docs avalados, etc.

---

## 8. Ejemplo end-to-end: "25 mapas políticos"

**Setup**:
- Institución: "Jardín El Pequeñín" (verificada, Tier 2).
- Personal: María (maestra, permiso `crear_necesidad`), Laura (directora, permisos `aprobar_necesidad`, `autorizar_pago_institucional`, `adjudicar_oferta`).
- Grupo: "Sala Verde 2026" (22 familias, vinculado al jardín).

**Caso B (paga el jardín)**:

1. María entra a MaPaPis y crea: "25 mapas políticos de Argentina, plastificados, formato A3", categoría "materiales didácticos", presupuesto $30.000-50.000, fecha límite 15 mayo.
2. Marca `modalidad_pago = 'institucion'`, asigna a partida "Materiales didácticos 2026".
3. Estado: `aprobacion_institucional_estado = 'pendiente'`.
4. A Laura le llega push notification: "María propone gastar de la partida XX".
5. Laura aprueba. Estado pasa a `recibiendo_ofertas`. La necesidad se publica al feed de pymes con la categoría correspondiente en zona "Belgrano" (sin nombre del jardín).
6. Tres pymes ofertan: Imprenta A ($45k), Editorial B ($38k), Librería C ($42k). Ofertas selladas.
7. Cierre de ofertas. Laura ve las 3, elige Editorial B por mejor relación calidad/precio (vio sus reviews). Adjudica.
8. Sistema reserva $38k del saldo institucional. Estado `adjudicada`.
9. Laura autoriza el pago. El monto pasa a `pagada_en_escrow`.
10. Editorial B entrega los 25 mapas al jardín. María (la receptora) marca `cumplida` y sube foto de evidencia.
11. Pasan 7 días sin disputa. Sistema libera el pago a Editorial B menos comisión MaPaPis (digamos 8% = $3.040). Editorial B recibe $34.960.
12. María hace review de Editorial B (5/5 calidad, 5/5 puntualidad...). Editorial B hace review del jardín como pagador.

**Caso A (pagan las familias)** del mismo pedido:

1. María crea la necesidad pero con `modalidad_pago = 'familias'`, asigna al grupo "Sala Verde 2026".
2. Las familias del grupo reciben push: "Tu sala necesita 25 mapas — aporte sugerido $1.520 por familia".
3. Estado `recibiendo_ofertas` → 3 pymes ofertan.
4. Estado `en_votacion`. Las 22 familias votan. Editorial B gana.
5. Cada familia paga $1.520 vía MP. Cuando todas pagaron → `pagada_en_escrow`.
6. Editorial B entrega. María marca `cumplida`. Liberación de pago + comisión.

**Caso C (mixto, 60/40)**:

1. María crea con `modalidad_pago = 'mixto'`, `institucion_aporte_pct = 0.60`.
2. Aprobación de Laura.
3. Familias votan, Editorial B gana ($38k → $22.800 institución, $15.200 familias = $691 por familia).
4. Saldo institucional reserva $22.800; familias colectan $15.200.
5. Cuando ambos completos → `pagada_en_escrow` → cumplida → liberación.

---

## 9. Decisiones pendientes

- [ ] **Autonomía institucional vs. veto familiar**: ¿En modo mixto, las familias pueden vetar la decisión de la institución de adjudicar a X pyme? Recomendación: sí, con voto calificado (>50% en contra).
- [ ] **Comisión diferenciada para instituciones**: ¿Mismo porcentaje que familias o menor por volumen? Recomendación: mismo para arrancar; revisar con data.
- [ ] **Onboarding de instituciones**: ¿Las invita un admin de MaPaPis (curado) o se registran solas como las pymes? Recomendación: curado al inicio (queremos relación con el colegio, hay venta consultiva).
- [ ] **Quién recibe la review de la institución**: ¿Persona individual (la directora) o cuenta institucional? Recomendación: la cuenta institucional, para que sobreviva al cambio de dirección.
- [ ] **Integración con sistemas administrativos del colegio**: ¿APIs hacia software de gestión escolar? Lejos en roadmap, anotar como posibilidad.

---

## 10. Impacto en roadmap

Esto agrega trabajo a las fases existentes del [spec-arquitectura-supabase.md](spec-arquitectura-supabase.md):

| Fase original | Cambio por instituciones |
|---------------|--------------------------|
| 1. Schema base + RLS | +3 días: tablas instituciones, personal, partidas, movimientos. RLS específica. |
| 2. Auth y onboarding | +2 días: flujo de alta de institución y de personal (invitación). |
| 3. Necesidades + ofertas + votación | +4 días: rama de aprobación institucional, doble approval, lógica de modalidad. |
| 6. Mercado Pago + escrow | +5 días: carga de saldo institucional, reservas, movimientos contables. |
| 8. Validación de pymes (KYC) | +3 días: KYB de instituciones, queue separada de revisión. |

**Total adicional: ~2-2.5 semanas part-time** sobre el roadmap original.

Recomendación de orden: implementar instituciones **después** de tener flujo familia↔pyme funcionando. El caso A (familias pagan) es el corazón del producto y valida hipótesis. Con eso vivo, agregar instituciones es una expansión natural.
