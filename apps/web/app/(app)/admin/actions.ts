"use server";
import { AuditEvent, PipelineRun, readAccount, Video, Workspace } from "@clipwise/db";
import { retryVideo, setGenerationPaused } from "@clipwise/queue";
import { Id } from "@clipwise/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, action, assertAdmin } from "@/lib/action";
import { auth } from "@/lib/auth";

type AuditAction =
  | "generation.pause"
  | "generation.resume"
  | "workspace.suspend"
  | "workspace.reactivate"
  | "password.reset"
  | "video.retry";
async function audited<T>(actor: string, type: AuditAction, target: string, fn: () => Promise<T>) {
  const row = await AuditEvent.create({ actorUserId: actor, action: type, targetId: target });
  try {
    const data = await fn();
    await AuditEvent.updateOne({ _id: row._id }, { $set: { status: "ok" } });
    revalidatePath("/admin");
    return data;
  } catch (error) {
    await AuditEvent.updateOne({ _id: row._id }, { $set: { status: "failed" } });
    throw error;
  }
}
export const pauseGeneration = action(
  z.object({ paused: z.boolean(), queue: z.enum(["all", "ai", "voice", "render"]).default("all") }),
  async (input, ctx) => {
    assertAdmin(ctx);
    return audited(ctx.user.id, input.paused ? "generation.pause" : "generation.resume", input.queue, async () => {
      await setGenerationPaused(input.paused, input.queue);
      return { paused: input.paused };
    });
  },
);
export const suspendWorkspace = action(z.object({ workspaceId: Id, suspended: z.boolean() }), async (input, ctx) => {
  assertAdmin(ctx);
  const ws = await Workspace.findById(input.workspaceId);
  if (!ws) throw new ActionError("NOT_FOUND", "Workspace not found.");
  const owner = await readAccount(ws.ownerUserId);
  if (ws.ownerUserId === ctx.user.id || owner?.role === "admin")
    throw new ActionError("FORBIDDEN", "Administrator workspaces can't be suspended here.");
  return audited(
    ctx.user.id,
    input.suspended ? "workspace.suspend" : "workspace.reactivate",
    input.workspaceId,
    async () => {
      await Workspace.updateOne({ _id: ws._id }, { $set: { suspendedAt: input.suspended ? new Date() : null } });
      if (input.suspended) await (await auth.$context).internalAdapter.deleteUserSessions(ws.ownerUserId);
      return { suspended: input.suspended };
    },
  );
});
export const resetUserPassword = action(
  z.object({ workspaceId: Id, newPassword: z.string().min(12).max(128) }),
  async ({ workspaceId, newPassword }, ctx) => {
    assertAdmin(ctx);
    const ws = await Workspace.findById(workspaceId);
    if (!ws) throw new ActionError("NOT_FOUND", "Workspace not found.");
    const owner = await readAccount(ws.ownerUserId);
    if (!owner || owner.role === "admin" || ws.ownerUserId === ctx.user.id)
      throw new ActionError("FORBIDDEN", "Use the trusted account recovery process for administrator accounts.");
    return audited(ctx.user.id, "password.reset", workspaceId, async () => {
      const context = await auth.$context;
      if (!(await context.internalAdapter.findAccounts(ws.ownerUserId)).some((a) => a.providerId === "credential"))
        throw new ActionError("CONFLICT", "This account doesn't use a password.");
      await context.internalAdapter.updatePassword(ws.ownerUserId, await context.password.hash(newPassword));
      await context.internalAdapter.deleteUserSessions(ws.ownerUserId);
      return { reset: true };
    });
  },
);
export const retryFailedVideo = action(z.object({ videoId: Id }), async ({ videoId }, ctx) => {
  assertAdmin(ctx);
  if (!(await Video.exists({ _id: videoId, deletedAt: null, status: "failed" })))
    throw new ActionError("CONFLICT", "This video isn't waiting for a retry.");
  return audited(ctx.user.id, "video.retry", videoId, async () => {
    const stage = await retryVideo(videoId);
    if (!stage) throw new ActionError("CONFLICT", "This video changed before the retry.");
    return { stage };
  });
});
export const viewRunLog = action(z.object({ videoId: Id }), async ({ videoId }, ctx) => {
  assertAdmin(ctx);
  const run = await PipelineRun.findOne({ videoId, trigger: { $ne: "recheck" } })
    .sort({ createdAt: -1 })
    .lean();
  if (!run) throw new ActionError("NOT_FOUND", "No run report for this video.");
  const redact = (text: string) => {
    let result = text;
    for (const key of [process.env.GEMINI_API_KEY, process.env.ELEVENLABS_API_KEY, process.env.BETTER_AUTH_SECRET])
      if (key) result = result.replaceAll(key, "[redacted]");
    return result.slice(0, 2000);
  };
  return {
    status: run.status,
    stages: run.stages.map((s) => ({
      stage: s.stage,
      status: s.status,
      attempts: s.attempts ?? 0,
      durationMs: s.durationMs ?? null,
      error: s.error ? redact(s.error) : null,
    })),
  };
});
