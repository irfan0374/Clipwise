# Deploying Clipwise (Step H)

Two environments, kept fully apart:

| | Staging | Live |
|---|---|---|
| Web app | Vercel **Preview** deployment of the `staging` branch | Vercel **Production** deployment of `main` |
| Worker | Your Mac: `pnpm worker:staging` | Your Mac: `pnpm worker:live` |
| Worker settings file | `.env.staging` (repo root) | `.env.live` (repo root) |
| Database (Atlas M0) | `clipwise_staging` | `clipwise` |
| Redis (Redis Cloud, one database) | keys start with `staging:` | keys start with `live:` |
| Files (Cloudflare R2) | bucket `clipwise` | its own bucket (e.g. `clipwise-live`) |
| Errors (Sentry) | environment `staging` | environment `live` |

This file names settings only. **Never paste a value into chat, an issue or a commit.** `.env`, `.env.staging`
and `.env.live` are git-ignored; `.env.example` lists every setting with a short note.

---

## 1. Accounts to create (you)

1. **MongoDB Atlas** – one free M0 cluster.
   - Two database users, each with *readWrite* on one database only: one for `clipwise_staging`, one for `clipwise`.
     (Staging currently reuses the owner's admin login; live must get its own limited user.)
   - Network Access: allow `0.0.0.0/0` (Vercel has no fixed addresses). The per-database users and long random
     passwords are what protect the data.
   - The connection string's database name (before the `?`) decides the environment. The worker refuses to
     start if it doesn't match.
2. **Redis Cloud** – one free database ("Try 30 MB for free", not the paid Essentials plan): 30 MB, 30 connections,
   100 operations/s, **5 GB network traffic per month**. Both environments share it; `REDIS_NAMESPACE` keeps their
   keys apart. Pick AWS `us-east-1` (next to Vercel's `iad1`).
   - Set **Configuration → Edit → Data eviction policy → `noeviction`** (BullMQ needs it; with the default
     `volatile-lru`, Redis may silently drop queued jobs when full).
   - `REDIS_URL` is only the address `redis://default:<password>@<endpoint>:<port>` — not the whole
     `redis-cli -u …` command that the Connect screen shows.
   - The free plan has **no TLS** (encryption): `rediss://` is refused. Accepted for the private beta, because
     Redis only carries ids and progress numbers (no personal data); move to a paid plan with TLS before a wider launch.
   - An idle worker uses about 1 GB of traffic a month; stop the staging worker when not testing.
3. **Cloudflare R2** (chosen 2026-10-29; needs a payment method on the Cloudflare account, downloads are free) –
   one **private** bucket per environment and an *Object Read & Write* API token, ideally limited to that bucket.
   `S3_ENDPOINT` is `https://<account id>.r2.cloudflarestorage.com`, `S3_REGION` is `auto`. Backblaze B2 works too
   (same settings, its own endpoint and region; free downloads only up to 3× the stored data). No CORS rules are
   needed: uploads go through the server and videos are played from short-lived signed links.
4. **Sentry** – one organisation, two projects: a Next.js project (web) and a Node project (worker). Each gives a
   DSN. Personal data collection is switched off in the code; leave "Store IP addresses" off in project settings.
5. **Vercel** – import the GitHub repo (see step 3).

## 2. Settings per place

Same names as `.env.example`. "✓" = needed there.

| Setting | Vercel Preview (staging) | Vercel Production (live) | `.env.staging` | `.env.live` |
|---|---|---|---|---|
| `CLIPWISE_ENV` | — | — | `staging` | `live` |
| `NEXT_PUBLIC_CLIPWISE_ENV` | `staging` | `live` | — | — |
| `APP_URL`, `BETTER_AUTH_URL` | staging web address | live web address | same as Vercel staging | same as Vercel live |
| `BETTER_AUTH_SECRET` | ✓ (own) | ✓ (own) | — | — |
| `MONGODB_URI` | ✓ `clipwise_staging` | ✓ `clipwise` | ✓ `clipwise_staging` | ✓ `clipwise` |
| `MONGODB_MAX_POOL` | `3` | `3` | (default 10) | (default 10) |
| `REDIS_URL` | ✓ | ✓ | ✓ | ✓ |
| `REDIS_NAMESPACE` | `staging:` | `live:` | `staging:` | `live:` |
| `STORAGE_DRIVER` | `s3` | `s3` | `s3` | `s3` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | staging bucket | live bucket | staging bucket | live bucket |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_DAILY_REQUESTS` | ✓ | ✓ | ✓ | ✓ |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_DRAFT`, `ELEVENLABS_MODEL_FINAL`, `ELEVENLABS_MONTHLY_CREDITS` | ✓ | ✓ | ✓ | ✓ |
| `LIMIT_FINALS_PER_WEEK` | ✓ | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SENTRY_DSN` | web DSN | web DSN | — | — |
| `SENTRY_DSN` | — | — | worker DSN | worker DSN |

Notes:
- `BETTER_AUTH_SECRET` must be different for staging and live (`openssl rand -base64 32`).
- The Gemini and ElevenLabs free quotas are shared by staging and live, and the budget counters are deliberately
  shared too, so staging tests use the same daily allowance as live. Each environment keeps its own part of the
  count (`global:…:staging` / `global:…:live`) and every check adds the parts up, so a worker restoring its part
  after Redis lost data never forgets what the other environment spent.
- The web app checks `REDIS_NAMESPACE` and the database in `MONGODB_URI` against `NEXT_PUBLIC_CLIPWISE_ENV` on every
  server start. A mismatch doesn't stop the site, but it is logged (`[web] settings are not set up for …`) and sent
  to Sentry. The worker refuses to start on the same mismatch.
- `MONGODB_MAX_POOL=3` on Vercel: every serverless copy opens its own connections, and M0 allows 500.
- Changing a `NEXT_PUBLIC_*` setting needs a new deployment (it is built into the page).

## 3. Vercel

1. Add New → Project → import the GitHub repo.
2. **Root Directory**: `apps/web`. Framework: Next.js. Leave the build and install commands on their defaults
   (Vercel detects pnpm from the lockfile and installs the whole workspace).
3. Settings → Git → **Production Branch**: `main`.
4. Create a `staging` branch on GitHub. Its Preview address
   (`<project>-git-staging-<team>.vercel.app`) stays the same, so use it for staging's `APP_URL` and
   `BETTER_AUTH_URL`.
5. Settings → Environment Variables: add the Production values for **Production**, and the staging values for
   **Preview** limited to the branch `staging`.
6. Deployment Protection: keep Vercel Authentication on for Preview, so only you can open staging.
7. Push to `staging` → staging deploys. Merge `staging` into `main` → live deploys.

Current setup (2026-10-29): project `clipwise` in the owner's existing Vercel account, region `iad1`; staging is
https://clipwise-git-staging-irfaans-projects.vercel.app. The settings can be copied without pasting values by hand:
`npx vercel@64.0.2 login` (owner), `npx vercel@64.0.2 link --project clipwise`, then
`vercel env add NAME preview --git-branch staging --sensitive` with the value on standard input. `vercel link`
also writes `.env.local` and adds `.env*` to `.gitignore`; delete both (`.env*` would hide `.env.example`).
A new branch pointing at an already-built commit is not built automatically; push a commit or start a deployment of
the branch from the dashboard. Staging pages show the Vercel Toolbar to the owner only.

The live-progress stream closes itself after 270 seconds and the browser reconnects (Vercel limit: 300 s).

## 4. Worker on your Mac

```
pnpm install
pnpm worker:staging     # or: pnpm worker:live
```

- Reads `.env.staging` / `.env.live` from the repo root and refuses to start if `REDIS_NAMESPACE` or the database
  name belong to another environment.
- `caffeinate` keeps the Mac awake while it runs. Closing the lid or quitting the terminal stops it.
- While no worker runs, users see "Video making is paused right now" and their videos wait in the queue.
  The admin page shows *Worker online / offline · last seen …*.
- Run both side by side only if needed: the free Redis allows 30 connections in total, shared with Vercel.

**Docker (optional, later):** `apps/worker/Dockerfile` builds the worker for a server.

```
docker build -f apps/worker/Dockerfile -t clipwise-worker .
docker run --env-file .env.live -e CLIPWISE_ENV=live clipwise-worker
```

## 5. First-time database setup (per environment)

```
CLIPWISE_ENV=staging pnpm db:indexes
CLIPWISE_ENV=staging pnpm db:status
```

Sign up on the web app, then make yourself admin:

```
CLIPWISE_ENV=staging pnpm user:admin you@example.com
```

Repeat with `CLIPWISE_ENV=live`. `db:seed` refuses to run on live.

## 6. Backups

Atlas M0 has no backups of its own.

```
CLIPWISE_ENV=live pnpm db:backup
```

- Writes `backups/clipwise-<date>/`, one `.jsonl.gz` file per collection (git-ignored). It holds emails and
  password hashes: keep copies somewhere private, never in the repo or chat.
- Restore into an empty database: `pnpm db:restore backups/<folder>`.
  It refuses a database that has data unless `--replace` is added, and refuses live unless `--production` is
  added too.
- Suggested: one backup a week, and one before every release.

## 7. Release checklist

1. `pnpm check` and `pnpm --filter @clipwise/web build` pass; check for secrets before pushing.
2. Push to `staging`, run `pnpm worker:staging`, make one video end to end (script → voice → final render →
   download), check Sentry staging for new errors.
3. `CLIPWISE_ENV=live pnpm db:backup`.
4. Merge `staging` into `main`, then restart `pnpm worker:live` on the new code.
5. Open the live site and the admin page (worker online, queue healthy).
