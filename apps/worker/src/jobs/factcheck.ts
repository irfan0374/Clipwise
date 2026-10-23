import { PipelineRun, Render, ScriptVersion, Video } from "@clipwise/db";
import { checkFacts, type Providers } from "@clipwise/pipeline";
import type { JobData } from "@clipwise/queue";
import { enqueue } from "@clipwise/queue";
import { emit, type Loaded, plainScript, recordUsage, resolveLength, runStage, setStatus } from "../context";

/** Checks every claim (rewriting the script if needed), then stops or continues to preview / voice. */
export async function factcheckJob(ctx: Loaded, data: JobData<"factcheck">, attempt: number, providers?: Providers) {
  const { video } = ctx;
  const videoId = video._id.toString();
  if (!video.script) return;
  // A retry after the check was saved (it may have bumped scriptVersion): go straight to the next step.
  const checked = video.factcheck?.checkedVersion;
  if (checked != null && checked >= data.scriptVersion && checked === video.scriptVersion) {
    return next(ctx, data.runId, video.scriptVersion);
  }
  if (video.scriptVersion !== data.scriptVersion) return; // stale: the script changed since this job was queued

  await setStatus(videoId, "checking", "factcheck", 35);
  const length = resolveLength(video.lengthMode);
  const script = plainScript(video);

  const r = await runStage(ctx, "factcheck", attempt, async () => {
    const result = await checkFacts(
      { script, topic: video.topic, length, log: (m) => console.log(`  [factcheck] ${m}`) },
      providers,
    );
    await recordUsage(ctx, [
      {
        provider: "gemini",
        operation: "factcheck",
        model: result.check.model,
        quantity: result.factcheckTokens,
        unit: "tokens",
      },
      {
        provider: "gemini",
        operation: "script",
        model: result.rewriteModel ?? undefined,
        quantity: result.scriptTokens,
        unit: "tokens",
      },
    ]);
    const toReview = result.remaining.length + result.unsure.length;
    return {
      value: result,
      units: { claims: result.check.claims.length, rewrites: result.rewrites, toReview, model: result.check.model },
      detail: `${result.check.claims.length} claims · ${result.rewrites} rewrite(s) · ${toReview} to review`,
    };
  });

  let version = data.scriptVersion;
  if (r.scriptChanged) {
    version += 1;
    await ScriptVersion.updateOne(
      { videoId: video._id, version },
      {
        $setOnInsert: {
          workspaceId: video.workspaceId,
          videoId: video._id,
          version,
          source: "factcheck-rewrite",
          script: r.script,
          changedScenes: r.changedScenes,
          model: r.rewriteModel,
        },
      },
      { upsert: true },
    );
  }
  const claims = r.check.claims.map((c) => ({
    scene: c.scene,
    text: c.text,
    verdict: c.verdict,
    fix: c.fix,
    acceptedAt: null,
  }));
  await Video.updateOne(
    { _id: video._id },
    {
      $set: {
        script: r.script,
        title: r.script.title,
        scriptVersion: version,
        factcheck: {
          checkedVersion: version,
          claims,
          rewrites: r.rewrites,
          numbersRemovedFromScenes: r.numbersRemovedFromScenes,
        },
        progress: 55,
      },
    },
  );
  if (r.scriptChanged) await emit(videoId, { type: "script", scriptVersion: version });
  await emit(videoId, { type: "claims", total: claims.length, toReview: r.remaining.length + r.unsure.length });

  await next(ctx, data.runId, version);
}

/** What happens after the fact-check depends on how far this run goes. */
async function next(ctx: Loaded, runId: string, version: number) {
  const { video, run } = ctx;
  const videoId = video._id.toString();
  if (run.target === "script") {
    await Video.updateOne({ _id: video._id }, { $set: { status: "previewed", stage: null, progress: 100 } });
    await PipelineRun.updateOne(
      { _id: run._id },
      { $set: { status: "ok", scriptVersion: version, finishedAt: new Date() } },
    );
    await emit(videoId, { type: "status", status: "previewed", stage: null, progress: 100 });
    await emit(videoId, { type: "done", renderId: null });
    return;
  }
  const kind = run.target === "final" ? "final" : "preview";
  // One queued render per video/kind/version, even if this step runs twice.
  const render = await Render.findOneAndUpdate(
    { videoId: video._id, kind, scriptVersion: version, status: "queued" },
    { $setOnInsert: { workspaceId: video.workspaceId, videoId: video._id, kind, scriptVersion: version } },
    { upsert: true, returnDocument: "after" },
  );
  const ids = { videoId, runId, renderId: render._id.toString(), scriptVersion: version };
  if (kind === "final") await enqueue("voice", ids);
  else await enqueue("render", { ...ids, kind });
}
