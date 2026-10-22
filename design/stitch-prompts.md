# Clipwise — Stitch prompts for the app screens

Paste each prompt into the **same Stitch project as the v3 homepage** (Web, desktop), one at a time.
Generate **A2 Create first**: it defines the sidebar the other screens reuse.
If a screen stalls, paste only its first paragraph plus sections 1–2, then add the rest with "Add below: …".

Theme: Paper `#F6F7F2` background, white panels with `#E7E7E0` borders, ink `#0F0F0F`, lime `#C6F432` (only the one main action), teal `#14B8A6` (status), Sora headings, Inter body, Lucide icons.

---

## Design system prompt (only if your Stitch project doesn't have the Clipwise design system yet)

```text
Create a design system and style tile for "Clipwise", a web app (desktop, 1440px wide) where creators, brands and educators turn any idea into short AI videos (Reels, Shorts, TikToks): explainers, product promos, stories, tips and more.

Mood: modern, minimal, slightly futuristic. Calm and clean, with one vibrant accent used sparingly. Think Linear or Vercel, but light and warm.

Colours:
- Page background: Paper off-white #F6F7F2
- Cards and panels: pure white #FFFFFF, 1px border #E7E7E0
- Text: ink #0F0F0F (primary), #5C5C57 (secondary), #8A8A84 (muted/placeholder)
- Primary accent: lime #C6F432. Use ONLY as a fill: the main call-to-action button (dark #0F0F0F text on it), the logo mark, and the start of progress bars. Never lime text on light backgrounds.
- Secondary accent: teal #14B8A6 for status badges, success states, links and the end of progress bars. Use darker teal #0F766E for teal text; badge background #CCFBF1.
- Ink black #0F0F0F for the active sidebar item and selected chips (white text on it).
- Warning amber #F59E0B (badge bg #FEF3C7, text #92400E); error red #EF4444 (badge bg #FEE2E2, text #991B1B).

Typography:
- Headings: Sora, semibold/bold, tight letter-spacing (-0.5px). H1 32px, H2 24px, H3 18px.
- Body and UI: Inter, regular/medium. Body 15px, small 13px, labels 12px.
- Numbers like percentages and durations: Inter with tabular figures.

Shape and spacing:
- 8px spacing grid, generous whitespace.
- Cards 12px radius, buttons and inputs 8px radius, chips and badges fully rounded.
- Flat design: 1px borders, almost no shadows. The only glow is a soft lime glow behind the primary button.

Components to show on the style tile:
- Buttons: primary (lime fill, ink text, soft glow), secondary (white, 1px border), ghost (text only), destructive (red text).
- Inputs: text field, large topic textarea, select, segmented control (30s / 60s / Auto), toggle.
- Chips (selected = ink black), status badges (Fact-checked teal, Rendering lime, Draft grey, Failed red, Scheduled teal outline).
- Progress bar: 6px, rounded, gradient lime #C6F432 to teal #14B8A6.
- Card, table row, empty state, toast, modal, tooltip.
- Icons: Lucide-style 1.5px line icons.

Layout shell for app screens:
- Left sidebar 240px on the Paper background: logo "Clipwise" with a small lime rounded square, nav items Create, Videos, Calendar, Brand kit, Settings (Lucide icons), active item as an ink-black pill with white text; a usage meter and the user's avatar at the bottom.
- Content area: max width 1120px, page title in Sora, white cards on Paper.
- Subtle 150ms transitions on hover and focus; visible focus ring in teal.
```

---

## MVP screens

### A1 · Sign-in and waitlist

```text
Clipwise sign-in page, desktop 1440px. Use this project's Clipwise design system (Paper #F6F7F2, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for the main action, teal #14B8A6 for status, Sora headings, Inter body, Lucide icons). Modern, futuristic, minimal. No emoji, no fake numbers.

Split screen.
Left half: centered white card 420px wide. Lime square logo + "Clipwise". Heading "Welcome back" (Sora). Subtext "Sign in to turn your next idea into a video." One full-width white button with the Google "G" logo: "Continue with Google". Small muted note: "Private beta: only invited emails can sign in." and a teal text link "Join the waitlist".

Right half: Paper background with a faint dot grid. A floating composition (no phone): a white prompt card reading "Launch video for our new running shoes" with a blinking cursor, connected by thin dashed lines to three small floating chips: "Script ready" (teal dot), "Voice: Liam" (mic icon), "Captions synced" (waveform icon). A soft lime glow behind it.

Also show a second state of the left card for a non-invited account: amber badge "You're on the waitlist", text "We'll email you as soon as a spot opens.", secondary button "Back to home".
```

