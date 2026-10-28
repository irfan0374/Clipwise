import { UsageEvent } from "@clipwise/db";
import { redis } from "./redis";

// Global free-tier budgets. Redis counters are fast copies; usageEvents in MongoDB is the source of truth,
// so the worker rebuilds the counters on start and a Redis restart never resets a budget to zero.

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const month = (d = new Date()) => d.toISOString().slice(0, 7);

// Not namespaced on purpose: staging and live use the same provider keys, so they share one budget.
export const budgetKeys = {
  geminiRequests: (d = new Date()) => `global:gemini:requests:${day(d)}`,
  elevenLabsCredits: (d = new Date()) => `global:elevenlabs:${month(d)}`,
};

export const budgetLimits = () => ({
  /** Gemini free tier: about 20 requests per model per day, 4 models in GEMINI_MODEL. */
  geminiRequestsPerDay: Number(process.env.GEMINI_DAILY_REQUESTS ?? 80),
  elevenLabsCreditsPerMonth: Number(process.env.ELEVENLABS_MONTHLY_CREDITS ?? 10_000),
});

// Check-and-reserve in one Redis step, so two jobs can never both take the last of a budget.
const RESERVE = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local n = tonumber(ARGV[1])
if used + n > tonumber(ARGV[2]) then return -1 end
local total = redis.call('INCRBY', KEYS[1], n)
redis.call('EXPIRE', KEYS[1], ARGV[3])
return total`;

export const reserve = async (key: string, n: number, limit: number, ttlSeconds: number) =>
  ((await redis().eval(RESERVE, 1, key, n, limit, ttlSeconds)) as number) >= 0;

/** Reserves one Gemini request against today's budget. False = budget used up (nothing reserved). */
export const reserveGeminiRequest = () =>
  reserve(budgetKeys.geminiRequests(), 1, budgetLimits().geminiRequestsPerDay, 2 * 24 * 3600);

/** Reserves ElevenLabs credits against this month's budget. False = not enough left (nothing reserved). */
export const reserveElevenLabsCredits = (credits: number) =>
  reserve(budgetKeys.elevenLabsCredits(), credits, budgetLimits().elevenLabsCreditsPerMonth, 40 * 24 * 3600);

/** Gives back credits reserved for a request that failed (ElevenLabs doesn't charge failed requests). */
export async function releaseElevenLabsCredits(credits: number) {
  if (credits > 0) await redis().decrby(budgetKeys.elevenLabsCredits(), credits);
}

export async function budgetStatus() {
  const [gemini, eleven] = await redis().mget(budgetKeys.geminiRequests(), budgetKeys.elevenLabsCredits());
  const limits = budgetLimits();
  return {
    gemini: { used: Number(gemini ?? 0), limit: limits.geminiRequestsPerDay },
    elevenlabs: { used: Number(eleven ?? 0), limit: limits.elevenLabsCreditsPerMonth },
  };
}

/**
 * Restores today's and this month's counters from usageEvents if they are missing (e.g. after a Redis restart).
 * Existing counters are never overwritten (SET NX): they include reservations for requests still in flight,
 * which MongoDB doesn't know about yet, and several workers may start at once.
 */
export async function rebuildBudgetCounters(now = new Date()) {
  const dayStart = new Date(`${day(now)}T00:00:00.000Z`);
  const monthStart = new Date(`${month(now)}-01T00:00:00.000Z`);
  const [gemini] = await UsageEvent.aggregate<{ n: number }>([
    { $match: { provider: "gemini", unit: "requests", createdAt: { $gte: dayStart } } },
    { $group: { _id: null, n: { $sum: "$quantity" } } },
  ]);
  const [eleven] = await UsageEvent.aggregate<{ n: number }>([
    { $match: { provider: "elevenlabs", unit: "credits", createdAt: { $gte: monthStart } } },
    { $group: { _id: null, n: { $sum: "$quantity" } } },
  ]);
  const [g, e] = await redis()
    .multi()
    .set(budgetKeys.geminiRequests(now), gemini?.n ?? 0, "EX", 2 * 24 * 3600, "NX")
    .set(budgetKeys.elevenLabsCredits(now), eleven?.n ?? 0, "EX", 40 * 24 * 3600, "NX")
    .exec()
    .then((r) => (r ?? []).map(([, v]) => v === "OK"));
  return {
    geminiRequests: gemini?.n ?? 0,
    elevenLabsCredits: eleven?.n ?? 0,
    restored: { gemini: !!g, elevenlabs: !!e },
  };
}
