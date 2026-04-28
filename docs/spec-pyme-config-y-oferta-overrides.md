# Spec — Config de pyme (dirección, horarios, modos de entrega) + overrides por oferta

> **Estado:** propuesta. Implementación pendiente.
>
> **Fecha:** 2026-04-28.

---

## 1. Resumen

La pyme hoy tiene un perfil con datos básicos (nombre comercial, CUIT, zonas, etc.) pero le **falta info operativa** que la familia necesita ver al evaluar una oferta:

- **Dirección física** del local (privada hasta adjudicación)
- **Local a la calle** (S/N)
- **Horarios de atención por día** (con rangos múltiples para horario partido)
- **Hace envíos** (S/N)

Estos datos van **una sola vez en la config de la pyme** y se **traen por defecto en cada oferta** que presenta. Pero la pyme puede **sobreescribirlos por oferta** (ej. "para ESTE pedido excepcional no hago envío" o "ese día abrimos hasta más tarde").

**Excepción:** la **dirección NO se sobreescribe por oferta** porque la familia no la ve hasta adjudicación. Va siempre como está en config.

---

## 2. Caso de uso

### 2.1 Pyme se configura una sola vez

En `/pyme/onboarding` o en `/perfil` (si ya está creada):

```
DATOS DEL LOCAL

Dirección
[ Av. Cabildo 1234, Belgrano, CABA      ]
🔒 Privada — solo se muestra a la familia ganadora.

¿Tenés local a la calle?     [● Sí]   [○ No]

Horarios de atención
┌──────────────────────────────────────────────┐
│ LUN  ☑ Abierto  10:00–14:00  16:00–21:00 [+] │
│ MAR  ☑ Abierto  10:00–14:00  16:00–21:00 [+] │
│ MIE  ☑ Abierto  10:00–14:00  16:00–21:00 [+] │
│ JUE  ☑ Abierto  10:00–14:00  16:00–21:00 [+] │
│ VIE  ☑ Abierto  10:00–14:00  16:00–21:00 [+] │
│ SAB  ☑ Abierto  10:00–14:00            [+]   │
│ DOM  ☐ Cerrado                                │
└──────────────────────────────────────────────┘

¿Hacés envíos?  [● Sí]   [○ No]
```

### 2.2 Pyme presenta una oferta

En el form de oferta, **entre "Tiempo de entrega" y "Detalle de la oferta"**, aparece un bloque **"Disponibilidad para este pedido"** pre-cargado con la config de la pyme:

```
DISPONIBILIDAD PARA ESTE PEDIDO        [✏️ Editar]

✓ Local a la calle (con retiro)
✓ Hago envío
✓ Horarios este día (28/04, día de entrega): 10–14, 16–21
```

Click "✏️ Editar" → expande con overrides editables:

```
DISPONIBILIDAD PARA ESTE PEDIDO        [⊠ Cerrar]

Local a la calle    [● Sí]   [○ No]
Hago envío          [● Sí]   [○ No]   ← override: para ESTE pedido no hago

Horarios el día de entrega (28/04)
[ 10:00 - 14:00 ] [ 16:00 - 19:00 ]   ← override: cierro más temprano
[+ agregar rango]

ℹ Dejá los valores tal cual si tu config sirve.
   Solo cambialo si para este pedido es distinto.
```

### 2.3 La familia ve la oferta

Bajo el precio + descripción, la oferta muestra:

```
DISPONIBILIDAD

🏪 Tiene local a la calle (retiro disponible)
📦 Hace envío
🕐 Horario el 28/04 (día de entrega): 10–14, 16–19
```

**No se muestra dirección** (queda anónima hasta adjudicación, manteniendo el patrón anti-fraude del marketplace).

### 2.4 Después de adjudicación

Cuando la pyme gana, la familia adjudicada ve la **dirección** y datos de contacto (otro flow ya existente — el detalle de la pyme post-adjudicación).

---

## 3. Modelo de datos

### 3.1 Tabla `pymes` — campos nuevos

```sql
alter table public.pymes
  add column if not exists direccion text,
  add column if not exists local_a_la_calle boolean default false,
  add column if not exists hace_envios boolean default false,
  add column if not exists horarios jsonb default '{}'::jsonb;
```

#### Shape de `horarios` (JSONB)

