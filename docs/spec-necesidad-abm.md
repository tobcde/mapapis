# Spec — ABM completo de Necesidad

> **Estado:** propuesta. Producto definido a nivel general, **decisiones de producto pendientes** marcadas en §10. Implementación posterior a aprobación.
>
> **Fecha:** 2026-04-28.

---

## 1. Resumen

Hoy la necesidad tiene únicamente **Alta (Crear)** y **Lectura**. Falta:

- **Modificación (editar)**: cambiar título, descripción, items, fechas, presupuesto, etc. después de publicada.
- **Baja (cancelar/eliminar)**: detener una necesidad que ya no aplica.
- **Reabrir**: si fue cancelada por error, volver a activarla.

Estas operaciones son **delicadas** porque la necesidad tiene dependencias en cascada: ofertas presentadas, inscripciones de alumnos, votos, pagos en escrow. Cualquier modificación tiene que considerar cómo se ven afectados los actores que ya invirtieron tiempo (pymes cotizando, familias inscribiéndose).

---

## 2. Estado actual (lo que ya existe)

✅ **Alta**: `/publicar` con form completo (grupo, categoría, modalidad, composición, fechas, presupuesto, foto general)
✅ **Lectura**: `/grupos/:id/necesidades/:id` (detalle) + listas en `/feed` y `/grupos/:id`

❌ **Modificación**: no implementado
❌ **Baja/Cancelación**: no implementado
❌ **Reapertura**: no implementado

---

## 3. Permisos (quién puede hacer qué)

Matriz por rol y por estado de la necesidad:

| Rol | Estado | Crear | Editar | Cancelar | Reabrir |
|---|---|:---:|:---:|:---:|:---:|
| **Admin del grupo** (creador o admin) | `recibiendo_ofertas` | ✅ | ✅ con restricciones (§5) | ✅ | — |
| **Admin del grupo** | `en_votacion` | — | ❌ (bloqueado, ya hay ofertas) | ✅ | — |
| **Admin del grupo** | `adjudicada` / `en_produccion` | — | ❌ | ⚠️ requiere disputa formal | — |
| **Admin del grupo** | `cumplida` / `disputada` | — | ❌ | ❌ | — |
| **Admin del grupo** | `cancelada` | — | ❌ | — | ✅ si dentro de plazo |
| **Creador de la necesidad** | (cualquier estado) | — | + permisos extra (puede editar también si es admin) | + permisos extra | — |
| **Familia (no admin) miembro del grupo** | (cualquiera) | ❌ | ❌ | ❌ | ❌ |
| **Pyme** | (no aplica) | ❌ | ❌ | ❌ | ❌ |
| **Admin del sistema** | (cualquiera) | ✅ | ✅ override | ✅ override | ✅ override |

> **Decisión:** ¿el creador no-admin puede editar/cancelar su propia necesidad? Recomendación: **NO** — cualquier acción de edit/cancel pasa por admin del grupo. Evita conflicto donde un papá publica algo y otro papá decide cancelar.

---

## 4. Operaciones detalladas

### 4.1 Modificación (Update)

#### 4.1.1 Reglas según estado

**`recibiendo_ofertas`** (sin ofertas todavía): edición libre.
**`recibiendo_ofertas`** (con 1+ ofertas presentadas): edición restringida.
**`en_votacion`**: edición bloqueada (cambiar el pedido invalidaría votos).
**`adjudicada`** y posteriores: edición bloqueada (bloqueado al "contrato cerrado").

#### 4.1.2 Campos editables vs. bloqueados

