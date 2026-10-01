# OurDIU – project plan

The plan and the decisions behind it, kept in the repository so anyone (or any Claude session) picking the project up knows what exists, what comes next and why. Update it when a decision changes or a step is done. `CLAUDE.md` has the day-to-day working rules; `README.md` the architecture and setup.

Last updated: 2 October 2026.

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
2. **One account system for everything.** Better Auth, Google sign-in only. Any Google account can sign in (decided 1 October 2026; before that, new accounts needed a DIU address). Contributing question papers needs a DIU address (`@diu.edu.bd`, `@s.diu.edu.bd`) or the admin role (`canContribute` in `@ourdiu/shared`; `requireContributor` on the API). Addresses in the `ADMIN_EMAILS` secret are made admins when they sign up.
3. **The products are not interconnected.** They share accounts, departments and the look, nothing else: no product shows another's data. Each has its own tables (prefixed with its name, except the question bank's, which keep their existing names, see below), its own services and API namespace, its own admin section.
4. **Presentation: "option C", separate spaces.** `ourdiu.com` only asks "What do you need?" (and offers to continue where you left off). Each product is a space with its own header/menu, colour and (in the app) its own bottom tabs. A switcher next to the product name moves between spaces. Question bank users arriving from diuqbank.com land straight in their space; a dismissible banner (web) or one-time hint (app) tells them about the routine.
5. **Mobile app: one Flutter app, Material 3 (Expressive), on Android and iOS.** It's the existing OurDIU app (`com.ourdiu.app`, today in `../QuestionBank/apps/mobile`), extended with the spaces and the switcher. Its design system (indigo `#4F39F6`, Roboto Flex `expressive()` headings, the exam-type shapes) stays. iOS gets Material too, with only platform behaviours (back swipe, scrolling physics, dialogs) adapted. A full Cupertino design was mocked up and rejected: twice the design work for a mostly-Android audience.
6. **Space colours**: Question Bank indigo `#4F39F6`, Class Routine teal (`#006B5B` / container `#B9F0E3`), Marketplace rose.
7. **The question bank keeps its API paths** (`/api/v1/questions`, `/submissions`, `/contributors`, `/taxonomy`, `/me`, …) instead of moving under `/api/v1/questions/…`: the published app calls them, and installed copies keep calling them for months. Its tables keep their names (`questions`, `submissions`, `courses`, …) so the production database can be adopted as is. New products follow the prefix rules.
8. **The routine is rebuilt from scratch** (not ported from `../better-routine-scrapper`), CSE only at first, from the university's PDF (e.g. [CSE routine v3.1](https://webbackend.daffodilvarsity.edu.bd/noticeFile/cse-class-routine-v31-f4f0af7da9.pdf)).

Design mockups (website, Material app, and the rejected iOS style): <https://claude.ai/artifact/RfDHeYL7wiGdBDo2QqKokQ>. The website redesign that brings it up to the app (approved 2 October 2026): <https://claude.ai/artifact/Mh2DpngKUFRop8H1UQ7Vnj>.

9. **The website follows the app's design** (decided 2 October 2026). Same palette (indigo with tinted greys, the exam-type colours), Roboto Flex `font-expressive` headings over Inter, the exam badges (`ExamBadge`, shapes from `apps/mobile/lib/theme/exam_shape.dart`), search first, and the app's department → course → semester path. Pages: `/questions/departments/:id` (courses A–Z) and `/questions/courses/:id` (exams by semester, exam-type filter, "same course, other names").

## Roadmap

### Phase 0 – Platform (done)

- [x] Monorepo in the question bank's style: React Router SSR + Hono API in one Worker, D1 + Drizzle, R2, Better Auth (Google + bearer for the app), shadcn/ui, Zod contracts, Vitest in workerd, Playwright.
- [x] Hub page, `/routine` and `/market` "coming soon" pages, account page, admin panel (users, departments), privacy and terms.
- [x] Deployed: Worker `ourdiu` on `ourdiu.com` (+ `www` → apex), D1 `ourdiu`, R2 `ourdiu-files`, CI deploys `main` after checks and e2e pass.

### Phase 1 – Question bank moves in (done, 1 October 2026)

