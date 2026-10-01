# OurDIU – project plan

The plan and the decisions behind it, kept in the repository so anyone (or any Claude session) picking the project up knows what exists, what comes next and why. Update it when a decision changes or a step is done. `CLAUDE.md` has the day-to-day working rules; `README.md` the architecture and setup.

Last updated: 1 October 2026.

## What OurDIU is

[ourdiu.com](https://ourdiu.com) is one home for Daffodil International University (DIU) student tools, on the web and in one mobile app:

| Product       | Path         | Status                                                                                                                                   |
| ------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Question Bank | `/questions` | Live at [diuqbank.com](https://diuqbank.com) (repo `../QuestionBank`); moved here on the `question-bank` branch, waiting for the cutover |
| Class Routine | `/routine`   | "Coming soon" placeholder; to be built from scratch after the question bank                                                              |
| Marketplace   | `/market`    | "Coming soon" placeholder; later                                                                                                         |

Most users come from the question bank, so it moves in first and the others are discovered from it.

## Decisions (and why)

1. **One repository, one Cloudflare Worker, one origin, a path per product.** Pages at `/<product>`, product API at `/api/v1/<product>/…`. Session cookies stay first-party, no CORS, one API for the app. Subdomains or separate Workers were rejected: they'd need cross-domain auth for no gain at this size.
2. **One account system for everything.** Better Auth, Google sign-in only. New accounts need a DIU address (`@diu.edu.bd`, `@s.diu.edu.bd`) unless listed in the `ADMIN_EMAILS` secret (which also makes them admins). Existing accounts can always sign in.
3. **The products are not interconnected.** They share accounts, departments and the look, nothing else: no product shows another's data. Each has its own tables (prefixed with its name, except the question bank's, which keep their existing names, see below), its own services and API namespace, its own admin section.
4. **Presentation: "option C", separate spaces.** `ourdiu.com` only asks "What do you need?" (and offers to continue where you left off). Each product is a space with its own header/menu, colour and (in the app) its own bottom tabs. A switcher next to the product name moves between spaces. Question bank users arriving from diuqbank.com land straight in their space; a dismissible banner (web) or one-time hint (app) tells them about the routine.
5. **Mobile app: one Flutter app, Material 3 (Expressive), on Android and iOS.** It's the existing OurDIU app (`com.ourdiu.app`, today in `../QuestionBank/apps/mobile`), extended with the spaces and the switcher. Its design system (indigo `#4F39F6`, Roboto Flex `expressive()` headings, the exam-type shapes) stays. iOS gets Material too, with only platform behaviours (back swipe, scrolling physics, dialogs) adapted. A full Cupertino design was mocked up and rejected: twice the design work for a mostly-Android audience.
6. **Space colours**: Question Bank indigo `#4F39F6`, Class Routine teal (`#006B5B` / container `#B9F0E3`), Marketplace rose.
7. **The question bank keeps its API paths** (`/api/v1/questions`, `/submissions`, `/contributors`, `/taxonomy`, `/me`, …) instead of moving under `/api/v1/questions/…`: the published app calls them, and installed copies keep calling them for months. Its tables keep their names (`questions`, `submissions`, `courses`, …) so the production database can be adopted as is. New products follow the prefix rules.
8. **The routine is rebuilt from scratch** (not ported from `../better-routine-scrapper`), CSE only at first, from the university's PDF (e.g. [CSE routine v3.1](https://webbackend.daffodilvarsity.edu.bd/noticeFile/cse-class-routine-v31-f4f0af7da9.pdf)).

Design mockups (website, Material app, and the rejected iOS style): <https://claude.ai/artifact/RfDHeYL7wiGdBDo2QqKokQ>.

## Roadmap

### Phase 0 – Platform (done)

- [x] Monorepo in the question bank's style: React Router SSR + Hono API in one Worker, D1 + Drizzle, R2, Better Auth (Google + bearer for the app), shadcn/ui, Zod contracts, Vitest in workerd, Playwright.
- [x] Hub page, `/routine` and `/market` "coming soon" pages, account page, admin panel (users, departments), privacy and terms.
- [x] Deployed: Worker `ourdiu` on `ourdiu.com` (+ `www` → apex), D1 `ourdiu`, R2 `ourdiu-files`, CI deploys `main` after checks and e2e pass.

### Phase 1 – Question bank moves in (code done, cutover pending)

Code, on the branch `question-bank`. Not merged to `main` yet: a push to `main` deploys, and this code needs a database with the question bank's schema and data, so merging it is part of the cutover below. Until the cutover, **diuqbank.com keeps running as it is** on its own Worker, database and bucket, and ourdiu.com keeps the placeholder hub. Locally, `apps/web/.dev.vars` uses the question bank's secrets (same Google client, Gemini and compressor keys).

- [x] The question bank's API, schema, migrations (its `0000`–`0006` replace this repo's old `0000_init`), shared schemas, tests and web pages, renamed `@qb/*` → `@ourdiu/*`. `ADMIN_EMAILS` kept. The platform's separate `departments` admin page went away: the question bank's catalog manages departments.
- [x] Pages under the product path: `/questions` (the space's home), `/questions/browse`, `/questions/:id`, `/questions/contributors[/:username]`, `/questions/contribute`, `/questions/my-submissions[/:id]`. `/account` is the shared profile. Admin: `/admin` (dashboard, question bank numbers for now), `/admin/questions/{submissions,reports,catalog}`, `/admin/users`; the sidebar has a group per product plus "Platform".
- [x] Per-space header with the product switcher (`components/product-switcher.tsx`); the hub at `/` is the chooser; routine and market are "coming soon".
- [x] Legal, about, contact, copyright, cookies and delete-account pages say OurDIU; `LEGAL_UPDATED` = 1 October 2026. The contact address stays the question bank's (`AUTHOR.email` in `app/lib/author.ts`). The theme cookie is now `ourdiu_theme`.
- [x] diuqbank.com redirects (`legacyPath` in `app/lib/redirect.ts`): `/` → `/questions`, `/questions` → `/questions/browse`, `/contributors/*` → `/questions/contributors/*`, `/contribute` → `/questions/contribute`, `/account/submissions*` → `/questions/my-submissions*`; `/api/*` is served unchanged.
- [x] `pnpm check` green (202 API, 124 web, 53 shared tests), 60 e2e tests green, OpenAPI regenerated.
- [ ] Not done yet: the one-time "Class Routine is new" banner in the question bank space (mockup), and per-space colours on the web (everything is indigo).

Cutover (production, done by hand with the owner, never by CI on its own; not scheduled yet). The data is **copied** from diuqbank.com into OurDIU's own resources, then the domain is redirected. `apps/web/wrangler.jsonc` names OurDIU's resources: D1 `ourdiu`, R2 `ourdiu-files`, queues `questions-analysis` / `questions-watermark`, rate-limit namespaces 2001–2004 (1001–1004 are diuqbank's).

Preparation (any time before, nothing visible to users):

1. Empty the `ourdiu` D1: it has the placeholder site's old `0000_init` applied (only the owner's account), which clashes with the question bank's migrations of the same name. Delete and recreate it (`wrangler d1 delete ourdiu`, `wrangler d1 create ourdiu`) and put the new id in `wrangler.jsonc`.
2. Create the queues: `wrangler queues create questions-analysis`, `wrangler queues create questions-watermark`.
3. Give `ourdiu-files` a public custom domain (e.g. `files.ourdiu.com`) and set the GitHub variable `FILES_URL` to it.
4. Secrets on the `ourdiu` Worker, run by the owner (`wrangler secret put <NAME> --name ourdiu`), with the question bank's values: `BETTER_AUTH_SECRET` (so sessions and the app's bearer tokens copied with the data stay valid), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (the installed app's ID tokens are issued for that client; add `https://ourdiu.com` and `https://ourdiu.com/api/auth/callback/google` to it, and retire the new `279664469023-…` client), `GEMINI_API_KEY`, `COMPRESSOR_API_KEY`.

The switch (at a quiet time: anything uploaded, voted or signed up on diuqbank.com between the export and the domain move is lost):

5. Copy the database: `wrangler d1 export questionbank --remote --output questionbank.sql`, then `wrangler d1 execute ourdiu --remote --file questionbank.sql` into the empty database. The export carries the schema, triggers and the `d1_migrations` table, so CI's migrations are then a no-op.
6. Copy the files: every object of R2 `questionbank-papers` into `ourdiu-files`, same keys (PDFs, `watermarked/`, avatars), e.g. with rclone over R2's S3 API or Cloudflare's R2 data migration.
7. Merge `question-bank` into `main`; CI applies migrations (nothing to do) and deploys `ourdiu`.
8. Move the `diuqbank.com` and `www.diuqbank.com` custom domains from the `questionbank` Worker to `ourdiu`: pages 301 to their new paths on ourdiu.com, `/api/*` keeps serving installed apps. Check sign-in on the site and in the app, an upload (AI check, watermark), a download.
9. Keep the `questionbank` Worker's D1 and R2 for a while as a backup, then retire them and archive `../QuestionBank`. Make the owner an admin if needed (`ADMIN_EMAILS`, or `pnpm make-admin <email> --remote`).

### Phase 2 – One app

- [x] Moved `../QuestionBank/apps/mobile` into `apps/mobile` here, with its release workflow and CI jobs (analyze, test, Android and iOS builds, generated-client check). Unchanged otherwise: it still says QuestionBank and calls diuqbank.com. App work happens here from now on; `../QuestionBank/apps/mobile` is frozen.
- [ ] Releasing from this repository (owner, one-time): the GitHub environment `play` here with `ANDROID_UPLOAD_KEYSTORE_BASE64` / `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, the variables `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_SERVICE_ACCOUNT`, and the Google Cloud workload identity provider and IAM binding allowing this repository's ID (`1398723748`) instead of QuestionBank's (`817495452`). Tags continue above `mobile-v1.5.0`.
- [x] Spaces (`apps/mobile/lib/spaces/`): first-launch chooser ("What do you need?"), then the app reopens in the space used last (`space` in shared preferences); "Question Bank ▾" on Home opens the switcher (bottom sheet); Class Routine (teal) and Marketplace (rose) are "coming soon" screens without the question bank's tabs. Visible names say OurDIU (app title, iOS display name, Account links, feedback subject).
- [x] App icon (adaptive, with an Android 13 themed version) and splash (light and dark, with the OurDIU wordmark) replace Flutter's defaults; `store/icon-512.png` is the new Play listing icon.
- [x] Play listing material says OurDIU: `store/listing.md` (text to paste), `store/icon-512.png`, `store/feature-graphic.png`, and screenshots (new Home, plus `08-products.png`, the chooser).
- [ ] Owner: paste the listing into Play Console and upload the icon, feature graphic and screenshots.
- [ ] The one-time "your class routine is here too" hint, once the routine is live.
- [ ] `apiBaseUrl` → `https://ourdiu.com`; links to `ourdiu.com/questions/…`.

### Phase 3 – Class Routine (from scratch)

Not started. Mockups exist (find your section; today; week with lab groups; teacher; room; free rooms). Facts from the CSE PDF v3.1: 8 pages, one table per day (Saturday–Thursday, Friday off), 6 time slots × (room, course, teacher); about 165 regular sections in batches 63–73 (e.g. `71_A`), most split into lab groups (`71_A1`, `71_A2`), plus retake sections like `RE_A(3C)`; 74 rooms, about 200 teacher initials, about 12 classes a week per section. Course and teacher full names are not in the PDF.

Open questions for the owner (defaults in brackets):

1. Course names: show codes only, or an admin-filled code → name list? [codes, plus an admin list]
2. Teacher names: initials, or an admin-filled initials → name list? [initials, plus an admin list]
3. Retake sections in the finder? [yes, as their own group]
4. New PDFs: admin uploads them, or fetched automatically from the university site? [admin upload first]

### Phase 4 – Marketplace

Not designed yet.

## Operating rules

- **Secrets are entered by the owner, never by Claude**: `wrangler secret put …` commands are given to the owner to run. Don't read OAuth client-secret files.
- **Production changes need the owner's go-ahead**: remote migrations, deploys outside CI, DNS / custom domains, binding production resources.
- `main` deploys automatically; work that isn't ready for production goes on a branch.
- Contact address on the site and legal pages: `AUTHOR.email` (`app/lib/author.ts`).
