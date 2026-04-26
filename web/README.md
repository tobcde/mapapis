# MaPaPis — Web (Vite)

App nueva en **Vite + React + TypeScript**, conviviendo con la app vieja (`../github-pages/mapapis/`) durante la migración.

- App vieja: `https://tobcde.github.io/mapapis/`
- App nueva: `https://tobcde.github.io/mapapis-next/`

Spec completo de la migración: [`../docs/spec-migracion-vite.md`](../docs/spec-migracion-vite.md).

## Setup

```bash
cd web
npm install --legacy-peer-deps
cp .env.example .env.local   # completá los valores reales
npm run dev
```

Se abre en `http://localhost:5173/mapapis-next/` (respeta el `base` de prod).

> Nota: `--legacy-peer-deps` es necesario porque algunas deps todavía declaran peer ranges en React 18; en runtime funcionan bien con React 19.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | TS check + bundle de prod en `dist/` |
| `npm run preview` | Sirve `dist/` localmente para QA |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint con type-aware rules |
| `npm run lint:fix` | Auto-fix lo que se pueda |
| `npm run format` | Prettier sobre todo |
| `npm run format:check` | Verifica formato sin escribir |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single-run |
| `npm run test:ui` | UI interactiva de Vitest |
| `npm run test:coverage` | Reporte de cobertura |
| `npm run validate` | typecheck + lint + tests (lo que corre CI) |
| `npm run types:gen` | Regenera `src/lib/database.types.ts` desde Supabase |

## Estructura

```
src/
├── main.tsx               # entry: monta <App /> + Sentry init
├── App.tsx                # router + providers (Query, Suspense)
├── routes/                # 1 file por ruta
├── components/
│   └── ui/                # primitives reusables
├── lib/
│   ├── env.ts             # acceso tipado a VITE_*
│   ├── supabase.ts        # cliente único Supabase
│   ├── queryClient.ts     # config TanStack Query
│   ├── sentry.ts          # init env-gated
│   ├── database.types.ts  # autogen con `npm run types:gen`
│   ├── queries/           # hooks `useX` de TanStack Query
│   └── mutations/         # hooks de mutation
├── hooks/                 # hooks UI puros
├── stores/                # Zustand (sesión global)
├── styles/
│   └── tokens.css         # design tokens (CSS vars)
├── types/                 # tipos compartidos
├── utils/                 # fmtMoney, validarDni, etc.
└── test/
    └── setup.ts           # config global de Vitest
```

## Reglas de oro

1. **Sin `useState([loading, setLoading])` para fetching** — usar TanStack Query.
2. **Sin `useEffect` para fetch** — TanStack Query.
3. **Sin `any`** — el `tsconfig.app.json` está en `strict: true`. Si algo no tipa, es un bug.
4. **Imports con alias `@/`** — nada de `../../../lib/foo`.
5. **Tests obligatorios en `lib/` y `utils/`**, opcionales en componentes.
6. **No commitees `.env.local`** — está gitignored.
7. **`anon` key es pública por diseño** — la seguridad la da la RLS de Supabase. `service_role` y MP `access_token` viven solo en Edge Functions.

## CI/CD

Push a `main` que toque `web/**` dispara `.github/workflows/deploy-pages.yml`:

1. `npm ci --legacy-peer-deps`
2. `npm run validate` (typecheck + lint + tests, fail-fast)
3. `npm run build` con env vars desde GitHub Secrets
4. Stage combinado: `_site/mapapis/` (vieja) + `_site/mapapis-next/` (nueva)
5. Deploy a Pages

Secrets necesarios (Settings → Secrets and variables → Actions):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MP_PUBLIC_KEY`
- `SENTRY_DSN` (opcional, vacío = sin reporte)

## Tipos de Supabase

El stub en `src/lib/database.types.ts` es minimalista. Para tipos reales:

```bash
npm run types:gen
```

Requiere `supabase` CLI logueada (`supabase login`) y permisos en el proyecto `adpbjslkswtnqklzejuy`. La salida se commitea — los tipos son código.

## Ver también

- Migraciones SQL: [`../db/`](../db/)
- Edge Functions: [`../supabase/functions/`](../supabase/functions/)
- Spec migración: [`../docs/spec-migracion-vite.md`](../docs/spec-migracion-vite.md)
