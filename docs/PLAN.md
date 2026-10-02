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
10. **Platform pages keep the visitor's space** (2 October 2026). Account, about, contact, legal, login and missing pages show the header of the space the visitor was last in (the `ourdiu_space` cookie, `useSpace`); "Back to …" links and logging out lead to that space's home, not the hub. The hub itself belongs to no space.
11. **Two page widths** (2 October 2026): browsing pages (lists, papers, courses, departments) use the full container; single-purpose pages (account, about, contact, legal, login, `/app`) share `NARROW_PAGE` (`max-w-4xl`, centred).
12. **Android releases go straight to testers** (2 October 2026): a `mobile-v*` tag uploads to the closed testing track (`alpha`) as a completed release, so testers get it from the Play Store once Google approves it; the tag's message becomes "What's new". `PLAY_TRACK` / `PLAY_RELEASE_STATUS` repository variables override this.
13. **ourdiu.com links open in the app** (Android App Links, 2 October 2026): only `https://ourdiu.com/questions…` (not `www`, which redirects and so can't be verified). The site serves `/.well-known/assetlinks.json` with the fingerprints Play Console generates for the app (the app signing key first; not the upload key); `webLinkLocation` in `apps/mobile/lib/router.dart` maps the site's paths to the app's screens.
14. **Public PDFs are stamped as well as credited** (2 October 2026): the watermark job uses the PDF processor's `credit-watermark-compress` endpoint: the credit line on top of every page as before, plus the site's domain (`ourdiu.com`) stamped faintly at random positions and angles. Admins remake every copy with **Redo all watermarks** (`POST /api/v1/admin/submissions/watermark/all`).
15. **Everything clickable shows the hand cursor and a visible hover** (2 October 2026). Tailwind 4 gives buttons the arrow, so a base rule in `app.css` gives the hand to enabled buttons, menu items, options, tabs and similar controls (cmdk's `data-disabled="false"` counts as enabled). Hover, focus and open states use Material's state layer, the text colour at 8% (`--state-layer`) laid over the element's own surface with the `state-layer` utility (`hover:state-layer`, `focus:state-layer`, `data-[highlighted]:state-layer`, …), instead of swapping to a fixed colour: those matched the surface they sat on (menus were invisible in dark mode, where `popover` equals `accent`; cards changed by a contrast of 1.06 in light mode). The tint is a plain token, not `color-mix(currentColor …)`, whose compiled fallback for older browsers would paint the element solid. Filled buttons keep their own hover; outline buttons hover at 12% primary.
16. **e2e tests run beside `pnpm dev`** (2 October 2026): on port 5174 (`e2e/env.ts`) with their own local D1 and R2 in `.wrangler/e2e-state`, which `e2e/prepare-state.mjs` wipes, migrates and seeds before every run. They no longer need `pnpm dev` stopped or the dev database seeded, and no longer leave test records in it.
17. **Reviews are a conversation** (2 October 2026). Besides publishing and rejecting, an admin can **ask for changes** (status `changes_requested`, shown as "Needs changes"): the paper goes back to its uploader, who can edit its details, replace its file and reply, then **resubmits** it to the review queue. Every message and step (requested, edited, file replaced, resubmitted, published, rejected, back to review) is kept in `submission_messages` with the paper, and removed with it. Uploaders see admins as "Reviewer". Rejecting stays the final "no" (it now suggests asking for changes instead). A paper that ever had changes asked for is never auto-published by the AI check: the admin asked to see it again. Counters: `questions.pending_review_count` counts `changes_requested` too (migration 0011); `submissions.uploader_unread` / `admin_unread` drive the "new messages" badges. Notices are on the site only for now (header dot and "N papers need you", the list's banner and badges); email can come later.
18. **Search: keep "DIU Question Bank"** (2 October 2026). diuqbank.com's last 16 months in Search Console: 142K clicks, ~72% from the one query "diu question bank" (102K clicks, position 1), then "question bank diu", "diu question bank cse" / "swe", "diu qbank", "diuqbank"; ~95% of clicks landed on the home page. "OurDIU" is one word to Google, so it doesn't match "diu": the question bank's titles, headings and text say **DIU Question Bank** (`QB_NAME` in `app/lib/seo.ts`) and the Question Bank home says "formerly DIU QBank (diuqbank.com)" for searches of the old name, department pages are titled "DIU CSE Question Bank", course and paper pages lead with the course name ("… previous questions", "… Final Question, Summer 25"). Every page gets a canonical URL (filters and tracking dropped, `?page=` kept), Open Graph tags and `public/og.png` (drawn by `apps/web/tool/og-image.mjs`) for links shared in Facebook groups; the hub has WebSite JSON-LD (alternate names "DIU Question Bank", "DIU QBank", "diuqbank"), department, course and paper pages BreadcrumbList. The sitemap lists course pages too. Routes set titles through `pageMeta`.
19. **The move is told, for search and AI answers** (2 October 2026). `/diuqbank` says what became of diuqbank.com: when, where each page is now, why OurDIU, what stays the same, and an FAQ, written as plain facts that AI overviews and assistants can quote, with FAQPage JSON-LD. It sits at the root, not under `/questions`, because the Android app opens `/questions/*` links (decision 13); `productAt` still puts it in the question bank's space (`PRODUCT_PAGES`). The Question Bank home ("formerly diuqbank.com") and /about link to it. `/llms.txt` (llmstxt.org) describes the site in Markdown with live numbers, departments, the top courses and the same FAQ; all of it comes from `app/lib/move.ts`. The hub's WebSite JSON-LD names its publisher (`AUTHOR`). AI crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) are not blocked; keep it that way in Cloudflare (AI Crawl Control) and robots.txt.

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

### Design overhaul: website and app as one (done, 2 October 2026; PRs #1–#3)

The owner asked for a very thoughtful UI/UX across the whole public website (not the admin panel) and the app, matching each other: Material 3 Expressive, the app's palette, Roboto Flex everywhere, exam shapes and colours, tonal surfaces instead of borders. Reference mockups: <https://claude.ai/artifact/Mh2DpngKUFRop8H1UQ7Vnj> (approved; the owner prefers its department and course pages) and the earlier QuestionBank web redesign (home, browse, paper). The owner allowed API changes or a v2 where they help.

Phases (tick as they land):

- [x] W1 foundation: tokens (`surface-*`, `primary-container`, exam colours), `font-expressive` / `font-display-xl`, shadcn components reshaped (pill buttons, 28px dialogs/sheets, outlined fields, tonal cards), header (Browse, All papers, Contributors, search, saved, "Share a paper"), three-column footer.
- [x] W1 Question Bank: home (exam-coloured "Most viewed" tiles, department tiles, two calls to action), Browse (department tiles), department and course pages (as in the approved mockup), All papers, paper page (save, share, "N copies of this exam", "Was this paper useful?", phone bottom bar), course search.
- [x] W1 Saved papers synced to the account: `saved_questions` (0007), `/api/v1/me/saved` (GET, PUT/DELETE `/{id}`, POST bulk), `saved` in interactions; web Saved page and bookmark.
- [x] W2 hub (product tiles in each space's colours, as the app's chooser), coming-soon pages, contributors (podium + rows), contributor profile, login.
- [x] W2 contribute flow (like the app's upload: file card, pickers, exam chips, "this exam already has N papers"), my submissions and a submission's status (status hero, timeline, AI comparison), account page, about, contact, legal pages, `/app`, 404/error, delete-account.
- [x] W3 web polish (first pass): phone and dark-mode pass on the main pages; header and paper bar fixed for narrow phones; e2e updated for the new names.
- [x] W3 motion and accessibility: pages rise in after navigation and fade back while the next loads (`PageTransition`), a paper-shaped PDF placeholder, save and vote pop; skip link, route announcements, focus moved to the new page, a focus ring for links, axe-clean public pages in light and dark.
- [x] W4 review pass: login keeps the space it returns to and says why; hub led by the live product; the Android invitation decided on the server (no layout shift); Question Bank home shows your saved papers and your department first; Browse has the search; courses show their paper counts (`courses.published_count`, migrations 0008–0009, also in the app); "exams" and "papers" used consistently; tonal empty states.
- [x] Admin panel in the same style: navigation-drawer sidebar, dashboard tiles in the exam colours, tonal tables led by exam badges, tonal alerts, pill toggles; narrow screens fold the status column into the row.
- [x] Platform pages remember the last space (`ourdiu_space` cookie): header, 404 and error pages, logging out; single-purpose pages share `NARROW_PAGE`.
- [x] A1 app: saved papers synced with the account (merge the phone's list on sign-in), contributors and contributor screens, course page "This course" / "Same course, other names", paper reader wording ("N copies of this exam", "Was this paper useful?", share), anything the website now does better.
- [x] A2 app: department letters, course screen and Home checked on the emulator against the local server; `flutter analyze` and 60 tests green.
- [x] Released: PR #1 merged and deployed (CI applied migrations 0007–0009 to production: `saved_questions`; `courses.published_count`, backfilled, with its triggers); `mobile-v1.7.0` (synced saved papers, contributors, course and reader changes) went to closed testing and was approved.
- [x] A3 app review on the emulator (PR #2): papers could load forever (the PDF engine is now started at launch, `pdfrxFlutterInitialize`), and a paper that fails to load says so with "Try again"; the Course → CourseListItem rename had leaked "CourseListItem" into the search hint and upload labels in 1.7.0 (fixed); search results show paper counts; the last department opened leads Browse and Home's chips; Home has "Jump back in" (recent courses) and one exam per course under "Recently added"; Browse has a search pill and course counts; the course screen ends with "Missing a semester?"; Account's sign-in copy updated (uploading is here, both DIU domains).
- [x] App Links (PRs #2–#3, decision 13): manifest filter with `autoVerify`, `webLinkLocation`, `assetlinks.json`; a paper opened from a link goes back to Home. Google's Digital Asset Links check returns `linked: true`; Play Console's Deep links page shows `/questions` on ourdiu.com as "Deep linked" ("All links working") for 1.7.1, and ourdiu.com is added as a domain there (website association created; its Web URLs report fills in as Google crawls).
- [x] Released `mobile-v1.7.1` (version code 1007001) to closed testing, approved on 2 October 2026.
- [x] Watermark stamps (decision 14): deployed, and the owner ran **Redo all watermarks** in production (2 October 2026), so existing papers get the stamps too.
- [x] Hand cursor and visible hovers (PR #6, decision 15): audited the 16 public pages in both themes (414 measured elements now 1.16–1.24 contrast on hover, none weaker); new links and brand marks got hover states; e2e check the cursor (including a course picker option) and the tint on a card and a switcher item in light and dark.
- [x] e2e isolated from `pnpm dev` (PRs #6–#7, decision 16). Two flaky tests fixed: the contributors test and the vote test each matched two links or buttons (a paper's contributor is linked twice; the paper page has both vote areas, one hidden by CSS), so they now look in one place. CI dropped its migrate and seed steps. The local dev database was cleaned of the records earlier runs left (70 test users, 12 papers, 4 "E2E Proposed" courses, and seed papers marked "watermark failed").
- [x] Branches tidied: `question-bank` (merged at the cutover) and the merged PR branches deleted; `main` is the only branch.
- [x] CI kept green: e2e follow the new pages (Browse opens the department tiles, the search pill's wording, the review timeline, exam-type chips that are real radio inputs); the page transition no longer mismatches on hydration; the rate-limit test avoids the local limiter's minute boundary.

### Review conversations (2 October 2026, decision 17)

- [x] API: `changes_requested` status and `submission_messages` (migrations 0010–0011); `PATCH /admin/submissions/{id}` asks for changes (reason required) and records every decision; `POST /admin/submissions/{id}/messages`; `POST /me/submissions/{id}/messages`, `/resubmit`, `PUT /me/submissions/{id}/file`; details editable while pending or waiting for changes; `GET /me/review-activity` for the badge; `MESSAGE_LIMITER` (namespace 2005, 10 a minute) on messages and resubmits, uploads' limiter on file replacements. Integration tests in `apps/api/test/review.test.ts`.
- [x] Website: "Request changes" (presets in `CHANGE_REQUEST_PRESETS`) on the review page and in the list's row menu, a "Needs changes" tab, "New reply" badges, the conversation under the PDF; for the uploader, the "reviewer asked for changes" card (Edit details, Replace file, Resubmit), the messages, a banner and tab on My submissions, and a dot on the account menu. Privacy page updated. e2e: the whole loop in `admin.spec.ts`.
- [x] App's generated client regenerated (the old app shows a paper waiting for changes as "Waiting for review" and can't edit it there).
- [x] Website and API released (PR #8, 2 October 2026; CI applied migrations 0010–0011 to production).
- [x] App mockups approved (<https://claude.ai/artifact/QL4ymgNWGPLG98uYZu87w3>) and built: a "Needs changes" stage in the website's sky blue (`ExamColors.changes`), the paper screen's "Needs your changes" hero quoting the request with Replace file and Edit details, "Resubmit for review", the newest messages on the paper and a Messages screen (`/account/papers/:id/messages`), Replace file and Resubmit sheets, a banner and filter on My papers, "N new" on paper rows, and a count on the Account tab (refreshed when the app comes back to the foreground). Widget tests in `test/review_flow_test.dart`.
- [x] Released in `mobile-v1.8.0` (version code 1008000) to closed testing on 2 October 2026, with the scanner fix (PR #10: R8 stripped ML Kit, so "Scan the paper" failed in Play builds since at least 1.7.1; keep rules in `android/app/proguard-rules.pro`).
- [ ] Later, if wanted: push notifications (Firebase Cloud Messaging) when a reviewer writes.
- [ ] Later, if wanted: email the uploader when a reviewer asks for changes or writes (Cloudflare Email Sending; legal pages to update).

### Search after the move (decision 18)

Done (2 October 2026): Change of Address from diuqbank.com to ourdiu.com is filed in Search Console, every diuqbank.com page 301s to its new path, and ourdiu.com's sitemap is submitted (2,070 pages read). Google still showed diuqbank.com for "diu question bank" that day, as expected in the first weeks.

- [x] Titles, descriptions and on-page text say "DIU Question Bank"; canonical, Open Graph and breadcrumb tags; course pages in the sitemap.
- [x] `/diuqbank` page, `/llms.txt`, FAQ and publisher JSON-LD (decision 19).
- [ ] Owner, after the deploy: in Search Console (ourdiu.com) inspect `https://ourdiu.com/diuqbank` and `https://ourdiu.com/questions` and **Request indexing**; check Rich Results Test on `/questions/<id>` (breadcrumbs) and `/diuqbank` (FAQ). Share `/diuqbank` once in the DIU Facebook groups where diuqbank.com links were posted.
- [ ] Watch for 4–8 weeks: Search Console → ourdiu.com → Performance, query "diu question bank" should move to `ourdiu.com/questions` at position 1. Keep diuqbank.com's domain, redirects and Search Console property for at least a year (Google's advice for moves).
- [ ] Old links from before the current site (cuid ids like `/questions/cm9r…`, 489 such pages, about 1K clicks in 16 months, and `mirror.diuqbank.com`) end at a 404. Small; only worth mapping if the old ids can be matched to papers.
- [ ] Ideas with demand in the data: admission test questions ("daffodil university admission test sample question pdf" and similar, ~2K impressions at positions 2–5 without a page for them); course-name searches (each course page is the landing page; text of the papers on the page, e.g. from the AI analysis, would let individual questions be found); class routine searches for the Routine launch; asking DIU clubs and department pages to link to ourdiu.com/questions instead of diuqbank.com.

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
- [x] Releases go to closed testing (`alpha`) automatically with "What's new" from the tag (decision 12). `mobile-v1.7.0` and `mobile-v1.7.1` shipped this way on 2 October 2026. Play App Signing key SHA-256: `86:51:83:0A:15:06:D3:72:70:63:2D:BE:A3:19:46:0C:58:C0:F2:CD:33:4C:61:C6:09:13:1D:79:86:26:45:C4`; upload key: `44:06:4D:E0:1C:F8:FC:37:28:70:7E:C1:9E:98:66:AE:9E:3A:85:E5:09:D0:46:17:72:0B:03:12:1A:B2:96:67`.
- [x] ourdiu.com links open in the app (decision 13), verified in Play Console.
- [ ] Closed testing ("alpha"), then production. Play needs 12 testers opted in for 14 days in a row before a production release. Testers are the Google Group `ourdiu@googlegroups.com` (set to "Anyone on the web can join", posting by owners only). The site recruits them: `/app` (join the group, opt in at `play.google.com/apps/testing/com.ourdiu.app`, install), a strip under the header on every page for every visitor (computers too: their owners likely have Android phones), closed for good once dismissed (`ourdiu_android_invite`, 400 days), a line on the account and contribute pages and "Get the app" in the footer, and a once-a-visit toast when an Android visitor downloads a paper. When the app is public, set `ANDROID_BETA` to false in `apps/web/app/lib/android-app.ts`: the strip and the links go, and `/app` becomes a "Get it on Google Play" page.

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
