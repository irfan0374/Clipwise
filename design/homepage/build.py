# Builds index.html from Stitch's export: fixes inaccurate copy and adds GSAP + Lenis motion.
# Usage: python3 build.py   (re-run after re-exporting stitch-v3-original.html)
import re
from pathlib import Path

here = Path(__file__).parent
html = (here / "stitch-v3-original.html").read_text()

copy_fixes = [
    ("Clipwise v3 — Precision Generative Video Engine", "Clipwise — Turn any idea into short videos"),
    ("adds captions with deterministic frame pacing and native 60fps render cycles.", "adds captions. Ready to post in minutes."),
    ("1080p 60fps", "1080p"),
    ("Voice: Liam (UK)", "Voice: Liam"),
    ("Karaoke Sync", "Captions synced"),
    ("Deterministic Pipeline", "How it works"),
    ("workspace_canvas_v3.clip", "running-shoes-launch"),
    ("Compute Node Active", "Building"),
    ("GPT-4o Vision Fine-tune", "AI script"),
    ("Synthesize Script &amp; Storyboard", "Write my video"),
    ("Snapping: Frame-exact", "Synced to the voice"),
    ("Track 1 · Kinetic Scenes", "Scenes"),
    ("Track 2 · Master Waveform", "Voice"),
    ("Track 3 · Dynamic Captions", "Captions"),
    ("Layer lock enabled", "Preview is free"),
    ("4 tracks synchronized", "3 tracks in sync"),
    ("1080 × 1920 (FHD 60fps)", "1080 × 1920 · 30fps"),
    ("Inference Engine", "Voice"),
    ("Clipwise Core v2.4 Multi-Model", "Liam · Energetic"),
    ("Fact-check grounded via live web schema.", "Every claim checked before the voice is recorded."),
    ("Render Master Reel", "Render video"),
    ("Adaptive Aesthetics", "Formats"),
    ("Tailored motion and narrative pacing for every content type. The motion engine adapts cadence, transitions, and kinetic typography.",
     "Promos, explainers, stories and more. Each format gets its own pacing, layouts and captions."),
    ("STYLE · PRODUCT SPEED", "FORMAT · PRODUCT PROMO"),
    ("Auto-calibrated: 120BPM", "Fast cuts"),
    ("ENGINEERING PREVIEW #084", "NEW DROP"),
    ("Tier 1 Verified", "Free shipping"),
    ("Transition: Hard Snap", "Transition: Snap"),
    ("Audio: Sub-bass Kick", "Voice: Liam"),
    ("CANVAS PREVIEW", "PREVIEW"),
    ("Core System Capabilities", "Features"),
    ("Engineered for creative throughput", "Everything a short video needs"),
    ("Every scene animated at native 60fps", "Every scene animated"),
    ("No static slideshows. Every visual element follows programmatic spring curves, easing physics, and dynamic vector transformation.",
     "No static slideshows. Each scene gets a moving illustration: orbits, charts, flows and more."),
    ("Natural voice synthesis", "Natural AI voices"),
    ("Clean human timbre with adaptive cadence matching and automatic breath insertion.",
     "Pick a voice that fits your brand. Timing is tuned to your video length."),
    ("Liam · Confident British", "Liam · Energetic"),
    ("Maya · Crisp North American", "Jessica · Expressive"),
    ("Marcus · Narrative Deep", "George · Storyteller"),
    ("48kHz", "Preview"),
    ("Exact syllable timestamps for karaoke styling, bounce transitions, and custom brand colorways.",
     "Word-by-word captions, perfectly synced to the voice."),
    ("Lock font pairings, hex tokens, and vector watermarks once. Clipwise applies them to every reel automatically.",
     "Set your colours, fonts and logo once. Clipwise applies them to every video."),
    ("Tokens locked", "Brand kit"),
    ("Automated factual verification layer parses scripts against search indices before video synthesis.",
     "A second AI pass checks every claim and number before the voice is recorded."),
    ("Primary source verified", "Claims checked"),
    ("Claim timestamped", "Wrong numbers fixed"),
    ("Hallucination check passed", "Doubtful stats removed"),
    ("Private Beta Cohort 04", "Free beta"),
    ("Turn thoughts, docs and notes into ready-to-post short video reels in minutes. Request an access key today.",
     "Turn any idea into a ready-to-post Reel, Short or TikTok in minutes."),
    ("Single-seat beta keys issued daily", "Free during the beta"),
    # Open sign-up (email + password): no waitlist, every CTA goes to Create account
    ("Now in private beta", "Now in open beta"),
    ("Get early access", "Get started free"),
    ("AI video synthesis platform", "Ideas in. Videos out."),
    ("© 2026 Clipwise Inc. All rights reserved.", "© 2026 Clipwise"),
]
for old, new in copy_fixes:
    if old not in html:
        raise SystemExit(f"copy fix not found: {old!r}")
    html = html.replace(old, new)

# Drop the "API" footer link: there is no public API.
html = re.sub(r'<a [^>]*href="#">API</a>\s*', "", html)

# Stitch's voice track draws a stretched curve that reads as slashes; replace it with audio-style bars.
import math
bars = []
for i, x in enumerate(range(3, 500, 6)):
    h = 2 + 15 * abs(math.sin(i * 0.37) * math.sin(i * 0.11 + 1)) ** 0.8
    bars.append(f"M{x} {20 - h:.1f}V{20 + h:.1f}")
html, n = re.subn(r'<path d="M 0 20 Q[^"]*"[^>]*stroke="#0F0F0F"[^>]*></path>',
                  f'<path d="{" ".join(bars)}" fill="none" stroke="#0F0F0F" stroke-width="2.4" stroke-linecap="round"></path>', html)
assert n == 1, "voice waveform path not found"

# Hooks the motion script needs.
html, n = re.subn(r'(<span class="[^"]*")>Reels</span>(\s*</h1>)', r'\1 id="cycle-word">Reels</span>\2', html)
assert n == 1, "cycling word span not found"

motion = (here / "motion.js").read_text()
inject = f"""
<script src="https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/ScrollTrigger.min.js"></script>
<style>
  .cw-nav-scrolled {{ transform: scale(0.97); box-shadow: 0 8px 24px rgba(15,15,15,0.06); background: rgba(255,255,255,0.82); backdrop-filter: blur(12px); }}
  .cw-nav {{ transition: transform .3s ease, box-shadow .3s ease, background .3s ease; }}
  #cycle-word {{ display: inline-flex; overflow: hidden; vertical-align: bottom; white-space: nowrap; }}
  #cycle-word .cw-w {{ display: inline-block; }}
  .cw-active-pill {{ background: #0F0F0F !important; color: #fff !important; }}
</style>
<script>
{motion}
</script>
"""
html = html.replace("</body></html>", inject + "</body></html>")
(here / "index.html").write_text(html)
print("wrote index.html")
