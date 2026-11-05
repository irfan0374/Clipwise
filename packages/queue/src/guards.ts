import { AllowanceExceededError, BudgetExceededError, type ProviderGuards } from "@clipwise/pipeline/web";
import { releaseElevenLabsCredits, reserveElevenLabsCredits, reserveGeminiRequest } from "./budget";
import {
  aiShareMessage,
  releaseFairAiRequest,
  releaseFairVoiceCredits,
  reserveFairAiRequest,
  reserveFairVoiceCredits,
  voiceShareMessage,
} from "./fair";

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
 * - Fair share: when `workspace()` names who is spending, the request is first taken from that workspace's own
 *   share (fair.ts), so one user can't use up the global budget for everyone. The CLI has no workspace share.
 * `record` writes usage rows for whoever is spending (a job's video, or the CLI's workspace).
 */
export const budgetGuards = (
  record: (rows: UsageRow[]) => Promise<void>,
  before: () => Promise<void> = async () => {},
  workspace: () => string | undefined = () => undefined,
): ProviderGuards => ({
  beforeGeminiRequest: async () => {
    await before();
    const ws = workspace();
    if (ws && !(await reserveFairAiRequest(ws))) throw new AllowanceExceededError(aiShareMessage());
    if (!(await reserveGeminiRequest())) {
      if (ws) await releaseFairAiRequest(ws);
      throw new BudgetExceededError("Gemini daily request budget used up");
    }
    await record([{ provider: "gemini", operation: "request", quantity: 1, unit: "requests" }]);
  },
  reserveVoiceCredits: async (credits) => {
    await before();
    const ws = workspace();
    if (ws && !(await reserveFairVoiceCredits(ws, credits))) throw new AllowanceExceededError(voiceShareMessage());
    if (!(await reserveElevenLabsCredits(credits))) {
      if (ws) await releaseFairVoiceCredits(ws, credits);
      throw new BudgetExceededError(`ElevenLabs monthly credit budget: not enough left for ${credits} credits`);
    }
  },
  releaseVoiceCredits: async (credits) => {
    await releaseElevenLabsCredits(credits);
    const ws = workspace();
    if (ws) await releaseFairVoiceCredits(ws, credits);
  },
  onVoiceTake: ({ credits, characters, model }) =>
    record([
      { provider: "elevenlabs", operation: "voice", model, quantity: credits, unit: "credits" },
      { provider: "elevenlabs", operation: "voice", model, quantity: characters, unit: "characters" },
    ]),
});
