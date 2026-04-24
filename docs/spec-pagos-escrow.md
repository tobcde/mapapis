# MaPaPis — Spec de pagos y escrow

> **Decisión de producto**: usamos **Mercado Pago Marketplace API** como custodio de fondos. El dinero queda retenido (escrow) hasta que el grupo confirme la entrega correcta, o expire un timeout configurable. La plataforma cobra comisión automática vía `application_fee` sobre cada transacción.
>
> Este documento es la fuente de verdad para Slice 4 (MP integration) y Slice 5 (disputas + anti-bypass).

---

## 1. Principios

1. **La plata no toca a la pyme hasta que el grupo confirme entrega**. Sin esto no hay defensa contra bypass ni control de calidad.
2. **MaPaPis no custodia dinero directamente**. Custodia = regulación CNV/BCRA. Lo hace MP por nosotros vía Marketplace API.
3. **Confirmación grupal por umbral** (no un solo confirmador, no requiere 100%). Configurable por categoría.
4. **Reembolso parcial es nativo**, no excepción.
5. **Anti-bypass económico**: bypassar la app implica perder escrow + bid credits + rating. Asimetría obligatoria.

---

## 2. Stack técnico

| Capa | Servicio |
|---|---|
| Custodio de fondos | **Mercado Pago Marketplace API** (Argentina, fase inicial) |
| Backend orquestador | **Supabase Edge Functions** (Deno + TS) |
| Persistencia | Postgres (Supabase) — tablas `transacciones`, `pagos_familia`, `liberaciones`, `disputas`, `eventos_pago` |
| Webhooks | MP → Edge Function `mp-webhook` (idempotente, firma verificada) |
| Storage de evidencia | Supabase Storage bucket `evidencia/` con RLS estricta |
| Frontend | React (lee estado, no toca dinero) |

---

## 3. State machine de la transacción

```
recibiendo_ofertas ──> en_votacion ──> adjudicada
                                          │
                                          ▼
                                   pendiente_pago_familias
                                          │  (cada familia paga su cuota)
                                          ▼
                              fondos_en_escrow_mp  ←── PLATA RETENIDA
                                          │
                                          ▼
                                    en_produccion
                                          │
                                          ▼
                                     en_entrega
                                          │
                                          ▼
                              pendiente_confirmacion_grupo
                              ┌───────────┼─────────────┐
                              ▼           ▼             ▼
                       liberada    disputada       reembolsada
                              │           │             │
                              ▼           ▼             ▼
                        completada    en_mediacion   cerrada_refund
                                          │
                                          ▼
                              (resuelta_pyme | resuelta_familia | resuelta_partial)
```

### Disparadores de transición

| De → A | Disparador |
|---|---|
| `adjudicada → pendiente_pago_familias` | Edge function al ganar votación |
| `→ fondos_en_escrow_mp` | Webhook MP `payment.approved` para cada familia |
| `→ en_produccion` | Pyme marca "comencé" en app |
| `→ en_entrega` | Pyme marca "salió" + opcionalmente foto |
| `→ pendiente_confirmacion_grupo` | Pyme marca "entregado" |
| `→ liberada` | ≥70% familias confirma OK **o** timeout vence sin reportes |
| `→ disputada` | >30% familias reporta problema con evidencia válida |
| `→ reembolsada` | Mediación falla a favor del grupo total |
| `→ cerrada_partial` | Mediación define reembolso proporcional |

---

## 4. Modelo de datos (cambios sobre `spec-arquitectura-supabase.md`)

### 4.1 Tabla `transacciones` (extendida)

```sql
create table public.transacciones (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id),
  oferta_ganadora_id uuid not null references public.ofertas(id),
  pyme_id uuid not null references public.pymes(id),
  grupo_id uuid not null references public.grupos(id),

  monto_total_centavos bigint not null,        -- lo que pagan las familias
  comision_plataforma_centavos bigint not null, -- application_fee MP
  monto_pyme_centavos bigint not null,          -- monto_total - comision - mp_fee
  mp_fee_estimada_centavos bigint not null,

  estado text not null default 'pendiente_pago_familias',
  -- estado check constraint con todos los valores del state machine

  modalidad_pago text not null default 'pago_completo',
  -- 'pago_completo' | 'milestones'

  timeout_confirmacion_horas int not null default 48,
  fecha_entrega timestamptz,
  fecha_limite_confirmacion timestamptz,

  mp_marketplace_id text,           -- id collector pyme
  mp_application_id text,           -- nuestro app id

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 4.2 Tabla `pagos_familia` (nueva)

```sql
create table public.pagos_familia (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id) on delete restrict,
  familia_id uuid not null references public.profiles(id),

  monto_centavos bigint not null,
  estado text not null default 'pendiente',
  -- 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado_total' | 'reembolsado_parcial'

  mp_payment_id text unique,         -- id de pago MP, idempotencia
  mp_preference_id text,             -- preference que generamos
  mp_status text,                    -- raw MP status para debug
  mp_status_detail text,

  reembolso_centavos bigint default 0,
  reembolso_motivo text,

  pagado_at timestamptz,
  created_at timestamptz default now()
);