| Campo | Sin ofertas | Con ofertas presentadas | En votación o posterior |
|---|:---:|:---:|:---:|
| Título | ✅ | ✅ | ❌ |
| Descripción / observación | ✅ | ✅ | ❌ |
| Foto general | ✅ | ✅ | ❌ |
| Composición (items, cantidades) | ✅ | ⚠️ con aviso a pymes (§4.1.3) | ❌ |
| Modalidad (grupal/individual) | ✅ | ❌ — cambia toda la lógica | ❌ |
| Cantidad por alumno | ✅ | ⚠️ con aviso | ❌ |
| Presupuesto máximo | ✅ | ⚠️ con aviso | ❌ |
| Categoría | ✅ | ⚠️ con aviso | ❌ |
| Fecha cierre inscripción | ✅ | ✅ (solo extender, nunca acortar) | ❌ |
| Fecha entrega | ✅ | ⚠️ con aviso (extender libre, acortar requiere conformidad pymes) | ❌ |
| Cap de ofertas | ✅ | ⚠️ no permitir bajar por debajo del nº actual | ❌ |
| Grupo destino | ❌ — nunca | ❌ | ❌ |

#### 4.1.3 "Con aviso a pymes"

Cuando un cambio afecta el contrato implícito con pymes que ya ofertaron:
- **Las ofertas existentes se marcan como "desactualizadas"** (estado `oferta_pendiente_revision`).
- La pyme recibe **notificación** ("la necesidad cambió, revisá tu oferta") con un botón en su detalle.
- La pyme puede:
  - **Confirmar la oferta como sigue** (mantiene precio, sabe que el pedido es distinto)
  - **Modificar la oferta** (ajustar precio o items)
  - **Retirar la oferta**
- Las **votaciones existentes se invalidan** (la familia tiene que volver a votar con la oferta confirmada/actualizada).

#### 4.1.4 UI de edición

- Botón **"Editar"** en el detalle de la necesidad (`NecesidadDetail`), visible solo para admin/creador.
- Click → abre form similar al de `/publicar` pre-cargado con los valores actuales.
- Campos bloqueados aparecen **deshabilitados con tooltip explicativo** ("no editable: ya hay ofertas presentadas").
- Submit → confirma con dialog: *"X pymes ya presentaron oferta. Las ofertas afectadas quedarán desactualizadas y se les avisará para confirmar/modificar. ¿Continuar?"*
- Si pasó la inscripción cerrada → bloqueo total, con mensaje y opción "Cancelar y republicar".

### 4.2 Baja (Cancelación)

#### 4.2.1 Modelo: soft delete con estado `cancelada`

**No** se borra la fila. Se cambia `estado = 'cancelada'` y se setea `cancelada_at`, `cancelada_por`, `motivo_cancelacion`. Esto:
- Mantiene history para auditoría y disputas
- Permite reapertura si fue error (§4.3)
- Las ofertas, inscripciones, votos quedan en sus estados pero la necesidad ya no es operable

#### 4.2.2 Reglas según estado

**`recibiendo_ofertas`**: cancelación libre. Aviso simple a familias inscriptas.
**`en_votacion`**: cancelación con confirmación enfática (hay pymes que cotizaron, hay votos). Aviso a todos.
**`adjudicada` / `en_produccion`**: solo via **disputa formal** con admin del sistema. La pyme adjudicada puede tener costos hundidos. Posible compensación.
**`cumplida`**: ❌ no se puede cancelar (ya entregaron).
**`disputada`**: ❌ no se puede cancelar (en proceso de mediación).
**`cancelada`**: ❌ ya está cancelada.

#### 4.2.3 Efectos en cascada al cancelar

| Entidad | Comportamiento |
|---|---|
| Ofertas presentadas | Pasan a estado `descartada` con motivo "necesidad cancelada" |
| Votos | Se invalidan (no se borran, quedan como histórico) |
| Inscripciones de alumnos | Se mantienen como histórico, no afectan otras necesidades |
| Pagos pendientes | Se reembolsan automáticamente (si hubiese ya cobrado MP escrow) |
| Pyme suscripta a "avísame al cierre" | Se notifica de la cancelación |

#### 4.2.4 UI de cancelación

