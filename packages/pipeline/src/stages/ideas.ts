import { z } from "zod";
import { formatGuides, type VideoFormat } from "../formats";
import { askGemini, parseJsonReply } from "../gemini";

// Kept in code (not a .md file) because the web app bundles this module and can't read repo files at runtime.
const PROMPT = `You suggest ideas for short vertical videos (Instagram Reels, TikTok, YouTube Shorts).

Niche: {{niche}}
Format: {{format}}
{{formatGuide}}

Suggest 6 different video ideas for this niche and format. Each idea must be specific to this niche, never generic (for a travel niche, not "travel tips" but "how to pack 10 days of clothes in one backpack"; use the niche you were given, not travel), useful or surprising to a real viewer, and doable as a 30 or 60 second video with animated graphics and a voiceover (no filming needed).
Never invent statistics, prices or claims; the idea title is a topic, not a promise.

Return only one JSON object:
{
  "ideas": [
    {
      "title": string,            // the video topic, max 90 characters, written like a prompt the creator would type
      "hook": string,             // the opening line viewers hear, max 100 characters
      "suggestedLength": "30" | "60"
    }
  ]
}
`;

export const IdeaSchema = z.object({
  title: z.string().trim().min(3).max(120),
  hook: z.string().trim().max(160).default(""),
  suggestedLength: z.preprocess((v) => String(v).replace(/s$/, ""), z.enum(["30", "60"])).catch("60"),
});
export type Idea = z.infer<typeof IdeaSchema>;

/** Reads ideas leniently: bad items are skipped; a reply with no usable idea is an error. */
export const readIdeas = (reply: unknown): Idea[] => {
  const list = Array.isArray(reply) ? reply : (reply as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) throw new Error("Ideas reply has no ideas list");
  const ideas = list.flatMap((item) => {
    const parsed = IdeaSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  if (!ideas.length) throw new Error("Ideas reply had no usable ideas");
  return ideas.slice(0, 8);
};

/** One Gemini call: 4–8 specific video ideas for a niche and format. */
export const suggestIdeas = async (niche: string, format: VideoFormat = "explainer") => {
  const prompt = PROMPT.replaceAll("{{niche}}", niche)
    .replaceAll("{{format}}", format)
    .replaceAll("{{formatGuide}}", formatGuides[format].guide);
  const answer = await askGemini({ prompt, json: true, temperature: 0.9 });
  return { ideas: readIdeas(parseJsonReply(answer.text)), tokens: answer.tokens, model: answer.model };
};
