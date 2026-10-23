import { FatalError } from "./retry";

/**
 * Spending hooks around every provider request. The worker installs them to enforce global budgets with
 * atomic reservations; the CLI runs without them. A hook throws BudgetExceededError to stop before spending.
 */
export type ProviderGuards = {
  /** Before each Gemini HTTP request (retries and model fallbacks included). */
  beforeGeminiRequest?: () => Promise<void>;
  /** Before each ElevenLabs request: reserve the credits it will cost. */
  reserveVoiceCredits?: (credits: number) => Promise<void>;
  /** The request failed (not charged): give the reservation back. */
  releaseVoiceCredits?: (credits: number) => Promise<void>;
  /** A take succeeded and was charged: record it right away. */
  onVoiceTake?: (take: { credits: number; characters: number; model: string }) => Promise<void>;
};

export class BudgetExceededError extends FatalError {}

let guards: ProviderGuards = {};

export const setProviderGuards = (next: ProviderGuards) => {
  guards = next;
};
export const providerGuards = () => guards;
