# MaPaPis — Onboarding del proyecto

> **Lectura estimada**: 10 min. Este documento es el punto de entrada para cualquier colaborador. Después leés los specs específicos según tu área.

---

## 1. Qué es MaPaPis (en una línea)

**Marketplace donde grupos de padres / instituciones educativas postean necesidades, las pymes ofertan, y el grupo vota la ganadora.** La plataforma cobra comisión sobre cada operación cerrada. Toda la plata pasa por escrow (MP Marketplace API) y se libera cuando el grupo confirma entrega correcta.

**El moat**: nadie está haciendo exactamente esto en Argentina ni en el mundo (combinación de demanda colectiva + reverse auction + escrow + 3 actores + anti-bypass fuerte).

---

## 2. Por qué existe

Hoy, coordinar compras grupales en colegios/jardines es un infierno:
- Una mamá se ofrece a juntar la plata por WhatsApp
- Pide 3 cotizaciones a sus contactos personales
- Las familias mandan transferencias a su CBU
- Si algo sale mal: discusión en el grupo, sin garantías
- La pyme/proveedor cobra rápido pero sin compromiso de calidad

MaPaPis convierte ese caos en un proceso confiable: necesidad pública → ofertas competitivas → votación → pago en escrow → entrega → liberación. Todos ganan: las familias pagan menos por volumen, las pymes acceden a clientes recurrentes con pagos garantizados, y la plataforma se queda con un fee.

---

## 3. Los 3 actores

| Actor | Qué hace | Ejemplo |
|---|---|---|
| **Familia** | Forma parte de un grupo (sala/aula). Postea necesidades, paga su cuota, vota oferta ganadora, confirma entrega. | "Necesitamos guardapolvos para los 25 chicos" |
| **Institución** | Colegio / jardín. También postea necesidades (las puede pagar el colegio, las familias, o mixto). Tiene presupuestos asignables. | "25 mapas políticos A3 plastificados, lo paga la sala" |
| **Pyme** | Proveedor validado. Ve necesidades anonimizadas (solo zona), oferta, entrega, recibe pago de escrow tras confirmación. | Imprenta, catering, librería, etc. |

> **Nota**: la pyme **nunca** ve el ID del grupo ni datos de las familias hasta que su oferta gana. Esto es por diseño anti-bypass.

---

## 4. Cómo gana plata la plataforma

4 capas de revenue ordenadas por madurez:

1. **Comisión por transacción** (core, día 1) — 8-15% según categoría, vía `application_fee` de MP.
2. **Bid credits** (Upwork model, mes ~3) — la pyme paga fichas para presentar oferta.
3. **Subscripciones pyme** (mes ~6) — Free / Pro / Premium / Top con beneficios (créditos free, badge, alerts priority, boost incluido).
4. **Revenue secundario** (mes 12+) — Boost slots, lead alerts premium, SaaS instituciones, float sobre escrow.

**Detalle completo + unit economics**: [spec-pagos-escrow.md](docs/spec-pagos-escrow.md), sección 6 + sección 14.

---

## 5. Por qué este modelo se defiende

> **Regla de oro**: si la transacción no pasa por la app, la pyme pierde escrow + bid credits + rating. La asimetría hace que valga la pena cumplir las reglas.

**Anti-bypass técnico** (Slice 5):
- Sanitizer regex sobre mensajes (tapa números/mails/links)
- OCR sobre imágenes (mismo)
- Detección de patrones (transacción "completada" sin confirmaciones del grupo)
- Penalty cascade: 3 strikes = suspensión 30 días

**Anti-bypass económico**:
- Sin escrow no hay pago garantizado para la pyme
- El rating + Job Success Score solo funciona dentro de la app
- Las familias no se animan a transferir a CBU desconocido

---

## 6. Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| **Frontend** | React 18 UMD + Tailwind CDN + Babel standalone — todo en un solo `index.html` | Sin build step. Cambio = commit + push. PWA installable. |
| **Hosting** | GitHub Pages (subfolder `github-pages/mapapis/`) vía GitHub Actions | Gratis, autodeploy en cada push a `main`. URL prod: https://tobcde.github.io/mapapis/ |
| **Backend** | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | RLS multi-tenant, gratis hasta cierta escala, sin servidor propio |
| **Pagos** | Mercado Pago Marketplace API (split + escrow + webhooks) | Estándar AR, custodia regulada por MP no por nosotros |
| **Tipografía** | Geist (display + UI) | Moderna, geométrica, sin "vibe HTML clásico" |
| **Identidad visual** | Paleta ink/cream/coral/sun/sage/violet + aurora gradient bg + botones con elevación moderna | Identidad propia, no template |

