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
| Componentes reutilizables | ❌ | ⚠️ Básicos |
| Features completas | ✅ | ~20% |

---

## Fase 0 — Setup local (30 min)

### 0.1 Completar `.env.local`
```
VITE_SUPABASE_ANON_KEY=   ← copiar de index.html línea 23
VITE_MP_PUBLIC_KEY=        ← desde dashboard de MercadoPago
VITE_BASE_PATH=/
```

### 0.2 Instalar dependencias y correr
```bash
cd web
npm install
npm run dev     # → http://localhost:5173
```

### 0.3 Verificar que anda
- [ ] Landing carga
- [ ] Login con magic link funciona
- [ ] Onboarding guarda rol
- [ ] Grupos lista y crea

---

## Fase 1 — Librería de componentes UI (½ día)

Extraer los patrones visuales del `index.html` en componentes reutilizables tipados.

### Archivos a crear en `web/src/components/ui/`

#### `Button.tsx`
```tsx
// Variantes: primary | secondary | danger | ghost
// Tamaños: sm | md | lg
// Props: loading, disabled, fullWidth, icon
<Button variant="primary" loading={saving}>Guardar</Button>
<Button variant="danger">Eliminar</Button>
<Button variant="ghost">Cancelar</Button>
```

#### `Card.tsx`
```tsx
// Wrapper con borde ink, sombra 3px/4px desplazada, rounded-2xl o 3xl
<Card>contenido</Card>
<Card shadow="lg">contenido</Card>  // 4px 4px 0 var(--ink)
```

#### `Dialog.tsx`
```tsx
// Migrar el CustomDialog del index.html
// Soporta: alert (1 botón) y confirm (2 botones)
// Backdrop con blur, animación slideUp
const { showAlert, showConfirm } = useDialog()
await showConfirm('¿Eliminar miembro?')
```

#### `Input.tsx`
```tsx
// Input + Label + error message
// Variantes: text, email, tel, textarea
<Input label="Nombre" error={errors.nombre?.message} {...register('nombre')} />
```

#### `Badge.tsx`
```tsx
// Chips de estado para necesidades y roles
<Badge estado="recibiendo_ofertas" />  // → amarillo
<Badge estado="adjudicada" />          // → verde
<Badge rol="creador" />                // → sun
```

#### `Skeleton.tsx`
```tsx
// Placeholder animado para loading states
<Skeleton className="h-16 rounded-2xl" />
<SkeletonList count={3} />
```

#### `BottomNav.tsx`
```tsx
// Reemplaza el nav actual (emojis) por SVG icons como el index.html
// Tabs: Feed | Grupos | + (publicar, solo familia) | Perfil
// Para pyme: Feed | Mis ofertas | Perfil
```

---

## Fase 2 — Shell y navegación (½ día)

### 2.1 Rediseñar `Shell.tsx`
- Reemplazar header con `border-b` por el estilo del `index.html` (fondo oscuro en nav, cream en contenido)
- Implementar `BottomNav` con SVG icons y el botón `+` flotante para familia
- Soporte para rol pyme (tabs diferentes)
- Fondo con gradientes radiales decorativos (como el `body::before` del index.html)

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

## Fase 3 — Queries y mutations faltantes (½ día)

### Queries a crear en `web/src/lib/queries/`

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

### Mutations a crear en `web/src/lib/mutations/`

| Archivo | Qué hace |
|---|---|
| `usePublicarNecesidad.ts` | Crear necesidad con foto y campos estructurados |
| `useVoteOferta.ts` | `vote_oferta` / `unvote_oferta` RPCs |
| `useAdjudicarOferta.ts` | `adjudicar_oferta` RPC |
| `useCerrarInscripcion.ts` | `cerrar_inscripcion` / `reabrir_inscripcion` |
| `useInscribirAlumno.ts` | `inscribir_alumno` / `desinscribir_alumno` |
| `useCrearOferta.ts` | `crear_oferta` RPC (para pymes) |
| `useActualizarPyme.ts` | `actualizar_pyme` RPC |
| `useAlumnoActions.ts` | crear alumno, merge, join/leave como tutor |
| `useGrupoAdmin.ts` | promote, demote, kick, leave, regenerar código |