create unique index idx_pagos_familia_unique on public.pagos_familia (transaccion_id, familia_id);
```

### 4.3 Tabla `milestones` (nueva, opcional por transacción)

```sql
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id) on delete cascade,
  orden int not null,
  titulo text not null,
  porcentaje numeric(5,2) not null,    -- 30.00 = 30%
  monto_centavos bigint not null,
  estado text not null default 'pendiente',
  -- 'pendiente' | 'aprobado_pyme' | 'liberado' | 'rechazado'
  liberado_at timestamptz,
  evidencia_storage_path text
);
```

### 4.4 Tabla `confirmaciones_entrega` (nueva)

```sql
create table public.confirmaciones_entrega (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id) on delete cascade,
  familia_id uuid not null references public.profiles(id),

  decision text not null,
  -- 'ok' | 'parcial' | 'problema'

  cantidad_recibida int,                -- ej: 22 de 25 mapas
  cantidad_esperada int,
  problema_descripcion text,
  evidencia_storage_paths text[],       -- array de URLs en bucket evidencia/

  created_at timestamptz default now()
);

create unique index idx_confirmaciones_unique on public.confirmaciones_entrega (transaccion_id, familia_id);
```

### 4.5 Tabla `eventos_pago` (audit log inmutable)

```sql
create table public.eventos_pago (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id),
  tipo text not null,
  -- 'pago_iniciado' | 'pago_aprobado' | 'webhook_recibido' | 'liberacion_disparada'
  -- | 'reembolso_iniciado' | 'disputa_abierta' | 'mediacion_iniciada' | 'resolucion'
  payload jsonb not null,
  mp_event_id text,
  created_at timestamptz default now()
);

-- Inmutable: no UPDATE ni DELETE permitido
revoke update, delete on public.eventos_pago from authenticated, anon;
```

### 4.6 Tabla `disputas` (extendida)

```sql
create table public.disputas (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id),
  abierta_por_familia_id uuid references public.profiles(id),
  motivo text not null,
  evidencia_storage_paths text[],

  estado text not null default 'abierta',
  -- 'abierta' | 'en_mediacion' | 'resuelta_pyme' | 'resuelta_familia' | 'resuelta_partial' | 'desestimada'

  resolucion text,
  monto_reembolso_centavos bigint default 0,
  resuelta_at timestamptz,
  resuelta_por_admin_id uuid references public.profiles(id),

  created_at timestamptz default now()
);
```

---

## 5. Edge Functions (Supabase)

### 5.1 `crear-preferencia-pago`
- **Input**: `transaccion_id`, `familia_id`
- **Acción**: llama a MP Preferences API con `marketplace=true` + `application_fee` calculada
- **Output**: `init_point` URL para redirigir al usuario al checkout
- **Idempotencia**: si ya existe `pagos_familia.mp_preference_id`, retorna ese
- **Side effect**: insert en `eventos_pago`

### 5.2 `mp-webhook`
- **Endpoint público** firmado por MP
- **Verifica firma** con `MP_WEBHOOK_SECRET`
- **Tipos manejados**: `payment`, `merchant_order`, `chargeback`
- **Idempotente** vía `mp_payment_id` unique
- Actualiza `pagos_familia.estado` y avanza `transacciones.estado` cuando todas las familias pagaron
- Inserta en `eventos_pago` siempre

### 5.3 `confirmar-entrega`
- **Input**: `transaccion_id`, `familia_id`, `decision`, `evidencia[]`
- **Verifica**: la familia es miembro del grupo Y participó del pago Y `estado = pendiente_confirmacion_grupo`
- **Acción**: insert en `confirmaciones_entrega`
- **Si umbral alcanzado** (≥70% OK) → llama internamente a `liberar-fondos`
- **Si >30% problema** → llama a `abrir-disputa-automatica`

### 5.4 `liberar-fondos`
- Solo invocable internamente o por cron
- Llama a MP `release` API por cada `pagos_familia` con estado `aprobado` y sin reembolso
- Actualiza `transacciones.estado = liberada → completada`
- Genera notificación a pyme + grupo

### 5.5 `abrir-disputa-automatica`
- Crea registro en `disputas`
- Cambia `transacciones.estado = disputada → en_mediacion`
- Notifica al equipo MaPaPis (Slack webhook)
- Bloquea release automático

### 5.6 `cron-timeout-confirmaciones` (cron diario)
- Busca transacciones `pendiente_confirmacion_grupo` con `fecha_limite_confirmacion < now()`
- Si no hubo disputa → libera automático
- Si hay confirmaciones parciales (>0 pero <umbral) → analiza decisión

### 5.7 `cron-rebill-fallidos` (cron horario, futuro)
- Reintentos de notificaciones de pago para familias que no pagaron en X horas
- Después de N reintentos sin pago → cancela transacción y vuelve necesidad a `recibiendo_ofertas`

### 5.8 `resolver-disputa` (admin)
- Solo accesible con `auth.user_role() = 'admin'`
- Define resolución y dispara reembolsos parciales/totales vía MP API

---

## 6. Cálculo de comisión (application_fee)

```
monto_total           = $44.000  (lo que paga la familia, IVA incluido si aplica)
comision_mapapis      = 10%      = $4.400  ← application_fee a MP
mp_fee               ≈ 4%        = $1.760  (lo cobra MP, sale del bruto)
                                  ─────────
