import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { repoRoot } from "../env";
import { askGemini, parseJsonReply } from "../gemini";
import type { Script } from "../types";

const promptPath = path.join(repoRoot, "packages/pipeline/prompts/factcheck.md");

export const ClaimSchema = z.object({
  scene: z.number().int(),
  text: z.string(),
  verdict: z.enum(["correct", "imprecise", "wrong", "unsure"]),
  fix: z.string().default(""),
});
export const FactCheckSchema = z.object({ claims: z.array(ClaimSchema) });
export type Claim = z.infer<typeof ClaimSchema>;
export type FactCheck = z.infer<typeof FactCheckSchema> & { model: string; searched: boolean; tokens: number };

/** Claims that must be fixed before the voice is recorded. */
export const issuesOf = (check: Pick<FactCheck, "claims">) => check.claims.filter((c) => c.verdict === "wrong" || c.verdict === "imprecise");

/** Turns issues into feedback the script writer can act on. */
export const factFeedback = (issues: Claim[]) => [
  ...issues.map((c) => `Fact error in scene ${c.scene}: "${c.text}" is ${c.verdict}.${c.fix ? ` Replace it with: "${c.fix}".` : " Remove it."}`),
  "Keep everything else the same. Keep the language simple. If you are not certain of a number, use a well-known qualitative statement instead.",
];

/**
 * Last resort for numbers still in doubt after rewriting: a stat scene becomes a bullets scene and a bar chart
 * becomes a single icon, so no doubtful number appears on screen. Returns the scenes changed.
 */
export const removeDoubtfulNumbers = (script: Script, issues: Claim[]) => {
  const changed: number[] = [];
  for (const index of new Set(issues.map((c) => c.scene))) {
    const scene = script.scenes.find((s) => s.index === index);
    if (!scene) continue;
    if (scene.template === "stat") {
      scene.template = "bullets";
      delete scene.stat;
      scene.visual = { type: "icon", icon: "lightbulb" };
      changed.push(index);
    } else if (scene.visual?.type === "bars") {
      scene.visual = { type: "icon", icon: scene.visual.items?.find((i) => i.icon)?.icon ?? "chart-column" };
      changed.push(index);
    }
  }
  return changed;
};

/** The parts of the script a viewer sees or hears, without layout fields the checker doesn't need. */
const checkable = (script: Script) =>
  script.scenes.map((s) => ({
    scene: s.index,
    narration: s.narration,
    onScreenText: s.onScreenText,
    ...(s.stat ? { stat: s.stat } : {}),
    // Only bar values are data; wave values just set the drawn wavelength.
    ...(s.visual?.type === "bars" ? { barChart: s.visual.items?.map((i) => ({ label: i.label, value: i.value })) } : {}),
  }));

/** Asks Gemini (with Google Search when the free tier allows it) to verify every claim in the script. */
export const factCheck = async (script: Script): Promise<FactCheck> => {
  const prompt = (await readFile(promptPath, "utf8")).replace("{{script}}", JSON.stringify(checkable(script), null, 2));
  const answer = await askGemini({ prompt, json: true, search: true, temperature: 0.2 });
  const parsed = FactCheckSchema.safeParse(parseJsonReply(answer.text));
  if (!parsed.success) throw new Error(`Fact-check reply was not valid JSON: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  return { ...parsed.data, model: answer.model, searched: answer.searched, tokens: answer.tokens };
};
