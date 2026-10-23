import { FactcheckJob, type QueueName, Queues, RenderJob, ScriptJob, VoiceJob } from "@clipwise/shared";
import { type JobsOptions, Queue } from "bullmq";
import type { z } from "zod";
import { redis } from "./redis";

/** Job name → payload schema and queue. Payloads carry IDs only; the worker reads current data from MongoDB. */
export const JobDefs = {
  script: { queue: Queues.ai, schema: ScriptJob },
  factcheck: { queue: Queues.ai, schema: FactcheckJob },
  voice: { queue: Queues.voice, schema: VoiceJob },
  render: { queue: Queues.render, schema: RenderJob },
} as const;
export type JobName = keyof typeof JobDefs;
export type JobData<N extends JobName> = z.infer<(typeof JobDefs)[N]["schema"]>;

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 10_000 }, // 10s, 20s
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

const cache = globalThis as typeof globalThis & { __clipwiseQueues?: Map<QueueName, Queue> };

export const queue = (name: QueueName): Queue => {
  cache.__clipwiseQueues ??= new Map();
  let q = cache.__clipwiseQueues.get(name);
  if (!q) {
    q = new Queue(name, { connection: redis(), defaultJobOptions, prefix: "bull" });
    cache.__clipwiseQueues.set(name, q);
  }
  return q;
};

export const allQueues = () => (Object.keys(Queues) as QueueName[]).filter((n) => n !== "publish").map(queue);

/**
 * Deterministic IDs (vid_{id}_{stage}_v{scriptVersion}_{run or render}): adding the same job twice, from a
 * double click or a retried parent job, is a no-op. BullMQ custom ids may not contain ":".
 */
export const jobIdFor = <N extends JobName>(name: N, data: JobData<N>): string => {
  const d = data as Record<string, unknown>;
  const base = `vid_${d.videoId}_${name}`;
  switch (name) {
    case "script":
      return `${base}_${d.runId}`;
    case "factcheck":
      return `${base}_v${d.scriptVersion}_${d.runId}`;
    default:
      return `${base}_v${d.scriptVersion}_${d.renderId}`;
  }
};

export async function enqueue<N extends JobName>(name: N, data: JobData<N>) {
  const def = JobDefs[name];
  const payload = def.schema.parse(data) as JobData<N>;
  return queue(def.queue).add(name, payload, { jobId: jobIdFor(name, payload) });
}

export const closeQueues = async () => {
  for (const q of cache.__clipwiseQueues?.values() ?? []) await q.close();
  cache.__clipwiseQueues?.clear();
};
