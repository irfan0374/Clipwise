# Clipwise — build status

Repo: https://github.com/irfan0374/Clipwise (public). Updated before every commit and push. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-10-26

## Now

**Steps F + G complete and approved.** User authorized updating status, committing and pushing on 2026-10-26. This checkpoint includes render/download/library, settings/allowances/admin, and their QA fixes. Validation: 180 passing tests, lint, typechecks, production build and browser QA.

## Next up

Prepare the **Step H — polish, Sentry, deployment and private beta** plan: accessibility/error-state pass, monitoring and deployment configuration, hosting/storage decisions, staging smoke test and beta checklist. Step H development has not started.

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
| H | 15 Polish and Sentry · 16 Deploy and private beta | ⏳ | | GitHub repo ready |

### v1 (regrouped later)

| # | Feature | Status |
| --- | --- | --- |
| 17 | Brand kit | ⏳ |
| 18 | Instagram, scheduling and calendar | ⏳ |
| 19 | Stripe billing | ⏳ |

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
- Review Step G settings/admin screens before the Git checkpoint. Step H monitoring and deployment are still pending.
- Make yourself admin: create your account in the app, then run `pnpm user:admin you@example.com`.
- Hosting at launch (step H): Railway needs a card after its trial; pick a worker host and storage that fit the no-card preference.
