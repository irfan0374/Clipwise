# Clipwise — build status

Repo: https://github.com/irfan0374/Clipwise (public). Updated before every commit and push. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-10-30

## Now

**Step H4 (staging test) passed on 2026-10-29** — a real video was made on the staging website end to end (see "Step H4 validation"). Before that: **Step H1–H3 complete and approved** (polish, Sentry, deploy setup). User approved committing and pushing on 2026-10-28, after a real video was made end to end on the Mac worker with this code (voice 31.3s, 252 credits; render 31.8s). Validation: 187 passing tests, lint, typechecks, production build, browser QA, accessibility pass, backup/restore test and a tested worker Docker image.

**Code review of H1–H4 (2026-10-30), 3 fixes, not committed yet:** (1) the web app now checks `REDIS_NAMESPACE` and the `MONGODB_URI` database against `NEXT_PUBLIC_CLIPWISE_ENV` on every server start and reports a mismatch (log + Sentry); the worker uses the same shared check (`environmentProblems` in `@clipwise/shared`). (2) The shared Gemini/ElevenLabs budget counters are now one part per environment, added up on every check; a worker restoring its part after Redis lost data raises it to what MongoDB recorded and can no longer forget the other environment's spending. (3) Live progress: a tab closed while the stream is still connecting is cleaned up at once, and a second page for the same video waits until the subscription is in place. Validation: 195 passing tests, lint, typechecks, production build.

## Next up

**Step H5 — go live (private beta).** Staging passed (H4). Next: a limited live MongoDB user, a live R2 bucket and token, `.env.live`, Vercel Production settings, owner admin on live, first backup, invite steps.

## Build plan

Legend: ✅ done · 🔍 in review · 🛠 building · ⏳ not started. Small features are merged into steps (decided 2026-10-23).

### Done

| # | Feature | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 0 | Prototype baseline | ✅ | `64f7db9` | Pipeline, 9 visual types, fact-check, CLI, design docs |
| 1 | Project setup | ✅ | `ce4623c` | apps/web, apps/worker, packages/shared, Biome, `pnpm dev` / `pnpm check` |
| 2 | Database and shared schemas | ✅ | `261315b` | packages/db (7 MVP collections), enums + job schemas in shared, `db:*` scripts, seed data |
| 3 | App shell and design system | ✅ | `53e393a` | Tailwind v4 + shadcn/ui, tokens, Sora/Inter, sidebar + mobile menu, `/design` style tile |

### To private beta

| Step | Features | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| A | 4 Homepage · 5 Sign-in (email + password) | ✅ | `d4bca16` | Front door: GSAP/Lenis homepage, Better Auth email + password, open sign-up, workspace on first sign-up |
| B | 6 Worker, queue and storage | ✅ | `62021df` | BullMQ + local Redis, storage interface (local folder now), jobs script→factcheck→voice→render, budgets, crash recovery |
| C | 7 Create screen · 8 Live progress and fact-check job | ✅ | `9b2f2ca` | Create + Generating screens, live updates (SSE), formats, ideas, cancel/retry, per-user limits |
| D | 9 Storyboard with silent preview | ✅ | `6a949ff` | Storyboard + Generating rebuilt to match Stitch exactly: icon rail, scene frame grid from real animation stills, timing bar, Mark as OK, click a frame for the in-browser player |
| E | 10 Editing | ✅ QA complete | `2188ec8` | Stitch Studio Editor: scene list, live preview, Script/Visual inspector, fact-check strip. Autosave, undo/redo + history, add/delete/reorder, AI rewrite, re-check of edited scenes, rename, conflict banner |
| F | 11 Render and download · 12 Library | ✅ approved | F + G checkpoint | Final-render action, safe voice reuse/retry, playback/download, version labels, searchable/filterable list/grid library; combined E + F QA passed |
| G | 13 Limits and settings · 14 Admin | ✅ approved | F + G checkpoint | Defaults/account/usage settings; admin queues, users, running/failed pipelines, suspension/reset/retry and audit; 180 tests + production build passed |
| H | 15 Polish and Sentry · 16 Deploy and private beta | 🔨 H1–H4 done · H5 next | | Vercel (web) · worker on the owner's Mac · Redis Cloud · Backblaze B2 · Sentry; staging + live |