- Botón **"Cancelar necesidad"** en el detalle, en sección "Más acciones" o tres-puntos.
- Visible solo para admin/creador del grupo.
- Click → dialog con:
  - Resumen del impacto: *"Esto va a descartar 3 ofertas y notificar a 12 familias inscriptas."*
  - Campo obligatorio: *"Motivo (visible para pymes y familias)"* — texto libre, max 200 chars.
  - Botón **"Cancelar necesidad"** (destructivo, color coral) y **"Volver"**.

### 4.3 Reapertura (post-cancelación)

#### 4.3.1 Reglas

- Solo dentro de **48 horas post-cancelación** (configurable).
- Solo el admin/creador que canceló la necesidad puede reabrirla (o admin del sistema).
- Las ofertas previamente descartadas **no vuelven**: las pymes tienen que re-cotizar.
- Las inscripciones de familias se pueden mantener **opcional**: ¿retomar inscriptos previos o requerir re-inscripción? — recomendación: **mantener inscripciones**, así no perdés el momentum.
- Las fechas (cierre inscripción, entrega) se extienden automáticamente N días para compensar el tiempo perdido (configurable, default = días que estuvo cancelada).

#### 4.3.2 UI

- En el detalle de una necesidad cancelada, botón **"Reabrir"** si está dentro del plazo.
- Visible solo para quien la canceló.
- Dialog: *"Reabrir esta necesidad. Las pymes tendrán que volver a cotizar. Fechas se extienden N días. ¿Continuar?"*

---

## 5. Estados afectados

Estado actual del enum `necesidades.estado`:
```
recibiendo_ofertas | en_votacion | adjudicada | en_produccion | en_entrega
| pendiente_confirmacion_grupo | completada | cumplida | disputada | cancelada
```

Si bien `cancelada` ya existe, **no hay flujo de cancelación**. Hay que cablearlo.

Posibles estados nuevos:
- `oferta_pendiente_revision` (para ofertas) cuando la necesidad cambió y la pyme tiene que confirmar/modificar/retirar.

---

## 6. Modelo de datos — cambios

### 6.1 Tabla `necesidades` — columnas nuevas

```sql
alter table public.necesidades
  add column if not exists cancelada_at timestamptz,
  add column if not exists cancelada_por uuid references public.profiles(id),
  add column if not exists motivo_cancelacion text;
```

### 6.2 Tabla `ofertas` — columna nueva (para revisión)

```sql
-- Si la necesidad cambió después de la oferta, esta queda "desactualizada"
-- y la pyme tiene que confirmar/modificar/retirar.
alter table public.ofertas
  add column if not exists necesidad_actualizada_at timestamptz;
-- Cuando NULL: oferta sincronizada con la necesidad.
-- Cuando set: la necesidad cambio, la pyme aun no acuso recibo.
```

### 6.3 Tabla nueva (opcional) `necesidad_history`

Para auditoría de cambios:

```sql
create table public.necesidad_history (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  cambio_por uuid not null references public.profiles(id),
  campos_cambiados jsonb not null,  -- { titulo: { antes, despues }, ... }
  motivo text,
  created_at timestamptz default now()
);
```

> **Decisión:** ¿hay history o no? Recomendación inicial: **no**, salvo para cancelación. Si después se necesita auditoría más profunda, se agrega.

---

## 7. RPCs nuevas

```sql
-- Modificar necesidad. Valida estado, permisos, y campos editables segun estado.
-- Marca ofertas afectadas como "necesidad_actualizada_at = now()".
editar_necesidad(
  p_necesidad uuid,
  p_titulo text default null,
  p_descripcion text default null,
  p_foto_url text default null,
  p_composicion jsonb default null,
  p_cantidad_por_alumno int default null,
  p_presupuesto_max_centavos bigint default null,
  p_fecha_cierre_inscripcion timestamptz default null,
  p_fecha_entrega timestamptz default null,
  p_cap_ofertas int default null
) returns public.necesidades

-- Cancelar necesidad. Cascade: ofertas a 'descartada', notifica.
cancelar_necesidad(
  p_necesidad uuid,
  p_motivo text
) returns void

-- Reabrir necesidad cancelada (dentro del plazo).
reabrir_necesidad(
  p_necesidad uuid
) returns void

-- Pyme confirma su oferta tal cual está después de un cambio en la necesidad.
confirmar_oferta_actualizada(p_oferta uuid) returns void

-- Pyme modifica su oferta después de un cambio.
-- (Reusa crear_oferta con merge / update vs nueva fila — definir).

-- Pyme retira su oferta.
retirar_oferta(p_oferta uuid, p_motivo text) returns void
```

