# Clipwise — Steps E and F QA record

Date: 2026-10-26. Result: built and validated; awaiting user review and Step F Git checkpoint.

## Automated validation

- `pnpm check`: lint, workspace TypeScript and 163 tests passed.
- Web production build with `NEXT_DIST_DIR=.next-check` passed.
- Regression coverage includes edit ownership, concurrent saves with the same version, history restoration, add/reorder/delete, stale render versions, duplicate render starts, matching/missing voice files, missing completed MP4 recovery, internal render ceiling, final retry with a newer re-check run, safe library search and download authorization.

## Manual browser validation

| Area | Result |
| --- | --- |
| Narration autosave and animation edits | Saved and reflected in preview |
| Invalid narration then render | Stayed in editor with Not saved and corrective message |
| Undo, redo and version history restore | Saved new versions; original content restored |
| Add blank scene and delete it | Scene count, indices and selection updated |
| Editor pointer drag and keyboard reorder | Scene order saved |
| Storyboard pointer drag and keyboard reorder | Scene order saved and retained after reload |
| Fact-check acknowledgement | Review note became user-approved |
| Concurrent tabs | Stale save refused with reload banner; newer edit preserved |
| Final render | Existing audio reused; completed MP4 and thumbnail stored |
| Failed-final retry | Saved script retained; fixture voice stage and final render completed |
| Completed playback | Browser reported 1080 × 1920, duration 30.866667s, readyState 4, no media error |
| MP4 download | File saved; SHA-256 matched stored MP4 |
| Editing a rendered video | Previous MP4 remained downloadable with its script version; latest edits labelled as needing another render |
| Library | Search, status filters, pagination, list/grid and no-match state passed |
| Responsive layout | Checked desktop and 390px mobile width; library page width remained 390px |
| Clean Remotion mount | Interactive studio moved to client mount to avoid server/client floating-point style differences |

## Code-review fixes

- Rendering flushes valid pending edits; invalid or failed drafts remain pending and block render.
- Failed undo/redo does not consume its history entry.
- Render starts compare saved versions and reuse existing requests; reuse checks physical media as well as metadata.
- A background fact-check run cannot cause a failed final render retry to rewrite its approved script.
- Downloads check sign-in, workspace ownership, final/completed status and file existence before issuing a temporary attachment URL.
- Library dates use a consistent locale/timezone; old MP4 versions are identified explicitly.
- Editor and storyboard share pointer-based drag handling, including pointer capture/cancellation and a fixed first hook scene. Keyboard arrows provide another way to reorder.

## Isolation and cost

Temporary MongoDB replica set, Redis DB 14, dedicated local storage under `out/qa-step-f`, QA-only account and Next.js on port 3001. The normal development database, user videos and `.env` were not modified by these manual fixtures.

Two local MP4 renders used an already saved recording. Provider responses for edit re-checks and the retry's voice stage were fixtures. External Gemini requests: 0. External ElevenLabs requests/credits: 0. Fresh live-provider generation and cloud-bucket delivery were not retested; validation used local storage.

Step E checkpoint: `2188ec8` (pushed). Step F and its QA fixes remain local until approved. The QA preview is temporary and depends on its harness process staying running.