**Por qué Supabase y no Firebase**: necesitamos joins complejos (necesidades ↔ ofertas ↔ grupos ↔ familias) y RLS multi-rol. Postgres lo hace nativo.

---

## 7. Estructura del repo

```
MaPaPis/
├── PROYECTO.md                  ← este archivo
├── README.md                    ← intro corta
├── deploy.py                    ← script auxiliar de deploy
├── .github/workflows/
│   └── deploy-pages.yml         ← GitHub Action que publica a Pages
├── github-pages/mapapis/
│   ├── index.html               ← TODA la app (React UMD + Babel + Tailwind CDN)
│   ├── manifest.json            ← PWA manifest
│   ├── sw.js                    ← service worker
│   └── icons/
├── db/                          ← migrations SQL (orden numerado)
│   ├── 001_slice1_profiles.sql       (auth + rol)
│   ├── 002_grants_profiles.sql       (grants explícitos)
│   └── 003_marketplace.sql           (grupos, necesidades, ofertas, RLS, cap 5)
└── docs/                        ← specs (fuentes de verdad por dominio)
    ├── spec-arquitectura-supabase.md (schema completo + RLS pattern)
    ├── spec-pymes-ratings.md         (4 tiers validación + ratings multi-dim)
    ├── spec-instituciones.md         (módulo institucional + partidas)
    └── spec-pagos-escrow.md          (MP Marketplace + state machine + disputas)
```

---

## 8. Estado actual del proyecto

### ✅ Hecho (Slices 1, 2, 3.1)
- Auth con Magic Link / Google → tabla `profiles` con rol persistido
- UI completa marketplace: login, onboarding rol, feed según rol, detalle, publicar, perfil
- Identidad visual moderna (Geist, aurora bg, elevación moderna en botones)
- Tablas marketplace en Postgres con RLS estricta:
  - `grupos`, `grupo_miembros`
  - `categorias` (6 con campos estructurados JSONB)
  - `necesidades`, `ofertas`, `votos_oferta`
  - View `necesidades_publicas` anonimizada para pymes
  - Cap de 5 ofertas por necesidad (Thumbtack rule) vía trigger
- Specs completos para todos los dominios (ver `docs/`)

### 🔜 Próximo (Slice 3.2 - 3.5)
- Reemplazar mock data del frontend por queries reales a Supabase
- Form estructurado por categoría al publicar (campos obligatorios JSONB)
- Job Success Score simple visible en oferta
- Tabla `pymes` con datos del negocio + onboarding pyme
- Tabla `pyme_verificaciones` con flow de subida de docs

### ⏳ Después (Slice 4-7)
- **Slice 4**: Integración MP Marketplace API (escrow + split + webhooks + state machine)
- **Slice 5**: Disputas + reviews + reembolso parcial + anti-bypass técnico
- **Slice 6**: Group activation Pinduoduo + alerts push + boost slots + validación AFIP
- **Slice 7**: SaaS instituciones (partidas presupuestarias)

---

## 9. Cómo levantar el proyecto en local

### Frontend (5 segundos)
```bash
cd github-pages/mapapis
python -m http.server 8090
# → abrí http://localhost:8090
```

No hay `npm install`, no hay build, no hay node_modules. Cambiás `index.html` y hacés F5.

### Supabase (online, no necesitás levantar nada)
- URL del proyecto: `https://adpbjslkswtnqklzejuy.supabase.co`
- Acceso: pedí invite a Tobías para entrar al panel
- Para correr migrations: SQL Editor → New query → pegar `db/00X_*.sql` → Run
- **Orden importa**: corré 001, después 002, después 003.

### Deploy a producción
- Cualquier push a `main` que toque `github-pages/mapapis/**` dispara el workflow `deploy-pages.yml`.
- En ~30s queda en https://tobcde.github.io/mapapis/.

---

## 10. Convenciones del repo

- **Nada de mocks en archivos finales** — los datos mock están solo en `index.html` mientras avanzamos a queries reales.
- **Migrations numeradas** (`001_*.sql`, `002_*.sql`) — nunca editar una corrida; siempre crear la siguiente.
- **RLS en TODAS las tablas** — sin excepción. Todo write necesita `with check`. Todo read necesita `using`.
- **UUIDs como PK** siempre (`gen_random_uuid()`).
- **No exponer datos personales a pymes** — usar views anonimizadas tipo `necesidades_publicas`.
- **Edge Functions corren con `service_role`** — única vía para mover dinero / bypass RLS.
- **Commits en español, descriptivos**, prefijos: `feat()`, `fix()`, `docs()`, `refactor()`.

---

## 11. Decisiones cerradas (no re-discutir)