```jsonc
{
  "lun": {
    "abierto": true,
    "rangos": [
      { "desde": "10:00", "hasta": "14:00" },
      { "desde": "16:00", "hasta": "21:00" }
    ]
  },
  "mar": { "abierto": true, "rangos": [/*...*/] },
  "mie": { "abierto": true, "rangos": [/*...*/] },
  "jue": { "abierto": true, "rangos": [/*...*/] },
  "vie": { "abierto": true, "rangos": [/*...*/] },
  "sab": { "abierto": true, "rangos": [{ "desde": "10:00", "hasta": "14:00" }] },
  "dom": { "abierto": false, "rangos": [] }
}
```

**Validación (vía trigger):**
- 7 keys exactas: lun, mar, mie, jue, vie, sab, dom
- Cada day: `abierto` boolean + `rangos` array
- `rangos`: max 4 rangos por día
- Cada rango: `desde` y `hasta` en formato `HH:MM` (regex `^[0-2][0-9]:[0-5][0-9]$`)
- `desde < hasta` por rango (no validamos solapados — la pyme puede declarar lo que quiera)

### 3.2 Tabla `ofertas` — campos override

```sql
alter table public.ofertas
  -- Los 3 son nullable. NULL = usar el valor de la pyme.
  add column if not exists local_a_la_calle_override boolean,
  add column if not exists hace_envio_override boolean,
  -- Solo guarda los rangos del día de entrega — más simple que el JSONB completo.
  add column if not exists horarios_dia_entrega_override jsonb;
```

**Decisión:** ¿guardar el horario del día de entrega o un JSONB completo de la semana?
- Recomendación: **solo el día de entrega** porque es lo único relevante para la familia. La pyme puede tener cambios temporales para ese día puntual.
- `horarios_dia_entrega_override` shape: array de rangos `[{ desde, hasta }]` directamente (sin map por día).

---

## 4. RPCs / mutations

### 4.1 Update config pyme (extender)

`actualizar_pyme` (ya existe) — agregar a su firma los 4 campos nuevos. Backwards compat: si vienen NULL, no se tocan.

### 4.2 `crear_oferta` y `editar_oferta` — extender

Aceptar:
- `p_local_a_la_calle_override boolean default null`
- `p_hace_envio_override boolean default null`
- `p_horarios_dia_entrega_override jsonb default null`

Validación trigger en `ofertas`: si `horarios_dia_entrega_override` no es null, debe ser un array válido de rangos `{desde, hasta}` (mismo formato que en `pymes.horarios.<dia>.rangos`).

### 4.3 Helper: `oferta_disponibilidad_efectiva`

Función SQL que toma una oferta y devuelve los valores efectivos (override si existe, sino los de la pyme):

```sql
create function public.oferta_disponibilidad_efectiva(p_oferta uuid)
returns table (
  local_a_la_calle boolean,
  hace_envio boolean,
  horarios_dia_entrega jsonb
) ...
```

Útil para el FE para no replicar la lógica de "override-or-default".

---

## 5. UI por pantalla

### 5.1 `/pyme/onboarding` — paso nuevo

Agregar paso entre los actuales (datos generales) y el final (review):

**"Sobre tu local"**
- Dirección (textarea, opcional pero recomendado)
- Local a la calle (toggle)
- Hacés envíos (toggle)
- Editor de horarios

### 5.2 `/perfil` (vista pyme) — sección nueva

Card "Datos del local" con los mismos campos en modo edición inline (similar al alias MP).

### 5.3 `HorariosEditor` — componente nuevo

```
┌────────────────────────────────────────────────────┐
│  LUN   ☑ Abierto                                   │
│        ┌─────────┐ a ┌─────────┐  [✕]              │
│        │ 10:00   │   │ 14:00   │                   │
│        └─────────┘   └─────────┘                   │
│        ┌─────────┐ a ┌─────────┐  [✕]              │
│        │ 16:00   │   │ 21:00   │                   │
│        └─────────┘   └─────────┘                   │
│        [+ agregar rango]                           │
├────────────────────────────────────────────────────┤
│  MAR   ☑ Abierto    [📋 igual a lunes]             │
│        ...                                          │
├────────────────────────────────────────────────────┤
│  ...                                                │
│  DOM   ☐ Cerrado                                   │
└────────────────────────────────────────────────────┘
```

**Botones útiles:**
- "📋 igual a lunes" en cada día → copia los rangos del lunes (ahorra tipear lo mismo 5 veces para Lun-Vie)
- "✕" para borrar un rango
- "+ agregar rango" para agregar un segundo (o tercero) rango al mismo día

### 5.4 Form de oferta — bloque nuevo "Disponibilidad para este pedido"

**Posición:** entre "Tiempo de entrega (días)" y "Detalle de la oferta".

**Estado inicial (colapsado):**

