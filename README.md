# Clipwise — pipeline prototype

Turns a tech or science topic into a 30s or 60s vertical (1080×1920) explainer video:
Gemini script → ElevenLabs voice + timestamps → Remotion motion graphics and word-synced captions.

All visuals are drawn by Remotion (title, bullets, stat). Stock photos are an optional extra that stays off unless `PIXABAY_API_KEY` or `PEXELS_API_KEY` is set.

Design: [Pipeline Technical Design and Prototype Plan](https://claude.ai/code/artifact/ae0b3815-1950-4e48-9cbc-ace979104af7) · [PRD](https://claude.ai/code/artifact/f8f8abca-e939-4ba5-bc6a-b7eac21a3d68)

## Setup

1. `pnpm install`
2. Fill in `.env` (copied from `.env.example`). Both have free tiers:
   - `GEMINI_API_KEY` — https://aistudio.google.com/apikey
   - `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` — https://elevenlabs.io (pick a voice in the Voice Library, copy its ID)
3. Check rendering works without any keys: `pnpm sample` → `out/sample/sample.mp4`

## Usage

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

## Layout

```
packages/pipeline   stage functions (script, validate, voice, images, align, render) + run orchestrator
packages/video      Remotion project: Explainer composition, 4 templates, captions, theme
apps/cli            `clipwise` command
```

## Credits and limits

- **Gemini free tier:** about 20 requests per model per day. `GEMINI_MODEL` lists several models; when one runs out the next takes over. A video uses 2–6 requests (script + fact-check, plus rewrites).
- **ElevenLabs free plan:** 10,000 credits a month (about 15 videos on the draft model). The pipeline refuses a voiceover that would go past `ELEVENLABS_MONTHLY_CREDITS`. Use `--preview` for anything that doesn't need sound.

## Notes

- Rendering uses Remotion's Chrome for Testing mode; the default headless shell crashes on macOS 26.
- The ElevenLabs free plan is non-commercial and requires attribution; upgrade before real users.
- Pixabay and Pexels ask for credit where possible; photographer names are saved in `images.json`.