---

## Fase 4 — Features (2-3 días)

### 4.1 Feed familia (`/feed`)
- Lista de necesidades del grupo activo (o todas si no hay grupo)
- Filtros por categoría y estado
- `NecesidadCard` con presupuesto, zona, rango, estado badge
- Empty state con CTA a publicar o unirse a grupo

### 4.2 Feed pyme (`/feed` con rol pyme)
- Necesidades en `recibiendo_ofertas` en sus zonas configuradas
- Filtro por categoría
- Botón "Ofertar" directo desde la card

### 4.3 Publicar necesidad (`/publicar`)
- Form multi-paso o una sola pantalla larga
- Campos dinámicos según categoría (como en `index.html`)
- Upload de foto
- Selector de grupo destino

### 4.4 Detalle de necesidad — completar
Actualmente muestra título, descripción, presupuesto y lista de ofertas (read-only). Falta:

**Para familia/admin:**
- [ ] Panel de inscripción individual (anotar hijos)
- [ ] Votación de ofertas (por alumno)
- [ ] Botón cerrar/reabrir inscripción (admin)
- [ ] Chip de progreso (X/Y inscriptos)
- [ ] Adjudicar oferta (admin)

**Para pyme:**
- [ ] Form para presentar oferta
- [ ] Ver oferta propia con estado

### 4.5 Gestión de grupo — completar `GrupoDetail`
Actualmente muestra info básica + lista de necesidades. Falta:
- [ ] `InviteCard` (código + botón copiar + WhatsApp) — ya está en `index.html`
- [ ] Tab/sección de miembros: ver, promover admin, expulsar
- [ ] Tab/sección de alumnos: agregar, fusionar duplicados
- [ ] Botón "Salir del grupo" (para no-creadores)
- [ ] Regenerar código de invitación (admin)

### 4.6 Perfil (`/perfil`)
- Editar nombre
- Ver y cambiar rol
- Info del perfil pyme (si aplica)
- Cerrar sesión

### 4.7 Onboarding pyme (`/pyme/onboarding`)
- Nombre comercial, descripción, teléfono
- Selector de zonas donde opera
- Se dispara automáticamente después del onboarding de rol si eligió "pyme"

### 4.8 Alumnos (`/grupos/:id/alumnos`)
- Lista de alumnos del grupo con tutores
- Agregar alumno (buscar por nombre → match o crear)
- Detectar y fusionar duplicados (mismo nombre normalizado)
- Unirse/desunirse como tutor de un alumno

---

## Fase 5 — Polish y producción (½ día)

### 5.1 PWA
- Actualizar `vite-plugin-pwa` (ya está como dep) con manifest y service worker
- Íconos ya disponibles en `public/icons/`

### 5.2 Deploy a GitHub Pages
- Actualizar `deploy-pages.yml` para buildear desde `web/` en vez de copiar `github-pages/`
- Configurar `VITE_BASE_PATH` según la URL final

### 5.3 Variables de entorno en CI
Agregar secrets en GitHub:
```
VITE_SUPABASE_ANON_KEY
VITE_MP_PUBLIC_KEY
VITE_SENTRY_DSN  (opcional)
```

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
Fase 0  Setup local                    30 min
Fase 1  Componentes UI                 4 hs
Fase 2  Shell + rutas                  4 hs
Fase 3  Queries + mutations            4 hs
Fase 4.1 Feed familia                  3 hs
Fase 4.2 Feed pyme                     2 hs
Fase 4.3 Publicar necesidad            3 hs
Fase 4.4 Detalle completo              4 hs
Fase 4.5 Gestión de grupo              3 hs
Fase 4.6 Perfil                        2 hs
Fase 4.7 Onboarding pyme               2 hs
Fase 4.8 Alumnos                       3 hs
Fase 5  Polish + deploy                3 hs
─────────────────────────────────────────────
Total estimado                        ~37 hs
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