Done: the question bank runs on ourdiu.com, and diuqbank.com redirects there (its `/api/*` still serves installed apps). Locally, `apps/web/.dev.vars` uses the question bank's secrets (Gemini and compressor keys).

- [x] The question bank's API, schema, migrations (its `0000`–`0006` replace this repo's old `0000_init`), shared schemas, tests and web pages, renamed `@qb/*` → `@ourdiu/*`. `ADMIN_EMAILS` kept. The platform's separate `departments` admin page went away: the question bank's catalog manages departments.
- [x] Pages under the product path: `/questions` (the space's home), `/questions/browse`, `/questions/:id`, `/questions/contributors[/:username]`, `/questions/contribute`, `/questions/my-submissions[/:id]`. `/account` is the shared profile. Admin: `/admin` (dashboard, question bank numbers for now), `/admin/questions/{submissions,reports,catalog}`, `/admin/users`; the sidebar has a group per product plus "Platform".
- [x] Per-space header with the product switcher (`components/product-switcher.tsx`); the hub at `/` is the chooser; routine and market are "coming soon".
- [x] Legal, about, contact, copyright, cookies and delete-account pages say OurDIU; `LEGAL_UPDATED` = 1 October 2026. The contact address stays the question bank's (`AUTHOR.email` in `app/lib/author.ts`). The theme cookie is now `ourdiu_theme`.
- [x] diuqbank.com redirects (`legacyPath` in `app/lib/redirect.ts`): `/` → `/questions`, `/questions` → `/questions/browse`, `/contributors/*` → `/questions/contributors/*`, `/contribute` → `/questions/contribute`, `/account/submissions*` → `/questions/my-submissions*`; `/api/*` is served unchanged.
- [x] `pnpm check` green (202 API, 124 web, 53 shared tests), 60 e2e tests green, OpenAPI regenerated.
- [x] Per-space colours on the web: `data-space` on `<body>` sets the space's `--primary` (`app.css`).
- [ ] Not done yet: the one-time "Class Routine is new" banner in the question bank space (mockup).

Cutover (done 1 October 2026, by hand with the owner). The data is **copied** from diuqbank.com into OurDIU's own resources, then the domain is redirected. `apps/web/wrangler.jsonc` names OurDIU's resources: D1 `ourdiu`, R2 `ourdiu-files`, queues `questions-analysis` / `questions-watermark`, rate-limit namespaces 2001–2004 (1001–1004 are diuqbank's).

Decided 1 October 2026: the app's Google sign-in moves to the `ourdiu` Google Cloud project at the same time, and the DIUQBank repository (already public; history checked for secrets, only placeholders found) is archived afterwards.

Preparation (nothing visible to users):

1. [x] Database `ourdiu-db` (`6fa31581-db1e-4c60-9e8d-202818bc3030`) created and named in `wrangler.jsonc`; the first `ourdiu` database (placeholder site only) is retired later. Queues `questions-analysis` and `questions-watermark` created.
2. [x] Server accepts Google ID tokens from the `ourdiu` client (`GOOGLE_CLIENT_ID`) and the old `diuquestionbank` one (`GOOGLE_EXTRA_CLIENT_IDS` in `wrangler.jsonc`), also on diuqbank.com (tests in `app-auth.test.ts`). The app's `apiBaseUrl` is `https://ourdiu.com` and its links use the new paths.
3. [x] Owner, Google Cloud (`ourdiu`): Android OAuth clients for `com.ourdiu.app`, one per signing certificate SHA-1: the local debug key (`CA:EB:5D:97:4C:64:31:A8:B6:21:9C:40:E3:B5:15:6C:D9:E6:8E:61`), the upload key, and Play's app signing key (Play Console → App integrity). The app's `googleServerClientId` is now the `ourdiu` web client (`279664469023-dgh2duvok7122vagev2f5llbl4ugctmg`).
4. [x] Owner, Cloudflare: custom domain `files.ourdiu.com` on R2 `ourdiu-files`; GitHub variable `FILES_URL=https://files.ourdiu.com`.
5. [x] Owner: secrets on the `ourdiu` Worker with the question bank's values (`BETTER_AUTH_SECRET`, `GEMINI_API_KEY`, `COMPRESSOR_API_KEY`); `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` stay the `ourdiu` client's.

The switch (done; only 2 page views on diuqbank.com fell between the export and the domain move. Notes: the export had to be reordered to tables, then indexes, then rows parent-first, then triggers, because D1 applies a big file in several transactions and the composite foreign key on `questions` needs its unique index first. Original instructions, at a quiet time: anything uploaded, voted or signed up on diuqbank.com between steps 7 and 10 is lost):

6. Copy the files: a temporary Worker (`ourdiu-r2-copy`, bindings to both buckets, guarded by a random token) copies every object of `questionbank-papers` into `ourdiu-files`, skipping ones already copied. Run it once ahead, again after step 7.
7. Copy the database: `wrangler d1 export questionbank --remote --output questionbank.sql`, then `wrangler d1 execute ourdiu-db --remote --file questionbank.sql`. The export carries the schema, triggers and `d1_migrations`, so the migrations are then already applied.
8. Copy the files again (only the new ones).
9. Deploy the `ourdiu` Worker from the `question-bank` branch: `wrangler deploy --var SITE_URL:https://ourdiu.com --var FILES_URL:https://files.ourdiu.com` (from `apps/web`).
10. Move the `diuqbank.com` and `www.diuqbank.com` custom domains from the `questionbank` Worker to `ourdiu` (dashboard → Workers → Domains). Pages 301 to ourdiu.com, `/api/*` keeps serving installed apps.
11. Merge `question-bank` into `main` (CI deploys the same code; nothing to migrate).
12. Check: sign-in on the site and in the old and new app, an upload (AI check, watermark), a download, a diuqbank.com link. Delete the copy Worker.
13. Archive DIUQBank on GitHub. In Play Console, point the privacy policy and delete-account URLs at ourdiu.com; release the app (`mobile-v1.6.0`).
14. Status: steps 6–12 done (copy Worker deleted); DIUQBank archived. `www.diuqbank.com` is on the `ourdiu` Worker. App `mobile-v1.6.0` (version code 1006000: OurDIU name, switcher, icon and splash, ourdiu.com, `ourdiu` sign-in) was built and uploaded to Play's internal track as a draft by the new `play-publisher@ourdiu` account. Left: roll it out in Play Console, check sign-in on the Play build, and point the Play listing's privacy and delete-account URLs at ourdiu.com.
15. Later: retire the `questionbank` Worker, D1, R2 (and `r2.diuqbank.com`) and `qb-*` queues, and the `ourdiu` placeholder database, once nothing needs them.

### Design overhaul: website and app as one (started 2 October 2026, branch `web-redesign`, PR #1)

The owner asked for a very thoughtful UI/UX across the whole public website (not the admin panel) and the app, matching each other: Material 3 Expressive, the app's palette, Roboto Flex everywhere, exam shapes and colours, tonal surfaces instead of borders. Reference mockups: <https://claude.ai/artifact/Mh2DpngKUFRop8H1UQ7Vnj> (approved; the owner prefers its department and course pages) and the earlier QuestionBank web redesign (home, browse, paper). The owner allowed API changes or a v2 where they help.

Phases (tick as they land):

- [x] W1 foundation: tokens (`surface-*`, `primary-container`, exam colours), `font-expressive` / `font-display-xl`, shadcn components reshaped (pill buttons, 28px dialogs/sheets, outlined fields, tonal cards), header (Browse, All papers, Contributors, search, saved, "Share a paper"), three-column footer.
- [x] W1 Question Bank: home (exam-coloured "Most viewed" tiles, department tiles, two calls to action), Browse (department tiles), department and course pages (as in the approved mockup), All papers, paper page (save, share, "N copies of this exam", "Was this paper useful?", phone bottom bar), course search.
- [x] W1 Saved papers synced to the account: `saved_questions` (0007), `/api/v1/me/saved` (GET, PUT/DELETE `/{id}`, POST bulk), `saved` in interactions; web Saved page and bookmark.
- [x] W2 hub (product tiles in each space's colours, as the app's chooser), coming-soon pages, contributors (podium + rows), contributor profile, login.
- [x] W2 contribute flow (like the app's upload: file card, pickers, exam chips, "this exam already has N papers"), my submissions and a submission's status (status hero, timeline, AI comparison), account page, about, contact, legal pages, `/app`, 404/error, delete-account.
- [x] W3 web polish (first pass): phone and dark-mode pass on the main pages; header and paper bar fixed for narrow phones; e2e updated for the new names.
- [ ] W3 still to do: motion and loading placeholders across pages, an accessibility pass, admin pages untouched by design (they share the restyled components).
- [x] A1 app: saved papers synced with the account (merge the phone's list on sign-in), contributors and contributor screens, course page "This course" / "Same course, other names", paper reader wording ("N copies of this exam", "Was this paper useful?", share), anything the website now does better.
- [x] A2 app: department letters, course screen and Home checked on the emulator against the local server; `flutter analyze` and 60 tests green.
- [ ] Release: the app needs a new `mobile-v*` tag for synced saved papers and contributors; the website ships when PR #1 merges; CI's deploy applies migration 0007 (a new `saved_questions` table, nothing else changes).

### Phase 2 – One app

- [x] Moved `../QuestionBank/apps/mobile` into `apps/mobile` here, with its release workflow and CI jobs (analyze, test, Android and iOS builds, generated-client check). Unchanged otherwise: it still says QuestionBank and calls diuqbank.com. App work happens here from now on; `../QuestionBank/apps/mobile` is frozen.
- [x] Releasing from this repository: Google Cloud project `ourdiu` (number `279664469023`) has the service account `play-publisher@ourdiu.iam.gserviceaccount.com` and the workload identity pool `github` with provider `ourdiu`, trusting only this repository (`1398723748`) in the `play` environment on `mobile-v*` tags. The GitHub variables `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_SERVICE_ACCOUNT` and the `play` environment (tags `mobile-v*` only) are set. The QuestionBank project (`diuquestionbank`) is no longer used for releases.
- [x] Owner: add `ANDROID_UPLOAD_KEYSTORE_BASE64` and `ANDROID_UPLOAD_KEYSTORE_PASSWORD` to the `play` environment; in Play Console (owned by a friend of the owner, who is also an owner of the `ourdiu` Google Cloud project) invite `play-publisher@ourdiu.iam.gserviceaccount.com` with "Release apps to testing tracks" and remove `play-publisher@diuquestionbank.iam.gserviceaccount.com`. Tags continue above `mobile-v1.5.0`.
- [x] Spaces (`apps/mobile/lib/spaces/`): first-launch chooser ("What do you need?"), then the app reopens in the space used last (`space` in shared preferences); "Question Bank ▾" on Home opens the switcher (bottom sheet); Class Routine (teal) and Marketplace (rose) are "coming soon" screens without the question bank's tabs. Visible names say OurDIU (app title, iOS display name, Account links, feedback subject).
- [x] App icon (adaptive, with an Android 13 themed version) and splash (light and dark, with the OurDIU wordmark) replace Flutter's defaults; `store/icon-512.png` is the new Play listing icon.
- [x] Play listing material says OurDIU: `store/listing.md` (text to paste), `store/icon-512.png`, `store/feature-graphic.png`, and screenshots (new Home, plus `08-products.png`, the chooser).
- [ ] Owner: paste the listing into Play Console and upload the icon, feature graphic and screenshots.
- [ ] The one-time "your class routine is here too" hint, once the routine is live.
- [x] `apiBaseUrl` → `https://ourdiu.com`; links to `ourdiu.com/questions/…` (released in `mobile-v1.6.0`).
- [x] Sign-in on Play builds: the `ourdiu` project's Android OAuth client has Play's app signing SHA-1 (`6F:83:97:5F:55:BC:FD:A0:EE:2C:6D:87:0B:87:E3:EA:5F:CE:10:3C`), added by the owner on 1 October 2026. `mobile-v1.6.1`: any Google account signs in, sharing papers needs a DIU email.
- [ ] Closed testing ("alpha"), then production. Play needs 12 testers opted in for 14 days in a row before a production release. Testers are the Google Group `ourdiu@googlegroups.com` (set to "Anyone on the web can join", posting by owners only). The site recruits them: `/app` (join the group, opt in at `play.google.com/apps/testing/com.ourdiu.app`, install), a dismissible banner for Android visitors on the hub and the Question Bank home, and a line on the account page. When the app is public, set `ANDROID_BETA` to false in `apps/web/app/lib/android-app.ts`: the banner and the link go, and `/app` becomes a "Get it on Google Play" page.

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
