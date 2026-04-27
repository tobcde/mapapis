# Spec — Flujo de variantes alternativas en una oferta

> **Estado:** propuesta. Producto definido, **modelo de datos parcial**, **implementación pendiente** (las partes hechas se aclaran al final).
>
> **Fecha:** 2026-04-27. Propuesta surgida en testing del flow de oferta con desglose.

---

## 1. Resumen del flujo

La pyme cotiza una necesidad ofreciendo, **para cada item del pedido**, una o más **alternativas** (A, B, C…) con su propio precio, foto, descripción.

La familia primero **elige la pyme ganadora** votando a nivel oferta (no por variante). Una vez adjudicada esa pyme, **cada familia inscripta elige individualmente cuál alternativa quiere para su hijo/a** entre las opciones que la pyme ofreció.

El **precio final por familia** se calcula con la elección puntual de cada una (no es uniforme). La pyme recibe una lista detallada con qué entregar a cada familia.

```
                                   ┌─────────────────────────────────────┐
                                   │ Necesidad: "Lápiz negro × 1 alumno" │
                                   └─────────────────────────────────────┘
                                                    │
                            ┌───────────────────────┴───────────────────────┐
                            │                                               │
                  ┌─────────▼─────────┐                          ┌──────────▼─────────┐
                  │ PYME 1 oferta:    │                          │ PYME 2 oferta:     │
                  │  para "lapiz neg" │                          │  para "lapiz neg"  │
                  │  A: Faber  $500   │                          │  X: Stabilo $600   │
                  │  B: Maped  $400   │                          │  Y: Bic $350       │
                  │  C: BIC    $350   │                          │                    │
                  └─────────┬─────────┘                          └────────────────────┘
                            │
                  Familias votan a la oferta completa
                            │
                  ┌─────────▼─────────┐
                  │ Pyme 1 gana       │
                  └─────────┬─────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
  Familia Pérez        Familia López        Familia Gómez
  elige A (Faber)      elige B (Maped)      elige A (Faber)
  paga $500            paga $400            paga $500
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                            ▼
                  Pyme recibe planilla:
                  - Pérez: 1× Faber
                  - López: 1× Maped
                  - Gómez: 1× Faber
```

---

## 2. Caso de uso real

**Necesidad**: "Cada alumno de Sala Naranja necesita 1 lápiz negro" (modalidad individual, 18 alumnos inscriptos).

**Pyme A oferta:**
- Para *Lápiz negro*:
  - **Faber-Castell HB** — $500/u, foto, link a sitio fabricante
  - **Maped Black'Peps** — $400/u, foto
  - **Bic Evolution** — $350/u, sin foto
- Precio total de la oferta = `max($500, $400, $350) × 18 = $9.000` (techo)

**Pyme B oferta:**
- Para *Lápiz negro*:
  - **Stabilo Pencil 160** — $600/u
  - **Bic Evolution** — $370/u
- Precio total = `$600 × 18 = $10.800` (techo)

**Las familias votan** entre Pyme A y Pyme B. Cada voto es a nivel oferta, no variante.

**Pyme A gana** la votación. Se notifica a las 18 familias: *"ganó Pyme A. Elegí qué lápiz querés para tu hijo/a."*

**Cada familia entra a su perfil de la necesidad y elige una alternativa:**
- Pérez (1 alumno): elige Faber-Castell HB → paga $500 + comisión + envío proporcional
- López (1 alumno): elige Maped → paga $400 + comisión + envío proporcional
- Gómez (1 alumno, pero con 2 hijos en el grupo) elige Bic para los dos → paga $350×2 = $700 + comisión + envío proporcional
- ...

**Cuando todas eligieron** (o pasó la fecha límite), Pyme A recibe la planilla:
```
PEDIDO FINAL — Sala Naranja
Cantidad total: 18 lápices

Por familia:
  Pérez (Mateo)         → 1× Faber-Castell HB
  López (Sofía)         → 1× Maped Black'Peps
  Gómez (Lucas + Mia)   → 2× Bic Evolution
  ...

Por variante (resumen pyme):
  Faber-Castell HB:  7 unidades
  Maped:             6 unidades
  Bic:               5 unidades
  TOTAL              18 unidades

Plata total a recibir (post-comisión MaPaPis 5%):
  $X (detalle por familia)
```

---

## 3. Cómo encaja en los estados de la necesidad

El flujo agrega un **nuevo estado** o sub-fase entre `adjudicada` y `en_produccion`:

