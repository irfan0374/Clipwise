import { curatedIcons } from "@clipwise/video/icons";
import { formatGuides, type VideoFormat } from "../formats";
import { askGemini, parseJsonReply } from "../gemini";
import { type Scene, SceneSchema, type Script } from "../types";
import { countWords, fixUnknownIcons, repairVisual } from "./validate";

// Kept in code (not a .md file) because the web app bundles this module and can't read repo files at runtime.
const PROMPT = `You edit one scene of a short vertical video script (Instagram Reels, TikTok, YouTube Shorts).

Video topic: {{topic}}
Format: {{format}}
{{formatGuide}}

The whole script, for context (JSON):
{{script}}

Rewrite scene {{index}} ({{position}}).
{{instruction}}
Keep it about {{words}} words of narration (1–2 short sentences) so the video keeps its length, and make it flow from the scene before into the scene after.

Rules:
- Plain language a 14-year-old understands. One idea per scene.
- Only use well-established facts and numbers. Never invent statistics, studies, prices or sources. For a promo, only use product details from the topic above.
- "onScreenText": 1–3 short lines (max 6 words each) that support the narration; never repeat it word for word.
- "template": "title" (a headline), "bullets" (1–3 lines) or "stat" (one well-established number: "value" has a digit and max 6 characters, e.g. "92%", "3x").
- "visual" is required for title and bullets scenes and not allowed on stat scenes. Types: "icon" (one icon), "flow" (2–4 items with icon + label), "compare" (exactly 2 items with icon + label), "bars" (2–4 items with label + numeric value, only for real numbers), "orbit" (centre icon, up to 6 items), "waves" (1–3 items with label + value 1–10), "particles" (motion scatter/flow/rise/collapse, optional icon), "network" (optional icon, up to 4 items with icon), "cycle" (3–4 items with icon + label). Labels max 18 characters. Colours: blue, red, yellow, green, purple, orange, cyan, white.
- Icons: use only these names: {{icons}}

Return only one JSON object, the new scene:
{ "index": {{index}}, "narration": string, "template": "title" | "bullets" | "stat", "onScreenText": string[], "stat"?: { "value": string, "label": string }, "visual"?: { "type": string, "icon"?: string, "items"?: [{ "icon"?: string, "label"?: string, "value"?: number, "color"?: string }], "motion"?: string, "color"?: string } }
`;

/** Reads the rewritten scene; fixes what can be fixed (index, visual, icons) and rejects the rest. */
export const readScene = (reply: unknown, index: number): Scene => {
  const raw = reply && typeof reply === "object" && "scene" in reply ? (reply as { scene: unknown }).scene : reply;
  const parsed = SceneSchema.safeParse({ ...(raw as object), index });
  if (!parsed.success) throw new Error(`Rewritten scene is invalid: ${parsed.error.issues[0]?.message}`);
  const scene = parsed.data;
  if (scene.template === "imageFocus") {
    scene.template = "bullets";
    delete scene.imageQuery;
  }
  if (scene.template === "stat" && (!scene.stat || !/\d/.test(scene.stat.value) || scene.stat.value.length > 6)) {
    // A number that doesn't fit the rules is not shown: keep the scene as points.
    scene.template = "bullets";
    delete scene.stat;
  }
  scene.onScreenText = scene.onScreenText.slice(0, 3);
  repairVisual(scene);
  fixUnknownIcons({ scenes: [scene] } as Script);
  return scene;
};

const position = (index: number, count: number) =>
  index === 0
    ? "the hook: it must surprise or ask a question and take under 3 seconds to say"
    : index === count - 1
      ? "the last scene: end with a short call to action"
      : `scene ${index + 1} of ${count}`;

/** One Gemini call: a new version of one scene that fits the rest of the script. */
export async function rewriteScene(opts: {
  script: Script;
  index: number;
  topic: string;
  format: VideoFormat;
  instruction?: string;
}) {
  const { script, index, topic, format } = opts;
  const current = script.scenes[index];
  if (!current) throw new Error(`No scene ${index}`);
  const others = script.scenes.filter((_, i) => i !== index);
  const avg = others.length ? others.reduce((n, s) => n + countWords(s.narration), 0) / others.length : 15;
  const isBlank = current.narration.startsWith("Write what the voice says");
  const words = Math.max(6, Math.round(isBlank ? avg : countWords(current.narration)));
  const instruction = opts.instruction?.trim()
    ? `The creator asks: "${opts.instruction.trim().replace(/"/g, "'")}".`
    : isBlank
      ? "This is a new, empty scene: write what belongs here."
      : "Write a fresh, better version of it.";
  const prompt = PROMPT.replaceAll("{{topic}}", topic.replace(/"/g, "'"))
    .replaceAll("{{format}}", format)
    .replaceAll("{{formatGuide}}", formatGuides[format].guide)
    .replaceAll("{{script}}", JSON.stringify(script.scenes.map(({ imageQuery: _, ...s }) => s)))
    .replaceAll("{{index}}", String(index))
    .replaceAll("{{position}}", position(index, script.scenes.length))
    .replaceAll("{{instruction}}", instruction)
    .replaceAll("{{words}}", String(words))
    .replaceAll("{{icons}}", curatedIcons.join(", "));
  const answer = await askGemini({ prompt, json: true, temperature: 0.8 });
  return { scene: readScene(parseJsonReply(answer.text), index), tokens: answer.tokens, model: answer.model };
}
