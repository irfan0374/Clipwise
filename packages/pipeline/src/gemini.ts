import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import { env } from "./env";
import { FatalError, withRetry } from "./retry";

const errorText = (error: unknown) => `${(error as Error)?.message ?? ""}`;
/** Free-tier daily limits reset at midnight Pacific; retrying the same model is pointless. */
const isDailyQuota = (error: unknown) => /PerDay|per day/i.test(errorText(error));
/** Some models reject a setting (thinking level, JSON mode, search) with a 400. */
const isUnsupported = (error: unknown) => (error as { status?: number })?.status === 400 || /INVALID_ARGUMENT|not found/i.test(errorText(error));

export type GeminiAnswer = { text: string; tokens: number; model: string; attempts: number; searched: boolean };

/**
 * One Gemini request, trying each model in GEMINI_MODEL in turn (each has its own free daily quota).
 * With `search`, Google Search grounding is tried first and dropped if the model or quota doesn't allow it.
 */
export const askGemini = async ({
  prompt,
  json = false,
  search = false,
  temperature = 0.8,
}: {
  prompt: string;
  json?: boolean;
  search?: boolean;
  temperature?: number;
}): Promise<GeminiAnswer> => {
  const { apiKey, models } = env.gemini();
  const ai = new GoogleGenAI({ apiKey });

  const configFor = (model: string, withSearch: boolean): GenerateContentConfig => ({
    temperature,
    // Search grounding can't be combined with JSON mode, so grounded answers are parsed from plain text.
    ...(json && !withSearch ? { responseMimeType: "application/json" } : {}),
    ...(withSearch ? { tools: [{ googleSearch: {} }] } : {}),
    // Low thinking keeps calls around 10 s; thinkingLevel is a Gemini 3 setting that 2.5 models reject.
    ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
  });

  for (const model of models) {
    for (const withSearch of search ? [true, false] : [false]) {
      try {
        const { value: response, attempts } = await withRetry(
          () => ai.models.generateContent({ model, contents: prompt, config: configFor(model, withSearch) }),
          { label: `Gemini ${model}`, tries: withSearch ? 1 : 3 },
        );
        return { text: readText(response), tokens: response.usageMetadata?.totalTokenCount ?? 0, model, attempts, searched: withSearch };
      } catch (error) {
        if (error instanceof FatalError) throw error;
        if (withSearch) continue; // search not available here: same model without it
        if (isDailyQuota(error) || isUnsupported(error)) {
          console.warn(`  ${model}: ${isDailyQuota(error) ? "free daily quota used up" : "not usable with this config"}; trying the next model`);
          break;
        }
        throw error;
      }
    }
  }
  throw new FatalError(`Every Gemini model in GEMINI_MODEL is out of free daily quota (${models.join(", ")}). Try again tomorrow or enable billing.`);
};

const readText = (response: GenerateContentResponse) => {
  const blocked = response.promptFeedback?.blockReason ?? (response.candidates?.[0]?.finishReason === "SAFETY" ? "SAFETY" : undefined);
  if (blocked) throw new FatalError(`Request rejected by Gemini safety filters (${blocked})`);
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
};

/** Parses JSON from a reply that may wrap it in prose or a ``` fence. */
export const parseJsonReply = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
    return { __invalidJson: text };
  }
};