neto_pyme            = $44.000 - $4.400 - $1.760 = $37.840
```

**Quien absorbe la fee de MP**: la pyme (3%) + traslado al precio (1%). Configurable global.

**Application_fee** se setea en cada Preference creada — MP lo descuenta automático al hacer release.

---

## 7. Reglas de confirmación grupal

| Categoría | Umbral OK | Timeout | Modalidad |
|---|---|---|---|
| Productos físicos | 70% | 48hs post-entrega | pago_completo |
| Indumentaria | 70% | 7 días post-entrega | pago_completo |
| Catering / eventos | 60% | 24hs post-evento | milestones (30/50/20) |
| Servicios continuos | 60% por hito | configurable | milestones |

**Si la familia no confirma en el timeout** → cuenta como OK (no penaliza al resto).
**Si reporta problema** → debe subir evidencia (foto/video) o se desestima la queja.

---

## 8. Reembolso parcial

Ejemplo: 25 mapas pedidos, 22 entregados OK, 3 rotos.

```
monto_total_familias = $40.000
fraccion_correcta    = 22/25 = 0.88
monto_pyme_libera    = $40.000 × 0.88 = $35.200
reembolso_familias   = $40.000 × 0.12 = $4.800   (proporcional por familia)
comision_mapapis     = solo sobre monto_pyme_libera
```

Distribuir reembolso por familia → proporcional a su `pagos_familia.monto_centavos`.

---

## 9. Anti-bypass económico (la regla de oro)

Eventos detectados que invalidan la transacción:
- Sanitizer regex detecta número WhatsApp, email, IG, link a calendly, etc., en mensajes
- OCR sobre imágenes detecta lo mismo
- Pyme marca entregado sin que ninguna familia confirme y luego desaparece (patrón de fraude)

**Penalty cascade**:
1. Mensaje queda visible pero **el contacto se redacta** automáticamente.
2. Strike en cuenta de la pyme. **3 strikes = suspensión 30 días**.
3. Si la transacción se cierra fuera de la app y se detecta (ej: rating bajo + queja explícita) → **escrow se devuelve a familias**, **bid credits perdidos**, **rating queda con strike permanente**.

La amenaza tiene que ser real y aplicable. Esto va en términos y condiciones aceptados al onboarding.

---

## 10. Seguridad — RLS resumida

| Tabla | familia | pyme propietaria | otra pyme | admin |
|---|---|---|---|---|
| `transacciones` | SELECT si grupo_id en grupos del usuario | SELECT propias | nada | SELECT all |
| `pagos_familia` | SELECT solo propias | SELECT solo agregados (no datos personales) | nada | SELECT all |
| `confirmaciones_entrega` | INSERT propias, SELECT del grupo | SELECT (anonimizado) | nada | SELECT all |
| `disputas` | INSERT, SELECT del grupo | SELECT propias | nada | UPDATE all |
| `eventos_pago` | nada | nada | nada | SELECT all |

**Edge functions corren con `service_role`** (bypass RLS), por eso son las únicas que pueden mover dinero.

---

## 11. Webhooks MP — handling

```typescript
// pseudocódigo
async function handleMPWebhook(req) {
  // 1. Verificar firma
  if (!verifySignature(req, MP_WEBHOOK_SECRET)) return 401;

  // 2. Idempotencia
  const eventId = req.body.id;
  const exists = await db.eventos_pago.findOne({ mp_event_id: eventId });
  if (exists) return 200; // ya procesado

  // 3. Tipo
  switch (req.body.type) {
    case 'payment':
      await handlePaymentUpdate(req.body.data.id);
      break;
    case 'merchant_order':
      await handleMerchantOrder(req.body.data.id);
      break;
    case 'chargeback':
      await handleChargeback(req.body.data.id);  // congela transacción
      break;
  }

  // 4. Insert evento (siempre, audit log)
  await db.eventos_pago.insert({ ... });
  return 200;
}
```

**Race condition prevention**: usar `select ... for update` en `transacciones` cuando se actualiza estado, o transacción de Postgres con `isolation_level=serializable`.

---

## 12. Prerequisites para arrancar Slice 4

### Cuenta y credenciales
- [ ] Cuenta Mercado Pago de **vendedor** activada (titular del negocio MaPaPis)
- [ ] Crear app en https://www.mercadopago.com.ar/developers/panel/app
- [ ] Obtener:
  - `APP_ID`
  - `CLIENT_ID`
  - `CLIENT_SECRET`
  - `ACCESS_TOKEN_TEST` (sandbox)
  - `ACCESS_TOKEN_PROD` (live, después de validar)
  - `PUBLIC_KEY_TEST`
  - `PUBLIC_KEY_PROD`
- [ ] Habilitar **Marketplace** en la app (puede requerir solicitud manual a MP support).
- [ ] Configurar webhook URL pública: `https://<edge-function-domain>/mp-webhook`
- [ ] Generar `MP_WEBHOOK_SECRET` para firma.

