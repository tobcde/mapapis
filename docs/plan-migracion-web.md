# Plan de migración: `index.html` → `web/`

> Objetivo: llevar la app de un prototipo en un único archivo HTML a una app React/TypeScript production-ready, sin perder ninguna feature existente.

---

## Estado actual

| | `index.html` | `web/` |
|---|---|---|
| Líneas de código | ~4.900 | ~1.500 |
| TypeScript | ❌ | ✅ |
| Tests | ❌ | ✅ Vitest configurado |
| React Query | ❌ | ✅ |
| Rutas | Estado local | React Router v7 |
| Componentes reutilizables | ❌ | ✅ Fase 1 completa |
| Features completas | ✅ | ~20% |

---

## ✅ Fase 0 — Setup local (30 min) — COMPLETA

### 0.1 Completar `.env.local`
```
VITE_SUPABASE_ANON_KEY=   ← copiar de index.html línea 23
VITE_MP_PUBLIC_KEY=        ← desde dashboard de MercadoPago
VITE_BASE_PATH=/
```
> `.env.local` creado. Completar `VITE_SUPABASE_ANON_KEY` y `VITE_MP_PUBLIC_KEY`.

### 0.2 Instalar dependencias y correr
```bash
cd web
npm install
npm run dev     # → http://localhost:5173
```
> `vite-plugin-pwa@1.2.0` removido temporalmente — incompatible con Vite 8. Se agrega en Fase 5.

### 0.3 Verificar que anda
- [x] App corre en localhost:5173
- [x] `npx tsc` sin errores
- [ ] Login con magic link funciona
- [ ] Onboarding guarda rol
- [ ] Grupos lista y crea

---

## ✅ Fase 1 — Librería de componentes UI (½ día) — COMPLETA

Commit: `feat(ui): libreria de componentes — Button, Card, Dialog, Input, Badge, Skeleton`

### Archivos creados en `web/src/components/ui/`

| Archivo | Exports |
|---|---|
| `Button.tsx` | `<Button variant="primary/secondary/danger/ghost" size="sm/md/lg" loading fullWidth icon>` |
| `Card.tsx` | `<Card shadow="sm/md/lg/none" as="div/section/article">` |
| `Dialog.tsx` | `<DialogProvider>`, `useDialog()` → `showAlert()` / `showConfirm()` |
| `Input.tsx` | `<Input label error hint>`, `<Textarea label error hint>` |
| `Badge.tsx` | `<EstadoBadge estado>`, `<RolBadge rol>`, `<Badge label>` |
| `Skeleton.tsx` | `<Skeleton>`, `<SkeletonCard>`, `<SkeletonList count>` |
| `index.ts` | Barrel export de todo |

- `DialogProvider` conectado en `main.tsx`
- Animaciones `anim-in` y `dialog-in` agregadas a `index.css`
- `npx tsc` sin errores ✅

#### `BottomNav.tsx`
```tsx
// Pendiente — se implementa en Fase 2
// Tabs: Feed | Grupos | + (publicar, solo familia) | Perfil
// Para pyme: Feed | Mis ofertas | Perfil
```

---

## ✅ Fase 2 — Shell y navegación (½ día) — COMPLETA

### 2.1 Rediseñar `Shell.tsx`
- [x] Sacar header (más espacio en pantalla, como index.html)
- [x] `BottomNav` con SVG icons + botón `+` flotante coral para familia
- [x] Tabs distintos según rol: familia vs pyme
- [x] Fondo con gradientes radiales (ya en `index.css`, solo verificar que Shell no los tape)

### 2.2 Agregar rutas faltantes en `App.tsx`
```tsx
/feed                    // Feed familia o pyme según rol
/publicar                // Nueva necesidad (solo familia/admin)
/perfil                  // Perfil completo
/grupos/:id/miembros     // Admin de miembros
/grupos/:id/alumnos      // Gestión de alumnos
/pyme/onboarding         // Onboarding específico pyme
```

---

## ✅ Fase 3 — Queries y mutations faltantes (½ día) — COMPLETA

