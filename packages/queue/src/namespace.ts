// Staging and live share one Redis database (the free plan has only one), so every key, queue and channel of an
// environment starts with REDIS_NAMESPACE (e.g. "staging:" / "live:"). The global provider budgets are the
// exception (budget.ts): both environments use the same Gemini and ElevenLabs keys, so they share one count.
export const ns = () => process.env.REDIS_NAMESPACE ?? "";

/** A Redis key inside this environment's namespace. */
export const nsKey = (key: string) => `${ns()}${key}`;

/** BullMQ key prefix for this environment (queues and workers must use the same one). */
export const bullPrefix = () => `${ns()}bull`;
