# Clipwise — build status

Updated before every commit. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-10-23

## Now

**Next feature** · Planning

## Next up

**Feature 4 — Homepage with the waitlist**: port design/homepage (GSAP + Lenis) into Next.js; waitlist form saves to `invites`.

## Build plan

Legend: ✅ done · 🔍 in review · 🛠 building · ⏳ not started

### Phase A — Foundation

| # | Feature | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 0 | Prototype baseline | ✅ | `64f7db9` | Pipeline, 9 visual types, fact-check, CLI, design docs |
| 1 | Project setup | ✅ | `ce4623c` | apps/web, apps/worker, packages/shared, Biome, `pnpm dev` / `pnpm check` |
| 2 | Database and shared schemas | ✅ | `261315b` | packages/db (7 MVP collections), enums + job schemas in shared, `db:*` scripts, seed data |
| 3 | App shell and design system | ✅ | (this commit) | Tailwind v4 + shadcn/ui, tokens, Sora/Inter, sidebar + mobile menu, `/design` style tile |
| 4 | Homepage with the waitlist | ⏳ | | Port design/homepage (GSAP + Lenis) |
| 5 | Sign-in (Better Auth, Google) with the invite gate | ⏳ | | |

### Phase B — Making videos

| # | Feature | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 6 | Worker and queue with R2 | ⏳ | | BullMQ + Redis, Cloudflare R2 |
| 7 | Create screen | ⏳ | | |
| 8 | Live progress and fact-check job | ⏳ | | SSE |
| 9 | Storyboard tab with silent preview | ⏳ | | |
| 10 | Editing | ⏳ | | Optimistic locking with `expectedVersion` |
| 11 | Render and download | ⏳ | | |
| 12 | Library | ⏳ | | |

### Phase C — Private beta

| # | Feature | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 13 | Limits and settings | ⏳ | | |
| 14 | Admin | ⏳ | | |
| 15 | Polish and Sentry | ⏳ | | |
| 16 | Deploy (Vercel + Railway) and private beta | ⏳ | | Needs a GitHub repo |

### Phase D — v1

| # | Feature | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 17 | Brand kit | ⏳ | | |
| 18 | Instagram, scheduling and calendar | ⏳ | | |
| 19 | Stripe billing | ⏳ | | |

## Decisions log

| Date | Decision |
| --- | --- |
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

- Stitch: editor screens' Storyboard | Edit tab edit may not have applied — will be built in code (Feature 9) regardless.
- ElevenLabs free plan is non-commercial — upgrade before real users (Feature 16).
- Sidebar user and usage meter show placeholder values until sign-in (Feature 5) and limits (Feature 13).
- Set `ADMIN_EMAILS` in `.env` before Feature 5 (sign-in), then re-run `pnpm db:seed` to create the admin invite.
- No GitHub remote yet — needed by Feature 16 (deploy). Commits are local until then.
