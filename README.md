# OurDIU

Tools for Daffodil International University students at [ourdiu.com](https://ourdiu.com), under one account, on the web and in the OurDIU app.

| Product       | Path         | Status                                                                |
| ------------- | ------------ | --------------------------------------------------------------------- |
| Question Bank | `/questions` | Moved in from [diuqbank.com](https://diuqbank.com) (see docs/PLAN.md) |
| Class Routine | `/routine`   | Coming soon (a placeholder page)                                      |
| Marketplace   | `/market`    | Coming soon (a placeholder page)                                      |

**[docs/PLAN.md](docs/PLAN.md)** has the project plan: the decisions, the roadmap and what's in progress.

## Architecture

```
Browser ────┐            ┌─ /api/*  ──► @ourdiu/api (Hono) ──► D1 / R2 / Queues
            ├──► Worker ─┤              ▲
OurDIU app ─┘            └─ pages ──► React Router loaders/actions
                                        (call @ourdiu/api in-process, forwarding cookies)
```

- **One origin, a space per product**: `/` is the hub ("What do you need today?"); each product lives under its path with its own header and menu (`SiteHeader` picks them from the path, `app/lib/products.ts`), and the switcher next to the product's name moves between them. Products don't show each other's data. Platform pages sit at the root: `/account`, `/admin`, `/login`, `/about`, `/contact` and the legal pages.
- **API**: new products go under `/api/v1/<product>/…`. The question bank keeps the paths it had on diuqbank.com (`/api/v1/questions`, `/submissions`, `/contributors`, `/taxonomy`, `/me`, …) because installed copies of the app call them; `/api/v1/me` and `/api/v1/admin/users` are the platform's.
- **One account system**: Better Auth with Google (`/api/auth/*`). The site uses cookie sessions; the app swaps a Google ID token for a bearer token. Any Google account can sign in; contributing question papers needs a DIU address (`@diu.edu.bd`, `@s.diu.edu.bd`) or the admin role. Addresses in `ADMIN_EMAILS` are made admins when they sign up.
- **Data**: `user` (with `role` and `username`) and `departments` belong to the platform. The question bank's tables keep the names they had (`questions`, `submissions`, `courses`, …); new products prefix theirs with the product's name (`routine_*`, `market_*`).
- **The old domain**: requests to `diuqbank.com` are redirected to the page's new address here (`legacyPath` in `app/lib/redirect.ts`), except `/api/*`, which is served as is for the installed app.

## Question Bank

A public question-paper bank. Anyone can browse and download papers; signed-in contributors upload PDFs, which are published after review.

### Data model

```
departments (id, name, short_name)      semesters (id, name)      exam_types (id, name)
     │
courses (id, name, department_id)
     │
questions (id, department_id, course_id, semester_id, exam_type_id, view_count)
     │   · unique (course_id, semester_id, exam_type_id)
     │   · FK (course_id, department_id) → courses (id, department_id),
     │     so a question's department always matches its course's department
     │
submissions (id, question_id?, status, file_key, file_size, uploader_id,
             department_id? | custom_department_name (+ custom_department_short_name),
             course_id? | custom_course_name, semester_id? | custom_semester_name, exam_type_id?)
         status: pending_review | published | rejected — only published PDFs are public
         like_count, dislike_count, pending_report_count — maintained by triggers; view_count
     │
submission_analyses (submission_id, run_id, status, AI verdict + extracted values)
submission_votes (submission_id, user_id, value ±1)
submission_reports (id, submission_id, reporter_id, reason, details, status: pending | resolved | dismissed)

user (Better Auth) + role: user | admin
```

PDFs live in R2 under `file_key`. A question is listed once it has at least one submission.

Sign-in is Google-only (`/login`, Better Auth's `sign-in/social`); the account is created on the first sign-in, and Google reports whether the email is verified, and new users are stored that way. Users imported from the old site are marked verified, so their first Google sign-in with the same email links to the imported account (Better Auth only links to verified users). Signed-in users manage their account at `/account` (name and photo; the name through Better Auth's `update-user` endpoint) and their uploads at `/questions/my-submissions` (backed by `/api/v1/me/submissions`). Uploaders can preview their own PDFs in any status and withdraw submissions that aren't published yet; published papers stay in the bank. Profile images are cropped to a square in the browser (`AvatarInput`, react-easy-crop) and re-encoded as WebP at up to 512 px before upload, so the file that reaches the API is small; they are stored in R2 (JPEG, PNG or WebP, max 2 MB) and served from `/api/v1/avatars/{id}`. A new user's Google photo is copied the same way when the account is created (full size, which is Google's URL without its `=s96-c` size option, falling back to the size Google sent). If both downloads fail, the user keeps Google's URL.

Engagement on published papers:

- **Views** — question pages and papers count their views separately (`POST …/views`, from the question page only, see below). A browser counts once a day per page or paper: the API remembers what it counted in HttpOnly `qb_views_q` (question pages) and `qb_views_s` (papers) cookies (`lib/view-cookie.ts`), so a reload costs no database write. It's per browser, not per IP address, because most students share a few campus addresses.
- **Votes** — signed-in users like or dislike a paper (not their own). SQLite triggers in `migrations/0001_triggers.sql` keep `like_count` / `dislike_count` in sync. A question's papers are ranked by score (likes − dislikes), then views, then newest; the top paper opens by default.
- **Reports** — signed-in users report a problem (one open report per user per paper) for admin review. A trigger counts open reports and moves a published paper back to `pending_review` (hidden) at 3 (`REPORT_HIDE_THRESHOLD`). Admins resolve or dismiss reports in the admin panel; that doesn't publish a hidden paper again, which is a separate decision.

Semester names have a strict format: a term (Spring, Summer, Fall or Short) and a two-digit year from 15 to 30, e.g. `Fall 25`. `parseSemesterName` (`@ourdiu/shared/constants`) turns other spellings such as "fall 2025" into the standard one; uploads, admin edits, the catalog and the AI analysis all go through it, and anything else is rejected. Semesters sort newest first by year, then Fall, Summer, Spring, Short.

When contributing, department, course and semester can each be an existing value or a new name. If every value exists, the submission is linked to its question (created on demand). A new name that matches an existing value (ignoring case; departments also by short name, courses only within the chosen department) uses the existing value. If any value is still new, `question_id` stays null and the proposed values are stored on the submission until an admin creates them. A CHECK constraint enforces that a submission has exactly one of these shapes.

### Rate limits and view counts

The endpoints that cost money or can be spammed are limited per signed-in user with Cloudflare's rate-limit binding (`ratelimits` in `apps/web/wrangler.jsonc`, the `rateLimit` middleware in `apps/api/src/middleware/rate-limit.ts`). Per minute: 5 uploads (each one runs the AI check), 30 votes and 10 reports. Over the limit the API answers `429` with `RATE_LIMITED`, a message asking to wait a minute, and `Retry-After: 60`. Cloudflare counts per location, so these are caps against abuse rather than exact quotas. Nothing is limited per IP address: most visitors share a few campus addresses.

View counts are public, so instead of a limit they only count views from a question's page (`lib/view-token.ts`). `GET /api/v1/questions/{id}` returns a `viewToken` (an HMAC of the question id and time, valid for an hour), and the page sends it as `X-View-Token` with its view and its papers' views. Requests without a valid token for that question, from crawlers, HTTP libraries or headless browsers (by user agent), or from another site (`Sec-Fetch-Site`) still get `204` but aren't counted. A token counts each page at most once a minute (the `VIEW_LIMITER` binding, keyed by token and page), so a script has to load the question for every view it wants counted, like a visitor does, rather than replay one token for the hour.

### AI analysis of uploads

Every upload is checked in the background. The API enqueues a message on the `questions-analysis` Cloudflare Queue; its queue handler (`services/analysis.ts`) reads the PDF from R2, compresses it with the PDF processor API (only to cut AI cost; the compressed copy isn't stored) and sends it to Gemini in one `generateContent` call, together with the existing departments, courses, semesters and exam types. Gemini answers whether the file is a question paper, how many papers it contains, and the department (full name), course, semester, exam type, section and batch from its header. Names are matched to catalog entries or standardized (`normalizeCatalogName`: "and" instead of "&", single spaces, no trailing punctuation) — the same spelling rule applies to names typed by uploaders and admins. Failed runs retry up to 3 times.

**Auto-publishing.** The check that runs right after upload publishes the paper on its own when the AI finds exactly one question paper and reads the same department, course, semester and exam type (the same existing catalog entries, character for character) that the paper is filed under. Papers with new entries or reports, and re-runs started by an admin, are never auto-published. `submissions.auto_published_at` records it until an admin changes the status.

**Uploaders** follow their papers at `/questions/my-submissions` (cards) and `/questions/my-submissions/{id}`: a timeline (uploaded → AI check → decision), what the AI said and read next to what they chose, and whether it was auto-published or is waiting for an admin (`/api/v1/me/submissions/{id}`). Uploading leads straight to that page, which refreshes while the check runs. While a paper waits for review, its uploader can fix the details ("Use the AI's details" or "Edit my details", `PUT /api/v1/me/submissions/{id}/classification`); the new details are compared with the AI's earlier reading and the paper is published right away if they now match.

The questions list shows the newest papers first by default (`sort=newest`), or the most viewed (`popular`) or A–Z (`az`). Course names get the standard spelling for numbered parts ("Physics I", not "Physics-I").

`/contact` (a platform page) shows the contact email, with links that start an email per topic (bug, idea, removal, account and data). The legal pages (`/privacy`, `/terms`, `/copyright`, `/cookies`) share `LegalPage` (`components/legal-page.tsx`) and are listed in `app/lib/legal.ts`, which also holds their "last updated" date: change it, and the pages' text, whenever what the site collects, stores or shares changes (e.g. a new cookie or third-party service).

`/sitemap.xml` lists the static pages, every question with a published paper (its newest paper's upload date as `lastmod`) and every contributor, from `/api/v1/sitemap`. The Worker keeps the generated file in Cloudflare's cache for an hour, so crawlers don't query D1 on every fetch. `/robots.txt` keeps crawlers out of `/admin`, `/account` and `/api/` and points them at the sitemap. Both use the request's origin, which is `SITE_URL` in production thanks to the host redirect.

Otherwise results only flag, never reject: the admin list shows an AI badge and can filter by "Flagged by AI" (not a paper, several papers) or "AI disagrees". The review page shows the AI's values next to the submitted ones, **Apply AI values** prefills the classification dialog with them, and **Re-run** starts a new analysis.

Configuration: `GEMINI_MODEL` and `PDF_PROCESSOR_URL` in `apps/web/wrangler.jsonc`, secrets `GEMINI_API_KEY` and `COMPRESSOR_API_KEY` (`.dev.vars` locally; without them runs fail as "not configured"). See [Deploying](#deploying) for the production setup. Tests never call the real services.

### Watermarked public PDFs

Whenever a paper is published (by an admin, by the AI check, or after its uploader fixes the details), the API queues it on `questions-watermark`. The handler (`services/watermark.ts`) sends the original to the PDF processor's `watermark-compress` endpoint. That endpoint puts a credit line on top of every page ("ourdiu.com | Shared by <contributor>", ASCII only because the processor uses a standard PDF font; copies made before the move say diuqbank.com) and compresses the file. The handler stores the result in R2 as `watermarked/{id}.pdf`. The original under `file_key` is never changed.

- **Public route** `/api/v1/submissions/{id}/file` serves the watermarked copy. Until the copy is ready, or if watermarking failed, it serves the original, cached for 5 minutes instead of a day. Public file sizes are those of the copy.
- **Originals:** the admin and uploader file routes keep serving the original.
- **Admins:** the review page shows the state of the public copy and can **Redo the watermark**, e.g. after a contributor renames themselves. **Watermark missing PDFs** on the submissions list queues every published paper without a copy, which is how existing papers get one.

### Admin panel

Users with the `admin` role get an **Admin panel** entry in the account menu, leading to `/admin`; the question bank's pages are under `/admin/questions/…`. The panel has its own shell, built from shadcn's `dashboard-01` block: a collapsible sidebar, a top bar with breadcrumbs, cards, tabs, tables with row menus, and toasts for results (everyone else gets a 404 there, and the API answers 403 under `/api/v1/admin/*`):

- **Dashboard** — queue sizes, uploads over the last 30 days, submissions by status, the newest pending papers and open reports.
- **Submissions** — every paper by status. The review page shows the PDF (in any status) next to the decision (publish, reject, back to review, delete), its classification, uploader and reports. A paper that proposes new entries can't be published until an admin approves them: "Review entries" creates the new department, course or semester (or maps them to existing ones) and files the paper under its question. The same dialog corrects a paper filed under the wrong details.
- **Reports** — open, resolved and dismissed reports with the paper they're about.
- **Catalog** — add, rename and delete departments, courses, semesters and exam types. Entries in use can be renamed but not deleted; a course keeps its department because questions depend on it.
- **Users** — search by name or email, and grant or remove admin rights. Admins can't change their own role, so there is always at least one.

`role` is a Better Auth additional field with `input: false`, so sign-up and `update-user` can't set it. To make yourself an admin, log in with Google once, then run `pnpm make-admin you@gmail.com` (add `--remote` for the deployed database). `pnpm db:seed` also adds an admin user without a login, for the e2e tests.

## Stack

| Area            | Choice                                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| Runtime         | One Cloudflare Worker: SSR pages, and the API under `/api/*`                          |
| API             | [Hono](https://hono.dev) + `@hono/zod-openapi` (OpenAPI 3.1 docs at `/api/docs`)      |
| Web             | [React Router v8](https://reactrouter.com) (SSR) + Tailwind CSS v4 + shadcn/ui        |
| Database        | Cloudflare D1 (SQLite) via [Drizzle ORM](https://orm.drizzle.team)                    |
| File storage    | Cloudflare R2 (PDFs, avatars)                                                         |
| Background work | Cloudflare Queues (AI analysis, watermarks)                                           |
| Auth            | [Better Auth](https://better-auth.com) (Google OAuth, cookie sessions, bearer tokens) |
| Shared contract | Zod schemas in `packages/shared`, used by the API, the web app and the app            |
| Tests           | Vitest (API runs inside `workerd` with real local D1/R2), Testing Library, Playwright |
| Tooling         | pnpm workspaces, TypeScript, ESLint, Prettier, GitHub Actions                         |

## Project structure

```
apps/
  api/                    `@ourdiu/api`: Hono REST API + auth + queue handlers (a library, run by apps/web)
    src/
      app.ts              App composition (middleware, routes, OpenAPI docs)
      routes/             HTTP layer: route definitions + validation only
      services/           Business logic (DB + R2), called by routes
      db/schema/          Drizzle tables  → `pnpm db:generate` → migrations/
      lib/                auth, errors, AI and PDF processor clients
      middleware/         per-request context, requireAuth, rate limits
    migrations/           SQL migrations (generated by drizzle-kit, applied by wrangler)
    openapi.json          The OpenAPI document (`pnpm openapi`); the app's client is generated from it
    test/                 Integration tests running in workerd
  mobile/                 Flutter app for Android and iOS (see "Mobile app")
  web/                    The Worker (wrangler.jsonc: bindings for D1, R2, Queues, rate limits)
    workers/app.ts        Worker entry: /api/* to @ourdiu/api, pages to React Router, queues to @ourdiu/api
    app/routes/           Pages (loaders/actions run on the server)
    app/components/       UI components (ui/ = shadcn/ui)
    app/lib/              *.server.ts = server-only helpers
    e2e/                  Playwright tests (against the dev server)
packages/
  shared/                 Zod schemas, types and constants shared by all clients
docs/
  PLAN.md                 The project plan
```

## Getting started

Prerequisites: Node.js 22.22+ (see `.nvmrc`) and pnpm 11 (`corepack enable`).

```bash
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # then set BETTER_AUTH_SECRET and the Google OAuth client
pnpm db:migrate                                    # create tables in the local D1 database
pnpm db:seed                                       # sample departments, courses, questions + PDFs
pnpm dev                                           # http://localhost:5173
```

Google sign-in needs an OAuth client (Google Cloud Console → APIs & Services → Credentials → "Web application") with the redirect URI `http://localhost:5173/api/auth/callback/google`; `.dev.vars.example` has the details. Put your own email in `ADMIN_EMAILS` before you first log in to get the admin panel, or run `pnpm make-admin you@example.com` afterwards (`--remote` for production).

API docs are at http://localhost:5173/api/docs. Everything (D1, R2, Queues, secrets) runs locally through Wrangler/Miniflare; local data lives in `apps/web/.wrangler/state`.

## Common commands

| Command            | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `pnpm dev`         | Run the site (pages + API) locally                                    |
| `pnpm check`       | Lint + format check + typecheck + unit/integration tests              |
| `pnpm test`        | Unit and integration tests for every package                          |
| `pnpm test:e2e`    | Playwright end-to-end tests (needs `pnpm db:migrate && pnpm db:seed`) |
| `pnpm db:generate` | Generate a SQL migration after changing `apps/api/src/db/schema`      |
| `pnpm db:migrate`  | Apply pending migrations to the local D1 database                     |
| `pnpm db:seed`     | Reset local data to the sample set, with an admin login               |
| `pnpm make-admin`  | Give an existing account the admin role (`<email> [--remote]`)        |
| `pnpm openapi`     | Write the API's OpenAPI document to `apps/api/openapi.json`           |
| `pnpm format`      | Format the codebase with Prettier                                     |

## Mobile app

`apps/mobile` is a Flutter app (Android and iOS; package `com.ourdiu.app` on Android, "OurDIU" on Google Play, bundle ID `com.diuqbank.app` on iOS) using Riverpod and go_router. It has four tabs (Home, Browse, Saved, Account) and a full-screen PDF reader, designed in Material 3 Expressive on the site's indigo; see `apps/mobile/README.md` for the design system. It isn't part of the pnpm workspace (it has no `package.json`), and Prettier and ESLint skip it; Dart's own tools format and lint it.

- **Icon and splash:** the OurDIU mark (the design system's scalloped shape with the website's graduation cap, on indigo) is drawn as SVG by `tool/brand/render.mjs` (run with Node from the repo root; it uses the web app's Playwright) into `assets/brand/` and `store/icon-512.png` (Play's listing icon). `flutter_launcher_icons.yaml` and `flutter_native_splash.yaml` turn them into the Android and iOS files.
- **Flutter version:** pinned in `apps/mobile/.fvmrc` ([FVM](https://fvm.app)); CI reads it from there too.
- **API client:** `lib/api/generated` is generated from `apps/api/openapi.json` by [swagger_parser](https://pub.dev/packages/swagger_parser) (Dio + Retrofit + json_serializable) and committed. Admin and sitemap endpoints are left out (`swagger_parser.yaml`). Class names come from the `.meta({ id })` names on the Zod schemas in `packages/shared`, so give every object schema a public endpoint returns a name there; otherwise the generator invents one, and unnamed objects that share a property name (e.g. `department`) can overwrite each other's class.
- **When the API changes:** run `pnpm openapi`, then `apps/mobile/tool/generate_api.sh`, and commit both. The API tests fail while `openapi.json` is stale, and the Mobile workflow fails while the Dart client is.
- **Compatibility:** installed app versions stay around for months, so `/api/v1` only changes in backward-compatible ways (new fields and endpoints). Anything breaking goes in a new version.
- **Running it:** `flutter run` from `apps/mobile` talks to the production API, which is still diuqbank.com until the cutover (docs/PLAN.md); `apiBaseUrl` then moves to `https://ourdiu.com`. For a local dev server, add `--dart-define=API_BASE_URL=http://10.0.2.2:5173` (Android emulator) or `http://localhost:5173` (iOS simulator).
- **Sign-in:** Google's account picker on the phone (Credential Manager, `google_sign_in`) gives an ID token for the site's web OAuth client (`googleServerClientId` in `lib/auth/session.dart`). The app posts it to `/api/auth/sign-in/social`, keeps the session token from the `set-auth-token` header in secure storage, and sends it as `Authorization: Bearer …` (Better Auth's `bearer` plugin) to the routes that act as the user (`needsSession` in `lib/api/api.dart`); public reads stay anonymous. Google only issues the token to builds whose signing certificate is registered: an Android OAuth client in the same Google Cloud project as the web client, with package `com.ourdiu.app` and the SHA-1 of each signing key (the local debug key, the upload key, and Play's app signing key from Play Console → App integrity: `6F:83:97:5F:55:BC:FD:A0:EE:2C:6D:87:0B:87:E3:EA:5F:CE:10:3C`). Without Play's key, sign-in works in local builds but fails on builds installed from Play. As on the site, any Google account can sign in, and sharing papers needs a DIU email. iOS sign-in isn't set up yet.
- **Sharing papers:** signed-in users scan a paper with Android's ML Kit document scanner (it makes the PDF) or pick one, fill in the same details as the site's upload form, and upload to `POST /api/v1/submissions`. They then land on the paper's page, which polls `/api/v1/me/submissions/{id}` while the AI check runs and offers the same next steps as `/questions/my-submissions/{id}` on the site (use the AI's details, edit, withdraw).

### Releasing the Android app

Pushing a tag `mobile-vMAJOR.MINOR.PATCH` on a commit that's on `main` runs `.github/workflows/release-android.yml`. It builds an App Bundle signed with the upload key and uploads it to Google Play. The version name comes from the tag, and the version code is `MAJOR*1000000 + MINOR*1000 + PATCH`, so every release needs a higher tag:

```bash
git tag mobile-v1.6.0 origin/main && git push origin mobile-v1.6.0
```

The app was released from the QuestionBank repository up to `mobile-v1.5.0`; tags here must continue above it, or Play rejects the version code.

Builds go to the closed testing track (`alpha`) as `completed` releases, so once Google has reviewed one (usually within hours) the testers get it as an update from the Play Store. Their "What's new" text is the tag's message, so prefer an annotated tag; a lightweight tag uses the subjects of the app's commits since the last release instead:

```bash
git tag -a mobile-v1.7.0 origin/main -m "Saved papers sync with ourdiu.com" -m "• Contributors and their profiles" && git push origin mobile-v1.7.0
```

To release somewhere else, set the repository variables `PLAY_TRACK` (`internal`, `alpha`, `beta`, `production`) and `PLAY_RELEASE_STATUS` (`completed`, `draft`, `inProgress`). Each run also keeps the `.aab` as a workflow artifact for 30 days.

The Play Console account is a personal one, so production needs a closed test first: at least 12 testers opted in for 14 days in a row, who actually use the app, before you can apply for production access. Until then, release to the internal and closed tracks.

Question Bank links on `ourdiu.com` open in the app (Android App Links): the manifest claims `https://ourdiu.com/questions…` with `autoVerify`, `lib/router.dart` (`webLinkLocation`) maps the site's paths to the app's screens, and the site serves `/.well-known/assetlinks.json` with the SHA-256 of Google's **app signing key** (`ANDROID_SIGNING_SHA256` in `apps/web/app/lib/android-app.ts`, from Play Console → App integrity → App signing). Play Console's Deep links page shows whether verification passed.

Locally, `flutter build appbundle` signs with the upload key if `android/key.properties` exists (git-ignored; same keys as the workflow writes), and with the debug key otherwise. Debug-signed builds can't be uploaded to Play.

One-time setup:

1. **Play Console.** Create the app (its package name, `com.ourdiu.app`, is fixed by the first upload) and keep Play App Signing on (the default): Google keeps the key that signs what users install, and our key is only an _upload_ key, which Google can reset if it's lost.
2. **Upload key.** Create it once and keep the file and password in a password manager (`keytool` comes with Android Studio, in `Contents/jbr/Contents/Home/bin`):
   ```bash
   keytool -genkeypair -v -keystore upload-keystore.jks -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   Then store it in a GitHub environment named `play` (Settings → Environments → New environment). Under "Deployment branches and tags", allow only tags matching `mobile-v*`:
   ```bash
   base64 -i upload-keystore.jks | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 --env play
   gh secret set ANDROID_UPLOAD_KEYSTORE_PASSWORD --env play
   ```
3. **Google Cloud: a service account that GitHub Actions can use without a key file.** In a Google Cloud project (the one already set up for the QuestionBank repository), with `gcloud`:
   ```bash
   PROJECT_ID=your-project-id
   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')
   gcloud services enable androidpublisher.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT_ID"
   gcloud iam service-accounts create play-publisher --project "$PROJECT_ID" --display-name "Google Play publisher (GitHub Actions)"
   gcloud iam workload-identity-pools create github --project "$PROJECT_ID" --location global --display-name "GitHub Actions"
   # Only this repository's release job (the play environment, on a mobile-v* tag) can sign in.
   gcloud iam workload-identity-pools providers create-oidc diuqbank --project "$PROJECT_ID" --location global \
     --workload-identity-pool github --issuer-uri "https://token.actions.githubusercontent.com" \
     --attribute-mapping "google.subject=assertion.sub,attribute.repository_id=assertion.repository_id" \
     --attribute-condition "assertion.repository_id == '817495452' && assertion.environment == 'play' && assertion.ref.startsWith('refs/tags/mobile-v')"
   gcloud iam service-accounts add-iam-policy-binding "play-publisher@$PROJECT_ID.iam.gserviceaccount.com" --project "$PROJECT_ID" \
     --role roles/iam.workloadIdentityUser \
     --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository_id/817495452"
   ```
   Releases from this repository use the Google Cloud project `ourdiu` (number `279664469023`), with the provider named `ourdiu` instead of `diuqbank` and this repository's ID, `1398723748` (`gh api repos/SourovCodes/OurDIU --jq .id`), instead of `817495452` (the QuestionBank repository, which used the `diuquestionbank` project).
4. **GitHub variables** (Settings → Secrets and variables → Actions → Variables): `GCP_WORKLOAD_IDENTITY_PROVIDER` = `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/diuqbank` and `GCP_SERVICE_ACCOUNT` = `play-publisher@<PROJECT_ID>.iam.gserviceaccount.com`.
5. **Play Console access for the service account.** Users and permissions → Invite new users → the service account's email. Give it access to the app with "Release apps to testing tracks" (add "Release to production…" once the app has production access).
6. **Release.** Push a `mobile-v*` tag above the last one (`mobile-v1.5.0`, from the QuestionBank repository). Releases arrive as drafts on the internal track: roll them out in Play Console (Testing → Internal testing). Once Google has reviewed the app, set `PLAY_RELEASE_STATUS` to `completed` so internal releases go out without that step.

## Testing strategy

- **`packages/shared`** – unit tests for schemas.
- **`apps/api`** – integration tests call the API inside `workerd` (using `apps/web/wrangler.jsonc`) with isolated per-file D1 and R2 storage (`@cloudflare/vitest-plugin`). Migrations are applied automatically.
- **`apps/web`** – unit/component tests with Vitest + Testing Library; Playwright covers full user journeys against the dev server.
- **`apps/mobile`** – widget tests (`flutter test`) with the API providers overridden.
- **CI** is one workflow, `.github/workflows/ci.yml`. A first job looks at what the push or PR changed: site code (anything outside `apps/mobile` that isn't Markdown) runs lint, typecheck, tests, build and e2e; the Flutter app or `apps/api/openapi.json` runs the mobile jobs (stale-client check, `dart format`, `flutter analyze`, `flutter test`, an Android debug build, and an unsigned iOS build on macOS). Pushes to `main` that change site code deploy once its checks pass; mobile-only and docs-only changes don't. The final `CI` job passes when every job that ran passed, so it's the only check to require in branch protection. Running the workflow by hand (Actions → CI → Run workflow) runs everything, and deploys from `main`. Android releases have their own workflow, triggered by tags (see "Releasing the Android app"). Dependabot opens weekly, grouped update PRs for npm, pub (the Flutter app) and GitHub Actions.

## Deploying

CI (`.github/workflows/ci.yml`) deploys `main` once the checks pass: it applies D1 migrations, then builds and deploys the Worker (`ourdiu`) with the `SITE_URL` and `FILES_URL` repository variables. Requests on any other host (`www.`, workers.dev, `diuqbank.com`) are redirected to `SITE_URL` (`canonicalHostRedirect` in `app/lib/redirect.ts`).

The Worker has its own resources: D1 `ourdiu`, R2 `ourdiu-files`, the queues `questions-analysis` and `questions-watermark`, and rate-limit namespaces 2001–2004. diuqbank.com keeps running on its own Worker until a one-time cutover copies its data here and redirects the domain: see "Cutover" in [docs/PLAN.md](docs/PLAN.md).

- **Secrets** (`wrangler secret put <NAME> --name ourdiu`, set by the owner): `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `COMPRESSOR_API_KEY`, and optionally `ADMIN_EMAILS`.
- **GitHub**: secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts, D1, R2 and Queues edit) and `CLOUDFLARE_ACCOUNT_ID`; variables `SITE_URL=https://ourdiu.com` (deploys are skipped until it's set) and `FILES_URL` (the R2 bucket's public custom domain).
- **Google Cloud**: the OAuth client has `https://ourdiu.com` as an authorised origin and `https://ourdiu.com/api/auth/callback/google` as a redirect URI.
- **Domains**: `ourdiu.com` and `www.ourdiu.com` (and, after the cutover, `diuqbank.com` and `www.diuqbank.com`) are custom domains of the `ourdiu` Worker, attached in the dashboard. `wrangler.jsonc` has no `routes`, so deploys leave them alone.
