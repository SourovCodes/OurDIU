# OurDIU – project plan

The plan and the decisions behind it, kept in the repository so anyone (or any Claude session) picking the project up knows what exists, what comes next and why. Update it when a decision changes or a step is done. `CLAUDE.md` has the day-to-day working rules; `README.md` the architecture and setup.

Last updated: 1 October 2026.

## What OurDIU is

[ourdiu.com](https://ourdiu.com) is one home for Daffodil International University (DIU) student tools, on the web and in one mobile app:

| Product       | Path         | Status                                                                                       |
| ------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Question Bank | `/questions` | Live today at [diuqbank.com](https://diuqbank.com) (repo `../QuestionBank`); moving here now |
| Class Routine | `/routine`   | "Coming soon" placeholder; to be built from scratch after the question bank                  |
| Marketplace   | `/market`    | "Coming soon" placeholder; later                                                             |

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

### Phase 1 – Question bank moves in (in progress)

Code, on the branch `question-bank` (not `main`: a push to `main` deploys, and the code needs the question bank's database, see the cutover):

- [ ] Bring in the question bank's API, schema, migrations (its `0000`–`0006` replace this repo's `0000_init`), shared schemas, tests, and its web pages, renamed `@qb/*` → `@ourdiu/*`.
- [ ] Pages move under the product path: `/questions` (browse, the space's home), `/questions/:id`, `/questions/contributors`, `/questions/contributors/:username`, `/questions/contribute`, `/questions/my-submissions` (+ `/:id`). Account (profile) stays at `/account`, shared. Admin: `/admin/questions/{submissions,reports,catalog}` plus a dashboard; users stay platform-wide.
- [ ] The question bank space has its own header (switcher, "Question Bank", Browse / Contributors / My submissions, Contribute), per the mockup; the hub stays a chooser; routine and market remain "coming soon".
- [ ] Legal pages merge (the question bank collects more: uploads, votes, reports, views, AI analysis); `/about`, `/contact`, `/copyright`, `/cookies`, `/delete-account` come along.
- [ ] Old diuqbank.com paths map to the new ones (`canonicalHostRedirect` / a redirect table): `/` → `/questions`, `/contributors/*` → `/questions/contributors/*`, `/contribute` → `/questions/contribute`, `/account/submissions*` → `/questions/my-submissions*`; `/api/*` is served on diuqbank.com unchanged (old app versions).
- [ ] `pnpm check` and e2e green; OpenAPI regenerated.

Cutover (production, done by hand with the owner, never by CI on its own):

1. Point `apps/web/wrangler.jsonc` at the question bank's production resources instead of copying data: D1 `questionbank` (`ad50a07f-3aed-4006-9974-78df2b9bcfc6`, already has migrations `0000`–`0006`), R2 `questionbank-papers`, the `qb-*` queues and rate limits, `FILES_URL`, `PDF_PROCESSOR_URL`, `GEMINI_MODEL`. The empty `ourdiu` D1 and `ourdiu-files` R2 are then retired.
2. Secrets on the `ourdiu` Worker (the owner runs these): `GEMINI_API_KEY`, `COMPRESSOR_API_KEY`, and `BETTER_AUTH_SECRET` equal to the question bank's, so existing web sessions and the app's bearer tokens stay valid.
3. Google sign-in: the installed app sends ID tokens issued for the question bank's OAuth client. Either use that client for ourdiu.com (add `https://ourdiu.com` and its callback to it), or accept both client IDs. Decide before cutover.
4. Move the `diuqbank.com` custom domain from the `questionbank` Worker to `ourdiu`; pages 301 to ourdiu.com, `/api/*` keeps working. Then retire the `questionbank` Worker and archive `../QuestionBank`.
5. Re-run `ADMIN_EMAILS` / `pnpm make-admin --remote` for the owner if needed.

### Phase 2 – One app

- [ ] Move `../QuestionBank/apps/mobile` into `apps/mobile` here (with its release workflow, `mobile-vX.Y.Z` tags).
- [ ] Add the spaces: first-launch chooser, switcher (bottom sheet) on the product name, the question bank space with today's tabs (Home, Browse, Saved, Account), routine and market spaces showing "coming soon". One-time hint about the routine.
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
- Contact address on the legal pages: sourovcodes@gmail.com.
