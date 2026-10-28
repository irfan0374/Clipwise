import { Redis } from "ioredis";

const cache = globalThis as typeof globalThis & { __clipwiseRedis?: Redis };

export const redisUrl = () => process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

/**
 * A new Redis connection. BullMQ workers and subscribers need their own (blocking commands / pub-sub);
 * maxRetriesPerRequest: null is required by BullMQ workers.
 */
export const newRedis = (name: string) =>
  new Redis(redisUrl(), { maxRetriesPerRequest: null, connectionName: `clipwise:${name}`, lazyConnect: false });

/** Shared connection for counters, flags and publishing (cached across hot reloads). */
export const redis = () => {
  cache.__clipwiseRedis ??= newRedis("shared");
  return cache.__clipwiseRedis;
};

export const closeRedis = async () => {
  // The shared video-events subscriber (events.ts) lives on its own connection.
  const sub = (globalThis as typeof globalThis & { __clipwiseSub?: { conn: Redis } }).__clipwiseSub;
  if (sub) {
    (globalThis as typeof globalThis & { __clipwiseSub?: unknown }).__clipwiseSub = undefined;
    await sub.conn.quit().catch(() => {});
  }
  if (cache.__clipwiseRedis) {
    await cache.__clipwiseRedis.quit();
    cache.__clipwiseRedis = undefined;
  }
};
