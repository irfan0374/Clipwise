# Clipwise — build status

Updated before every commit. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-10-23

## Now

**Step B — Worker, queue and R2** · Planning

## Next up

**Step C — Make a video**: Create screen + live progress and fact-check job.

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
| A | 4 Homepage · 5 Sign-in (email + password) | ✅ | (this commit) | Front door: GSAP/Lenis homepage, Better Auth email + password, open sign-up, workspace on first sign-up |
| B | 6 Worker, queue and R2 | 🛠 | | BullMQ + Redis, Cloudflare R2 |
| C | 7 Create screen · 8 Live progress and fact-check job | ⏳ | | SSE |
| D | 9 Storyboard with silent preview | ⏳ | | |
| E | 10 Editing | ⏳ | | Optimistic locking with `expectedVersion` |
| F | 11 Render and download · 12 Library | ⏳ | | |
| G | 13 Limits and settings · 14 Admin | ⏳ | | |
| H | 15 Polish and Sentry · 16 Deploy and private beta | ⏳ | | Needs a GitHub repo |

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
- No GitHub remote yet — needed by Feature 16 (deploy). Commits are local until then.