### A2 · Create video (paste this first; it defines the app shell)

```text
Clipwise "Create" screen, desktop 1440px web app. Use this project's Clipwise design system (Paper #F6F7F2, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for the main action, teal #14B8A6 for status, Sora headings, Inter body, Lucide icons). Modern, futuristic, minimal. No emoji, no fake numbers.

APP SHELL (reuse on every app screen): left sidebar 232px on Paper with lime square logo "Clipwise"; nav Create, Videos, Calendar, Brand kit, Settings with Lucide icons; active item is an ink-black pill with white text; at the bottom a small meter "Renders this week 1 / 2" (lime-to-teal bar) and the user's avatar and name.

MAIN (centered, max 760px):
1. Heading "What do you want to make?" (Sora 36px), subtext "Describe an idea. Clipwise writes, checks, voices and animates it."
2. Large white prompt panel: multi-line input with placeholder "Launch video for our new running shoes", counter "0 / 300". Below it a row of controls: format chips (Promo, Explainer, Story, Tips, Recap, Quote; one selected in ink black), length segmented control (30s / 60s / Auto), voice dropdown "Liam" with a small play button. Right-aligned lime button "Write my video" with a sparkle icon and soft glow. Muted note under it: "Preview is free. A voice is only recorded when you render."
3. "Need an idea?" row: a slim input "Your niche, e.g. fitness, AI, cooking" with a secondary "Suggest ideas" button; below it 4 compact idea rows (title, one-line hook, length chip, "Use" text button) in a single white list panel with dividers.
4. "Recent" strip: 3 slim horizontal rows (small thumbnail, title, status badge Rendered teal / Preview ready grey / Failed red, time ago).
```

### A3 · Generating and render progress

```text
Clipwise "Generating" screen, desktop 1440px web app with the same left sidebar as the Create screen. Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for progress and the main action, teal #14B8A6 for completed steps, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji.

MAIN, two columns:
Left (560px): breadcrumb "Videos / Launch video for our new running shoes", title in Sora. A white panel with a vertical pipeline of 4 steps joined by a thin line that fills lime-to-teal:
- "Writing the script" done: teal check, meta "7 scenes · 74 words · 6s".
- "Checking facts" active: spinning lime ring, "Verifying 4 claims…".
- "Preview" waiting: grey ring, "Plays here when ready".
- "Voice and render" locked: lock icon, muted "Starts when you click Render".
Below: overall bar (6px, lime to teal) at 45% and "About 15 seconds left". Footer: ghost "Cancel" and muted "You can leave this page. We'll keep working."
Right: a 9:16 preview frame (dark, rounded 24px) showing a shimmering skeleton with an outline of an animated graphic, captioned "Preview loading".

Show two extra small variants underneath as cards:
1. Render state: "Recording voice" done ("29.6s · Liam"), "Rendering video" active 68% ("1080 × 1920 · about 1 min left"), "Ready" waiting.
2. Error state: "Checking facts" with a red alert icon, "Something went wrong while checking facts.", lime "Retry" button; earlier steps stay done.
```

### A4 · Video editor

If Stitch stalls, generate the top bar and three columns first, then "Add below: the fact-check strip".

```text
Clipwise video editor, desktop 1440px web app. Sidebar collapsed to a 64px icon rail. Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for the Render button and the playhead, teal #14B8A6 for status, Sora + Inter, Lucide icons). Feels like a calm pro video tool, like the editor panel on the homepage. No emoji.

TOP BAR: back arrow, editable title "Launch video for our new running shoes", grey badge "Preview ready", chips "30s" and "Voice: Liam", undo/redo icons, secondary "Regenerate", lime "Render video" with glow and tiny note "Uses 1 of 2 renders this week".

THREE COLUMNS:
1. Left 320px "Scenes": 7 compact scene rows, selected one with a 2px ink border. Each row: number, small icon of its visual type (orbit, bars, flow, compare...), first line of narration in grey, timing "0:04–0:09".
2. Center: 9:16 player (360 × 640, dark, rounded 24px) showing a bold product scene: "Velocity Phantom X", lime "-30%" sticker, white captions with one word in lime. Under it: play, "0:06 / 0:30", scrubber with scene tick marks, and muted "Silent preview · timing estimated".
3. Right 360px "Scene 2" inspector with tabs Script / Visual. Script tab: narration textarea, up to 3 on-screen text lines, template select, ghost "Rewrite with AI". (Visual tab as a small inset: 3 × 3 tiles Icon, Flow, Compare, Bars, Orbit, Waves, Particles, Network, Cycle; Orbit selected; colour swatches.)

BOTTOM STRIP (full width): "Fact-check" panel with teal shield icon, "4 claims checked · 1 fixed · 1 to review"; rows with scene number, claim, badge (Correct teal / Fixed lime / Review amber); the amber row has "Edit scene" and "Mark as OK".
```

