import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(repoRoot, ".env"), quiet: true });

// Queues (BullMQ + Redis) and job handlers arrive in Feature 6. Until then the worker only starts and waits.
const startedAt = Date.now();
console.log(`[worker] ready (node ${process.version}, pid ${process.pid})`);

const keepAlive = setInterval(() => {}, 60_000);

const shutdown = (signal: string) => {
  console.log(`[worker] ${signal} received, stopping after ${Math.round((Date.now() - startedAt) / 1000)}s`);
  clearInterval(keepAlive);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