### v1 (regrouped later)

| # | Feature | Status |
| --- | --- | --- |
| 17 | Brand kit | ⏳ |
| 18 | Instagram, scheduling and calendar | ⏳ |
| 19 | Stripe billing | ⏳ |

## Step H plan

Hosting (chosen 2026-10-28): web on **Vercel free** (Preview deployments = staging, Production = live) · worker on **the owner's Mac** (it only connects outward, so no server or tunnel is needed) · **Redis Cloud free** (30 MB, one database, separate `REDIS_NAMESPACE` for staging and live) · **MongoDB Atlas M0** (`clipwise_staging` and `clipwise`) · **Backblaze B2** for files (one bucket per environment) · **Sentry free**. Nothing here needs a card.

1. **H1 Polish:** error, not-found and loading screens for every app page; accessibility pass (keyboard, focus, labels, contrast); worker heartbeat every 30s, with a "Rendering is paused right now" message on Create and Render and an offline badge in Admin when the worker is off; security headers; check that no server values reach the browser.
2. **H2 Sentry:** errors from pages, server actions and API routes (web) and from failed jobs (worker, tagged with the video id). No passwords, scripts or keys are sent. One test error proves each side works.
3. **H3 Deploy setup:** Vercel project settings for the monorepo; live-progress stream (SSE) made safe for Vercel's time limit (the browser reconnects on its own); worker Docker image with Chrome and fonts for a later move to a server; `pnpm worker:staging` / `pnpm worker:live` on the Mac, each with its own env file; `design/deploy.md` listing every setting by name (never values); a MongoDB backup script (M0 has no backups).
4. **H4 Staging test:** deploy to staging and run one real video end to end (Create → Storyboard → Edit → Render → Download), plus sign-up, sign-in, admin and phone layouts. Expected cost: about 3 Gemini requests and 500–1,000 ElevenLabs credits (reported exactly).
5. **H5 Beta checklist:** promote to live, make the owner admin, confirm beta limits, ElevenLabs paid plan (owner), final secrets check before the push, invite steps for the first users.

Owner actions (accounts and keys are never entered by Claude): create the Vercel, Redis Cloud, Backblaze B2 and Sentry accounts and put each key straight into Vercel or the Mac's env files, following `design/deploy.md`.

## Step H4 validation — 2026-10-29

- Staging is online: https://clipwise-git-staging-irfaans-projects.vercel.app (Vercel Preview of branch `staging`, region `iad1`, protected by Vercel Authentication — only the owner can open it).
- Services connected and tested without showing any value: Redis Cloud free (AWS us-east-1, Redis 8.6, no TLS on the free plan), MongoDB `clipwise_staging` on the existing Atlas cluster (indexes created), Cloudflare R2 bucket `clipwise` (upload, download, signed link, private bucket, delete), staging worker on the Mac (`pnpm worker:staging`). 23 settings copied to Vercel from `.env.staging` through the Vercel CLI (7 stored as secrets; a new sign-in secret generated directly).
- Owner signed up on staging and was made admin. One real video end to end on staging: script (5 scenes, 73 words after one automatic shortening) → fact-check (6 claims, none to fix) → voice (29.7s, 236 ElevenLabs credits) → render (30.2s, 11.4 MB in R2). The owner played and downloaded it; Admin showed "Worker online". Website: 0 errors.
- Found on the way: Atlas blocked the Mac after its internet address changed (fixed with `0.0.0.0/0`, needed for Vercel anyway); the Redis address was pasted with the `redis-cli -u` prefix; the Vercel CLI added `.env*` to `.gitignore` (removed). Recorded in `design/deploy.md`.
- Redis eviction policy set to `noeviction` by the owner (confirmed from Redis; the BullMQ warning is gone). Redis Cloud drops connections now and then (`ECONNRESET`); connections and queues now log one short line instead of raw stack traces, and reconnect as before.
- Open: staging uses the owner's Atlas admin login and an R2 token that can see all buckets — live gets limited ones.

