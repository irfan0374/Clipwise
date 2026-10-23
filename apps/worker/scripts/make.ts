// Demo/ops command: queue a video for the sample workspace and follow its progress until it finishes.
// Usage: pnpm job:make "Why is the sky blue?" [--length 30|60|auto] [--format explainer] [--preview | --final]
// The worker must be running (pnpm dev, or pnpm --filter @clipwise/worker dev).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(repoRoot, ".env"), quiet: true });

const { connectDb, disconnectDb, Workspace } = await import("@clipwise/db");
const { closeQueues, closeRedis, startVideo, subscribeVideoEvents } = await import("@clipwise/queue");
const { Format, LengthMode, Topic, Voices } = await import("@clipwise/shared");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    length: { type: "string", default: "30" },
    format: { type: "string", default: "explainer" },
    voice: { type: "string", default: "Liam" },
    preview: { type: "boolean", default: false },
    final: { type: "boolean", default: false },
  },
});
const topic = Topic.parse(positionals.join(" "));
const voice = Voices.find((v) => v.name.toLowerCase() === values.voice.toLowerCase());
if (!voice) throw new Error(`--voice must be one of ${Voices.map((v) => v.name).join(", ")}`);
const target = values.final ? "final" : values.preview ? "preview" : "script";

await connectDb();
const ws =
  (await Workspace.findOne({ ownerUserId: "seed-user" })) ??
  (await Workspace.create({ ownerUserId: "seed-user", name: "Sample workspace" }));

const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`.padStart(4);
const ids = await startVideo({
  workspaceId: ws._id,
  userId: "seed-user",
  topic,
  format: Format.parse(values.format),
  lengthMode: LengthMode.parse(values.length),
  voiceId: voice.id,
  target,
});
console.log(
  `queued video ${ids.videoId} (${target}${target === "final" ? ", uses ElevenLabs credits" : ", 0 voice credits"})`,
);

await new Promise<void>((resolve) => {
  let stop: (() => Promise<void>) | undefined;
  const finish = async (code: number) => {
    await stop?.();
    process.exitCode = code;
    resolve();
  };
  void subscribeVideoEvents(ids.videoId, (e) => {
    if (e.type === "step")
      console.log(`${secs()}  ${e.stage.padEnd(9)} ${e.state}${e.detail ? `  · ${e.detail}` : ""}`);
    if (e.type === "render" && e.progress % 20 === 0) console.log(`${secs()}  render    ${e.progress}%`);
    if (e.type === "claims") console.log(`${secs()}  claims    ${e.total} checked, ${e.toReview} to review`);
    if (e.type === "done") {
      console.log(
        `${secs()}  ✓ done${e.renderId ? `, render ${e.renderId}` : " (script ready)"}. See it with: pnpm db:status`,
      );
      void finish(0);
    }
    if (e.type === "error") {
      console.log(`${secs()}  ✗ ${e.stage}: ${e.message} (${e.code})`);
      void finish(1);
    }
  }).then((s) => {
    stop = s;
  });
});

await closeQueues();
await closeRedis();
await disconnectDb();
