# Spec — Migración a Vite + React + TS

Estado: **Draft, pre-aprobación**. Antes de tocar código necesito validación de las decisiones marcadas con ⚠️.

## 1. Objetivo

Migrar la app actual (`github-pages/mapapis/index.html`, ~4874 líneas con React + Babel standalone) a un proyecto Vite + React + TypeScript correctamente estructurado, **sin romper la versión actual**. Las dos coexisten durante la migración.

**No es objetivo:**
- Cambiar la DB, RLS, edge functions o esquema Supabase
- Cambiar el modelo de negocio o las pantallas (eso vendrá después, sobre la base nueva)
- Subir a App Store / Play Store en esta etapa (queda preparada para Capacitor más adelante)

## 2. Decisiones de stack

### Confirmadas
- **Bundler:** Vite 5
- **Lenguaje:** TypeScript en modo `strict`
- **UI:** React 18
- **DB:** mismo proyecto Supabase (`adpbjslkswtnqklzejuy`) — con flag `VITE_ENV` para distinguir dev/prod en logs y analytics

### Recomendadas (validar)
- **Routing:** React Router v6 (cliente puro, sin SSR)
- **Estilos:** Tailwind v3 instalado localmente (no CDN) + las CSS vars del design system actual portadas a `index.css`
- **Server state:** **TanStack Query v5** — esto resuelve solo el bug de "se queda cargando al cambiar de tab" (refetch on focus, dedupe, AbortController automático, retry)
- **Client state:** Zustand para sesión/perfil global (chico, sin Redux)
- **Forms:** React Hook Form + Zod schemas (validación tipada compartida con Supabase types)
- **Tipos Supabase:** `supabase gen types typescript` → `src/lib/database.types.ts`, regenerar con `pnpm types:gen`
- **Linter:** ESLint + `@typescript-eslint` + Prettier (config compartida)
- **Tests:** Vitest + Testing Library (al principio mínimos, agregar mientras migramos)
- **Errores:** Sentry opcional (free tier) para capturar runtime errors en prod
- **PWA:** plugin `vite-plugin-pwa` (genera SW con Workbox, manifest tipado, offline cache)
- **Package manager:** pnpm (más rápido, lockfile determinístico)

### Descartadas (con razón)
- **Next.js:** overkill, no necesitamos SSR, complica deploy a GitHub Pages
- **Redux/MobX:** TanStack Query + Zustand cubre 100% de los casos del MVP
- **Capacitor ahora:** se agrega cuando sea momento de stores, sin refactor (ya queda la lógica web-pura aislada)

## 3. Estructura de carpetas

```
D:\MaPaPis\
├── github-pages/mapapis/        # ← VERSIÓN ACTUAL, no se toca
├── web/                         # ← VERSIÓN NUEVA (Vite)
│   ├── src/
│   │   ├── main.tsx             # entry, monta <App />
│   │   ├── App.tsx              # router + providers
│   │   ├── routes/              # 1 file por ruta (lazy-loaded)
│   │   │   ├── _layout.tsx      # shell (header, nav)
│   │   │   ├── login.tsx
│   │   │   ├── grupos.tsx
│   │   │   ├── necesidad/[id].tsx
│   │   │   ├── publicar.tsx
│   │   │   ├── pyme/dashboard.tsx
│   │   │   └── ...
│   │   ├── components/          # UI compartido
│   │   │   ├── ui/              # primitives (Button, Modal, Toast)
│   │   │   ├── necesidad/       # NecesidadCard, OfertaCard, etc.
│   │   │   └── pago/            # MPButton, ProgresoLote, etc.
│   │   ├── lib/
│   │   │   ├── supabase.ts      # cliente único, lee env vars
│   │   │   ├── database.types.ts # generado automático
│   │   │   ├── queries/         # hooks de TanStack Query (1 por feature)
│   │   │   │   ├── useNecesidades.ts
│   │   │   │   ├── usePagosMP.ts
│   │   │   │   └── ...
│   │   │   └── mutations/       # hooks de mutations
│   │   ├── hooks/               # hooks UI puros (useDialog, useToast, etc.)
│   │   ├── stores/              # Zustand
│   │   │   └── session.ts       # user, profile, role
│   │   ├── styles/
│   │   │   ├── index.css        # Tailwind + CSS vars (--ink, --coral, etc.)
│   │   │   └── tokens.css       # design tokens crudos
│   │   ├── types/               # tipos compartidos (Necesidad, Oferta, Pyme...)
│   │   └── utils/               # fmtMoney, validarDni, etc.
│   ├── public/
│   │   ├── icons/               # copiar de github-pages/mapapis/icons
│   │   └── manifest.json        # generado por vite-plugin-pwa
│   ├── index.html               # template Vite (1 div#root, no scripts inline)
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── .eslintrc.cjs
│   ├── .prettierrc
│   ├── .env.example             # documentación, NO secretos
│   └── .env.local               # gitignored, las keys reales acá
├── db/                          # se mantiene
├── supabase/                    # se mantiene
└── docs/                        # se mantiene
```

