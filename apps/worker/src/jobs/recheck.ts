import { assertWorkspaceActive, PipelineRun, Video, WorkspaceAccessError } from "@clipwise/db";
import { type Providers, recheckScenes, type Script, type VideoFormat } from "@clipwise/pipeline";
import type { JobData } from "@clipwise/queue";
import type { Job } from "bullmq";
import { emit, jobContext, recordUsage } from "../context";
import { classify } from "../errors";
import { reportJobFailure } from "../monitoring";

const toReviewOf = (claims: { verdict?: string | null; acceptedAt?: Date | null }[]) =>
  claims.filter((c) => c.verdict !== "correct" && !c.acceptedAt).length;

/**
 * Re-checks the facts of scenes the user edited (factcheck.pendingScenes). Runs only for the latest script
 * version: an older job stops before calling Gemini. A failed check never fails the video: after the last
 * attempt the scenes get an "couldn't be checked" note to review instead.
 */
export async function recheckJob(job: Job, data: JobData<"recheck">, providers?: Providers) {
  const video = await Video.findOne({ _id: data.videoId, deletedAt: null });
  const pending = video?.factcheck?.pendingScenes ?? [];
  if (!video?.script || video.scriptVersion !== data.scriptVersion || !pending.length) return;

  try {
    await assertWorkspaceActive(video.workspaceId);
  } catch (error) {
    if (error instanceof WorkspaceAccessError) return;
    throw error;
  }
  const run = await PipelineRun.create({
    workspaceId: video.workspaceId,
    videoId: video._id,
    trigger: "recheck",
    target: "script",
    scriptVersion: data.scriptVersion,
  });
  const startedAt = new Date();
  const attempt = job.attemptsMade + 1;
  const scenes = [...pending];
  let found: { scene: number; text: string; verdict: string; fix: string }[];
  try {
    const result = await jobContext.run({ video, run }, () =>
      recheckScenes(
        {
          script: video.toObject().script as unknown as Script,
          scenes,
          topic: video.topic,
          format: video.format as VideoFormat,
        },
        providers,
      ),
    );
    await recordUsage({ video, run }, [
      { provider: "gemini", operation: "factcheck", model: result.model, quantity: result.tokens, unit: "tokens" },
    ]);
    found = result.claims;
    await PipelineRun.updateOne(
      { _id: run._id },
      {
        $set: { status: "ok", finishedAt: new Date() },
        $push: {
          stages: {
            stage: "factcheck",
            status: "ok",
            startedAt,
            durationMs: Date.now() - startedAt.getTime(),
            attempts: attempt,
            units: { scenes: scenes.length, claims: found.length },
          },
        },
      },
    );
  } catch (error) {
    const failure = classify(error);
    await PipelineRun.updateOne(
      { _id: run._id },
      {
        $set: { status: "failed", finishedAt: new Date() },
        $push: {
          stages: { stage: "factcheck", status: "failed", startedAt, attempts: attempt, error: failure.message },
        },
      },
    );
    const last = !failure.retry || attempt >= (job.opts.attempts ?? 1);
    if (!last) throw error; // BullMQ retries with backoff
    console.error(`[worker] recheck gave up for video ${data.videoId}: ${failure.message}`);
    reportJobFailure(error, { name: "recheck", videoId: data.videoId, attempt, code: failure.code });
    // Not verified is not "correct": each scene gets a note to review.
    found = scenes.map((scene) => ({
      scene,
      text: "This scene couldn't be checked automatically",
      verdict: "unsure",
      fix: "",
    }));
  }

  // Save only if nobody edited meanwhile (a newer re-check is queued for that version).
  const fresh = await Video.findOne({ _id: video._id, scriptVersion: data.scriptVersion });
  if (!fresh?.factcheck) return;
  const checked = new Set(scenes);
  const kept = (fresh.factcheck.claims ?? []).filter((c) => !checked.has(c.scene ?? -1)).map((c) => c.toObject());
  const claims = [...kept, ...found.map((c) => ({ ...c, acceptedAt: null }))].sort(
    (a, b) => (a.scene ?? 0) - (b.scene ?? 0),
  );
  const stillPending = (fresh.factcheck.pendingScenes ?? []).filter((i) => !checked.has(i));
  const saved = await Video.updateOne(
    { _id: video._id, scriptVersion: data.scriptVersion },
    {
      $set: {
        "factcheck.claims": claims,
        "factcheck.pendingScenes": stillPending,
        ...(stillPending.length ? {} : { "factcheck.checkedVersion": data.scriptVersion }),
      },
    },
  );
  if (saved.modifiedCount)
    await emit(data.videoId, { type: "claims", total: claims.length, toReview: toReviewOf(claims) });
}