### A4b · Storyboard tab (default view of the editor)

The first thing users see when a script is ready: every scene at a glance, approved before any voice credits are spent. "Edit" switches to the A4 editor.

```text
Clipwise video editor in STORYBOARD view, desktop 1440px web app, sidebar collapsed to a 64px icon rail. Use this project's Clipwise design system (Paper #F6F7F2, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for the "Render video" button, teal #14B8A6 for status, amber for review flags, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji, no fake numbers.

TOP BAR (same as the editor): back arrow, title "Launch video for our new running shoes", grey badge "Preview ready", chips "30s" and "Voice: Liam", and a segmented tab control "Storyboard | Edit" with Storyboard selected (ink pill). Right: secondary "Regenerate", lime "Render video" with soft glow and tiny note "Uses 1 of 2 renders this week".

UNDER THE TOP BAR: a thin full-width timing bar showing how the 30 seconds are split into 7 coloured segments labelled 1–7, with a muted total "0:30 · 7 scenes · 74 words". A small line "Fact-check: 4 claims checked · 1 to review" with a teal shield icon.

MAIN: a grid of 7 storyboard frames, 4 per row (second row has 3 plus an "Add scene" dashed tile). Each frame is a white card:
- top: a 9:16-cropped dark thumbnail (shown as a 4:5 crop) with that scene's animated graphic (orbit, bars, flow arrows, compare cards, big number, product name) and its on-screen text in white;
- below: "Scene 2 · 0:04–0:09" in small caps, the narration line in ink (2 lines max), and a row of tiny actions: edit (pencil), regenerate (refresh), change visual (shapes), drag handle.
Scene 5 has an amber "Review" badge on its thumbnail and an amber note under the narration: "Check this number: '3.2s faster' needs a source." Scene 1 is labelled "Hook".

BOTTOM BAR: muted text "Happy with the plan? Rendering records the voice and builds the final video." and on the right a ghost "Open in editor" and the lime "Looks good, render video".
```

### A5 · Videos library

```text
Clipwise "Videos" library, desktop 1440px web app with the same left sidebar ("Videos" active). Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for "New video", teal #14B8A6 for status, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji. Do NOT use a grid of tall phone cards.

1. Header: "Your videos" (Sora) with a small count "12", search field "Search videos", filter chips All / Rendered / Preview ready / In progress / Failed (All in ink black), sort "Newest", lime "New video" button.
2. One large white panel with a clean list (table-like rows, 72px tall, 1px dividers). Each row: a small square thumbnail with an abstract graphic, title (one line), format chip (Promo, Explainer, Story, Tips, Recap, Quote), length "30s" or "60s", status badge (Rendered teal, Preview ready grey, Rendering lime with a thin inline progress bar at 68%, Failed red with a "Retry" link), created "2 days ago", and a "⋯" menu (Open, Download, Duplicate, Delete). Show 8 rows with a mix of statuses. Hovering a row highlights it with #F0F1EA.
3. Right side of the header: a view toggle (List / Grid icons), list selected.
4. Empty state variant below as a separate card: a line-art outline of a video frame with a small lime sparkle, heading "Make your first video", text "Describe an idea and Clipwise does the rest.", lime "Create video".
```

### A6 · Video ready

