import { z } from "zod";
import { Id } from "./api/common";

// Payloads carry IDs only; the worker always reads current data from MongoDB.
export const Queues = { ai: "ai", voice: "voice", render: "render", publish: "publish" } as const;
export type QueueName = keyof typeof Queues;

export const ScriptJob = z.object({ videoId: Id, runId: Id });
export const RegenerateSceneJob = z.object({
  videoId: Id,
  runId: Id,
  sceneIndex: z.number().int(),
  instruction: z.string().max(200).optional(),
  baseVersion: z.number().int(),
});
export const FactcheckJob = z.object({
  videoId: Id,
  runId: Id,
  scriptVersion: z.number().int(),
  sceneIndexes: z.array(z.number().int()).optional(),
});
export const VoiceJob = z.object({ videoId: Id, runId: Id, renderId: Id, scriptVersion: z.number().int() });
export const RenderJob = z.object({
  videoId: Id,
  runId: Id,
  renderId: Id,
  scriptVersion: z.number().int(),
  kind: z.enum(["final", "preview"]),
});
export const PublishJob = z.object({ postId: Id }); // v1, delayed until publishAt

/** Deterministic job IDs make double clicks and retries harmless. */
export const jobId = {
  script: (videoId: string, version: number) => `vid:${videoId}:script:v${version}`,
  scene: (videoId: string, index: number, version: number) => `vid:${videoId}:scene${index}:v${version}`,
  factcheck: (videoId: string, version: number) => `vid:${videoId}:factcheck:v${version}`,
  voice: (videoId: string, version: number) => `vid:${videoId}:voice:v${version}`,
  render: (videoId: string, version: number) => `vid:${videoId}:render:v${version}`,
  publish: (postId: string) => `post_${postId}`,
};
