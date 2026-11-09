# Clipwise — build status

Repo: https://github.com/irfan0374/Clipwise (public). Updated before every commit and push. One feature at a time: **plan → approve → build + tests → demo → review → fix → commit**.

**Last updated:** 2026-11-09

## Now

**Step J2 (scheduling + Calendar) passed on staging on 2026-11-09** — the owner scheduled real Reels on staging; scheduling, reschedule, cancel and the Calendar all worked. See "Step J2 validation".

**Easier Instagram connect (passed on staging, 2026-11-10):** on computers Connect opens Meta's login in a small window; when it finishes the window closes and Connections updates. A 1-2-3 guide shows what to choose on Meta's screens. The owner connected @nafiyeh_ in the small window on staging; it closed by itself and Connections updated. Meta's "Select the business assets" screen stays (Meta's own consent step).

**Settings tabs on top (2026-11-10):** Account / Defaults / Usage / Connections now run across the top (Stitch "Settings > Connections"), black pill with a lime dot; they fit on a 375px phone.

**Step K1 Brand kit built on 2026-11-10, in review** — logo, colors, font, title casing, caption style, voice (shared with Settings → Defaults), call-to-action and a live preview; a real test render matched the preview. See "Step K1 validation". K2 later: own intro/outro clips.

**Step J1 (Instagram connect + Post now) passed on staging on 2026-11-09 and is going live** — the owner connected @nafiyeh_ with "Continue with Instagram" (no Facebook) and posted a real Reel from staging; the access key is stored encrypted. See "Step J1 validation".

**Step I (fair share, billing removed) approved on 2026-11-06** — see "Step I validation". Before that: **Step H5 (live) online on 2026-10-30**: https://clipwise-kappa.vercel.app (Vercel Production), live worker on the Mac (`pnpm worker:live`), MongoDB `clipwise`, R2 bucket `clipwise-live`; the owner signed up and made a real promo video on live; first live backup taken.

**Step H4 (staging test) passed on 2026-10-29** — a real video was made on the staging website end to end (see "Step H4 validation"). Before that: **Step H1–H3 complete and approved** (polish, Sentry, deploy setup). User approved committing and pushing on 2026-10-28, after a real video was made end to end on the Mac worker with this code (voice 31.3s, 252 credits; render 31.8s). Validation: 187 passing tests, lint, typechecks, production build, browser QA, accessibility pass, backup/restore test and a tested worker Docker image.

**Code review of H1–H4 (2026-10-30), 3 fixes, committed in `b9c7cea`:** (1) the web app now checks `REDIS_NAMESPACE` and the `MONGODB_URI` database against `NEXT_PUBLIC_CLIPWISE_ENV` on every server start and reports a mismatch (log + Sentry); the worker uses the same shared check (`environmentProblems` in `@clipwise/shared`). (2) The shared Gemini/ElevenLabs budget counters are now one part per environment, added up on every check; a worker restoring its part after Redis lost data raises it to what MongoDB recorded and can no longer forget the other environment's spending. (3) Live progress: a tab closed while the stream is still connecting is cleaned up at once, and a second page for the same video waits until the subscription is in place. Validation: 195 passing tests, lint, typechecks, production build.

## Next up

**Step J1 live:** Vercel Production settings added (2026-11-09); owner runs `CLIPWISE_ENV=live pnpm db:indexes`, restarts `pnpm worker:live`, connects and posts on live. Then **Step J2 staging test** — schedule a real Reel ~10 minutes ahead (owner restarts the staging and live workers for the new publish code). H5 leftovers: owner admin on live, ElevenLabs paid plan, invite steps, `staging` branch brought up to `main`, optional Sentry DSNs.

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
| H | 15 Polish and Sentry · 16 Deploy and private beta | ✅ live 2026-10-30 (small leftovers in "Next up") | `5326485` | Vercel (web) · worker on the owner's Mac · Redis Cloud · Backblaze B2 · Sentry; staging + live |
| I | Fair share · billing removed | ✅ approved | `e15624c` | Each workspace's own share of the shared Gemini/ElevenLabs budgets; Clipwise stays free (no plans, no Stripe) |

### v1 (regrouped later)

| # | Feature | Status |
| --- | --- | --- |
| 17 | Brand kit | 🔍 K1 (logo, colors, font, captions, voice, call-to-action, live preview) in review · K2 (intro/outro clips) ⏳ |
| 18 | Instagram, scheduling and calendar | ✅ J1 (connect + post now) passed on staging, going live · J2 (scheduling + calendar) ✅ passed on staging |

## Step H plan

Hosting (chosen 2026-10-28): web on **Vercel free** (Preview deployments = staging, Production = live) · worker on **the owner's Mac** (it only connects outward, so no server or tunnel is needed) · **Redis Cloud free** (30 MB, one database, separate `REDIS_NAMESPACE` for staging and live) · **MongoDB Atlas M0** (`clipwise_staging` and `clipwise`) · **Backblaze B2** for files (one bucket per environment) · **Sentry free**. Nothing here needs a card.

