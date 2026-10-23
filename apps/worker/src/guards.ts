import { BudgetExceededError, setProviderGuards } from "@clipwise/pipeline";
import { releaseElevenLabsCredits, reserveElevenLabsCredits, reserveGeminiRequest } from "@clipwise/queue";
import { jobContext, recordUsage } from "./context";

/**
 * Budget guards around every provider request made by a job:
 * - Gemini: one request is reserved atomically before each HTTP call (retries and fallbacks included) and
 *   recorded as a usage row right away, so the daily counter can be rebuilt from MongoDB.
 * - ElevenLabs: the take's credits are reserved before each call, released if the call fails, and recorded
 *   as soon as the take is charged (even if a later take or step fails).
 */
export function installBudgetGuards() {
  setProviderGuards({
    beforeGeminiRequest: async () => {
      if (!(await reserveGeminiRequest())) throw new BudgetExceededError("Gemini daily request budget used up");
      const ctx = jobContext.getStore();
      if (ctx) await recordUsage(ctx, [{ provider: "gemini", operation: "request", quantity: 1, unit: "requests" }]);
    },
    reserveVoiceCredits: async (credits) => {
      if (!(await reserveElevenLabsCredits(credits))) {
        throw new BudgetExceededError(`ElevenLabs monthly credit budget: not enough left for ${credits} credits`);
      }
    },
    releaseVoiceCredits: (credits) => releaseElevenLabsCredits(credits),
    onVoiceTake: async ({ credits, characters, model }) => {
      const ctx = jobContext.getStore();
      if (!ctx) return;
      await recordUsage(ctx, [
        { provider: "elevenlabs", operation: "voice", model, quantity: credits, unit: "credits" },
        { provider: "elevenlabs", operation: "voice", model, quantity: characters, unit: "characters" },
      ]);
    },
  });
}
