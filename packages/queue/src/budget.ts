import { UsageEvent } from "@clipwise/db";
import { ns } from "./namespace";
import { redis } from "./redis";

// Global free-tier budgets. Redis counters are fast copies; usageEvents in MongoDB is the source of truth,
// so the worker rebuilds the counters on start and a Redis restart never resets a budget to zero.

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const month = (d = new Date()) => d.toISOString().slice(0, 7);

// Staging and live use the same provider keys, so they share one budget. Each environment counts its own part
// (rebuildable from its own database) and every check adds up all the parts: a worker restoring its counter after
// Redis lost data can then never forget what the other environment spent.
const SHARED_ENVS = ["staging", "live"];
const envPart = () => ns().replace(/:$/, "") || "dev";
const envParts = () => [...new Set([envPart(), ...SHARED_ENVS])];

export const budgetKeys = {
  /** This environment's part of today's Gemini count. */
  geminiRequests: (d = new Date(), env = envPart()) => `global:gemini:requests:${day(d)}:${env}`,
  /** This environment's part of this month's ElevenLabs count. */
  elevenLabsCredits: (d = new Date(), env = envPart()) => `global:elevenlabs:${month(d)}:${env}`,
};

/** This environment's key first (the one that grows), then every environment's part of the same budget. */
const partKeys = (key: (d: Date, env: string) => string, d = new Date()) => [
  key(d, envPart()),
  ...envParts()
    .filter((e) => e !== envPart())
    .map((e) => key(d, e)),
];

export const budgetLimits = () => ({
  /** Gemini free tier: about 20 requests per model per day, 4 models in GEMINI_MODEL. */
  geminiRequestsPerDay: Number(process.env.GEMINI_DAILY_REQUESTS ?? 80),
  elevenLabsCreditsPerMonth: Number(process.env.ELEVENLABS_MONTHLY_CREDITS ?? 10_000),
});

// Check-and-reserve in one Redis step, so two jobs can never both take the last of a budget. KEYS[1] is the
// counter that grows; any further keys only count towards the total (other environments' parts of a budget).
const RESERVE = `
local used = 0
for i = 1, #KEYS do used = used + tonumber(redis.call('GET', KEYS[i]) or '0') end
local n = tonumber(ARGV[1])
if used + n > tonumber(ARGV[2]) then return -1 end
redis.call('INCRBY', KEYS[1], n)
redis.call('EXPIRE', KEYS[1], ARGV[3])
return used + n`;

export const reserve = async (key: string | string[], n: number, limit: number, ttlSeconds: number) => {
  const keys = Array.isArray(key) ? key : [key];
  return ((await redis().eval(RESERVE, keys.length, ...keys, n, limit, ttlSeconds)) as number) >= 0;
};

/** Reserves one Gemini request against today's budget. False = budget used up (nothing reserved). */
export const reserveGeminiRequest = () =>
  reserve(partKeys(budgetKeys.geminiRequests), 1, budgetLimits().geminiRequestsPerDay, 2 * 24 * 3600);

/** Reserves ElevenLabs credits against this month's budget. False = not enough left (nothing reserved). */
export const reserveElevenLabsCredits = (credits: number) =>
  reserve(partKeys(budgetKeys.elevenLabsCredits), credits, budgetLimits().elevenLabsCreditsPerMonth, 40 * 24 * 3600);

/** Gives back credits reserved for a request that failed (ElevenLabs doesn't charge failed requests). */
export async function releaseElevenLabsCredits(credits: number) {
  if (credits > 0) await redis().decrby(budgetKeys.elevenLabsCredits(), credits);
}

/** Both budgets as used by every environment together. */
export async function budgetStatus() {
  const geminiKeys = partKeys(budgetKeys.geminiRequests);
  const values = await redis().mget(...geminiKeys, ...partKeys(budgetKeys.elevenLabsCredits));
  const sum = (vs: (string | null)[]) => vs.reduce((total, v) => total + Number(v ?? 0), 0);
  const limits = budgetLimits();
  return {
    gemini: { used: sum(values.slice(0, geminiKeys.length)), limit: limits.geminiRequestsPerDay },
    elevenlabs: { used: sum(values.slice(geminiKeys.length)), limit: limits.elevenLabsCreditsPerMonth },
  };
}

// Raises a counter to at least ARGV[1], never lowers it. 1 = it was raised.
const RAISE = `
local current = tonumber(redis.call('GET', KEYS[1]) or '-1')
local n = tonumber(ARGV[1])
if current >= n then return 0 end
redis.call('SET', KEYS[1], n, 'EX', ARGV[2])
return 1`;

/**
 * Restores this environment's part of today's and this month's counters from its usageEvents (e.g. after Redis
 * lost data). A counter is only ever raised to what MongoDB recorded, never lowered: it may include reservations
 * for requests still in flight, which MongoDB doesn't know about yet, and several workers may start at once.
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
  const [g, e] = await Promise.all([
    redis().eval(RAISE, 1, budgetKeys.geminiRequests(now), gemini?.n ?? 0, 2 * 24 * 3600),
    redis().eval(RAISE, 1, budgetKeys.elevenLabsCredits(now), eleven?.n ?? 0, 40 * 24 * 3600),
  ]).then((r) => r.map((v) => v === 1));
  return {
    geminiRequests: gemini?.n ?? 0,
    elevenLabsCredits: eleven?.n ?? 0,
    restored: { gemini: !!g, elevenlabs: !!e },
  };
}
