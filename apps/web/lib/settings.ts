import "server-only";
import { PipelineRun, Video } from "@clipwise/db";
import { dailyUsage, finalsPerWeek, secondsUntilReset, weeklyFinalCount, weekWindow } from "@clipwise/queue";
import type { Types } from "mongoose";
export async function settingsUsage(userId: string, workspaceId: Types.ObjectId) {
  const now = new Date();
  const [daily, used, runs] = await Promise.all([
    dailyUsage(userId),
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
    finals: { used, limit: finalsPerWeek() },
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