```
┌─────────────────────────────────────────────────────┐
│ DISPONIBILIDAD PARA ESTE PEDIDO        [✏️ Editar] │
│ ✓ Local a la calle (retiro)                         │
│ ✓ Hago envío                                        │
│ 🕐 28/04 (entrega): 10–14, 16–21                    │
└─────────────────────────────────────────────────────┘
```

Pre-cargado con valores de la pyme. Si todo viene de la config, etiqueta tipo "(según mi config)".

**Estado expandido (al tocar Editar):**

```
┌─────────────────────────────────────────────────────┐
│ DISPONIBILIDAD PARA ESTE PEDIDO        [Cerrar]    │
│                                                     │
│ ¿Local a la calle (retiro disponible)?              │
│   [● Sí]  [○ No]   ← editable                       │
│                                                     │
│ ¿Hacés envío para este pedido?                      │
│   [○ Sí]  [● No]   ← override: NO para este pedido  │
│                                                     │
│ Horarios del día de entrega (28/04)                 │
│   [ 10:00 ] – [ 14:00 ]  [✕]                        │
│   [ 16:00 ] – [ 19:00 ]  [✕]   ← override           │
│   [+ agregar rango]                                 │
│                                                     │
│ Tu config dice: 10–14, 16–21. Estás cambiando      │
│ el horario solo para este pedido.                   │
└─────────────────────────────────────────────────────┘
```

Si la pyme cambia algo → indicador visual (icono ✏️ o color distinto) que ese override está activo. Si lo deja igual a la config, el override queda NULL en DB.

### 5.5 Display oferta (familia)

Sección bajo la descripción + variantes:

```
DISPONIBILIDAD

🏪 Tiene local a la calle (retiro)
📦 Hace envío  [O bien:  ⊘ No hace envío para este pedido]
🕐 Horario del 28/04 (día de entrega): 10–14, 16–19
```

**Lo que NO se muestra:** dirección. Permanece privada hasta adjudicación.

### 5.6 Display post-adjudicación (familia ganadora)

Una vez adjudicada, la familia ve un bloque adicional de "Datos de la pyme":

```
DATOS DE LA PYME

📍 Av. Cabildo 1234, Belgrano CABA
🏪 Tiene local a la calle
📦 Hace envío
🕐 Horarios:
    Lun-Vie  10–14, 16–21
    Sáb      10–14
    Dom      cerrado
```

(Esto es info COMPLETA de la pyme, no solo el día de entrega.)

---

## 6. Logic flow

### 6.1 Crear oferta — pseudocódigo del form

```typescript
// Cargar config pyme al abrir el form
const pyme = usePymeProfile();

// State del form
const [localOverride, setLocalOverride] = useState<boolean | null>(null);
const [envioOverride, setEnvioOverride] = useState<boolean | null>(null);
const [horariosDiaOverride, setHorariosDiaOverride] = useState<Range[] | null>(null);

// Valores efectivos para mostrar
const localEfectivo = localOverride ?? pyme.local_a_la_calle;
const envioEfectivo = envioOverride ?? pyme.hace_envios;

// Calcular el día de entrega y traer los rangos default
const fechaEntrega = necesidad.fecha_limite_entrega;
const diaDeSemana = obtenerDia(fechaEntrega); // "lun" | "mar" | ...
const rangosDefault = pyme.horarios?.[diaDeSemana]?.rangos ?? [];
const horariosEfectivos = horariosDiaOverride ?? rangosDefault;

// Al submit, mandamos override solo si difiere de la config
const overrides = {
  local: localOverride !== null && localOverride !== pyme.local_a_la_calle ? localOverride : null,
  envio: envioOverride !== null && envioOverride !== pyme.hace_envios ? envioOverride : null,
  horarios: arraysSonIguales(horariosDiaOverride, rangosDefault) ? null : horariosDiaOverride,
};
```

### 6.2 Display de oferta — pseudocódigo

```typescript
const { local_a_la_calle, hace_envio, horarios_dia_entrega } =
  oferta.disponibilidad_efectiva; // viene de la RPC helper

// Render
{local_a_la_calle ? '🏪 Local a la calle' : '⊘ Sin local'}
{hace_envio ? '📦 Hace envío' : '⊘ Sin envío'}
{horarios_dia_entrega.length > 0
  ? `🕐 ${formatRangos(horarios_dia_entrega)}`
  : '⊘ Cerrado el día de entrega'}
```

---

## 7. Validación y edge cases

