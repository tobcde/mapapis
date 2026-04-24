# Especificación técnica — Validación de pymes + Sistema de ratings

> Spec para el módulo de marketplace de MaPaPis. Cubre: alta y verificación de pymes, sistema de reviews multi-dimensional, anti-gaming, y reglas de visibilidad.
> Asume backend Firebase (Auth + Firestore) y que el flujo de pago va por Mercado Pago intermediado por la plataforma.

---

## 1. Validación de pymes

### 1.1 Niveles de verificación (tiers)

La pyme avanza por niveles. Cada nivel desbloquea capacidades. Visible al grupo como badge.

| Tier | Requisito | Capacidades |
|------|-----------|-------------|
| **0 — Registrada** | Email + Google verificado | Crea perfil, NO puede ofertar todavía |
| **1 — Verificada** | CUIT validado + Constancia AFIP + DNI responsable + selfie con DNI | Puede ofertar hasta $X por adjudicación |
| **2 — Confiable** | Tier 1 + 5 transacciones cumplidas con rating ≥ 4.0 | Sin tope de monto, badge visible |
| **3 — Premium** | Tier 2 + 20 transacciones + rating ≥ 4.5 + sin disputas en 90 días | Aparece priorizada en feed, badge dorado |

**Degradación**: caer debajo del threshold de rating o acumular disputas baja de tier automáticamente. La pérdida de tier es inmediata; la recuperación requiere re-acumular.

### 1.2 Validaciones técnicas en alta (Tier 1)

1. **CUIT contra AFIP**
   - Endpoint público de AFIP (`https://soa.afip.gob.ar/sr-padron/v2/persona/{cuit}`) o servicio similar.
   - Verifica: existe, activo, razón social, condición frente a IVA.
   - Cachear respuesta 30 días; revalidar en background.
2. **DNI del responsable**
   - Captura de frente + dorso + selfie sosteniendo DNI.
   - Validación OCR + comparación facial. Opciones: Renaper API (oficial AR, requiere convenio) o servicio third-party (Truora, Veriff, Persona) — más rápido para arrancar, costo ~$0.50-1.50 por verificación.
   - Si no hay budget para third-party al inicio: **revisión manual** del equipo MaPaPis (queue interna). Slower pero gratis.
3. **Datos bancarios para cobro**
   - CBU/Alias de la cuenta donde la pyme recibe pagos.
   - Validación: el nombre del titular debe coincidir con el CUIT (vía AFIP padrón).
4. **Email + teléfono verificados**
   - Email: link de confirmación.
   - Teléfono: OTP por SMS (Firebase Phone Auth — costo ~$0.01 por verificación).

### 1.3 Anti-fraude en alta

- **Rate limit**: máximo 1 alta de pyme por IP por día.
- **Device fingerprint**: bloqueo de altas múltiples desde mismo dispositivo.
- **Blacklist de CUITs**: pyme suspendida no puede re-registrarse con mismo CUIT ni con CUIT de socio cruzado.
- **Detección de duplicados**: si un CUIT ya existe activo, rechazar. Si está suspendido, mostrar mensaje genérico (no revelar el motivo de suspensión).

### 1.4 Modelo de datos (Firestore)

```
/pymes/{pymeId}
  cuit: string                    // PK lógico, único
  razonSocial: string
  nombreFantasia: string
  responsable: {
    nombre: string
    dni: string
    email: string                 // verificado
    telefono: string              // verificado
  }
  bancario: {
    cbu: string
    alias: string
    titular: string
  }
  tier: 0 | 1 | 2 | 3
  estado: "pendiente" | "activa" | "suspendida" | "rechazada"
  zonas: string[]                 // barrios/zonas donde opera
  categorias: string[]            // qué tipo de necesidades cubre
  ratingAgregado: {               // denormalizado, recalculado por Cloud Function
    promedio: number              // 0-5
    total: number
    distribucion: { 1: n, 2: n, 3: n, 4: n, 5: n }
    porDimension: {
      calidad: number
      puntualidad: number
      comunicacion: number
      precio: number
    }
    ultimaActualizacion: timestamp
  }
  transaccionesCumplidas: number
  disputasAbiertas: number
  disputasResueltas: number
  createdAt: timestamp
  verifiedAt: timestamp | null
  suspendedAt: timestamp | null
  suspensionMotivo: string | null

/pymes/{pymeId}/verificaciones/{verifId}
  tipo: "afip" | "renaper" | "manual"
  resultado: "ok" | "rechazada"
  payload: object                 // respuesta cruda guardada (audit)
  revisorId: string | null        // si fue manual
  createdAt: timestamp
```

---

## 2. Sistema de ratings

### 2.1 Principios

