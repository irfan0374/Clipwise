import { Video } from "@clipwise/db";
import { type Providers, recordVoice } from "@clipwise/pipeline";
import type { JobData } from "@clipwise/queue";
import { enqueue } from "@clipwise/queue";
import { keys, storage } from "@clipwise/storage";
import { type Loaded, plainScript, resolveLength, runStage, setStatus } from "../context";

/** Records the voiceover for the current (fact-checked) script version, saves it to storage, queues the render. */
export async function voiceJob(ctx: Loaded, data: JobData<"voice">, attempt: number, providers?: Providers) {
  const { video } = ctx;
  const videoId = video._id.toString();
  const workspaceId = video.workspaceId.toString();
  if (!video.script) return;

  // Already recorded for this version by an earlier attempt: continue to the render.
  if (video.voice?.scriptVersion === video.scriptVersion && video.files?.voiceKey) {
    await enqueue("render", { ...data, scriptVersion: video.scriptVersion, kind: "final" });
    return;
  }
  if (video.scriptVersion !== data.scriptVersion) return; // stale

  const script = plainScript(video);
  const version = data.scriptVersion;

  // Credits are reserved before each ElevenLabs request and each charged take is recorded at once (guards.ts),
  // so a speed re-take can't pass the monthly budget and a later failure can't lose the record of a paid take.
  await setStatus(videoId, "voicing", "voice", 60);
  const v = await runStage(ctx, "voice", attempt, async () => {
    const r = await recordVoice(
      {
        script,
        length: resolveLength(video.lengthMode),
        voiceId: video.voiceId,
        log: (m) => console.log(`  [voice] ${m}`),
      },
      providers,
    );
    return {
      value: r,
      units: { credits: r.credits, characters: r.characters, seconds: r.seconds, speed: r.speed, model: r.model },
      detail: `${r.seconds.toFixed(1)}s · ${r.credits} credits`,
    };
  });

  const store = storage();
  const voiceKey = keys.voice(workspaceId, videoId, version);
  const alignmentKey = keys.alignment(workspaceId, videoId, version);
  await store.put(voiceKey, v.audio, { contentType: "audio/mpeg" });
  await store.put(alignmentKey, JSON.stringify(v.alignment), { contentType: "application/json" });

  await Video.updateOne(
    { _id: video._id },
    {
      $set: {
        voice: {
          scriptVersion: version,
          voiceId: video.voiceId,
          model: v.model,
          durationMs: Math.round(v.seconds * 1000),
          credits: v.credits,
        },
        "files.voiceKey": voiceKey,
        "files.alignmentKey": alignmentKey,
        progress: 72,
      },
    },
  );
  await enqueue("render", { ...data, scriptVersion: version, kind: "final" });
}
