import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PipelineRun, Render, Video } from "@clipwise/db";
import { type Alignment, buildTimeline, previewAlignment, renderVideo } from "@clipwise/pipeline";
import type { JobData } from "@clipwise/queue";
import { keys, storage } from "@clipwise/storage";
import { emit, type Loaded, plainScript, runStage, setStatus } from "../context";

/** Renders the MP4 (final with voice, or silent preview) plus a thumbnail and saves both to storage. */
export async function renderJob(ctx: Loaded, data: JobData<"render">, attempt: number) {
  const { video } = ctx;
  const videoId = video._id.toString();
  const workspaceId = video.workspaceId.toString();
  const render = await Render.findById(data.renderId);
  if (!render || !video.script) return;
  // The MP4 was saved by an earlier attempt that stopped before updating the video and run: finish that now,
  // so the video never stays stuck in "rendering" next to a finished file.
  if (render.status === "done") return finishRender(ctx, render._id.toString(), data);
  if (video.scriptVersion !== data.scriptVersion) {
    await Render.updateOne({ _id: render._id }, { $set: { status: "failed", error: "stale: script changed" } });
    return;
  }

  const final = data.kind === "final";
  const store = storage();
  const script = plainScript(video);
  const work = await mkdtemp(path.join(tmpdir(), `clipwise-render-${data.renderId}-`));
  const media = path.join(work, "media");
  await mkdir(media, { recursive: true });

  try {
    await Render.updateOne({ _id: render._id }, { $set: { status: "rendering", error: null } });
    await setStatus(videoId, "rendering", "render", final ? 75 : 60);

    let alignment: Alignment;
    if (final) {
      if (!video.files?.voiceKey || !video.files.alignmentKey) throw new Error("voice files missing for final render");
      await store.getToFile(video.files.voiceKey, path.join(media, "voice.mp3"));
      alignment = JSON.parse((await store.get(video.files.alignmentKey)).toString()) as Alignment;
    } else {
      alignment = previewAlignment(script);
    }

    const timeline = buildTimeline({ script, alignment, audioFile: final ? "voice.mp3" : null, imageFiles: {} });
    const timelineKey = keys.timeline(workspaceId, videoId, data.scriptVersion);
    await store.put(timelineKey, JSON.stringify(timeline), { contentType: "application/json" });

    const out = path.join(work, "video.mp4");
    const thumb = path.join(work, "thumb.jpg");
    const started = Date.now();
    const base = final ? 75 : 60;
    const r = await runStage(ctx, "render", attempt, async () => {
      const info = await renderVideo(timeline, media, out, {
        thumbnailFile: thumb,
        onProgress: (pct) => {
          void emit(videoId, { type: "render", renderId: data.renderId, progress: pct });
          void Video.updateOne(
            { _id: video._id },
            { $set: { progress: Math.round(base + (pct / 100) * (99 - base)) } },
          );
        },
      });
      const sizeBytes = (await stat(out)).size;
      return {
        value: { ...info, sizeBytes },
        units: { frames: info.durationInFrames, kind: data.kind, mb: Number((sizeBytes / 1e6).toFixed(1)) },
        detail: `${(info.durationInFrames / info.fps).toFixed(1)}s · ${(sizeBytes / 1e6).toFixed(1)} MB`,
      };
    });

    const r2Key = keys.render(workspaceId, videoId, data.renderId);
    const thumbnailKey = keys.thumbnail(workspaceId, videoId, data.renderId);
    await store.putFile(r2Key, out, { contentType: "video/mp4" });
    await store.put(thumbnailKey, await readFile(thumb), { contentType: "image/jpeg" });

    await Render.updateOne(
      { _id: render._id },
      {
        $set: {
          status: "done",
          r2Key,
          thumbnailKey,
          durationMs: Math.round((r.durationInFrames / r.fps) * 1000),
          sizeBytes: r.sizeBytes,
          renderMs: Date.now() - started,
        },
      },
    );
    await finishRender(ctx, data.renderId, data);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * Points the video at its finished render and closes the run. Idempotent: safe to run again after a crash.
 * The video's status only moves on if it is still on the script version this render was made from.
 */
async function finishRender(ctx: Loaded, renderId: string, data: JobData<"render">) {
  const { video, run } = ctx;
  const videoId = video._id.toString();
  const render = await Render.findById(renderId).lean();
  if (!render) return;
  const final = data.kind === "final";
  const status = final ? "rendered" : "previewed";
  const current =
    (await Video.findById(video._id, { scriptVersion: 1 }).lean())?.scriptVersion === render.scriptVersion;
  await Video.updateOne(
    { _id: video._id },
    {
      $set: {
        [final ? "finalRenderId" : "previewRenderId"]: render._id,
        "files.timelineKey": keys.timeline(video.workspaceId.toString(), videoId, render.scriptVersion),
        ...(render.thumbnailKey ? { "files.thumbnailKey": render.thumbnailKey } : {}),
        ...(current ? { status, stage: null, progress: 100 } : {}),
      },
    },
  );
  await PipelineRun.updateOne(
    { _id: run._id, status: { $ne: "ok" } },
    { $set: { status: "ok", scriptVersion: render.scriptVersion, finishedAt: new Date() } },
  );
  if (current) await emit(videoId, { type: "status", status, stage: null, progress: 100 });
  await emit(videoId, { type: "done", renderId });
}