```
recibiendo_ofertas
       ↓
en_votacion          (familias votan oferta completa)
       ↓
adjudicada           (gana pyme X)
       ↓
elegir_variantes     ← NUEVO. Cada familia elige variante por item.
       ↓
en_produccion        (pyme arma el pedido con la planilla)
       ↓
en_entrega
       ↓
completada
```

**Triggers de transición:**

- `adjudicada → elegir_variantes`: automática al adjudicar, **solo si la oferta ganadora tiene >1 variante por al menos un item**. Si todas las variantes son únicas, salta directo a `en_produccion` (no hay nada que elegir).
- `elegir_variantes → en_produccion`:
  - Automática cuando todas las familias inscriptas eligieron, **O**
  - Por timeout (`fecha_limite_eleccion_variantes` — typically 48-72hs después de adjudicar). Las que no eligieron quedan con la **opción más barata como default** (decisión de producto, ver §9).

---

## 4. Modelo de datos

### 4.1 Lo que ya existe (parcialmente implementado en `pablo`)

```typescript
interface OfertaVariante {
  nombre: string;
  precio_centavos: number;
  cantidad?: number;           // por defecto 1, suele ser 1 cuando hay alternativas
  item_ref?: string | null;    // matchea con composicion item de la necesidad
  descripcion?: string | null;
  foto_url?: string | null;
  link_url?: string | null;
}
```

Las variantes con el **mismo `item_ref`** se interpretan como alternativas para ese item. Esto ya está modelado en la oferta actual.

### 4.2 Lo que falta — Tabla `elecciones_variante`

Cada familia (vía un alumno suyo) elige una variante específica para cada item de la necesidad.

```sql
create table public.elecciones_variante (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  oferta_id uuid not null references public.ofertas(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  -- Identificación del item dentro de la composicion de la necesidad
  item_ref text not null,
  -- Identificación de la variante elegida dentro de la oferta
  -- Indice posicional o un slug único — definir.
  variante_index int not null,
  -- Snapshot del precio al momento de elegir (por si la oferta luego cambia)
  precio_centavos_unitario_snapshot bigint not null,
  cantidad_snapshot int not null default 1,
  elegido_por uuid references public.profiles(id),  -- el tutor que hizo la elección
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (necesidad_id, alumno_id, item_ref)  -- una elección por (alumno, item)
);
```

**Notas:**
- Se identifica la variante por `variante_index` (posición en el array `variantes` de la oferta) o un campo `id` interno si se decide darle uno. Pendiente de decisión.
- Los snapshots de precio/cantidad evitan que un cambio en la oferta (post-adjudicación) altere lo que la familia ya pagó.
- La unicidad se da por (alumno, item): cada alumno tiene UNA elección por item.

### 4.3 RPCs nuevas

```sql
-- Familia/tutor elige variante para un alumno
elegir_variante(p_oferta uuid, p_alumno uuid, p_item_ref text, p_variante_index int)
  → valida: necesidad en 'elegir_variantes', oferta es la ganadora, caller
    es tutor del alumno, alumno está inscripto, variante existe.
  → upsert en elecciones_variante con snapshot.

-- Listado para la pyme: planilla de pedido
necesidad_pedido_final(p_necesidad uuid)
  → returns table (alumno_id, alumno_nombre, tutor_nombre, item_ref,
                    variante_nombre, cantidad, precio_unitario_centavos,
                    subtotal_centavos)
  → solo accesible para la pyme ganadora y admins del grupo.

-- Listado para una familia: sus elecciones
mis_elecciones_necesidad(p_necesidad uuid)
  → returns table (alumno_id, alumno_nombre, item_ref, variante_index,
                    variante_nombre, precio_unitario_centavos)
  → solo accesible para tutores del alumno.
```

### 4.4 Cambios sobre `ofertas`

- Agregar `requiere_eleccion_variantes boolean` calculado: `true` cuando la oferta tiene >1 variante con el mismo `item_ref` para al menos un slot. Se puede dejar como derived column / función.

### 4.5 Cambios sobre `necesidades`

- Estado nuevo: `elegir_variantes` (extender el enum).
- Posible columna `fecha_limite_eleccion_variantes timestamptz` — definir si se calcula automático (X horas post-adjudicación) o se setea explícito.

---

## 5. UI por etapa

### 5.1 Pyme — alta de oferta (✅ ya implementado)

