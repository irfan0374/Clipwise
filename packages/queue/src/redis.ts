import { Redis } from "ioredis";

const cache = globalThis as typeof globalThis & { __clipwiseRedis?: Redis };

export const redisUrl = () => process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

/**
 * A new Redis connection. BullMQ workers and subscribers need their own (blocking commands / pub-sub);
 * maxRetriesPerRequest: null is required by BullMQ workers.
 */
export const newRedis = (name: string) => {
  const conn = new Redis(redisUrl(), {
    maxRetriesPerRequest: null,
    connectionName: `clipwise:${name}`,
    lazyConnect: false,
  });
  conn.on("error", quietError(`redis:${name}`));
  return conn;
};

/**
 * Cloud Redis drops connections now and then (ECONNRESET); ioredis reconnects by itself. Without a listener every
 * drop prints "Unhandled error event" with a stack trace, so log one short line, at most every 30s per source.
 */
export const quietError = (source: string) => {
  let last = 0;
  return (err: Error) => {
    const now = Date.now();
    if (now - last < 30_000) return;
    last = now;
    console.warn(`[${source}] ${err.message} (reconnecting)`);
  };
};

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