| Caso | Manejo |
|---|---|
| Pyme no completó horarios y oferta sin override | Mostrar "Horarios no cargados" en oferta. Sugerir a pyme cargar config. |
| Día de entrega cae en domingo y pyme está cerrada los domingos | Display: `⊘ Cerrada el día de entrega`. La familia decide si elige otra pyme. |
| Pyme cambia su config DESPUÉS de presentar oferta | Las ofertas presentadas siguen mostrando los valores **al momento de la oferta** vía override snapshot. Si la oferta no tiene override (NULL), se actualiza con la config nueva. ¿Es lo deseado? Decisión: **SÍ** — los overrides son snapshots; sin override, refleja config actual. |
| `horarios_dia_entrega_override` con rangos solapados o invertidos | Bloquear en frontend con validación; backend solo valida formato. |
| Local a la calle NO + Hace envío NO | Permitido pero raro. Frontend warning: "¿cómo entregás entonces?" — no bloqueante. |
| Pyme oculta dirección a propósito (no carga el campo) | Permitido. Display post-adjudicación muestra "dirección no informada — coordinen por WhatsApp". |

---

## 8. Migración

### 8.1 Migración SQL

`db/038_pyme_config_y_oferta_overrides.sql`:

```sql
-- 1. Campos nuevos en pymes
alter table public.pymes
  add column if not exists direccion text,
  add column if not exists local_a_la_calle boolean default false,
  add column if not exists hace_envios boolean default false,
  add column if not exists horarios jsonb default '{}'::jsonb;

-- 2. Campos override en ofertas
alter table public.ofertas
  add column if not exists local_a_la_calle_override boolean,
  add column if not exists hace_envio_override boolean,
  add column if not exists horarios_dia_entrega_override jsonb;

-- 3. Trigger de validación de horarios (pyme + oferta)
-- ...validar shape de JSONB...

-- 4. Extender actualizar_pyme y crear_oferta para aceptar nuevos params

-- 5. Helper oferta_disponibilidad_efectiva
```

---

## 9. Decisiones pendientes (producto)

1. **¿La dirección es obligatoria al crear pyme?**
   Recomendación: **opcional**, con badge "incompleta" en perfil hasta cargar.

2. **¿`horarios` es obligatorio?**
   Recomendación: **opcional al onboarding**, pero al crear primera oferta avisarle "completá tus horarios para que las familias sepan cuándo retirar/cuando los tenés disponibles".

3. **¿Override por oferta es snapshot o sigue cambios futuros?**
   - **Snapshot**: queda fijo al crear oferta (incluso si pyme cambia config después). Más coherente.
   - **Live**: si no hay override (NULL), refleja config actual. Si hay override, queda fijo.
   - Recomendación: **Live** (NULL = config actual). Si la pyme actualiza horarios, la oferta vieja también se actualiza (a menos que la pyme haya seteado override explícito).

4. **¿Visible "no hace envío para este pedido" o se oculta?**
   Recomendación: **visible** (transparente). La familia decide en base a eso.

5. **¿Día de entrega exacto o el rango cierre-inscripción → entrega?**
   Recomendación: **el día puntual de entrega** (`fecha_limite_entrega`). El override sólo aplica a ESE día.

6. **¿Permitir múltiples overrides por oferta (ej. distintos horarios entre el día del pedido y el día de entrega)?**
   Recomendación: **NO** — solo el día de entrega importa. Si en la práctica se necesita más granular, después se agrega.

7. **¿Qué pasa si la pyme nunca cargó config?**
   Default: `local_a_la_calle=false`, `hace_envios=false`, `horarios={}`. La oferta se ve "sin disponibilidad" → familia menos propensa a votarla.

---

## 10. Estimación

| Pieza | Esfuerzo |
|---|---|
| Migración SQL + triggers + actualización de RPCs | 2 hs |
| Componente `HorariosEditor` (selector por día con rangos múltiples) | 2-3 hs |
| Pyme onboarding: paso "Datos del local" | 1 hs |
| Perfil pyme: card de datos del local editable | 1 hs |
| Form de oferta: bloque "Disponibilidad" pre-llenado + override editable | 2 hs |
| Display oferta familia (bloque "Disponibilidad") | 1 hs |
| Display post-adjudicación (datos de la pyme completos) | 0.5 hs |
| Helper `oferta_disponibilidad_efectiva` y wiring en queries | 1 hs |
| Testing manual end-to-end | 1.5 hs |

**Total: ~12-13 hs** (~1.5 días).

---

## 11. Estado actual

### ✅ Hecho
- Pyme tiene profile con datos básicos
- Form de oferta con tiempo de entrega + descripción

### ⏳ Pendiente
- Todo lo descripto arriba

### 🤔 Decisiones de producto antes de codear
Ver §9.