## Step H validation — 2026-10-28

- `pnpm check`: lint, all typechecks and **187 tests passed** (7 new: privacy filter for error reports, live-progress event reading, worker heartbeat, staging/live key namespacing, one shared Redis listener connection). Production build passed.
- Browser QA on a separate dev server (port 3005) with a temporary test user: "Video making is paused" notice on Create and while a video waits, gone when the worker is online; Admin shows Worker online / offline · last seen; 404 pages (unknown page, wrong video id); error screens; security headers present, `X-Powered-By` removed.
- Accessibility pass on Create, Videos, Storyboard, Editor, Settings, Admin, Sign-in and Home: every button, link and field has a name, every image has alt text, one main heading per page, no skipped heading levels, all 59 focusable items in the editor show a focus ring. Fixed: a second main heading inside the video's title scene, the "Add Scene" heading level, and an unnamed play button on the home page.
- Backup/restore tested on an in-memory database only: ids, exact dates, large numbers and binary data come back unchanged; restore refuses a database with data (without `--replace`) and the live database (without `--production`).
- Secrets check: no `.env` file other than `.env.example` in the changes; no key values in the changed files or the browser bundle (only setting *names* inside the sign-in library).
- Test user, its workspace, sessions and 2 copied videos removed from `clipwise_dev` (database rows only; no stored files touched); temporary scripts, QA build folder and the local heartbeat key removed.
- Worker Docker image built and tested (2.1 GB): no env files, backups or `.git` inside; runs as user `node`; the built-in sample video (600 frames) renders in Chrome inside the container in about 13s with correct fonts and icons; the worker starts as staging against a temporary database and an empty Redis database, sends its heartbeat under `staging:`, refuses a wrong Redis namespace or database name, and stops cleanly (exit 0, marked offline at once) on `docker stop`. Fixed during this test: the image now starts the worker directly (pnpm re-downloaded packages on every start and kept the stop signal from the worker), and Linux uses Remotion's headless Chrome (Chrome for Testing, needed on macOS 26, has no Linux ARM build). Test image, container, temporary database and Redis test keys removed.
- Not tested: Sentry with real DSNs (needs the owner's Sentry projects, H4).

## Step F plan

- Connect the Storyboard and Editor render buttons to an owner-checked, version-aware final-render action. Duplicate requests must not create duplicate voice charges or jobs; flush pending edits before rendering.
- Reuse voice and alignment only when valid for the chosen script and voice. Reuse the existing worker rendering pipeline and provider budget guards.
- Show voice/render progress, actionable failures and safe retry; keep the completed MP4 tied to the version it rendered so later edits are clearly distinguished.
- Add the video-ready view with playback, file details and an authorized download link using the current storage interface.
- Replace the library placeholder with workspace-scoped videos, thumbnails, status filters, search, pagination and links back to each project. Include loading, empty and error states; match the approved Stitch screens.
- After Step F is built, perform combined code review and manual QA for Steps E + F: edit/autosave/history, stale versions, fact-check updates, render double clicks/retries, playback/download authorization and library filtering. Use fixtures and mocks for provider tests to conserve credits; record any real provider usage.
- Run the required automated checks and production build as part of that validation, fix findings, then update this file with results before the next commit/push.

## Step E + F validation — 2026-10-26

- `pnpm check`: passed lint, all workspace typechecks, and **163 tests**.
- `NEXT_DIST_DIR=.next-check pnpm --filter @clipwise/web build`: passed production compilation, TypeScript and route generation.
- Combined code review completed; fixes include preserving drafts on failed saves, keeping history after failed undo/redo, version-aware renders, missing-file recovery, final retries ignoring background re-check runs, consistent date formatting and client-mounted Remotion UI.
- Manual browser QA passed editing/autosave, invalid-edit render blocking, undo/redo/history restore, scene add/delete, editor and storyboard pointer dragging, keyboard reordering, persistence after reload, fact-check acknowledgement, multi-tab conflict handling, render/retry, MP4 playback/download, old-render version labels, library search/filter/pagination/list/grid and desktop/mobile layouts.
- Two real local MP4 renders used cached fixture audio. Playback metadata: 1080 × 1920, 30.87 seconds. The downloaded MP4 checksum matched the stored file. **No external Gemini or ElevenLabs requests or credits used.** Live-provider generation was intentionally not retested.
- QA used temporary MongoDB and Redis database 14, separate local storage and port 3001. Preview stays available while that temporary QA process is running. Detailed record: `design/qa-step-e-f.md`.

## Step G scope — implemented

1. Settings: save workspace name and default format, length and voice; apply those defaults when opening Create.
2. Allowances: show the user's beta usage and reset times; reconcile the existing create/AI-edit/final-render limits and retry behaviour. Provider keys, global spending ceilings and costs stay internal.
3. Admin dashboard: user/workspace list, running/failed jobs and queue health, with searchable details.
4. Admin controls: retry eligible failed jobs, pause/resume new processing, suspend/reactivate workspaces, and the agreed beta password-reset workflow. Enforce admin access on every server operation and record administrative changes.
5. Validate settings persistence, default selection, limit boundaries/reset times, ordinary-user access denial, suspension and admin controls using isolated fixtures before user review.

## Step G validation — 2026-10-26

- `pnpm check`: lint, all workspace typechecks and **180 tests passed**. Production build passed with `NEXT_DIST_DIR=.next-check pnpm --filter @clipwise/web build`; `git diff --check` passed.
- Added 17 regression tests for settings ownership/validation, every admin action's role checks, admin route denial, audit success/failure, suspension/reactivation, credential hashing/session revocation with a mocked auth adapter, fresh roles on existing sessions, workspace search/pagination, UTC daily refunds, Monday weekly allowances, failed retry reservation recovery, and suspension before queued AI/voice work.
- Browser QA passed saved defaults → Create (Story, 30s, Jessica), persistence after reload, account/usage pages, admin search/empty results, pause/resume with audit, suspension/reactivation, suspended sign-in screen, run report, and ordinary-user admin 404/navigation hiding. Desktop 1440px and mobile 390px layouts inspected; no mobile page overflow.
- Password reset form inspected without entering a replacement credential. Hash/update/session-revocation behavior was validated with the mocked adapter; no real account password was changed. No external Gemini or ElevenLabs requests or credits used.
- QA used temporary MongoDB, Redis database 13, separate local storage, `.next-qa-g` and port 3002. Normal application data was not used. The preview is temporary while its harness runs. Detailed record: `design/qa-step-g.md`.
- Suspension blocks subsequent workspace requests and provider calls; a request already in progress may finish. Existing signed storage URLs retain their original expiry (up to one hour); suspension prevents issuing new links.

## Decisions log

| Date | Decision |
| --- | --- |
| 2026-10-29 | Every Redis connection and BullMQ queue has an error listener (one short line per 30s per source): cloud Redis resets connections now and then and ioredis/BullMQ reconnect by themselves. The subscriber test counts only its own connection |
| 2026-10-29 | H4 passed on staging. File storage: Cloudflare R2 instead of Backblaze B2 (owner's Cloudflare account already has payment set up; R2 downloads are free). Redis Cloud free kept for the beta without TLS (only ids and progress numbers pass through it). Staging reuses the owner's Atlas login (owner's choice); live gets a limited user |
| 2026-10-28 | User approved H1–H3; committed and pushed. H4 waits for the owner's accounts |
| 2026-10-28 | H1–H3 built: Redis keys and BullMQ queues are prefixed by `REDIS_NAMESPACE` (`staging:` / `live:`), except the Gemini/ElevenLabs budget counters, which stay shared because the free quotas are shared; the worker refuses to start if its namespace or database name belongs to another environment |
| 2026-10-28 | One Redis listener connection per process for live progress (Redis Cloud free allows 30 connections); the progress stream closes itself after 270s and the browser reconnects (Vercel limit 300s) |
| 2026-10-28 | Sentry v11: all personal data collection switched off (`dataCollection`), and reports are scrubbed of user, request, emails and anything named like a key/token/password before sending. Only a job's last failed attempt is reported; paused/forbidden are not errors |
| 2026-10-28 | Rendering uses Chrome for Testing on macOS (the headless shell crashes on macOS 26) and Remotion's headless shell on Linux (Docker image); the image starts the worker with tsx directly, not through pnpm |
| 2026-10-28 | Worker heartbeat every 30s (online = seen in the last 90s); the app shows "Video making is paused right now" instead of failing when the Mac is off |
| 2026-10-28 | Step H hosting chosen: Vercel free for the web app, the worker runs on the owner's Mac during the private beta (moves to a server later via the Docker image), Redis Cloud free (Upstash rejected: BullMQ's constant polling uses up its command allowance), Backblaze B2 storage, Sentry free, separate staging and live |
| 2026-10-26 | User approved updating STATUS.md, committing and pushing the completed F + G checkpoint. Changes share queue/render/auth files, so both steps are recorded together. Step H remains a planning task, not started. |
| 2026-10-26 | Step G built after user approval. Roles are refreshed from stored account metadata per request; workspace suspension is enforced in web routes/actions, queue admission and worker/provider guards. Admin changes have pending/ok/failed audit records without passwords or secrets. F + G remain uncommitted pending review. |
| 2026-10-26 | Completed combined Step E + F code review and QA. Scene reordering uses shared pointer capture for mouse/touch plus keyboard arrows; Remotion studio mounts client-side to avoid animation-style hydration differences. Step F is awaiting user review, not committed or pushed. |
| 2026-10-24 | User approved updating STATUS.md and committing/pushing Step E now. Combined code review and manual QA for Steps E + F are deferred until Step F is complete. Step E checkpoint does not mean that joint QA has passed. |
| 2026-10-23 | Sign-in is email + password (Google OAuth dropped: needed a card). Open sign-up, no invites/waitlist, no emails in beta (admin resets passwords), per-IP sign-up limit 5/h |
| 2026-10-23 | Storage: local folder in dev behind an S3-compatible interface; cloud provider chosen at deploy (R2 needs a card; Backblaze B2 doesn't) |
| 2026-10-23 | Redis: local via Homebrew for dev; cloud Redis chosen at deploy (Upstash free tier, no card) |
| 2026-10-23 | Pipeline logic split into storage-free steps (packages/pipeline/src/steps.ts) shared by CLI and worker |
| 2026-10-23 | Script writer aims for the top of the word budget; a too-short/long script is handed back with per-scene counts to edit (not redone). Fact-check replies are read leniently (renamed fields, partial claims) |
| 2026-10-23 | Review fixes: budgets are reserved atomically before every Gemini request and every ElevenLabs take (worker guards), each paid take is recorded at once; render retries finish a saved render; the voice step never rewrites the script (one speed correction 0.8–1.2x only) |
| 2026-10-23 | Admins are made only with `pnpm user:admin you@example.com` (needs database access); sign-up never grants admin. ADMIN_EMAILS removed |
| 2026-10-23 | Formats change the script (structure, tone, call to action); Auto length = 30s for promo/tips/quote, 60s for explainer/story/recap |
| 2026-10-23 | Beta limits per user: 10 new videos/day, 2 in progress, 30 idea suggestions/day (env LIMIT_*) |
| 2026-10-23 | Script rules relaxed: scene range 3–6 (30s) / 5–9 (60s), word floor 80%, 4 attempts, hook/cta/length fields repaired instead of rejected; if only the length is off, the closest attempt is kept |
| 2026-10-23 | QA/review fixes: promo product claims are checked only against the creator's brief (no web search) and promos are never labelled "Fact-checked" ("Check product details"); quote videos must say the saying word for word; unreadable fact-check claims show as "to review"; job IDs include the run (retries really run); budget rebuild never overwrites live counters; per-workspace lock for the running-videos limit; CLI uses the shared budgets |
| 2026-10-23 | App screens copy the Stitch designs exactly. Controls for features not built yet are shown disabled with a "Coming soon" tooltip; the Storyboard uses Stitch's 64px icon rail and opens the player in a popup when a frame is clicked; Lucide icons stand in for Material Symbols |
| 2026-10-23 | Storyboard preview plays in the browser (Remotion Player + Thumbnail) from the same composition the renderer uses; no preview MP4 is rendered |
| 2026-10-23 | Small features may be merged with neighbours into one build step (user preference) |
| 2026-10-23 | Build feature by feature; one commit per approved feature; STATUS.md updated before each commit and push |
| 2026-10-23 | Editing: every edit is saved with the version the page last saw (`expectedVersion`); a different version is refused ("This video changed. Reload"). Typing autosaves ~1s after the user stops. Each edit is a new script version, so undo/redo and history restore old versions |
| 2026-10-23 | Edited scenes are re-checked automatically: they go to `factcheck.pendingScenes` and a delayed `recheck` job (4s, one per version) checks only those scenes; an older job stops before calling Gemini. A failed re-check never fails the video: the scene gets a "couldn't be checked" note to review |
| 2026-10-23 | AI rewrite / AI scene runs in the web server action (one Gemini call, same budget guards as the worker), limit 30 per user per day (`LIMIT_AI_EDITS_PER_DAY`). A video keeps 3–10 scenes while editing; the hook stays first |
| 2026-10-23 | Biome for lint + format (not ESLint + Prettier). `noNonNullAssertion` off (works with strict index typing); array-index keys and SVG titles allowed in video frames |
| 2026-10-23 | TypeScript 7 kept — verified with Next.js 16.4 build |
| 2026-10-23 | MongoDB Atlas M0 connected. Databases: `clipwise_dev` (local), `clipwise_staging`, `clipwise` (production; seed refuses it) |
| 2026-10-23 | Enums live once in `@clipwise/shared` (Zod + Mongoose); visual enums stay in `@clipwise/video` |
| 2026-10-23 | `workspaces.stripeCustomerId` unique index is partial (strings only), not sparse — sparse would block a second workspace with `null` |
| 2026-10-23 | DB tests use mongodb-memory-server (in-memory, no Atlas needed) |
| 2026-10-23 | UI: Tailwind v4 + shadcn/ui (Radix base). Light only; `dark:` bound to a `.dark` class so the OS dark setting doesn't leak in |
| 2026-10-23 | Mobile: top bar + menu button opens the sidebar. Calendar and Brand kit shown greyed with "Soon" |
| 2026-10-23 | `/design` style tile is dev-only (404 in production) |
| 2026-10-23 | Next.js 16 changed APIs: read `node_modules/next/dist/docs/` before writing Next code (see `apps/web/AGENTS.md`) |

## Open items

- ElevenLabs free plan is non-commercial — upgrade before real users (Feature 16).
- Make yourself admin: create your account in the app, then run `pnpm user:admin you@example.com`.
- Redis Cloud free plan has no TLS and 5 GB traffic/month — upgrade before a wider launch.
- While the worker runs on the Mac, videos are only made while the Mac is on and awake. Move it to a server (Railway or a VPS, needs a card) before a wider launch.
