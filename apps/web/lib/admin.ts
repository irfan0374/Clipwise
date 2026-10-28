import "server-only";
import { AuditEvent, accountUsers, authUserId, PipelineRun, Video, Workspace } from "@clipwise/db";
import { budgetStatus, queue, weeklyFinalCount, workerStatus } from "@clipwise/queue";
import { notFound } from "next/navigation";
import { escapeSearch } from "./library-query";
import { requireUser } from "./session";

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.user.role !== "admin") notFound();
  return ctx;
}
export async function adminOverview(search = "", requestedPage = 1) {
  const users = await accountUsers();
  const q = search.trim().slice(0, 80);
  const matches = q
    ? await users
        .find(
          {
            $or: [
              { name: { $regex: escapeSearch(q), $options: "i" } },
              { email: { $regex: escapeSearch(q), $options: "i" } },
            ],
          },
          { projection: { _id: 1 } },
        )
        .limit(1000)
        .toArray()
    : [];
  const filter = q
    ? {
        $or: [
          { name: { $regex: escapeSearch(q), $options: "i" } },
          { ownerUserId: { $in: matches.map((u) => u._id.toString()) } },
        ],
      }
    : {};
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [total, budgets, stats, failures, health, audit, running, worker] = await Promise.all([
    Workspace.countDocuments(filter),
    budgetStatus(),
    Promise.all([
      Workspace.countDocuments({ suspendedAt: null }),
      Video.countDocuments({ createdAt: { $gte: start }, deletedAt: null }),
      Video.countDocuments({ status: "failed", deletedAt: null }),
      PipelineRun.countDocuments({ status: "running", trigger: { $ne: "recheck" } }),
    ]),
    Video.find({ status: "failed", deletedAt: null }).sort({ updatedAt: -1 }).limit(20).lean(),
    Promise.all(
      (["ai", "voice", "render"] as const).map(async (name) => ({
        name,
        paused: await queue(name).isPaused(),
        counts: await queue(name).getJobCounts("active", "waiting", "delayed", "failed"),
      })),
    ),
    AuditEvent.find().sort({ createdAt: -1 }).limit(15).lean(),
    PipelineRun.find({ status: "running", trigger: { $ne: "recheck" } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    workerStatus(),
  ]);
  const runningVideos = await Video.find(
    { _id: { $in: running.map((r) => r.videoId) }, deletedAt: null },
    { title: 1, topic: 1, stage: 1, status: 1 },
  ).lean();
  const runningById = new Map(runningVideos.map((v) => [v._id.toString(), v]));
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.max(1, Math.min(requestedPage, pages));
  const workspaces = await Workspace.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * 20)
    .limit(20)
    .lean();
  const accounts = await users
    .find(
      { _id: { $in: workspaces.map((w) => authUserId(w.ownerUserId)) } },
      { projection: { name: 1, email: 1, role: 1 } },
    )
    .toArray();
  const byId = new Map(accounts.map((u) => [u._id.toString(), u]));
  const rows = await Promise.all(
    workspaces.map(async (w) => ({
      id: w._id.toString(),
      ownerId: w.ownerUserId,
      name: w.name,
      email: byId.get(w.ownerUserId)?.email ?? "Unavailable",
      userName: byId.get(w.ownerUserId)?.name ?? w.name,
      role: byId.get(w.ownerUserId)?.role ?? "user",
      suspended: !!w.suspendedAt,
      createdAt: w.createdAt.toISOString(),
      videos: await Video.countDocuments({ workspaceId: w._id, deletedAt: null }),
      finals: await weeklyFinalCount(w._id),
    })),
  );
  return {
    rows,
    total,
    page,
    pages,
    budgets,
    stats: { activeWorkspaces: stats[0]!, videosToday: stats[1]!, failedVideos: stats[2]!, runningJobs: stats[3]! },
    failures: failures.map((v) => ({
      id: v._id.toString(),
      title: v.title || v.topic,
      stage: v.stage ?? "unknown",
      message: v.error?.message ?? "Generation failed",
      workspaceId: v.workspaceId.toString(),
    })),
    health,
    worker,
    running: running.map((r) => ({
      id: r._id.toString(),
      videoId: r.videoId.toString(),
      title:
        runningById.get(r.videoId.toString())?.title || runningById.get(r.videoId.toString())?.topic || "Deleted video",
      stage: runningById.get(r.videoId.toString())?.stage ?? "queued",
      target: r.target,
      date: r.createdAt.toISOString(),
    })),
    audit: audit.map((a) => ({
      id: a._id.toString(),
      actor: a.actorUserId,
      action: a.action,
      target: a.targetId,
      status: a.status,
      date: a.createdAt.toISOString(),
    })),
  };
}
export type AdminOverview = Awaited<ReturnType<typeof adminOverview>>;
