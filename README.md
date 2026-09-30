# OurDIU

Tools for Daffodil International University students at [ourdiu.com](https://ourdiu.com), under one account, on the web and in the OurDIU app.

| Product       | Status                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Class Routine | Coming soon (`/routine` is a placeholder)                                                      |
| Question Bank | Live at [diuqbank.com](https://diuqbank.com) (separate repo); moves here as `/questions` later |
| Marketplace   | Coming soon (`/market` is a placeholder)                                                       |

This repository is the platform the products are built on: one Cloudflare Worker, one database, one Google sign-in, and an admin panel. It started from the question bank's architecture, so the two can be merged later.

## Architecture

```
Browser ────┐            ┌─ /api/*  ──► @ourdiu/api (Hono) ──► D1 / R2
            ├──► Worker ─┤              ▲
OurDIU app ─┘            └─ pages ──► React Router loaders/actions
                                        (call @ourdiu/api in-process, forwarding cookies)
```

- **One origin, a path per product**: `ourdiu.com/routine`, `/market`, and later `/questions`. The API mirrors this: `/api/v1/<product>/…`, next to the platform's `/api/v1/me` and `/api/v1/admin/…`. Session cookies stay first-party, and the app talks to one API.
- **One account system**: Better Auth with Google (`/api/auth/*`). The site uses cookie sessions; the app swaps a Google ID token for a bearer token. New accounts need a DIU address (`@diu.edu.bd`, `@s.diu.edu.bd`) unless the address is in `ADMIN_EMAILS`, which also makes it an admin.
- **Shared data**: `user` (with `role` and `username`) and `departments` belong to the platform. Each product adds its own tables, prefixed with its name (e.g. `routine_*`).

## Stack

| Area            | Choice                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| Runtime         | One Cloudflare Worker: SSR pages, and the API under `/api/*`                     |
| API             | [Hono](https://hono.dev) + `@hono/zod-openapi` (OpenAPI 3.1 docs at `/api/docs`) |
| Web             | [React Router](https://reactrouter.com) (SSR) + Tailwind CSS v4 + shadcn/ui      |
| Database        | Cloudflare D1 (SQLite) via [Drizzle ORM](https://orm.drizzle.team)               |
| File storage    | Cloudflare R2                                                                    |
| Auth            | [Better Auth](https://better-auth.com) (Google OAuth)                            |
| Shared contract | Zod schemas in `packages/shared`, used by the API, the web app and the app       |
| Tests           | Vitest (the API runs inside `workerd` with real local D1/R2), Playwright         |

## Project structure

```
apps/
  api/        @ourdiu/api: Hono API + auth (a library, run by apps/web)
    src/routes/     HTTP layer: route definitions + validation
    src/services/   Logic (DB, R2), called by routes
    src/db/schema/  Drizzle tables → `pnpm db:generate` → migrations/
    openapi.json    The OpenAPI document (`pnpm openapi`), for the app's client
  web/        @ourdiu/web: the Worker (wrangler.jsonc) and the React Router site
packages/
  shared/     Zod schemas, types and constants shared by all clients
```

## Getting started

```bash
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # fill in the values
pnpm db:migrate
pnpm db:seed
pnpm dev                                           # http://localhost:5173
```

Put your own email in `ADMIN_EMAILS` before you first log in to get the admin panel, or run `pnpm make-admin you@example.com` afterwards (`--remote` for production).

`pnpm check` runs lint, formatting, typechecks and unit tests; `pnpm test:e2e` runs Playwright (after `pnpm db:migrate && pnpm db:seed`).

## Deploying

CI (`.github/workflows/ci.yml`) deploys `main` once the checks pass: it applies D1 migrations, then builds and deploys the Worker (`ourdiu`). One-time setup:

1. Create the resources and put the database id in `apps/web/wrangler.jsonc`:
   - `wrangler d1 create ourdiu`
   - `wrangler r2 bucket create ourdiu-files`
2. Secrets: `wrangler secret put BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, and optionally `ADMIN_EMAILS`.
3. Google Cloud: add `https://ourdiu.com` as an authorised origin and `https://ourdiu.com/api/auth/callback/google` as a redirect URI on the OAuth client.
4. GitHub: secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and the variable `SITE_URL=https://ourdiu.com` (deploys are skipped until it's set).
5. After the first deploy, attach the domains in the dashboard: Workers & Pages → `ourdiu` → Domains & Routes → `ourdiu.com` and `www.ourdiu.com`. Requests on any other host (`www.`, workers.dev) are redirected to `SITE_URL`.
