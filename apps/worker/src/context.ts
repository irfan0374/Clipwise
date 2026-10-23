import { AsyncLocalStorage } from "node:async_hooks";
import { PipelineRun, UsageEvent, Video } from "@clipwise/db";
import { autoLength, type Script, type VideoFormat } from "@clipwise/pipeline";
import { publishVideoEvent } from "@clipwise/queue";
import type { Provider, Stage, VideoEvent, VideoStatus } from "@clipwise/shared";

/** Loads the video and its run for a job. Missing or deleted = nothing to do. */
export async function load(data: { videoId: string; runId: string }) {
  const [video, run] = await Promise.all([
    Video.findOne({ _id: data.videoId, deletedAt: null }),
    PipelineRun.findById(data.runId),
  ]);
  return video && run ? { video, run } : null;
}
export type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

/** The job being processed, so provider guards (budget reservations) know which video a request belongs to. */
export const jobContext = new AsyncLocalStorage<Loaded>();

export const emit = (videoId: string, event: VideoEvent) => publishVideoEvent(videoId, event);

/** Sets the video's status/stage/progress and tells listeners. */
export async function setStatus(videoId: string, status: VideoStatus, stage: Stage | null, progress: number) {
  await Video.updateOne({ _id: videoId }, { $set: { status, stage, progress, error: null } });
  await emit(videoId, { type: "status", status, stage, progress });
}

/** Wraps one stage: emits started/done events and appends a report row to the pipeline run. */
export async function runStage<T>(
  ctx: Loaded,
  stage: Stage,
  attempt: number,
  fn: () => Promise<{ value: T; units?: Record<string, unknown>; detail?: string }>,
): Promise<T> {
  const videoId = ctx.video._id.toString();
  const startedAt = new Date();
  await emit(videoId, { type: "step", stage, state: "started" });
  const result = await fn();
  await PipelineRun.updateOne(
    { _id: ctx.run._id },
    {
      $push: {
        stages: {
          stage,
          status: "ok",
          startedAt,
          durationMs: Date.now() - startedAt.getTime(),
          attempts: attempt,
          units: result.units ?? {},
        },
      },
    },
  );
  await emit(videoId, { type: "step", stage, state: "done", detail: result.detail });
  return result.value;
}

type Usage = {
  provider: Provider;
  operation: string;
  model?: string;
  quantity: number;
  unit: "tokens" | "characters" | "credits" | "requests" | "bytes";
};

/**
 * Writes usage rows (the source of truth for cost). Budget counters are not touched here: requests and credits
 * are reserved atomically before each provider call (see guards.ts), so they are never counted twice.
 */
export async function recordUsage(ctx: Loaded, rows: Usage[]) {
  const base = {
    workspaceId: ctx.video.workspaceId,
    userId: ctx.video.createdByUserId,
    videoId: ctx.video._id,
    pipelineRunId: ctx.run._id,
  };
  const kept = rows.filter((r) => r.quantity > 0);
  if (kept.length) await UsageEvent.insertMany(kept.map((r) => ({ ...base, ...r })));
}

/** The video's length: 30/60 as chosen, or for "auto" the format's natural length (promo/tips/quote 30s, others 60s). */
export const resolveLength = (video: {
  lengthMode: string;
  format?: string | null;
  lengthSeconds?: number | null;
}): 30 | 60 => {
  if (video.lengthSeconds === 30 || video.lengthSeconds === 60) return video.lengthSeconds;
  if (video.lengthMode === "30") return 30;
  if (video.lengthMode === "60") return 60;
  return autoLength((video.format ?? "explainer") as VideoFormat);
};

/** The video's current script as a plain object (what the pipeline expects), without Mongoose wrappers. */
export const plainScript = (video: Loaded["video"]): Script => video.toObject().script as unknown as Script;

/** False once the run was cancelled (or ended) while an AI call was in flight: its result is discarded. */
export const stillRunning = async (ctx: Loaded) =>
  (await PipelineRun.exists({ _id: ctx.run._id, status: "running" })) !== null;
