# Clipwise

AI short videos for creators, brands and educators: any idea becomes a Reel, Short or TikTok (promos, explainers, stories, tips and more).
Pipeline: script → fact-check → voiceover → animated visuals → captions → render → schedule and publish.

**Progress:** see [STATUS.md](STATUS.md) for what's built, what's in progress and what's next.

Docs: [PRD](https://claude.ai/code/artifact/f8f8abca-e939-4ba5-bc6a-b7eac21a3d68) · [Pipeline design](https://claude.ai/code/artifact/ae0b3815-1950-4e48-9cbc-ace979104af7) · [System design](https://claude.ai/artifact/J2oWzhzu7bKSQA7LenYHww) · [Database design](https://claude.ai/artifact/FP5BPiXzyp9cUYTLNtUGpQ) · [API design](design/api-design.md) · [Stitch prompts](design/stitch-prompts.md)

## Setup

Needs Node 22 (`nvm use` reads `.nvmrc`) and pnpm.

1. `pnpm install`
2. `cp .env.example .env` and fill in only the groups the current feature needs (each group names its feature). For the prototype pipeline that's:
   - `GEMINI_API_KEY` — https://aistudio.google.com/apikey (free tier)
   - `ELEVENLABS_API_KEY` — https://elevenlabs.io (free plan, default voices only)
3. Check rendering works without any keys: `pnpm sample` → `out/sample/sample.mp4`

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Web app on http://localhost:3000 and the worker, together. Design system at http://localhost:3000/design (dev only) |
| `pnpm check` | Lint + typecheck + tests. Run before every commit |
| `pnpm format` | Auto-fix formatting and import order (Biome) |
| `pnpm db:status` | Show the database name and how many records each collection has |
| `pnpm db:seed` | Fill a dev database with a sample workspace and 3 videos (rendered, previewed, failed). Never runs on production |
| `pnpm db:indexes` | Create or update all indexes (production builds no indexes on startup) |
| `pnpm db:migrate` | Run pending scripts in `packages/db/migrations/` once each |
| `pnpm make "topic" …` | Make a video with the prototype CLI (see below) |
| `pnpm studio` | Tweak video templates live in Remotion Studio |

## Layout

```
apps/web            Next.js app (App Router) — homepage, dashboard, editor, server actions
                      app/(app)/        signed-in pages inside the sidebar shell (create, videos, settings)
                      components/ui/    shadcn/ui primitives restyled to the Clipwise theme (Radix)
                      components/app/   Clipwise components: sidebar, logo, status badge, segmented, chips…
                      app/globals.css   design tokens (Paper, ink, lime, teal; Sora + Inter)
apps/worker         Node.js worker — runs AI, voice and render jobs from the queue
apps/cli            prototype `clipwise` command
packages/pipeline   stage functions (script, fact-check, voice, align, render) + run orchestrator
packages/video      Remotion project: compositions, templates, animated visuals, captions
packages/db         MongoDB (Mongoose) models, connection, db:* scripts, migrations, seed data
packages/shared     code used by web, worker and db: enums, API result shape, error codes, input and job schemas
design/             homepage prototype, Stitch prompts, API design
```

UI: Tailwind CSS v4, shadcn/ui (Radix), Lucide icons, Sora + Inter via next/font. Light theme only for now; dark: styles apply only under a `.dark` class.

Tooling: TypeScript 7, Biome (lint + format), Vitest, pnpm workspaces. Database tests run on an in-memory MongoDB (downloaded once, ~100 MB), so `pnpm check` needs no Atlas connection. Each package has its own `tsconfig.json` extending `tsconfig.base.json`.

## Prototype CLI

Turns a topic into a 30s or 60s vertical (1080×1920) video: Gemini script → fact-check → ElevenLabs voice + timestamps → Remotion animated visuals and word-synced captions.


```bash
pnpm make "How do black holes form?" --length 60 --preview  # silent preview, 0 voice credits
pnpm make "How do black holes form?" --length 60            # draft voice (cheaper credits)
pnpm make "What is a transistor?" --length 30 --dry-run     # script only, no voice credits
pnpm make "Why is the sky blue?" --length 30 --final        # best ElevenLabs model
pnpm clipwise resume out/<run-folder>                        # re-run missing stages only
pnpm clipwise batch topics.txt --preview                     # the 10 evaluation topics, free
pnpm studio                                                  # tweak templates live in Remotion Studio
pnpm test                                                    # unit tests (validate, align)
```

Each run writes to `out/<date>-<topic>/`:

| File | Stage |
| --- | --- |
| `script.json` | Gemini script (invalid attempts saved as `script.invalid-N.json`) |
| `factcheck.json` | Every claim with its verdict, fixes made, anything left to check by hand |
| `media/voice.mp3`, `alignment.json` | ElevenLabs voice and character timestamps |
| `media/scene-N.jpg`, `images.json` | Stock photos and photographer credits |
| `timeline.json` | Scene, word and caption timings in frames |
| `final.mp4` / `preview.mp4` | Rendered video (preview = silent, estimated timing) |
| `run.json` | Per-stage timings, attempts, credits used, errors |

To redo one stage, delete its output and run `resume`. Monthly provider usage is tracked in `out/.usage.json`.

## Credits and limits

- **Gemini free tier:** about 20 requests per model per day. `GEMINI_MODEL` lists several models; when one runs out the next takes over. A video uses 2–6 requests (script + fact-check, plus rewrites).
- **ElevenLabs free plan:** 10,000 credits a month (about 15 videos on the draft model). The pipeline refuses a voiceover that would go past `ELEVENLABS_MONTHLY_CREDITS`. Use `--preview` for anything that doesn't need sound.

## Notes

- Rendering uses Remotion's Chrome for Testing mode; the default headless shell crashes on macOS 26.
- The ElevenLabs free plan is non-commercial and requires attribution; upgrade before real users.
- Pixabay and Pexels ask for credit where possible; photographer names are saved in `images.json`.