Lo que ya está en `pablo`:
- `VariantesEditor` permite cargar múltiples variantes por item.
- "Items del pedido — cotizá cada uno" facilita el flujo: la pyme tipea +Cotizar para cada item y agrega N alternativas.
- El subtotal toma el techo (más cara) cuando hay alternativas en el mismo slot.
- Badge visible: *"variantes con mismo item se toman como alternativas: solo cuenta la más cara para el techo. La familia elige cuál al adjudicar."*

### 5.2 Familia — votación (✅ ya implementado, sin cambios)

Sigue siendo a **nivel oferta completa**. La familia ve la `VariantesGallery` con todas las opciones agrupadas por item y agrupadas por *"(elegí una)"* visualmente, pero **no elige todavía** — sólo está informada.

### 5.3 Familia — elección de variantes (🆕 a implementar)

Cuando la necesidad pasa a `elegir_variantes`:
- Notificación / banner en `NecesidadDetail`: *"Tu pyme ya está elegida. Elegí qué variante querés para Mateo."*
- Por cada alumno del tutor inscripto + por cada item con alternativas → se muestra un selector visual:
  ```
  ITEM: Lápiz negro
  Para Mateo:
    [○] Faber-Castell HB    $500   [foto]
    [●] Maped Black'Peps    $400   [foto]   ← elegido
    [○] Bic Evolution       $350
  ```
- Total a pagar se actualiza en vivo: `Σ (precio elegida × cantidad item) + comisión + envío proporcional`.

### 5.4 Familia — pago (🆕 a actualizar)

- El monto que paga cada familia ya **no se calcula como `precio_total / inscriptos`**, sino como la suma de sus elecciones.
- `mp_create_preference` necesita refactor: en vez de `precio_total / N`, calcula `monto_familia = Σ precio_centavos_unitario × cantidad para cada item elegido por la familia + comisión 5%`.
- El total recaudado por la pyme termina siendo: `Σ todas las elecciones × precio elegido = precio efectivo`. Puede ser **menor** que el techo cargado en `precio_total_centavos`.
- Comisión MaPaPis se calcula sobre el efectivo, no el techo.

### 5.5 Pyme — vista post-adjudicación (🆕 a implementar)

Pantalla **Planilla del pedido** (`/grupos/:id/necesidades/:id/planilla` o similar):

```
PEDIDO ADJUDICADO
Sala Naranja Jardín La Plaza
Fecha de entrega: 30/04/26 11:00 a. m.

PROGRESO DE ELECCIÓN: 14 de 18 familias eligieron
[barra de progreso]

PEDIDO POR FAMILIA (lo que tenés que entregarle a cada una):
┌──────────────────────────────────────────────────────┐
│ Pérez · Mateo                                        │
│   1× Lápiz Negro Faber-Castell HB · $500             │
│   Total: $500                                        │
├──────────────────────────────────────────────────────┤
│ López · Sofía                                        │
│   1× Lápiz Negro Maped Black'Peps · $400             │
│   Total: $400                                        │
├──────────────────────────────────────────────────────┤
│ Gómez · Lucas + Mia (2 alumnos)                      │
│   2× Lápiz Negro Bic Evolution · $350                │
│   Total: $700                                        │
├──────────────────────────────────────────────────────┤
│ ⏳ Pendientes de elegir: 4 familias                  │
│   Default: Bic Evolution (más barata) si no eligen   │
└──────────────────────────────────────────────────────┘

RESUMEN PARA PRODUCCIÓN (consolidado):
  • Faber-Castell HB:    7 unidades
  • Maped Black'Peps:    6 unidades
  • Bic Evolution:       5 unidades (incluyendo defaults)
  TOTAL                 18 unidades

INGRESO TOTAL ESTIMADO (neto post-comisión):
  $7.600 (≈ $8.000 bruto − 5% MaPaPis)
```

Esta vista debería ser:
- **Imprimible / exportable a PDF o CSV** para llevar al taller físico.
- **Live**: si una familia cambia su elección antes del cierre, la planilla refleja el cambio.
- **Filterable**: ver solo pendientes, o solo una variante específica.

---

## 6. Edge cases

