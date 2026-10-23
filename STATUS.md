# Clipwise — build status

Repo: https://github.com/irfan0374/Clipwise (public). Updated before every commit and push. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-10-23

## Now

**Step E — Editing (Feature 10)** · Planning

## Next up

**Step F — Render and download · Library** (Features 11, 12).

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
| D | 9 Storyboard with silent preview | ✅ | (this commit) | Storyboard + Generating rebuilt to match Stitch exactly: icon rail, scene frame grid from real animation stills, timing bar, Mark as OK, click a frame for the in-browser player |
| E | 10 Editing | 🛠 | | Optimistic locking with `expectedVersion` |
| F | 11 Render and download · 12 Library | ⏳ | | |
| G | 13 Limits and settings · 14 Admin | ⏳ | | |
| H | 15 Polish and Sentry · 16 Deploy and private beta | ⏳ | | GitHub repo ready |

### v1 (regrouped later)

| # | Feature | Status |
| --- | --- | --- |
| 17 | Brand kit | ⏳ |
| 18 | Instagram, scheduling and calendar | ⏳ |
| 19 | Stripe billing | ⏳ |

## Decisions log

| Date | Decision |
| --- | --- |
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
- Sidebar user and usage meter show placeholder values until sign-in (Feature 5) and limits (Feature 13).
- Make yourself admin: create your account in the app, then run `pnpm user:admin you@example.com`.
- Hosting at launch (step H): Railway needs a card after its trial; pick a worker host and storage that fit the no-card preference.
