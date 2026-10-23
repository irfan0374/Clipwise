import { PipelineRun } from "@clipwise/db";
import type { Types } from "mongoose";
import { reserve } from "./budget";
import { redis } from "./redis";

// Per-user limits for the beta (open sign-up). Counters are reserved atomically, like the global budgets.
export const userLimits = () => ({
  videosPerDay: Number(process.env.LIMIT_VIDEOS_PER_DAY ?? 10),
  ideasPerDay: Number(process.env.LIMIT_IDEAS_PER_DAY ?? 30),
  activeVideos: Number(process.env.LIMIT_ACTIVE_VIDEOS ?? 2),
});

type DailyKind = "videos" | "ai";
const today = () => new Date().toISOString().slice(0, 10);
const dailyKey = (userId: string, kind: DailyKind) => `limit:${userId}:${kind}:${today()}`;

/** Seconds until the daily counters reset (midnight UTC). */
export const secondsUntilReset = (now = new Date()) => {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
};

/** Takes one from today's allowance. False = the limit is reached (nothing taken). */
export const takeDaily = (userId: string, kind: DailyKind) =>
  reserve(
    dailyKey(userId, kind),
    1,
    kind === "videos" ? userLimits().videosPerDay : userLimits().ideasPerDay,
    2 * 24 * 3600,
  );

/** Gives one back (the action failed before anything was spent). */
export const refundDaily = async (userId: string, kind: DailyKind) => {
  await redis().decr(dailyKey(userId, kind));
};

export async function dailyUsage(userId: string) {
  const [videos, ai] = await redis().mget(dailyKey(userId, "videos"), dailyKey(userId, "ai"));
  const limits = userLimits();
  return {
    videos: { used: Number(videos ?? 0), limit: limits.videosPerDay },
    ideas: { used: Number(ai ?? 0), limit: limits.ideasPerDay },
  };
}

/** Videos of this workspace that are being written, checked, voiced or rendered right now. */
export const activeRunCount = (workspaceId: Types.ObjectId | string) =>
  PipelineRun.countDocuments({ workspaceId, status: "running" });

const UNLOCK = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

/**
 * Runs `fn` while holding a short per-workspace lock, so "count running videos, then start one" can't
 * interleave between simultaneous requests. Returns null if another request holds the lock.
 */
export async function withWorkspaceLock<T>(workspaceId: Types.ObjectId | string, fn: () => Promise<T>) {
  const key = `lock:active:${workspaceId}`;
  const token = `${process.pid}:${Date.now()}:${Math.random()}`;
  if ((await redis().set(key, token, "PX", 15_000, "NX")) !== "OK") return null;
  try {
    return { value: await fn() };
  } finally {
    await redis().eval(UNLOCK, 1, key, token);
  }
}
