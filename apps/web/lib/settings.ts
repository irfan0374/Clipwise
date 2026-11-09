import "server-only";
import { PipelineRun, SocialAccount, Video } from "@clipwise/db";
import {
  dailyUsage,
  fairUsage,
  finalsPerWeek,
  missingInstagramSettings,
  nextMonthStart,
  secondsUntilReset,
  weeklyFinalCount,
  weekWindow,
} from "@clipwise/queue";
import type { Types } from "mongoose";
export async function settingsUsage(userId: string, workspaceId: Types.ObjectId) {
  const now = new Date();
  const [daily, fair, used, runs] = await Promise.all([
    dailyUsage(userId),
    fairUsage(workspaceId),
    weeklyFinalCount(workspaceId, now),
    PipelineRun.find({ workspaceId, trigger: { $ne: "recheck" } })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ]);
  const videos = await Video.find(
    { _id: { $in: runs.map((r) => r.videoId) }, workspaceId, deletedAt: null },
    { title: 1, topic: 1 },
  ).lean();
  const names = new Map(videos.map((v) => [v._id.toString(), v.title || v.topic]));
  return {
    ...daily,
    ...fair,
    finals: { used, limit: finalsPerWeek() },
    monthlyResetAt: nextMonthStart(now).toISOString(),
    dailyResetAt: new Date(now.getTime() + secondsUntilReset(now) * 1000).toISOString(),
    weeklyResetAt: weekWindow(now).reset.toISOString(),
    activity: runs.map((r) => ({
      id: r._id.toString(),
      title: names.get(r.videoId.toString()) ?? "Deleted video",
      action: r.target === "final" ? "Render" : "Script",
      status: r.status,
      date: r.createdAt.toISOString(),
    })),
  };
}
export type SettingsUsage = Awaited<ReturnType<typeof settingsUsage>>;

/** Settings → Connections: the workspace's connected accounts (never the access key) and whether Connect works. */
export async function settingsConnections(workspaceId: Types.ObjectId) {
  const accounts = await SocialAccount.find({ workspaceId }).sort({ connectedAt: 1 }).lean();
  return {
    available: missingInstagramSettings().length === 0,
    accounts: accounts.map((a) => ({
      id: a._id.toString(),
      username: a.username,
      name: a.name ?? null,
      pictureUrl: a.pictureUrl ?? null,
      status: a.status ?? "connected",
      statusReason: a.statusReason ?? null,
      connectedAt: a.connectedAt?.toISOString() ?? null,
    })),
  };
}
export type SettingsConnections = Awaited<ReturnType<typeof settingsConnections>>;
