import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(repoRoot, ".env"), quiet: true });

const { connectDb, disconnectDb } = await import("@clipwise/db");
const { closeQueues, closeRedis, newRedis, rebuildBudgetCounters, subscribeAllVideoEvents, budgetStatus } =
  await import("@clipwise/queue");
const { Queues } = await import("@clipwise/shared");
const { Worker } = await import("bullmq");
const { makeProcessor } = await import("./processor");
const { installBudgetGuards } = await import("./guards");

await connectDb();
installBudgetGuards(); // atomic budget reservation before every Gemini / ElevenLabs request
const rebuilt = await rebuildBudgetCounters();
const budget = await budgetStatus();
console.log(
  `[worker] budgets: Gemini ${budget.gemini.used}/${budget.gemini.limit} requests today · ElevenLabs ${budget.elevenlabs.used}/${budget.elevenlabs.limit} credits this month (rebuilt from ${rebuilt.geminiRequests + rebuilt.elevenLabsCredits > 0 ? "usage" : "empty usage"})`,
);

const processor = makeProcessor();
// Rendering is heavy (Chrome + ffmpeg): one at a time. Voice: one, to stay inside ElevenLabs' limits.
const concurrency = { ai: 2, voice: 1, render: 1 } as const;
const workers = (["ai", "voice", "render"] as const).map(
  (name) =>
    new Worker(Queues[name], processor, {
      connection: newRedis(`worker:${name}`),
      concurrency: concurrency[name],
      prefix: "bull",
      // How long a job may go without a heartbeat before another worker takes it over (crash recovery).
      lockDuration: name === "render" ? 90_000 : 60_000,
    }),
);
for (const w of workers) {
  w.on("error", (err) => console.error(`[worker:${w.name}]`, err.message));
}

// Readable live log of every video's progress.
const stopEvents = await subscribeAllVideoEvents((videoId, e) => {
  const id = videoId.slice(-6);
  if (e.type === "step") console.log(`[video …${id}] ${e.stage} ${e.state}${e.detail ? ` · ${e.detail}` : ""}`);
  else if (e.type === "render" && e.progress % 20 === 0) console.log(`[video …${id}] render ${e.progress}%`);
  else if (e.type === "done") console.log(`[video …${id}] ✓ done${e.renderId ? ` (render ${e.renderId})` : ""}`);
  else if (e.type === "error") console.log(`[video …${id}] ✗ ${e.stage}: ${e.message} (${e.code})`);
});

console.log(`[worker] ready (node ${process.version}, pid ${process.pid}) · queues: ai×2, voice×1, render×1`);

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal}: finishing current jobs, then stopping…`);
  await Promise.all(workers.map((w) => w.close()));
  await stopEvents();
  await closeQueues();
  await closeRedis();
  await disconnectDb();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