## 4. Variables de entorno

`.env.local` (gitignored, cada dev tiene la suya):
```
VITE_SUPABASE_URL=https://adpbjslkswtnqklzejuy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...      # anon key, OK público
VITE_MP_PUBLIC_KEY=APP_USR-79ac6ee1-...         # solo public key, NO el access token
VITE_ENV=dev                                    # dev | prod
VITE_SENTRY_DSN=                                # opcional, vacío = sin sentry
```

`.env.example` se commitea con los nombres pero sin valores. Documentación viva.

**NUNCA en frontend:**
- `service_role` key (solo edge functions)
- MP `access_token` (solo edge functions, ya está bien hoy)

## 5. Seguridad — qué cambia, qué no

| Aspecto | Hoy | Vite | Cambio |
|---|---|---|---|
| Anon key | Hardcoded en HTML | En env var, prefijo `VITE_` | Cosmético — la anon key es pública por diseño, lo que protege es la RLS |
| RLS de Supabase | Definida en migraciones | Igual | Ninguno |
| Service role | No usada en FE ✓ | Igual | Ninguno |
| MP access token | Solo en edge function ✓ | Igual | Ninguno |
| HTTPS | GitHub Pages ✓ | GitHub Pages ✓ | Ninguno |
| CSP headers | No tiene | Agregar via `<meta>` o GH Pages workflow | Mejora |
| Dependencias | CDN (sin lockfile) | pnpm lockfile + Renovate o Dependabot | Mejora grande — auditable |
| Sanitización inputs | A mano (`sanitizar_descripcion` SQL) | Igual + Zod en FE | Mejora |
| Logs con PII | `console.log` libre | `logger.ts` con niveles, no logguea PII en prod | Mejora |

⚠️ **Decidir:** ¿activar Dependabot / Renovate desde día 1? (recomendado)

## 6. Deploy

### Opción recomendada: misma cuenta GitHub Pages, subdir distinto

- **App vieja:** `tobcde.github.io/mapapis/` ← se mantiene intacta
- **App nueva:** `tobcde.github.io/mapapis-next/` ← deploy desde `web/dist/`

Workflow GitHub Actions:
1. Trigger en push a `main` que toca `web/**`
2. Build con `pnpm install --frozen-lockfile && pnpm build`
3. Output a `dist/`, sube a la rama `gh-pages` en path `/mapapis-next/`
4. La rama `gh-pages` tiene ambas apps: `mapapis/` (vieja) y `mapapis-next/` (nueva)

`vite.config.ts` con `base: '/mapapis-next/'` para que los assets se resuelvan bien.

⚠️ **Decidir:** cuando la nueva esté lista, ¿swap de nombres? (`mapapis/` = nueva, `mapapis-old/` = vieja). O custom domain en algún momento.

