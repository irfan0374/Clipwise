# Clipwise — API Design

2026-10-23 · Covers MVP + v1 · Builds on the [System Design](https://claude.ai/artifact/J2oWzhzu7bKSQA7LenYHww) and [Database Design](https://claude.ai/artifact/FP5BPiXzyp9cUYTLNtUGpQ). Screens refer to the approved Stitch designs (A1–A12 + Storyboard).

The browser talks to the backend in three ways:

1. **Server actions** (Next.js) for everything a dashboard button or form does. Typed end to end, no URLs to maintain.
2. **Route handlers** for things a browser or third party calls by URL: sign-in, live progress (SSE), files, OAuth callbacks, webhooks.
3. **Job payloads** on BullMQ queues for everything slow; the worker runs them and reports back over Redis.

All schemas live in `packages/shared/src/api/` as Zod, so the web app, the worker and tests share one definition.

---

## 1. Conventions

### Result shape (every server action)

```typescript
// packages/shared/src/api/result.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; retryAfter?: number } };
```

Actions never throw to the browser. `message` is always user-safe (no provider names, costs or stack traces).

### Error codes

| Code | When | User sees |
| --- | --- | --- |
| `UNAUTHENTICATED` | No session | Redirect to sign-in |
| `FORBIDDEN` | Not your resource, not admin, suspended | "You don't have access to this." |
| `NOT_FOUND` | Missing or soft-deleted (also used for "not yours") | "This video doesn't exist anymore." |
| `VALIDATION` | Zod failed | Field-level messages |
| `LIMIT_REACHED` | A per-user limit hit (`retryAfter` in seconds) | "You've reached this week's limit." |
| `BUSY` | A job of that kind is already running for this video or user | "Already working on it." |
| `PAUSED` | Admin paused generation, or a global budget is used up | "Generation is paused for a moment. Try again later." |
| `CONFLICT` | Stale `scriptVersion` (someone edited in another tab) | "This video changed. Reload to see the latest." |
| `INTERNAL` | Anything else (logged to Sentry) | "Something went wrong. Try again." |

### The action wrapper

Every action is built with one helper, so auth, validation, limits and error mapping are never forgotten:

```typescript
// apps/web/lib/action.ts
export const action = <I extends z.ZodTypeAny, O>(opts: {
  input: I;
  auth: "user" | "admin" | "public";
  limit?: LimitKey;                       // checked + counted before the handler runs
  handler: (input: z.infer<I>, ctx: { user: User; workspace: Workspace }) => Promise<O>;
}) => async (raw: unknown): Promise<ActionResult<O>> => { /* session → zod → limit → handler → map errors */ };
```

Rules every handler follows:

- `workspaceId` always comes from the session, never from input.
- Loading a video is always `Video.findOne({ _id, workspaceId, deletedAt: null })`; a miss is `NOT_FOUND`.
- Writes that edit the script take `expectedVersion` and fail with `CONFLICT` if `video.scriptVersion` differs (optimistic locking).
- Anything slow enqueues a job and returns immediately; progress arrives over SSE.

### Shared input pieces

```typescript
// packages/shared/src/api/common.ts
export const Id = z.string().regex(/^[a-f0-9]{24}$/);            // Mongo ObjectId
export const LengthMode = z.enum(["30", "60", "auto"]);
export const Format = z.enum(["promo", "explainer", "story", "tips", "recap", "quote"]);
export const VoiceId = z.enum(["TX3LPaxmHKxFdv7VOQHJ", "cgSgspJ2msm6clMCkdW9", "JBFqnCBsd6RMkjVDRZzb"]); // Liam, Jessica, George
export const Topic = z.string().trim().min(3).max(300);
export const Cursor = z.object({ before: z.string().datetime().optional(), limit: z.number().int().min(1).max(50).default(20) });
```

Voices are an allow-list of the ElevenLabs default voices that work on the free plan; the UI shows names, the API sends IDs.

---

## 2. Screen → API map

| Screen | Reads (server components) | Actions | Routes |
| --- | --- | --- | --- |
| Homepage | — | — ("Get started free" links to `/sign-in?tab=sign-up`) | — |
| A1 Sign-in / Create account | — | — (Better Auth client: `signIn.email`, `signUp.email`) | `/api/auth/*` |
| A2 Create | `getCreateScreen` | `brainstormIdeas`, `createVideo` | — |
| A3 Generating | `getVideo` | `cancelVideo`, `retryVideo` | `/api/events/[videoId]` |
| Storyboard + A4 Editor | `getVideo`, `getScriptVersions` | `updateScene`, `reorderScenes`, `addScene`, `deleteScene`, `regenerateScene`, `acceptClaim`, `restoreScriptVersion`, `renameVideo`, `renderFinal` | `/api/videos/[id]/timeline`, `/api/events/[videoId]` |
| A5 Library | `listVideos` | `deleteVideo`, `duplicateVideo`, `retryVideo` | — |
| A6 Video ready | `getVideo` | `writePostCaption` | `/api/videos/[id]/download` |
| A7 Settings | `getUsage`, `getAccount` | `updateDefaults`, `deleteAccount` | `/api/auth/*` (sign out) |
| A8 Admin | `getAdminOverview`, `listUsers`, `listProblemVideos` | `resetUserPassword`, `setUserSuspended`, `setGenerationPaused`, `adminRetryVideo` | — |
| A9 Brand kit (v1) | `getBrandKit` | `saveBrandKit`, `resetBrandKit` | `/api/uploads/sign` |
| A10 Connections + schedule (v1) | `listSocialAccounts` | `disconnectSocialAccount`, `schedulePost`, `reschedulePost`, `cancelPost` | `/api/oauth/instagram/*` |
| A11 Calendar (v1) | `listScheduledPosts` | (same as A10) | — |
| A12 Plans + billing (v1) | `getBilling` | `startCheckout`, `openBillingPortal` | `/api/webhooks/stripe` |

"Reads" are plain async functions called from React Server Components (no client fetch, no extra endpoint); they use the same auth and scoping rules as actions.

---

## 3. Server actions

Each block: input schema → output → what it does. Limits refer to section 6.

### Sign-up and sign-in (Better Auth, email + password)

Not server actions: the browser calls Better Auth's own endpoints through its client (`authClient.signUp.email`, `authClient.signIn.email`, `authClient.signOut`), served by the `/api/auth/[...all]` route.

```typescript
// POST /api/auth/sign-up/email  { name, email, password }   -> session cookie (auto sign-in)
// POST /api/auth/sign-in/email  { email, password }         -> session cookie
// POST /api/auth/sign-out                                   -> clears the cookie
```
- Sign-up is open to anyone (decided 2026-10-23). Passwords: 8–128 characters, hashed by Better Auth and stored in its `account` collection (`providerId: "credential"`).
- On sign-up a hook gives the `admin` role to emails in `ADMIN_EMAILS` and creates the user's workspace.
- No emails are sent in the beta: no verification and no self-service reset. A forgotten password is reset by an admin (`resetUserPassword`). Add an email provider before the public launch.
- Errors shown to people: wrong email or password (401), email already has an account (422), too many attempts (429).

### Create (A2)

```typescript
// brainstormIdeas
input:  z.object({ niche: z.string().trim().min(2).max(120), format: Format.optional() })
output: { ideas: { title: string; hook: string; suggestedLength: "30" | "60" }[] }   // 4–8 ideas
limit:  ai.daily
```
Synchronous Gemini call (about 5 s). v1 also saves them to `ideas`.

```typescript
// createVideo
input:  z.object({ topic: Topic, format: Format, lengthMode: LengthMode, voiceId: VoiceId })
output: { videoId: string }
limit:  videos.daily, active.jobs
```
Inserts `videos` (`status: "draft"`), enqueues `script`, returns at once. The client navigates to the Generating screen and opens the SSE stream.

### Generating (A3)

```typescript
// cancelVideo — only while scripting/checking
input:  z.object({ videoId: Id })
output: { status: "draft" }
```
Removes waiting jobs for the video; a running Gemini call finishes but its result is discarded.

```typescript
// retryVideo — after status "failed"
input:  z.object({ videoId: Id })
output: { status: VideoStatus }
```
Re-enqueues the failed `stage` with the same deterministic job ID; earlier outputs are reused.

### Storyboard and editor (Storyboard tab, A4)

All script edits take `expectedVersion` and return the new version, so the UI can stay in sync without refetching everything.

```typescript
// updateScene — text, template or visual of one scene
input: z.object({
  videoId: Id,
  expectedVersion: z.number().int(),
  sceneIndex: z.number().int().min(0),
  patch: z.object({
    narration: z.string().trim().min(1).max(400).optional(),
    onScreenText: z.array(z.string().trim().min(1).max(60)).min(1).max(3).optional(),
    template: z.enum(["title", "bullets", "stat"]).optional(),
    stat: z.object({ value: z.string().regex(/\d/).max(6), label: z.string().max(40) }).optional(),
    visual: VisualSchema.optional(),          // shared with the pipeline
  }).refine((p) => Object.keys(p).length > 0),
})
output: { scriptVersion: number; voiceStale: boolean; factcheckStale: boolean }
```
Saves a `scriptVersions` entry (`source: "user-edit"`). `voiceStale` is true when narration changed (the Render button then says "Re-record voice"). Visual-only edits don't touch the voice.

```typescript
// reorderScenes — drag and drop on the Storyboard
input:  z.object({ videoId: Id, expectedVersion: z.number().int(), order: z.array(z.number().int().min(0)).min(3).max(10) })
output: { scriptVersion: number; voiceStale: true }
```
`order` must be a permutation of the current indexes. Re-indexes scenes; the hook must stay first (`VALIDATION` otherwise).

```typescript
// addScene / deleteScene
addScene input:    z.object({ videoId: Id, expectedVersion: z.number().int(), afterIndex: z.number().int().min(-1), mode: z.enum(["blank", "ai"]) })
deleteScene input: z.object({ videoId: Id, expectedVersion: z.number().int(), sceneIndex: z.number().int().min(1) })
output:            { scriptVersion: number; voiceStale: true }
```
Scene count stays within 3–10. `mode: "ai"` enqueues a `regenerate-scene` job for the new slot.

```typescript
// regenerateScene — "regenerate" icon on a frame, or "Rewrite with AI"
input:  z.object({ videoId: Id, expectedVersion: z.number().int(), sceneIndex: z.number().int().min(0), instruction: z.string().max(200).optional() })
output: { jobId: string }
limit:  ai.daily
```
Enqueues `regenerate-scene` (then a fact-check of that scene). Result arrives over SSE as a new `scriptVersion`.

```typescript
// acceptClaim — "Mark as OK" / dismiss a fact-check flag
input:  z.object({ videoId: Id, claimIndex: z.number().int().min(0) })
output: { remaining: number }
```
Marks the claim accepted by the user (see DB changes, section 8). Flags never block rendering; they are warnings.

```typescript
// restoreScriptVersion — undo history
input:  z.object({ videoId: Id, version: z.number().int().min(1) })
output: { scriptVersion: number; voiceStale: boolean }

// renameVideo
input:  z.object({ videoId: Id, title: z.string().trim().min(1).max(60) })
output: { title: string }
```

```typescript
// renderFinal — "Looks good, render video" / "Render video"
input:  z.object({ videoId: Id, expectedVersion: z.number().int() })
output: { renderId: string; startsWithVoice: boolean }
limit:  finals.weekly, active.render
```
Checks the global ElevenLabs credit guard, creates a `renders` row (`queued`), enqueues `voice` if the voice is stale, otherwise `render` directly. Deterministic job ID `vid:{id}:render:v{version}` makes double clicks harmless.

### Library (A5)

```typescript
// listVideos (read)
input:  z.object({ status: z.enum(["all", "rendered", "previewed", "in_progress", "failed"]).default("all"), search: z.string().max(80).optional() }).merge(Cursor)
output: { items: VideoListItem[]; nextCursor?: string }

type VideoListItem = {
  id: string; title: string; format: Format; lengthSeconds: 30 | 60 | null;
  status: VideoStatus; progress: number; thumbnailUrl?: string;   // signed, 1 h
  createdAt: string;
};
```

```typescript
// deleteVideo   input: z.object({ videoId: Id })            output: { deleted: true }   // soft delete
// duplicateVideo input: z.object({ videoId: Id })           output: { videoId: string } // copies script, status "previewed", no renders
```

### Video ready (A6)

```typescript
// writePostCaption — AI caption + hashtags for the post
input:  z.object({ videoId: Id, platform: z.enum(["instagram", "tiktok", "youtube"]).default("instagram") })
output: { caption: string; hashtags: string[] }
limit:  ai.daily
```
Download is a route (section 4), so the browser can follow a redirect to the signed R2 URL.

### Settings (A7)

```typescript
// getUsage (read)
output: {
  week: { renders: { used: number; limit: number }; resetsAt: string };
  today: { videos: { used: number; limit: number }; aiRewrites: { used: number; limit: number } };
  plan: Plan;
  recent: { date: string; videoTitle: string; action: "script" | "render"; status: string }[];
}

// updateDefaults
input:  z.object({ defaultLength: LengthMode.optional(), defaultVoiceId: VoiceId.optional(), defaultFormat: Format.optional() })
output: { saved: true }

// deleteAccount — requires typing the account email to confirm
input:  z.object({ confirmEmail: z.string().email() })
output: { scheduledFor: string }   // hard delete within 30 days; signs the user out
```
`getUsage` never returns costs, credits or provider names.

### Admin (A8) — `auth: "admin"`

```typescript
// getAdminOverview (read)
output: {
  generationPaused: boolean;
  today: { activeUsers: number; videos: number; failures: number; avgRenderMs: number };
  budgets: { gemini: { used: number; limit: number }; elevenlabs: { used: number; limit: number } };
  queues: Record<"ai" | "voice" | "render" | "publish", { waiting: number; active: number; failed: number }>;
}

// resetUserPassword    input: z.object({ userId: z.string(), newPassword: z.string().min(8).max(128) })  output: { reset: true }
//                      // sets a temporary password (hashed via Better Auth) and signs the user out everywhere
// setUserSuspended     input: z.object({ userId: z.string(), suspended: z.boolean() })    output: { suspended: boolean }
// setGenerationPaused  input: z.object({ paused: z.boolean(), queue: z.enum(["all", "ai", "voice", "render", "publish"]).default("all") })
//                      output: { paused: boolean }
// adminRetryVideo      input: z.object({ videoId: Id })                                   output: { status: VideoStatus }  // any workspace
```
Every admin action writes an audit line to the logs (who, what, when).

### v1: brand kit (A9)

```typescript
// saveBrandKit
input: z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  font: z.enum(["Geist", "Inter", "Poppins", "Montserrat", "DM Sans"]),
  captionStyle: z.enum(["bold-outline", "pill", "minimal"]),
  showLogo: z.boolean(),
  logoKey: z.string().nullable(),      // from /api/uploads/sign
  introKey: z.string().nullable(),
  outroKey: z.string().nullable(),
  defaultVoiceId: VoiceId.nullable(),
  ctaText: z.string().max(80).nullable(),
})
output: { saved: true }
// resetBrandKit  input: z.object({})  output: { saved: true }
```
Uploaded keys must start with `users/{userId}/brand/` (checked server-side).

### v1: social and scheduling (A10, A11)

```typescript
// schedulePost
input: z.object({
  videoId: Id, socialAccountId: Id,
  caption: z.string().max(2200),
  publishAt: z.string().datetime().nullable(),   // null = post now
  timezone: z.string().max(64),                  // IANA, for display only
})
output: { postId: string; publishAt: string }

// reschedulePost  input: z.object({ postId: Id, publishAt: z.string().datetime() })  output: { publishAt: string }
// cancelPost      input: z.object({ postId: Id })                                    output: { cancelled: true }
// disconnectSocialAccount input: z.object({ accountId: Id })                         output: { disconnected: true }

// listScheduledPosts (read)
input:  z.object({ from: z.string().datetime(), to: z.string().datetime(), accountId: Id.optional() })
output: { items: { id: string; videoId: string; title: string; publishAt: string; status: PostStatus; permalink?: string }[] }
```
`publishAt` must be at least 5 minutes ahead and at most 60 days ahead. The video must have a `done` final render.

### v1: billing (A12)

```typescript
// startCheckout     input: z.object({ plan: z.enum(["creator", "pro"]), interval: z.enum(["month", "year"]) })  output: { url: string }
// openBillingPortal input: z.object({})                                                                       output: { url: string }

// getBilling (read)
output: { plan: Plan; renewsAt?: string; paymentStatus: PaymentStatus; usage: { used: number; limit: number };
          invoices: { date: string; amountCents: number; status: "paid" | "open" | "failed"; pdfUrl: string }[] }
```
Plan changes only take effect from the Stripe webhook, never from these actions.

---

## 4. Route handlers

| Route | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/api/auth/[...all]` | GET, POST | — | Better Auth | Better Auth (email + password, session cookie) |
| `/api/events/[videoId]` | GET | user (owner) | — | `text/event-stream` of `VideoEvent` (section 5) |
| `/api/videos/[id]/timeline` | GET | user (owner) | `?version=` optional | `302` to signed R2 URL of `timeline.json` (1 h) |
| `/api/videos/[id]/download` | GET | user (owner) | `?renderId=` optional | `302` to signed R2 URL of the MP4 (1 h, `Content-Disposition: attachment`) |
| `/api/uploads/sign` (v1) | POST | user | `{ kind: "logo" \| "font" \| "intro" \| "outro", contentType, size }` | `{ key, url, expiresAt }` signed PUT (10 min) |
| `/api/oauth/instagram/start` (v1) | GET | user | — | `302` to Instagram OAuth (state cookie) |
| `/api/oauth/instagram/callback` (v1) | GET | user | `?code=&state=` | `302` to Settings → Connections with `?connected=1` or `?error=` |
| `/api/webhooks/stripe` (v1) | POST | Stripe signature | Stripe event | `200` (idempotent via `stripeEvents`) |
| `/api/health` | GET | — | — | `{ ok: true, version }` |

Upload limits (checked before signing): logo PNG/SVG/WebP ≤ 2 MB, font WOFF2/TTF ≤ 2 MB, intro/outro MP4 ≤ 25 MB, brand total ≤ 100 MB.

---

## 5. Live progress (SSE)

```typescript
// packages/shared/src/api/events.ts
export type VideoEvent =
  | { type: "status"; status: VideoStatus; stage: Stage | null; progress: number }        // 0–100
  | { type: "step"; stage: Stage; state: "started" | "done" | "failed"; detail?: string }  // e.g. "7 scenes · 74 words"
  | { type: "script"; scriptVersion: number }                                              // client refetches getVideo
  | { type: "claims"; total: number; toReview: number }
  | { type: "render"; renderId: string; progress: number }                                 // every 10%
  | { type: "done"; renderId: string }
  | { type: "error"; stage: Stage; code: ErrorCode; message: string };                     // user-safe message
```

- The worker publishes each event to Redis channel `video:{id}`; the route relays it as `event: <type>` / `data: <json>`.
- On connect the route first sends a `status` snapshot from MongoDB, so a reconnect never misses state.
- Heartbeat comment every 15 s; the browser's `EventSource` reconnects automatically when Vercel closes the stream.

---

## 6. Limits per endpoint

| Limit key | Applies to | Beta value | Counter (Redis) |
| --- | --- | --- | --- |
| `videos.daily` | `createVideo`, `duplicateVideo` | 10 / day | `limit:{userId}:videos:{date}` |
| `ai.daily` | `brainstormIdeas`, `regenerateScene`, `addScene(ai)`, `writePostCaption` | 30 / day | `limit:{userId}:ai:{date}` |
| `finals.weekly` | `renderFinal` | 2 / week | `limit:{userId}:finals:{isoWeek}` |
| `active.jobs` | `createVideo`, `regenerateScene` | 2 running | `active:{userId}` |
| `active.render` | `renderFinal` | 1 running | `active:{userId}` |
| global pause / budgets | every action that enqueues | admin switch, 80% Gemini, 90% ElevenLabs | `flag:pause:*`, `global:*` |
| `signup.ip` | `POST /api/auth/sign-up/email` | 5 / hour / IP | Better Auth rate limit (MongoDB `rateLimit` collection) |
| `signin.ip` | `POST /api/auth/sign-in/email` | 10 / minute / IP | Better Auth rate limit (MongoDB `rateLimit` collection) |

Counters increment when a job is accepted and are refunded if the job fails before spending provider credits. With paid plans (v1) the values come from `workspaces.plan`.

---

## 7. Job payloads (web → worker)

```typescript
// packages/shared/src/jobs.ts
export const Queues = { ai: "ai", voice: "voice", render: "render", publish: "publish" } as const;

export const ScriptJob          = z.object({ videoId: Id, runId: Id });
export const RegenerateSceneJob = z.object({ videoId: Id, runId: Id, sceneIndex: z.number().int(), instruction: z.string().max(200).optional(), baseVersion: z.number().int() });
export const FactcheckJob       = z.object({ videoId: Id, runId: Id, scriptVersion: z.number().int(), sceneIndexes: z.array(z.number().int()).optional() });
export const VoiceJob           = z.object({ videoId: Id, runId: Id, renderId: Id, scriptVersion: z.number().int() });
export const RenderJob          = z.object({ videoId: Id, runId: Id, renderId: Id, scriptVersion: z.number().int(), kind: z.enum(["final", "preview"]) });
export const PublishJob         = z.object({ postId: Id });   // v1, delayed until publishAt
```

| Job | Queue | Job ID | Next on success |
| --- | --- | --- | --- |
| `script` | ai | `vid:{id}:script:v{n}` | `factcheck` |
| `regenerate-scene` | ai | `vid:{id}:scene{i}:v{n}` | `factcheck` (that scene) |
| `factcheck` | ai | `vid:{id}:factcheck:v{n}` | status → `previewed`, estimated timeline written |
| `voice` | voice | `vid:{id}:voice:v{n}` | `render` |
| `render` | render | `vid:{id}:render:v{n}` | status → `rendered`, `done` event |
| `publish` | publish | `post_{postId}` | post → `published` |

Payloads carry IDs only; the worker always reads the current data from MongoDB, so a job can never act on a stale copy.

---

## 8. Database changes this API needs

Small additions to the [Database Design](https://claude.ai/artifact/FP5BPiXzyp9cUYTLNtUGpQ), driven by the approved screens:

| Change | Why |
| --- | --- |
| `videos.format` (`promo` \| `explainer` \| `story` \| `tips` \| `recap` \| `quote`) | Create screen format chips; library format column |
| `videos.factcheck.claims[].acceptedAt` (Date, nullable) | `acceptClaim` ("Mark as OK" on Storyboard and editor) |
| `scenes[].role` (optional label: Hook, Feature, Proof, Offer, Outro…) | Storyboard frame labels; written by Gemini, editable |
| `workspaces.settings.defaultFormat` | Settings → Defaults |
| `scriptVersions.source` adds `"reordered"`, `"scene-added"`, `"scene-deleted"` | Undo history for Storyboard edits |
| `invites` collection removed (migration `2026-10-23-drop-invites`) | Sign-up is open; no waitlist or invites |
| Better Auth `account` holds the password hash; new `rateLimit` collection | Email + password sign-in with per-IP limits |

---

## 9. Testing the API

- **Unit:** every Zod schema with valid and invalid samples; the `action()` wrapper (auth, scoping, limits, error mapping).
- **Integration:** each action against a test MongoDB + Redis with a fake queue; checks `NOT_FOUND` for another workspace's video, `CONFLICT` on stale `expectedVersion`, `LIMIT_REACHED` at the boundary.
- **Contract:** worker tests consume the same job schemas, so a payload change breaks the build, not production.
- **End to end:** Playwright flow over staging: sign in → create → watch SSE progress → storyboard edit → render → download.