1. **Comunicación queda IN-APP**. Cualquier intento de bypass se castiga.
2. **Supabase, no Firebase** (joins + RLS).
3. **MP Marketplace API, no escrow custom** (regulación CNV/BCRA).
4. **PWA, no app nativa por ahora** (un solo deploy, instalable, gratis).
5. **3 actores**: familia + institución + pyme. No agregamos más roles sin spec aparte.
6. **Confirmación grupal por umbral** (≥70% OK), no por unanimidad.
7. **Reembolso parcial es nativo**, no excepción.

---

## 12. Decisiones pendientes (necesitan input)

1. ¿Qué % exacto de comisión por categoría? (rango 8-15%, definir por categoría)
2. ¿Pyme absorbe 100% de la fee de MP o se traslada parcial al precio? (recomendamos 3% pyme + 1% precio)
3. ¿Cuándo activamos bid credits? (probablemente mes 3-4 cuando haya volumen)
4. ¿Qué timeout de confirmación para cada categoría? (default 48hs productos, 7 días indumentaria, post-evento catering)
5. ¿Cuál es el primer colegio piloto? (clave para validar hyper-niche antes de abrir)

---

## 13. Competencia y diferenciación

**Modelos parecidos** (en otros verticales):
- **Thumbtack / Bark / Iguanafix** — reverse auction de servicios profesionales
- **Habitissimo** — reverse auction de reformas (lead-based)
- **Upwork / Workana** — reverse auction de freelance + escrow + comisión
- **Pinduoduo** — group buying con descuento por volumen
- **Alibaba RFQ** — B2B procurement

**Lo que ninguna tiene** (nuestro moat):
1. **Demanda colectiva por grupo** (no es un usuario, son N familias decidiendo por votación)
2. **3 actores con flujos de pago distintos** (familia / institución / mixto)
3. **Vertical hiper-específico**: educación / niños / instituciones
4. **Anti-bypass económico fuerte** desde día 1 (no es solo T&C)

---

## 14. Métricas clave para trackear

| Métrica | Objetivo (mes 12) |
|---|---|
| Tx cerradas / mes | 200+ |
| GMV / mes (ARS) | $20M+ |
| Take rate efectivo | ≥ 8% |
| Tiempo: necesidad publicada → ofertas completas | < 24hs |
| Tiempo: entrega → release | < 72hs |
| Tasa de disputas | < 5% |
| Bypass detectados / castigados | precision > 80% |

---

## 15. FAQ rápido

**¿Qué pasa si una familia no paga su cuota?**
La transacción se cancela tras N reintentos. La necesidad vuelve a `recibiendo_ofertas`. La pyme ganadora pierde su slot pero recupera su bid credit. Se penaliza a la familia con strike.

**¿Qué pasa si la pyme no entrega?**
El escrow se reembolsa total a las familias. Strike a la pyme + suspensión.

**¿Qué pasa si hay desacuerdo (algunos confirman OK, otros no)?**
- ≥70% OK → libera automático
- >30% problema con evidencia → disputa abierta, mediación humana
- Caso intermedio → disputa abierta automáticamente

**¿La plataforma puede ver los chats?**
Sí, para auditoría de disputas y para que el sanitizer / OCR funcionen. Esto va en términos y condiciones explícito. La privacidad NO incluye comunicación con la contraparte (porque es la base del anti-bypass).

**¿Por qué un solo `index.html` y no un proyecto Next.js?**
Velocidad de iteración. Mientras estamos en prototipo / validación, sin build step ahorra mucho tiempo. Cuando crezcamos, migramos a Next/Vite.

---

## 16. Contactos y accesos

- **Repo**: https://github.com/tobcde/mapapis
- **Prod**: https://tobcde.github.io/mapapis/
- **Supabase project**: `adpbjslkswtnqklzejuy` (pedir invite a Tobías)
- **Mercado Pago**: por configurar — ver Slice 4 en `docs/spec-pagos-escrow.md` sección 12 (Prerequisites)

---

## 17. Por dónde empezar a leer (según tu rol)

| Si sos... | Leé en este orden |
|---|---|
| **Product/Negocio** | PROYECTO.md (este) → spec-pagos-escrow.md sección 1-7 → spec-pymes-ratings.md |
| **Backend / DB** | spec-arquitectura-supabase.md → db/001-003 → spec-pagos-escrow.md sección 4-11 |
| **Frontend** | index.html (lectura completa, 1000 líneas) → spec-arquitectura-supabase.md sección 1-4 |
| **Seguridad / Compliance** | spec-arquitectura-supabase.md sección 11 (Hardening) → spec-pagos-escrow.md sección 9-11 |

---

> **Última actualización**: 2026-04-24
> **Mantenedor**: Tobías
> **Co-authored**: Claude Opus 4.7
