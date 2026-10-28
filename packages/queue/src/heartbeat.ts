import { nsKey } from "./namespace";
import { redis } from "./redis";

// The worker says "I'm alive" every HEARTBEAT_MS. While the key exists the worker is online; the web app uses
// it to tell people that video making is paused (e.g. the Mac running the worker is off) instead of waiting
// silently. A second key without expiry remembers when it was last seen.
export const HEARTBEAT_MS = 30_000;
const ALIVE_SECONDS = 90; // three missed beats = offline
const aliveKey = () => nsKey("worker:alive");
const lastSeenKey = () => nsKey("worker:lastSeen");

export type WorkerBeat = { pid: number; startedAt: string; node: string };

export async function beatWorker(info: WorkerBeat, now = new Date()) {
  await redis()
    .multi()
    .set(aliveKey(), JSON.stringify({ ...info, at: now.toISOString() }), "EX", ALIVE_SECONDS)
    .set(lastSeenKey(), now.toISOString())
    .exec();
}

/** Called on a clean shutdown, so the app shows "paused" at once instead of after 90 seconds. */
export async function stopWorkerBeat() {
  await redis().del(aliveKey());
}

export type WorkerStatus = { online: boolean; lastSeen: string | null; startedAt: string | null };

export async function workerStatus(): Promise<WorkerStatus> {
  const [alive, lastSeen] = await redis().mget(aliveKey(), lastSeenKey());
  let startedAt: string | null = null;
  if (alive) {
    try {
      startedAt = (JSON.parse(alive) as WorkerBeat).startedAt ?? null;
    } catch {}
  }
  return { online: !!alive, lastSeen: lastSeen ?? null, startedAt };
}
