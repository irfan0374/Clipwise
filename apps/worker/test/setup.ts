import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach } from "vitest";

// Isolation: in-memory MongoDB, Redis database 15 (never the dev worker's db 0), a temp storage folder,
// and dummy provider keys (fake providers are injected, so nothing is ever called).
process.env.REDIS_URL = "redis://127.0.0.1:6379/15";
process.env.REDIS_NAMESPACE = "test:";
process.env.STORAGE_DRIVER = "local";
process.env.BETTER_AUTH_SECRET = "test-secret";
process.env.GEMINI_API_KEY = "test";
process.env.ELEVENLABS_API_KEY = "test";
process.env.ELEVENLABS_VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ";
process.env.GEMINI_DAILY_REQUESTS = "80";
process.env.ELEVENLABS_MONTHLY_CREDITS = "10000";

const { allModels, connectDb, disconnectDb } = await import("@clipwise/db");
const { closeQueues, closeRedis, redis } = await import("@clipwise/queue");
const { installBudgetGuards } = await import("../src/guards");
installBudgetGuards();

let mongo: MongoMemoryServer;
let storageDir: string;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "clipwise-worker-test-"));
  process.env.STORAGE_LOCAL_DIR = storageDir;
  mongo = await MongoMemoryServer.create();
  await connectDb({ uri: mongo.getUri("clipwise_test"), autoIndex: false });
  await Promise.all(allModels.map((m) => m.syncIndexes()));
});

beforeEach(async () => {
  await redis().flushdb();
  await Promise.all(allModels.map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await redis().flushdb();
  await closeQueues();
  await closeRedis();
  await disconnectDb();
  await mongo?.stop();
  await rm(storageDir, { recursive: true, force: true });
});
