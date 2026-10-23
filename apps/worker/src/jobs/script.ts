import { ScriptVersion, Video } from "@clipwise/db";
import { type Providers, ScriptFailedError, type VideoFormat, writeScript } from "@clipwise/pipeline";
import type { JobData } from "@clipwise/queue";
import { enqueue } from "@clipwise/queue";
import { emit, type Loaded, recordUsage, resolveLength, runStage, setStatus, stillRunning } from "../context";

/** Writes the first script (version 1), then queues the fact-check. */
export async function scriptJob(ctx: Loaded, data: JobData<"script">, attempt: number, providers?: Providers) {
  const { video } = ctx;
  const videoId = video._id.toString();

  // Gemini's daily budget is reserved per request by the budget guards (guards.ts).
  // Already written by an earlier attempt of this run: just make sure the next job exists.
  if (video.scriptVersion >= 1 && video.script) {
    await enqueue("factcheck", { ...data, scriptVersion: video.scriptVersion });
    return;
  }

  await setStatus(videoId, "scripting", "script", 5);
  const length = resolveLength(video);

  const result = await runStage(ctx, "script", attempt, async () => {
    try {
      const r = await writeScript(
        { topic: video.topic, length, format: video.format as VideoFormat, log: (m) => console.log(`  [script] ${m}`) },
        providers,
      );
      await recordUsage(ctx, [
        { provider: "gemini", operation: "script", model: r.model, quantity: r.tokens, unit: "tokens" },
      ]);
      const words = r.script.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
      return {
        value: r,
        units: { tokens: r.tokens, requests: r.requests, attempts: r.attempts, model: r.model },
        detail: `${r.script.scenes.length} scenes · ${words} words`,
      };
    } catch (error) {
      if (error instanceof ScriptFailedError) {
        await recordUsage(ctx, [{ provider: "gemini", operation: "script", quantity: error.tokens, unit: "tokens" }]);
      }
      throw error;
    }
  });

  if (!(await stillRunning(ctx))) return; // cancelled while Gemini was writing: discard

  await ScriptVersion.updateOne(
    { videoId: video._id, version: 1 },
    {
      $setOnInsert: {
        workspaceId: video.workspaceId,
        videoId: video._id,
        version: 1,
        source: "generated",
        script: result.script,
        changedScenes: [],
        model: result.model,
      },
    },
    { upsert: true },
  );
  await Video.updateOne(
    { _id: video._id },
    {
      $set: {
        script: result.script,
        title: result.script.title,
        lengthSeconds: length,
        scriptVersion: 1,
        progress: 30,
      },
    },
  );
  await emit(videoId, { type: "script", scriptVersion: 1 });
  await enqueue("factcheck", { ...data, scriptVersion: 1 });
}