### Cuentas de pyme (testing)
- [ ] 2 cuentas MP de test (vendedor + comprador) creadas en https://www.mercadopago.com.ar/developers/panel/test-users
- [ ] Asociar cada pyme test a su `mp_marketplace_id` en `pymes` table.

### Variables en Supabase
- [ ] Configurar secrets en Edge Functions:
  - `MP_ACCESS_TOKEN`
  - `MP_WEBHOOK_SECRET`
  - `MP_BASE_URL` (`https://api.mercadopago.com`)
  - `MAPAPIS_FEE_PERCENT_DEFAULT` (`10`)

### CLI / herramientas
- [ ] `supabase` CLI instalado para deploy de edge functions
- [ ] `ngrok` o similar para testing local de webhooks (mientras no haya prod)

---

## 13. Roadmap de implementación (granular)

### Slice 4.0 — Fundaciones (1-2 días)
1. Migration `db/004_pagos_escrow.sql` con todas las tablas + RLS + triggers
2. RLS policies por tabla
3. Trigger de inmutabilidad en `eventos_pago`

### Slice 4.1 — Pago de familia (2-3 días)
1. Edge function `crear-preferencia-pago` (sandbox MP)
2. UI: pantalla "Pagá tu cuota" en grupo adjudicado
3. Edge function `mp-webhook` solo para `payment.approved`
4. Estado avanza a `fondos_en_escrow_mp` cuando todas pagaron

### Slice 4.2 — Confirmación grupal (2 días)
1. UI: pantalla "Confirmar entrega" con foto/video upload
2. Edge function `confirmar-entrega` con lógica de umbral
3. Edge function `liberar-fondos` (call MP release)

### Slice 4.3 — Cron + timeouts (1 día)
1. Cron `cron-timeout-confirmaciones`
2. Cron `cron-rebill-fallidos`

### Slice 4.4 — Milestones (2 días, post-MVP)
1. Tabla `milestones` activada
2. UI: tracker visual de hitos
3. Liberación parcial automática

### Slice 5 — Disputas + reembolsos parciales + anti-bypass (3-4 días)
- Mediación con criterios objetivos
- Reembolso parcial con cálculo automático
- Sanitizer regex + OCR
- Penalty cascade

---

## 14. Métricas a trackear

- **Tasa de pago completado** (familias que pagan / familias adjudicadas)
- **Tiempo medio: adjudicación → escrow_completo**
- **Tiempo medio: entrega → release**
- **Tasa de disputas** (disputas / transacciones cerradas)
- **Reembolso medio** (% del monto inicial)
- **Take rate efectivo** (revenue real / GMV) — debe ≥ 8% para sostener el negocio
- **Bypass detectados** / **bypass castigados** (precision del sanitizer)

---

## 15. Cosas que NO entran en v1 (deuda técnica explícita)

- Manejo de monedas extranjeras
- Dispute por chargeback bancario externo (más allá del flow MP)
- Pagos recurrentes (cuotas mensuales)
- Multi-pyme en una misma necesidad (split por items)
- KYC propio (delegamos en MP)

---

## 16. Glosario rápido

- **Escrow**: dinero retenido por un tercero (MP) hasta que se cumplan condiciones.
- **Application fee**: la comisión que MaPaPis cobra, configurada en la Preference y descontada automático por MP.
- **Marketplace API**: feature de MP para apps tipo plataforma (multi-vendedor).
- **Release**: API call que indica a MP "libera estos fondos al collector_id de la pyme".
- **Chargeback**: contracargo del banco emisor — el comprador desconoce el cobro. Más serio que disputa interna.
