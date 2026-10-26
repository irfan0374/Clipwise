# Step G — settings, allowances and admin QA

Date: 2026-10-26. State: ready for user review; no commit/push. Last committed checkpoint remains `2188ec8` (Step E). Step F changes remain alongside Step G locally.

## Delivered

- Settings Account, Defaults and Usage tabs, including self-service password change UI, sign-out, workspace defaults and safe beta allowances/activity. Create reads persisted format, duration and voice defaults.
- Admin-only users/workspaces with email/name search and pagination; running/failed pipeline lists, saved run reports, queue health and provider budget summaries.
- Queue pause/resume, workspace suspension/reactivation, eligible retry and beta password reset. Server-side role checks protect every operation; audit rows record actor, action, target and pending/ok/failed status without credential values.
- Fresh account roles and workspace suspension checked per server request. Admission/worker/provider guards block suspended workspaces before charging. Voice sample, usage, SSE and download routes enforce suspension.
- Monday UTC final-render accounting, reservation date refreshed on retry, failed renders excluded, failed queue submission releases its reservation. Daily refunds use the original reservation date and cannot produce negative counters.

## Automated verification

`pnpm check` passed: 180 tests across shared (10), storage (5), pipeline (81), database (12), queue (3), web (31), worker (38). All lint and TypeScript checks passed. `NEXT_DIST_DIR=.next-check pnpm --filter @clipwise/web build` and `git diff --check` passed.

New tests cover settings scope and validation; denial of all five admin actions and page access to regular users; audit success/failure; protected admin/self operations; suspension/reactivation and session revocation; password hashing/reset with a mocked Better Auth adapter and audit omission of credentials; fresh roles and deleted accounts; search/pagination; queue pause/resume; suspended AI/voice work without credit reservation; UTC daily refunds; weekly boundaries and enqueue failure recovery.

## Browser verification

Temporary fixtures on port 3002, in-memory MongoDB replica set, Redis DB 13, isolated storage and Next output. Both admin and ordinary fixture users used. No real user account or production data modified.

- Defaults persisted after reload; Create selected Story, 30s and Jessica without generating a video. Workspace rename persisted.
- Account and usage pages render correctly, showing reset times and only user-facing allowances. Provider budget details stay in Admin.
- Global pause/resume changed all three queues and created successful audit entries.
- Suspension changed the member workspace status and blocked access after member sign-in. Reactivation restored Create access.
- Run report dialog opened. Admin search returned the expected empty state. Reset dialog inspected only; password replacement not executed in the browser.
- An ordinary member received the admin 404 and had no Admin navigation item in the mobile menu.
- Desktop 1440 × 1000 and mobile 390 × 844 layouts inspected. Mobile document width equalled the viewport; the admin table scrolls within its panel. Temporary viewport override reset.

## Review fixes and limits

Fixed BullMQ queue-count type usage; preserved owner-scoped not-found behavior before workspace enforcement on final renders; transient recheck database errors propagate instead of being swallowed; added UI failure toasts; fixed retry reservation recovery.

No live generation-provider requests, external credits, new MP4 renders or real password changes were needed. Password reset behavior is adapter-mocked, not a live end-to-end credential-change test. Queue pause lets an already-running stage finish. Suspension is checked before subsequent provider requests; it cannot recall a request already sent. Previously issued signed file URLs remain valid until their existing expiry (up to one hour).

Next: user review and fixes, approved Git checkpoint, then Step H plan for polish, monitoring, deployment and private beta.
