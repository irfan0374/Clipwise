import { videoChannel as baseChannel, type VideoEvent } from "@clipwise/shared";
import type { Redis } from "ioredis";
import { nsKey } from "./namespace";
import { newRedis, redis } from "./redis";

// Redis pub/sub is shared by every database on a server (unlike keys and queues), so a namespace keeps
// test events (REDIS_NAMESPACE=test:) out of a dev worker's live log.
const videoChannel = (videoId: string) => nsKey(baseChannel(videoId));

export const publishVideoEvent = (videoId: string, event: VideoEvent) =>
  redis().publish(videoChannel(videoId), JSON.stringify(event));

type Listener = (event: VideoEvent) => void;
const cache = globalThis as typeof globalThis & {
  __clipwiseSub?: { conn: Redis; listeners: Map<string, Set<Listener>> };
};

/**
 * One subscriber connection per process, shared by every open video page: the free Redis plan allows only
 * 30 connections, so a connection per browser tab would run out quickly.
 */
const shared = () => {
  if (!cache.__clipwiseSub) {
    const conn = newRedis("sub:videos");
    const listeners = new Map<string, Set<Listener>>();
    conn.on("message", (channel: string, message: string) => {
      const set = listeners.get(channel);
      if (!set?.size) return;
      let event: VideoEvent;
      try {
        event = JSON.parse(message) as VideoEvent;
      } catch {
        return;
      }
      for (const listener of set) {
        try {
          listener(event);
        } catch {}
      }
    });
    cache.__clipwiseSub = { conn, listeners };
  }
  return cache.__clipwiseSub;
};

/** Listens to one video's events until the returned function is called. */
export const subscribeVideoEvents = async (videoId: string, onEvent: Listener) => {
  const { conn, listeners } = shared();
  const channel = videoChannel(videoId);
  let set = listeners.get(channel);
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(onEvent);
  if (set.size === 1) await conn.subscribe(channel);
  let stopped = false;
  return async () => {
    if (stopped) return;
    stopped = true;
    const current = listeners.get(channel);
    current?.delete(onEvent);
    if (current && !current.size) {
      listeners.delete(channel);
      await conn.unsubscribe(channel).catch(() => {});
    }
  };
};

/** Closes the shared subscriber (tests and shutdown). */
export const closeSubscriptions = async () => {
  const sub = cache.__clipwiseSub;
  cache.__clipwiseSub = undefined;
  if (sub) await sub.conn.quit().catch(() => {});
};

/** Every video's events (worker logs, admin live view). */
export const subscribeAllVideoEvents = async (onEvent: (videoId: string, event: VideoEvent) => void) => {
  const sub = newRedis("sub:all");
  await sub.psubscribe(videoChannel("*"));
  sub.on("pmessage", (_pattern, channel, message) => {
    try {
      onEvent(channel.slice(videoChannel("").length), JSON.parse(message) as VideoEvent);
    } catch {}
  });
  return async () => {
    await sub.punsubscribe();
    await sub.quit();
  };
};