### Queries creadas en `web/src/lib/queries/`

| Archivo | Qué hace |
|---|---|
| `useFeedFamilia.ts` | `necesidades_publicas` view filtrada por zona/grupo |
| `useFeedPyme.ts` | Necesidades en estado `recibiendo_ofertas` en sus zonas |
| `useAlumnosByGrupo.ts` | Alumnos + tutores de un grupo |
| `useMiembros.ts` | Miembros de un grupo con roles |
| `useInscripciones.ts` | Inscripciones de un alumno a una necesidad |
| `useMisVotos.ts` | Votos del usuario en una necesidad |
| `usePymeProfile.ts` | Datos del perfil pyme (nombre comercial, descripción, zonas) |
| `useNecesidadProgreso.ts` | RPC `necesidad_progreso` — inscriptos, cierre, total alumnos |
| `useCategorias.ts` | Categorías activas para el selector de publicar necesidad |

### Mutations creadas en `web/src/lib/mutations/`

| Archivo | Qué hace |
|---|---|
| `usePublicarNecesidad.ts` | Crear necesidad con foto (bucket `necesidad-fotos`) y campos estructurados |
| `useVoteOferta.ts` | `vote_oferta` / `unvote_oferta` RPCs |
| `useAdjudicarOferta.ts` | `adjudicar_oferta` RPC |
| `useCerrarInscripcion.ts` | `cerrar_inscripcion` / `reabrir_inscripcion` |
| `useInscribirAlumno.ts` | `inscribir_alumno` / `desinscribir_alumno` |
| `useCrearOferta.ts` | `crear_oferta` RPC (para pymes) |
| `useActualizarPyme.ts` | `actualizar_pyme` RPC |
| `useAlumnoActions.ts` | crear alumno, merge, join/leave como tutor |
| `useGrupoAdmin.ts` | promote, demote, kick, leave, regenerar código |

---

## ✅ Fase 4 — Features (2-3 días) — COMPLETA

### ✅ 4.1 Feed familia (`/feed`)
- [x] Lista de necesidades del grupo activo (o todas si no hay grupo)
- [x] Filtros por categoría y estado
- [x] `NecesidadCard` con presupuesto, zona, rango, estado badge
- [x] Empty state con CTA a publicar o unirse a grupo

### ✅ 4.2 Feed pyme (`/feed` con rol pyme)
- [x] Necesidades en `recibiendo_ofertas` en sus zonas configuradas
- [x] Filtro por categoría
- [x] Botón "Ofertar" directo desde la card

### ✅ 4.3 Publicar necesidad (`/publicar`)
- [x] Form en una sola pantalla larga
- [x] Campos dinámicos según categoría (schema `CampoSchema` desde `campos_obligatorios`)
- [x] Upload de foto al bucket `necesidad-fotos`
- [x] Selector de grupo destino
- [x] Modalidad grupal/individual + fechas límite + link de referencia

### ✅ 4.4 Detalle de necesidad — completar

**Para familia/admin:**
- [x] Panel de inscripción individual (anotar hijos)
- [x] Votación de ofertas (por alumno)
- [x] Botón cerrar/reabrir inscripción (admin)
- [x] Chip de progreso (X/Y inscriptos)
- [x] Adjudicar oferta (admin)

**Para pyme:**
- [x] Form para presentar oferta
- [x] Ver oferta propia con estado

### ✅ 4.5 Gestión de grupo — completar `GrupoDetail`
- [x] `InviteCard` (código + botón copiar + WhatsApp + regenerar)
- [x] Navegación a `/grupos/:id/miembros` — ver, promover admin, expulsar
- [x] Navegación a `/grupos/:id/alumnos` — agregar, fusionar duplicados
- [x] Botón "Salir del grupo" (para no-creadores)
- [x] Estadísticas del grupo (alumnos, familias)

### ✅ 4.6 Perfil (`/perfil`)
- [x] Editar nombre (inline)
- [x] Ver y cambiar rol (redirige a `/onboarding`)
- [x] Info del perfil pyme con link a editar
- [x] Cerrar sesión