| Caso | Manejo propuesto |
|---|---|
| **Familia no elige antes del deadline** | Default = variante más barata (decisión producto). Avisar por mail/notif: "te asignamos automáticamente la opción X". Configurable: ¿más cara, más barata, primera, decisión del admin del grupo? |
| **Familia con 2 hijos: ¿elige una vez para los dos o por separado?** | Por alumno. Cada uno puede elegir distinto. La UI muestra un selector por alumno. |
| **Familia cambia de elección antes del deadline** | Permitido. El snapshot se actualiza, el pago aún no se cobró (estamos en `elegir_variantes`, antes de `en_produccion`). |
| **Pyme retira la oferta post-adjudicación** | Estado vuelve a `recibiendo_ofertas` o se cancela. Las elecciones se descartan. Edge raro pero posible. |
| **Una alternativa se queda sin stock** | La pyme debería poder marcar una variante como "agotada" durante `elegir_variantes`. Las familias que ya la eligieron necesitan re-elegir. |
| **Pago parcial (algunas familias pagan, otras no)** | Igual que en el flow actual de pagos. El estado de pago es por familia. |
| **Reembolso si la pyme entrega mal** | Reusa el flow de disputas estándar (otro spec). |

---

## 7. Comisión MaPaPis bajo este flujo

Como cada familia paga distinto, la comisión también:
- Cada `mp_create_preference` por familia: `monto = Σ elecciones × precio + 5%`.
- MaPaPis retiene su 5% de cada cobro vía marketplace_fee (cuando esté implementado el escrow on-platform) o lo separa al liberar.
- El **ingreso bruto total de la pyme** = `Σ familias_pagando` (no es el `precio_total_centavos` techo).
- El **ingreso neto post-comisión** = bruto × 0.95.

---

## 8. Consideraciones de UX

- **El precio que la familia ve durante votación** ahora es ambiguo: ¿el techo? ¿el promedio? ¿el más barato?
  - Recomendación: mostrar **rango** ("Hasta $500 / alumno · desde $350"), con sub-texto: "depende de qué variante elijas después".
  - Esto evita que la familia se sienta engañada cuando vea un precio en votación y otro en checkout.
- **El total grupo "≈ $X"** que ve la familia hoy sigue siendo orientativo basado en el techo. Aclarar que el final puede ser menor.
- **La "pyme ganadora"** debe estar dispuesta a ofrecer cualquier alternativa al precio cargado. Si carga 3 marcas pero solo tiene stock de una, se mete en lío.

---

## 9. Decisiones pendientes (producto)

1. **Default si la familia no elige** antes del deadline: ¿más barata? ¿primera cargada? ¿decisión del admin del grupo? — recomendación: **más barata** (favor a la familia, presión sobre la pyme para sobre-stockearse de la cara).
2. **Deadline para elegir variantes**: ¿X horas post-adjudicación? ¿hasta `fecha_limite_entrega - 1 día`? ¿lo decide el admin del grupo?
3. **¿Las familias ven las elecciones de las otras?** Recomendación: **no** — cada uno ve lo suyo. El admin del grupo SÍ ve todo.
4. **¿La pyme puede ver elecciones pendientes con nombre de familia, o todo anonimizado hasta el cierre?** Recomendación: la pyme ve **alumno + tutor** post-adjudicación (necesario para entregar). El "anonimizado" del marketplace deja de aplicar una vez que ya hubo trato cerrado.
5. **¿Modalidad grupal aplica?** Si es grupal (no individual), no hay "una variante por alumno". O todo el grupo se decide por una variante única (vía votación interna), o no aplica el flow. Recomendación: **flow solo para modalidad individual**. Para grupal, una variante única (el grupo decide previamente o el organizador define).

---

## 10. Implementación: estado actual

### ✅ Hecho (en rama `pablo`)
- Modelo de oferta con array de variantes (`OfertaVariante[]`).
- `item_ref` en cada variante para asociarla a un slot de la composición.
- Editor visual de variantes con foto, descripción, link.
- Atajo "+ Cotizar" desde la composición.
- Cálculo de techo correcto (alternativas no se suman).
- Display agrupado por item con tag "Para: X" + nota "(elegí una)".

### ⏳ Pendiente
- [ ] Tabla `elecciones_variante` + RPCs (`elegir_variante`, `necesidad_pedido_final`, `mis_elecciones_necesidad`).
- [ ] Estado nuevo `elegir_variantes` en el enum + transición desde `adjudicada`.
- [ ] UI familia: pantalla de elección post-adjudicación.
- [ ] Refactor de `mp_create_preference`: monto por familia = Σ elecciones × precio + 5%.
- [ ] UI pyme: planilla del pedido con desglose por familia + resumen por variante.
- [ ] Manejo de defaults para familias que no eligen a tiempo.
- [ ] Notificaciones (mail / push) en transición a `elegir_variantes`.
- [ ] Edge case: variante sin stock post-elección.

### 🤔 Decisiones de producto antes de codear
Ver §9.