---

## 8. UI por pantalla y operación

### 8.1 NecesidadDetail (admin/creador del grupo)

Nueva sección **"Acciones de admin"** (collapsable, default cerrada):

```
┌─────────────────────────────────────────────────┐
│ ▾ Acciones de admin                             │
│                                                 │
│   [✏️ Editar necesidad]  (si estado lo permite)  │
│                                                 │
│   [🗑 Cancelar]  (si estado lo permite)         │
│                                                 │
│   ─── Si está cancelada ───                     │
│   [↩ Reabrir]  (dentro del plazo)               │
│                                                 │
│   Ver historial:                                │
│   • Creada el DD/MM por X                       │
│   • Editada el DD/MM por Y (3 cambios)          │
│   • Cancelada el DD/MM por Z                    │
└─────────────────────────────────────────────────┘
```

### 8.2 Edición — pantalla `/grupos/:id/necesidades/:id/editar`

Form similar al de `/publicar` pero pre-llenado:
- Campos editables: input normal
- Campos bloqueados: input deshabilitado con tooltip explicativo
- Sección superior: **alerta del estado actual** ("Hay 3 ofertas presentadas. Edición restringida.")
- Botón submit:
  - Si cambios afectan ofertas: dialog de confirmación con count de pymes a notificar
  - Si no: submit directo

### 8.3 Cancelación — modal

```
┌──────────────────────────────────────────────┐
│ Cancelar necesidad "Lápices Sala Naranja"   │
├──────────────────────────────────────────────┤
│                                              │
│ ⚠️ Vas a cancelar esta necesidad.            │
│                                              │
│ Esto va a:                                   │
│ • Descartar las 3 ofertas que recibió        │
│ • Notificar a 12 familias inscriptas         │
│ • Liberar a las pymes para otras compras     │
│                                              │
│ Motivo (lo verán pymes y familias) *         │
│ ┌──────────────────────────────────────────┐ │
│ │ Decidimos buscar otro proveedor...       │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│       [Volver]   [🗑 Cancelar necesidad]     │
└──────────────────────────────────────────────┘
```

### 8.4 Pyme — vista de oferta desactualizada

Cuando la necesidad de una oferta presentada cambió, en `/mis-ofertas` la card muestra:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ NECESIDAD ACTUALIZADA                            │
│                                                     │
│ "Lápices Sala Naranja"                              │
│ La familia cambió: composicion (1 item agregado)    │
│ tu oferta: $14.500 (sin cambios)                    │
│                                                     │
│ Antes de seguir en votación, confirmá tu oferta:    │
│                                                     │
│   [✓ Mantener oferta]  [✏️ Modificar]  [✕ Retirar]  │
└─────────────────────────────────────────────────────┘
```

### 8.5 Familia — aviso de cambio

Banner en el detalle de la necesidad cuando hay ofertas pendientes de revisión:

```
ℹ️  Modificaste la necesidad. Esperando que las pymes
   confirmen sus ofertas (2 de 3 ya confirmaron).
