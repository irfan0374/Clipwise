import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { environmentProblems } from "@clipwise/shared";
import { config } from "dotenv";
import { flushMonitoring, initMonitoring } from "./monitoring";

// Settings: `.env` for local development; CLIPWISE_ENV=staging / live reads `.env.staging` / `.env.live`, so
// one Mac can run the staging and the live worker side by side (pnpm worker:staging / pnpm worker:live).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const env = process.env.CLIPWISE_ENV;
const envFile = path.join(repoRoot, env ? `.env.${env}` : ".env");
// On a server (Docker) the settings come from the environment itself, so the file is optional there.
if (env && !existsSync(envFile) && !process.env.MONGODB_URI) {
  console.error(`[worker] ${path.basename(envFile)} not found. Create it from .env.example (see design/deploy.md).`);
  process.exit(1);
}
config({ path: envFile, quiet: true });

// Guard against mixing environments: each worker must use its own Redis namespace and database.
const problems = environmentProblems(env, {
  redisNamespace: process.env.REDIS_NAMESPACE,
  mongoUri: process.env.MONGODB_URI,
});
if (problems.length) {
  console.error(
    `[worker] settings (${path.basename(envFile)} or the environment) are not set up for ${env}:\n  - ${problems.join("\n  - ")}`,
  );
  process.exit(1);
}
const monitoring = initMonitoring();

const { connectDb, disconnectDb } = await import("@clipwise/db");
const {
  beatWorker,
  budgetStatus,
  bullPrefix,
  closeQueues,
  closeRedis,
  HEARTBEAT_MS,
  newRedis,
  rebuildBudgetCounters,
  stopWorkerBeat,
  subscribeAllVideoEvents,
} = await import("@clipwise/queue");
const { Queues } = await import("@clipwise/shared");
const { Worker } = await import("bullmq");
const { makeProcessor } = await import("./processor");
const { installBudgetGuards } = await import("./guards");

await connectDb();
installBudgetGuards(); // atomic budget reservation before every Gemini / ElevenLabs request
const rebuilt = await rebuildBudgetCounters();
const budget = await budgetStatus();
console.log(
  `[worker] budgets: Gemini ${budget.gemini.used}/${budget.gemini.limit} requests today · ElevenLabs ${budget.elevenlabs.used}/${budget.elevenlabs.limit} credits this month${rebuilt.restored.gemini || rebuilt.restored.elevenlabs ? " (restored from usage records)" : ""}`,
);

const processor = makeProcessor();
// Rendering is heavy (Chrome + ffmpeg): one at a time. Voice: one, to stay inside ElevenLabs' limits.
const concurrency = { ai: 2, voice: 1, render: 1 } as const;
const workers = (["ai", "voice", "render"] as const).map(
  (name) =>
    new Worker(Queues[name], processor, {
      connection: newRedis(`worker:${name}`),
      concurrency: concurrency[name],
      prefix: bullPrefix(),
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

// "I'm alive" for the web app: without it, Create and Render say video making is paused.
const beat = { pid: process.pid, startedAt: new Date().toISOString(), node: process.version };
const sendBeat = () =>
  beatWorker(beat).catch((err: unknown) => console.error("[worker] heartbeat failed:", (err as Error).message));
await sendBeat();
const heartbeat = setInterval(() => void sendBeat(), HEARTBEAT_MS);

console.log(
  `[worker] ready (${env ?? "development"}, node ${process.version}, pid ${process.pid}) · queues: ai×2, voice×1, render×1${monitoring ? " · error reports on" : ""}`,
);

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal}: finishing current jobs, then stopping…`);
  clearInterval(heartbeat);
  await stopWorkerBeat().catch(() => {});
  await Promise.all(workers.map((w) => w.close()));
  await stopEvents();
  await closeQueues();
  await closeRedis();
  await disconnectDb();
  await flushMonitoring();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
