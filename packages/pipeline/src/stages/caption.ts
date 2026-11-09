import { z } from "zod";
import type { VideoFormat } from "../formats";
import { askGemini, parseJsonReply } from "../gemini";
import type { Script } from "../types";

// Kept in code (not a .md file) because the web app bundles this module and can't read repo files at runtime.
const PROMPT = `You write the Instagram Reel caption for a short video.

Video title: {{title}}
Format: {{format}}
What the voiceover says:
{{narration}}

Write a caption that makes people want to watch and save the Reel:
- 1 to 3 short sentences, in the same language as the voiceover, natural and specific to this video (no generic filler like "Check this out!").
- Only facts that the voiceover says. Never add statistics, prices, dates or promises it doesn't contain.
- At most one emoji, or none.
- Then a blank line and 3 to 6 relevant hashtags (lowercase, no spaces inside a hashtag).
- At most 400 characters in total.

Return only one JSON object: { "caption": string }
`;

const CaptionReply = z.object({ caption: z.string().trim().min(5).max(2200) });

/** One Gemini call: an Instagram caption (with hashtags) written from the video's own script. */
export const writeCaption = async (script: Script, format: VideoFormat) => {
  const prompt = PROMPT.replaceAll("{{title}}", script.title)
    .replaceAll("{{format}}", format)
    .replaceAll("{{narration}}", script.scenes.map((s) => s.narration.trim()).join("\n"));
  const answer = await askGemini({ prompt, json: true, temperature: 0.8 });
  const parsed = CaptionReply.safeParse(parseJsonReply(answer.text));
  if (!parsed.success) throw new Error("Caption reply had no usable caption");
  return { caption: parsed.data.caption.slice(0, 2200), tokens: answer.tokens, model: answer.model };
};