1. **Solo ratings verificados.** Únicamente familias que participaron y pagaron de una transacción adjudicada pueden ratear esa transacción. Sin excepciones.
2. **Una review por familia por transacción.** Editable durante 7 días, después congelada.
3. **Multi-dimensional.** No hay "una estrella" — hay 4 dimensiones independientes.
4. **Transparencia con privacidad.** Reviews son públicas para otras familias y pymes. La identidad del autor está anonimizada (alias o "Familia del grupo X" sin revelar grupo específico fuera del propio grupo).
5. **Anti-gaming por diseño.** No hay forma de "comprar" ratings: la pyme no puede pedirlos a familias random, solo familias-de-transacción tienen el botón habilitado.

### 2.2 Dimensiones

Cada review tiene 4 ratings 1-5 + texto opcional:

| Dimensión | Pregunta al usuario |
|-----------|---------------------|
| **Calidad** | ¿El producto/servicio fue como lo esperabas? |
| **Puntualidad** | ¿Cumplió con los tiempos prometidos? |
| **Comunicación** | ¿Fue claro y respondió rápido? |
| **Precio justo** | ¿La relación calidad/precio fue buena? |

El **score agregado** que se muestra es el promedio ponderado: `0.35*calidad + 0.30*puntualidad + 0.20*comunicacion + 0.15*precio`.

Razón: la calidad importa más que el precio (los grupos vienen acá por confianza, no por barato). Tweakeable después con data real.

### 2.3 Anti-gaming y robustez

- **Mínimo de muestras**: el rating agregado se muestra solo a partir de 3 reviews. Antes: badge "Pyme nueva".
- **Decay temporal**: las reviews pesan más fresh. Implementación: `peso = exp(-edad_dias / 365)`. Una review de hace 3 años vale ~1/8 de una de hoy. Esto premia mejorar.
- **Outlier detection**: si una pyme recibe en 24h N reviews 5★ desde IPs/devices similares → flag automático para revisión manual, no se cuentan hasta validar.
- **Rate limit por familia**: una familia no puede ratear a la misma pyme más de 1 vez cada 30 días (para evitar venganzas seriadas si la pyme la hace mal en múltiples transacciones rapidito).
- **Reviews ancladas**: la pyme NO puede borrar reviews. Solo puede **responder** una vez por review (también pública). La respuesta es un canal de defensa público, no un botón de eliminar.
- **Review de la pyme a la familia**: simétrico. La pyme también ratea a la familia (cumplió pago a tiempo, comunicación). Esto baja el incentivo a ratings vengativos: si te portás mal vas a tener mal score como familia y eso lo ven futuras pymes al ofertar.
- **Disputa formal**: si una review es claramente injusta (insulto, mentira), la pyme abre una disputa. Equipo MaPaPis revisa, puede ocultar la review (pero queda en logs).
- **Visibilidad de disputas activas**: si una pyme tiene disputa abierta, badge "En revisión" visible.

### 2.4 Modelo de datos

```
/transacciones/{txId}
  necesidadId: string
  grupoId: string
  pymeId: string
  estado: "adjudicada" | "en_curso" | "cumplida" | "disputada" | "cancelada"
  monto: number
  comisionPlataforma: number
  familiasParticipantes: string[] // familyIds que pagaron
  cumplidaAt: timestamp | null
  reviewWindowExpira: timestamp | null  // cumplidaAt + 30 dias

/transacciones/{txId}/reviews/{familyId}
  // PK = familyId, garantiza una review por familia por tx
  ratings: {
    calidad: 1-5
    puntualidad: 1-5
    comunicacion: 1-5
    precio: 1-5
  }
  texto: string | null            // max 500 chars
  scoreAgregado: number           // calculado server-side al guardar
  createdAt: timestamp
  editableHasta: timestamp        // createdAt + 7 dias
  estado: "publicada" | "oculta_por_disputa"
  respuestaPyme: {
    texto: string
    createdAt: timestamp
  } | null

/transacciones/{txId}/reviewPymeAFamilia/{familyId}
  ratings: { pago_a_tiempo: 1-5, comunicacion: 1-5 }
  texto: string | null
  createdAt: timestamp

/disputas/{disputaId}
  txId: string
  reviewId: string | null         // si la disputa es sobre review
  abiertaPor: "pyme" | "familia"
  motivo: string
  estado: "abierta" | "resuelta_a_favor_pyme" | "resuelta_a_favor_familia" | "rechazada"
  resolucion: string | null
  createdAt: timestamp
  resueltaAt: timestamp | null
```

### 2.5 Cloud Functions necesarias

