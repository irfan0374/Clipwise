import { assertWorkspaceActive, PipelineRun, Render, Video } from "@clipwise/db";
import type { Providers } from "@clipwise/pipeline";
import { type JobData, JobDefs, type JobName } from "@clipwise/queue";
import type { Stage } from "@clipwise/shared";
import { type Job, UnrecoverableError } from "bullmq";
import { emit, jobContext, type Loaded, load } from "./context";
import { classify } from "./errors";
import { factcheckJob } from "./jobs/factcheck";
import { publishJob } from "./jobs/publish";
import { recheckJob } from "./jobs/recheck";
import { renderJob } from "./jobs/render";
import { scriptJob } from "./jobs/script";
import { voiceJob } from "./jobs/voice";
import { reportJobFailure } from "./monitoring";

const stageOf: Record<JobName, Stage> = {
  script: "script",
  factcheck: "factcheck",
  recheck: "factcheck",
  voice: "voice",
  render: "render",
  publish: "render", // not a video stage; publish jobs never mark the video failed
};

/** Marks the video and run failed with a user-safe message (full error kept in the run report). */
export async function markFailed(job: Job, error: unknown) {
  const name = job.name as JobName;
  const data = job.data as { videoId: string; runId: string; renderId?: string };
  const stage = stageOf[name];
  const failure = classify(error);
  // Only a run that is still running can fail: if the user cancelled while this provider call was in flight,
  // the late error must not overwrite the cancellation.
  const run = await PipelineRun.findOneAndUpdate(
    { _id: data.runId, status: "running" },
    {
      $set: { status: "failed", finishedAt: new Date() },
      $push: {
        stages: {
          stage,
          status: "failed",
          startedAt: new Date(),
          attempts: job.attemptsMade + 1,
          error: failure.message,
        },
      },
    },
  );
  if (!run) return;
  await Video.updateOne(
    { _id: data.videoId },
    {
      $set: {
        status: "failed",
        stage,
        error: { stage, code: failure.code, message: failure.userMessage, at: new Date() },
      },
    },
  );
  if (data.renderId)
    await Render.updateOne({ _id: data.renderId }, { $set: { status: "failed", error: failure.message } });
  await emit(data.videoId, { type: "error", stage, code: failure.code, message: failure.userMessage });
}

/** One processor for every queue: validates the payload, runs the job, and decides retry vs fail. */
/** `instagramFetch` replaces the Graph API in tests. */
export const makeProcessor = (providers?: Providers, instagramFetch?: typeof fetch) => async (job: Job) => {
  const name = job.name as JobName;
  const def = JobDefs[name];
  if (!def) throw new UnrecoverableError(`unknown job ${job.name}`);
  const data = def.schema.parse(job.data);
  // Re-checks of edited scenes have no pipeline run of their own yet and never fail the video.
  if (name === "recheck") return recheckJob(job, data as JobData<"recheck">, providers);
  // Instagram posts belong to a SocialPost, not a pipeline run.
  if (name === "publish") return publishJob(job, data as JobData<"publish">, instagramFetch);
  const { videoId } = data as { videoId: string };
  const ctx = await load(data as { videoId: string; runId: string });
  if (!ctx) return; // video deleted or run missing: nothing to do
  if (ctx.run.status !== "running") return; // the user cancelled this run
  const attempt = job.attemptsMade + 1;
  try {
    await assertWorkspaceActive(ctx.video.workspaceId);
    return await jobContext.run(ctx, () => runJob(name, ctx, data, attempt, providers));
  } catch (error) {
    const failure = classify(error);
    const last = !failure.retry || attempt >= (job.opts.attempts ?? 1);
    console.error(`[worker] ${name} failed for video ${videoId} (attempt ${attempt}): ${failure.message}`);
    if (last) {
      reportJobFailure(error, { name, videoId, attempt, code: failure.code });
      await markFailed(job, error);
      throw new UnrecoverableError(failure.message);
    }
    throw error; // BullMQ retries with backoff
  }
};

function runJob(name: JobName, ctx: Loaded, data: unknown, attempt: number, providers?: Providers) {
  switch (name) {
    case "script":
      return scriptJob(ctx, data as JobData<"script">, attempt, providers);
    case "factcheck":
      return factcheckJob(ctx, data as JobData<"factcheck">, attempt, providers);
    case "voice":
      return voiceJob(ctx, data as JobData<"voice">, attempt, providers);
    case "render":
      return renderJob(ctx, data as JobData<"render">, attempt);
    case "recheck":
    case "publish":
      return; // handled before a run is loaded
  }
}
