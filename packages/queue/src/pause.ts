import type { QueueName } from "@clipwise/shared";
import { allQueues, queue } from "./queues";

// Admin kill switch: BullMQ's own pause stops workers from taking new jobs (running jobs finish).

export async function setGenerationPaused(paused: boolean, which: QueueName | "all" = "all") {
  const targets = which === "all" ? allQueues() : [queue(which)];
  await Promise.all(targets.map((q) => (paused ? q.pause() : q.resume())));
}

export async function isGenerationPaused(which: QueueName | "all" = "all") {
  const targets = which === "all" ? allQueues() : [queue(which)];
  const states = await Promise.all(targets.map((q) => q.isPaused()));
  return which === "all" ? states.some(Boolean) : states[0] === true;
}