```text
Clipwise "Video ready" screen, desktop 1440px web app with the same left sidebar. Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for "Download MP4", teal #14B8A6 for status, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji, no view counts.

1. Slim success banner at the top: teal check, "Your video is ready", muted "Rendered in 2 min 54 s".
2. Two columns:
   Left: large 9:16 player (405 × 720, dark, rounded 24px) with sound on, showing a product promo frame with captions; a thin progress bar on top and standard controls below.
   Right: white panel. Title "Launch video for our new running shoes" (Sora). Chips: "30 s", "1080 × 1920 · 30fps", "Voice: Liam", teal badge "Fact-checked".
   Buttons stacked: lime "Download MP4" with download icon; secondary "Schedule to Instagram" with a small teal "Soon" badge; ghost "Edit and re-render".
   "Post caption" box: an AI-written caption with 4 hashtags, "Copy" button and ghost "Rewrite".
   "Details" list with dividers: Created, Script version 3, Renders left this week "1 of 2".
3. Bottom: "Make another" as one horizontal white panel with 3 idea rows separated by vertical dividers (title + "Create" text button), not cards.
```

### A7 · Settings and usage

```text
Clipwise "Settings" screen, desktop 1440px web app with the same left sidebar ("Settings" active). Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 for meters and the one main action, teal #14B8A6 for status, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji. Never show costs or AI provider names.

Layout: title "Settings" (Sora), a secondary vertical menu on the left of the content (Account, Defaults, Usage, Connections, Billing) with "Usage" selected as an ink pill, content panels on the right (max 760px).

USAGE (selected):
1. Panel "This week": three meters in a row, each with label, big Sora number and a thin lime-to-teal bar: "Renders 1 / 2", "New videos today 3 / 10", "AI rewrites today 4 / 30". Muted "Resets every Monday".
2. Panel "Plan": teal outline badge "Private beta", text "Free during the beta.", secondary "See plans".
3. Panel "Recent activity": rows with date, video title, action (Script, Render), status badge.

Also show, as two smaller panels beside or below:
- ACCOUNT: Google avatar, name and email (read-only, Google badge), secondary "Sign out"; danger zone row with red text button "Delete account" and note "Removes your videos and data within 30 days."
- DEFAULTS: length segmented control (30s / 60s / Auto), default voice list (Liam, Jessica, George) with play buttons, default format select.
```

### A8 · Admin

Only you see this screen; it's the one place provider budgets appear.

```text
Clipwise admin dashboard, desktop 1440px web app with the same left sidebar plus an "Admin" item with a shield icon (active). Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 for meters and the "Invite" button, teal #14B8A6 healthy, amber warning, red error, Sora + Inter, Lucide icons). Feels like a calm mission-control. No emoji.

1. Header: "Admin" (Sora) and on the right a large switch "Generation running" (teal); its off state reads "Paused" in red.
2. Four compact stat tiles in one white strip with vertical dividers: "Active users 12", "Videos today 23", "Failures today 2" with an amber dot, "Avg render 2m 51s".
3. Panel "Free-tier budgets": two wide meters with lime-to-teal fill and small tick marks at 50%, 80%, 100%: "Gemini requests today 41 / 80" and "ElevenLabs credits this month 3,250 / 10,000".
4. Two panels side by side:
   - "Invites": email input + lime "Invite"; list rows (email, badge Invited / Waitlist / Accepted, date, "⋯" with Approve and Revoke).
   - "Needs attention": rows of failed or stuck videos (title, user, stage badge "factcheck" or "render", time) with "Retry" and "View log".
5. Panel "Users": table with avatar, name, email, videos this week, renders this week, status (Active teal / Suspended red), "⋯" (View usage, Suspend).
```

---

## v1 screens

### A9 · Brand kit

```text
Clipwise "Brand kit" screen, desktop 1440px web app with the same left sidebar ("Brand kit" active). Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for "Save brand kit", teal #14B8A6 for status, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji.

Two columns:
Left (settings in one tall white panel split by 1px dividers, not separate cards):
- Logo: dashed drop zone "Drop PNG, SVG or WebP up to 2 MB" with current logo thumbnail, "Replace" and "Remove"; toggle "Show logo in the corner".
- Colours: two swatches with hex inputs, Accent #3B82F6 and Background #0B0B0F, plus a row of 6 preset pairs.
- Font: select showing Geist, Inter, Poppins, Montserrat, DM Sans, each written in its own font.
- Captions: three small radio tiles with mini previews: Bold outline, Pill, Minimal.
- Voice: default voice select (Liam, Jessica, George) with play buttons.
- Call to action: input "Follow for more".
- Intro and outro: two slim upload slots "MP4 up to 25 MB".
Right (sticky): one 9:16 live preview (dark, rounded 24px) showing a sample scene in the chosen accent colour, font and caption style, logo in the top corner; muted note "Applies to new renders".

Bottom bar: ghost "Reset to default" and lime "Save brand kit".
```

