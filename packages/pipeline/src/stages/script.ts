import { readFile } from "node:fs/promises";
import path from "node:path";
import { curatedIcons } from "@clipwise/video/icons";
import { repoRoot } from "../env";
import { askGemini, parseJsonReply } from "../gemini";
import { type Length, lengthRules } from "../types";

const promptPath = path.join(repoRoot, "packages/pipeline/prompts/script.md");

export const buildPrompt = async (topic: string, length: Length, feedback: string[] = [], { images = true } = {}) => {
  const rules = lengthRules[length];
  let prompt = (await readFile(promptPath, "utf8"))
    .replaceAll("{{topic}}", topic)
    .replaceAll("{{length}}", String(length))
    .replaceAll("{{minWords}}", String(rules.minWords))
    .replaceAll("{{maxWords}}", String(rules.maxWords))
    .replaceAll("{{minScenes}}", String(rules.minScenes))
    .replaceAll("{{maxScenes}}", String(rules.maxScenes))
    .replaceAll("{{icons}}", curatedIcons.join(", "))
    .replaceAll(
      "{{wordsPerScene}}",
      // Per-scene target from the top of the budget: the model tends to write short, so aim high.
      String(Math.round(rules.maxWords / ((rules.minScenes + rules.maxScenes) / 2))),
    );
  if (!images) {
    prompt += `\n\nPhotos are not available for this video. Do not use the "imageFocus" template; use "title", "bullets" and "stat" only.`;
  }
  if (feedback.length) {
    prompt += `\n\nYour previous attempt had these problems. Fix all of them:\n${feedback.map((f) => `- ${f}`).join("\n")}`;
  }
  return prompt;
};

export type ScriptAttempt = { raw: unknown; tokens: number; attempts: number; model: string };

/** One Gemini call. Returns unvalidated JSON. */
export const generateScript = async (
  topic: string,
  length: Length,
  feedback: string[] = [],
  { images = true } = {},
): Promise<ScriptAttempt> => {
  const prompt = await buildPrompt(topic, length, feedback, { images });
  // JSON mode without a response schema: Gemini rejects schemas this nested ("invalid argument").
  // The shape is spelled out in the prompt and every reply is checked with Zod in validate.ts.
  const answer = await askGemini({ prompt, json: true });
  return { raw: parseJsonReply(answer.text), tokens: answer.tokens, attempts: answer.attempts, model: answer.model };
};
