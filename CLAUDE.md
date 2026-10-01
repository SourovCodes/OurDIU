# OurDIU – working notes

pnpm monorepo, one Cloudflare Worker: `apps/web` (React Router SSR) runs `@ourdiu/api` (Hono, a library in `apps/api`) under `/api/*`. The Worker config (bindings, vars, `.dev.vars`, local state) lives in `apps/web`. See README.md for the architecture and **docs/PLAN.md for the project plan: the decisions, the roadmap and what's in progress. Read it first, and keep it up to date** (tick off steps, record new decisions).

## Commands

- `pnpm check` – run before considering work done (lint, format, typecheck, tests).
- `pnpm --filter @ourdiu/api test` / `pnpm --filter @ourdiu/web test` – package tests.
- `pnpm test:e2e` – Playwright; needs `pnpm db:migrate && pnpm db:seed` first.
- After editing `apps/api/src/db/schema/*`: `pnpm db:generate`, review the SQL, then `pnpm db:migrate`. Never edit a migration that has been applied anywhere.
- After changing an API route or a schema in `packages/shared`: `pnpm openapi` and commit `apps/api/openapi.json` (a test checks it's current). New object schemas that public endpoints return get a `.meta({ id: "Name" })`; make named schemas nullable with `nullableRef`, never `.nullable()`.
- After editing `apps/web/wrangler.jsonc`: `pnpm --filter @ourdiu/web cf-typegen` and `pnpm --filter @ourdiu/api cf-typegen`. A new binding, var or secret the API uses also goes in `apps/api/src/env.d.ts`.

## Conventions

- **Products are namespaced everywhere**: pages at `/<product>` (`app/routes/<product>*.tsx`), API at `/api/v1/<product>` and `/api/v1/admin/<product>`, services in `services/<product>/`, tables prefixed `<product>_`, R2 keys under `<product>/`. Platform pieces (users, departments, auth) are shared by all products. A product's card on the hub comes from `app/lib/products.ts`.
- API contracts live in `packages/shared` as Zod schemas; browser code imports constants from `@ourdiu/shared/constants` so Zod stays out of the client bundle.
- API layering: `routes/` (createRoute + validation, thin) → `services/` (logic, DB, R2). Throw `AppError` for expected failures; errors are `{ error: { code, message, details? } }`.
- Bindings are per request: build DB/auth from `c.env` in middleware, never as module-level singletons.
- Only protected routes look up sessions (`requireAuth` / `requireAdmin`); public reads stay session-free.
- Web: data loading happens in loaders/actions via `apiFetch` (`app/lib/api.server.ts`, an in-process call into the API), never directly against D1/R2. Server-only modules end in `.server.ts`. Admin pages sit under `/admin` (the layout calls `requireAdmin`; loaders use `adminGetJson`, actions `adminRequest`).
- UI uses shadcn/ui in `app/components/ui` (add with `pnpm dlx shadcn@latest add <name>` from `apps/web`), plus `PageHeader`, `EmptyState`, `UserAvatar`, `UrlTabs`, `TablePagination` and `components/actions.tsx` (`ActionDialog`, `ConfirmAction`, `useFormAction`). When an action removes the row it started from, run it through a `useFormAction` owned by the page.
- Sign-in is Google-only. API tests sign in with `signIn()` (Better Auth `testUtils`), e2e tests with `logInAs(page, NEW_USER | SEED_ADMIN, path)`.
- Theme: the `dark` class on `<html>` is set by `THEME_SCRIPT` / `setTheme` (`app/lib/theme.ts`), never rendered by React.
- Legal pages (`/privacy`, `/terms`) must match what the site collects; update `LEGAL_UPDATED` in `app/lib/legal.ts` with any change.
- Every new API route gets an integration test in `apps/api/test`; user-facing flows get a Playwright test.
