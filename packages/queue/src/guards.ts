import { BudgetExceededError, type ProviderGuards } from "@clipwise/pipeline/web";
import { releaseElevenLabsCredits, reserveElevenLabsCredits, reserveGeminiRequest } from "./budget";

export type UsageRow = {
  provider: "gemini" | "elevenlabs";
  operation: string;
  model?: string;
  quantity: number;
  unit: "requests" | "credits" | "characters";
};

/**
 * Budget guards for every provider request, shared by the worker and the CLI so all spending counts against
 * the same global budgets:
 * - Gemini: one request reserved atomically before each HTTP call (retries and fallbacks included), then
 *   recorded as a usage row (counters can be rebuilt from MongoDB).
 * - ElevenLabs: a take's credits reserved before each call, released if it fails, recorded once charged.
 * `record` writes usage rows for whoever is spending (a job's video, or the CLI's workspace).
 */
export const budgetGuards = (record: (rows: UsageRow[]) => Promise<void>): ProviderGuards => ({
  beforeGeminiRequest: async () => {
    if (!(await reserveGeminiRequest())) throw new BudgetExceededError("Gemini daily request budget used up");
    await record([{ provider: "gemini", operation: "request", quantity: 1, unit: "requests" }]);
  },
  reserveVoiceCredits: async (credits) => {
    if (!(await reserveElevenLabsCredits(credits))) {
      throw new BudgetExceededError(`ElevenLabs monthly credit budget: not enough left for ${credits} credits`);
    }
  },
  releaseVoiceCredits: (credits) => releaseElevenLabsCredits(credits),
  onVoiceTake: ({ credits, characters, model }) =>
    record([
      { provider: "elevenlabs", operation: "voice", model, quantity: credits, unit: "credits" },
      { provider: "elevenlabs", operation: "voice", model, quantity: characters, unit: "characters" },
    ]),
});