## 7. Bug fixes que entran en el bootstrap

Estos se resuelven solos al usar TanStack Query, sin lógica custom:

1. **"Se queda cargando al cambiar de tab"** → `refetchOnWindowFocus: true` (default en TQ)
2. **Spinners eternos cuando una promesa se cuelga** → TQ tiene timeout y AbortController
3. **`onChanged()` no refetcha** → TQ invalida con `queryClient.invalidateQueries(['necesidad', id])`
4. **Pagos MP no actualizan progreso** → fix ya hecho en HTML viejo, en la nueva el hook `usePagosMP` ya combina ambas fuentes
5. **Auth deadlock de Supabase JS** → upgrade a versión actualizada + migrar a v2 con `auth.persistSession: true, autoRefreshToken: true`

## 8. Plan de migración por fases

### Fase 0 — Bootstrap (1 sesión, mañana)
- [ ] Crear `web/` con `pnpm create vite . --template react-ts`
- [ ] Instalar deps: TanStack Query, Zustand, RHF + Zod, Supabase JS, React Router, Tailwind, vite-plugin-pwa
- [ ] Copiar `icons/` y `manifest.json`
- [ ] Configurar `vite.config.ts`, `tsconfig.json` (strict), `tailwind.config.ts`
- [ ] Portar CSS vars del design system a `styles/tokens.css`
- [ ] Crear `lib/supabase.ts` y `lib/database.types.ts` (auto-gen)
- [ ] Setup ESLint + Prettier + Husky pre-commit
- [ ] Setup workflow GitHub Actions (deploy a `mapapis-next/`)
- [ ] **Smoke test:** "Hello MaPaPis" deployado a `tobcde.github.io/mapapis-next/`

### Fase 1 — Auth + shell + sesión (1-2 sesiones)
- [ ] Login passwordless (magic link)
- [ ] Provider de sesión (Zustand) + ruta `_layout` con header/nav
- [ ] Guard de rutas autenticadas
- [ ] Logout
- [ ] Onboarding (rol pyme/familia, datos básicos)

### Fase 2 — Pantallas de familia (3-4 sesiones)
- [ ] Lista de grupos
- [ ] Detalle de grupo + necesidades activas
- [ ] Publicar necesidad
- [ ] Detalle de necesidad (ofertas, votos, contacto pyme)
- [ ] Modalidad individual: alumnos, inscripciones
- [ ] Pago MP + progreso del lote

### Fase 3 — Pantallas de pyme (2-3 sesiones)
- [ ] Dashboard pyme (necesidades disponibles)
- [ ] Hacer oferta
- [ ] Detalle de oferta ganadora
- [ ] Confirmar entrega
- [ ] Reviews

### Fase 4 — Founder panel + extras (1-2 sesiones)
- [ ] Panel admin (`020_founder_panel.sql`)
- [ ] Reviews públicas de pymes
- [ ] Tier system

### Fase 5 — Switch (1 sesión)
- [ ] QA cruzado entre vieja y nueva
- [ ] Renombrar `mapapis-next/` → `mapapis/` y vieja → `mapapis-old/`
- [ ] Service worker pisa el viejo (versión nueva)
- [ ] Avisar a usuarios beta

**Tiempo total estimado:** 8-12 sesiones de laburo focalizado.

## 9. Calidad y mantenibilidad — convenciones

- **TS strict:** sin `any`, sin `// @ts-ignore`. Si algo no tipa, refactor.
- **Component size:** límite suave 200 líneas. Más que eso, partir.
- **Hooks de query:** 1 archivo por entidad, exporta `useX`, `useXById`, `useCreateX`, etc.
- **Error boundaries:** uno global + uno por ruta principal.
- **Loading states:** TQ ya da `isLoading`, `isFetching`, `isError`. Sin `useState([loading, setLoading])` a mano.
- **Sin `useEffect` para fetching** — solo TQ.
- **Sin prop drilling** profundo — context o Zustand.
- **Tests primero en utils/lib** (`fmtMoney`, `validarDni`), después componentes críticos (PagoMPButton, AuthGuard).
- **Commits convencionales** (`feat:`, `fix:`, `refactor:`).