### A10 · Connect Instagram and schedule

```text
Two Clipwise screens, desktop 1440px web app with the same left sidebar. Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only for the one main action, teal #14B8A6 for connected/success, amber for warnings, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji.

A) Settings > Connections:
- Instagram row in a white panel: Instagram logo, "Post Reels straight from Clipwise. Works with Business and Creator accounts.", secondary "Connect Instagram".
- Same row connected: avatar, "@yourbrand", teal badge "Connected", "Creator account", muted "Access renews automatically", ghost "Disconnect".
- Same row needing attention: amber badge "Reconnect needed", short reason, lime "Reconnect".
- Two greyed rows with "Coming soon": TikTok, YouTube Shorts.

B) "Schedule post" modal over a dimmed video page:
- Left: small 9:16 thumbnail with "30 s".
- Right: "Post to" account select "@yourbrand" with Instagram icon; caption textarea pre-filled with an AI caption and hashtags, counter "312 / 2,200", ghost "Rewrite caption"; segmented "Post now / Schedule" with Schedule selected; date picker and time picker side by side; timezone label "Asia/Kolkata".
- Footer: ghost "Cancel", lime "Schedule Reel".
```

### A11 · Content calendar

```text
Clipwise "Calendar" screen, desktop 1440px web app with the same left sidebar ("Calendar" active). Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 for today's marker and "Schedule a video", teal #14B8A6 for published, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji.

1. Header: "Calendar" (Sora), month switcher "‹ November 2026 ›", Month / Week toggle (Month in ink), account chip "@yourbrand", lime "Schedule a video".
2. Month grid in one large white panel: 7 columns Mon–Sun, thin 1px grid lines, today's date in a lime circle. Days hold slim post pills (no thumbnails): coloured left edge, time "7:00 PM" and a truncated title. Pill styles: Scheduled (white, teal outline), Published (soft teal fill, check icon), Failed (soft red fill, alert icon). About 10 posts spread across the month, roughly 3 per week.
3. Right side panel 320px for the selected day: date heading, list of that day's posts (small 9:16 thumbnail, title, time, status badge) with actions "Edit", "Reschedule", red "Cancel". An empty day shows "Nothing scheduled" and a ghost "Schedule a video".
```

### A12 · Plans and billing

Prices and limits are the PRD's draft pricing and may change before launch.

```text
Clipwise "Plans" page and Settings > Billing, desktop 1440px web app with the same left sidebar. Use this project's Clipwise design system (Paper, white panels, 1px #E7E7E0 borders, ink #0F0F0F, lime #C6F432 only on the recommended plan's button, teal #14B8A6 for checkmarks and status, Sora + Inter, Lucide icons). Modern, futuristic, minimal. No emoji.

A) Plans:
- Heading "Pick your plan" (Sora) with a Monthly / Yearly toggle (Yearly shows teal "2 months free").
- Four plan columns in one wide white panel separated by 1px dividers (not four floating cards):
  Free $0: 3 videos a month, 720p with watermark, download only; secondary "Current plan".
  Creator $19/month: 30 videos, 1080p, no watermark, 1 brand kit, schedule to 3 accounts; column highlighted with a soft lime tint and a lime "Most popular" tag; lime "Upgrade".
  Pro $49/month: 100 videos, all voices, 3 brand kits, 10 accounts; secondary "Upgrade".
  Business $99+/month: 250 videos, team seats, priority rendering; secondary "Contact us".
  Every feature line has a teal check.
- Short FAQ accordion: What counts as a video? Can I cancel anytime? What happens to my videos if I downgrade? Do unused videos roll over?

B) Settings > Billing:
- Panel "Current plan": "Creator" badge, "$19 / month", "Renews on 14 Dec 2026", meter "18 / 30 videos this month" (lime-to-teal), secondary "Change plan", ghost "Manage billing".
- Panel "Invoices": rows with date, amount, teal "Paid" badge, download icon.
- Variant: amber banner "Your last payment failed. Update your card to keep Creator features." with lime "Update payment".
```