```

---

## 9. Edge cases

| Caso | Manejo propuesto |
|---|---|
| Editar mientras una pyme está cargando oferta | La pyme termina de cargar; al submit, su oferta queda con `necesidad_actualizada_at = now()` automático. La pyme verá el aviso al refrescar. |
| Cancelar con pago en escrow (MP retuvo plata) | Reembolso automático via `mp_refund` + notificación. Si MP no permite refund automático, se queda en `pendiente_reembolso` para acción manual del admin del sistema. |
| Cancelar y reabrir en menos de 5 minutos | Permitido. La extensión de fechas es proporcional al tiempo cancelada. |
| Reabrir después del plazo (>48h) | Bloqueado. Sugerir crear nueva necesidad clonada. |
| Editar el creador y luego sale del grupo | El creador deja de tener permisos. El siguiente admin del grupo puede editar/cancelar. |
| 2 admins editan al mismo tiempo | Optimistic concurrency: `updated_at` se compara en update. Si cambió, mostrar conflicto y pedir refresh. |
| Modificar `composicion` sacando un item que la pyme ya cotizó | La oferta queda desactualizada. La pyme decide si retira la variante de ese item o ajusta total. |

---

## 10. Decisiones pendientes (producto)

1. **¿Creador no-admin puede editar/cancelar su propia necesidad?**
   Recomendación: **NO**. Solo admin del grupo (creador suele ser admin de hecho). Evita conflictos.

2. **¿Plazo de reapertura post-cancelación?**
   Recomendación: **48 horas**. Configurable a futuro.

3. **¿Las inscripciones de familias se mantienen al reabrir?**
   Recomendación: **SÍ** — preserva el momentum del grupo.

4. **¿Hay tabla `necesidad_history`?**
   Recomendación inicial: **NO** (KISS). Solo guardar metadata de cancelación.

5. **¿Cancelar `adjudicada`/`en_produccion` necesita disputa formal o admin del grupo solo?**
   Recomendación: **disputa formal** (involucra al admin del sistema). La pyme adjudicada tiene derecho a defenderse / pedir compensación.

6. **¿Las fechas se extienden automáticamente al reabrir?**
   Recomendación: **SÍ**, en N días = días que estuvo cancelada (default). El admin puede ajustar manualmente al reabrir.

7. **¿Notificaciones automáticas?**
   Si tenés sistema de notif (push o email), notificar a:
   - Pymes que ofertaron (cambios + cancelación)
   - Pymes suscriptas a "avísame al cierre" (cancelación)
   - Familias inscriptas (cancelación)
   Si no hay sistema, se queda como banner in-app.

8. **¿Cambios destructivos requieren contraseña / confirmación adicional?**
   Recomendación: cancelar + reabrir no, pero campo `motivo` obligatorio. Editar campos críticos (cantidad, presupuesto) → dialog de confirmación con preview.

9. **¿UI de "edit history" visible para familias y pymes?**
   Recomendación: solo metadata pública en pyme/familia view ("modificada por última vez DD/MM, 2 ediciones"). Detalle solo para admin del grupo.

---

## 11. Estimación de implementación

Asumiendo decisiones tomadas y la base actual:

| Pieza | Esfuerzo |
|---|---|
| Migración SQL: columnas + RPCs (`editar`, `cancelar`, `reabrir`, `confirmar_oferta_actualizada`, `retirar_oferta`) | 2-3 hs |
| Frontend: form de edición pre-llenado con bloqueos contextuales | 3-4 hs |
| Frontend: modal de cancelación + reapertura | 1-2 hs |
| Frontend: pantalla "ofertas pendientes de revisión" + flujos confirmar/modificar/retirar | 3-4 hs |
| Frontend: banners e indicadores en detalle de la necesidad | 1 hs |
| Refactor `crear_oferta` + nueva `editar_oferta` | 2 hs |
| Sistema de notificaciones (si aplica — fuera de scope este sprint) | — |
| Testing manual end-to-end | 2 hs |

**Total: ~14-18 hs** (~2 días enteros) sin notificaciones automáticas.

---

## 12. Estado actual

### ✅ Hecho
- Alta y lectura completos.
- Estado `cancelada` ya existe en el enum.

### ⏳ Pendiente
Todo lo de §4 a §8.

### 🤔 Decisiones de producto antes de codear
Ver §10 — 9 puntos a confirmar.