## 10. Lo que necesitás de tu lado

### Antes del bootstrap (Fase 0)
- [ ] Confirmar que **pnpm está instalado** (`pnpm -v` en la terminal). Si no, te paso el comando para instalarlo (1 línea).
- [ ] **Node.js 20+** (`node -v`). Vite 5 lo requiere.
- [ ] Confirmar que el repo donde vivirá `web/` es `tobcde/mapapis` (mismo que ya hosteamos).
- [ ] Validar este spec — sobre todo las ⚠️ decisiones marcadas.

### En el dashboard de Supabase (1 vez)
- [ ] Settings → API → confirmar que tenemos la **anon key** (ya la tenemos en el HTML, sirve)
- [ ] Settings → API → tenemos la **service_role** para correr `supabase gen types` localmente (usa la CLI, no el FE)
- [ ] Settings → Auth → URL Configuration → agregar `https://tobcde.github.io/mapapis-next/**` a "Redirect URLs" (para que magic link redirija a la nueva app)

### En el dashboard de GitHub
- [ ] Settings → Pages → confirmar que está activado en branch `gh-pages` con root `/`
- [ ] Settings → Actions → habilitar GitHub Actions si no está
- [ ] Settings → Secrets and variables → agregar como Action secret:
  - `SUPABASE_URL` (mismo valor que `VITE_SUPABASE_URL`)
  - `SUPABASE_ANON_KEY` (la anon)
  - `MP_PUBLIC_KEY` (la public, no el access token)

### Ya está y NO necesita tocarse
- ✓ DB Supabase + migraciones + RLS
- ✓ Edge functions (`mp_create_preference`, `mp_webhook`, `config.toml`)
- ✓ MP access token (en secrets de Supabase, no toca el FE)
- ✓ Dominio actual (`tobcde.github.io/mapapis/`)
- ✓ Las migraciones SQL pendientes (`029_fix_pago_mp_grant.sql`)

## 11. Preguntas abiertas (decidir antes de Fase 0)

1. ⚠️ **Estilo de migración del UI:** ¿port "fiel" del look actual (mismas paletas, mismas cards) o aprovechamos para refinar el design system de paso? Yo recomiendo port fiel primero, refinar después con datos reales de uso.
2. ⚠️ **Custom domain:** ¿en algún momento `mapapis.com.ar` (que tenías en el CNAME borrado) o seguimos en GitHub Pages?
3. ⚠️ **Sentry / analytics:** ¿lo activamos desde día 1 (cuesta $0 hasta cierto volumen) o lo dejamos para más adelante?
4. ⚠️ **Tests:** ¿meto Vitest desde Fase 0 con un par de tests de smoke o lo agregamos en Fase 1?
5. ⚠️ **Subdomain vs subpath:** ¿`mapapis-next.tobcde.github.io` (necesita config DNS) o `tobcde.github.io/mapapis-next/` (sale gratis, recomendado)?

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración se eterniza, mantenemos 2 apps | Fases cortas (1-2 sesiones c/u), demo funcional al final de cada una |
| Bugs en la nueva que no están en la vieja | QA paralelo en cada fase, datos compartidos en la misma DB facilita comparar |
| Rompemos auth durante el switch | Magic link redirect URLs en Supabase apuntan a ambas apps durante transición |
| Service Worker viejo cachea cosas viejas en `/mapapis/` | Bump version en `sw.js` antes del switch |
| Costos de hosting si crece | GitHub Pages es gratis hasta 100GB/mes — lejos del límite |

---

**Próximo paso:** Validar este doc, responder las 5 preguntas abiertas, y arranco con Fase 0.
