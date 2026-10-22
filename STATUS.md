# Clipwise — build status

Updated before every commit. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-10-23

## Now

**Feature 2 — Database and shared schemas** · Planning

## Next up

**Feature 3 — App shell and design system**: Tailwind, theme tokens, Sora/Inter, sidebar layout.

## Build plan

Legend: ✅ done · 🔍 in review · 🛠 building · ⏳ not started

### Phase A — Foundation

| # | Feature | Status | Commit | Notes |
| --- | --- | --- | --- | --- |
| 0 | Prototype baseline | ✅ | `64f7db9` | Pipeline, 9 visual types, fact-check, CLI, design docs |
| 1 | Project setup | ✅ | (this commit) | apps/web, apps/worker, packages/shared, Biome, `pnpm dev` / `pnpm check` |
| 2 | Database and shared schemas | 🛠 | | |
| 3 | App shell and design system | ⏳ | | Tailwind, tokens, Sora/Inter, sidebar layout |
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
| 2026-10-23 | Build feature by feature; one commit per approved feature; STATUS.md updated before each commit and push |
| 2026-10-23 | Biome for lint + format (not ESLint + Prettier). `noNonNullAssertion` off (works with strict index typing); array-index keys and SVG titles allowed in video frames |
| 2026-10-23 | TypeScript 7 kept — verified with Next.js 16.4 build |
| 2026-10-23 | Next.js 16 changed APIs: read `node_modules/next/dist/docs/` before writing Next code (see `apps/web/AGENTS.md`) |

## Open items

- Stitch: editor screens' Storyboard | Edit tab edit may not have applied — will be built in code (Feature 9) regardless.
- ElevenLabs free plan is non-commercial — upgrade before real users (Feature 16).
- No GitHub remote yet — needed by Feature 16 (deploy). Commits are local until then.