1. **`onReviewWrite`**: cada vez que se escribe/edita una review, recalcula el agregado de la pyme y actualiza `pymes/{id}/ratingAgregado`. Incluye decay temporal y filtro de reviews ocultas.
2. **`onTransaccionCumplida`**: al marcarse una transacción como cumplida, abre la review window para las familias participantes y manda push.
3. **`expireReviewEditWindow`**: scheduled, cada hora, congela reviews que pasaron los 7 días editables.
4. **`detectReviewOutliers`**: scheduled, cada 6h, busca patrones sospechosos (burst de 5★, IPs duplicadas, devices repetidos) y flagea para revisión.
5. **`updateTier`**: trigger sobre cambios en `ratingAgregado` o `transaccionesCumplidas`, recalcula tier de la pyme.

---

## 3. Visibilidad y privacidad

### 3.1 Qué ve la pyme de una necesidad

- Categoría (compra/servicio/etc).
- Zona (barrio amplio, ej: "Belgrano", no "Av. Cabildo 2300").
- Rango de familias participantes (ej: "15-30 familias", no "22 familias").
- Fecha límite.
- Descripción de la necesidad (sanitizada — sin nombres del jardín/colegio).
- Presupuesto orientativo.

### 3.2 Qué NO ve la pyme

- Nombre del grupo, jardín, colegio, sala.
- Cantidad exacta de familias.
- Identidad de las familias.
- Dirección exacta.
- Otras ofertas presentadas (sealed bid).

### 3.3 Sanitización de descripción

Cuando una familia/delegado escribe la descripción de la necesidad, un filtro server-side (Cloud Function) detecta y bloquea:
- Nombres propios de instituciones educativas (regex contra base de jardines/colegios).
- Direcciones específicas (regex de calles + número).
- Teléfonos / emails / handles de redes.

Si detecta algo, muestra warning antes de publicar y obliga a editar.

### 3.4 Comunicación pyme↔grupo

- **Pre-adjudicación**: chat in-app únicamente. Sin compartir contactos.
- **Post-adjudicación**: se desbloquean datos de contacto necesarios para coordinar la entrega.
- Cada mensaje del chat pasa por sanitización (no enviar números de teléfono ni links externos hasta que esté adjudicada).

---

## 4. Riesgos y mitigaciones pendientes

| Riesgo | Mitigación |
|--------|------------|
| Pymes amigas inflando rating de una pyme con cuentas truchas | Anti-fraude en alta de familias también (validar grupo de pertenencia con delegado). Outlier detection. |
| Familias coordinando reviews 1★ por enojo | Rate limit por familia + decay + posibilidad de respuesta pública de pyme + disputa. |
| Re-identificación de grupos por contexto | Sanitización + rangos en lugar de números exactos + revisión periódica de qué leak hay. |
| Pyme consigue identificar grupo y propone arreglo off-platform | Penalización fuerte: suspensión permanente si se denuncia y se prueba. Cláusula en TOS. La familia que acepta también sale del sistema. |
| Comisión muy alta espanta pymes | Empezar con fee fijo bajo, ajustar con data. Ver [decisión pendiente de Pablo]. |

---

## 5. Decisiones pendientes (no especificadas aún)

- [ ] Modelo de comisión: % sobre transacción / fee fijo por adjudicación / suscripción mensual. (Mi recomendación previa: fee fijo para arrancar.)
- [ ] Threshold exactos de tiers (montos, cantidad de tx, ratings mínimos).
- [ ] Política de privacidad y TOS — necesarios antes de salir a producción con datos reales (especialmente DNI/CUIT).
- [ ] Decidir si se usa servicio third-party para verificación de identidad o revisión manual al inicio.
- [ ] Threshold de outlier detection (cuántas reviews 5★ en cuánto tiempo dispara flag).

---

## 6. Roadmap de implementación sugerido

1. **Fase 1 — Auth y roles** (1 semana): Firebase Auth con Google + email-link. Roles `familia` / `pyme` / `admin`. Reglas de Firestore base.
2. **Fase 2 — Alta de pyme con validación CUIT** (1 semana): formulario, integración AFIP, queue de revisión manual.
3. **Fase 3 — Necesidades y ofertas** (2 semanas): CRUD necesidades, sanitización, feed para pymes con anonimización, sealed bid, votación del grupo.
4. **Fase 4 — Pagos con MP + comisión** (2 semanas): integración Mercado Pago (split o fee fijo según decisión), retención de comisión.
5. **Fase 5 — Sistema de reviews** (1 semana): creación post-cumplida, agregados, decay, respuesta de pyme.
6. **Fase 6 — Anti-fraude y disputas** (1 semana): outlier detection, queue de disputas, panel admin.
7. **Fase 7 — Validación de identidad nivel 2** (depende): integración Renaper o third-party.
