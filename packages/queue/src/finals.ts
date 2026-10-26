import { assertWorkspaceActive, connectDb, PipelineRun, Render, Video } from "@clipwise/db";
import { storage } from "@clipwise/storage";
import type { Types } from "mongoose";
import { finalsPerWeek, weeklyFinalCount } from "./allowances";
import { publishVideoEvent } from "./events";
import { activeRunCount, userLimits, withWorkspaceLock } from "./limits";
import { isGenerationPaused } from "./pause";
import { enqueue } from "./queues";

export class FinalError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT" | "BUSY" | "LIMIT_REACHED" | "PAUSED",
    message: string,
  ) {
    super(message);
  }
}

export const voiceIsCurrent = (video: {
  scriptVersion: number;
  voiceId: string;
  voice?: { scriptVersion?: number | null; voiceId?: string | null } | null;
  files?: { voiceKey?: string | null; alignmentKey?: string | null } | null;
}) =>
  video.voice?.scriptVersion === video.scriptVersion &&
  video.voice?.voiceId === video.voiceId &&
  !!video.files?.voiceKey &&
  !!video.files?.alignmentKey;

/** A reusable voice must still have both stored files. */
export const usableVoice = async (video: Parameters<typeof voiceIsCurrent>[0]) =>
  voiceIsCurrent(video) &&
  (await storage().exists(video.files!.voiceKey!)) &&
  (await storage().exists(video.files!.alignmentKey!));

/** Render the exact saved version. Workspace lock deduplicates starts; Mongo CAS also excludes concurrent edits. */
export async function startFinal(input: {
  videoId: string;
  workspaceId: Types.ObjectId | string;
  expectedVersion: number;
}) {
  await connectDb();
  const locked = await withWorkspaceLock(input.workspaceId, async () => {
    const video = await Video.findOne({ _id: input.videoId, workspaceId: input.workspaceId, deletedAt: null });
    if (!video?.script) throw new FinalError("NOT_FOUND", "This video doesn't exist anymore.");
    await assertWorkspaceActive(input.workspaceId);
    if (video.scriptVersion !== input.expectedVersion)
      throw new FinalError("CONFLICT", "This video changed. Reload before rendering.");
    const existing = await Render.findOne({
      videoId: video._id,
      scriptVersion: video.scriptVersion,
      kind: "final",
      deletedAt: null,
      status: { $in: ["queued", "rendering", "done"] },
    }).sort({ createdAt: -1 });
    if (existing) {
      if (existing.status !== "done" || (existing.r2Key && (await storage().exists(existing.r2Key))))
        return { renderId: existing._id.toString(), startsWithVoice: false, reused: true };
      await Render.updateOne(
        { _id: existing._id },
        { $set: { status: "failed", error: "Stored MP4 missing; regenerating" } },
      );
    }
    if (!["previewed", "rendered"].includes(video.status))
      throw new FinalError("CONFLICT", "Wait for this video to finish, or retry its failed step.");
    if ((await isGenerationPaused("voice")) || (await isGenerationPaused("render")))
      throw new FinalError("PAUSED", "Video rendering is paused. Try again later.");
    if ((await activeRunCount(video.workspaceId)) >= userLimits().activeVideos)
      throw new FinalError("BUSY", "Wait for one of your running videos to finish.");
    if ((await weeklyFinalCount(video.workspaceId)) >= finalsPerWeek())
      throw new FinalError("LIMIT_REACHED", "You have reached the beta rendering limit. Try again next week.");
    const voiced = await usableVoice(video);
    const status = voiced ? "rendering" : "voicing";
    const saved = await Video.updateOne(
      { _id: video._id, scriptVersion: input.expectedVersion, status: video.status },
      { $set: { status, stage: voiced ? "render" : "voice", progress: 60, error: null } },
    );
    if (!saved.modifiedCount) throw new FinalError("CONFLICT", "This video changed. Reload before rendering.");
    let run: InstanceType<typeof PipelineRun> | undefined;
    let render: InstanceType<typeof Render> | undefined;
    try {
      run = await PipelineRun.create({
        workspaceId: video.workspaceId,
        videoId: video._id,
        trigger: "render",
        target: "final",
        scriptVersion: video.scriptVersion,
      });
      render = await Render.create({
        workspaceId: video.workspaceId,
        videoId: video._id,
        kind: "final",
        scriptVersion: video.scriptVersion,
      });
      const ids = {
        videoId: input.videoId,
        runId: run._id.toString(),
        renderId: render._id.toString(),
        scriptVersion: video.scriptVersion,
      };
      if (voiced) await enqueue("render", { ...ids, kind: "final" });
      else await enqueue("voice", ids);
    } catch (error) {
      if (run) await PipelineRun.updateOne({ _id: run._id }, { $set: { status: "failed", finishedAt: new Date() } });
      if (render)
        await Render.updateOne({ _id: render._id }, { $set: { status: "failed", error: "Couldn't queue render" } });
      await Video.updateOne(
        { _id: video._id, scriptVersion: video.scriptVersion, status },
        { $set: { status: video.status, stage: null, progress: 100, error: video.error } },
      );
      throw error;
    }
    // Pubsub failure must not report a successfully queued render as failed (client can refresh/reconnect).
    await publishVideoEvent(input.videoId, {
      type: "status",
      status,
      stage: voiced ? "render" : "voice",
      progress: 60,
    }).catch(() => {});
    return { renderId: render._id.toString(), startsWithVoice: !voiced, reused: false };
  });
  if (!locked) throw new FinalError("BUSY", "Another request is starting. Try again in a moment.");
  return locked.value;
}