1. **H1 Polish:** error, not-found and loading screens for every app page; accessibility pass (keyboard, focus, labels, contrast); worker heartbeat every 30s, with a "Rendering is paused right now" message on Create and Render and an offline badge in Admin when the worker is off; security headers; check that no server values reach the browser.
2. **H2 Sentry:** errors from pages, server actions and API routes (web) and from failed jobs (worker, tagged with the video id). No passwords, scripts or keys are sent. One test error proves each side works.
3. **H3 Deploy setup:** Vercel project settings for the monorepo; live-progress stream (SSE) made safe for Vercel's time limit (the browser reconnects on its own); worker Docker image with Chrome and fonts for a later move to a server; `pnpm worker:staging` / `pnpm worker:live` on the Mac, each with its own env file; `design/deploy.md` listing every setting by name (never values); a MongoDB backup script (M0 has no backups).
4. **H4 Staging test:** deploy to staging and run one real video end to end (Create → Storyboard → Edit → Render → Download), plus sign-up, sign-in, admin and phone layouts. Expected cost: about 3 Gemini requests and 500–1,000 ElevenLabs credits (reported exactly).
5. **H5 Beta checklist:** promote to live, make the owner admin, confirm beta limits, ElevenLabs paid plan (owner), final secrets check before the push, invite steps for the first users.

Owner actions (accounts and keys are never entered by Claude): create the Vercel, Redis Cloud, Backblaze B2 and Sentry accounts and put each key straight into Vercel or the Mac's env files, following `design/deploy.md`.

## Step K1 validation — 2026-11-10

- **Page (Brand kit in the sidebar, Stitch "Brand Kit"):** logo upload (PNG, SVG or WebP up to 2 MB; Replace / Remove; on/off switch; corner), accent and background colors (swatch picker or hex) with the 6 Stitch presets, 5 fonts (Geist, Inter, Poppins, Montserrat, DM Sans), title casing (Uppercase / Title Case / Sentence case = as written), caption style (Bold outline / Pill badge / Minimal), default voice (the same setting as Settings → Defaults), call-to-action (40 characters), live 9:16 preview (Remotion player with a short sample), "All changes saved / Unsaved changes", docked Save bar with "Reset to default", intro/outro shown as Soon. Phones: preview on top (smaller), sections stacked.
- **How it works:** the kit is saved on the workspace (`brandKit`; the unused `brandKitId` field is gone). Each new video copies it (`video.brand`) when it is created, so later changes never restyle existing videos or their re-renders; no kit = Clipwise's own look. The render job copies the logo into the render folder (an unreadable logo is skipped, the video still renders). The script prompt uses the call-to-action word for word. Storyboard and editor previews show the video's brand. Text switches to dark on a light background color.
- **Logo safety:** the file type is read from the file's first bytes, not its name; SVGs with scripts, event handlers or outside links are refused. Logo files get a new name per upload and are not deleted on Replace/Remove, so older videos keep their logo. Server actions now accept up to 3 MB (`next.config`).
- **Voice samples:** the play buttons use the same route as the Create page, which needs Voices access on the ElevenLabs key (owner turned it on 2026-11-10; samples checked for all 3 voices with the dev, staging and live keys). Voice labels are the real ElevenLabs voices: Liam (US), Jessica (US), George (UK) — Stitch said UK/US/AU.
- **Manual QA (local, 2026-11-10):** presets, font, casing, caption style, logo drop, call-to-action and voice all saved and reloaded; the voice showed in Settings → Defaults and on Create; a script-laden SVG and a GIF were refused; computer 1440px and phone 375px. A real 30s test video (local worker) used the kit: the AI ended with "Follow Acme for daily science.", the MP4 showed the logo, navy/pink colors, Poppins, UPPERCASE hook and pill captions. Cost: 2 Gemini requests, 382 ElevenLabs credits. Test account, video and files removed.
- `pnpm check`: lint, typechecks and **239 tests passed** (13 new: brand copied to new videos, call-to-action in the prompt, logo copied into renders, colour/casing helpers, preview sample, logo and form checks).

## Easier Instagram connect — 2026-11-09