### ✅ 4.7 Onboarding pyme (`/pyme/onboarding`)
- [x] Identidad: nombre comercial, razón social, CUIT (con validación)
- [x] Oferta: categorías y zonas donde opera
- [x] Presencia online: web/IG/FB (al menos una requerida)
- [x] Contacto: WhatsApp
- [x] Pagos: info de MercadoPago
- [x] Funciona como onboarding inicial y como edición de perfil

### ✅ 4.8 Alumnos (`/grupos/:id/alumnos`)
- [x] Lista de alumnos del grupo con tutores
- [x] Agregar alumno con form inline
- [x] Detectar y fusionar duplicados (mismo nombre normalizado)
- [x] Unirse/desunirse como tutor de un alumno

---

## ✅ Fase 5 — Polish y producción (½ día) — COMPLETA (excepto smoke test)

### ✅ 5.1 PWA
- [x] `vite-plugin-pwa` instalado y configurado en `vite.config.ts`
- [x] Manifest con nombre, íconos (192/512), `start_url`, colores del design system
- [x] Workbox: cache de assets, `navigateFallback`, NetworkOnly para Supabase

### ✅ 5.2 Deploy a GitHub Pages
- [x] `deploy-pages.yml` ya buildea desde `web/` y publica en `/mapapis-next/`
- [x] `VITE_BASE_PATH=/mapapis-next/` configurado en el workflow

### ✅ 5.3 Variables de entorno en CI
- [x] `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` hardcodeadas en el workflow (son públicas by design)
- [x] `VITE_MP_PUBLIC_KEY` hardcodeada
- [ ] `VITE_SENTRY_DSN` — pendiente si se incorpora Sentry

### 5.4 Smoke test antes de cutover
- [ ] Login → onboarding → home
- [ ] Crear grupo → invitar → unirse con código
- [ ] Publicar necesidad → ver en feed
- [ ] Pyme oferta → familia vota → admin adjudica
- [ ] Inscripción individual funciona
- [ ] Perfil editable

---

## Orden de prioridad sugerido

```
✅ Fase 0  Setup local                    30 min  COMPLETA
✅ Fase 1  Componentes UI                 4 hs    COMPLETA
✅ Fase 2  Shell + rutas                  4 hs    COMPLETA
✅ Fase 3  Queries + mutations            4 hs    COMPLETA
✅ Fase 4.1 Feed familia                  3 hs    COMPLETA
✅ Fase 4.2 Feed pyme                     2 hs    COMPLETA
✅ Fase 4.3 Publicar necesidad            3 hs    COMPLETA
✅ Fase 4.4 Detalle completo              4 hs    COMPLETA
✅ Fase 4.5 Gestión de grupo              3 hs    COMPLETA
✅ Fase 4.6 Perfil                        2 hs    COMPLETA
✅ Fase 4.7 Onboarding pyme               2 hs    COMPLETA
✅ Fase 4.8 Alumnos                       3 hs    COMPLETA
✅ Fase 5   Polish + deploy               3 hs    COMPLETA (falta smoke test)
─────────────────────────────────────────────
Total estimado                          ~37 hs
Pendiente: smoke test (5.4) antes de merge a main
```

---

## Decisiones de arquitectura ya tomadas (mantener)

- **React Query** para todo el fetching — no `useEffect` + fetch manual
- **Zustand** solo para sesión (no para data de servidor)
- **Zod** en todos los forms con `react-hook-form`
- **TypeScript estricto** — no `any`, no `as`
- **`database.types.ts`** como fuente de verdad de shapes — regenerar con `npm run types:gen` si cambia la DB
- **Dialog** basado en Context + Promise (ya implementado en `index.html`, migrar tal cual)
- **No shadcn** — componentes propios que respetan el design system

---

## Referencia rápida

```bash
# Correr local
cd web && npm run dev

# Typecheck
npm run typecheck

# Tests
npm run test

# Regenerar tipos de DB
npm run types:gen

# Build
npm run build
```
