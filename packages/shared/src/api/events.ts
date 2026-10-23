import type { Stage, VideoStatus } from "../enums";
import type { ErrorCode } from "./result";

/** Live progress for one video: the worker publishes these on Redis channel `video:{id}`; SSE relays them. */
export type VideoEvent =
  | { type: "status"; status: VideoStatus; stage: Stage | null; progress: number } // 0–100
  | { type: "step"; stage: Stage; state: "started" | "done" | "failed"; detail?: string } // e.g. "7 scenes · 74 words"
  | { type: "script"; scriptVersion: number } // client refetches the video
  | { type: "claims"; total: number; toReview: number }
  | { type: "render"; renderId: string; progress: number } // every 10%
  | { type: "done"; renderId: string | null } // null when the run stops at the script (no render)
  | { type: "error"; stage: Stage; code: ErrorCode; message: string }; // user-safe message

export const videoChannel = (videoId: string) => `video:${videoId}`;