- Owner asked for a simpler connect. Not possible: logging in for the person in the background (Meta requires the person to log in and allow it on Meta's own pages), or hiding Meta's Facebook button and screens (new Meta apps only get Unified login). The screens get simpler after Meta App Review (no tester / not-reviewed notices).
- **Small window on computers:** `/api/oauth/instagram/start?popup=1` remembers "popup" in the state cookie; the callback adds `popup=1` to the Connections link; that page sends the result to the Clipwise tab over a same-origin `BroadcastChannel` (Meta's pages cut `window.opener`) and closes itself. If it can't close, it shows the normal message. Phones, blocked popups and browsers without `BroadcastChannel` use the whole page as before. While waiting: "Finish connecting in the Instagram window" with "Continue here".
- **1-2-3 guide** under Instagram: Continue with Instagram → log in to the Creator/Business account → allow Clipwise to post.
- **Local QA:** guide shown, a blocked popup falls back to the full page (Meta's login opened), the result reached the Clipwise tab and the small tab closed itself, waiting box shown. The real login in a popup can only be checked on staging (Meta refuses `localhost`). `pnpm check`: 226 tests passed.

## Step J2 validation — 2026-11-09

- **Schedule (video page and Calendar):** the Post window has "Post now / Schedule"; Schedule shows date + time in the person's own time zone (e.g. "Asia/Dubai (GMT+4)") and the button becomes "Schedule Reel". Rules (same in browser and server): at least 5 minutes ahead, at most 60 days ahead, at most 50 waiting posts per workspace (`LIMIT_SCHEDULED_POSTS`). A scheduled post is a delayed `publish` job (`post_{id}_a{attempt}`).
- **Reschedule / Cancel:** only while the post is waiting. Reschedule raises the attempt number, removes the old job and adds a new one; an old job that still runs finds no match and stops. Cancel marks the post "cancelled" and removes the job. The worker now claims a post atomically (same attempt, still queued), so a post can never go out twice or after a cancel.
- **Calendar page (enabled in the sidebar):** Stitch month view (Monday first), today marked in lime, chips with times, "+N more", filters All / Scheduled / Posted / Failed with counts, account picker, Week shown as "Soon". Day panel with Reschedule / Cancel, "View on Instagram", "Open video to try again", and "Nothing scheduled" with a Schedule button. "This month" summary (scheduled · posted · failed) and "Waiting to post N / 50". "Schedule a video" opens a video picker, then the Post window in Schedule mode. Phones: dots per day, next-day row, sticky lime "Schedule a video" button. Reloads every 8 seconds while a post is going out.
- Left out on purpose (decided with the owner): Week view (Soon) and the Stitch "Audience peak / Recommended time" cards (no real data yet). Cancel has no "are you sure" step, as in Stitch.
- **Manual QA (browser, 2026-11-09, dev):** counts, reschedule, cancel, picker → schedule, video-page cancel, desktop at 1440 and 1024, phone at 375 (header fixes: account chip beside the title, month name on one line).
- `pnpm check`: lint, typechecks and **226 tests passed** (7 new scheduling tests: delayed job, too soon / too far, reschedule posts once, old job stops, cancel, other workspace refused, waiting cap). Temporary test user, posts and the leftover dev job removed.

## Step J1 validation — 2026-11-07

- **Connect (Settings → Connections):** Meta "Instagram API with Unified login" (config `Clipwise Instagram`); the person signs in with Instagram only. State cookie tied to the signed-in user (15 min, compared in constant time). The access key is stored encrypted (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`, one key per environment) and is never sent to the browser. Disconnect deletes the account. TikTok and YouTube rows show "Coming soon".
- **Post now (video page):** Stitch modal with account picker, AI caption (saved on the video; "Rewrite caption" uses one AI request from the fair share), 2,200-character counter, "Schedule" shown as Soon. Posts are a `publish` job on the worker: upload from a 1-hour signed R2 link → wait for Instagram to process → publish → permalink. Each step is saved, so a retry never posts twice. Expired access → account marked "Reconnect". 10 posts per user per day (`LIMIT_POSTS_PER_DAY`). A post that goes out more than 15 minutes late (Mac was off) is marked "Posted late".
- History panel on the video page: Posted / Queued / Posting… / Failed, "View on Instagram", "Try again".
- **Manual QA (browser, 2026-11-07):** Connections page vs Stitch (connected, reconnect, coming soon rows; phone size), success and error messages, Disconnect, a forged login link is refused, AI caption written once then reused, Post window on computer and phone. Fixes from QA: on phones the Post window is now the Stitch bottom sheet (small video card, Cancel / Post now always visible); with only a broken account the video page says "Reconnect @name to post".
- **Login check with Meta (2026-11-09):** a private window shows Meta's "Continue with Facebook / Continue with Instagram" page; Instagram login worked, then Meta blocked the return to `localhost` (not allowed as a redirect URL). The login URL now also sends `prompt=login` and `override_default_response_type=true` (as Meta's own login URL does), so people already logged into Facebook still get the Instagram choice instead of the business-portfolio screen.
- **Staging test (2026-11-09):** connected with Instagram only, a real Reel posted and checked on Instagram. Meta's login page always shows "Continue with Facebook" as well (`enable_fb_login=0` from the old Instagram Login is ignored), so Settings → Connections now says: "On Meta's next screen, choose Continue with Instagram".
- Posting only works where files are in R2 (staging, live); local dev refuses with a clear message — checked in the browser end to end with the dev worker.
- `pnpm check`: lint, typechecks and **219 tests passed** (encryption, Meta login/code exchange with a fake Graph API, 8 publish-job tests). Production build OK. Dev database indexes synced. Temporary test user and fake account removed from `clipwise_dev`.

## Step I validation — 2026-11-06

- **Fair share:** every workspace gets 15 Gemini requests per UTC day (`LIMIT_AI_REQUESTS_PER_DAY`) and 1,500 ElevenLabs credits per UTC month (`LIMIT_VOICE_CREDITS_PER_MONTH`), reserved atomically before the global budget and given back if the global budget refuses. Used up → a "limit reached" message that says when it resets; the job is not retried and isn't reported to Sentry.
- A video isn't started with fewer than 3 AI requests left today; a final render isn't started when its voiceover needs more credits than are left this month (the message says how many). Without credits for a speed re-take, the first voice take is kept instead of failing the video.
- Idea suggestions and AI rewrites lowered from 30 to 10 per user per day.
- Settings → Usage shows "AI requests today" and "Voice credits this month"; checked in the browser on the local app.
- **Billing removed:** Upgrade Plan button, Settings "Billing" tab, Stripe fields and index on `workspaces`, paid plan names (`Plans` is just `beta`), Stripe settings in `.env.example`; home page "Pricing" links renamed "Free beta".
- `pnpm check`: lint, typechecks and **201 tests passed** (6 new fair-share tests; the voice re-take test now expects the first take to be kept). Old Stripe index dropped on `clipwise_dev`. Temporary test user removed from `clipwise_dev`.
- Local `.env` had a second `REDIS_URL` line with the `redis-cli -u` prefix (removed with the owner's OK).

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
| 2026-11-09 | Meta's Unified login page can't hide the Facebook button (old Instagram Login isn't offered to new apps); Clipwise tells people to choose "Continue with Instagram". Other users can connect only after Meta App Review |
| 2026-11-07 | Instagram: Meta Unified login (new Meta apps can't use the old Instagram-only app; people still sign in with Instagram only). Access keys encrypted in MongoDB. Posting only from R2 environments. Deauthorize / data-deletion callbacks deferred to Meta App Review (Unified login docs don't describe them yet). Until App Review only app testers can connect. Meta doesn't allow `localhost` redirect URLs, so connecting is tested on staging |
| 2026-11-06 | Clipwise stays free: no paid plans, no Stripe (Feature 19 dropped). Fairness comes from a per-workspace share of the shared AI and voice budgets (15 Gemini requests/day, 1,500 ElevenLabs credits/month, both settings) |
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
| 2026-10-23 | AI rewrite / AI scene runs in the web server action (one Gemini call, same budget guards as the worker), limit 10 per user per day since 2026-11-06 (`LIMIT_AI_EDITS_PER_DAY`). A video keeps 3–10 scenes while editing; the hook stays first |
| 2026-10-23 | Biome for lint + format (not ESLint + Prettier). `noNonNullAssertion` off (works with strict index typing); array-index keys and SVG titles allowed in video frames |
| 2026-10-23 | TypeScript 7 kept — verified with Next.js 16.4 build |
| 2026-10-23 | MongoDB Atlas M0 connected. Databases: `clipwise_dev` (local), `clipwise_staging`, `clipwise` (production; seed refuses it) |
| 2026-10-23 | Enums live once in `@clipwise/shared` (Zod + Mongoose); visual enums stay in `@clipwise/video` |
| 2026-10-23 | DB tests use mongodb-memory-server (in-memory, no Atlas needed) |
| 2026-10-23 | UI: Tailwind v4 + shadcn/ui (Radix base). Light only; `dark:` bound to a `.dark` class so the OS dark setting doesn't leak in |
| 2026-10-23 | Mobile: top bar + menu button opens the sidebar. Calendar and Brand kit shown greyed with "Soon" |
| 2026-10-23 | `/design` style tile is dev-only (404 in production) |
| 2026-10-23 | Next.js 16 changed APIs: read `node_modules/next/dist/docs/` before writing Next code (see `apps/web/AGENTS.md`) |

## Open items


- ElevenLabs free plan is non-commercial — upgrade before real users (Feature 16).
- Make yourself admin on live: `CLIPWISE_ENV=live pnpm user:admin you@example.com`.
- Change the Redis Cloud password (it was shown in a tool log on 2026-11-06), then update `.env.staging`, `.env.live` and Vercel.
- Redis Cloud free plan has no TLS and 5 GB traffic/month — upgrade before a wider launch.
- While the worker runs on the Mac, videos are only made while the Mac is on and awake. Move it to a server (Railway or a VPS, needs a card) before a wider launch.
