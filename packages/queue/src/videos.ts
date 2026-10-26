import { assertWorkspaceActive, connectDb, PipelineRun, Render, Video } from "@clipwise/db";
import type { Format, LengthMode, RunTarget } from "@clipwise/shared";
import type { Types } from "mongoose";
import { finalsPerWeek, weeklyFinalCount } from "./allowances";
import { publishVideoEvent } from "./events";
import { FinalError, usableVoice } from "./finals";
import { activeRunCount, userLimits, withWorkspaceLock } from "./limits";
import { isGenerationPaused } from "./pause";
import { enqueue, queue } from "./queues";

export type StartVideoInput = {
  workspaceId: Types.ObjectId | string;
  userId: string;
  topic: string;
  format: Format;
  lengthMode: LengthMode;
  voiceId: string;
  /** How far to go: script + fact-check (default), a silent preview MP4, or voice + final MP4. */
  target?: RunTarget;
};

/** Creates the video and its pipeline run, then queues the script job. Returns at once; work happens in the worker. */
export async function startVideo(input: StartVideoInput) {
  await connectDb();
  await assertWorkspaceActive(input.workspaceId);
  if (await isGenerationPaused("ai")) throw new FinalError("PAUSED", "Generation is paused. Try again later.");
  const video = await Video.create({
    workspaceId: input.workspaceId,
    createdByUserId: input.userId,
    topic: input.topic,
    format: input.format,
    lengthMode: input.lengthMode,
    voiceId: input.voiceId,
    status: "draft",
  });
  const run = await PipelineRun.create({
    workspaceId: input.workspaceId,
    videoId: video._id,
    trigger: "create",
    target: input.target ?? "script",
  });
  const ids = { videoId: video._id.toString(), runId: run._id.toString() };
  await enqueue("script", ids);
  await publishVideoEvent(ids.videoId, { type: "status", status: "draft", stage: null, progress: 0 });
  return ids;
}

/** Stops a video that is still being written or checked. Waiting jobs are removed; a running AI call finishes
 * but the worker discards its result (the run is no longer "running"). Returns false if there was nothing to stop. */
export async function cancelVideo(videoId: string) {
  await connectDb();
  const video = await Video.findById(videoId);
  if (!video || !["draft", "scripting", "checking"].includes(video.status)) return false;
  await PipelineRun.updateMany(
    { videoId: video._id, status: "running" },
    { $set: { status: "cancelled", finishedAt: new Date() } },
  );
  const waiting = await queue("ai").getJobs(["waiting", "delayed", "prioritized"]);
  await Promise.all(waiting.filter((j) => j.data?.videoId === videoId).map((j) => j.remove().catch(() => {})));
  await Video.updateOne({ _id: video._id }, { $set: { status: "draft", stage: null, progress: 0, error: null } });
  await publishVideoEvent(videoId, { type: "status", status: "draft", stage: null, progress: 0 });
  return true;
}

/**
 * Retries a failed video from the step that failed, reusing everything already done (a new run, so its job IDs
 * are new). Returns the stage it restarts from, or null if the video isn't failed.
 */
export async function retryVideo(videoId: string) {
  await connectDb();
  const video = await Video.findById(videoId, { workspaceId: 1 }).lean();
  if (!video) return null;
  const locked = await withWorkspaceLock(video.workspaceId, async () => {
    await assertWorkspaceActive(video.workspaceId);
    if (await isGenerationPaused()) throw new FinalError("PAUSED", "Generation is paused. Try again later.");
    if ((await activeRunCount(video.workspaceId)) >= userLimits().activeVideos)
      throw new FinalError("BUSY", "Wait for a running video to finish.");
    return retryFailedVideo(videoId);
  });
  if (!locked) throw new FinalError("BUSY", "Another request is starting. Try again in a moment.");
  return locked.value;
}

async function retryFailedVideo(videoId: string) {
  await connectDb();
  const video = await Video.findById(videoId);
  if (video?.status !== "failed") return null;
  const last = await PipelineRun.findOne({ videoId: video._id, trigger: { $ne: "recheck" } })
    .sort({ createdAt: -1 })
    .lean();
  const target = last?.target ?? "script";
  if (target === "final" && (await weeklyFinalCount(video.workspaceId)) >= finalsPerWeek())
    throw new FinalError("LIMIT_REACHED", "You have reached the beta rendering limit. Try again next week.");
  const run = await PipelineRun.create({
    workspaceId: video.workspaceId,
    videoId: video._id,
    trigger: "retry",
    target,
    scriptVersion: video.scriptVersion || undefined,
  });
  const ids = { videoId, runId: run._id.toString() };
  const v = video.scriptVersion;
  const checked = video.factcheck?.checkedVersion === v && v > 0;
  const previousError = video.error;

  // Reset the video BEFORE queueing: once the job is queued the worker may start (or fail) at any moment,
  // and a later reset would wipe its status.
  await Video.updateOne({ _id: video._id }, { $set: { status: "draft", stage: null, error: null, progress: 0 } });
  await publishVideoEvent(videoId, { type: "status", status: "draft", stage: null, progress: 0 });

  let retryRender: InstanceType<typeof Render> | undefined;
  try {
    if (!video.script || v < 1) {
      await enqueue("script", ids);
      return "script" as const;
    }
    if (target === "script" || (!checked && target !== "final")) {
      await Video.updateOne({ _id: video._id }, { $unset: { "factcheck.checkedVersion": "" } });
      await enqueue("factcheck", { ...ids, scriptVersion: v });
      return "factcheck" as const;
    }
    const kind = target === "final" ? "final" : "preview";
    const render = await Render.findOneAndUpdate(
      { videoId: video._id, kind, scriptVersion: v, status: { $in: ["queued", "failed", "rendering"] } },
      {
        $set: { status: "queued", error: null, quotaAt: new Date() },
        $setOnInsert: { workspaceId: video.workspaceId, videoId: video._id, kind, scriptVersion: v },
      },
      { upsert: true, returnDocument: "after" },
    );
    retryRender = render;
    const next = { ...ids, renderId: render._id.toString(), scriptVersion: v };
    const voiced = await usableVoice(video);
    if (kind === "final" && !voiced) {
      await enqueue("voice", next);
      return "voice" as const;
    }
    await enqueue("render", { ...next, kind });
    return "render" as const;
  } catch (error) {
    if (retryRender)
      await Render.updateOne({ _id: retryRender._id }, { $set: { status: "failed", error: "Couldn't queue retry" } });
    // Couldn't queue: put the video back the way it was so the user can retry again.
    await PipelineRun.updateOne({ _id: run._id }, { $set: { status: "failed", finishedAt: new Date() } });
    await Video.updateOne({ _id: video._id }, { $set: { status: "failed", error: previousError } });
    throw error;
  }
}
